const express = require("express");
const { summarizeText } = require("../services/tutor");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const summary = await summarizeText(req.body);
    res.json({ ok: true, summary });
  } catch (error) {
    console.error("[summaries] Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
