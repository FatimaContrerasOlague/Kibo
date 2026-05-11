-- migrations/2026_05_11_batch1.sql
--
-- Batch 1 de mejoras. Ejecutar en el SQL Editor de Supabase/Postgres.
-- El script es idempotente: se puede correr dos veces sin efectos adversos.

BEGIN;

-- ─── 1) Deduplicar recursos con la misma URL ───────────────────────────────
-- Antes de crear el UNIQUE, nos quedamos con el resource mas antiguo por URL
-- y reasignamos sus documents a ese id, eliminando los duplicados.

-- Solo procesa filas con url no nula ni vacia (las ingestas manuales pueden
-- generar url sinteticas tipo "manual_ingestion_<timestamp>"; cada una es
-- unica, asi que no chocan).
WITH ranked AS (
  SELECT
    id,
    url,
    ROW_NUMBER() OVER (PARTITION BY url ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY url ORDER BY created_at ASC, id ASC) AS keeper_id
  FROM public.resources
  WHERE url IS NOT NULL AND url <> ''
),
reassign AS (
  UPDATE public.documents d
  SET resource_id = r.keeper_id
  FROM ranked r
  WHERE d.resource_id = r.id
    AND r.rn > 1
  RETURNING d.id
)
DELETE FROM public.resources
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 2) UNIQUE en resources.url ────────────────────────────────────────────
-- Postgres permite multiples NULL en columnas UNIQUE por default,
-- asi que esto no afecta a ingestas manuales sin URL externa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'resources_url_key'
      AND conrelid = 'public.resources'::regclass
  ) THEN
    ALTER TABLE public.resources
      ADD CONSTRAINT resources_url_key UNIQUE (url);
  END IF;
END $$;

-- ─── 3) ON DELETE CASCADE en documents.resource_id ─────────────────────────
-- Actualmente es SET NULL, lo que deja documentos huerfanos al borrar
-- un recurso. Con CASCADE, borrar un recurso borra sus documentos (y por
-- la FK de chunks a documents, tambien sus chunks).
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_resource_id_fkey;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_resource_id_fkey
  FOREIGN KEY (resource_id)
  REFERENCES public.resources(id)
  ON DELETE CASCADE;

-- ─── 4) Indice para borrado masivo en assignment_recommendations ──────────
CREATE INDEX IF NOT EXISTS assignment_recommendations_assignment_id_idx
  ON public.assignment_recommendations (assignment_id);

-- ─── 5) Indices utiles adicionales ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS resources_resource_type_idx
  ON public.resources (resource_type);

CREATE INDEX IF NOT EXISTS assignments_status_idx
  ON public.assignments (status);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx
  ON public.chat_messages (session_id);

COMMIT;
