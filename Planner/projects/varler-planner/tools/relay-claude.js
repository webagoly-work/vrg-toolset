// ==========================================================================
// relay-claude.js — Claude Remote Control sessions on this PC, for VRG Mobile (WP M22 · Claude).
//
// What phone-relay-server.js needs to answer claude.list / claude.start / claude.stop for a trusted (paired, M2) phone,
// and only when the relay was started with --claude (RELAY_CLAUDE=1). VRG Mobile never signs in to Claude: the phone opens the
// session link in the official Claude app, signed in there. This PC runs `claude remote-control`, which makes a session of this
// PC reachable from claude.ai/code and the Claude app.
//
//   folders   START's own Claude Code menu (launcher/vrg-menu.json → start.dev → C), the items Mobile/catalogue/claude.json
//             names (its `folders` keys): each item's cwd is the folder. Ids are START keys, so a renamed item drops out.
//   the exe   START's {claude} (Full\tools\node\claude.cmd) resolved to the claude.exe it calls, so no cmd.exe and no shell.
//             Account A or B as the Desktop's profiles (Dashboard/config/profiles.json): B gets its CLAUDE_CONFIG_DIR.
//             VRG_CLAUDE_BIN (tests only, as the Desktop's claudeterm.js) replaces the exe; a .js runs through node.
//   start     `claude remote-control --name "VRG <folder> <HH:MM>"` in the folder, detached, no window, its output to
//             %TEMP%\VRG\claude\<id>.log. The session link it prints (https://claude.ai/…) is read from that log and passed
//             back. The sessions are kept in a file next to the paired phones, so a relay restart still lists and stops them.
//   stop      only a session this relay started, by its pid (the process tree on Windows).
//
// THE RULE (as relay-launch.js): the phone sends a folder key and an account letter, and both are only ever keys into lists
// built here. The session name is made here. No string from the phone reaches a command line, a path or a URL.
// ==========================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const menu = require(path.join(REPO, 'launcher', 'menu.js'));
const ALLOW_FILE = path.join(REPO, 'Mobile', 'catalogue', 'claude.json');
const PROFILES_FILE = path.join(REPO, 'Dashboard', 'config', 'profiles.json');

const KEY = /^[A-Z0-9]$/;
const SID = /^c[0-9]{1,6}$/;
/** A Remote Control session link: claude.ai only, no spaces or quotes. */
const LINK = /https:\/\/claude\.ai\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/;
const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*\x07/g;
const MAX = 6;                                         // sessions at once

/** The allow-list: { folders: Set<START key>, accounts: Set<'A'|'B'> }. */
function loadAllow(file = ALLOW_FILE) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { folders: new Set(((j.folders && j.folders.allow) || []).filter(k => KEY.test(k))), accounts: new Set(((j.accounts && j.accounts.allow) || ['A']).filter(a => a === 'A' || a === 'B')) };
}

/** START → C's items, narrowed by the allow-list: Map<key, { key, name, hint, cwd }>. `exists` is faked by the test. */
function buildFolders({ reg = menu.reload(), allow = loadAllow(), exists = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } } } = {}) {
  const c = ((reg.start && reg.start.dev) || []).find(x => x.key === 'C' && x.menu);
  const out = new Map();
  for (const it of (c ? c.menu.items : [])) {
    if (!allow.folders.has(it.key) || !it.cwd) continue;
    const cwd = menu.resolve(it.cwd);
    if (!path.isAbsolute(cwd) || !exists(cwd)) continue;
    out.set(it.key, { key: it.key, name: it.name, hint: it.hint || '', cwd });
  }
  return out;
}

/** {claude} → the exe to run (+ leading args): VRG_CLAUDE_BIN first, then claude.cmd's claude.exe, then the value itself. */
function claudeExe(env = process.env, { resolve = menu.resolve, exists = fs.existsSync, node = process.execPath } = {}) {
  const bin = env.VRG_CLAUDE_BIN;
  if (typeof bin === 'string' && bin && path.isAbsolute(bin)) return /\.js$/i.test(bin) ? { exe: node, lead: [bin], test: true } : { exe: bin, lead: [], test: true };
  const c = resolve('{claude}');
  if (!c || c === '{claude}') return null;
  if (/\.cmd$/i.test(c)) {
    const exe = path.join(path.dirname(c), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    return exists(exe) ? { exe, lead: [] } : null;
  }
  return exists(c) ? { exe: c, lead: [] } : null;
}

/** The account's environment: B gets the Desktop profile's CLAUDE_CONFIG_DIR. */
function accountEnv(account, { file = PROFILES_FILE, resolve = menu.resolve } = {}) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8')).find(x => x.id === (account === 'B' ? 'claude-b' : 'claude-a'));
  const env = {};
  for (const [k, v] of Object.entries((p && p.env) || {})) env[k] = resolve(String(v));
  return env;
}

/** The session's name, made here: "VRG <folder> <HH:MM>" (ASCII letters, digits and spaces only). */
function sessionName(folder, when = new Date()) {
  const n = String(folder.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30) || 'mappa';
  const t = String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0');
  return `VRG ${n} ${t}`;
}

/** The command for one session: [exe, args]. Every part comes from the registry, the profiles or the name made above. */
function command(bin, name) {
  return [bin.exe, [...bin.lead, 'remote-control', '--name', name]];
}

/** The first claude.ai link in a log, ANSI codes stripped; null when none yet. */
function linkIn(text) {
  const m = LINK.exec(String(text || '').replace(ANSI, ''));
  return m ? m[0].replace(/[).,;'\]]+$/, '') : null;
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

const defaultFile = () => path.join(process.env.RELAY_CLAUDE_FILE ? path.dirname(process.env.RELAY_CLAUDE_FILE) : path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'VRG'),
  process.env.RELAY_CLAUDE_FILE ? path.basename(process.env.RELAY_CLAUDE_FILE) : 'relay-claude.json');

/**
 * opts (the test fakes them): file, logDir, env, spawn(cmd, args, o) → { pid, unref() }, kill(pid) → Promise, alive(pid),
 * wait (ms to wait for the link), now() → Date.
 */
function createClaude(opts = {}) {
  const file = opts.file || defaultFile();
  const logDir = opts.logDir || path.join(os.tmpdir(), 'VRG', 'claude');
  const env = opts.env || process.env;
  const isAlive = opts.alive || alive;
  const wait = opts.wait != null ? opts.wait : 20000;
  const now = opts.now || (() => new Date());
  const spawnFn = opts.spawn || ((cmd, args, o) => spawn(cmd, args, o));
  const killFn = opts.kill || (pid => new Promise(res => {
    if (process.platform === 'win32') execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => res());
    else { try { process.kill(-pid, 'SIGTERM'); } catch (e) { try { process.kill(pid, 'SIGTERM'); } catch (e2) { /* gone */ } } res(); }
  }));

  function load() {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j.sessions) ? j.sessions.filter(s => s && SID.test(s.id)) : []; } catch (e) { return []; }
  }
  function save(list) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ kind: 'vrg-relay-claude', sessions: list }, null, 1)); }
  function logOf(s) { return path.join(logDir, s.id + '.log'); }
  function readLink(s) { try { return linkIn(fs.readFileSync(logOf(s), 'utf8')); } catch (e) { return null; } }

  /** The sessions this relay started, newest first, with whether each still runs and its link. Dead ones older than a day go. */
  function sessions() {
    const day = Date.now() - 24 * 3600 * 1000;
    const list = load().map(s => Object.assign({}, s, { alive: isAlive(s.pid) }));
    let changed = false;
    for (const s of list) if (!s.url && s.alive) { const u = readLink(s); if (u) { s.url = u; changed = true; } }
    const kept = list.filter(s => s.alive || s.started > day);
    if (changed || kept.length !== list.length) save(kept.map(({ alive: _, ...s }) => s));
    return kept.sort((a, b) => b.started - a.started).map(s => ({ id: s.id, name: s.name, folder: s.folder, account: s.account, started: s.started, url: s.url || null, alive: s.alive }));
  }

  async function start(folders, p) {
    p = p && typeof p === 'object' ? p : {};
    let allow;
    try { allow = opts.allow || loadAllow(); } catch (e) { return { ok: false, reason: 'A Claude engedélylista nem olvasható: ' + e.message }; }
    const key = typeof p.folder === 'string' && KEY.test(p.folder) && folders.has(p.folder) ? p.folder : null;
    if (!key) return { ok: false, reason: 'Ismeretlen mappa.' };
    const account = p.account === undefined ? 'A' : p.account;
    if ((account !== 'A' && account !== 'B') || !allow.accounts.has(account)) return { ok: false, reason: 'Ez a Claude-fiók nincs engedélyezve.' };
    const bin = opts.bin !== undefined ? opts.bin : claudeExe(env);
    if (!bin) return { ok: false, reason: 'A Claude Code nincs telepítve ezen a PC-n (START → C).' };
    const running = sessions().filter(s => s.alive);
    if (running.length >= MAX) return { ok: false, reason: `Már ${running.length} munkamenet fut; állíts le egyet.` };
    const folder = folders.get(key);
    const all = load();
    let n = 1; while (all.some(s => s.id === 'c' + n)) n++;
    const s = { id: 'c' + n, name: sessionName(folder, now()), folder: key, account, started: Date.now(), pid: 0, url: null };
    const [cmd, args] = command(bin, s.name);
    fs.mkdirSync(logDir, { recursive: true });
    const fd = fs.openSync(logOf(s), 'w');
    let child;
    try {
      child = spawnFn(cmd, args, { cwd: folder.cwd, detached: true, stdio: ['ignore', fd, fd], windowsHide: true,
        env: Object.assign({}, env, opts.accountEnv ? opts.accountEnv(account) : accountEnv(account)) });
    } catch (e) { fs.closeSync(fd); return { ok: false, reason: 'Nem indult el: ' + e.message }; }
    fs.closeSync(fd);
    if (child && child.unref) child.unref();
    s.pid = (child && child.pid) || 0;
    save(load().concat([s]));
    // the link: polled from the log until it appears, the process ends, or `wait` runs out
    const end = Date.now() + wait;
    while (Date.now() < end) {
      const u = readLink(s);
      if (u) { s.url = u; break; }
      if (!isAlive(s.pid)) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (s.url) save(load().map(x => (x.id === s.id ? Object.assign({}, x, { url: s.url }) : x)));
    const up = isAlive(s.pid);
    if (!up && !s.url) {
      let tail = '';
      try { tail = fs.readFileSync(logOf(s), 'utf8').replace(ANSI, '').trim().split(/\r?\n/).slice(-3).join(' · ').slice(0, 300); } catch (e) { /* no log */ }
      return { ok: false, reason: 'A Remote Control leállt' + (tail ? ': ' + tail : '.'), session: { id: s.id, name: s.name } };
    }
    return { ok: true, session: { id: s.id, name: s.name, folder: key, account, started: s.started, url: s.url, alive: up }, waiting: !s.url, cmd: opts.reportCmd ? [cmd, args] : undefined };
  }

  async function stop(id) {
    if (typeof id !== 'string' || !SID.test(id)) return { ok: false, reason: 'Ismeretlen munkamenet.' };
    const s = load().find(x => x.id === id);
    if (!s) return { ok: false, reason: 'Ezt a munkamenetet nem ez a relé indította.' };
    if (isAlive(s.pid)) await killFn(s.pid);
    save(load().filter(x => x.id !== id));
    return { ok: true, id };
  }

  return { sessions, start, stop, file };
}

module.exports = { loadAllow, buildFolders, claudeExe, accountEnv, sessionName, command, linkIn, alive, createClaude, LINK, SID, KEY, MAX };
