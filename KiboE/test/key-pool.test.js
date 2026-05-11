const test = require("node:test");
const assert = require("node:assert/strict");

const {
  KeyPool,
  parseKeys,
  withKeyRotation,
} = require("../src/utils/key-pool");

test("parseKeys separa por coma, trimea y filtra vacios", () => {
  assert.deepEqual(parseKeys(""), []);
  assert.deepEqual(parseKeys(undefined), []);
  assert.deepEqual(parseKeys("a"), ["a"]);
  assert.deepEqual(parseKeys(" a , b ,, c "), ["a", "b", "c"]);
});

test("KeyPool round-robin entrega las keys en orden", () => {
  const p = new KeyPool(["k1", "k2", "k3"]);
  assert.equal(p.next().key, "k1");
  assert.equal(p.next().key, "k2");
  assert.equal(p.next().key, "k3");
  assert.equal(p.next().key, "k1");
});

test("KeyPool marca una key como rate-limited y la evita", () => {
  const p = new KeyPool(["k1", "k2", "k3"], { cooldownMs: 10_000 });
  const { index: i1 } = p.next();
  p.markRateLimited(i1);
  const next1 = p.next();
  const next2 = p.next();
  assert.notEqual(next1.key, "k1");
  assert.notEqual(next2.key, "k1");
});

test("KeyPool devuelve exhausted=true cuando todas estan en cooldown", () => {
  const p = new KeyPool(["k1", "k2"], { cooldownMs: 60_000 });
  p.markRateLimited(0);
  p.markRateLimited(1);
  const r = p.next();
  assert.equal(r.exhausted, true);
});

test("withKeyRotation rota a la siguiente key al recibir 429", async () => {
  const pool = new KeyPool(["k1", "k2", "k3"], { cooldownMs: 60_000 });
  const usedKeys = [];
  let calls = 0;

  const fn = async (key) => {
    usedKeys.push(key);
    calls++;
    if (calls < 3) {
      const err = new Error("quota");
      err.response = { status: 429 };
      throw err;
    }
    return "ok-" + key;
  };

  const result = await withKeyRotation(pool, fn);
  assert.equal(result, "ok-k3");
  assert.deepEqual(usedKeys, ["k1", "k2", "k3"]);
});

test("withKeyRotation NO rota en errores que no son 429/quota", async () => {
  const pool = new KeyPool(["k1", "k2"]);
  const fn = async () => {
    const err = new Error("boom");
    err.response = { status: 500 };
    throw err;
  };
  await assert.rejects(withKeyRotation(pool, fn), /boom/);
});
