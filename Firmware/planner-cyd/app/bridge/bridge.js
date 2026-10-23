#!/usr/bin/env node
// Varler Planner -> CYD desk dashboard bridge.
//
// The Planner tab already talks to a local relay (<repo>/Planner/projects/varler-planner/
// tools/phone-relay-server.js, port 47291) for the phone link. This bridge joins the
// same relay as one more client (role 'cyd'), receives the 'dash' snapshots that
// src/07e-dash-link.js sends, and turns them into short lines for the CYD over USB
// serial. Button presses on the CYD come back as '!' lines and go to the Planner as
// relay commands. See ../../README.md for the line protocol.
//
//   node bridge.js                     find the CYD on USB, find the relay, go
//   node bridge.js --port COM19        pick the serial port
//   node bridge.js --tcp 127.0.0.1:7788   talk to a fake CYD (app/tools/fake_cyd.js) instead
//   node bridge.js --relay ws://127.0.0.1:47291   relay address (default: probe 47291..47298)
//   node bridge.js --demo              no Planner needed: a mock tab (mock_planner.js)
//   node bridge.js --name "Iroda"      name shown on the CYD (default: this PC's hostname)
//   node bridge.js --verbose           print every line sent to the CYD
//   node bridge.js --idle-min 5        minutes without input in the tab before the CYD shows its clock
//   node bridge.js --start <file>      what the KEZDŐLAP / ÓRA button opens (default: <repo>/Planner/START.cmd);
//                                      --start none hides the button
//   node bridge.js --macros <file>     the MAKROK button sets (default: macros.json next to this file)
//   node bridge.js --no-relay          never look for the Planner relay
//   node bridge.js --ui-port 8788      the MAKROK settings page (default 8788), --no-ui to turn it off
//   node bridge.js --demo --demo-idle 20   (demo) the mock tab stops "working" after 20 s
//
// CYD settings (USB), and --once to send only these and exit:
//   --rotate 0-7  --invert 0|1  --calibrate  --page home|status|tools|phases|controls|macros|totals|clock

'use strict';
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { SerialPort } = require('serialport');
const { createMockPlanner } = require('./mock_planner');
const { createMacros, PRESETS, SET_TEMPLATES, TYPES, MAX, MAX_SETS } = require('./macros');
const { startConfigUi } = require('./configui');
const autostart = require('./autostart');

const args = parseArgs(process.argv.slice(2));
const BAUD = Number(args.baud || 115200);
const VERBOSE = !!args.verbose;
const ONCE = !!args.once;
const DEVICE_NAME = asc(args.name || os.hostname(), 19);
const PLANNER_ALIVE_MS = 6000;   // the tab sends at least every 2.5 s
const IDLE_MS = Number(args['idle-min'] || 5) * 60000;   // no input in the tab for this long = idle
const REPO = path.join(__dirname, '../../../..');   // <repo>/Firmware/planner-cyd/app/bridge
const OPEN_FILE = args.start === 'none' ? null : path.resolve(String(args.start || path.join(REPO, 'Planner/START.cmd')));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2), next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

// The CYD's fonts (HuSans, fonts_hu.h) have ASCII, the Hungarian accented letters and ° – … · ×.
// Anything else is folded to its base letter when it has one (ä -> a), else dropped (emoji).
// max is in UTF-8 BYTES, the size of the CYD's field minus its terminator, and a cut never
// splits a character. The field separator becomes '/'.
const CYD_EXTRA = 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ°–…·×';
function asc(s, max) {
  let t = '';
  for (const ch of String(s == null ? '' : s).replace(/\|/g, '/')) {
    if ((ch >= ' ' && ch <= '~') || CYD_EXTRA.includes(ch)) { t += ch; continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base.length === 1 && base >= ' ' && base <= '~') t += base;
    else if (/\s/.test(ch)) t += ' ';
  }
  t = t.replace(/\s+/g, ' ').trim();
  if (max) while (Buffer.byteLength(t, 'utf8') > max) t = [...t].slice(0, -1).join('');
  return t;
}

// ---------------------------------------------------------------- link to the CYD
// (same as the RL bridge: USB serial, or TCP for a fake CYD while testing)

const CYD_VIDS = ['1a86', '10c4', '0403', '303a']; // CH340, CP210x, FTDI, Espressif
let link = null, linkReady = false;

async function findPort() {
  if (args.port) return args.port;
  const ports = await SerialPort.list();
  const hit = ports.find(p => CYD_VIDS.includes((p.vendorId || '').toLowerCase()));
  return hit ? hit.path : null;
}

function makeLineReader() {
  let rx = '';
  return buf => {
    rx += buf.toString('latin1');
    let i;
    while ((i = rx.indexOf('\n')) >= 0) {
      const line = rx.slice(0, i).trim();
      rx = rx.slice(i + 1);
      if (line.startsWith('#')) log('CYD', line.slice(1));
      else if (line.startsWith('!')) onCydAction(line);
    }
    if (rx.length > 4096) rx = '';
  };
}

function linkUp(delayMs) {
  // opening a USB port can reset the ESP32: give it time to boot
  setTimeout(() => {
    linkReady = true;
    sendSettings();
    if (ONCE) { setTimeout(() => { log('Done.'); process.exit(0); }, 1500); return; }
    resendAll();
  }, delayMs);
}

function linkDown(what, retry, ms) {
  log(`${what} closed. Reconnecting...`);
  linkReady = false;
  link = null;
  setTimeout(retry, ms);
}

async function openSerial() {
  const path = await findPort();
  if (!path) {
    log('No CYD found. Plug it in with a data USB cable (CH340 driver: wch-ic.com). Retrying...');
    return setTimeout(openSerial, 3000);
  }
  const port = new SerialPort({ path, baudRate: BAUD, autoOpen: false, hupcl: false });
  port.open(err => {
    if (err) {
      log(`Cannot open ${path}: ${err.message}. Is another bridge or a serial monitor using it? Retrying...`);
      return setTimeout(openSerial, 3000);
    }
    port.set({ dtr: false, rts: false }, () => {});   // DTR/RTS low = the ESP32 runs normally
    link = port;
    log(`Connected to CYD on ${path} as "${DEVICE_NAME}"`);
    linkUp(1500);
  });
  port.on('data', makeLineReader());
  port.on('close', () => linkDown('Serial port', openSerial, 2000));
  port.on('error', e => log('Serial error:', e.message));
}

function openTcp() {
  const [host, p] = String(args.tcp).split(':');
  const port = Number(p || 7777);
  const sock = net.createConnection({ host, port });
  sock.setNoDelay(true);
  sock.on('connect', () => { log(`Connected to CYD at ${host}:${port} (TCP)`); link = sock; linkUp(200); });
  sock.on('data', makeLineReader());
  sock.on('error', e => { if (!link) log(`CYD not reachable at ${host}:${port}: ${e.message}`); });
  sock.on('close', () => linkDown('TCP link', openTcp, 3000));
}

function send(line) {
  if (!link || !linkReady) return;
  if (ONCE && !/^[OICU?]\|?/.test(line)) return;   // settings only
  if (VERBOSE) log('->', line);
  link.write(line + '\n');
}

function sendSettings() {
  if (args.rotate != null) send(`O|${Number(args.rotate) & 7}`);
  if (args.invert != null) send(`I|${/^(1|on|true)$/i.test(String(args.invert)) ? 1 : 0}`);
  if (args.calibrate) send('C|1');
  if (args.page) send(`U|${asc(args.page)}`);
}

// ---------------------------------------------------------------- the Planner side

let snap = null, lastDashAt = 0, plannerWasAlive = false, lastChangeAt = 0, lastSnapJson = '';
const pending = [];   // commands waiting for their ack: {id, label}
const plannerAlive = () => !!lastDashAt && Date.now() - lastDashAt < PLANNER_ALIVE_MS;

let toPlanner = () => false;   // set by the relay client or the mock

function envelope(type, payload) {
  return { v: 1, from: 'cyd', seq: ++envelope.seq, t: Date.now(), type, payload: payload || {} };
}
envelope.seq = 0;

function cmd(id, payload, label) {
  if (!plannerAlive()) { banner(2, 'NINCS PLANNER', 'Nyisd meg a Plannert'); return; }
  pending.push({ id, label: label || id });
  if (pending.length > 20) pending.shift();
  toPlanner(envelope('cmd', Object.assign({ id }, payload || {})));
}

function onPlannerMessage(m) {
  if (!m || m.from !== 'planner') return;
  if (m.type === 'dash') onDash(m.payload);
  else if (m.type === 'ack') onAck(m.payload || {});
}

function onAck(a) {
  const i = pending.findIndex(p => p.id === a.id);
  const p = i >= 0 ? pending.splice(i, 1)[0] : { label: a.id };
  if (!a.ok) banner(2, 'NEM SIKERÜLT', asc(p.label + ': ' + (a.reason || 'most nem elérhető'), 40));
  else if (p.label === 'Mentés') banner(1, 'MENTVE', asc(snap && snap.proj, 40));
}

function onDash(s) {
  if (!s || typeof s !== 'object') return;
  const prev = snap;
  snap = s;
  lastDashAt = Date.now();
  const json = JSON.stringify(Object.assign({}, s, { inputAt: 0 }));
  if (json !== lastSnapJson) { lastSnapJson = json; lastChangeAt = Date.now(); }
  if (!plannerWasAlive) { plannerWasAlive = true; banner(1, 'PLANNER', asc(s.proj || 'kapcsolódott', 40)); }
  if (prev && (s.err || 0) > (prev.err || 0)) {
    const ph = (s.phases || [])[s.phase];
    banner(3, 'HIBA', asc(`${s.err} hiba` + (ph ? ' - ' + ph.n : ''), 40));
  }
  pushSnapshot();
}

// ---------------------------------------------------------------- snapshot -> lines

const cache = new Map();   // key -> last line sent, so only changes go out

function put(key, line) {
  if (cache.get(key) === line) return;
  cache.set(key, line);
  send(line);
}

function putList(key, lines, commit) {
  const all = lines.join('\n') + '\n' + commit;
  if (cache.get(key) === all) return;
  cache.set(key, all);
  lines.forEach(send);
  send(commit);
}

function pushSnapshot() {
  const s = snap;
  if (!s) return;
  const ph = (s.phases || [])[s.phase];
  put('S', ['S', asc(s.proj, 24), asc(s.level, 12), s.phase, asc(ph ? ph.n : '', 16), asc(s.tool ? s.tool.label : '', 28),
    asc(s.layer, 20), s.sel | 0, s.err | 0, s.warn | 0, s.flat ? 1 : 0].join('|'));
  const tools = (s.tools || []).slice(0, 12);
  putList('K', tools.map((t, i) => `K|${i}|${asc(t.n, 24)}|${t.live ? 'a' : ''}`), `J|${tools.length}`);
  const phases = (s.phases || []).slice(0, 6);
  putList('P', phases.map((p, i) => `P|${i}|${asc(p.n, 16)}|${p.err | 0}|${p.warn | 0}`), `R|${phases.length}`);
  const t = s.totals || {};
  put('A', ['A', t.dev | 0, t.paths | 0, t.circuits | 0, t.cables | 0, t.notes | 0].join('|'));
}

// Idle, for the CYD's clock page. The tab's own input time when it sends one (07e: inputAt),
// else the last time the snapshot changed.
function lastWorkMs() {
  if (snap && typeof snap.inputAt === 'number' && snap.inputAt > 0) return snap.inputAt * 1000;
  return lastChangeAt;
}

// Without a Planner tab nobody is "idle in the Planner": the CYD may be in use as a plain
// macropad, so it must not wander off to the clock.
function idleNow() {
  if (!plannerAlive()) return false;
  const t = lastWorkMs();
  return !!t && Date.now() - t > IDLE_MS;
}

function sendClock() {
  send(`Y|${Math.floor(Date.now() / 1000)}|${-new Date().getTimezoneOffset()}`);
}

function pushIdle() {
  const t = lastWorkMs();
  put('Z', `Z|${idleNow() ? 1 : 0}|${t ? Math.floor(t / 1000) : 0}`);
}

// The KEZDŐLAP and ÓRA button. The CYD only says "!O|start"; what opens is this bridge's own setting,
// so nothing on the serial line can choose a file to run.
function openLabel() { return OPEN_FILE && fs.existsSync(OPEN_FILE) ? asc(path.basename(OPEN_FILE) + ' megnyitása', 32) : ''; }

function openStart() {
  if (!OPEN_FILE || !fs.existsSync(OPEN_FILE)) return banner(2, 'NINCS FÁJL', asc(OPEN_FILE || 'nincs beállítva', 40));
  // start "" "<file>": a .cmd gets its own console window, anything else its default program
  exec(`start "" "${OPEN_FILE}"`, { cwd: path.dirname(OPEN_FILE), windowsHide: false }, err => {
    if (err) banner(3, 'NEM NYÍLT MEG', asc(err.message, 40));
  });
  log('Opened', OPEN_FILE);
  banner(1, 'MEGNYITVA', asc(path.basename(OPEN_FILE), 40));
}

function banner(kind, title, sub) { send(`E|${kind}|${asc(title, 16)}|${asc(sub, 40)}`); }

function resendAll() {
  cache.clear();
  send(`N|${DEVICE_NAME}`);
  send(`B|${openLabel()}`);
  send(`L|${plannerAlive() ? 1 : 0}`);
  sendClock();
  pushSnapshot();
  pushIdle();
  pushMacros();
}

// ---------------------------------------------------------------- MAKROK page (macros.js)

let macros = null;
function pushMacros() {
  if (!macros) return;
  const l = macros.list();
  // Planner buttons go grey while no tab is open (they would only answer NINCS PLANNER)
  const live = plannerAlive();
  putList('M', l.map((m, i) => `M|${i}|${asc(m.label, 24)}|${m.type === 'planner' && !live ? '2A303C' : m.color.slice(1)}`), `X|${l.length}`);
  // the set names for the KEZDŐLAP, and which one is active
  const d = macros.doc();
  putList('Q', d.sets.map((x, i) => `Q|${i}|${asc(x.name, 16)}`), `W|${d.sets.length}|${d.active}`);
}

// ---------------------------------------------------------------- CYD buttons

// Vezérlés page: name -> [relay command, payload, label for banners]
const CONTROLS = {
  undo: ['edit.undo', null, 'Visszavonás'],
  redo: ['edit.redo', null, 'Újra'],
  stop: ['dash.stop', null, 'Kijelölés'],
  save: ['dash.action', { a: 'proj.save' }, 'Mentés'],
  view3d: ['dash.action', { a: 'view.toggle3d' }, '2D/3D'],
  lvlup: ['dash.action', { a: 'level.up' }, 'Szint fel'],
  lvldn: ['dash.action', { a: 'level.down' }, 'Szint le'],
  finish: ['dash.action', { a: 'draw.finish' }, 'Lezárás'],
  home: ['view.reset', null, 'Nézet alap']
};

function onCydAction(line) {
  const [type, arg] = line.slice(1).split('|');
  if (VERBOSE) log('<-', line);
  if (type === 'T') {
    const t = snap && (snap.tools || [])[Number(arg)];
    if (!t) return;
    // tapping the running tool again ends it
    if (t.live && !/^wf\.layer\./.test(t.a || '')) cmd('dash.stop', null, 'Kijelölés');
    else cmd('dash.action', { a: t.a, mode: t.mode }, t.n);
  } else if (type === 'P') {
    const p = snap && (snap.phases || [])[Number(arg)];
    if (p) cmd('dash.phase', { k: p.k }, p.n);
  } else if (type === 'M') {
    if (macros) macros.run(Number(arg));
  } else if (type === 'G') {
    const set = macros && macros.setActive(Number(arg));
    if (set) { log(`Button set: ${set.name}`); banner(1, 'KÉSZLET', asc(set.name, 40)); }
  } else if (type === 'O') {
    if (arg === 'start') openStart();
  } else if (type === 'C') {
    if (arg === 'esc') {
      if (!plannerAlive()) return banner(2, 'NINCS PLANNER', 'Nyisd meg a Plannert');
      return toPlanner(envelope('keys', { key: 'Escape' }));
    }
    const c = CONTROLS[arg];
    if (c) cmd(c[0], c[1], c[2]);
  }
}

// ---------------------------------------------------------------- relay client

// Same discovery as the Planner's link panel (07d): /whoami on 47291..47298.
async function findRelay() {
  if (args.relay) return String(args.relay);
  for (let p = 47291; p <= 47298; p++) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/whoami`, { signal: AbortSignal.timeout(600) });
      const j = await r.json();
      if (/^varler[-a-z]*relay$/.test(String(j.app || ''))) return `ws://127.0.0.1:${j.port || p}`;
    } catch (e) { /* next port */ }
  }
  return null;
}

let relayWarned = false;
async function openRelay() {
  const url = await findRelay();
  if (!url) {
    if (!relayWarned) log('No Planner relay found. Start it: node tools/phone-relay-server.js (in varler-planner). Retrying...');
    relayWarned = true;
    return setTimeout(openRelay, 3000);
  }
  relayWarned = false;
  const ws = new WebSocket(url);
  ws.onopen = () => {
    log(`Connected to the Planner relay at ${url}`);
    toPlanner = m => { if (ws.readyState !== 1) return false; ws.send(JSON.stringify(m)); return true; };
    // 'state' keeps the Planner pushing state to a phone on the same relay (07a keeps one peer)
    toPlanner(envelope('hello', { role: 'cyd', app: 'planner-cyd-bridge 0.1', caps: ['dash', 'cmd', 'state'] }));
    toPlanner(envelope('dash.request'));
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onPlannerMessage(m); };
  ws.onclose = () => { toPlanner = () => false; log('Relay closed. Reconnecting...'); setTimeout(openRelay, 3000); };
  ws.onerror = () => {};
}

// ---------------------------------------------------------------- start

let beats = 0;
setInterval(() => {
  const alive = plannerAlive();
  send(`L|${alive ? 1 : 0}`);
  if (++beats % 30 === 0) sendClock();
  pushIdle();
  pushMacros();   // only sends when a colour changed (the Planner came or went)
  if (plannerWasAlive && !alive) { plannerWasAlive = false; banner(2, 'PLANNER', 'nincs kapcsolat'); }
}, 1000);

if (!ONCE) macros = createMacros({
  file: path.resolve(String(args.macros || path.join(__dirname, 'macros.json'))),
  log, banner,
  planner: (id, label) => cmd('dash.action', { a: id }, label),
  onChange: pushMacros
});

if (!ONCE && !args['no-ui']) startConfigUi({
  port: Number(args['ui-port'] || 8788), macros, templates: SET_TEMPLATES, presets: PRESETS, types: TYPES, max: MAX, maxSets: MAX_SETS, autostart, log,
  getStatus: () => ({ cyd: link && linkReady ? 'csatlakozva' : 'nincs', planner: plannerAlive() })
});

if (args.tcp) openTcp(); else openSerial();
if (!ONCE) {
  if (args.demo) {
    log('Demo: a mock Planner tab, no browser needed.');
    const mock = createMockPlanner(onPlannerMessage, log, { idleAfterS: Number(args['demo-idle'] || 0) });
    toPlanner = m => { setTimeout(() => mock.receive(m), 20); return true; };
  } else if (args['no-relay']) log('Macropad only: no Planner relay (--no-relay).');
  else openRelay();
}
