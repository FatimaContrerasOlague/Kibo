// src/services/chat.js

const { getEmbedding } = require("./embeddings");
const { searchRelevantChunks } = require("./search");
const { askLLM } = require("./llm");

/**
 * Orquesta el flujo RAG:
 * 1. Embedding de la pregunta.
 * 2. Búsqueda de chunks relevantes en la BD.
 * 3. Llamada al LLM con esos contextos.
 *
 * @param {string} question - Pregunta del usuario.
 * @param {object} options - Opciones opcionales.
 * @param {number} [options.topK=10] - Cuántos chunks usar como contexto.
 * @param {boolean} [options.debug=false] - Si true, hace console.log de los contextos.
 * @param {number} [options.maxDistance] - Si se define, filtra chunks con score <= maxDistance.
 * @returns {Promise<{ answer: string, contexts: { id, document_id, content, score }[] }>}
 */
async function answerQuestionWithRAG(question, options = {}) {
  const { topK = 10, debug = false, maxDistance } = options;

  if (!question || !question.trim()) {
    throw new Error("Pregunta vacía");
  }

  // 1) Embedding de la pregunta
  const questionEmbedding = await getEmbedding(question);

  // 2) Búsqueda de chunks relevantes
  let chunks = await searchRelevantChunks(questionEmbedding, topK);

  // Opcional: filtrar por distancia (score)
  if (typeof maxDistance === "number") {
    chunks = chunks.filter((c) => c.score <= maxDistance);
  }

  if (debug) {
    console.log("\n[chat] Pregunta:", question);
    if (!chunks.length) {
      console.log("[chat] No se encontraron chunks relevantes.");
    } else {
      chunks.forEach((c, i) => {
        console.log(
          `\n[chat] Contexto [${i}] score=${c.score} doc=${c.document_id}`
        );
        console.log(c.content.slice(0, 300) + "...\n");
      });
    }
  }

  // 3) Extraemos solo los textos como contexto
  const contexts = chunks.map((c) => c.content);

  // 4) Llamar al LLM con pregunta + contextos (si no hay contextos, el LLM usará su conocimiento general)
  const answer = await askLLM(question, contexts);

  return {
    answer,
    contexts: chunks,
  };
}

module.exports = {
  answerQuestionWithRAG,
};