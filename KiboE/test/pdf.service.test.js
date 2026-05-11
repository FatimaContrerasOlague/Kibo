const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPdfChunks,
  buildPdfMetadata,
  validatePdfUrl,
} = require("../src/services/pdf/pdf.service");

test("buildPdfChunks keeps page numbers when chunking extracted PDF pages", () => {
  const pages = [
    { pageNumber: 1, text: "Algebra basica. Factorizacion por factor comun." },
    { pageNumber: 2, text: "Diferencia de cuadrados. Ejemplos resueltos." },
  ];

  const chunks = buildPdfChunks(pages, 35);

  assert.equal(chunks.length, 4);
  assert.deepEqual(
    chunks.map((chunk) => chunk.pageNumber),
    [1, 1, 2, 2],
  );
  assert.equal(chunks[0].position, 0);
  assert.equal(chunks[3].position, 3);
  assert.match(chunks[0].content, /Algebra/);
  assert.match(chunks[2].content, /Diferencia/);
});

test("validatePdfUrl only accepts http or https URLs", () => {
  assert.equal(validatePdfUrl("https://example.com/libro.pdf").href, "https://example.com/libro.pdf");
  assert.throws(() => validatePdfUrl("ftp://example.com/libro.pdf"), /http o https/);
  assert.throws(() => validatePdfUrl("not-a-url"), /URL invalida/);
});

test("buildPdfMetadata marks low-text pages as OCR candidates", () => {
  const metadata = buildPdfMetadata({
    pageCount: 2,
    content: "Texto suficiente para el documento completo, pero una pagina casi no trae texto.",
    pages: [
      {
        pageNumber: 1,
        text:
          "Esta pagina tiene suficiente texto para ser tomada como texto extraido correctamente. " +
          "Incluye varias palabras adicionales para superar el umbral minimo.",
      },
      { pageNumber: 2, text: "x" },
    ],
  });

  assert.equal(metadata.pageCount, 2);
  assert.equal(metadata.needsOcr, true);
  assert.deepEqual(metadata.lowTextPages, [2]);
  assert.equal(metadata.extractedTextLength > 0, true);
});
