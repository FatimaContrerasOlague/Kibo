const fs = require("fs/promises");
const { dataFilePath } = require("../config/env");

const defaultData = {
  users: [],
  tasks: [],
  chatbotFiles: [],
  chatbotSessions: [],
};

let writeQueue = Promise.resolve();

async function ensureFile() {
  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.mkdir(require("path").dirname(dataFilePath), { recursive: true });
    await fs.writeFile(dataFilePath, JSON.stringify(defaultData, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureFile();
  const raw = await fs.readFile(dataFilePath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaultData,
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      chatbotFiles: Array.isArray(parsed.chatbotFiles) ? parsed.chatbotFiles : [],
      chatbotSessions: Array.isArray(parsed.chatbotSessions) ? parsed.chatbotSessions : [],
    };
  } catch {
    return { ...defaultData };
  }
}

async function writeDb(nextData) {
  writeQueue = writeQueue.then(async () => {
    await ensureFile();
    await fs.writeFile(dataFilePath, JSON.stringify(nextData, null, 2), "utf8");
  });
  return writeQueue;
}

module.exports = {
  readDb,
  writeDb,
};
