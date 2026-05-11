# Kibo Backend (Express)

Backend principal y microservicio de chatbot para la plataforma Kibo.

## Servicios

- Backend principal: `http://localhost:4000`
- Microservicio chatbot: `http://localhost:4100`

## Requisitos

- Node.js 18+

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

## Persistencia

- Backend principal: `data/db.json`
- Chatbot service: `chatbot-service/data/chatbot-db.json`

No requiere Postgres para desarrollo rapido.
