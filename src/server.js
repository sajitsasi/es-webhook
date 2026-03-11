/**
 * HTTP server for ES webhook: Docker deployment.
 * POST /webhook, GET /events (SSE), GET /messages, GET /health, static frontend.
 */

const express = require('express');
const path = require('path');
const { validateWebhookAuth, validateReadAuth, appendMessage, getMessages } = require('./core');
const { broadcast, subscribe } = require('./sse');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse JSON body for webhook (allow any size within reason)
app.use(express.json({ limit: '1mb' }));

function headersToMap(req) {
  const map = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) map[k.toLowerCase()] = v;
  }
  return map;
}

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Webhook: accept Elastic POST
app.post('/webhook', (req, res) => {
  const headers = headersToMap(req);
  const auth = validateWebhookAuth(headers);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  const body = req.body !== undefined && req.body !== null ? req.body : {};
  const requestId = req.headers['x-request-id'];
  const entry = appendMessage(body, requestId);
  broadcast(entry);

  res.status(200).json({ ok: true, id: entry.id });
});

// SSE stream of new messages (optional read auth)
app.get('/events', (req, res) => {
  const headers = headersToMap(req);
  const queryToken = req.query.token;
  const auth = validateReadAuth(headers, queryToken);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const unsubscribe = subscribe((data) => {
    try {
      res.write(`data: ${data}\n\n`);
      res.flush?.();
    } catch (_) {
      unsubscribe();
    }
  });

  req.on('close', () => unsubscribe());
});

// Polling: list messages, optional ?since= (ISO timestamp)
app.get('/messages', (req, res) => {
  const headers = headersToMap(req);
  const queryToken = req.query.token;
  const auth = validateReadAuth(headers, queryToken);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  const list = getMessages(since);
  res.json({ messages: list });
});

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ES Webhook server listening on port ${PORT}`);
});
