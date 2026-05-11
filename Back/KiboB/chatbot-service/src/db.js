const fs = require("fs/promises");
const path = require("path");

const DB_PATH = process.env.CHATBOT_DB_PATH || path.join(__dirname, "..", "data", "chatbot-db.json");

const defaults = {
  messages: [],
  files: [],
};

let queue = Promise.resolve();

async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(defaults, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return { ...defaults };
  }
}

async function writeDb(nextData) {
  queue = queue.then(async () => {
    await ensureDb();
    await fs.writeFile(DB_PATH, JSON.stringify(nextData, null, 2), "utf8");
  });
  return queue;
}

module.exports = {
  readDb,
  writeDb,
};
