const express = require("express");
const {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskReminders,
} = require("../controllers/taskController");

const router = express.Router();

router.get("/", listTasks);
router.post("/", createTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
router.get("/:id/reminders", getTaskReminders);

module.exports = router;
