// src/index.js
// Unico punto donde se carga dotenv. Debe ser lo primero.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const healthRoutes = require("./routes/health");
const ingestRoutes = require("./routes/ingest.routes");
const chatRoutes = require("./routes/chat.routes");
const assignmentsRoutes = require("./routes/assignments.routes");
const resourcesRoutes = require("./routes/resources.routes");
const summariesRoutes = require("./routes/summaries.routes");
const quizzesRoutes = require("./routes/quizzes.routes");

const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/errorHandler");

const app = express();
const port = Number(process.env.PORT || 3000);

// ─── Seguridad base ─────────────────────────────────────────────────────────
app.use(helmet());

// CORS configurable: lista separada por comas. Default "*" (dev).
const corsOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.includes("*") ? true : corsOrigins,
    credentials: false,
  }),
);

// Body parser con limite razonable (para texto largo de ingesta manual)
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));

// Si corres detras de un proxy/tunnel, confia en el primero para que el
// rate limit cuente bien la IP real.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));

// ─── Rate limiting ──────────────────────────────────────────────────────────
// Limite general suave para evitar abuso.
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas peticiones, intenta de nuevo" },
});

// Limite mas estricto para endpoints que disparan llamadas a Gemini.
const aiLimiter = rateLimit({
  windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Limite de peticiones a IA alcanzado" },
});

app.use(generalLimiter);

// ─── Rutas ──────────────────────────────────────────────────────────────────
app.use("/health", healthRoutes);
app.use("/resources", resourcesRoutes);
app.use("/ingest", ingestRoutes);
app.use("/chat", aiLimiter, chatRoutes);
app.use("/assignments", aiLimiter, assignmentsRoutes);
app.use("/summaries", aiLimiter, summariesRoutes);
app.use("/quizzes", aiLimiter, quizzesRoutes);

// ─── 404 + manejador global de errores ──────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);

  // Precarga del modelo local si corresponde. No bloquea el listen.
  if ((process.env.EMBEDDINGS_PROVIDER || "").toLowerCase() === "local") {
    const { warmup } = require("./services/embeddings");
    warmup().catch((err) => {
      console.error("[embeddings.local] Warmup fallo:", err.message);
    });
  }
});
