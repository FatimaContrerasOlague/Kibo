# Kibo Backend (Express)

Backend principal de Kibo con integracion hacia KiboE como motor del chatbot.

## Servicios

- Backend principal: `http://localhost:4000`
- KiboE (chatbot/logica IA): `http://localhost:3000`

## Requisitos

- Node.js 18+
- KiboE configurado con su `.env` y su base de datos PostgreSQL/Supabase

## Instalacion

```bash
npm install
```

## Ejecucion

Backend principal:

```bash
npm run start
```

Microservicio chatbot:

```bash
npm run chatbot
```

Ese comando ahora levanta KiboE desde `../../KiboE/src/index.js`.

Ambos servicios a la vez:

```bash
npm run start:all
```

## Endpoints principales

### Health

- `GET /api/health`
- `GET /api/chatbot/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

Body ejemplo:

```json
{
  "name": "Ana",
  "email": "ana@kibo.com",
  "password": "123456"
}
```

### Tasks

- `GET /api/tasks?userId=<id>`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/:id/reminders`

Body crear tarea:

```json
{
  "userId": "usr_xxx",
  "title": "Preparar examen",
  "description": "Repasar capitulo 3",
  "dueAt": "2026-05-20T18:00:00.000Z"
}
```

### Recomendaciones y biblioteca

- `GET /api/recommendations?taskTitle=react hooks&dueAt=2026-05-20T18:00:00.000Z`
- `GET /api/recommendations?taskId=<taskId>`
- `GET /api/books/search?q=productividad&limit=8`

### Notificaciones inteligentes

- `GET /api/notifications/:userId`

Devuelve alertas de 1 dia, 8h, 4h, 1h antes de la entrega con recomendacion de libro y mascot image.

### Chatbot (proxy desde backend principal)

- `POST /api/chatbot/chat`
- `POST /api/chatbot/files`
- `GET /api/chatbot/chat/:userId`

El frontend sigue hablando con estos endpoints de KiboB, pero KiboB traduce la solicitud al contrato de KiboE.

## Persistencia

- Backend principal: `data/db.json`

KiboB guarda localmente en `data/db.json`:

- usuarios y tareas
- archivos subidos
- mapeo `userId -> sessionId` del chat

KiboE guarda el historial real del chat y los recursos ingeridos en PostgreSQL/Supabase.

## Notas de integracion con KiboE

- `CHATBOT_SERVICE_URL` debe apuntar al servidor KiboE.
- La subida de archivos de KiboB usa `POST /ingest` de KiboE para convertir el texto en recurso consultable.
- El directorio `chatbot-service/` sigue en el repo como implementacion anterior, pero el flujo activo de la app ya no depende de el.
