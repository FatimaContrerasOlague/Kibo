const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");

const {
  extractPdfLinks,
  looksLikePdfUrl,
} = require("../src/services/scraper");

test("looksLikePdfUrl detects pdf extensions (ignoring query/hash)", () => {
  assert.equal(looksLikePdfUrl("https://a.com/libro.pdf"), true);
  assert.equal(looksLikePdfUrl("https://a.com/LIBRO.PDF"), true);
  assert.equal(looksLikePdfUrl("https://a.com/libro.pdf?x=1"), true);
  assert.equal(looksLikePdfUrl("https://a.com/libro.pdf#p=1"), true);
  assert.equal(looksLikePdfUrl("https://a.com/libro"), false);
  assert.equal(looksLikePdfUrl("https://a.com/libro.pdfx"), false);
  assert.equal(looksLikePdfUrl("no-es-url"), false);
});

test("extractPdfLinks resolves relative URLs and dedupes", () => {
  const html = `
    <html><body>
      <a href="libro1.pdf">L1</a>
      <a href="/docs/libro2.pdf">L2</a>
      <a href="https://otro.com/libro3.pdf">Otro dominio</a>
      <a href="https://mismo.com/libro4.pdf">L4</a>
      <a href="libro1.pdf">duplicado</a>
      <a href="pagina.html">no-pdf</a>
    </body></html>
  `;
  const $ = cheerio.load(html);

  const links = extractPdfLinks($, "https://mismo.com/cursos/", {
    sameDomainOnly: true,
    max: 10,
  });

  const urls = links.map((l) => l.url).sort();
  assert.deepEqual(urls, [
    "https://mismo.com/cursos/libro1.pdf",
    "https://mismo.com/docs/libro2.pdf",
    "https://mismo.com/libro4.pdf",
  ]);
});

test("extractPdfLinks honors sameDomainOnly=false", () => {
  const html = `
    <a href="/local.pdf">L</a>
    <a href="https://otro.com/ext.pdf">E</a>
  `;
  const $ = cheerio.load(html);

  const links = extractPdfLinks($, "https://mismo.com/", {
    sameDomainOnly: false,
    max: 10,
  });

  assert.equal(links.length, 2);
});

test("extractPdfLinks respects max", () => {
  const html = Array.from(
    { length: 30 },
    (_, i) => `<a href="/f${i}.pdf">f${i}</a>`,
  ).join("");
  const $ = cheerio.load(html);

  const links = extractPdfLinks($, "https://mismo.com/", {
    sameDomainOnly: true,
    max: 5,
  });

  assert.equal(links.length, 5);
});
