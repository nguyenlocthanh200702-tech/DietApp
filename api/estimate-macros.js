import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// List of models to try in order
const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];

async function tryEstimateWithModel(modelName, prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
    const macros = JSON.parse(cleanedText);
    console.log(`Successfully used model: ${modelName}`);
    return macros;
  } catch (error) {
    console.log(`Model ${modelName} failed: ${error.message}`);
    throw error;
  }
}

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

  const prompt = `Estimate the macronutrients for this meal description. Be realistic but slightly conservative in estimates. Return ONLY valid JSON with no markdown or extra text, in this exact format:
{"mealName":"","calories":0,"protein":0,"carbs":0,"fat":0,"notes":""}

Meal: ${mealDescription}`;

  // Try each model until one works
  for (const modelName of MODELS_TO_TRY) {
    try {
      const macros = await tryEstimateWithModel(modelName, prompt);
      return res.status(200).json(macros);
    } catch (error) {
      // Continue to next model
      continue;
    }
  }

  // If all models failed
  console.error("All models failed");
  return res.status(500).json({
    error: "Failed to estimate macros with any available model",
    details: "No compatible Gemini models found",
  });
}