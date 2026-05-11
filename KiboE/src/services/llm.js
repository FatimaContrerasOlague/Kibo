// src/services/llm.js
//
// Endpoint RAG para el chat tutor: combina pregunta + contextos + historial
// breve y llama a Gemini. Usa rotacion de keys y retry.
// Nota: hoy el chat principal se arma en `chat.service.js` con citas
// inline/streaming/etc. Este modulo queda como API simple retrocompatible.

const { generateText } = require("./ai");

const fallbackMessage =
  "Todavia no tengo suficiente material confiable sobre ese tema. " +
  "Puedes compartir mas detalles de tu tarea o agregar una fuente para revisarla.";

function buildHistoryText(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  return history
    .slice(-3)
    .map((h) => {
      const u = h.user ? `Usuario: ${h.user}` : "";
      const b = h.bot ? `Kibo: ${h.bot}` : "";
      return [u, b].filter((s) => s.trim().length > 0).join("\n");
    })
    .filter((s) => s.trim().length > 0)
    .join("\n---\n");
}

/**
 * Llama al LLM con la pregunta + contextos (RAG simple).
 *
 * @param {string} question
 * @param {string[]} contexts
 * @param {Array<{user?: string, bot?: string}>} [history]
 * @returns {Promise<string>}
 */
async function askLLM(question, contexts, history = []) {
  if (!question || !question.trim()) return fallbackMessage;

  const hasContext = Array.isArray(contexts) && contexts.length > 0;
  const contextText = hasContext
    ? contexts.join("\n\n---\n\n")
    : fallbackMessage;
  const historyText = buildHistoryText(history);

  const systemPrompt = `
Eres un tutor virtual educativo llamado "Kibo".

Tienes acceso a un CONTEXTO opcional con fragmentos de recursos educativos.

REGLAS:
1. Si el CONTEXTO contiene informacion relevante para la pregunta, usalo como fuente principal.
2. Si el CONTEXTO no es suficiente, responde con tu conocimiento general como un buen tutor, sin mencionar al usuario que falta material.
3. Explica como tutor: claro, breve y con un ejemplo si ayuda.
4. No inventes datos especificos (fechas, montos, nombres) que no esten en el CONTEXTO ni sean conocimiento consolidado.
5. Si la pregunta es ambigua, pide aclaracion breve antes de responder.
`.trim();

  const userPrompt = `
CONTEXTO:
"""
${contextText}
"""

${historyText ? `HISTORIAL (ultimos turnos):\n${historyText}\n` : ""}

PREGUNTA DEL USUARIO:
${question}
`.trim();

  try {
    const answer = await generateText({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxOutputTokens: 500,
    });
    return answer && answer.trim().length > 0 ? answer : fallbackMessage;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("[llm] Error al llamar al LLM:", msg);
    return fallbackMessage;
  }
}

module.exports = {
  askLLM,
};
