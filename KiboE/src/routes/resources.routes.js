const express = require("express");
const db = require("../db");
const {
  ingestDocument,
  ingestPdfUrl,
  ingestPdfUrls,
  ingestUrl,
  ingestUrls,
} = require("../services/ingest");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, title, url, source_name, resource_type, subject, grade_level, language, description, created_at
      FROM public.resources
      ORDER BY created_at DESC
      LIMIT 100;
    `,
    );

    res.json({ ok: true, resources: result.rows });
  } catch (error) {
    console.error("[resources] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("[resources] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/:id/chunks", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT c.id, c.document_id, d.resource_id, c.content, c.position,
             c.page_number, c.section_title, c.token_count, c.created_at
      FROM public.chunks c
      JOIN public.documents d ON d.id = c.document_id
      WHERE d.resource_id = $1
      ORDER BY c.position ASC
      LIMIT $2;
    `,
      [req.params.id, Number(req.query.limit || 100)],
    );

    res.json({ ok: true, chunks: result.rows });
  } catch (error) {
    console.error("[resources] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/ingest", async (req, res) => {
  const {
    text,
    url,
    title,
    subject,
    gradeLevel,
    sourceName,
    resourceType = "other",
  } = req.body;

  if (!text && !url) {
    return res.status(400).json({ ok: false, error: "text o url requerido" });
  }

  try {
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
      : await ingestUrl(url);

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[resources] Error en ingesta:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/ingest/pdf-url", async (req, res) => {
  const { url, title, subject, gradeLevel, sourceName, force = false } = req.body;

  if (!url) {
    return res.status(400).json({ ok: false, error: "url requerida" });
  }

  try {
    const result = await ingestPdfUrl({
      url,
      title,
      subject,
      gradeLevel,
      sourceName,
      force,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[resources] Error en ingesta de PDF:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/ingest/pdf-url/batch", async (req, res) => {
  const { pdfs, force = false } = req.body;

  if (!Array.isArray(pdfs) || pdfs.length === 0) {
    return res.status(400).json({ ok: false, error: "pdfs debe ser una lista" });
  }

  const results = await ingestPdfUrls({ pdfs, force });
  res.json({ ok: true, results });
});

router.post("/ingest/batch", async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ ok: false, error: "urls debe ser una lista" });
  }

  const results = await ingestUrls(urls);
  res.json({ ok: true, results });
});

module.exports = router;
