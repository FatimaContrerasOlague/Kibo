// src/routes/chatbot.routes.js
//
// Adaptador para el frontend (Chatbot.tsx) que espera:
//   POST /chatbot/chat   body: { userId, message }
//        -> { conversation: [{ id, role: 'user'|'assistant', message, createdAt }] }
//   POST /chatbot/files  body: { userId, fileName, content }
//        -> { file: { id } }
//
// Internamente delega en el servicio de chat (chat.service) y en ingestDocument.
// Mantiene UNA sesion viva por userId en la tabla chat_sessions (auto-creada
// si no existe).

const express = require("express");
const db = require("../db");
const chat = require("../services/chat.service");
const { ingestDocument } = require("../services/ingest");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

async function getOrCreateSessionForUser(userId) {
  const existing = await db.query(
    `
    SELECT id FROM public.chat_sessions
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 1;
    `,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await chat.createSession({
    userId,
    title: "Conversacion con Kibo",
  });
  return created.id;
}

function mapMessage(row) {
  return {
    id: String(row.id),
    role: row.role === "assistant" ? "assistant" : "user",
    message: row.content,
    createdAt: row.created_at,
  };
}

// ─── POST /chatbot/chat ─────────────────────────────────────────────────────
router.post(
  "/chat",
  asyncHandler(async (req, res) => {
    const { userId, message } = req.body || {};
    if (!userId || !message || !String(message).trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "userId y message son requeridos" });
    }

    const sessionId = await getOrCreateSessionForUser(userId);

    const result = await chat.answerQuestion({
      question: String(message),
      sessionId,
    });

    // El servicio ya persistio los mensajes en chat_messages. Recuperamos
    // los dos ultimos (user + assistant) para devolver la forma que el
    // frontend espera.
    const lastTwo = await db.query(
      `
      SELECT id, role, content, created_at
      FROM public.chat_messages
      WHERE session_id = $1
      ORDER BY id DESC
      LIMIT 2;
      `,
      [sessionId],
    );

    // Los traemos en orden cronologico
    const conversation = lastTwo.rows.reverse().map(mapMessage);

    res.json({
      ok: true,
      conversation,
      sources: result.sources,
      suggestions: result.suggestions,
    });
  }),
);

// ─── POST /chatbot/files ────────────────────────────────────────────────────
// Acepta contenido en texto plano (el frontend ya hace file.text()) y lo
// ingesta como recurso. Para PDFs reales, lo recomendado es usar el flujo
// /resources/ingest/pdf-file o /resources/ingest/pdf-file/study/stream.
router.post(
  "/files",
  asyncHandler(async (req, res) => {
    const { userId, fileName, content } = req.body || {};
    if (!userId || !fileName || !content) {
      return res.status(400).json({
        ok: false,
        error: "userId, fileName y content son requeridos",
      });
    }
    if (String(content).trim().length === 0) {
      return res.status(400).json({ ok: false, error: "content esta vacio" });
    }

    const result = await ingestDocument({
      url: `user-upload://${userId}/${Date.now()}-${fileName}`,
      title: fileName,
      content: String(content),
      resourceType: "other",
      sourceName: "Subida desde chat",
    });

    res.json({ ok: true, file: { id: String(result.resourceId) } });
  }),
);

module.exports = router;
