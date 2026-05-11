// src/routes/chat.routes.js

const express = require('express');
const router = express.Router();

// Importamos los 3 servicios que ya construimos
const { getEmbedding } = require('../services/embeddings');
const { formatChunkSource, searchRelevantChunks } = require('../services/search');
const { askLLM } = require('../services/llm');

router.post('/', async (req, res) => {
  const { question, history = [] } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ ok: false, error: "La pregunta es requerida." });
  }

  try {
    console.log(`[chat] Pregunta recibida: "${question}"`);

    // PASO 1: Convertir la pregunta en números (Embedding)
    // Usamos el mismo servicio que en ingestión para que sean compatibles.
    const questionVector = await getEmbedding(question);
    
    // PASO 2: Buscar en la Base de Datos
    // Buscamos los 3 fragmentos más parecidos semánticamente.
    const relevantChunks = await searchRelevantChunks(questionVector, 3);
    
    // Extraemos solo el texto de los chunks encontrados
    const contexts = relevantChunks.map(chunk => chunk.content);
    
    console.log(`[chat] Encontrados ${contexts.length} fragmentos de contexto.`);

    // PASO 3: Generar la respuesta con IA (RAG)
    // Le enviamos al LLM la pregunta original + la información encontrada.
    const answer = await askLLM(question, contexts, history);

    // PASO 4: Responder al Frontend
    res.json({
      ok: true,
      answer: answer,
      sources: relevantChunks.map(formatChunkSource)
    });

  } catch (error) {
    console.error("[chat] Error procesando la pregunta:", error.message);
    res.status(500).json({ 
        ok: false, 
        error: "Hubo un error interno al procesar tu pregunta." 
    });
  }
});

module.exports = router;
