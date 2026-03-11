(function () {
  const listEl = document.getElementById('message-list');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const btnClear = document.getElementById('btn-clear');
  const usePollingCb = document.getElementById('use-polling');

  let eventSource = null;
  let pollTimer = null;
  let lastSince = null;

  function setStatus(className, text) {
    statusDot.className = 'dot ' + (className || '');
    statusText.textContent = text;
  }

  function renderMessage(entry) {
    const li = document.createElement('li');
    li.className = 'message-card';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<time datetime="${entry.at}">${entry.at}</time>${entry.requestId ? ` · <span>Request-ID: ${escapeHtml(entry.requestId)}</span>` : ''}`;
    const body = document.createElement('pre');
    body.className = 'body' + (entry.body === undefined || entry.body === null || (typeof entry.body === 'object' && Object.keys(entry.body).length === 0) ? ' empty' : '');
    body.textContent = typeof entry.body === 'object'
      ? JSON.stringify(entry.body, null, 2)
      : String(entry.body ?? '(empty)');
    li.appendChild(meta);
    li.appendChild(body);
    listEl.insertBefore(li, listEl.firstChild);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    const url = '/events';
    eventSource = new EventSource(url);
    eventSource.onopen = () => setStatus('connected', 'Live (SSE)');
    eventSource.onerror = () => setStatus('error', 'SSE disconnected');
    eventSource.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        renderMessage(entry);
      } catch (_) {
        setStatus('error', 'Invalid message');
      }
    };
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function poll() {
    const url = lastSince ? `/messages?since=${encodeURIComponent(lastSince)}` : '/messages';
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data) => {
        setStatus('connected', 'Live (polling)');
        const messages = data.messages || [];
        messages.forEach((m) => renderMessage(m));
        if (messages.length > 0) {
          const latest = messages[messages.length - 1];
          lastSince = latest.at;
        }
      })
      .catch(() => setStatus('error', 'Polling failed'));
  }

  function startPolling() {
    stopPolling();
    poll();
    pollTimer = setInterval(poll, 3000);
  }

  function useSSE() {
    stopPolling();
    connectSSE();
  }

  usePollingCb.addEventListener('change', function () {
    if (this.checked) {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      startPolling();
    } else {
      stopPolling();
      connectSSE();
    }
  });

  btnClear.addEventListener('click', () => {
    listEl.innerHTML = '';
  });

  if (usePollingCb.checked) {
    startPolling();
  } else {
    connectSSE();
  }
})();
