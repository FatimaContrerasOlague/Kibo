// src/routes/ingest.routes.js
//
// Alias heredado para compatibilidad: POST /ingest y POST /ingest/batch
// siguen funcionando, pero la logica vive en services/ingest.

const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  ingestDocument,
  ingestUrl,
  ingestUrls,
} = require("../services/ingest");

const router = express.Router();

router.post(
  "/",
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

    res.json({
      ok: true,
      message: "Recurso guardado correctamente.",
      ...result,
    });
  }),
);

router.post(
  "/batch",
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
