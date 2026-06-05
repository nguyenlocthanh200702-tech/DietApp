import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const models = await genAI.listModels();
    
    const availableModels = [];
    for await (const model of models) {
      availableModels.push({
        name: model.name,
        displayName: model.displayName,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
        supportedGenerationMethods: model.supportedGenerationMethods,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Available models:",
      models: availableModels,
    });
  } catch (error) {
    console.error("Error listing models:", error);
    return res.status(500).json({
      error: "Failed to list models",
      details: error.message,
    });
  }
}
