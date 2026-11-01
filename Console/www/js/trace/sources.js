/* The one source interface: { id, can: { live, answer, prompt }, start(emit, status), stop() }.
   status() takes off | connecting | on | auth | unavailable. The page never knows more than this. */

export function hookSource({ host, port, code }) {
  const base = `http://${host}:${port}`;
  const headers = { 'content-type': 'application/json', 'x-trace-code': code };
  let es = null;
  const post = (route, body) => fetch(base + route, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json());
  const get = (route) => fetch(base + route, { headers }).then((r) => r.json());
  return {
    id: 'hooks',
    can: { live: true, answer: true, prompt: true },
    async start(emit, status) {
      status('connecting');
      let ping;
      try {
        ping = await fetch(base + '/ping', { headers });
      } catch {
        status('off');
        return;
      }
      if (ping.status === 401) { status('auth'); return; }
      es = new EventSource(`${base}/stream?code=${encodeURIComponent(code)}`);
      es.onopen = () => status('on');
      es.onerror = () => status('off');
      es.onmessage = (m) => {
        try { emit(JSON.parse(m.data)); } catch { /* a broken line is skipped */ }
      };
    },
    stop() { es?.close(); es = null; },
    answer: (callId, decision, note) => post('/answer', { callId, decision, note }),
    prompt: (sid, text) => post('/prompt', { sid, text }),
    sessions: () => get('/sessions'),
    load: (id) => get('/session?id=' + encodeURIComponent(id)).then((r) => r.text),
    retention: (keepDays) => post('/retention', { keepDays }),
  };
}

/* Managed Agents session events and traces arrive with Session 2. The slot is here so nothing else
   changes on that day. */
export const managedSource = () => ({
  id: 'managed',
  can: { live: true, answer: false, prompt: false },
  start(emit, status) { status('unavailable'); },
  stop() {},
});

export const replaySource = (events) => ({
  id: 'replay',
  can: { live: false, answer: false, prompt: false },
  start(emit, status) {
    status('off');
    events.forEach(emit);
  },
  stop() {},
});
