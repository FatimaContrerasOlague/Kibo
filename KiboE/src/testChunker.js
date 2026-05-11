const { splitIntoChunks } = require("./services/chunker");

const text = `
Este es un texto de prueba. Debería dividirse en varios
chunks si es lo suficientemente largo. La idea es que no
rompa frases a lo loco y trate de mantener párrafos
y puntos completos.

Otro párrafo más largo para ver cómo se comporta cuando
hay saltos de línea y más contenido...
`;

const chunks = splitIntoChunks(text, 80);
console.log("Total chunks:", chunks.length);
chunks.forEach((ch, i) => {
  console.log(`\n--- CHUNK ${i} ---\n${ch}\n(length: ${ch.length})`);
});