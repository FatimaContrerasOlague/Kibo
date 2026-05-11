const express = require("express");
const { createQuiz } = require("../services/tutor");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const result = await createQuiz(req.body);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[quizzes] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
