// src/services/embeddings.js - SOLUCIÓN DE CONTORNO VÍA REST

require("dotenv").config();
const axios = require('axios'); // ✅ Usaremos axios para la petición REST directa

const apiKey = process.env.EMBEDDINGS_API_KEY;
if (!apiKey) {
  console.warn(
    "[embeddings] EMBEDDINGS_API_KEY no está definida en el .env. " +
      "Las llamadas a getEmbedding van a fallar."
  );
}

const EMBEDDING_MODEL = process.env.EMBEDDINGS_MODEL || "gemini-embedding-001";
const EMBEDDINGS_DIM = Number(process.env.EMBEDDINGS_DIM || 768);

/**
 * Genera el vector embedding para un trozo de texto usando el endpoint REST.
 * * Este método evita los errores de compatibilidad del SDK de Node.
 */
async function getEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error("Texto vacío para embedding");
  }

    try {
        // Endpoint REST de Google Generative Language
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
        
        // Formato JSON que el endpoint REST espera:
        const body = {
            content: { 
                parts: [{ text: text }] // Array de partes
            },
            outputDimensionality: EMBEDDINGS_DIM
        };

        const response = await axios.post(url, body, {
            headers: { 'Content-Type': 'application/json' }
        });

        // La respuesta del endpoint REST es response.data.embedding.values
        const values = response.data.embedding.values; 

        console.log(
            "[embeddings] Dimensión:",
            values.length,
            "Modelo:",
            EMBEDDING_MODEL
        );

        return values;
    } catch (err) {
        // Capturamos el error HTTP real de Google (e.g., 401, 403, 400 Bad Request)
        const errorMsg = err.response?.data?.error?.message || err.message;
        console.error("[embeddings] Error al obtener embedding:", errorMsg);
        
        // Si el error es 400 (Bad Request), significa que la sintaxis JSON sigue mal.
        if (err.response && err.response.status === 400) {
             throw new Error("Fallo en el formato de petición JSON al servidor de Google. Revisar la estructura 'content'.");
        }
        
        throw new Error("Error al obtener embedding desde Gemini: " + errorMsg);
    }
}

module.exports = {
  getEmbedding,
};
