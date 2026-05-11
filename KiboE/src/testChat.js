// src/testChat.js
require("dotenv").config();
const { answerQuestionWithRAG } = require("./services/chat");

async function main() {
  try {
    const question = "¿Qué información hay en los documentos que ingeste?"; // cambia por algo relevante a tus URLs
    const result = await answerQuestionWithRAG(question, { topK: 5 });

    console.log("Pregunta:", question);
    console.log("\nRespuesta:");
    console.log(result.answer);

    console.log("\nContextos usados (ids y score):");
    result.contexts.forEach((c, i) => {
      console.log(
        `\n[${i}] id=${c.id}, doc=${c.document_id}, score=${c.score}\n${c.content.slice(
          0,
          200
        )}...`
      );
    });
  } catch (err) {
    console.error("Error en testChat:", err.message);
  }
}

main();