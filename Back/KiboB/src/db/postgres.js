const { Pool } = require("pg");
const { databaseSsl, databaseUrl } = require("../config/env");

let pool = null;

function getPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada para KiboB");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseSsl,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30_000),
    });

    pool.on("error", (error) => {
      console.error("[kibob.db] Error inesperado en cliente idle:", error.message);
    });
  }

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = {
  query,
  getPool,
};
