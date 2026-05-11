const { readDb } = require("../repositories/dbRepository");
const { HttpError } = require("../utils/httpError");
const { searchBooks, calculateBestDay, keywordFromTask } = require("../services/bookService");

async function byTask(req, res, next) {
  try {
    const { taskId, taskTitle, dueAt, limit } = req.query;
    let resolvedTitle = taskTitle;
    let resolvedDueAt = dueAt;

    if (taskId) {
      const db = await readDb();
      const task = db.tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new HttpError(404, "Tarea no encontrada para recomendaciones");
      }
      resolvedTitle = task.title;
      resolvedDueAt = task.dueAt;
    }

    if (!resolvedTitle) {
      throw new HttpError(400, "Proporciona taskId o taskTitle");
    }

    const books = await searchBooks({
      query: keywordFromTask(resolvedTitle),
      limit: Number(limit || 5),
    });

    res.json({
      taskTitle: resolvedTitle,
      bestDay: calculateBestDay(resolvedDueAt),
      recommendations: books,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { byTask };
