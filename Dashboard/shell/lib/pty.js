// pty.js — the terminal manager (WP-14). Profiles come from config/profiles.json; the page only ever names a profile id,
// main resolves the exe, args, env and cwd. Mode in-process (notes/desktop-os/spike/PTY.md): node-pty runs in the main process.
//   const pty = createPty({ profiles, expand, spawn, env, exists });
//   pty.profiles() → [{ id, hu, account?, available, reason? }]      pty.open(id, cwdAbs[, { args }]) → { term, title } | { ok:false, err }
//   pty.write(term, text)  pty.resize(term, cols, rows)  pty.kill(term)  pty.killAll()  pty.on('data' | 'exit' | 'title', cb)
// `spawn(exe, args, { cwd, env, cols, rows })` returns { pid, onData, onExit, write, resize, kill } (node-pty's IPty, or test/fixtures/fake-pty.js).
// `opts.args` replaces the profile's args; it exists for the probe and the tests, no IPC channel passes it.
'use strict';
const fs = require('fs'), path = require('path');

const MAX_TERMS = 12;
const FLUSH_MS = 16;
const MAX_EVENT = 64 * 1024;
const OSC_RE = /\x1b\]([02]);([^\x07\x1b]*)(?:\x07|\x1b\\)/g;

function loadNodePty(dir) {
  return require(dir || path.join(process.env.VRG_FULL || 'H:\\VRG\\Full', 'tools', 'js-libs', 'node-pty'));
}

// the real backend: node-pty (ConPTY)
function nodePtySpawn(nodePty) {
  return (exe, args, o) => nodePty.spawn(exe, args, { name: 'xterm-256color', cols: o.cols, rows: o.rows, cwd: o.cwd, env: o.env, useConpty: true });
}

function readProfiles(file) {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j) ? j : []; } catch (e) { return []; }
}

function createPty({ profiles, expand = s => s, spawn, env = process.env, exists = f => fs.existsSync(f), max = MAX_TERMS, flushMs = FLUSH_MS, systemRoot }) {
  const sysRoot = systemRoot || env.SystemRoot || process.env.SystemRoot || 'C:\\Windows';
  const terms = new Map();                                      // term id → { proc, buf, timer, tail, title }
  const handlers = { data: [], exit: [], title: [] };
  let seq = 0;

  const emit = (type, m) => { for (const cb of handlers[type]) { try { cb(m); } catch (e) {} } };
  const ex = s => expand(String(s == null ? '' : s).split('{systemroot}').join(sysRoot));
  const find = id => (profiles || []).find(p => p && p.id === id) || null;

  // exe, args and env of a profile, or { reason }
  function resolve(p, argsOverride) {
    let exe = ex(p.exe);
    if (!exe || /\{[a-z]+\}/.test(exe) || !path.isAbsolute(exe)) return { reason: 'path' };
    if (!exists(exe)) return { reason: 'missing' };
    let args = (Array.isArray(argsOverride) ? argsOverride : p.args || []).map(ex);
    if (/\.(cmd|bat)$/i.test(exe)) {                           // ConPTY cannot start a .cmd directly
      args = ['/c', exe, ...args];
      exe = path.join(sysRoot, 'System32', 'cmd.exe');
    }
    const e = {};
    for (const k of Object.keys(env)) {
      if (/^ELECTRON_/i.test(k) || /^NODE_OPTIONS$/i.test(k)) continue;
      if (env[k] !== undefined) e[k] = env[k];
    }
    if (p.account === 'A') for (const k of Object.keys(e)) if (/^CLAUDE_CONFIG_DIR$/i.test(k)) delete e[k];
    for (const [k, v] of Object.entries(p.env || {})) e[k] = ex(v);
    return { exe, args, env: e };
  }

  function listProfiles() {
    return (profiles || []).map(p => {
      const r = resolve(p);
      const o = { id: p.id, hu: p.hu, available: !r.reason };
      if (p.account) o.account = p.account;
      if (r.reason) o.reason = r.reason;
      return o;
    });
  }

  function flush(id) {
    const t = terms.get(id);
    if (!t) return;
    clearTimeout(t.timer); t.timer = 0;
    let s = t.buf; t.buf = '';
    while (s.length) { emit('data', { term: id, data: s.slice(0, MAX_EVENT) }); s = s.slice(MAX_EVENT); }
  }

  function parseTitle(id, t, chunk) {
    let s = t.tail + chunk;
    t.tail = '';
    let m, last = null;
    OSC_RE.lastIndex = 0;
    while ((m = OSC_RE.exec(s))) last = m[2];
    const open = s.lastIndexOf('\x1b]');                       // an unfinished sequence waits for the next chunk
    if (open >= 0 && !/\x07|\x1b\\/.test(s.slice(open + 2)) && s.length - open < 1024) t.tail = s.slice(open);
    if (last !== null && last !== t.title) { t.title = last; emit('title', { term: id, title: last }); }
  }

  function open(profileId, cwdAbs, opts) {
    const p = typeof profileId === 'string' ? find(profileId) : null;
    if (!p) return { ok: false, err: 'not-found', hu: 'Ismeretlen profil.' };
    if (terms.size >= max) return { ok: false, err: 'limit', hu: 'Legfeljebb ' + max + ' terminál lehet nyitva.' };
    const r = resolve(p, opts && opts.args);
    if (r.reason) return { ok: false, err: 'unavailable', hu: 'A terminál nem indult el.', reason: r.reason };
    if (typeof cwdAbs !== 'string' || !path.isAbsolute(cwdAbs)) return { ok: false, err: 'bad-request', hu: 'Érvénytelen mappa.' };
    let proc;
    try { proc = spawn(r.exe, r.args, { cwd: cwdAbs, env: r.env, cols: 100, rows: 30 }); }
    catch (e) { return { ok: false, err: 'error', hu: 'A terminál nem indult el.' }; }
    const id = 't' + (++seq);
    const t = { proc, buf: '', timer: 0, tail: '', title: p.hu, pid: proc.pid };
    terms.set(id, t);
    proc.onData(d => {
      d = String(d);
      parseTitle(id, t, d);
      t.buf += d;
      if (t.buf.length >= MAX_EVENT) flush(id);
      else if (!t.timer) t.timer = setTimeout(() => flush(id), flushMs);
    });
    proc.onExit(e => {
      flush(id);
      terms.delete(id);
      emit('exit', { term: id, code: e && Number.isInteger(e.exitCode) ? e.exitCode : 0 });
    });
    return { term: id, title: p.hu, pid: proc.pid };
  }

  const get = id => (typeof id === 'string' ? terms.get(id) : null) || null;
  function write(id, text) { const t = get(id); if (!t || typeof text !== 'string') return false; t.proc.write(text); return true; }
  function resize(id, cols, rows) { const t = get(id); if (!t) return false; try { t.proc.resize(cols, rows); } catch (e) { return false; } return true; }
  function kill(id) { const t = get(id); if (!t) return false; try { t.proc.kill(); } catch (e) {} return true; }
  function killAll() { const pids = []; for (const [id, t] of [...terms]) { pids.push(t.pid); clearTimeout(t.timer); try { t.proc.kill(); } catch (e) {} terms.delete(id); } return pids; }

  return {
    profiles: listProfiles, open, write, resize, kill, killAll,
    count: () => terms.size,
    on: (type, cb) => { if (handlers[type] && typeof cb === 'function') handlers[type].push(cb); },
  };
}

// `at` of term.open → an absolute folder, or null: a folder handle (re-resolved), 'repo', or 'line:<id>' (the DevLog session folder)
function resolveAt(at, { handles, repo, lines = [] }) {
  if (at === undefined || at === 'repo') return repo;
  if (typeof at !== 'string') return null;
  if (at.startsWith('h:')) {
    const d = handles.resolve(at);
    try { return d && fs.statSync(d.abs).isDirectory() ? d.abs : null; } catch (e) { return null; }
  }
  const m = at.match(/^line:([\w-]+)$/);
  const l = m && lines.find(x => x.id === m[1]);
  return l && l.sessionPath ? l.sessionPath : null;
}

module.exports = { createPty, resolveAt, readProfiles, loadNodePty, nodePtySpawn, MAX_TERMS };
