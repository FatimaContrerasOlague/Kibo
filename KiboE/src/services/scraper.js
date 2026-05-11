// src/services/scraper.js
const axios = require("axios");
const cheerio = require("cheerio");
const { assertPublicUrl } = require("../utils/url-guard");

const SCRAPER_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 15_000);
const SCRAPER_MAX_BYTES = Number(
  process.env.SCRAPER_MAX_BYTES || 10 * 1024 * 1024,
);

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/** true si la URL termina en .pdf (antes de query/hash). */
function looksLikePdfUrl(url) {
  try {
    const parsed = new URL(url);
    return /\.pdf$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Extrae enlaces a PDFs del DOM cargado en `$`, resolviendo URLs relativas
 * contra `baseUrl`.
 *
 * @param {cheerio.CheerioAPI} $
 * @param {string} baseUrl
 * @param {object} [options]
 * @param {boolean} [options.sameDomainOnly=true]
 * @param {number}  [options.max=20]
 */
function extractPdfLinks($, baseUrl, { sameDomainOnly = true, max = 20 } = {}) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let resolved;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }

    // Solo http/https
    if (!["http:", "https:"].includes(resolved.protocol)) return;
    if (!looksLikePdfUrl(resolved.href)) return;
    if (sameDomainOnly && resolved.hostname !== base.hostname) return;

    const normalized = resolved.href.split("#")[0];
    if (seen.has(normalized)) return;

    seen.add(normalized);
    const title = cleanText($(el).text()) || null;
    links.push({ url: normalized, title });

    if (links.length >= max) return false; // detiene el .each
  });

  return links;
}

/**
 * Descarga una pagina y devuelve { url, title, content, pdfLinks }.
 *
 * Lanza un error con `.isPdfResponse = true` si la respuesta es un PDF
 * (para que el caller decida usar el pipeline de PDF).
 *
 * @param {string} url
 * @param {object} [options]
 * @param {boolean} [options.detectPdfLinks=true]
 * @param {boolean} [options.sameDomainOnly=true]
 * @param {number}  [options.maxPdfLinks=20]
 */
async function scrapeUrl(
  url,
  { detectPdfLinks = true, sameDomainOnly = true, maxPdfLinks = 20 } = {},
) {
  await assertPublicUrl(url);

  let response;
  try {
    response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: SCRAPER_TIMEOUT_MS,
      maxContentLength: SCRAPER_MAX_BYTES,
      maxBodyLength: SCRAPER_MAX_BYTES,
      maxRedirects: 5,
      // Soltamos responseType default para HTML, y decidimos por content-type
      responseType: "arraybuffer",
    });
  } catch (err) {
    throw new Error(`Error al hacer scraping de ${url}: ${err.message}`);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();

  // Si el servidor respondio un PDF (aunque la URL no lo declarara), avisamos.
  if (contentType.includes("application/pdf")) {
    const err = new Error("La URL devolvio un PDF, no HTML");
    err.isPdfResponse = true;
    err.finalUrl = response.request?.res?.responseUrl || url;
    throw err;
  }

  const html = Buffer.from(response.data).toString("utf8");
  const $ = cheerio.load(html);

  // Titulo
  let title = $("title").first().text() || "";
  if (!title) title = $("h1").first().text() || "";
  title = cleanText(title);

  // Extraer PDF links ANTES de eliminar elementos (por si estan en footers/navs).
  const pdfLinks = detectPdfLinks
    ? extractPdfLinks($, url, { sameDomainOnly, max: maxPdfLinks })
    : [];

  // Limpieza para el contenido textual
  [
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    "iframe",
    "svg",
  ].forEach((sel) => $(sel).remove());

  const content = cleanText($("body").text());
  if (!content && pdfLinks.length === 0) {
    throw new Error("No se pudo extraer contenido ni PDFs de la pagina");
  }

  return { url, title, content, pdfLinks };
}

module.exports = {
  scrapeUrl,
  extractPdfLinks,
  looksLikePdfUrl,
};
