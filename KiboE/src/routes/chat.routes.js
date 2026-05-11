// src/routes/chat.routes.js
//
// Endpoints del chat:
//   POST   /chat                      - preguntar (stateless o con sessionId)
//   POST   /chat/stream                - preguntar con streaming SSE
//   POST   /chat/sessions              - crear sesion
//   GET    /chat/sessions              - listar sesiones (filtrable por userId)
//   GET    /chat/sessions/:id          - detalle
//   GET    /chat/sessions/:id/messages - historial
//   DELETE /chat/sessions/:id          - borrar sesion y mensajes

const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const chat = require("../services/chat.service");

const router = express.Router();

function parsePagination(query, { defaultLimit = 50, maxLimit = 500 } = {}) {
  const limit = Math.min(
    Math.max(Number(query.limit) || defaultLimit, 1),
    maxLimit,
  );
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

// ─── Crear sesion ───────────────────────────────────────────────────────────
router.post(
  "/sessions",
  asyncHandler(async (req, res) => {
    const { userId = null, assignmentId = null, title = null } = req.body || {};
    const session = await chat.createSession({ userId, assignmentId, title });
    res.status(201).json({ ok: true, session });
  }),
);

// ─── Listar sesiones ────────────────────────────────────────────────────────
router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const sessions = await chat.listSessions({
      userId: req.query.userId || null,
      limit,
      offset,
    });
    res.json({
      ok: true,
      pagination: { limit, offset, count: sessions.length },
      sessions,
    });
  }),
);

// ─── Detalle de sesion ──────────────────────────────────────────────────────
router.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const session = await chat.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ ok: false, error: "Sesion no encontrada" });
    }
    res.json({ ok: true, session });
  }),
);

// ─── Mensajes de una sesion ─────────────────────────────────────────────────
router.get(
  "/sessions/:id/messages",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query, {
      defaultLimit: 200,
      maxLimit: 1000,
    });
    const session = await chat.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ ok: false, error: "Sesion no encontrada" });
    }
    const messages = await chat.listSessionMessages(session.id, {
      limit,
      offset,
    });
    res.json({
      ok: true,
      session,
      pagination: { limit, offset, count: messages.length },
      messages,
    });
  }),
);

// ─── Borrar sesion ──────────────────────────────────────────────────────────
router.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    await chat.deleteSession(req.params.id);
    res.json({ ok: true });
  }),
);

// ─── Preguntar (sincrono) ──────────────────────────────────────────────────
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      question,
      sessionId = null,
      history = null,
      topK,
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "La pregunta es requerida." });
    }

    const result = await chat.answerQuestion({
      question,
      sessionId,
      history,
      topK: topK ? Number(topK) : undefined,
    });

    res.json({ ok: true, ...result });
  }),
);

// ─── Preguntar con streaming (SSE) ─────────────────────────────────────────
router.post(
  "/stream",
  asyncHandler(async (req, res) => {
    const {
      question,
      sessionId = null,
      history = null,
      topK,
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "La pregunta es requerida." });
    }

    // Headers SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const writeEvent = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Si el cliente se desconecta a medio stream
    let clientClosed = false;
    req.on("close", () => {
      clientClosed = true;
    });

    try {
      await chat.answerQuestionStream({
        question,
        sessionId,
        history,
        topK: topK ? Number(topK) : undefined,
        onChunk: (evt) => {
          if (clientClosed) return;
          writeEvent(evt);
        },
      });
    } catch (err) {
      writeEvent({ type: "error", error: err.message });
    }

    if (!clientClosed) res.end();
  }),
);

module.exports = router;
