
/**
 * Divide un texto largo en chunks de tamaño aproximado maxChars.
 * Intenta respetar párrafos y puntos para que no corte frases a lo loco.
 *
 * @param {string} text - Texto original largo.
 * @param {number} maxChars - Máximo de caracteres por chunk (aprox).
 * @returns {string[]} Lista de chunks.
 */
function splitIntoChunks(text, maxChars = 1000) {
  if (!text) return [];

  // Normalizamos un poco el texto
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n+/); // separamos por líneas/párrafos
  const chunks = [];
  let currentChunk = "";

  const pushCurrentChunk = () => {
    const trimmed = currentChunk.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
    currentChunk = "";
  };

  for (const para of paragraphs) {
    const paragraph = para.trim();
    if (!paragraph) continue;

    // Si el párrafo completo cabe en el chunk actual, lo agregamos
    if ((currentChunk + " " + paragraph).trim().length <= maxChars) {
      currentChunk = (currentChunk + " " + paragraph).trim();
      continue;
    }

    // Si el párrafo es demasiado grande, lo partimos por frases/puntos.
    if (paragraph.length > maxChars) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/); // divide por punto/?,! + espacio

      for (const sentence of sentences) {
        const sent = sentence.trim();
        if (!sent) continue;

        if ((currentChunk + " " + sent).trim().length <= maxChars) {
          currentChunk = (currentChunk + " " + sent).trim();
        } else {
          // el chunk actual está lleno, lo empujamos y empezamos otro
          pushCurrentChunk();
          if (sent.length <= maxChars) {
            currentChunk = sent;
          } else {
            // frase absurdamente larga: la partimos a la fuerza por caracteres
            let start = 0;
            while (start < sent.length) {
              const slice = sent.slice(start, start + maxChars);
              chunks.push(slice.trim());
              start += maxChars;
            }
            currentChunk = "";
          }
        }
      }
    } else {
      // El párrafo cabe solo pero no en el chunk actual → cerramos chunk y empezamos otro
      pushCurrentChunk();
      currentChunk = paragraph;
    }
  }

  // último chunk pendiente
  pushCurrentChunk();

  return chunks;
}

module.exports = {
  splitIntoChunks,
};