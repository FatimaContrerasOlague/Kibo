// src/utils/url-guard.js
//
// Validaciones de URL para prevenir SSRF en descargas salientes.
// Bloquea loopback, rangos privados RFC1918, link-local y metadata IMDS.

const dns = require("dns").promises;
const net = require("net");

const BLOCKED_IPV4_PREFIXES = [
  { prefix: "0.", mask: null },          // 0.0.0.0/8
  { prefix: "10.", mask: null },         // 10.0.0.0/8 (privado)
  { prefix: "127.", mask: null },        // loopback
  { prefix: "169.254.", mask: null },    // link-local (incluye IMDS AWS/GCP)
  { prefix: "192.168.", mask: null },    // privado
  { prefix: "255.255.255.255", mask: null }, // broadcast
];

function isBlockedIpv4(ip) {
  if (BLOCKED_IPV4_PREFIXES.some((entry) => ip.startsWith(entry.prefix))) {
    return true;
  }
  // 172.16.0.0/12
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // 100.64.0.0/10 (CGNAT, opcional pero razonable bloquear)
  if (ip.startsWith("100.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 64 && second <= 127) return true;
  }
  return false;
}

function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||   // unique local fc00::/7
    lower.startsWith("fd") ||
    lower.startsWith("fe80") || // link-local
    lower.startsWith("::ffff:") // IPv4-mapped: validar la parte v4 tambien
  );
}

/**
 * Valida que la URL sea descargable desde el servidor:
 *   - protocolo http/https
 *   - host no es loopback/privado/link-local
 *
 * Resuelve DNS y verifica todas las IPs resueltas.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>} URL parseada si es segura
 */
async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL invalida");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Solo se permiten URLs http o https");
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error("URL sin hostname");
  }

  // Hostnames textuales obviamente locales
  const lowerHost = hostname.toLowerCase();
  if (["localhost", "localhost.localdomain", "ip6-localhost"].includes(lowerHost)) {
    throw new Error("Host no permitido (loopback)");
  }

  // Si ya es IP literal, validar directo
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isBlockedIpv4(hostname)) {
      throw new Error(`Host no permitido: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isBlockedIpv6(hostname)) {
      throw new Error(`Host no permitido: ${hostname}`);
    }
    return parsed;
  }

  // Resolver DNS (todas las respuestas A/AAAA)
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (error) {
    throw new Error(`No se pudo resolver el host: ${hostname}`);
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isBlockedIpv4(address)) {
      throw new Error(`Host resuelto a IP no permitida: ${address}`);
    }
    if (family === 6 && isBlockedIpv6(address)) {
      throw new Error(`Host resuelto a IP no permitida: ${address}`);
    }
  }

  return parsed;
}

module.exports = {
  assertPublicUrl,
};
