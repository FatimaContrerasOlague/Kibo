// scripts/smoke-local-embeddings.js
// Prueba real de carga y generacion del modelo local.

(async () => {
  process.env.EMBEDDINGS_PROVIDER = "local";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test";

  const {
    getEmbedding,
    getEmbeddingsBatch,
    warmup,
  } = require("../src/services/embeddings");

  console.log("[smoke] Warmup (primera vez descarga ~300MB)...");
  const t0 = Date.now();
  await warmup();
  console.log("[smoke] Warmup:", ((Date.now() - t0) / 1000).toFixed(1), "s");

  const t1 = Date.now();
  const v = await getEmbedding("Hola mundo, prueba", { role: "query" });
  console.log(
    "[smoke] 1 texto:",
    ((Date.now() - t1) / 1000).toFixed(2),
    "s, dim =",
    v.length,
  );

  const textos = [
    "La factorizacion es escribir una expresion como producto de factores.",
    "El teorema de Pitagoras relaciona los lados de un triangulo rectangulo.",
    "La fotosintesis ocurre en los cloroplastos de las plantas.",
    "La independencia de Mexico fue en 1821.",
    "El agua es H2O.",
  ];
  const t2 = Date.now();
  const batch = await getEmbeddingsBatch(textos);
  console.log(
    "[smoke] Batch de",
    textos.length,
    "textos:",
    ((Date.now() - t2) / 1000).toFixed(2),
    "s",
  );
  console.log("[smoke] Todos ok:", batch.every((r) => r.ok));
  console.log("[smoke] Dim del primer vector:", batch[0].value.length);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
