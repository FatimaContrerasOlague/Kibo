const { callChatbot } = require("../services/chatbotProxyService");
const { HttpError } = require("../utils/httpError");

async function health(req, res, next) {
  try {
    const result = await callChatbot("/health");
    res.json(result);
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

    const result = await callChatbot("/chat", {
      method: "POST",
      body: JSON.stringify({ userId, message }),
    });

    res.json(result);
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

    const result = await callChatbot("/files", {
      method: "POST",
      body: JSON.stringify({ userId, fileName, content }),
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function listMessages(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await callChatbot(`/chat/${encodeURIComponent(userId)}`);
    res.json(result);
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
