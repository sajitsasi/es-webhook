/**
 * In-memory message store with a max size (ring-style: drop oldest when full).
 * Transport-agnostic; used by both HTTP server and (later) serverless adapters.
 */

const DEFAULT_MAX_MESSAGES = 500;

function getMaxMessages() {
  const n = parseInt(process.env.MAX_MESSAGES || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MESSAGES;
}

/** @type {Array<{ id: string, at: string, requestId?: string, body: unknown }>} */
let messages = [];
let maxMessages = getMaxMessages();

function getStore() {
  return messages;
}

function getMax() {
  return maxMessages;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Append a message to the store. Drops oldest if at capacity.
 * @param {object} payload - Parsed JSON body from webhook
 * @param {string} [requestId] - Optional X-Request-Id header
 * @param {string} [clientIp] - Optional client IP address
 * @returns {{ id: string, at: string, requestId?: string, clientIp?: string, body: unknown }}
 */
function appendMessage(payload, requestId, clientIp) {
  const at = new Date().toISOString();
  const id = generateId();
  const entry = { id, at, body: payload };
  if (requestId) entry.requestId = requestId;
  if (clientIp) entry.clientIp = clientIp;

  messages.push(entry);
  if (messages.length > maxMessages) {
    messages = messages.slice(-maxMessages);
  }
  return entry;
}

/**
 * Get all messages, or messages after a given timestamp (ISO string).
 * @param {string} [since] - ISO timestamp; return only messages with at > since
 * @returns {Array<{ id: string, at: string, requestId?: string, body: unknown }>}
 */
function getMessages(since) {
  if (!since) return [...messages];
  return messages.filter((m) => m.at > since);
}

/**
 * Reset store (for tests). Re-reads MAX_MESSAGES from env.
 */
function reset() {
  messages = [];
  maxMessages = getMaxMessages();
}

module.exports = {
  getStore,
  getMax,
  appendMessage,
  getMessages,
  reset,
};
