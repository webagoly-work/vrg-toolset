#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Kapu segéd — the local companion for VRG Kapu.
//
// Serves Hub/dist/vrg-kapu.html on http://localhost:8795 (a real origin, so the
// page can remember its settings) and runs a fixed set of local actions the page
// asks for: start START.cmd, open a tool the START.cmd way, open a folder, a terminal,
// Claude Code, VS Code, a few read-only git commands, and a path check. Since the
// 2026-10-26 rework the page uses only the first three; the rest wait for the dashboard.
//
//   node Hub/companion/server.js [--port 8795] [--no-open] [--config <file>]
//
// Security (00_CONTRACT §2): binds 127.0.0.1 only; checks Host and Origin; every
// POST needs the per-install token from Hub/companion/.token; whitelisted actions
// with fixed argument shapes; every path must resolve (realpath) inside an allowed
// root; programs start from argument arrays, never from a shell string built from
// request data, and detached, so they outlive this server.
// KP_DRY_RUN=1: echo what would be spawned instead of spawning (tests).
// ---------------------------------------------------------------------------

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');

const HUB = path.resolve(__dirname, '..');
const REPO = path.resolve(HUB, '..');
const PAGE = path.join(HUB, 'dist', 'vrg-kapu.html');
const TOKEN_FILE = path.join(__dirname, '.token');
const VERSION = '1';
const MAX_BODY = 16 * 1024;
const DRY = process.env.KP_DRY_RUN === '1';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8795));
const CONFIG = path.resolve(opt('--config', path.join(__dirname, 'config.json')));

// ---- config: everything that names a program comes from here, never from a request
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const firstExisting = list => list.find(exists) || null;
function loadConfig() {
  let user = {};
  if (exists(CONFIG)) user = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  // the portable toolchain and programs sit next to the repo (H:\VRG\Full\tools, \programs) since the 2026-10-27 re-root
  const tools = path.join(path.dirname(REPO), 'tools'), progs = path.join(path.dirname(REPO), 'programs');
  const browserExe = firstExisting([path.join(tools, 'chrome', 'chrome.exe'), path.join(progs, 'opera-gx', 'opera.exe'), path.join(progs, 'zen-browser', 'zen.exe')]);
  const wt = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'wt.exe');
  return {
    roots: [REPO, path.dirname(REPO)].concat(user.roots || []),
    browser: user.browser || (browserExe ? { exe: browserExe, args: browserExe.endsWith('chrome.exe') ? ['--new-window'] : [] } : null),
    claudeCmd: user.claudeCmd || firstExisting([path.join(tools, 'node', 'claude.cmd')]) || 'claude',
    terminal: user.terminal || (wt && exists(wt) ? 'wt' : 'cmd'),
    vscode: user.vscode || firstExisting([path.join(tools, 'vscode', 'Code.exe')]),
    git: user.git || firstExisting([path.join(tools, 'git', 'cmd', 'git.exe'), path.join(tools, 'git', 'bin', 'git.exe')]) || 'git'
  };
}
const CFG = loadConfig();
const ROOTS = CFG.roots.map(r => { try { return fs.realpathSync(path.resolve(r)); } catch (e) { return path.resolve(r); } });

function token() {
  if (!exists(TOKEN_FILE)) fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(24).toString('hex') + '\n', { mode: 0o600 });
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}
const TOKEN = token();

// ---- paths: relative ones are relative to the repo; the real path must sit inside a root
const norm = p => (process.platform === 'win32' ? p.toLowerCase() : p);
function inRoots(p) {
  const n = norm(p);
  return ROOTS.some(r => { const nr = norm(r); return n === nr || n.startsWith(nr + path.sep); });
}
function safePath(p) {
  if (typeof p !== 'string' || !p || p.length > 1024 || p.includes('\0')) return null;
  let real;
  try { real = fs.realpathSync(path.resolve(REPO, p)); } catch (e) { return null; }
  return inRoots(real) ? real : null;
}

// ---- spawning: argument arrays, detached, unref'd
function launch(exe, argv, cwd) {
  if (DRY) return { dryRun: true, exe, args: argv, cwd: cwd || null };
  const child = spawn(exe, argv, { cwd: cwd || undefined, detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', () => {});
  child.unref();
  return { started: true };
}
function openUrlOrFile(target) {
  return CFG.browser ? launch(CFG.browser.exe, (CFG.browser.args || []).concat(target)) : launch('explorer.exe', [target]);
}
function terminalIn(dir, command) {
  // the folder goes in as cwd, never on a command line; wt's ';' separator is avoided the same way
  if (CFG.terminal === 'wt') return launch('wt.exe', command ? ['-d', '.', 'cmd', '/k', command] : ['-d', '.'], dir);
  return launch('cmd.exe', command ? ['/k', command] : ['/k'], dir);
}

const GIT = { status: ['status', '--porcelain=v1', '-b'], pull: ['pull', '--ff-only'], worktrees: ['worktree', 'list', '--porcelain'], log1: ['log', '-1', '--format=%h %ci %s'] };
function git(argv) {
  return new Promise(resolve => execFile(CFG.git, argv, { cwd: REPO, timeout: 30000, windowsHide: true, maxBuffer: 1 << 20 },
    (err, stdout, stderr) => resolve({ ok: !err, code: err ? err.code : 0, out: String(stdout), err: String(stderr) })));
}
async function status() {
  const r = await git(GIT.status);
  if (!r.ok) return { ok: true, version: VERSION, repo: REPO, git: false };
  const lines = r.out.split('\n').filter(Boolean);
  const head = lines[0] || '';
  const m = head.match(/^## ([^.\s]+)(?:\.\.\.\S+)?(?: \[(.*)\])?/) || [];
  const num = k => { const x = (m[2] || '').match(new RegExp(k + ' (\\d+)')); return x ? +x[1] : 0; };
  return { ok: true, version: VERSION, repo: REPO, branch: m[1] || null, dirty: lines.length - 1, ahead: num('ahead'), behind: num('behind') };
}

// ---- the whitelist: exact keys, exact types
const shape = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) &&
  Object.keys(body).length === keys.length && keys.every(k => k in body);
const ACTIONS = {
  'open-tool': { keys: ['path'], async run(b) {
    if (typeof b.path !== 'string' || !/\.html?$/i.test(b.path)) return [400, { error: 'csak .html eszköz nyitható' }];
    const p = safePath(b.path);
    if (!p || !inRoots(p) || !norm(p).startsWith(norm(fs.realpathSync(REPO)) + path.sep)) return [403, { error: 'a repón kívül' }];
    return [200, openUrlOrFile(pathToFileURL(p).href)];
  } },
  // START.cmd in a console of its own; the command is fixed here, the folder goes in as cwd
  'open-start': { keys: [], async run() {
    const dir = path.join(REPO, 'Planner');
    if (!exists(path.join(dir, 'START.cmd'))) return [404, { error: 'Planner/START.cmd hiányzik' }];
    return [200, launch('cmd.exe', ['/c', 'START.cmd'], dir)];
  } },
  'open-folder': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, launch('explorer.exe', [d])] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-terminal': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, Object.assign(terminalIn(d), { dir: d })] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-claude': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, Object.assign(terminalIn(d, CFG.claudeCmd), { dir: d })] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-vscode': { keys: ['dir'], async run(b) {
    const d = safeDir(b.dir);
    if (!d) return [403, { error: 'nem engedélyezett mappa' }];
    return [200, CFG.vscode ? launch(CFG.vscode, [d]) : launch('cmd.exe', ['/c', 'code', '.'], d)];
  } },
  git: { keys: ['cmd'], async run(b) {
    if (!Object.prototype.hasOwnProperty.call(GIT, b.cmd)) return [400, { error: 'ismeretlen git parancs' }];
    if (DRY) return [200, { dryRun: true, exe: CFG.git, args: GIT[b.cmd] }];
    return [200, await git(GIT[b.cmd])];
  } },
  'check-paths': { keys: ['paths'], async run(b) {
    if (!Array.isArray(b.paths) || b.paths.length > 500 || !b.paths.every(p => typeof p === 'string')) return [400, { error: 'paths: legfeljebb 500 szöveg' }];
    return [200, Object.fromEntries(b.paths.map(p => [p, !!safePath(p)]))];
  } }
};
function safeDir(d) {
  const p = safePath(d);
  try { return p && fs.statSync(p).isDirectory() ? p : null; } catch (e) { return null; }
}

// ---- http
// filled in once listening (the port may be 0 = any, in tests)
let HOSTS = new Set(), ORIGINS = new Set(), LIVE_PORT = PORT;
function send(res, code, obj, type) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, { error: 'host' });
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    if (!exists(PAGE)) return send(res, 404, 'Hub/dist/vrg-kapu.html hiányzik — node tools/build-hub.js', 'text/plain; charset=utf-8');
    const html = fs.readFileSync(PAGE, 'utf8').replace(/<head>/i, m => m + '<script>window.KP_COMPANION={token:' + JSON.stringify(TOKEN) + ',port:' + LIVE_PORT + '};</script>');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }
  if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'nincs ilyen' });
  const origin = req.headers.origin;
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: 'origin' });
  if (req.method === 'GET' && url.pathname === '/api/status') return status().then(s => send(res, 200, s));
  if (req.method !== 'POST') return send(res, 405, { error: 'csak POST' });
  const given = req.headers['x-kapu-token'];
  if (typeof given !== 'string' || given.length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN))) return send(res, 401, { error: 'token' });
  const action = ACTIONS[url.pathname.slice(5)];
  if (!action) return send(res, 400, { error: 'ismeretlen művelet' });
  let size = 0, chunks = [], over = false;
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { over = true; req.destroy(); } else chunks.push(c); });
  req.on('close', () => { if (over && !res.headersSent) send(res, 413, { error: 'túl nagy kérés' }); });
  req.on('end', async () => {
    if (over) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 400, { error: 'nem JSON' }); }
    if (!shape(body, action.keys)) return send(res, 400, { error: 'várt mezők: ' + action.keys.join(', ') });
    try { const [code, out] = await action.run(body); send(res, code, out); }
    catch (e) { send(res, 500, { error: 'belső hiba' }); }
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('A ' + PORT + ' port foglalt — fut már a Kapu segéd?'); process.exit(2); }
  throw e;
});
server.listen(PORT, '127.0.0.1', () => {
  const port = LIVE_PORT = server.address().port;
  HOSTS = new Set(['localhost:' + port, '127.0.0.1:' + port]);
  ORIGINS = new Set(['http://localhost:' + port, 'http://127.0.0.1:' + port]);
  console.log('Kapu segéd: http://localhost:' + port + '/  (port ' + port + ')' + (DRY ? ' [dry run]' : ''));
  if (!args.includes('--no-open')) openUrlOrFile('http://localhost:' + port + '/');
});
