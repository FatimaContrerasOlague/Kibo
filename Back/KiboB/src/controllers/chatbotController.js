const { callChatbot } = require("../services/chatbotProxyService");
const { readDb, writeDb } = require("../repositories/dbRepository");
const { HttpError } = require("../utils/httpError");
const { createId } = require("../utils/id");

async function getOrCreateSession(userId) {
  const db = await readDb();
  const existing = db.chatbotSessions.find((session) => session.userId === userId);

  if (existing) {
    return { db, session: existing };
  }

  const payload = await callChatbot("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({
      title: `Chat de ${userId}`,
    }),
  });

  if (!payload?.session?.id) {
    throw new Error("KiboE no devolvio una sesion valida");
  }

  const created = {
    userId,
    sessionId: payload.session.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.chatbotSessions.push(created);
  await writeDb(db);

  return { db, session: created };
}

async function touchSession(userId, sessionId) {
  const db = await readDb();
  const index = db.chatbotSessions.findIndex((session) => session.userId === userId);

  if (index === -1) {
    db.chatbotSessions.push({
      userId,
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    db.chatbotSessions[index] = {
      ...db.chatbotSessions[index],
      sessionId,
      updatedAt: new Date().toISOString(),
    };
  }

  await writeDb(db);
}

function normalizeConversation({ userId, question, answer }) {
  const createdAt = new Date().toISOString();
  return [
    {
      id: createId("msg"),
      userId,
      role: "user",
      message: question,
      createdAt,
    },
    {
      id: createId("msg"),
      userId,
      role: "assistant",
      message: answer,
      createdAt: new Date().toISOString(),
    },
  ];
}

async function health(req, res, next) {
  try {
    const result = await callChatbot("/health");
    res.json({
      ...result,
      provider: "KiboE",
    });
  } catch (error) {
    next(new HttpError(502, `Chatbot no disponible: ${error.message}`));
  }
}

async function ask(req, res, next) {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      throw new HttpError(400, "userId y message son requeridos");
    }

    const { session } = await getOrCreateSession(userId);

    const result = await callChatbot("/chat", {
      method: "POST",
      body: JSON.stringify({
        question: String(message),
        sessionId: session.sessionId,
      }),
    });

    if (result?.session?.id) {
      await touchSession(userId, result.session.id);
    }

    res.json({
      conversation: normalizeConversation({
        userId,
        question: String(message),
        answer: result.answer || "No obtuve respuesta del tutor.",
      }),
      sessionId: result?.session?.id || session.sessionId,
      suggestions: Array.isArray(result?.suggestions) ? result.suggestions : [],
      sources: Array.isArray(result?.sources) ? result.sources : [],
    });
  } catch (error) {
    next(error);
  }
}

async function upload(req, res, next) {
  try {
    const { userId, fileName, content } = req.body;
    if (!userId || !fileName || !content) {
      throw new HttpError(400, "userId, fileName y content son requeridos");
    }

    const result = await callChatbot("/ingest", {
      method: "POST",
      body: JSON.stringify({
        title: String(fileName),
        text: String(content),
        sourceName: `Archivo de ${userId}`,
        resourceType: "other",
      }),
    });

    const db = await readDb();
    const file = {
      id: createId("fil"),
      userId,
      fileName: String(fileName),
      contentPreview: String(content).slice(0, 500),
      resourceId: result?.resource?.id || null,
      documentId: result?.document?.id || null,
      createdAt: new Date().toISOString(),
    };

    db.chatbotFiles.push(file);
    await writeDb(db);

    res.status(201).json({ file, ingest: result });
  } catch (error) {
    next(error);
  }
}

async function listMessages(req, res, next) {
  try {
    const { userId } = req.params;
    const db = await readDb();
    const session = db.chatbotSessions.find((item) => item.userId === userId);

    if (!session?.sessionId) {
      return res.json({ userId, messages: [] });
    }

    const result = await callChatbot(
      `/chat/sessions/${encodeURIComponent(session.sessionId)}/messages`,
    );

    const messages = Array.isArray(result?.messages)
      ? result.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            userId,
            role: message.role,
            message: message.content,
            createdAt: message.created_at,
          }))
      : [];

    res.json({ userId, messages });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  health,
  ask,
  upload,
  listMessages,
};
