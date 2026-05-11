// src/db/index.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30_000),
});

pool.on("error", (err) => {
  console.error("[db] Error inesperado en cliente idle:", err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Ejecuta `fn(client)` dentro de una transaccion.
 * Hace BEGIN; ejecuta; COMMIT. Si lanza, hace ROLLBACK.
 *
 * @template T
 * @param {(client: import("pg").PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  withTransaction,
  pool,
};
