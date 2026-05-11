// src/services/embeddings.js
//
// Router multi-proveedor para embeddings. Selecciona la implementacion segun
// la variable de entorno `EMBEDDINGS_PROVIDER`:
//   - "google" (default, legacy): Gemini via Generative Language API.
//   - "openai": OpenAI text-embedding-3-small con dimensions=768 (Matryoshka).
//
// La dimension del vector se mantiene con `EMBEDDINGS_DIM` (default 768) para
// preservar la columna `VECTOR(768)` de la tabla `chunks` al cambiar provider.

const PROVIDER = (process.env.EMBEDDINGS_PROVIDER || "google").toLowerCase();

let provider;
switch (PROVIDER) {
  case "openai":
    provider = require("./providers/openai.embeddings");
    break;
  case "google":
  case "gemini":
    provider = require("./providers/google.embeddings");
    break;
  default:
    throw new Error(
      `EMBEDDINGS_PROVIDER desconocido: "${PROVIDER}". Usa "google" u "openai".`,
    );
}

console.log(`[embeddings] Provider activo: ${PROVIDER}`);

/**
 * Obtiene el embedding de un solo texto.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  if (!text || !text.trim()) throw new Error("Texto vacio para embedding");
  return provider.embedOne(text);
}

/**
 * Obtiene embeddings para N textos en el menor numero de llamadas posibles.
 *
 * @param {string[]} texts
 * @returns {Promise<Array<{ok: true, value: number[]} | {ok: false, index: number, error: Error}>>}
 */
async function getEmbeddingsBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  return provider.embedBatch(texts);
}

module.exports = {
  getEmbedding,
  getEmbeddingsBatch,
  activeProvider: PROVIDER,
};
