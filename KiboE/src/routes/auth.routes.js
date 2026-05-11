// src/routes/auth.routes.js
//
// Auth simple: /auth/login y /auth/register.
// Usa bcryptjs para hash de password. No emite tokens; el frontend guarda
// el `user` en localStorage (retrocompatible con el codigo actual).

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

function sanitizeUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "name, email y password son requeridos",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "La password debe tener al menos 6 caracteres",
      });
    }

    const normalized = String(email).trim().toLowerCase();

    const existing = await db.query(
      "SELECT id FROM public.users WHERE LOWER(email) = $1 LIMIT 1",
      [normalized],
    );
    if (existing.rows[0]) {
      return res.status(409).json({
        ok: false,
        error: "Ya existe una cuenta con ese correo",
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `
      INSERT INTO public.users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name;
      `,
      [normalized, hash, name.trim()],
    );

    res.status(201).json({ ok: true, user: sanitizeUser(result.rows[0]) });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "email y password son requeridos" });
    }

    const normalized = String(email).trim().toLowerCase();

    const result = await db.query(
      `
      SELECT id, email, name, password_hash
      FROM public.users
      WHERE LOWER(email) = $1
      LIMIT 1;
      `,
      [normalized],
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "Credenciales invalidas" });
    }

    res.json({ ok: true, user: sanitizeUser(user) });
  }),
);

module.exports = router;
