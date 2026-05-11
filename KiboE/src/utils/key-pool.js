// src/utils/key-pool.js
//
// Pool de API keys con:
//   - Round-robin (distribucion pareja)
//   - Cooldown automatico por key cuando recibe 429 (cuota excedida)
//   - Fallback: si todas estan en cooldown, devuelve la que esta por liberarse
//
// Se usa para rotar entre multiples Google API keys (cada cuenta Google con
// tier gratis aporta su propia cuota de Gemini).

class KeyPool {
  /**
   * @param {string[]} keys
   * @param {object}   [options]
   * @param {number}   [options.cooldownMs=3600_000] ms que una key queda "quemada"
   *                                                  al recibir 429. Default 1 hora.
   */
  constructor(keys, options = {}) {
    const cleaned = (keys || [])
      .filter((k) => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim());

    if (cleaned.length === 0) {
      throw new Error("KeyPool creado sin llaves");
    }

    this.keys = cleaned;
    this.cooldownMs = options.cooldownMs ?? 60 * 60 * 1000;
    this.cursor = 0;
    this.cooldownUntil = new Array(cleaned.length).fill(0);
  }

  size() {
    return this.keys.length;
  }

  /**
   * Devuelve la siguiente key usable. Si todas estan en cooldown, devuelve la
   * mas antigua (con `exhausted: true`) para permitir un ultimo intento.
   */
  next() {
    const now = Date.now();

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.cursor + i) % this.keys.length;
      if (this.cooldownUntil[idx] <= now) {
        this.cursor = (idx + 1) % this.keys.length;
        return {
          key: this.keys[idx],
          index: idx,
          exhausted: false,
        };
      }
    }

    // Todas en cooldown: devolvemos la que se libera antes
    let earliestIdx = 0;
    for (let i = 1; i < this.keys.length; i++) {
      if (this.cooldownUntil[i] < this.cooldownUntil[earliestIdx]) {
        earliestIdx = i;
      }
    }
    return {
      key: this.keys[earliestIdx],
      index: earliestIdx,
      exhausted: true,
    };
  }

  markRateLimited(index) {
    if (index < 0 || index >= this.keys.length) return;
    this.cooldownUntil[index] = Date.now() + this.cooldownMs;
  }

  status() {
    const now = Date.now();
    return this.keys.map((_, i) => ({
      index: i,
      available: this.cooldownUntil[i] <= now,
      availableAt:
        this.cooldownUntil[i] > now
          ? new Date(this.cooldownUntil[i]).toISOString()
          : null,
    }));
  }
}

/**
 * Parsea una variable tipo "k1,k2,k3" (o una sola key) y devuelve array limpio.
 */
function parseKeys(envValue) {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Ejecuta `fn(key)` rotando entre las keys del pool. Si fn lanza un error con
 * status HTTP 429, marca la key como rate-limited y reintenta con la siguiente.
 *
 * @template T
 * @param {KeyPool} pool
 * @param {(key: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withKeyRotation(pool, fn) {
  const attempts = pool.size();
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const { key, index, exhausted } = pool.next();
    try {
      return await fn(key);
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      // 429 (cuota) o 403 con mensaje tipico de cuota → rotar
      const isQuotaError =
        status === 429 ||
        (status === 403 &&
          /quota|limit|exceeded/i.test(
            err?.response?.data?.error?.message || "",
          ));

      if (isQuotaError) {
        pool.markRateLimited(index);
        console.warn(
          `[keyPool] Key #${index} agotada (${status}); rotando a la siguiente`,
        );
        if (exhausted) throw err; // todas ya en cooldown
        continue;
      }
      throw err; // otro error: no rotar
    }
  }

  throw lastError;
}

module.exports = {
  KeyPool,
  parseKeys,
  withKeyRotation,
};
