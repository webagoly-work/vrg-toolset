#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Kódváros segéd — the local companion for VRG Kódváros (live workspace P1, KV-03).
//
// Serves CodeCity/dist/vrg-codecity.html on http://localhost:8797 (a real origin) together with
// the files it loads from CodeCity/dist (vrg-codecity.data.js, *.city.json), and runs a fixed set
// of local actions the page asks for: open a tool the START.cmd way, open a folder, a terminal,
// Claude Code, VS Code (a folder, or a file of this repo: open-file, KV-05), a few read-only git commands, and a path check. Ported from the Kapu
// companion (CodeCity/from-kapu/companion-server.js, 87f2fca); the file:// page keeps working
// as a read-only view, it just has no actions.
//
//   node CodeCity/companion.js [--port 8797] [--no-open] [--config <file>] [--page <dist/x.html>]
//
// Security (report §1.1, CITY-D10 A): binds 127.0.0.1 only; checks Host and Origin against fixed
// sets (never derived from the request); every POST needs the per-install token from
// CodeCity/.companion-token, compared with timingSafeEqual; whitelisted actions with fixed argument
// shapes; every path must resolve (realpath) inside an allowed root, and every served file inside
// CodeCity/dist; programs start from argument arrays, never from a shell string built from request
// data, and detached, so they outlive this server. Nothing here writes to the repo.
// KP_DRY_RUN=1: echo what would be spawned instead of spawning (tests).
// ---------------------------------------------------------------------------

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');

const CITY = __dirname;
const REPO = path.resolve(CITY, '..');
const DIST = path.join(CITY, 'dist');
const TOKEN_FILE = path.join(CITY, '.companion-token');
const VERSION = '1';
const MAX_BODY = 16 * 1024;
const DRY = process.env.KP_DRY_RUN === '1';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8797));
const CONFIG = path.resolve(opt('--config', path.join(CITY, 'companion.config.json')));
const PAGE = path.resolve(DIST, path.basename(opt('--page', 'vrg-codecity.html')));

// ---- config: everything that names a program comes from here, never from a request
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const firstExisting = list => list.find(exists) || null;
function loadConfig() {
  let user = {};
  if (exists(CONFIG)) user = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const apps = path.join(REPO, 'Planner', 'apps');
  const browserExe = firstExisting([path.join(apps, 'chrome', 'chrome.exe'), path.join(apps, 'opera-gx', 'opera.exe'), path.join(apps, 'zen-browser', 'zen.exe')]);
  const wt = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'wt.exe');
  return {
    roots: [REPO, path.dirname(REPO)].concat(user.roots || []),
    browser: user.browser || (browserExe ? { exe: browserExe, args: browserExe.endsWith('chrome.exe') ? ['--new-window'] : [] } : null),
    claudeCmd: user.claudeCmd || firstExisting([path.join(apps, 'node', 'claude.cmd')]) || 'claude',
    terminal: user.terminal || (wt && exists(wt) ? 'wt' : 'cmd'),
    vscode: user.vscode || firstExisting([path.join(apps, 'vscode', 'Code.exe')]),
    git: user.git || firstExisting([path.join(apps, 'git', 'cmd', 'git.exe'), path.join(apps, 'git', 'bin', 'git.exe')]) || 'git'
  };
}
const CFG = loadConfig();
const real = p => { try { return fs.realpathSync(path.resolve(p)); } catch (e) { return path.resolve(p); } };
const ROOTS = CFG.roots.map(real);
const DIST_REAL = real(DIST);

function token() {
  if (!exists(TOKEN_FILE)) fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(24).toString('hex') + '\n', { mode: 0o600 });
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}
const TOKEN = token();

// ---- paths: relative ones are relative to the repo; the real path must sit inside a root
const norm = p => (process.platform === 'win32' ? p.toLowerCase() : p);
const under = (p, r) => { const n = norm(p), nr = norm(r); return n === nr || n.startsWith(nr + path.sep); };
const inRoots = p => ROOTS.some(r => under(p, r));
function safePath(p) {
  if (typeof p !== 'string' || !p || p.length > 1024 || p.includes('\0')) return null;
  let rp;
  try { rp = fs.realpathSync(path.resolve(REPO, p)); } catch (e) { return null; }
  return inRoots(rp) ? rp : null;
}

// ---- static files: one flat name from CodeCity/dist, a fixed set of types
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
function distFile(name) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('.')) return null;
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) return null;
  let rp;
  try { rp = fs.realpathSync(path.join(DIST, name)); } catch (e) { return null; }
  return under(rp, DIST_REAL) && rp !== DIST_REAL && fs.statSync(rp).isFile() ? { file: rp, type } : null;
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

// read-only git only (CITY-D10 A: no git writes from the city)
const GIT = { status: ['status', '--porcelain=v1', '-b'], worktrees: ['worktree', 'list', '--porcelain'], log1: ['log', '-1', '--format=%h %ci %s'] };
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
    if (!p || !under(p, real(REPO)) || norm(p) === norm(real(REPO))) return [403, { error: 'a repón kívül' }];
    return [200, openUrlOrFile(pathToFileURL(p).href)];
  } },
  'open-folder': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, launch('explorer.exe', [d])] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-terminal': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, Object.assign(terminalIn(d), { dir: d })] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-claude': { keys: ['dir'], async run(b) { const d = safeDir(b.dir); return d ? [200, Object.assign(terminalIn(d, CFG.claudeCmd), { dir: d })] : [403, { error: 'nem engedélyezett mappa' }]; } },
  'open-vscode': { keys: ['dir'], async run(b) {
    const d = safeDir(b.dir);
    if (!d) return [403, { error: 'nem engedélyezett mappa' }];
    return [200, CFG.vscode ? launch(CFG.vscode, [d]) : launch('cmd.exe', ['/c', 'code', '.'], d)];
  } },
  // a file of this repo in the portable VS Code, inside the repo's window (the folder first, then the file)
  'open-file': { keys: ['path'], async run(b) {
    const p = safePath(b.path);
    if (!p || !under(p, real(REPO)) || !fs.statSync(p).isFile()) return [403, { error: 'nem fájl ebben a repóban' }];
    return CFG.vscode ? [200, launch(CFG.vscode, [real(REPO), p])] : [404, { error: 'a hordozható VS Code nem található' }];
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
  const body = typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, { error: 'host' });
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    if (!exists(PAGE)) return send(res, 404, 'CodeCity/dist/' + path.basename(PAGE) + ' hiányzik — node CodeCity/build.js', 'text/plain; charset=utf-8');
    const html = fs.readFileSync(PAGE, 'utf8').replace(/<head>/i, m => m + '<script>window.KV_COMPANION={token:' + JSON.stringify(TOKEN) + ',port:' + LIVE_PORT + '};</script>');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') return send(res, 405, { error: 'csak GET' });
    const f = distFile(decodeURIComponent(url.pathname.slice(1)));
    return f ? send(res, 200, fs.readFileSync(f.file), f.type) : send(res, 404, { error: 'nincs ilyen' });
  }
  const origin = req.headers.origin;
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: 'origin' });
  if (req.method === 'GET' && url.pathname === '/api/status') return status().then(s => send(res, 200, s));
  if (req.method !== 'POST') return send(res, 405, { error: 'csak POST' });
  const given = req.headers['x-kodvaros-token'];
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
  if (e.code === 'EADDRINUSE') { console.error('A ' + PORT + ' port foglalt - fut mar a Kodvaros seged?'); process.exit(2); }
  throw e;
});
server.listen(PORT, '127.0.0.1', () => {
  const port = LIVE_PORT = server.address().port;
  HOSTS = new Set(['localhost:' + port, '127.0.0.1:' + port]);
  ORIGINS = new Set(['http://localhost:' + port, 'http://127.0.0.1:' + port]);
  console.log('Kodvaros seged: http://localhost:' + port + '/  (port ' + port + ')' + (DRY ? ' [dry run]' : ''));
  if (!args.includes('--no-open')) openUrlOrFile('http://localhost:' + port + '/');
});
