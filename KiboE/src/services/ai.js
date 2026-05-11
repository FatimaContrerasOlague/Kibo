const axios = require("axios");

const apiKey = process.env.LLM_API_KEY || process.env.EMBEDDINGS_API_KEY;
const modelName = process.env.LLM_MODEL || "gemini-2.5-flash";

const fallbackMessage =
  "Todavia no tengo suficiente informacion confiable para responder eso.";

function stripJsonFence(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function generateText({ systemPrompt, userPrompt, temperature = 0.3, maxOutputTokens = 700 }) {
  if (!apiKey) {
    throw new Error("Configura LLM_API_KEY o EMBEDDINGS_API_KEY en .env");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const response = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" },
  });

  return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackMessage;
}

async function generateJson({ systemPrompt, userPrompt, temperature = 0.2, maxOutputTokens = 900 }) {
  const text = await generateText({
    systemPrompt,
    userPrompt,
    temperature,
    maxOutputTokens,
  });

  try {
    return JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new Error(`La IA no devolvio JSON valido: ${error.message}`);
  }
}

module.exports = {
  generateJson,
  generateText,
};
