const express = require("express");
const {
  health,
  ask,
  upload,
  listMessages,
} = require("../controllers/chatbotController");

const router = express.Router();

router.get("/health", health);
router.post("/chat", ask);
router.post("/files", upload);
router.get("/chat/:userId", listMessages);

module.exports = router;
