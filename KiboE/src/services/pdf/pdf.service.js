const axios = require("axios");
const { PDFParse } = require("pdf-parse");
const { splitIntoChunks } = require("../chunker");

function cleanPdfText(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validatePdfUrl(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL invalida para PDF");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("La URL del PDF debe usar http o https");
  }

  return parsed;
}

function estimateTokenCount(text) {
  return Math.ceil((text || "").trim().split(/\s+/).filter(Boolean).length * 1.35);
}

function buildPdfChunks(pages, maxChars = 1000) {
  const chunks = [];
  let position = 0;

  for (const page of pages) {
    const pageText = cleanPdfText(page.text);
    if (!pageText) continue;

    const pageChunks = splitIntoChunks(pageText, maxChars);

    for (const content of pageChunks) {
      chunks.push({
        content,
        pageNumber: page.pageNumber,
        position,
        tokenCount: estimateTokenCount(content),
      });
      position++;
    }
  }

  return chunks;
}

function buildPdfMetadata({ pageCount, content, pages }) {
  const lowTextPages = pages
    .filter((page) => cleanPdfText(page.text).length < 100)
    .map((page) => page.pageNumber);

  return {
    pageCount,
    extractedTextLength: cleanPdfText(content).length,
    needsOcr: lowTextPages.length > 0 || cleanPdfText(content).length < 100,
    lowTextPages,
  };
}

async function downloadPdfBuffer(url) {
  validatePdfUrl(url);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    maxContentLength: 25 * 1024 * 1024,
  });

  const contentType = response.headers["content-type"] || "";
  if (!contentType.includes("pdf") && !url.toLowerCase().includes(".pdf")) {
    throw new Error("La URL no parece apuntar a un PDF");
  }

  return Buffer.from(response.data);
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const data = await parser.getText();
    const content = cleanPdfText(data.text);

    if (!content) {
      throw new Error("No se pudo extraer texto del PDF. Puede ser un PDF escaneado.");
    }

    return {
      pageCount: data.total,
      content,
      pages: data.pages.map((page) => ({
        pageNumber: page.num,
        text: page.text,
      })),
    };
  } finally {
    await parser.destroy();
  }
}

async function extractPdfFromUrl(url) {
  validatePdfUrl(url);
  const buffer = await downloadPdfBuffer(url);
  return extractPdfText(buffer);
}

module.exports = {
  buildPdfMetadata,
  buildPdfChunks,
  cleanPdfText,
  downloadPdfBuffer,
  estimateTokenCount,
  extractPdfFromUrl,
  extractPdfText,
  validatePdfUrl,
};
