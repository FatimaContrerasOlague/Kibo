const { scrapeUrl } = require("./services/scraper");

async function main() {
  const url = "https://example.com"; // cambia por una página real
  const result = await scrapeUrl(url);
  console.log("Título:", result.title);
  console.log("Contenido (primeros 300 chars):");
  console.log(result.content.slice(0, 300) + "...");
}

main().catch(console.error);