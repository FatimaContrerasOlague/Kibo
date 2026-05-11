// src/services/providers/google.embeddings.js
//
// Provider: Google Generative Language API (Gemini).
// Soporta MULTIPLES API keys en EMBEDDINGS_API_KEY separadas por coma:
//   EMBEDDINGS_API_KEY=key1,key2,key3
// Si una pega 429 (cuota excedida), la marca en cooldown y rota a la
// siguiente automaticamente. Asi puedes agregar keys de varias cuentas
// Google y aprovechar el tier gratis de cada una.

const axios = require("axios");
const { geminiHttpsAgent } = require("../gemini-http");
const { withRetry, isRetryableAxiosError } = require("../../utils/retry");
const { runWithConcurrency } = require("../../utils/concurrency");
const {
  KeyPool,
  parseKeys,
  withKeyRotation,
} = require("../../utils/key-pool");

const MODEL = process.env.EMBEDDINGS_MODEL || "gemini-embedding-001";
const DIM = Number(process.env.EMBEDDINGS_DIM || 768);

const BATCH_SIZE = Math.max(
  1,
  Math.min(Number(process.env.EMBED_BATCH_SIZE || 100), 100),
);
const BATCH_CONCURRENCY = Math.max(
  1,
  Number(process.env.EMBED_BATCH_CONCURRENCY || 2),
);
const KEY_COOLDOWN_MS = Number(
  process.env.EMBEDDINGS_KEY_COOLDOWN_MS || 60 * 60 * 1000,
);

let _pool = null;
function pool() {
  if (_pool) return _pool;
  const keys = parseKeys(process.env.EMBEDDINGS_API_KEY);
  if (keys.length === 0) {
    throw new Error("EMBEDDINGS_API_KEY no definida en .env");
  }
  _pool = new KeyPool(keys, { cooldownMs: KEY_COOLDOWN_MS });
  if (keys.length > 1) {
    console.log(`[embeddings.google] Pool con ${keys.length} llaves activo`);
  }
  return _pool;
}

function body(text) {
  return {
    content: { parts: [{ text }] },
    outputDimensionality: DIM,
  };
}

// Para no reintentar 429 en la capa interna: rotamos en la capa externa.
const shouldRetryExceptQuota = (err) =>
  err?.response?.status !== 429 &&
  !(
    err?.response?.status === 403 &&
    /quota|limit|exceeded/i.test(err?.response?.data?.error?.message || "")
  ) &&
  isRetryableAxiosError(err);

async function embedOne(text) {
  return withKeyRotation(pool(), async (apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`;

    const response = await withRetry(
      () =>
        axios.post(url, body(text), {
          headers: { "Content-Type": "application/json" },
          httpsAgent: geminiHttpsAgent,
          timeout: 30_000,
        }),
      {
        label: "embeddings.google",
        retries: 3,
        shouldRetry: shouldRetryExceptQuota,
      },
    );

    const values = response.data?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("Respuesta sin embedding");
    }
    return values;
  });
}

async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const indexed = texts.map((t, i) => ({ i, text: (t || "").trim() }));
  const valid = indexed.filter((x) => x.text.length > 0);
  const invalid = indexed.filter((x) => x.text.length === 0);

  const groups = [];
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    groups.push(valid.slice(i, i + BATCH_SIZE));
  }

  const runs = await runWithConcurrency(
    groups,
    BATCH_CONCURRENCY,
    async (group) => {
      return withKeyRotation(pool(), async (apiKey) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${apiKey}`;

        const response = await withRetry(
          () =>
            axios.post(
              url,
              {
                requests: group.map((it) => ({
                  model: `models/${MODEL}`,
                  ...body(it.text),
                })),
              },
              {
                headers: { "Content-Type": "application/json" },
                httpsAgent: geminiHttpsAgent,
                timeout: 60_000,
              },
            ),
          {
            label: "embeddings.google.batch",
            retries: 3,
            shouldRetry: shouldRetryExceptQuota,
          },
        );

        const embeddings = response.data?.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== group.length) {
          throw new Error(
            `batchEmbedContents devolvio ${embeddings?.length || 0} items (esperaba ${group.length})`,
          );
        }
        return embeddings.map((e, k) => ({
          originalIndex: group[k].i,
          values: e.values,
        }));
      });
    },
  );

  const out = new Array(texts.length).fill(null);
  for (const { i } of invalid) {
    out[i] = { ok: false, index: i, error: new Error("Texto vacio") };
  }
  runs.forEach((run, batchIdx) => {
    if (run.ok) {
      for (const emb of run.value) {
        if (Array.isArray(emb.values) && emb.values.length > 0) {
          out[emb.originalIndex] = { ok: true, value: emb.values };
        } else {
          out[emb.originalIndex] = {
            ok: false,
            index: emb.originalIndex,
            error: new Error("Embedding vacio"),
          };
        }
      }
    } else {
      for (const item of groups[batchIdx]) {
        out[item.i] = { ok: false, index: item.i, error: run.error };
      }
    }
  });

  return out;
}

module.exports = {
  embedOne,
  embedBatch,
  _pool: () => pool(),
};
