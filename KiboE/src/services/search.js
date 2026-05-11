// src/services/search.js
const db = require("../db/index"); // Aseguramos la ruta explícita por si acaso

/**
 * Convierte un array de números JS en un literal de vector para Postgres/pgvector:
 * [0.1, 0.2, 0.3] -> "[0.1,0.2,0.3]"
 */
function toVectorLiteral(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error("Embedding vacío o inválido");
  }
  return `[${array.join(",")}]`;
}

/**
 * Busca los chunks más relevantes dado el embedding de una pregunta.
 *
 * @param {number[]} questionEmbedding - Array de floats.
 * @param {number} limit
 */
async function searchRelevantChunks(questionEmbedding, limit = 5) {
  if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
    throw new Error("Embedding de pregunta inválido para búsqueda");
  }

  // Convertimos el array JS a literal de vector para pgvector
  const embeddingLiteral = toVectorLiteral(questionEmbedding);

  // ⭐ CAMBIO: Usamos <=> (Distancia Coseno) en lugar de <-> (Euclidiana)
  // Esto mejora la precisión semántica para respuestas de IA.
  const sql = `
    SELECT 
      c.id,
      c.document_id,
      d.resource_id,
      r.title AS resource_title,
      r.url AS resource_url,
      r.source_name,
      c.content,
      c.page_number,
      c.position,
      (c.embedding <=> $1::vector) AS score
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id
    LEFT JOIN public.resources r ON r.id = d.resource_id
    ORDER BY score ASC
    LIMIT $2;
  `;

  const params = [embeddingLiteral, limit];

  const result = await db.query(sql, params);
  return result.rows;
}

function formatChunkSource(chunk) {
  return {
    chunkId: chunk.id,
    documentId: chunk.document_id,
    resourceId: chunk.resource_id,
    resourceTitle: chunk.resource_title,
    resourceUrl: chunk.resource_url,
    sourceName: chunk.source_name,
    pageNumber: chunk.page_number,
    score: Number(chunk.score),
    preview:
      chunk.content.length > 140
        ? `${chunk.content.substring(0, 140)}...`
        : chunk.content,
  };
}

module.exports = {
  formatChunkSource,
  searchRelevantChunks,
};
