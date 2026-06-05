import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mealDescription } = req.body;

  if (!mealDescription) {
    return res.status(400).json({ error: "Meal description is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Estimate the macronutrients for this meal description. Be realistic but slightly conservative in estimates. Return ONLY valid JSON with no markdown or extra text, in this exact format:
{"mealName":"","calories":0,"protein":0,"carbs":0,"fat":0,"notes":""}

Meal: ${mealDescription}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up the response (remove markdown if present)
    const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
    const macros = JSON.parse(cleanedText);

    return res.status(200).json(macros);
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: "Failed to estimate macros",
      details: error.message,
    });
  }
}
