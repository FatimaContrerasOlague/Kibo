// src/services/scraper.js
const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Limpia texto:
 * - Quita espacios y saltos de línea de más
 */
function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descarga una página y devuelve:
 * { url, title, content }
 */
async function scrapeUrl(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 1. Título
    let title = $("title").first().text() || "";
    if (!title) {
      title = $("h1").first().text() || "";
    }
    title = cleanText(title);

    // 2. Quitar cosas que no nos sirven
    const removeSelectors = [
      "script",
      "style",
      "noscript",
      "header",
      "footer",
      "nav",
      "iframe",
      "svg",
    ];

    removeSelectors.forEach((sel) => $(sel).remove());

    // 3. Texto del body
    let bodyText = $("body").text();
    const content = cleanText(bodyText);

    if (!content) {
      throw new Error("No se pudo extraer contenido de la página");
    }

    return {
      url,
      title,
      content,
    };
  } catch (err) {
    console.error(`Error al hacer scraping de ${url}:`, err.message);
    throw new Error(`Error al hacer scraping de ${url}: ${err.message}`);
  }
}

module.exports = {
  scrapeUrl,
};