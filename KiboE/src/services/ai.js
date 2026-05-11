// src/services/ai.js
//
// Funciones generales para llamar a Gemini (texto libre, JSON estructurado y
// streaming). Soporta multiples API keys via LLM_API_KEY="key1,key2,...".
// Si LLM_API_KEY no existe, cae a EMBEDDINGS_API_KEY (retrocompatible).

const axios = require("axios");
const { geminiHttpsAgent } = require("./gemini-http");
const { withRetry, isRetryableAxiosError } = require("../utils/retry");
const {
  KeyPool,
  parseKeys,
  withKeyRotation,
} = require("../utils/key-pool");

const MODEL_NAME = process.env.LLM_MODEL || "gemini-2.5-flash";

const KEY_COOLDOWN_MS = Number(
  process.env.LLM_KEY_COOLDOWN_MS || 60 * 60 * 1000,
);

const fallbackMessage =
  "Todavia no tengo suficiente informacion confiable para responder eso.";

let _pool = null;
function pool() {
  if (_pool) return _pool;
  const keys = parseKeys(
    process.env.LLM_API_KEY || process.env.EMBEDDINGS_API_KEY,
  );
  if (keys.length === 0) {
    throw new Error("Configura LLM_API_KEY o EMBEDDINGS_API_KEY en .env");
  }
  _pool = new KeyPool(keys, { cooldownMs: KEY_COOLDOWN_MS });
  if (keys.length > 1) {
    console.log(`[ai] Pool LLM con ${keys.length} llaves activo`);
  }
  return _pool;
}

const shouldRetryExceptQuota = (err) =>
  err?.response?.status !== 429 &&
  !(
    err?.response?.status === 403 &&
    /quota|limit|exceeded/i.test(err?.response?.data?.error?.message || "")
  ) &&
  isRetryableAxiosError(err);

function stripJsonFence(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function generateText({
  systemPrompt,
  userPrompt,
  temperature = 0.3,
  maxOutputTokens = 700,
}) {
  return withKeyRotation(pool(), async (apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    const body = {
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }],
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    };

    const response = await withRetry(
      () =>
        axios.post(url, body, {
          headers: { "Content-Type": "application/json" },
          httpsAgent: geminiHttpsAgent,
          timeout: 45_000,
        }),
      {
        label: "ai.generateText",
        retries: 3,
        shouldRetry: shouldRetryExceptQuota,
      },
    );

    return (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      fallbackMessage
    );
  });
}

async function generateJson({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxOutputTokens = 900,
}) {
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

/**
 * Stream del LLM token a token. Llama a `onToken(text)` con cada fragmento
 * que llega. Resuelve cuando termina el stream.
 *
 * Usa el endpoint streamGenerateContent con alt=sse de Gemini.
 */
async function generateTextStream({
  systemPrompt,
  userPrompt,
  temperature = 0.3,
  maxOutputTokens = 900,
  onToken,
}) {
  return withKeyRotation(pool(), async (apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const body = {
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    };

    const response = await withRetry(
      () =>
        axios.post(url, body, {
          headers: { "Content-Type": "application/json" },
          httpsAgent: geminiHttpsAgent,
          responseType: "stream",
          timeout: 90_000,
        }),
      {
        label: "ai.generateTextStream",
        retries: 2,
        shouldRetry: shouldRetryExceptQuota,
      },
    );

    return new Promise((resolve, reject) => {
      let buffer = "";

      response.data.on("data", (bytes) => {
        buffer += bytes.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!rawEvent.startsWith("data:")) continue;
          const jsonPart = rawEvent.slice(5).trim();
          if (!jsonPart || jsonPart === "[DONE]") continue;
          try {
            const evt = JSON.parse(jsonPart);
            const parts = evt?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p.text === "string" && p.text.length > 0) {
                  onToken(p.text);
                }
              }
            }
          } catch {
            /* ignoramos JSON fragmentado */
          }
        }
      });

      response.data.on("end", resolve);
      response.data.on("error", reject);
    });
  });
}

module.exports = {
  generateJson,
  generateText,
  generateTextStream,
};
