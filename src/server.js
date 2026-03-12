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

// Trust proxy so req.ip is correct when behind a load balancer or reverse proxy
app.set('trust proxy', true);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return normalizeIp(ip);
  }
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return ip ? normalizeIp(ip) : '(unknown)';
}

function normalizeIp(ip) {
  if (typeof ip !== 'string') return ip;
  return ip.replace(/^::ffff:/i, '');
}

function headersToMap(req) {
  const map = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) map[k.toLowerCase()] = v;
  }
  return map;
}

// Webhook: accept Elastic POST — capture raw body so we get data even when Content-Type is wrong or body is empty
app.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  const headers = headersToMap(req);
  const auth = validateWebhookAuth(headers);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  let body;
  const raw = req.body && req.body.length ? req.body.toString('utf8') : '';
  if (!raw.trim()) {
    body = {
              _hint: 'Empty body. In Kibana: edit your Webhook connector and set the Body field to a JSON template, e.g. {"rule":"{{rule.name}}","date":"{{date}}","alerts":{{alerts.all.data}}}',
            };
  } else {
    try {
      body = JSON.parse(raw);
    } catch (e) {
      // Unquoted Mustache placeholders (e.g. {{alerts.all.data}}) are invalid JSON; replace with null and retry
      const withPlaceholdersReplaced = raw.replace(/:\s*\{\{[^}]*\}\}/g, ': null');
      try {
        body = JSON.parse(withPlaceholdersReplaced);
        body._templateHint = 'Some values were not substituted (null). When Kibana runs the rule, real data will appear.';
      } catch (e2) {
        body = { _raw: raw.slice(0, 2000), _parseError: 'Body is not valid JSON' };
      }
    }
  }
  const requestId = req.headers['x-request-id'];
  const clientIp = getClientIp(req);
  const entry = appendMessage(body, requestId, clientIp);
  broadcast(entry);

  res.status(200).json({ ok: true, id: entry.id });
});

// Parse JSON for any other future POST routes
app.use(express.json({ limit: '1mb' }));

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
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

const server = app.listen(PORT, () => {
  console.log(`ES Webhook server listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing server…`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit if connections (e.g. SSE) keep the server open
  setTimeout(() => {
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
