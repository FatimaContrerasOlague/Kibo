// src/routes/tasks.routes.js
//
// CRUD de tareas de usuario. El frontend (TaskContext) espera:
//   - GET    /tasks?userId=X
//   - POST   /tasks        body: { userId, title, description, dueAt }
//   - PATCH  /tasks/:id    body: partial
//   - DELETE /tasks/:id

const express = require("express");
const db = require("../db");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDate(value, field = "dueAt") {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`${field} invalido`);
    err.status = 400;
    throw err;
  }
  return d.toISOString();
}

// ─── LIST ──────────────────────────────────────────────────────────────────
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
      return res
        .status(400)
        .json({ ok: false, error: "userId requerido como query param" });
    }

    const result = await db.query(
      `
      SELECT id, user_id, title, description, due_at, completed,
             created_at, updated_at
      FROM public.tasks
      WHERE user_id = $1
      ORDER BY due_at ASC;
      `,
      [userId],
    );

    res.json({ ok: true, tasks: result.rows.map(mapTask) });
  }),
);

// ─── CREATE ────────────────────────────────────────────────────────────────
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, title, description = "", dueAt } = req.body || {};
    if (!userId || !title || !dueAt) {
      return res.status(400).json({
        ok: false,
        error: "userId, title y dueAt son requeridos",
      });
    }

    const iso = parseDate(dueAt, "dueAt");

    const result = await db.query(
      `
      INSERT INTO public.tasks (user_id, title, description, due_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, title, description, due_at, completed,
                created_at, updated_at;
      `,
      [userId, title, description || "", iso],
    );

    res.status(201).json({ ok: true, task: mapTask(result.rows[0]) });
  }),
);

// ─── UPDATE ────────────────────────────────────────────────────────────────
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { title, description, dueAt, completed } = req.body || {};

    const sets = [];
    const params = [];

    if (title !== undefined) {
      params.push(title);
      sets.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      sets.push(`description = $${params.length}`);
    }
    if (dueAt !== undefined) {
      params.push(parseDate(dueAt, "dueAt"));
      sets.push(`due_at = $${params.length}`);
    }
    if (completed !== undefined) {
      params.push(Boolean(completed));
      sets.push(`completed = $${params.length}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({ ok: false, error: "Nada que actualizar" });
    }

    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await db.query(
      `
      UPDATE public.tasks
      SET ${sets.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, user_id, title, description, due_at, completed,
                created_at, updated_at;
      `,
      params,
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Tarea no encontrada" });
    }
    res.json({ ok: true, task: mapTask(result.rows[0]) });
  }),
);

// ─── DELETE ────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await db.query(
      "DELETE FROM public.tasks WHERE id = $1",
      [req.params.id],
    );
    res.status(result.rowCount === 0 ? 404 : 204).end();
  }),
);

module.exports = router;
