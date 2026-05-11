const { readDb } = require("../repositories/dbRepository");
const { HttpError } = require("../utils/httpError");
const { buildTaskNotifications } = require("../services/notificationService");

async function getUserNotifications(req, res, next) {
  try {
    const { userId } = req.params;
    const db = await readDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const tasks = db.tasks.filter((t) => t.userId === userId);
    const notifications = await buildTaskNotifications(tasks);

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      notifications,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getUserNotifications };
