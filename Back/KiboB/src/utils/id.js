const crypto = require("crypto");

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { createId };
