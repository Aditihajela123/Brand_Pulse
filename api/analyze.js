
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { companyName } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: "GEMINI_API_KEY is missing in Vercel settings."
        });
    }

    if (!companyName || typeof companyName !== "string") {
        return res.status(400).json({
            error: "Please enter a valid brand name."
        });
    }

    try {
        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

        const promptText = `Analyze the brand "${companyName}".
Return ONLY a valid JSON object in this format:
{
  "company": "${companyName}",
  "score": 85,
  "summary": "Short 2 sentence sentiment summary.",
  "positives": [{"tag": "QUALITY", "text": "What people love"}],
  "negatives": [{"severity": "HIGH", "text": "What people complain about"}],
  "suggestions": [{"title": "Improvement", "text": "Feature suggestion"}]
}`;

        let response;
        let data;

        for (let attempt = 0; attempt < 3; attempt++) {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: promptText }]
                    }]
                })
            });

            data = await response.json();

            if (response.ok) break;

            const retryable = [408, 429, 500, 502, 503, 504]
                .includes(response.status);

            if (!retryable || attempt === 2) {
                console.error("Gemini status:", response.status);
                console.error("Gemini error:", data.error?.message);
                return res.status(response.status).json({
                    error: data.error?.message || "Gemini API error"
                });
            }

            await new Promise(resolve =>
                setTimeout(resolve, 1000 * (2 ** attempt))
            );
        }

        const rawText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            return res.status(502).json({
                error: "Gemini returned an empty response. Please try again."
            });
        }

        const cleanedText = rawText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let jsonResponse;

        try {
            jsonResponse = JSON.parse(cleanedText);
        } catch {
            return res.status(502).json({
                error: "Gemini returned an invalid response. Please try again."
            });
        }

        return res.status(200).json(jsonResponse);

    } catch (error) {
        console.error("Analysis request failed:", error.message);
        return res.status(500).json({
            error: "Unable to analyze this brand right now. Please try again."
        });
    }
}
