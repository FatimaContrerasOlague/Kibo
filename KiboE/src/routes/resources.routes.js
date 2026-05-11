// src/routes/resources.routes.js

const express = require("express");
const db = require("../db");
const {
  ingestDocument,
  ingestPdfUrl,
  ingestPdfUrls,
  ingestUrl,
  ingestUrls,
} = require("../services/ingest");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// ─── Helpers de paginacion ──────────────────────────────────────────────────
function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const limit = Math.min(
    Math.max(Number(query.limit) || defaultLimit, 1),
    maxLimit,
  );
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

// ─── Listar recursos ────────────────────────────────────────────────────────
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

// ─── Ingestas ───────────────────────────────────────────────────────────────
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

module.exports = router;
