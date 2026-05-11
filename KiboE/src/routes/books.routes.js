// src/routes/books.routes.js
//
// Adaptador /books/search para el frontend (Library.tsx).
// Sirve los recursos ingestados como si fueran libros. Shape esperado:
//   { books: [{ id, title, author, cover, pdfLink, topics?: string[] }] }

const express = require("express");
const db = require("../db");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// Portada generica por tipo (usa favicon/emoji-like placeholders).
const COVER_PLACEHOLDERS = {
  pdf: "https://placehold.co/200x300/667eea/ffffff?text=PDF&font=source-sans-pro",
  web: "https://placehold.co/200x300/4ade80/ffffff?text=Web&font=source-sans-pro",
  book: "https://placehold.co/200x300/f97316/ffffff?text=Libro&font=source-sans-pro",
  video: "https://placehold.co/200x300/ef4444/ffffff?text=Video&font=source-sans-pro",
  other: "https://placehold.co/200x300/94a3b8/ffffff?text=Recurso&font=source-sans-pro",
};

function mapResource(row) {
  return {
    id: String(row.id),
    title: row.title,
    author: row.source_name || "Biblioteca Kibo",
    cover: COVER_PLACEHOLDERS[row.resource_type] || COVER_PLACEHOLDERS.other,
    pdfLink: row.url && row.url.startsWith("http") ? row.url : `#resource-${row.id}`,
    topics: row.subject ? [row.subject] : [],
  };
}

// GET /books/search?q=...&limit=24
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);

    const params = [limit];
    let where = "";

    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      where = `
        WHERE title ILIKE ${p}
           OR COALESCE(subject, '') ILIKE ${p}
           OR COALESCE(source_name, '') ILIKE ${p}
           OR COALESCE(description, '') ILIKE ${p}
      `;
    }

    const result = await db.query(
      `
      SELECT id, title, url, source_name, resource_type, subject, description
      FROM public.resources
      ${where}
      ORDER BY created_at DESC
      LIMIT $1;
      `,
      params,
    );

    res.json({ ok: true, books: result.rows.map(mapResource) });
  }),
);

module.exports = router;
