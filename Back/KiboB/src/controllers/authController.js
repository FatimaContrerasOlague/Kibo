const users = require("../repositories/userRepository");
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

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await users.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new HttpError(409, "El correo ya esta registrado");
    }

    const user = await users.createUser({
      passwordHash: hashPassword(String(password)),
      name: String(name).trim(),
      email: normalizedEmail,
    });

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

    const user = await users.findUserByEmail(String(email).toLowerCase().trim());
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
