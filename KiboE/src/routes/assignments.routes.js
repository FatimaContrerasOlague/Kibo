const express = require("express");
const {
  analyzeAssignment,
  createAssignment,
  getAssignmentById,
  listAssignments,
  recommendResourcesForAssignment,
} = require("../services/tutor");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const assignments = await listAssignments({
      userId: req.query.userId || null,
      status: req.query.status || null,
      limit: Number(req.query.limit || 50),
    });
    res.json({ ok: true, assignments });
  } catch (error) {
    console.error("[assignments] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/analyze", async (req, res) => {
  try {
    const result = await analyzeAssignment(req.body);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[assignments] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const assignment = await createAssignment(req.body);
    res.status(201).json({ ok: true, assignment });
  } catch (error) {
    console.error("[assignments] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/:id/recommendations", async (req, res) => {
  try {
    const result = await recommendResourcesForAssignment({
      assignmentId: req.params.id,
      limit: Number(req.body.limit || 5),
      maxScore:
        typeof req.body.maxScore === "number" ? req.body.maxScore : undefined,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[assignments] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const assignment = await getAssignmentById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ ok: false, error: "Tarea no encontrada" });
    }

    res.json({ ok: true, assignment });
  } catch (error) {
    console.error("[assignments] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
