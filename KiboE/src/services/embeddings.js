// src/services/embeddings.js
//
// Router multi-proveedor para embeddings. Selecciona la implementacion segun
// la variable de entorno `EMBEDDINGS_PROVIDER`:
//   - "google" (default, legacy): Gemini via Generative Language API.
//   - "openai"                   : OpenAI text-embedding-3-small (dim=768).
//   - "local"                    : @xenova/transformers (multilingual-e5-base,
//                                  768 dim, offline, sin cuota).
//
// La dimension del vector se mantiene con `EMBEDDINGS_DIM` (default 768) para
// preservar la columna `VECTOR(768)` de la tabla `chunks` al cambiar provider.
//
// El parametro opcional `role` en las funciones indica si el texto es:
//   - "passage" (default): contenido para indexar
//   - "query"            : pregunta para buscar
// Algunos modelos (E5 local) se benefician de este prefijo; para Google/OpenAI
// el parametro se ignora silenciosamente.

const PROVIDER = (process.env.EMBEDDINGS_PROVIDER || "google").toLowerCase();

let provider;
switch (PROVIDER) {
  case "openai":
    provider = require("./providers/openai.embeddings");
    break;
  case "local":
    provider = require("./providers/local.embeddings");
    break;
  case "google":
  case "gemini":
    provider = require("./providers/google.embeddings");
    break;
  default:
    throw new Error(
      `EMBEDDINGS_PROVIDER desconocido: "${PROVIDER}". Usa "google", "openai" o "local".`,
    );
}

console.log(`[embeddings] Provider activo: ${PROVIDER}`);

/**
 * Obtiene el embedding de un solo texto.
 * @param {string} text
 * @param {object} [opts]
 * @param {"passage"|"query"} [opts.role="passage"]
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text, opts = {}) {
  if (!text || !text.trim()) throw new Error("Texto vacio para embedding");
  return provider.embedOne(text, opts);
}

/**
 * Obtiene embeddings para N textos en el menor numero de llamadas posibles.
 * @param {string[]} texts
 * @param {object} [opts]
 * @param {"passage"|"query"} [opts.role="passage"]
 */
async function getEmbeddingsBatch(texts, opts = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  return provider.embedBatch(texts, opts);
}

/** Si el provider soporta warmup (carga previa), lo expone; si no, no-op. */
async function warmup() {
  if (typeof provider.warmup === "function") {
    return provider.warmup();
  }
}

module.exports = {
  getEmbedding,
  getEmbeddingsBatch,
  warmup,
  activeProvider: PROVIDER,
};
