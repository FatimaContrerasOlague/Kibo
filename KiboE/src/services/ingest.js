// src/services/ingest.js
const db = require("../db");
const { scrapeUrl, looksLikePdfUrl } = require("./scraper");
const { splitIntoChunks } = require("./chunker");
const { getEmbeddingsBatch } = require("./embeddings");
const {
  buildPdfChunks,
  buildPdfMetadata,
  extractPdfFromUrl,
  extractPdfText,
  estimateTokenCount,
  validatePdfUrl,
} = require("./pdf/pdf.service");
const { runWithConcurrency } = require("../utils/concurrency");

const PDF_BATCH_CONCURRENCY = Number(process.env.PDF_BATCH_CONCURRENCY || 3);
const DEFAULT_CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 1000);
const DEFAULT_MAX_PDF_LINKS = Number(process.env.URL_MAX_PDF_LINKS || 20);

/**
 * Convierte un array de numeros JS en un literal de vector
 * que pgvector entiende: [0.1, 0.2] -> "[0.1,0.2]"
 */
function toVectorLiteral(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error("Embedding vacio o invalido");
  }
  return `[${array.join(",")}]`;
}

// ─── INGESTA POR URL GENERICA (auto-detecta PDF vs HTML) ───────────────────
//
// Si la URL termina en .pdf o el servidor responde application/pdf,
// delega en `ingestPdfUrl`.
// Si es HTML y `followPdfLinks=true`, despues de ingestar la pagina
// descarga los PDFs enlazados (opcionalmente limitado al mismo dominio).
async function ingestUrl(
  url,
  {
    followPdfLinks = false,
    sameDomainOnly = true,
    maxPdfLinks = DEFAULT_MAX_PDF_LINKS,
    force = false,
    title = null,
    subject = null,
    gradeLevel = null,
    sourceName = null,
  } = {},
) {
  // 1) Si huele a PDF por extension, delegar directamente.
  if (looksLikePdfUrl(url)) {
    console.log(`[ingest] URL parece PDF por extension: ${url}`);
    const pdf = await ingestPdfUrl({
      url,
      title,
      subject,
      gradeLevel,
      sourceName,
      force,
    });
    return { kind: "pdf", pdf };
  }

  console.log(`\n[ingest] Iniciando ingesta de URL: ${url}`);

  // 2) Intentar scrape. Si el servidor regresa application/pdf, se lanza
  //    error marcado con `.isPdfResponse` y caemos al branch de PDF.
  let scraped;
  try {
    scraped = await scrapeUrl(url, {
      detectPdfLinks: true,
      sameDomainOnly,
      maxPdfLinks,
    });
  } catch (err) {
    if (err.isPdfResponse) {
      console.log(`[ingest] El servidor devolvio PDF; delegando a PDF pipeline`);
      const pdf = await ingestPdfUrl({
        url: err.finalUrl || url,
        title,
        subject,
        gradeLevel,
        sourceName,
        force,
      });
      return { kind: "pdf", pdf };
    }
    throw err;
  }

  const { title: scrapedTitle, content, pdfLinks } = scraped;
  console.log(
    `[ingest] Titulo: ${scrapedTitle || "(sin titulo)"} · PDFs enlazados: ${pdfLinks.length}`,
  );

  // 3) Ingestar la pagina HTML (si tiene contenido).
  let page = null;
  if (content && content.trim()) {
    page = await ingestDocument({
      url,
      title: title || scrapedTitle,
      content,
      resourceType: "web",
      subject,
      gradeLevel,
      sourceName,
    });
  }

  // 4) Opcional: descargar e ingestar los PDFs enlazados.
  let linkedPdfs = [];
  if (followPdfLinks && pdfLinks.length > 0) {
    const limited = pdfLinks.slice(0, maxPdfLinks);
    console.log(`[ingest] Siguiendo ${limited.length} PDFs enlazados...`);
    linkedPdfs = await ingestPdfUrls({
      pdfs: limited.map((link) => ({
        url: link.url,
        title: link.title || null,
        subject,
        gradeLevel,
        sourceName: sourceName || scrapedTitle || null,
      })),
      force,
    });
  }

  return {
    kind: "web",
    page,
    pdfLinksFound: pdfLinks.length,
    linkedPdfs,
  };
}

// ─── INGESTA POR TEXTO PLANO ───────────────────────────────────────────────
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
    throw new Error("Contenido vacio para ingesta");
  }

  const documentUrl = url || `manual_ingestion_${Date.now()}`;
  const documentTitle = title || "Texto ingresado manualmente";

  const chunksRaw = splitIntoChunks(content, DEFAULT_CHUNK_SIZE);
  const chunks = chunksRaw.map((chunk, index) => ({
    content: chunk,
    position: index,
    pageNumber: null,
    tokenCount: estimateTokenCount(chunk),
  }));

  const { resourceId, documentId, chunksInserted } = await persistDocument({
    urlKey: documentUrl,
    title: documentTitle,
    content,
    chunks,
    resourceAttrs: {
      title: documentTitle,
      url: documentUrl,
      sourceName,
      resourceType,
      subject,
      gradeLevel,
      metadata: null,
    },
  });

  console.log(
    `[ingest] Ingesta completa para ${documentUrl} (documento ${documentId}, chunks: ${chunksInserted})`,
  );

  return { resourceId, documentId, chunksInserted };
}

// ─── INGESTA DE PDF POR URL ────────────────────────────────────────────────
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
  const chunks = buildPdfChunks(extracted.pages, DEFAULT_CHUNK_SIZE);

  const result = await persistDocument({
    urlKey: normalizedUrl,
    title: documentTitle,
    content: extracted.content,
    chunks,
    force,
    resourceAttrs: {
      title: documentTitle,
      url: normalizedUrl,
      sourceName,
      resourceType: "pdf",
      subject,
      gradeLevel,
      metadata,
    },
  });

  return {
    ...result,
    metadata,
    alreadyExists: false,
  };
}

// ─── PERSISTENCIA CENTRALIZADA: resource + document + chunks ────────────────
//
// Flujo:
//   1) Calcula todos los embeddings en paralelo (con concurrencia limitada)
//   2) Abre una transaccion:
//        a) inserta/obtiene el resource (ON CONFLICT por url)
//        b) si force=true, borra documents previos de esa url
//        c) inserta document
//        d) inserta chunks en lote (multi-row INSERT)
//
// Nota: los embeddings se hacen FUERA de la transaccion para no mantener el
// connection abierto mientras dura la latencia de red con Gemini.
async function persistDocument({
  title,
  content,
  chunks,
  force = false,
  resourceAttrs,
  onProgress = () => {},
}) {
  if (chunks.length === 0) {
    throw new Error("No se generaron chunks a partir del contenido");
  }

  // 1) Embeddings en lote (una/pocas llamadas HTTP para todo el documento)
  onProgress({ stage: "embeddings_start", chunks: chunks.length });
  const t0 = Date.now();
  const embedResults = await getEmbeddingsBatch(
    chunks.map((c) => c.content),
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[ingest] ${chunks.length} embeddings generados en ${elapsed}s (batch)`,
  );
  onProgress({
    stage: "embeddings_done",
    chunks: chunks.length,
    seconds: Number(elapsed),
  });

  const successfulChunks = [];
  let failed = 0;
  embedResults.forEach((r, i) => {
    if (r.ok) {
      successfulChunks.push({ ...chunks[i], embedding: r.value });
    } else {
      failed++;
      console.error(
        `[ingest] Embedding fallido en chunk ${chunks[i].position}:`,
        r.error?.message || r.error,
      );
    }
  });

  if (successfulChunks.length === 0) {
    throw new Error("Todos los embeddings fallaron; no se ingesto nada");
  }

  onProgress({ stage: "db_start", chunks: successfulChunks.length });

  // 2) Transaccion DB
  return db.withTransaction(async (client) => {
    // a) Resource: UPSERT por url
    const resourceRow = await upsertResource(client, resourceAttrs);
    const resourceId = resourceRow.id;

    // b) Si force, limpia documentos previos del mismo recurso
    if (force) {
      await client.query(
        "DELETE FROM public.documents WHERE resource_id = $1",
        [resourceId],
      );
    }

    // c) Documento
    const docResult = await client.query(
      `
      INSERT INTO public.documents (resource_id, url, title, raw_content)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [resourceId, resourceAttrs.url, title, content],
    );
    const documentId = docResult.rows[0].id;

    // d) Chunks en multi-row INSERT
    const chunksInserted = await bulkInsertChunks(
      client,
      documentId,
      successfulChunks,
    );

    console.log(
      `[ingest] Documento ${documentId}: ${chunksInserted} chunks insertados` +
        (failed > 0 ? ` (${failed} fallaron embeddings)` : ""),
    );

    return { resourceId, documentId, chunksInserted };
  });
}

async function upsertResource(client, attrs) {
  const metadataJson = attrs.metadata ? JSON.stringify(attrs.metadata) : "{}";

  // INSERT ... ON CONFLICT (url) DO UPDATE para actualizar campos mutables
  // y recuperar id aunque ya existiera. Si en tu BD aun no corre la
  // migracion con UNIQUE(url), esto tambien funciona mientras la url sea
  // nueva; cuando apliques la migracion, los duplicados desaparecen.
  const result = await client.query(
    `
    INSERT INTO public.resources
      (title, url, source_name, resource_type, subject, grade_level, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (url) DO UPDATE SET
      title         = COALESCE(EXCLUDED.title, public.resources.title),
      source_name   = COALESCE(EXCLUDED.source_name, public.resources.source_name),
      resource_type = EXCLUDED.resource_type,
      subject       = COALESCE(EXCLUDED.subject, public.resources.subject),
      grade_level   = COALESCE(EXCLUDED.grade_level, public.resources.grade_level),
      metadata      = COALESCE(EXCLUDED.metadata, public.resources.metadata),
      updated_at    = NOW()
    RETURNING id;
    `,
    [
      attrs.title,
      attrs.url,
      attrs.sourceName,
      attrs.resourceType,
      attrs.subject,
      attrs.gradeLevel,
      metadataJson,
    ],
  );
  return result.rows[0];
}

/**
 * Inserta todos los chunks en un solo INSERT (multi-row) para reducir
 * round-trips al DB.
 */
async function bulkInsertChunks(client, documentId, chunks) {
  if (chunks.length === 0) return 0;

  // Construimos los placeholders en bloques de 6 columnas por fila:
  // (document_id, content, embedding, position, page_number, token_count)
  const values = [];
  const placeholders = [];
  chunks.forEach((chunk, i) => {
    const base = i * 6;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}::vector, $${base + 4}, $${base + 5}, $${base + 6})`,
    );
    values.push(
      documentId,
      chunk.content,
      toVectorLiteral(chunk.embedding),
      chunk.position,
      chunk.pageNumber || null,
      chunk.tokenCount || null,
    );
  });

  const sql = `
    INSERT INTO public.chunks
      (document_id, content, embedding, position, page_number, token_count)
    VALUES ${placeholders.join(",\n      ")};
  `;

  await client.query(sql, values);
  return chunks.length;
}

// ─── INGESTA DE PDF DESDE BUFFER (file upload) ──────────────────────────────
//
// Acepta el buffer de un PDF (por ejemplo el de multer.memoryStorage) y lo
// trata como cualquier otro recurso PDF. Construye una URL sintetica
// "upload://<timestamp>-<archivo>" para mantener la unicidad en DB.
async function ingestPdfBuffer({
  buffer,
  originalFilename = null,
  title = null,
  subject = null,
  gradeLevel = null,
  sourceName = "upload",
  force = false,
  onProgress = () => {},
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("buffer vacio o invalido");
  }

  const safeName = (originalFilename || "archivo.pdf")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
  const syntheticUrl = `upload://${Date.now()}-${safeName}`;
  const documentTitle =
    title ||
    (originalFilename
      ? originalFilename.replace(/\.pdf$/i, "")
      : "PDF subido");

  console.log(
    `[ingest] Ingesta desde buffer: ${safeName} (${(buffer.length / 1024).toFixed(0)} KB)`,
  );

  onProgress({ stage: "parsing_pdf", filename: safeName });
  const extracted = await extractPdfText(buffer);
  onProgress({
    stage: "pdf_parsed",
    pageCount: extracted.pageCount,
    extractedChars: extracted.content.length,
  });

  const metadata = buildPdfMetadata(extracted);
  const chunks = buildPdfChunks(extracted.pages, DEFAULT_CHUNK_SIZE);

  const result = await persistDocument({
    title: documentTitle,
    content: extracted.content,
    chunks,
    force,
    resourceAttrs: {
      title: documentTitle,
      url: syntheticUrl,
      sourceName,
      resourceType: "pdf",
      subject,
      gradeLevel,
      metadata,
    },
    onProgress,
  });

  onProgress({
    stage: "ingest_done",
    resourceId: result.resourceId,
    documentId: result.documentId,
    chunksInserted: result.chunksInserted,
  });

  return {
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

// ─── BATCH DE PDFs CON CONCURRENCIA LIMITADA ───────────────────────────────
async function ingestPdfUrls({ pdfs, force = false }) {
  const batchForce = force;

  const runs = await runWithConcurrency(
    pdfs,
    PDF_BATCH_CONCURRENCY,
    async (pdf) => {
      const useForce =
        typeof pdf.force === "boolean" ? pdf.force : batchForce;
      return ingestPdfUrl({ ...pdf, force: useForce });
    },
  );

  return runs.map((run, i) => {
    if (run.ok) {
      return { ok: true, url: pdfs[i].url, ...run.value };
    }
    return {
      ok: false,
      url: pdfs[i].url,
      error: run.error?.message || String(run.error),
    };
  });
}

async function ingestUrls(items, commonOptions = {}) {
  // Acepta tanto ["https://..."] como [{ url, followPdfLinks, ... }]
  const normalized = items.map((it) =>
    typeof it === "string" ? { url: it } : it,
  );

  const runs = await runWithConcurrency(
    normalized,
    PDF_BATCH_CONCURRENCY,
    async (item) => ingestUrl(item.url, { ...commonOptions, ...item }),
  );

  return runs.map((run, i) => {
    if (run.ok) return { url: normalized[i].url, ok: true, ...run.value };
    return {
      url: normalized[i].url,
      ok: false,
      error: run.error?.message || String(run.error),
    };
  });
}

module.exports = {
  ingestDocument,
  ingestPdfBuffer,
  ingestPdfUrl,
  ingestPdfUrls,
  ingestUrl,
  ingestUrls,
};
