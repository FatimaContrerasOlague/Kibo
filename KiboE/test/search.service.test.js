const test = require("node:test");
const assert = require("node:assert/strict");

const { formatChunkSource } = require("../src/services/search");

test("formatChunkSource exposes resource and page citation fields", () => {
  const source = formatChunkSource({
    id: "10",
    document_id: "5",
    resource_id: "2",
    resource_title: "Algebra I",
    resource_url: "https://example.com/algebra.pdf",
    source_name: "Biblioteca",
    page_number: 12,
    score: 0.12345,
    content: "Texto de ejemplo para explicar factorizacion.",
  });

  assert.deepEqual(source, {
    chunkId: "10",
    documentId: "5",
    resourceId: "2",
    resourceTitle: "Algebra I",
    resourceUrl: "https://example.com/algebra.pdf",
    sourceName: "Biblioteca",
    pageNumber: 12,
    score: 0.12345,
    preview: "Texto de ejemplo para explicar factorizacion.",
  });
});
