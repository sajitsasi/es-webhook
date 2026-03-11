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

## Deploying to another VM

**Option A — Move the code and rebuild**

Copy the project to the other machine (git, scp, or rsync), then build and run there:

```bash
# From your current machine: push to git (if you use a repo)
git init && git add . && git commit -m "ES webhook service"
git remote add origin <your-repo-url>
git push -u origin main

# On the other VM: clone and run
git clone <your-repo-url> es-webhook && cd es-webhook
docker build -t es-webhook .
docker run -d -p 3000:3000 --name es-webhook es-webhook
```

Without git, copy the folder and rebuild:

```bash
# From current machine (replace user@host and /path/to/dest)
rsync -avz --exclude node_modules --exclude .git . user@host:/path/to/dest/es-webhook
# Or: scp -r . user@host:/path/to/dest/es-webhook

# On the other VM
cd /path/to/dest/es-webhook
docker build -t es-webhook .
docker run -d -p 3000:3000 --name es-webhook es-webhook
```

**Option B — Move the built image (no rebuild)**

Save the image to a file, copy it to the other VM, then load and run:

```bash
# On the machine where you built the image
docker save es-webhook -o es-webhook.tar
# Copy es-webhook.tar to the other VM (scp, rsync, USB, etc.)
scp es-webhook.tar user@other-vm:/tmp/

# On the other VM
docker load -i /tmp/es-webhook.tar
docker run -d -p 3000:3000 --name es-webhook es-webhook
```

**Option C — Use a container registry**

Push from the build machine, pull on the other VM (works well for CI/CD or multiple hosts):

```bash
# Build and tag for your registry (example: Docker Hub)
docker build -t yourusername/es-webhook:latest .
docker push yourusername/es-webhook:latest

# On any other VM (Docker Hub)
docker pull yourusername/es-webhook:latest
docker run -d -p 3000:3000 --name es-webhook yourusername/es-webhook:latest
```

For AWS ECR, Google GCR, or Azure ACR, tag with the registry URL and push/pull the same way.

---

## Kibana connector

1. Stack Management → Connectors → Create connector → Webhook.
2. URL: `https://your-server/webhook`, Method: POST.
3. To use auth: add header `X-Webhook-Secret: <your WEBHOOK_SECRET>` or use Basic auth.
4. Body: JSON with Mustache, e.g. `{"rule":"{{rule.name}}","alerts":{{alerts.all.data}}}`.

## License

MIT
