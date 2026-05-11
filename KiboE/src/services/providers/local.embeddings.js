// src/services/providers/local.embeddings.js
//
// Provider: embeddings locales con @xenova/transformers (ONNX Runtime).
// - Modelo por defecto: Xenova/multilingual-e5-base (768 dim, multilingue).
//   ESTA DIMENSION COINCIDE con `VECTOR(768)` en la DB, asi que no hay que
//   migrar el schema al cambiar desde Gemini.
// - Corre 100% offline despues de la primera descarga (~300 MB) del modelo.
// - Sin limites de cuota, sin red, sin costo.
// - E5 requiere prefijos "query: " / "passage: " segun sea busqueda o indexacion.
//
// Rendimiento esperado en M3 Pro: ~30-50 embeddings por segundo en batch.

const MODEL_NAME =
  process.env.LOCAL_EMBEDDINGS_MODEL || "Xenova/multilingual-e5-base";
const BATCH_SIZE = Math.max(1, Number(process.env.EMBED_BATCH_SIZE || 32));
const USE_QUANTIZED = String(process.env.LOCAL_QUANTIZED ?? "true").toLowerCase() !== "false";

let _pipelinePromise = null;

async function getPipeline() {
  if (_pipelinePromise) return _pipelinePromise;

  console.log(
    `[embeddings.local] Cargando modelo "${MODEL_NAME}" (quantized=${USE_QUANTIZED})...`,
  );
  const t0 = Date.now();

  _pipelinePromise = (async () => {
    // @xenova/transformers es ESM, se carga con import() dinamico.
    const { pipeline, env } = await import("@xenova/transformers");

    // Deshabilitamos telemetria y checks de red despues de la primera carga.
    env.allowRemoteModels = true;
    env.useBrowserCache = false;

    const extractor = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: USE_QUANTIZED,
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[embeddings.local] Modelo listo en ${elapsed}s (${MODEL_NAME})`,
    );
    return extractor;
  })();

  try {
    return await _pipelinePromise;
  } catch (err) {
    _pipelinePromise = null; // permitir reintento en la proxima llamada
    throw err;
  }
}

function addPrefix(text, role) {
  // Los modelos E5 fueron entrenados con estos prefijos. Omitirlos degrada
  // bastante la calidad. Los demas modelos (p. ej. paraphrase-*) los ignoran
  // como texto normal y no se afecta mucho.
  if (role === "query") return `query: ${text}`;
  return `passage: ${text}`;
}

async function embedOne(text, { role = "passage" } = {}) {
  if (!text || !text.trim()) throw new Error("Texto vacio para embedding");

  const extractor = await getPipeline();
  const output = await extractor([addPrefix(text, role)], {
    pooling: "mean",
    normalize: true,
  });

  const dim = output.dims[output.dims.length - 1];
  return Array.from(output.data.slice(0, dim));
}

async function embedBatch(texts, { role = "passage" } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const extractor = await getPipeline();

  const indexed = texts.map((t, i) => ({ i, text: (t || "").trim() }));
  const valid = indexed.filter((x) => x.text.length > 0);
  const invalid = indexed.filter((x) => x.text.length === 0);

  const out = new Array(texts.length).fill(null);
  for (const { i } of invalid) {
    out[i] = { ok: false, index: i, error: new Error("Texto vacio") };
  }

  // Procesamos en sub-batches para acotar memoria.
  for (let start = 0; start < valid.length; start += BATCH_SIZE) {
    const group = valid.slice(start, start + BATCH_SIZE);
    try {
      const inputs = group.map((g) => addPrefix(g.text, role));
      const output = await extractor(inputs, {
        pooling: "mean",
        normalize: true,
      });

      const dim = output.dims[output.dims.length - 1];
      const flat = output.data;
      for (let k = 0; k < group.length; k++) {
        const offset = k * dim;
        const vec = Array.from(flat.slice(offset, offset + dim));
        out[group[k].i] = { ok: true, value: vec };
      }
    } catch (err) {
      for (const item of group) {
        out[item.i] = { ok: false, index: item.i, error: err };
      }
    }
  }

  return out;
}

/**
 * Precarga el modelo para evitar que la primera peticion pague el costo de
 * descarga/carga. Se puede llamar desde src/index.js al arrancar el server.
 */
async function warmup() {
  await getPipeline();
}

module.exports = {
  embedOne,
  embedBatch,
  warmup,
};
