// src/services/gemini-http.js
//
// Agente HTTPS compartido para todas las llamadas a la Generative Language API
// de Google. Mantener keep-alive activo reduce el handshake TLS en cada
// embedding/generacion y acorta los tiempos de ingesta y respuesta.

const https = require("https");

const geminiHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.GEMINI_MAX_SOCKETS || 20),
});

module.exports = {
  geminiHttpsAgent,
};
