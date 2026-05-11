const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

router.get("/db", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() AS now, current_database() AS database");
    res.json({
      ok: true,
      database: result.rows[0].database,
      now: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
