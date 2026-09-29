export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { companyName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings.' });
    }

    try {
        // Updated model endpoint to gemini-2.0-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const promptText = `Analyze the brand "${companyName}" and return ONLY a raw JSON object (no markdown, no backticks) in the following format:
{
  "company": "${companyName}",
  "score": 85,
  "summary": "Short 2 sentence sentiment summary.",
  "positives": [{"tag": "QUALITY", "text": "What people love"}],
  "negatives": [{"severity": "HIGH", "text": "What people complain about"}],
  "suggestions": [{"title": "Improvement", "text": "Feature suggestion"}]
}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "Gemini API error" });
        }

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const jsonResponse = JSON.parse(rawText);
        return res.status(200).json(jsonResponse);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}