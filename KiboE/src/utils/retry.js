// src/utils/retry.js
//
// Retry con exponential backoff + jitter para llamadas HTTP transitorias.

const DEFAULT_RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAxiosError(error, retryStatuses = DEFAULT_RETRY_STATUSES) {
  // Error sin respuesta HTTP = timeout, DNS, socket, etc: se reintenta.
  if (!error.response) return true;
  return retryStatuses.has(error.response.status);
}

/**
 * Reintenta una funcion async con backoff exponencial.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.retries=3]          Numero de reintentos despues del primer intento.
 * @param {number} [options.initialDelayMs=500] Delay inicial.
 * @param {number} [options.maxDelayMs=8000]    Delay maximo por intento.
 * @param {(error: any) => boolean} [options.shouldRetry] Predicado para decidir retry.
 * @param {string} [options.label]              Etiqueta para logs.
 * @returns {Promise<T>}
 */
async function withRetry(fn, options = {}) {
  const {
    retries = 3,
    initialDelayMs = 500,
    maxDelayMs = 8000,
    shouldRetry = isRetryableAxiosError,
    label = "retry",
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }
      const base = Math.min(maxDelayMs, initialDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * Math.min(250, base));
      const delay = base + jitter;
      const reason =
        error.response?.status || error.code || error.message || "unknown";
      console.warn(
        `[${label}] intento ${attempt + 1}/${retries + 1} fallo (${reason}); reintentando en ${delay}ms`,
      );
      await sleep(delay);
      attempt++;
    }
  }

  throw lastError;
}

module.exports = {
  isRetryableAxiosError,
  withRetry,
};
