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
| `LOG_DIR` | If set, each webhook request is appended as one JSON line to `<LOG_DIR>/webhook.log`. Leave unset to disable file logging. Default in Docker: `/app/logs`. |

### Request logging and volume mount

To persist request logs on the host, mount a directory into the container’s log path:

```bash
docker run -p 3000:3000 -v /path/on/host/logs:/app/logs es-webhook
```

Example on Linux/macOS with a local `./logs` folder:

```bash
mkdir -p ./logs
docker run -p 3000:3000 -v "$(pwd)/logs:/app/logs" es-webhook
```

Each webhook request is written as one JSON line to `webhook.log` (e.g. `./logs/webhook.log`). To use a different directory inside the container, set `LOG_DIR`:

```bash
docker run -p 3000:3000 -v "$(pwd)/logs:/mnt/webhook-logs" -e LOG_DIR=/mnt/webhook-logs es-webhook
```

**If no data appears in the log file:** The container runs as a non-root user. Ensure the mounted directory is writable, e.g. `chmod 777 ./logs` before running, or run with your user: `docker run ... --user $(id -u):$(id -g) -e LOG_DIR=/app/logs -v "$(pwd)/logs:/app/logs" es-webhook`. Check container output for "Request log write failed" or "Request log mkdir failed".

## Endpoints

- **POST /webhook** — Receive Elastic action payload (JSON). Optional auth via `WEBHOOK_SECRET`.
- **GET /events** — Server-Sent Events stream of new messages. Optional auth via `READ_TOKEN`.
- **GET /messages** — JSON list of messages. Optional `?since=<ISO timestamp>` for polling. Optional auth via `READ_TOKEN`.
- **GET /health** — Health check (no auth).
- **GET /** — Dashboard UI.

## Setting up the webhook in Kibana

Use Kibana’s **Rules and Connectors** so that when a rule fires (e.g. alerting rule, log threshold), it calls your webhook.

### 1. Create a Webhook connector

1. In Kibana go to **Stack Management** → **Connectors** (under “Kibana”).
2. Click **Create connector**.
3. Choose **Webhook**.
4. Set:
   - **Name:** e.g. `ES Webhook`
   - **URL:** Your webhook base URL + `/webhook`, e.g. `https://your-server.example.com/webhook` (or `http://host.docker.internal:3000/webhook` if Kibana runs in Docker on the same host).
   - **Method:** `POST`
5. **Authentication (optional):** If you set `WEBHOOK_SECRET` on the server, either:
   - **Custom headers:** add `X-Webhook-Secret` = your secret, or  
   - **Authentication:** Basic — use any username and set the password to your `WEBHOOK_SECRET`
6. **Body (required for payload content):** If you leave this empty, the dashboard will show empty `{}` messages. Set it to JSON with [Mustache variables](https://www.elastic.co/guide/en/kibana/current/rule-action-variables.html), for example:

   ```json
   {
     "rule": "{{rule.name}}",
     "ruleId": "{{rule.id}}",
     "date": "{{date}}",
     "alerts": {{alerts.all.data}}
   }
   ```

7. Click **Save**.

### 2. Use the connector in a rule

1. Go to **Stack Management** → **Rules** (or **Alerts** → **Rules**).
2. Create or edit a rule (e.g. “Logs threshold”, “Metric threshold”, “Elasticsearch query”).
3. In **Actions**, add an action and select the connector you created (e.g. `ES Webhook`).
4. Save the rule.

When the rule runs and triggers, Kibana will POST the body to your `/webhook` URL and you’ll see the payload in the dashboard.

### Reachability and security

- **Kibana must be able to reach the webhook URL.** If the webhook runs on your laptop, use a URL Kibana can resolve (e.g. your machine’s IP or a tunnel like ngrok). For Elastic Cloud, the URL must be publicly reachable or in a connected VPC.
- **Allowed hosts:** On self-managed Kibana, if you see an error about the host not being allowed, add it in `kibana.yml`:  
  `xpack.actions.allowedHosts: ['your-webhook-host.example.com', '*.ngrok.io']`
- **HTTPS:** In production, use `https://` and set `WEBHOOK_SECRET` (and optionally `READ_TOKEN`) so only Kibana and you can access the service.