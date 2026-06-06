import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, userProfile, mealSummary } = req.body;

  if (!messages || !userProfile) {
    return res.status(400).json({ error: "Messages and userProfile are required" });
  }

  // Build system prompt with user context
  const systemPrompt = `You are a knowledgeable, friendly fitness nutrition coach. You are chatting with ${userProfile.name}.

Their profile:
- Goal: ${userProfile.goal === 'build-muscle' ? 'Build muscle' : userProfile.goal === 'lose-fat' ? 'Lose fat' : 'Maintain'}
- Weight: ${userProfile.weight}kg
- Daily macro targets: ${userProfile.macroTargets?.calories} cal, ${userProfile.macroTargets?.protein}g protein, ${userProfile.macroTargets?.carbs}g carbs, ${userProfile.macroTargets?.fat}g fat
${userProfile.dietaryRestrictions ? `- Dietary restrictions: ${userProfile.dietaryRestrictions}` : ''}

Their recent nutrition data (last 7 days):
${mealSummary || 'No meal data yet'}

Rules for your responses:
- Keep answers SHORT and DIRECT — 2 to 4 sentences max
- Be warm and encouraging, not clinical or preachy
- Give specific numbers when relevant (grams, calories)
- Always keep their goal and dietary restrictions in mind
- If they ask about substitutions, give a direct yes/no + brief reason
- Never pad with unnecessary disclaimers
- Always refer to them by name occasionally to keep it personal`;

  // Build conversation for Gemini
  // Gemini uses "user" and "model" roles
  const geminiHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const lastMessage = messages[messages.length - 1].content;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
      });

      const chat = model.startChat({
        history: geminiHistory
      });

      const result = await chat.sendMessage(lastMessage);
      const reply = result.response.text();

      console.log(`Chat reply via model: ${modelName}`);
      return res.status(200).json({ reply });
    } catch (error) {
      console.log(`Model ${modelName} failed: ${error.message}`);
      continue;
    }
  }

  return res.status(500).json({
    error: "Failed to get a response",
    details: "No compatible Gemini models found"
  });
}