const { chatbotServiceUrl } = require("../config/env");

async function callChatbot(path, init = {}) {
  const response = await fetch(`${chatbotServiceUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const reason = text || `Chatbot service error ${response.status}`;
    throw new Error(reason);
  }

  return response.json();
}

module.exports = {
  callChatbot,
};
