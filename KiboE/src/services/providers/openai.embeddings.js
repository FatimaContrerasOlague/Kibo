// src/services/providers/openai.embeddings.js
//
// Provider: OpenAI Embeddings.
//   - Modelo por defecto: text-embedding-3-small (cheap, bueno)
//   - Usa `dimensions` para Matryoshka → mantiene VECTOR(768) en DB.
//   - Endpoint acepta hasta 2048 inputs por request; usamos 500 por seguridad.

const https = require("https");
const axios = require("axios");
const { withRetry } = require("../../utils/retry");
const { runWithConcurrency } = require("../../utils/concurrency");

const MODEL =
  process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small";
const DIM = Number(process.env.EMBEDDINGS_DIM || 768);

// OpenAI: hasta 2048 items por request. Cap razonable a 500.
const BATCH_SIZE = Math.max(
  1,
  Math.min(Number(process.env.EMBED_BATCH_SIZE || 500), 2048),
);
const BATCH_CONCURRENCY = Math.max(
  1,
  Number(process.env.EMBED_BATCH_CONCURRENCY || 2),
);

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.OPENAI_MAX_SOCKETS || 20),
});

function apiKey() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY no definida en .env");
  return k;
}

function baseUrl() {
  // Permite sobreescribir para proxies/custom gateways.
  return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
}

async function embedOne(text) {
  const url = `${baseUrl()}/embeddings`;
  const response = await withRetry(
    () =>
      axios.post(
        url,
        { model: MODEL, input: text, dimensions: DIM },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey()}`,
          },
          httpsAgent,
          timeout: 30_000,
        },
      ),
    { label: "embeddings.openai", retries: 3 },
  );

  const values = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Respuesta sin embedding");
  }
  return values;
}

async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const url = `${baseUrl()}/embeddings`;

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
      const response = await withRetry(
        () =>
          axios.post(
            url,
            {
              model: MODEL,
              input: group.map((it) => it.text),
              dimensions: DIM,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey()}`,
              },
              httpsAgent,
              timeout: 60_000,
            },
          ),
        { label: "embeddings.openai.batch", retries: 3 },
      );

      const data = response.data?.data;
      if (!Array.isArray(data) || data.length !== group.length) {
        throw new Error(
          `OpenAI devolvio ${data?.length || 0} items (esperaba ${group.length})`,
        );
      }
      // OpenAI garantiza el orden por `index`. Nos fiamos pero validamos.
      return data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d, k) => ({
          originalIndex: group[k].i,
          values: d.embedding,
        }));
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

module.exports = { embedOne, embedBatch };
