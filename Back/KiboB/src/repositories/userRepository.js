const crypto = require("crypto");
const fs = require("fs/promises");
const db = require("../db/postgres");
const { dataFilePath } = require("../config/env");

let initPromise = null;

async function ensureUserTable() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS public.kibo_users (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS kibo_users_email_lower_idx
          ON public.kibo_users (LOWER(email));
      `);

      await migrateLegacyJsonUsers();
    })();
  }

  return initPromise;
}

async function migrateLegacyJsonUsers() {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(dataFilePath, "utf8"));
  } catch {
    return;
  }

  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    return;
  }

  for (const user of parsed.users) {
    if (!user?.email || !user?.name || !user?.passwordHash) {
      continue;
    }

    await db.query(
      `
      INSERT INTO public.kibo_users (id, name, email, password_hash, created_at)
      VALUES ($1, $2, LOWER($3), $4, COALESCE($5::timestamptz, NOW()))
      ON CONFLICT (LOWER(email)) DO NOTHING;
      `,
      [
        crypto.randomUUID(),
        String(user.name).trim(),
        String(user.email).toLowerCase().trim(),
        user.passwordHash,
        user.createdAt || null,
      ],
    );
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

async function findUserByEmail(email) {
  await ensureUserTable();
  const result = await db.query(
    `
    SELECT id, name, email, password_hash, created_at
    FROM public.kibo_users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
    `,
    [email],
  );
  return mapUser(result.rows[0]);
}

async function createUser({ name, email, passwordHash }) {
  await ensureUserTable();
  const result = await db.query(
    `
    INSERT INTO public.kibo_users (id, name, email, password_hash)
    VALUES ($1, $2, LOWER($3), $4)
    RETURNING id, name, email, password_hash, created_at;
    `,
    [crypto.randomUUID(), name, email, passwordHash],
  );
  return mapUser(result.rows[0]);
}

module.exports = {
  createUser,
  findUserByEmail,
  ensureUserTable,
};
