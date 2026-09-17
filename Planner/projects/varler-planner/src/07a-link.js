// ==========================================================================
// 07a-link.js — phone ⟷ planner transport and protocol
//
// WHERE: src/07a-link.js. Sorts after 07-plane-editor.js and before
// 07b-phone-camera.js, so the link exists before any consumer touches it.
// build.js accepts NNx names; no renumbering.
//
// WHAT THIS OWNS
//   the socket · the message envelope · the hello handshake and capability
//   negotiation · reconnect · throttled state broadcast · command routing
//
// WHAT THIS DOES NOT OWN
//   what any command means. Consumers register handlers; this module only
//   delivers. 07b-phone-camera.js is one such consumer.
//
// ── ONE-WAY IS THE FLOOR, NOT A SEPARATE MODE ───────────────────────────
// Both sides announce what they can do in `hello`. A phone that never sends
// hello is assumed to be a legacy one-way client: it can send orientation
// and gestures, and it receives nothing. Everything still works. A phone
// that announces `state` gets the reactive tool pad. There is one wire
// format and one code path — the fallback is the absence of capabilities,
// not a second protocol.
//
// ── ECHO ────────────────────────────────────────────────────────────────
// The relay rebroadcasts to all other clients. Once the planner also sends,
// a second phone or a stale tab can loop messages. Every envelope carries
// `from`, and a client ignores anything bearing its own role.
//
// Single top-level name: PLANNER_LINK.
//   findstr /s /c:"const PLANNER_LINK" src\*.js     → this file only
// ==========================================================================

const PLANNER_LINK = (function () {
  'use strict';

  const PROTO = 1;
  const ROLE = 'planner';
  const CAPS = ['state', 'cmd', 'keys', 'orientation', 'gesture'];   // 'prefab' arrives in 2.0-d

  const STATE_HZ = 10;                 // ceiling; only sent when something changed
  const STATE_MIN_MS = 1000 / STATE_HZ;
  const RETRY_MS = 2000;

  let ws = null, url = null, retry = null;
  let seq = 0, connected = false;
  let peer = null;                     // { role, app, caps:[] } once hello arrives

  // Traffic counters. Cheap, and they answer the one question that is
  // otherwise unanswerable from the outside: "is anything arriving at all?"
  // A dead phone button and a dead socket look identical without this.
  const stats = { in: 0, out: 0, lastIn: null, lastInAt: 0, lastOut: null, lastOutAt: 0, bad: 0 };

  const handlers = Object.create(null); // type    -> [fn]
  const commands = Object.create(null); // cmd id  -> fn(payload)
  const listeners = [];                 // status observers

  /* ---- envelope -------------------------------------------------------- */

  function envelope(type, payload) {
    return { v: PROTO, from: ROLE, seq: ++seq, t: Date.now(), type: type, payload: payload || {} };
  }

  function send(type, payload) {
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(JSON.stringify(envelope(type, payload)));
      stats.out++; stats.lastOut = type; stats.lastOutAt = Date.now();
      return true;
    } catch (e) { return false; }
  }

  /* ---- what the phone is told about this planner ----------------------- */

  // Sent once, in hello. Lets the phone build its tool pad from what this
  // build actually has rather than from a list hardcoded in the page.
  // TOOLKEYS and HINTS both live in 08-interaction.js, which parses after
  // this module — but this only runs at connect time, long after boot.
  function toolTable() {
    const out = [];
    try {
      const keys = (typeof TOOLKEYS !== 'undefined' && TOOLKEYS) ? TOOLKEYS : [];
      const hints = (typeof HINTS !== 'undefined' && HINTS) ? HINTS : {};
      const seen = Object.create(null);

      keys.forEach(function (mode, i) {
        seen[mode] = true;
        out.push({ mode: mode, key: i < 9 ? String(i + 1) : null, hint: hints[mode] || '' });
      });
      // modes that exist but have no number key — path, measure, note today
      Object.keys(hints).forEach(function (mode) {
        if (!seen[mode]) out.push({ mode: mode, key: null, hint: hints[mode] || '' });
      });
    } catch (e) { }
    return out;
  }

  /* ---- state snapshot -------------------------------------------------- */

  let lastSnapshotJson = '', stateTimer = null, lastStateAt = 0;

  function snapshot() {
    const s = (typeof state !== 'undefined' && state) ? state : {};
    return {
      mode: s.mode || null,
      level: s.active != null ? s.active : null,
      freeHeight: s.freeHeight != null ? s.freeHeight : null,
      pathType: s.pathType != null ? s.pathType : null,
      cableType: s.cableType != null ? s.cableType : null,
      side: s.side != null ? s.side : null,
      flat: !!s.flat,
      lockTouch: !!s.lockTouch
    };
  }

  // Coalesced and rate-limited. The phone's copy is a readout only — a
  // dropped state message must never corrupt anything, which is why this is
  // allowed to skip frames freely.
  function pushState(force) {
    if (!connected) return;
    if (!force && !peerWants('state')) return;

    const json = JSON.stringify(snapshot());
    if (!force && json === lastSnapshotJson) return;

    const wait = Math.max(0, STATE_MIN_MS - (Date.now() - lastStateAt));
    clearTimeout(stateTimer);
    stateTimer = setTimeout(function () {
      const now = JSON.stringify(snapshot());
      lastSnapshotJson = now;
      lastStateAt = Date.now();
      send('state', JSON.parse(now));
    }, wait);
  }

  function peerWants(cap) {
    return !!(peer && peer.caps && peer.caps.indexOf(cap) >= 0);
  }

  /* ---- incoming -------------------------------------------------------- */

  function onMessage(raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { stats.bad++; return; }
    if (!m || typeof m !== 'object') { stats.bad++; return; }
    stats.in++; stats.lastIn = m.type || '?'; stats.lastInAt = Date.now();

    // legacy one-way clients send bare messages with no envelope
    if (m.from == null && m.type) m = { v: 0, from: 'phone', type: m.type, payload: m, legacy: true };
    if (m.from === ROLE) return;                        // our own echo

    if (m.type === 'hello') {
      peer = {
        role: m.payload && m.payload.role || 'phone',
        app: m.payload && m.payload.app || '?',
        caps: (m.payload && m.payload.caps) || []
      };
      notify();
      if (peerWants('state')) pushState(true);          // full snapshot on arrival
      return;
    }

    if (m.type === 'state.request') { pushState(true); return; }

    if (m.type === 'cmd') { runCommand(m.payload); return; }

    if (m.type === 'keys') { synthKey(m.payload); return; }

    emit(m.type, m.payload, m);
  }

  // The escape hatch: anything with no semantic command yet arrives as a
  // keystroke and goes through the app's real handlers, editor-first.
  function synthKey(p) {
    if (!p || !p.key) return;
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: p.key,
      ctrlKey: !!p.ctrl, shiftKey: !!p.shift, altKey: !!p.alt,
      bubbles: true, cancelable: true
    }));
    pushState(false);
  }

  function runCommand(p) {
    if (!p || !p.id) return;
    const fn = commands[p.id];
    if (!fn) { send('ack', { id: p.id, ok: false, reason: 'unknown command' }); return; }
    let ok = true, reason = null;
    try { ok = fn(p) !== false; } catch (e) { ok = false; reason = e.message; }
    send('ack', { id: p.id, ok: ok, reason: reason });
    pushState(false);
  }

  function emit(type, payload, full) {
    const list = handlers[type];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](payload, full); } catch (e) { }
    }
  }

  /* ---- connection ------------------------------------------------------ */

  function status() {
    return { connected: connected, url: url, peer: peer };
  }

  function notify() {
    for (let i = 0; i < listeners.length; i++) {
      try { listeners[i](status()); } catch (e) { }
    }
  }

  function connect(u) {
    if (!u) return false;
    url = u;
    disconnect(true);
    try { ws = new WebSocket(url); }
    catch (e) { connected = false; notify(); return false; }

    ws.onopen = function () {
      connected = true;
      notify();
      send('hello', {
        role: ROLE,
        app: (typeof VERSION !== 'undefined' ? VERSION : '?'),
        caps: CAPS,
        tools: toolTable()
      });
    };
    ws.onmessage = function (e) { onMessage(e.data); };
    ws.onclose = function () {
      connected = false; peer = null; notify();
      clearTimeout(retry);
      if (url) retry = setTimeout(function () { connect(url); }, RETRY_MS);
    };
    ws.onerror = function () { };
    return true;
  }

  function disconnect(keepUrl) {
    clearTimeout(retry); retry = null;
    if (!keepUrl) url = null;
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { } }
    ws = null; connected = false; peer = null;
    if (!keepUrl) notify();
  }

  /* ---- built-in commands ----------------------------------------------- */
  // Generic, tool-agnostic. Per-tool semantic commands land in 2.0-b.

  function defineDefaults() {
    command('tool.select', function (p) {
      const C = window.PLANNER_CAM;
      if (C && typeof C.selectTool === 'function') return C.selectTool(p.index, p.key);
      return false;
    });
    command('edit.undo', function () {
      const C = window.PLANNER_CAM;
      if (C && typeof C.undo === 'function') { C.undo(); return true; } return false;
    });
    command('edit.redo', function () {
      const C = window.PLANNER_CAM;
      if (C && typeof C.redo === 'function') { C.redo(); return true; } return false;
    });
    command('view.reset', function () {
      const C = window.PLANNER_CAM;
      if (C && typeof C.resetView === 'function') { C.resetView(); return true; } return false;
    });
  }

  /* ---- public API ------------------------------------------------------ */

  function on(type, fn) {
    (handlers[type] || (handlers[type] = [])).push(fn);
    return function off() {
      const l = handlers[type]; if (!l) return;
      const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
    };
  }

  function command(id, fn) { commands[id] = fn; }

  const api = {
    connect: connect,
    disconnect: disconnect,
    send: send,
    on: on,
    command: command,
    onStatus: function (fn) { listeners.push(fn); return status(); },
    status: status,
    isUp: function () { return connected; },
    peerWants: peerWants,
    stats: function () { return Object.assign({}, stats); },
    pushState: pushState,
    snapshot: snapshot,
    toolTable: toolTable,
    PROTO: PROTO,
    CAPS: CAPS
  };

  defineDefaults();
  if (typeof window !== 'undefined') window.PLANNER_LINK = api;
  return api;
})();
