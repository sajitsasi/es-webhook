# ES Webhook Service

Elasticsearch webhook receiver that runs in Docker (or as a serverless function later). Accepts HTTP POSTs from Kibana Rules / Connectors or Elasticsearch Watcher, optionally validates auth, and displays messages in a real-time dashboard.

## Quick start (Docker)

```bash
docker build -t es-webhook .
docker run -p 3000:3000 es-webhook
```

Open http://localhost:3000 to see the dashboard. Send a test webhook:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"rule":"test","message":"hello"}'
```

## Quick start (local Node)

```bash
npm install
npm start
```

## Configuration (env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `WEBHOOK_SECRET` | Optional. If set, POST /webhook must send this as `Authorization: Bearer <secret>` or `X-Webhook-Secret: <secret>`, or Basic auth password. |
| `READ_TOKEN` | Optional. If set, GET /events and GET /messages require `?token=<token>` or `Authorization: Bearer <token>`. |
| `MAX_MESSAGES` | Max messages kept in memory (default `500`). |

## Endpoints

- **POST /webhook** — Receive Elastic action payload (JSON). Optional auth via `WEBHOOK_SECRET`.
- **GET /events** — Server-Sent Events stream of new messages. Optional auth via `READ_TOKEN`.
- **GET /messages** — JSON list of messages. Optional `?since=<ISO timestamp>` for polling. Optional auth via `READ_TOKEN`.
- **GET /health** — Health check (no auth).
- **GET /** — Dashboard UI.