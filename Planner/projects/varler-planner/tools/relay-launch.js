// ==========================================================================
// relay-launch.js — START from the phone for VRG Mobile (WP M11 · Indítópult).
//
// What phone-relay-server.js needs to answer launch.list / launch.run / launch.status / launch.log /
// launch.stop for a trusted (paired, M2) phone. The list is START's own registry, read through
// launcher/menu.js from launcher/vrg-menu.json, narrowed by the allow-list Mobile/catalogue/launch.json:
//
//   tool:<key>     every start.tools entry: its page opens in a browser on the PC, its `before` step
//                  (Kódváros' repo scan) run first, as START does.
//   server:<id>    a registry server the allow-list names: started detached when it is not running
//                  (its output goes to %TEMP%\VRG\launch\<id>.log), then its page opens on the PC.
//   extra:<k>.<x>  a tool extra the allow-list names (K.S Élő mód, K.G Gépország).
//
// THE RULE: the phone sends an id, and the id is only ever a key into the Map built here. Every
// command is made from registry values (pure functions below, so the test can see them); no string
// from the phone reaches a command line, a path or a URL. Opening a page falls back to the portable
// Chrome (Full\tools\chrome\chrome.exe) first, because this PC's Windows has no default browser.
// ==========================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const ports = require('./relay-ports');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const menu = require(path.join(REPO, 'launcher', 'menu.js'));
const ALLOW_FILE = path.join(REPO, 'Mobile', 'catalogue', 'launch.json');
const LOG_DIR = path.join(os.tmpdir(), 'VRG', 'launch');
const BEFORE_MS = 180000;                  // Kódváros' scan of the whole repo
const START_WAIT_MS = 10000;               // as START: 20 x 500 ms for a server to answer
const ID = /^(tool|server|extra):[A-Za-z0-9._-]{1,32}$/;
const LOG_TAIL = 40;

/* ---- the list --------------------------------------------------------------- */

function loadAllow(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file || ALLOW_FILE, 'utf8').replace(/^﻿/, ''));
    const serves = {};
    for (const [k, v] of Object.entries(j.serves || {})) if (k !== 'about' && typeof v === 'string') serves[k] = v;
    const arr = a => (Array.isArray(a) ? a.filter(s => typeof s === 'string') : []);
    return { serves, servers: new Set(arr(j.servers && j.servers.allow)), extras: new Set(arr(j.extras && j.extras.allow)) };
  } catch (e) { return { serves: {}, servers: new Set(), extras: new Set() }; }
}

/** "http://localhost:8797/homeland" from a registry extra that opens it with rundll32 url.dll (START's way). */
function urlOfExtra(x) {
  const a = Array.isArray(x.args) ? x.args : [];
  if (x.exe && /rundll32(\.exe)?$/i.test(x.exe) && /^url\.dll,FileProtocolHandler$/i.test(a[0] || '') && /^https?:\/\/localhost:\d+\//.test(a[1] || '')) return a[1];
  return null;
}

/**
 * The registry + allow-list as one Map(id -> entry). `reg` and `resolve` default to START's own;
 * the test passes them in. An entry is what the phone sees (`pub`) plus the plan to run it.
 */
function buildList(opts) {
  opts = opts || {};
  const reg = opts.registry || menu.reload();
  const resolve = opts.resolve || menu.resolve;
  const allow = opts.allow || loadAllow(opts.allowFile);
  const exists = opts.exists || (p => fs.existsSync(p));
  const servers = new Map((reg.servers || []).filter(s => s && typeof s.id === 'string').map(s => [s.id, s]));
  const out = new Map();
  const serverPub = s => (s ? { port: s.port, path: typeof s.open === 'string' && s.open.startsWith('/') ? s.open : '/' } : {});

  for (const t of (reg.start && reg.start.tools) || []) {
    if (!t || typeof t.key !== 'string') continue;
    // a served tool (no "path"; a "server" + its "page", e.g. VRG Térkép) runs at its server's URL, as in START
    const served = typeof t.path !== 'string' && typeof t.server === 'string' && servers.has(t.server);
    if (typeof t.path !== 'string' && !served) continue;
    const s = served ? servers.get(t.server) : servers.get(allow.serves[t.key]) || null;
    const page = served ? null : resolve(t.path);
    const check = served ? (typeof t.page === 'string' ? resolve(t.page) : s.js ? resolve(s.js) : null) : page;
    out.set('tool:' + t.key, {
      pub: Object.assign({ id: 'tool:' + t.key, kind: 'tool', key: t.key, name: t.name, hint: t.hint || null,
        group: 'Eszközök', exists: !!check && exists(check), server: s ? s.id : null }, serverPub(s)),
      plan: { page, served, server: s, before: t.before ? { note: t.before.note || null, exe: resolve(t.before.exe), args: (t.before.args || []).map(resolve) } : null },
    });
    for (const x of t.extras || []) {
      const xid = t.key + '.' + x.key;
      if (!allow.extras.has(xid)) continue;
      const xs = x.server ? servers.get(x.server) || null : null;
      const url = urlOfExtra(x);
      out.set('extra:' + xid, {
        pub: Object.assign({ id: 'extra:' + xid, kind: 'extra', key: t.key + '·' + x.key, name: x.name, hint: x.hint || null,
          group: 'Eszközök', exists: !x.exe || !!url || exists(resolve(x.exe)), server: xs ? xs.id : null }, serverPub(xs)),
        plan: { server: xs, serverArgs: x.serverArgs || [], url, exe: !url && x.exe ? resolve(x.exe) : null, args: (x.args || []).map(resolve) },
      });
    }
  }
  for (const s of reg.servers || []) {
    if (!s || !allow.servers.has(s.id)) continue;
    const js = s.js ? resolve(s.js) : null;
    out.set('server:' + s.id, {
      pub: Object.assign({ id: 'server:' + s.id, kind: 'server', key: 'O' + s.key, name: s.name, hint: ':' + s.port,
        group: 'Helyi szerverek', exists: !!js && exists(js), server: s.id }, serverPub(s)),
      plan: { server: s, open: true },
    });
  }
  return out;
}

/** The phone's id -> the entry, or a reason. Only a string of the id shape, and only one that is in the Map. */
function pick(list, id) {
  if (typeof id !== 'string' || !ID.test(id)) return { ok: false, reason: 'Hibás azonosító.' };
  const e = list.get(id);
  if (!e) return { ok: false, reason: 'Ez nincs az Indítópult listáján: ' + id };
  return { ok: true, entry: e };
}

/* ---- commands (pure) ------------------------------------------------------------ */

/** A page (a file path or an http://localhost URL from the registry) in a new browser window. */
function pageCommand(target, platform, chrome) {
  if (chrome) return [chrome, ['--new-window', target]];
  const p = platform || process.platform;
  if (p === 'win32') return ['rundll32.exe', ['url.dll,FileProtocolHandler', target]];   // no cmd.exe: & and % stay literal
  if (p === 'darwin') return ['open', [target]];
  return ['xdg-open', [target]];
}

/** A registry server: [node, [js, ...args, ...extra], cwd]. Bat servers are not started from the phone. */
function serverCommand(s, node, resolve, extra) {
  if (!s || !s.js) return null;
  resolve = resolve || menu.resolve;
  return [node, [resolve(s.js), ...(s.args || []), ...(extra || [])], s.cwd ? resolve(s.cwd) : REPO];
}

function serverUrl(s) { return `http://localhost:${s.port}${typeof s.open === 'string' && s.open.startsWith('/') ? s.open : '/'}`; }

function nodeExe() {
  try { const n = menu.resolve('{node}'); if (fs.existsSync(n)) return n; } catch (e) { /* no registry */ }
  return process.execPath;
}

/* ---- the launcher ------------------------------------------------------------- */

/**
 * opts (all optional, the test fakes them): listening() -> Promise<Set<port>>, spawn(cmd, args, o),
 * runBefore(exe, args) -> Promise<code>, chrome, platform, node, wait (ms per poll), logDir.
 * RELAY_LAUNCH_DRY=1 starts nothing and only reports the commands.
 */
function createLauncher(opts) {
  opts = opts || {};
  const dry = opts.dry != null ? opts.dry : process.env.RELAY_LAUNCH_DRY === '1';
  const logDir = opts.logDir || LOG_DIR;
  const platform = opts.platform || process.platform;
  const chrome = opts.chrome !== undefined ? opts.chrome : ports.portableChrome();
  const node = opts.node || nodeExe();
  const pollMs = opts.wait || 500;
  const started = new Map();               // server id -> {pid, at}: what this relay started
  const busy = new Set();
  const listening = opts.listening || (async () => new Set((await ports.readListening()).map(r => r.port)));
  const spawnFn = opts.spawn || ((cmd, args, o) => {
    const c = spawn(cmd, args, o);
    c.on('error', () => {});
    c.unref();
    return c;
  });
  const runBefore = opts.runBefore || ((exe, args) => new Promise(res =>
    execFile(exe, args, { cwd: REPO, windowsHide: true, timeout: BEFORE_MS, maxBuffer: 16 * 1024 * 1024 }, err => res(err ? (err.code || 1) : 0))));
  const log = [];                          // what was run, for the test and the console

  function open(target) {
    const [cmd, args] = pageCommand(target, platform, chrome);
    log.push({ cmd, args });
    if (dry) return { ok: true, how: path.basename(cmd), dry: true };
    try { spawnFn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false }); return { ok: true, how: path.basename(cmd) }; }
    catch (e) { return { ok: false, reason: 'Nem sikerült megnyitni: ' + e.message }; }
  }

  function logFile(id) { return /^[a-z0-9-]{1,40}$/i.test(id) ? path.join(logDir, id + '.log') : null; }

  function startServer(s, extra) {
    const c = serverCommand(s, node, opts.resolve, extra);
    if (!c) return { ok: false, reason: 'Ez a szerver nem indítható a telefonról.' };
    const [cmd, args, cwd] = c;
    log.push({ cmd, args, cwd });
    if (dry) { started.set(s.id, { pid: 0, at: Date.now() }); return { ok: true }; }
    const file = logFile(s.id);
    let fd = 'ignore';
    try { fs.mkdirSync(logDir, { recursive: true }); fd = fs.openSync(file, 'a'); fs.writeSync(fd, `\n--- ${new Date().toISOString()} ${s.name} (Indítópult)\n`); } catch (e) { fd = 'ignore'; }
    try {
      // detached + its own stdio: it outlives the relay; no window, the log file is its console
      const child = spawnFn(cmd, args, { cwd, detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
      started.set(s.id, { pid: child && child.pid, at: Date.now() });
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'Nem indult el: ' + e.message }; }
    finally { if (typeof fd === 'number') try { fs.closeSync(fd); } catch (e) { /* closed */ } }
  }

  async function waitUp(port) {
    for (let i = 0; i < START_WAIT_MS / 500; i++) {
      if ((await listening()).has(port)) return true;
      await new Promise(r => setTimeout(r, pollMs));
    }
    return false;
  }

  /** Make sure a server runs; {ok, started} or a reason. */
  async function ensure(s, extra) {
    if ((await listening()).has(s.port)) return { ok: true, started: false };
    const r = startServer(s, extra);
    if (!r.ok) return r;
    if (s.self) return { ok: true, started: true, self: true };
    return dry || (await waitUp(s.port)) ? { ok: true, started: true }
      : { ok: false, started: true, reason: `A szerver 10 másodperc alatt sem válaszolt (port ${s.port}). Napló: launch.log` };
  }

  async function run(list, id) {
    const p = pick(list, id);
    if (!p.ok) return p;
    const { pub, plan } = p.entry;
    if (busy.has(pub.id)) return { ok: false, id: pub.id, reason: 'Már indul.' };
    if (!pub.exists) return { ok: false, id: pub.id, reason: 'Nem található a PC-n: ' + pub.name };
    busy.add(pub.id);
    try {
      if (pub.kind === 'tool') {
        let note = null;
        if (plan.before) {
          log.push({ cmd: plan.before.exe, args: plan.before.args });
          const code = dry ? 0 : await runBefore(plan.before.exe, plan.before.args);
          if (code) note = `${(plan.before.note || 'Az előkészítés').replace(/…$/, '')} nem sikerült, a legutóbbi adat marad.`;
        }
        if (plan.served) {
          const st = await ensure(plan.server, []);
          if (!st.ok) return Object.assign({ id: pub.id }, st);
          if (st.self) return { ok: true, id: pub.id, started: true, how: 'self' };
          return Object.assign({ id: pub.id, note, started: st.started }, open(serverUrl(plan.server)));
        }
        return Object.assign({ id: pub.id, note }, open(plan.page));
      }
      let st = { ok: true, started: false };
      if (plan.server) {
        st = await ensure(plan.server, plan.serverArgs);
        if (!st.ok) return Object.assign({ id: pub.id }, st);
      }
      if (pub.kind === 'server' || (pub.kind === 'extra' && !plan.url && !plan.exe)) {
        if (st.self) return { ok: true, id: pub.id, started: true, how: 'self' };
        return Object.assign({ id: pub.id, started: st.started }, open(serverUrl(plan.server)));
      }
      if (plan.url) return Object.assign({ id: pub.id, started: st.started }, open(plan.url));
      log.push({ cmd: plan.exe, args: plan.args });
      if (dry) return { ok: true, id: pub.id, started: st.started, how: path.basename(plan.exe), dry: true };
      try {
        spawnFn(plan.exe, plan.args, { cwd: path.dirname(plan.exe), detached: true, stdio: 'ignore', windowsHide: false });
        return { ok: true, id: pub.id, started: st.started, how: path.basename(plan.exe) };
      } catch (e) { return { ok: false, id: pub.id, reason: 'Nem indult el: ' + e.message }; }
    } finally { busy.delete(pub.id); }
  }

  /** Which of the list's servers listen now, and which of them this relay started. */
  async function status(list) {
    const up = await listening();
    const running = [], mine = [];
    for (const { pub } of list.values()) {
      if (pub.port && up.has(pub.port)) running.push(pub.id);
      if (pub.server && started.has(pub.server) && pub.port && up.has(pub.port)) mine.push(pub.id);
    }
    return { ok: true, running, mine };
  }

  /** The last lines of the log of a server this relay started (or started before, in this temp folder). */
  function tail(list, id) {
    const p = pick(list, id);
    if (!p.ok) return p;
    const sid = p.entry.pub.server;
    const file = sid ? logFile(sid) : null;
    if (!file) return { ok: true, id, lines: [], note: 'Ennek nincs naplója.' };
    try {
      const st = fs.statSync(file);
      const len = Math.min(st.size, 16384);
      const buf = Buffer.alloc(len);
      const fd = fs.openSync(file, 'r');
      try { fs.readSync(fd, buf, 0, len, st.size - len); } finally { fs.closeSync(fd); }
      const lines = buf.toString('utf8').split(/\r?\n/).filter(l => l.length).slice(-LOG_TAIL).map(l => l.slice(0, 300));
      return { ok: true, id, lines, at: st.mtimeMs };
    } catch (e) {
      return { ok: true, id, lines: [], note: 'Nincs napló: ezt nem a telefon indította (START-ból indult szerver a saját ablakába ír).' };
    }
  }

  /** Stops a server only if this relay started it, by the pid it got. */
  function stop(list, id) {
    const p = pick(list, id);
    if (!p.ok) return p;
    const sid = p.entry.pub.server;
    const s = sid && started.get(sid);
    if (!s) return { ok: false, id, reason: 'Csak a telefonról indított szervert lehet innen leállítani.' };
    started.delete(sid);
    if (dry || !s.pid) return { ok: true, id, dry: true };
    try { process.kill(s.pid); return { ok: true, id }; }
    catch (e) { return { ok: false, id, reason: 'Nem állt le: ' + e.message }; }
  }

  return { run, status, tail, stop, log, started };
}

module.exports = { buildList, loadAllow, pick, pageCommand, serverCommand, serverUrl, urlOfExtra, createLauncher, ALLOW_FILE, LOG_DIR, ID };
