// src/middleware/errorHandler.js

/**
 * Wrapper para handlers async. Permite escribir:
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 * sin repetir try/catch: los errores van al middleware global.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** 404 por defecto. */
function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}

/** Middleware global de errores. Debe ser el ultimo `app.use`. */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.expose === false && status >= 500
    ? "Error interno del servidor"
    : err.message || "Error desconocido";

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err.stack || err);
  } else {
    console.warn(`[warn] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(status).json({ ok: false, error: message });
}

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
