/**
 * Core webhook logic: auth validation and message store.
 * No HTTP/transport dependencies so it can be reused by Docker server and serverless adapters.
 */

const { validateWebhookAuth, validateReadAuth } = require('./auth');
const { appendMessage, getMessages } = require('./store');

module.exports = {
  validateWebhookAuth,
  validateReadAuth,
  appendMessage,
  getMessages,
};
