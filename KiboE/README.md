# Hacka2026 Backend

Backend Node.js/Express para un tutor virtual educativo con busqueda semantica sobre recursos publicos.

## Requisitos

- Node.js 20 o superior
- npm
- Proyecto de Supabase con Postgres
- Extension `vector` habilitada en Supabase
- API key de Google Gemini

## Instalacion

```bash
npm install
cp .env.example .env
```

Rellena `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://...
DATABASE_SSL=true
EMBEDDINGS_API_KEY=...
EMBEDDINGS_MODEL=gemini-embedding-001
EMBEDDINGS_DIM=768
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
API_PROVIDER=google
```

Para Supabase local/desarrollo en varias computadoras se recomienda usar **Session Pooler**, porque Direct Connection puede depender de IPv6.

## Base de Datos

Ejecuta el contenido de `database.example.sql` en el SQL Editor de Supabase.

Tablas principales:

- `resources`: recursos educativos publicos, PDFs, paginas, libros, videos.
- `documents`: texto completo extraido de cada recurso.
- `chunks`: fragmentos vectorizados con `VECTOR(768)`.
- `assignments`: tareas analizadas por el tutor.
- `assignment_recommendations`: recomendaciones por tarea.
- `chat_sessions` y `chat_messages`: historial de chat.
- `summaries`: resumenes generados.
- `quizzes` y `quiz_questions`: quizzes generados.

## Correr el Servidor

```bash
npm start
```

Servidor:

```text
http://localhost:3000
```

## Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

Respuesta esperada de DB:

```json
{
  "ok": true,
  "database": "postgres",
  "now": "..."
}
```

## Endpoints

### Ingestar Recurso

Texto manual:

```bash
curl -X POST http://localhost:3000/resources/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Prueba de algebra",
    "subject": "Matematicas",
    "gradeLevel": "Secundaria",
    "resourceType": "other",
    "text": "La factorizacion consiste en escribir una expresion algebraica como producto de factores."
  }'
```

URL publica:

```bash
curl -X POST http://localhost:3000/resources/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/recurso-educativo"
  }'
```

PDF por URL:

```bash
curl -X POST http://localhost:3000/resources/ingest/pdf-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://sitio.com/libro.pdf",
    "title": "Libro de Matematicas",
    "subject": "Matematicas",
    "gradeLevel": "Secundaria",
    "sourceName": "Biblioteca publica",
    "force": false
  }'
```

El backend descarga el PDF, extrae texto, guarda el recurso como `pdf`, divide el contenido por pagina y guarda `page_number` en `chunks`.
Tambien guarda metadata del PDF:

```json
{
  "pageCount": 10,
  "extractedTextLength": 25000,
  "needsOcr": false,
  "lowTextPages": []
}
```

Si el PDF ya fue ingestado y `force` es `false`, el endpoint no duplica datos y responde con `alreadyExists: true`.

Varios PDFs por URL:

```bash
curl -X POST http://localhost:3000/resources/ingest/pdf-url/batch \
  -H "Content-Type: application/json" \
  -d '{
    "force": false,
    "pdfs": [
      {
        "url": "https://sitio.com/libro-1.pdf",
        "title": "Libro 1",
        "subject": "Matematicas",
        "gradeLevel": "Secundaria"
      },
      {
        "url": "https://sitio.com/libro-2.pdf",
        "title": "Libro 2",
        "subject": "Ciencias",
        "gradeLevel": "Secundaria"
      }
    ]
  }'
```

Alias heredado:

```text
POST /ingest
POST /ingest/batch
```

### Listar Recursos

```bash
curl http://localhost:3000/resources
```

Detalle de un recurso:

```bash
curl http://localhost:3000/resources/3
```

Chunks de un recurso:

```bash
curl http://localhost:3000/resources/3/chunks
```

### Chat Tutor

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Que es la factorizacion?"
  }'
```

### Analizar Tarea

Crear tarea manualmente, sin IA:

```bash
curl -X POST http://localhost:3000/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarea de algebra",
    "gradeLevel": "Secundaria",
    "prompt": "Resolver ejercicios de factorizacion por diferencia de cuadrados."
  }'
```

Listar tareas:

```bash
curl http://localhost:3000/assignments
```

Cuando haya usuarios, filtrar por usuario:

```bash
curl "http://localhost:3000/assignments?userId=USER_UUID"
```

Analizar una tarea nueva:

```bash
curl -X POST http://localhost:3000/assignments/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarea de algebra",
    "gradeLevel": "Secundaria",
    "prompt": "Resolver ejercicios de factorizacion por diferencia de cuadrados."
  }'
```

Generar recomendaciones para una tarea existente:

```bash
curl -X POST http://localhost:3000/assignments/1/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 5,
    "maxScore": 0.5
  }'
```

Analizar una tarea ya creada:

```bash
curl -X POST http://localhost:3000/assignments/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": 1
  }'
```

### Resumir Texto

```bash
curl -X POST http://localhost:3000/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "summaryType": "study_guide",
    "text": "Texto educativo largo para resumir..."
  }'
```

### Generar Quiz

```bash
curl -X POST http://localhost:3000/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Matematicas",
    "topic": "Factorizacion",
    "questionCount": 3,
    "text": "La factorizacion consiste en escribir una expresion como producto de factores."
  }'
```

## Notas de Desarrollo

- No subir `.env` a GitHub.
- El frontend React debe llamar al backend por HTTP; nunca debe usar `DATABASE_URL`.
- `chunks.embedding` usa 768 dimensiones porque el backend usa `gemini-embedding-001` con `EMBEDDINGS_DIM=768`.
- La ingesta de PDF por URL funciona con PDFs que contienen texto. PDFs escaneados como imagen requieren OCR y no estan cubiertos todavia.
