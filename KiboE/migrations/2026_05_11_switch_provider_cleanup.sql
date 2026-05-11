-- migrations/2026_05_11_switch_provider_cleanup.sql
--
-- Limpieza opcional antes de cambiar de proveedor de embeddings.
-- Ejecutalo UNA VEZ en Supabase SQL Editor cuando cambies de Gemini a
-- OpenAI (o viceversa) y quieras empezar limpio.
--
-- NO corras esto si quieres conservar parte de los embeddings existentes.

BEGIN;

-- Opcion A (recomendada): borra TODO el contenido ingestado.
-- Mantiene la estructura de tablas pero elimina chunks, documents y resources.
-- Por el ON DELETE CASCADE de documents.resource_id y chunks.document_id,
-- basta con borrar resources para arrasar con todo lo dependiente.

DELETE FROM public.assignment_recommendations;  -- evita FK dangling
DELETE FROM public.summaries;                   -- idem
DELETE FROM public.chunks;                      -- por si hubo documents huerfanos
DELETE FROM public.documents;
DELETE FROM public.resources;

-- Opcion B (si solo quieres limpiar chunks): descomenta y comenta la anterior.
-- TRUNCATE TABLE public.chunks RESTART IDENTITY CASCADE;

COMMIT;
