const { getEmbedding } = require("./services/embeddings");

async function main() {
  try {
    const text = "Hola, esto es una prueba de embedding.";
    const emb = await getEmbedding(text);
    console.log("Embedding length:", emb.length);
    console.log("Primeros 5 valores:", emb.slice(0, 5));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();