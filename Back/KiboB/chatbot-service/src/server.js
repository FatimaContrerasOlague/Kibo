const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { readDb, writeDb } = require("./db");

const app = express();
const port = Number(process.env.CHATBOT_PORT || 4100);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

app.get("/health", (req, res) => {
  res.json({ service: "kibo-chatbot-service", status: "ok", timestamp: new Date().toISOString() });
});

app.post("/chat", async (req, res, next) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId y message son requeridos" });
    }

    const db = await readDb();

    const incoming = {
      id: createId("msg"),
      userId,
      role: "user",
      message: String(message),
      createdAt: new Date().toISOString(),
    };

    const botReply = {
      id: createId("msg"),
      userId,
      role: "assistant",
      message: `Kibo IA: Recibi tu mensaje. Sugerencia breve: divide la tarea en pasos de 25 minutos y revisa una fuente confiable para avanzar hoy.`,
      createdAt: new Date().toISOString(),
    };

    db.messages.push(incoming, botReply);
    await writeDb(db);

    res.json({ conversation: [incoming, botReply] });
  } catch (error) {
    next(error);
  }
});

app.get("/chat/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const db = await readDb();
    const messages = db.messages.filter((m) => m.userId === userId);
    res.json({ userId, messages });
  } catch (error) {
    next(error);
  }
});

app.post("/files", async (req, res, next) => {
  try {
    const { userId, fileName, content } = req.body;
    if (!userId || !fileName || !content) {
      return res.status(400).json({ error: "userId, fileName y content son requeridos" });
    }

    const db = await readDb();
    const file = {
      id: createId("fil"),
      userId,
      fileName: String(fileName),
      contentPreview: String(content).slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    db.files.push(file);
    await writeDb(db);

    res.status(201).json({ file });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message || "Error interno del chatbot",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

app.listen(port, () => {
  console.log(`Chatbot service listo en http://localhost:${port}`);
});
