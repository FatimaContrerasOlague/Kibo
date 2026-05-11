// src/routes/resources.routes.js

const express = require("express");
const multer = require("multer");
const db = require("../db");
const {
  ingestDocument,
  ingestPdfBuffer,
  ingestPdfUrl,
  ingestPdfUrls,
  ingestUrl,
  ingestUrls,
} = require("../services/ingest");
const {
  createQuizFromResource,
  generateStudyPack,
  summarizeResource,
} = require("../services/tutor");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// ─── Upload de PDFs ─────────────────────────────────────────────────────────
const PDF_UPLOAD_MAX_BYTES = Number(
  process.env.PDF_UPLOAD_MAX_BYTES || process.env.PDF_MAX_BYTES || 50 * 1024 * 1024,
);

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PDF_UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Solo se aceptan archivos PDF"));
    cb(null, true);
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const limit = Math.min(
    Math.max(Number(query.limit) || defaultLimit, 1),
    maxLimit,
  );
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "y"].includes(String(value).toLowerCase());
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTAR Y DETALLE
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });

    const result = await db.query(
      `
      SELECT id, title, url, source_name, resource_type, subject, grade_level,
             language, description, created_at
      FROM public.resources
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
      `,
      [limit, offset],
    );

    res.json({
      ok: true,
      pagination: { limit, offset, count: result.rows.length },
      resources: result.rows,
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await db.query(
      `
      SELECT id, title, url, source_name, resource_type, subject, grade_level,
             language, description, metadata, created_at, updated_at
      FROM public.resources
      WHERE id = $1;
      `,
      [req.params.id],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Recurso no encontrado" });
    }
    res.json({ ok: true, resource: result.rows[0] });
  }),
);

router.get(
  "/:id/chunks",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query, {
      defaultLimit: 100,
      maxLimit: 500,
    });

    const result = await db.query(
      `
      SELECT c.id, c.document_id, d.resource_id, c.content, c.position,
             c.page_number, c.section_title, c.token_count, c.created_at
      FROM public.chunks c
      JOIN public.documents d ON d.id = c.document_id
      WHERE d.resource_id = $1
      ORDER BY c.position ASC
      LIMIT $2 OFFSET $3;
      `,
      [req.params.id, limit, offset],
    );

    res.json({
      ok: true,
      pagination: { limit, offset, count: result.rows.length },
      chunks: result.rows,
    });
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// INGESTA POR TEXTO O URL
// ═══════════════════════════════════════════════════════════════════════════

router.post(
  "/ingest",
  asyncHandler(async (req, res) => {
    const {
      text,
      url,
      title,
      subject,
      gradeLevel,
      sourceName,
      resourceType = "other",
      followPdfLinks = false,
      sameDomainOnly = true,
      maxPdfLinks,
      force = false,
    } = req.body;

    if (!text && !url) {
      return res
        .status(400)
        .json({ ok: false, error: "text o url requerido" });
    }

    const result = text
      ? await ingestDocument({
          url,
          title,
          content: text,
          resourceType,
          subject,
          gradeLevel,
          sourceName,
        })
      : await ingestUrl(url, {
          followPdfLinks,
          sameDomainOnly,
          maxPdfLinks,
          force,
          title,
          subject,
          gradeLevel,
          sourceName,
        });

    res.json({ ok: true, ...result });
  }),
);

router.post(
  "/ingest/pdf-url",
  asyncHandler(async (req, res) => {
    const { url, title, subject, gradeLevel, sourceName, force = false } =
      req.body;

    if (!url) {
      return res.status(400).json({ ok: false, error: "url requerida" });
    }

    const result = await ingestPdfUrl({
      url,
      title,
      subject,
      gradeLevel,
      sourceName,
      force,
    });
    res.json({ ok: true, ...result });
  }),
);

router.post(
  "/ingest/pdf-url/batch",
  asyncHandler(async (req, res) => {
    const { pdfs, force = false } = req.body;
    if (!Array.isArray(pdfs) || pdfs.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "pdfs debe ser una lista" });
    }

    const results = await ingestPdfUrls({ pdfs, force });
    res.json({ ok: true, results });
  }),
);

router.post(
  "/ingest/batch",
  asyncHandler(async (req, res) => {
    const {
      urls,
      followPdfLinks = false,
      sameDomainOnly = true,
      maxPdfLinks,
      force = false,
    } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "urls debe ser una lista" });
    }

    const results = await ingestUrls(urls, {
      followPdfLinks,
      sameDomainOnly,
      maxPdfLinks,
      force,
    });
    res.json({ ok: true, results });
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// INGESTA POR ARCHIVO (multipart upload)
// ═══════════════════════════════════════════════════════════════════════════

// POST /resources/ingest/pdf-file
// Form fields:
//   - pdf         (File, requerido)
//   - title       (string, opcional)
//   - subject     (string, opcional)
//   - gradeLevel  (string, opcional)
//   - sourceName  (string, opcional)
//   - force       (bool, opcional)
router.post(
  "/ingest/pdf-file",
  pdfUpload.single("pdf"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, error: 'Archivo PDF requerido en el campo "pdf"' });
    }

    const result = await ingestPdfBuffer({
      buffer: req.file.buffer,
      originalFilename: req.file.originalname,
      title: req.body.title || null,
      subject: req.body.subject || null,
      gradeLevel: req.body.gradeLevel || null,
      sourceName: req.body.sourceName || "upload",
      force: parseBoolean(req.body.force, false),
    });

    res.json({ ok: true, ...result });
  }),
);

// POST /resources/ingest/pdf-file/study
// Sube PDF + corre el flujo completo: resumen + conceptos + quiz.
router.post(
  "/ingest/pdf-file/study",
  pdfUpload.single("pdf"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, error: 'Archivo PDF requerido en el campo "pdf"' });
    }

    const ingest = await ingestPdfBuffer({
      buffer: req.file.buffer,
      originalFilename: req.file.originalname,
      title: req.body.title || null,
      subject: req.body.subject || null,
      gradeLevel: req.body.gradeLevel || null,
      sourceName: req.body.sourceName || "upload",
      force: parseBoolean(req.body.force, false),
    });

    const study = await generateStudyPack({
      resourceId: ingest.resourceId,
      questionCount: Number(req.body.questionCount || 5),
      summaryType: req.body.summaryType || "study_guide",
      userId: req.body.userId || null,
    });

    res.json({ ok: true, ingest, ...study });
  }),
);

// POST /resources/ingest/pdf-file/study/stream
// Igual que el anterior pero con progreso en SSE. Eventos emitidos:
//   upload_received, parsing_pdf, pdf_parsed, embeddings_start,
//   embeddings_done, db_start, ingest_done, study_llm_start,
//   study_llm_done, done, error.
router.post(
  "/ingest/pdf-file/study/stream",
  pdfUpload.single("pdf"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, error: 'Archivo PDF requerido en el campo "pdf"' });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let clientClosed = false;
    req.on("close", () => {
      clientClosed = true;
    });

    const write = (event) => {
      if (clientClosed) return;
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        /* ignore */
      }
    };

    write({ stage: "upload_received", filename: req.file.originalname });

    try {
      const ingest = await ingestPdfBuffer({
        buffer: req.file.buffer,
        originalFilename: req.file.originalname,
        title: req.body.title || null,
        subject: req.body.subject || null,
        gradeLevel: req.body.gradeLevel || null,
        sourceName: req.body.sourceName || "upload",
        force: parseBoolean(req.body.force, false),
        onProgress: write,
      });

      const study = await generateStudyPack({
        resourceId: ingest.resourceId,
        questionCount: Number(req.body.questionCount || 5),
        summaryType: req.body.summaryType || "study_guide",
        userId: req.body.userId || null,
        onProgress: write,
      });

      write({ stage: "done", ingest, ...study });
    } catch (err) {
      write({ stage: "error", error: err.message });
    }

    if (!clientClosed) res.end();
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN / QUIZ / STUDY POR resourceId
// ═══════════════════════════════════════════════════════════════════════════

// POST /resources/:id/summary
// body: { summaryType?, userId?, maxChars? }
router.post(
  "/:id/summary",
  asyncHandler(async (req, res) => {
    const summary = await summarizeResource({
      resourceId: req.params.id,
      summaryType: req.body.summaryType || "study_guide",
      userId: req.body.userId || null,
      maxChars: req.body.maxChars ? Number(req.body.maxChars) : undefined,
    });
    res.json({ ok: true, summary });
  }),
);

// POST /resources/:id/quiz
// body: { questionCount?, userId?, assignmentId?, maxChars? }
router.post(
  "/:id/quiz",
  asyncHandler(async (req, res) => {
    const result = await createQuizFromResource({
      resourceId: req.params.id,
      questionCount: Number(req.body.questionCount || 5),
      userId: req.body.userId || null,
      assignmentId: req.body.assignmentId || null,
      maxChars: req.body.maxChars ? Number(req.body.maxChars) : undefined,
    });
    res.json({ ok: true, ...result });
  }),
);

// POST /resources/:id/study  — combo summary + quiz + keyConcepts + outline
// body: { questionCount?, summaryType?, userId?, maxChars? }
router.post(
  "/:id/study",
  asyncHandler(async (req, res) => {
    const result = await generateStudyPack({
      resourceId: req.params.id,
      questionCount: Number(req.body.questionCount || 5),
      summaryType: req.body.summaryType || "study_guide",
      userId: req.body.userId || null,
      maxChars: req.body.maxChars ? Number(req.body.maxChars) : undefined,
    });
    res.json({ ok: true, ...result });
  }),
);

module.exports = router;
