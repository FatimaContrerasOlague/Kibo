// src/routes/recommendations.routes.js
//
// Adaptador /recommendations?taskId=X que usa semantic search sobre la tarea
// para recomendar recursos. Shape esperado por Recommendations.tsx:
//   { bestDay: string, recommendations: [{ id, title, author, cover, pdfLink }] }

const express = require("express");
const db = require("../db");
const { getEmbedding } = require("../services/embeddings");
const { searchRelevantChunks } = require("../services/search");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const COVER_PLACEHOLDERS = {
  pdf: "https://placehold.co/200x300/667eea/ffffff?text=PDF",
  web: "https://placehold.co/200x300/4ade80/ffffff?text=Web",
  book: "https://placehold.co/200x300/f97316/ffffff?text=Libro",
  video: "https://placehold.co/200x300/ef4444/ffffff?text=Video",
  other: "https://placehold.co/200x300/94a3b8/ffffff?text=Recurso",
};

function formatBestDay(dueAt) {
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Hoy mismo";
  if (diffDays === 1) return "Mañana";
  // Recomendamos a mitad de camino entre hoy y la fecha limite
  const suggest = new Date(now.getTime() + diffMs / 2);
  return suggest.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// GET /recommendations?taskId=...&limit=2
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { taskId } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit || 3), 1), 10);

    if (!taskId) {
      return res.status(400).json({ ok: false, error: "taskId requerido" });
    }

    const taskResult = await db.query(
      `
      SELECT id, title, description, due_at
      FROM public.tasks
      WHERE id = $1
      LIMIT 1;
      `,
      [taskId],
    );
    const task = taskResult.rows[0];
    if (!task) {
      return res.status(404).json({ ok: false, error: "Tarea no encontrada" });
    }

    const searchText = [task.title, task.description].filter(Boolean).join(". ");

    // Busqueda semantica → chunks → recursos unicos
    let chunks = [];
    try {
      if (searchText.trim()) {
        const embedding = await getEmbedding(searchText, { role: "query" });
        chunks = await searchRelevantChunks(embedding, limit * 3);
      }
    } catch (err) {
      console.warn("[recommendations] Error en embedding:", err.message);
    }

    // De-duplicar por resource_id y quedarnos con los top
    const seen = new Set();
    const uniqueResourceIds = [];
    for (const c of chunks) {
      if (!c.resource_id) continue;
      if (seen.has(c.resource_id)) continue;
      seen.add(c.resource_id);
      uniqueResourceIds.push(c.resource_id);
      if (uniqueResourceIds.length >= limit) break;
    }

    let recommendations = [];
    if (uniqueResourceIds.length > 0) {
      const rows = await db.query(
        `
        SELECT id, title, url, source_name, resource_type, subject
        FROM public.resources
        WHERE id = ANY($1::bigint[])
        `,
        [uniqueResourceIds],
      );
      const byId = new Map(rows.rows.map((r) => [String(r.id), r]));
      recommendations = uniqueResourceIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map((r) => ({
          id: String(r.id),
          title: r.title,
          author: r.source_name || "Biblioteca Kibo",
          cover:
            COVER_PLACEHOLDERS[r.resource_type] || COVER_PLACEHOLDERS.other,
          pdfLink:
            r.url && r.url.startsWith("http") ? r.url : `#resource-${r.id}`,
        }));
    }

    res.json({
      ok: true,
      bestDay: formatBestDay(task.due_at),
      recommendations,
    });
  }),
);

module.exports = router;
