/**
 * Webhook and read auth validation (transport-agnostic).
 * Uses env: WEBHOOK_SECRET, READ_TOKEN (optional).
 */

function getWebhookSecret() {
  return process.env.WEBHOOK_SECRET || '';
}

function getReadToken() {
  return process.env.READ_TOKEN || '';
}

/**
 * Validate webhook caller auth.
 * Supports: Authorization: Bearer <secret>, X-Webhook-Secret: <secret>, or Basic (user:password = webhook_secret:webhook_secret or any user when secret is empty).
 * @param {object} headers - Map of header names (lowercase) to values
 * @param {string} [authHeader] - Raw Authorization header if provided
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWebhookAuth(headers = {}) {
  const secret = getWebhookSecret();
  if (!secret) {
    return { valid: true };
  }

  const auth = headers['authorization'] || '';
  const webhookSecret = headers['x-webhook-secret'];

  if (webhookSecret && webhookSecret === secret) {
    return { valid: true };
  }
  if (auth.startsWith('Bearer ') && auth.slice(7) === secret) {
    return { valid: true };
  }
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const [, password] = decoded.split(':');
      if (password === secret) return { valid: true };
    } catch (_) {
      // ignore
    }
  }

  return { valid: false, error: 'Unauthorized' };
}

/**
 * Validate read access for GET /events and GET /messages.
 * Supports: query token= or Authorization: Bearer <token>. If READ_TOKEN is not set, allow.
 * @param {object} headers - Map of header names (lowercase) to values
 * @param {string} [queryToken] - token query parameter
 * @returns {{ valid: boolean, error?: string }}
 */
function validateReadAuth(headers = {}, queryToken) {
  const token = getReadToken();
  if (!token) {
    return { valid: true };
  }

  const auth = headers['authorization'] || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (queryToken === token || bearer === token) {
    return { valid: true };
  }
  return { valid: false, error: 'Unauthorized' };
}

module.exports = {
  getWebhookSecret,
  getReadToken,
  validateWebhookAuth,
  validateReadAuth,
};
