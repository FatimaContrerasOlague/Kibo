-- migrations/2026_05_11_users_tasks.sql
-- Crea las tablas users y tasks requeridas por el frontend (auth + calendario).
-- Ejecuta UNA VEZ en Supabase SQL Editor.

BEGIN;

-- Extension pgcrypto para gen_random_uuid si aun no esta (Supabase normalmente la tiene)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── USERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (LOWER(email));

-- ─── TASKS ─────────────────────────────────────────────────────────────────
-- Tareas/agenda del usuario (distinto de "assignments" que es el analisis
-- pedagogico). Lo que aparece en el calendario del frontend.
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON public.tasks (due_at);
CREATE INDEX IF NOT EXISTS tasks_user_pending_idx
  ON public.tasks (user_id, completed, due_at);

COMMIT;
