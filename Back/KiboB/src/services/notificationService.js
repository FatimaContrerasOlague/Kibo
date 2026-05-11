const { mascotImageUrl } = require("../config/env");
const { calculateBestDay, keywordFromTask, searchBooks } = require("./bookService");

const REMINDER_WINDOWS = [
  { key: "1d", label: "1 dia antes", ms: 24 * 60 * 60 * 1000 },
  { key: "8h", label: "8 horas antes", ms: 8 * 60 * 60 * 1000 },
  { key: "4h", label: "4 horas antes", ms: 4 * 60 * 60 * 1000 },
  { key: "1h", label: "1 hora antes", ms: 60 * 60 * 1000 },
];

function getReminderStatus(dueAt, now = new Date()) {
  const dueDate = new Date(dueAt);
  const diff = dueDate.getTime() - now.getTime();

  if (Number.isNaN(dueDate.getTime())) {
    return [];
  }

  return REMINDER_WINDOWS.map((window) => {
    const delta = diff - window.ms;
    return {
      key: window.key,
      label: window.label,
      shouldNotify: delta <= 0 && diff > 0,
      millisUntilReminder: delta,
    };
  });
}

async function buildTaskNotifications(tasks) {
  const now = new Date();
  const result = [];

  for (const task of tasks) {
    if (task.completed) {
      continue;
    }

    const reminders = getReminderStatus(task.dueAt, now).filter((r) => r.shouldNotify);
    if (!reminders.length) {
      continue;
    }

    const books = await searchBooks({ query: keywordFromTask(task.title), limit: 1 });
    result.push({
      taskId: task.id,
      taskTitle: task.title,
      dueAt: task.dueAt,
      mascotImage: mascotImageUrl,
      reminders,
      recommendation: books[0] || null,
      bestDay: calculateBestDay(task.dueAt),
    });
  }

  return result;
}

module.exports = {
  REMINDER_WINDOWS,
  getReminderStatus,
  buildTaskNotifications,
};
