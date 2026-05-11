const express = require("express");
const { byTask } = require("../controllers/recommendationController");

const router = express.Router();

router.get("/", byTask);

module.exports = router;
