const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool
};
