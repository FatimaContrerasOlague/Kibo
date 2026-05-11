// src/routes/notifications.routes.js
//
// Adaptador /notifications/:userId para el frontend (NotificationPanel.tsx).
// Calcula recordatorios para tareas pendientes (incompletas) y adjunta una
// recomendacion de recurso por tarea.

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

// Recordatorios estandar
const REMINDER_DEFS = [
  { key: "1h", label: "en 1 hora", millis: 60 * 60 * 1000 },
  { key: "4h", label: "en 4 horas", millis: 4 * 60 * 60 * 1000 },
  { key: "1d", label: "mañana", millis: 24 * 60 * 60 * 1000 },
  { key: "3d", label: "en 3 dias", millis: 3 * 24 * 60 * 60 * 1000 },
];

function buildReminders(dueAt) {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const delta = due - now;

  // Si ya vencio, no regresamos reminders
  if (delta <= 0) return [];

  // Seleccionamos el reminder mas cercano que aun aplica.
  const applicable = REMINDER_DEFS
    .filter((r) => delta <= r.millis)
    .sort((a, b) => a.millis - b.millis);

  if (applicable.length === 0) return [];

  const first = applicable[0];
  return [
    {
      key: first.key,
      label: first.label,
      shouldNotify: true,
      millisUntilReminder: delta,
    },
  ];
}

async function findRecommendationForTask(task) {
  const searchText = [task.title, task.description].filter(Boolean).join(". ");
  if (!searchText.trim()) return null;

  try {
    const embedding = await getEmbedding(searchText, { role: "query" });
    const chunks = await searchRelevantChunks(embedding, 3);
    const first = chunks.find((c) => c.resource_id);
    if (!first) return null;

    const row = await db.query(
      `
      SELECT id, title, url, resource_type
      FROM public.resources
      WHERE id = $1
      LIMIT 1;
      `,
      [first.resource_id],
    );
    const r = row.rows[0];
    if (!r) return null;

    return {
      id: String(r.id),
      title: r.title,
      cover: COVER_PLACEHOLDERS[r.resource_type] || COVER_PLACEHOLDERS.other,
      pdfLink: r.url && r.url.startsWith("http") ? r.url : `#resource-${r.id}`,
    };
  } catch {
    return null;
  }
}

// GET /notifications/:userId
router.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const tasksResult = await db.query(
      `
      SELECT id, title, description, due_at
      FROM public.tasks
      WHERE user_id = $1
        AND completed = false
        AND due_at >= NOW()
      ORDER BY due_at ASC
      LIMIT 20;
      `,
      [userId],
    );

    const notifications = [];
    for (const task of tasksResult.rows) {
      const reminders = buildReminders(task.due_at);
      if (reminders.length === 0) continue;

      const recommendation = await findRecommendationForTask(task);

      notifications.push({
        taskId: task.id,
        taskTitle: task.title,
        dueAt: task.due_at,
        reminders,
        recommendation,
      });
    }

    res.json({ ok: true, notifications });
  }),
);

module.exports = router;
