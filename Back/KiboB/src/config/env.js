const path = require("path");

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 4000),
  chatbotServiceUrl: process.env.CHATBOT_SERVICE_URL || "http://localhost:4100",
  openLibraryBaseUrl: process.env.OPEN_LIBRARY_BASE_URL || "https://openlibrary.org",
  dataFilePath:
    process.env.DATA_FILE_PATH || path.join(__dirname, "..", "..", "data", "db.json"),
  mascotImageUrl:
    process.env.MASCOT_IMAGE_URL ||
    "https://images.unsplash.com/photo-1598439210625-5067c578f3f6?auto=format&fit=crop&w=600&q=80",
};
