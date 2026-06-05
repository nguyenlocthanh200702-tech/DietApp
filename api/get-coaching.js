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

  const { mealSummary, goal, macroTargets } = req.body;

  if (!mealSummary) {
    return res.status(400).json({ error: "Meal summary is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `You are a supportive fitness coach. Analyze this person's nutrition data from the last 7 days and give brief, actionable advice.

Their macro targets: ${macroTargets.calories} cal, ${macroTargets.protein}g protein, ${macroTargets.carbs}g carbs, ${macroTargets.fat}g fat per day

Their goal: ${goal === "build-muscle" ? "Build muscle" : goal === "lose-fat" ? "Lose fat" : "Maintain"}

Their data (last 7 days):
${mealSummary || "No meal data yet"}

Give 2-3 specific, encouraging observations and suggestions. Keep it friendly and motivating, not preachy. Format as plain text paragraphs. Be concise and actionable.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const advice = response.text();

    return res.status(200).json({ advice });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: "Failed to get coaching advice",
      details: error.message,
    });
  }
}
