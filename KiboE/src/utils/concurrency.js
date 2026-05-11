// src/utils/concurrency.js
//
// Ejecutores con concurrencia limitada, sin dependencias externas.

/**
 * Ejecuta `worker(item, index)` sobre `items` con un maximo de `concurrency`
 * promesas activas a la vez. Preserva el orden del array original en los
 * resultados y no se detiene si una promesa falla: cada posicion del array
 * devuelto puede ser `{ ok: true, value }` o `{ ok: false, error }`.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<Array<{ok: true, value: R} | {ok: false, error: Error}>>}
 */
async function runWithConcurrency(items, concurrency, worker) {
  const safeConcurrency = Math.max(1, Math.floor(concurrency || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runOne() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { ok: true, value };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(safeConcurrency, items.length); i++) {
    workers.push(runOne());
  }
  await Promise.all(workers);
  return results;
}

module.exports = {
  runWithConcurrency,
};
