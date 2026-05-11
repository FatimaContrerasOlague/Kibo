// src/services/ingest.js
const db = require("../db");
const { scrapeUrl } = require("./scraper");
const { splitIntoChunks } = require("./chunker");
const { getEmbedding } = require("./embeddings");
const {
  buildPdfChunks,
  buildPdfMetadata,
  extractPdfFromUrl,
  estimateTokenCount,
  validatePdfUrl,
} = require("./pdf/pdf.service");

/**
 * Convierte un array de números JS en un literal de vector
 * que pgvector entiende: [0.1, 0.2] -> "[0.1,0.2]"
 */
function toVectorLiteral(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error("Embedding vacío o inválido");
  }
  return `[${array.join(",")}]`;
}

/**
 * Ingresa UNA sola URL:
 * - hace scraping
 * - inserta en documents
 * - parte en chunks
 * - genera embeddings
 * - inserta en chunks
 */
async function ingestUrl(url) {
  console.log(`\n[ingest] Iniciando ingesta de: ${url}`);

  // 1) Scraping
  const { title, content } = await scrapeUrl(url);
  console.log(`[ingest] Título: ${title || "(sin título)"}`);

  return ingestDocument({
    url,
    title,
    content,
    resourceType: "web",
  });
}

/**
 * Ingresa texto ya extraído:
 * - crea un resource opcional
 * - inserta en documents
 * - parte en chunks
 * - genera embeddings
 * - inserta en chunks
 */
async function ingestDocument({
  url,
  title,
  content,
  resourceType = "other",
  subject = null,
  gradeLevel = null,
  sourceName = null,
}) {
  if (!content || !content.trim()) {
    throw new Error("Contenido vacío para ingesta");
  }

  const documentUrl = url || `manual_ingestion_${Date.now()}`;
  const documentTitle = title || "Texto ingresado manualmente";

  const resourceResult = await db.query(
    `
    INSERT INTO public.resources (title, url, source_name, resource_type, subject, grade_level)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,
    [documentTitle, documentUrl, sourceName, resourceType, subject, gradeLevel]
  );

  const resourceId = resourceResult.rows[0].id;

  // 3) Partir en chunks
  const chunks = splitIntoChunks(content, 1000); // puedes ajustar tamaño

  const result = await createDocumentWithChunks({
    resourceId,
    url: documentUrl,
    title: documentTitle,
    content,
    chunks: chunks.map((chunk, index) => ({
      content: chunk,
      position: index,
      pageNumber: null,
      tokenCount: estimateTokenCount(chunk),
    })),
  });

  console.log(
    `[ingest] Ingesta completa para ${documentUrl} (documento ${result.documentId}, chunks: ${result.chunksInserted})`
  );

  return { resourceId, ...result };
}

async function createDocumentWithChunks({ resourceId, url, title, content, chunks }) {
  const docResult = await db.query(
    `
    INSERT INTO public.documents (resource_id, url, title, raw_content)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `,
    [resourceId, url, title, content]
  );

  const documentId = docResult.rows[0].id;
  console.log(`[ingest] Documento creado con id: ${documentId}`);
  console.log(`[ingest] Total de chunks generados: ${chunks.length}`);

  let chunksInserted = 0;

  for (const chunk of chunks) {
    try {
      const embeddingArray = await getEmbedding(chunk.content);
      const embeddingLiteral = toVectorLiteral(embeddingArray);

      await db.query(
        `
        INSERT INTO public.chunks (document_id, content, embedding, position, page_number, token_count)
        VALUES ($1, $2, $3::vector, $4, $5, $6);
      `,
        [
          documentId,
          chunk.content,
          embeddingLiteral,
          chunk.position,
          chunk.pageNumber || null,
          chunk.tokenCount || null,
        ]
      );

      chunksInserted++;
    } catch (err) {
      console.error(
        `[ingest] Error al procesar chunk en posición ${chunk.position}:`,
        err.message
      );
    }
  }

  return { documentId, chunksInserted };
}

async function ingestPdfUrl({
  url,
  title = null,
  subject = null,
  gradeLevel = null,
  sourceName = null,
  force = false,
}) {
  const parsedUrl = validatePdfUrl(url);
  const normalizedUrl = parsedUrl.href;

  if (!force) {
    const existing = await findResourceByUrl(normalizedUrl);
    if (existing) {
      return {
        resourceId: existing.id,
        documentId: existing.document_id,
        chunksInserted: 0,
        metadata: existing.metadata || {},
        alreadyExists: true,
      };
    }
  }

  console.log(`\n[ingest] Iniciando ingesta de PDF: ${normalizedUrl}`);

  const extracted = await extractPdfFromUrl(normalizedUrl);
  const documentTitle = title || `PDF ${parsedUrl.hostname}`;
  const metadata = buildPdfMetadata(extracted);

  const resourceResult = await db.query(
    `
    INSERT INTO public.resources (title, url, source_name, resource_type, subject, grade_level, metadata)
    VALUES ($1, $2, $3, 'pdf', $4, $5, $6::jsonb)
    RETURNING id;
  `,
    [
      documentTitle,
      normalizedUrl,
      sourceName,
      subject,
      gradeLevel,
      JSON.stringify(metadata),
    ]
  );

  const resourceId = resourceResult.rows[0].id;
  const chunks = buildPdfChunks(extracted.pages, 1000);
  const result = await createDocumentWithChunks({
    resourceId,
    url: normalizedUrl,
    title: documentTitle,
    content: extracted.content,
    chunks,
  });

  return {
    resourceId,
    ...result,
    metadata,
    alreadyExists: false,
  };
}

async function findResourceByUrl(url) {
  const result = await db.query(
    `
    SELECT r.id, r.metadata, d.id AS document_id
    FROM public.resources r
    LEFT JOIN public.documents d ON d.resource_id = r.id
    WHERE r.url = $1
    ORDER BY d.created_at DESC NULLS LAST
    LIMIT 1;
  `,
    [url],
  );

  return result.rows[0] || null;
}

async function ingestPdfUrls({ pdfs, force = false }) {
  const results = [];

  for (const pdf of pdfs) {
    try {
      const result = await ingestPdfUrl({
        ...pdf,
        force: typeof pdf.force === "boolean" ? pdf.force : force,
      });
      results.push({ ok: true, url: pdf.url, ...result });
    } catch (error) {
      results.push({ ok: false, url: pdf.url, error: error.message });
    }
  }

  return results;
}

/**
 * Ingresa varias URLs en serie.
 *
 * @param {string[]} urls
 */
async function ingestUrls(urls) {
  const results = [];

  for (const url of urls) {
    try {
      const result = await ingestUrl(url);
      results.push({ url, ...result, ok: true });
    } catch (err) {
      console.error(`[ingest] Error procesando URL ${url}:`, err.message);
      results.push({ url, ok: false, error: err.message });
    }
  }

  return results;
}

module.exports = {
  ingestDocument,
  ingestPdfUrl,
  ingestPdfUrls,
  ingestUrl,
  ingestUrls,
};
