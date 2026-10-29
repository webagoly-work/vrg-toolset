// 36-link.js — VRG Légegér (Mobile/) on the city: the phone relay as a second input.
//
// The Planner's phone relay (Planner/projects/varler-planner/tools/phone-relay-server.js, port 47291..47298)
// carries one phone to several apps. This module joins it as role 'codecity' and speaks the same envelope as
// the Planner's 07a-link.js: {v, from, seq, t, type, payload}. The phone builds its pad from this page's hello
// (the lenses, in the Planner's tool-table shape), so the phone needs no city-specific list.
//
// What arrives and what it does:
//   cmd tool.select {index}  -> setLens (07-lens)       cmd time.step {d} -> tlStep (06-timeline)
//   cmd time.play            -> play / pause            cmd time.latest   -> tlLatest
//   cmd land.home            -> landHome (29-land)      cmd roads.toggle  -> toggleRoads (08-roads)
//   cmd compare.base         -> setBase (14-compare)    cmd palette.open  -> palOpen (18-palette)
//   cmd view.reset           -> landHome
//   gesture zoompan {dx,dy,scale} -> pan / zoom the orbit; gesture orbit {dx,dy} -> rotate; gesture reset
//   orientation {pitch,yaw}  -> rotate, relative to the pose when the phone's camera switch was turned on
//   keys {key,ctrl,shift,alt} -> a synthetic keydown, so every keyboard binding of the page works from the phone
//
// Read-only like the file:// page itself: nothing here writes anything. Without a relay it probes the ports
// once at boot and then every 20 s, quietly.

const vlink = { ws: null, seq: 0, port: 0, timer: null, base: null, lastState: '' };
const VLINK_PORTS = [47291, 47292, 47293, 47294, 47295, 47296, 47297, 47298];

function vlinkSend(type, payload) {
  if (!vlink.ws || vlink.ws.readyState !== 1) return false;
  vlink.ws.send(JSON.stringify({ v: 1, from: 'codecity', seq: ++vlink.seq, t: Date.now(), type, payload: payload || {} }));
  return true;
}

function vlinkTools() {
  return LENSES.map(l => ({ mode: l.id, key: l.key || null, hint: l.name }));
}

function vlinkSnapshot() {
  if (!current) return { mode: null };
  const c = current.city.commits && current.city.commits[replay.T];
  return {
    mode: lens.id,
    commit: c ? String(c[4] || '').slice(0, 60) : null,
    T: replay.T, last: replay.last,
    playing: !!tl.playing,
    roads: !!roads.all
  };
}

function vlinkState(force) {
  const s = vlinkSnapshot(), j = JSON.stringify(s);
  if (!force && j === vlink.lastState) return;
  vlink.lastState = j;
  vlinkSend('state', s);
}

const VLINK_CMDS = {
  'tool.select': p => { const l = LENSES[p.index] || LENSES.find(x => x.key === p.key); if (!l) return false; setLens(l.id); },
  'time.step': p => tlStep(p.d || 1),
  'time.play': () => (tl.playing ? tlPause() : tlPlay()),
  'time.latest': () => tlLatest(),
  'land.home': () => landHome(),
  'view.reset': () => landHome(),
  'roads.toggle': () => toggleRoads(),
  'compare.base': () => setBase(compare.base === null ? replay.T : null),
  'palette.open': () => palOpen(),
};

function vlinkKey(p) {
  if (!p || !p.key) return;
  const o = { key: p.key, ctrlKey: !!p.ctrl, shiftKey: !!p.shift, altKey: !!p.alt, bubbles: true, cancelable: true };
  (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', o));
  (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keyup', o));
}

function vlinkGesture(g) {
  if (!g) return;
  if (g.kind === 'reset') { landHome(); return; }
  if (g.kind === 'orbit') {
    orbit.theta -= (g.dx || 0) * 0.005;
    orbit.phi = Math.min(1.45, Math.max(0.12, orbit.phi - (g.dy || 0) * 0.005));
  } else if (g.kind === 'zoompan') {
    const k = orbit.r * 0.0015, s = Math.sin(orbit.theta), c = Math.cos(orbit.theta), dx = g.dx || 0, dy = g.dy || 0;
    orbit.target.x -= (dx * c + dy * s) * k;
    orbit.target.z -= (-dx * s + dy * c) * k;
    if (g.scale && g.scale !== 1) orbit.r = Math.min(120000, Math.max(8, orbit.r / g.scale));
  } else return;
  placeCamera();
}

// The phone sends absolute angles (yaw 0..360, pitch 5..90). The city keeps its own pose and only follows
// the change since the first reading, so turning the switch on never makes the camera jump.
function vlinkOrient(o) {
  if (!o || !o.yawEnabled) { vlink.base = null; return; }
  if (!vlink.base) { vlink.base = { yaw: o.yaw, pitch: o.pitch, theta: orbit.theta, phi: orbit.phi }; return; }
  let dy = o.yaw - vlink.base.yaw;
  if (dy > 180) dy -= 360; else if (dy < -180) dy += 360;
  orbit.theta = vlink.base.theta + dy * Math.PI / 180;
  orbit.phi = Math.min(1.45, Math.max(0.12, vlink.base.phi + (vlink.base.pitch - o.pitch) * Math.PI / 180));
  placeCamera();
}

function vlinkOnMessage(raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || m.from === 'codecity') return;
  const p = m.payload || {};
  if (m.type === 'hello' && (p.role === 'phone' || m.from === 'phone')) { vlinkState(true); return; }
  if (m.type === 'state.request') { vlinkState(true); return; }
  if (m.type === 'cmd') {
    const fn = VLINK_CMDS[p.id];
    let ok = !!fn && !!current, reason = fn ? (current ? null : 'no city loaded') : 'unknown command';
    if (ok) { try { ok = fn(p) !== false; } catch (e) { ok = false; reason = e.message; } }
    vlinkSend('ack', { id: p.id, ok, reason });
    vlinkState(false);
    return;
  }
  if (!current) return;
  if (m.type === 'keys') { vlinkKey(p); setTimeout(() => vlinkState(false), 60); }
  else if (m.type === 'gesture') vlinkGesture(p);
  else if (m.type === 'orientation') vlinkOrient(p);
}

function vlinkFocus() { vlinkSend('focus', { app: 'codecity', title: document.title }); }

function vlinkOpen(i = 0) {
  if (vlink.ws) return;
  if (i >= VLINK_PORTS.length) { vlink.timer = setTimeout(() => vlinkOpen(0), 20000); return; }
  const host = new URLSearchParams(location.search).get('relay') || '127.0.0.1';
  let ws;
  try { ws = new WebSocket(`ws://${host}:${VLINK_PORTS[i]}`); } catch (e) { vlinkOpen(i + 1); return; }
  let opened = false;
  ws.onopen = () => {
    opened = true; vlink.ws = ws; vlink.port = VLINK_PORTS[i];
    vlinkSend('hello', { role: 'codecity', app: 'codecity', caps: ['state', 'cmd', 'keys', 'orientation', 'gesture'], tools: vlinkTools() });
    if (document.hasFocus()) vlinkFocus();
  };
  ws.onmessage = e => vlinkOnMessage(e.data);
  ws.onerror = () => {};
  ws.onclose = () => {
    if (vlink.ws === ws) vlink.ws = null;
    clearTimeout(vlink.timer);
    vlink.timer = opened ? setTimeout(() => vlinkOpen(0), 2000) : setTimeout(() => vlinkOpen(i + 1), 50);
  };
}

addEventListener('focus', vlinkFocus);
setInterval(() => vlinkState(false), 500);   // the readout on the phone; sent only when something changed
vlinkOpen();
