// src/routes/assignments.routes.js

const express = require("express");
const {
  analyzeAssignment,
  createAssignment,
  getAssignmentById,
  listAssignments,
  recommendResourcesForAssignment,
} = require("../services/tutor");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const limit = Math.min(
    Math.max(Number(query.limit) || defaultLimit, 1),
    maxLimit,
  );
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const assignments = await listAssignments({
      userId: req.query.userId || null,
      status: req.query.status || null,
      limit,
      offset,
    });
    res.json({
      ok: true,
      pagination: { limit, offset, count: assignments.length },
      assignments,
    });
  }),
);

router.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const result = await analyzeAssignment(req.body);
    res.json({ ok: true, ...result });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const assignment = await createAssignment(req.body);
    res.status(201).json({ ok: true, assignment });
  }),
);

router.post(
  "/:id/recommendations",
  asyncHandler(async (req, res) => {
    const result = await recommendResourcesForAssignment({
      assignmentId: req.params.id,
      limit: Number(req.body.limit || 5),
      maxScore:
        typeof req.body.maxScore === "number" ? req.body.maxScore : undefined,
    });
    res.json({ ok: true, ...result });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const assignment = await getAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ ok: false, error: "Tarea no encontrada" });
    }
    res.json({ ok: true, assignment });
  }),
);

module.exports = router;
