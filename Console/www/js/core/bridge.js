/* The ServiceKit PC bridge client: the same ws line protocol as ServiceKitPhone (skphone-bridge.js).
   Running anything needs a bridge started with --allow-run. The pairing token lives in memory
   only, so it can never end up in a data export. */
const b64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

export const runArg = (command, kind) => `kind:${kind === 'ps' ? 'ps' : 'cmd'};confirm:1;b64:${b64(command)}`;

export function createBridge(WS = globalThis.WebSocket) {
  const state = { status: 'off', pc: '', needAuth: false, allowRun: false, os: '', macros: [], job: null, pb: null, step: null, last: '' };
  const listeners = new Set();
  const pending = new Map();
  let ws = null;
  let rx = '';
  let seq = 0;
  let token = '';
  let batch = false;

  const emit = () => listeners.forEach((l) => l(state));
  const send = (line) => { if (ws?.readyState === 1) ws.send(line + '\n'); };
  const nextId = () => 'c' + (++seq);

  function onLine(line) {
    const p = line.split('|');
    const tag = p[0];
    if (tag === 'HELLO') {
      state.pc = p[1] || '';
      state.needAuth = p[3] === 'auth';
      if (state.needAuth) {
        if (token) { send('AUTH|' + token); state.status = 'connecting'; } else state.status = 'auth';
      } else {
        state.status = 'on';
        send('MACROS');
      }
    } else if (tag === 'AUTHOK') { state.status = 'on'; send('MACROS'); }
    else if (tag === 'AUTHFAIL') { state.status = 'auth'; state.last = 'authfail'; token = ''; }
    else if (tag === 'CAPS') { state.allowRun = p[1] === '1'; state.os = p[2] || ''; }
    else if (tag === 'JOB') { state.job = { computer: p[2] || '', step: p[3] || '' }; }
    else if (tag === 'PB') { state.pb = { title: p[1], done: +p[2] || 0, total: +p[3] || 0, running: p[4] === '1' }; }
    else if (tag === 'STEP') { state.step = { status: p[1], text: p[2] || '' }; }
    else if (tag === 'MAC') {
      if (!batch) { state.macros = []; batch = true; }
      state.macros.push({ id: p[1], label: p[2], danger: p[3] === '1', cat: p[4] || '' });
    } else if (tag === 'MACEND') { batch = false; }
    else if (tag === 'ACK') {
      const done = pending.get(p[1]);
      pending.delete(p[1]);
      done?.({ ok: p[2] === '1', detail: p[3] || '' });
    } else return;
    emit();
  }

  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    connect({ host, port, pairing = '' }) {
      if (ws) ws.close();
      token = pairing;
      state.status = 'connecting';
      state.last = '';
      emit();
      try {
        ws = new WS(`ws://${host}:${port}/`);
      } catch {
        state.status = 'off';
        emit();
        return;
      }
      const mine = ws;
      rx = '';
      ws.onmessage = (ev) => {
        rx += ev.data;
        for (let nl = rx.indexOf('\n'); nl >= 0; nl = rx.indexOf('\n')) {
          const line = rx.slice(0, nl).replace(/\r$/, '');
          rx = rx.slice(nl + 1);
          if (line) onLine(line);
        }
      };
      ws.onclose = () => {
        if (ws !== mine) return;
        ws = null;
        Object.assign(state, { status: 'off', allowRun: false, macros: [] });
        emit();
      };
    },
    disconnect() { ws?.close(); },
    /* resolves { ok, detail } when the PC answers */
    runCommand(command, kind) {
      const id = nextId();
      return new Promise((resolve) => {
        pending.set(id, resolve);
        send(`RUN|run|${runArg(command, kind)}|${id}`);
      });
    },
    runMacro(macroId, confirmed) {
      const id = nextId();
      return new Promise((resolve) => {
        pending.set(id, resolve);
        send(`MACRO|${macroId}|${confirmed ? 1 : 0}|${id}`);
      });
    },
  };
}
