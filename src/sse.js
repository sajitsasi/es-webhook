/**
 * Simple SSE broadcaster: maintain a set of response streams and push new messages to all.
 */

const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function broadcast(entry) {
  const data = JSON.stringify(entry);
  emitter.emit('message', data);
}

function subscribe(onMessage) {
  const handler = (data) => onMessage(data);
  emitter.on('message', handler);
  return () => emitter.off('message', handler);
}

module.exports = {
  broadcast,
  subscribe,
};
