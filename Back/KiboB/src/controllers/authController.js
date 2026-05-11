const { readDb, writeDb } = require("../repositories/dbRepository");
const { createId } = require("../utils/id");
const { hashPassword, verifyPassword } = require("../utils/password");
const { HttpError } = require("../utils/httpError");

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new HttpError(400, "name, email y password son requeridos");
    }

    const db = await readDb();
    const existing = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existing) {
      throw new HttpError(409, "El correo ya esta registrado");
    }

    const user = {
      id: createId("usr"),
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: hashPassword(String(password)),
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    await writeDb(db);

    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new HttpError(400, "email y password son requeridos");
    }

    const db = await readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      throw new HttpError(401, "Credenciales invalidas");
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
};
