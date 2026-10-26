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
//   node CodeCity/companion.js [--port 8797] [--no-open] [--no-terminal] [--no-watch] [--config <file>] [--page <dist/x.html>]
//
// Live repo (P3, KV-08): one recursive fs.watch on the repo, minus the ignore list (.git/objects, node_modules,
// Planner/apps|home|data, Vendor, Inventory/.cache, dist); .git/HEAD, refs, logs/HEAD and worktrees are picked
// out of it as git events. After ~400 ms of quiet one event goes out on GET /api/stream (SSE, the page's
// cookie): 'fs' with only the changed repo paths, or 'git' when HEAD or a ref moved. GET /api/city rescans
// (scan.js into the temp folder, never CodeCity/dist) only when HEAD moved since the last scan.
//
// Live Claude (P4, KV-09, no settings change): while a page listens, `claude agents --json` is polled
// (every 6 s, by the agents-poll.js helper: starting claude.exe freezes the starting process ~3 s) and each running session's transcript is tailed from its current end
// through sessions.js's filter — kind + path, nothing else. The stream gets 'agents' (id, name, state,
// kind, whether its cwd is in the repo) and 'beam' (session id, kind, repo path; a path outside the repo
// is only counted). Nothing is written anywhere (CITY-D27 A: memory only).
//
// Hooks (P4, KV-10, CITY-D11 A): CodeCity/hook.js POSTs /api/hook {sid, event pre|post, kind, paths} with the
// token. Once a session reports through its hook, its transcript tail stops beaming (no doubles). A path
// outside the repo becomes an outskirts zone (drive + two folders, e.g. H:\cwebuser\backups) — the full
// path is never sent. Restricted zones (.ssh, Planner/data, Planner/home, *.credentials.json, H_BACKUP_*,
// *.pdf) are flagged red and are shown only, never blocked (CITY-D16 A, until P13).
//
// Fences and the conflict radar (P4, KV-11): every edit beam fences its file for that session (memory only,
// 3 days like Kapu's claims); every worktree fences what it changed against the main branch
// (git diff --name-only <main>...<branch>) plus its uncommitted files. A session working inside
// .claude/worktrees/<name>/ is mapped back to the city's path. 'fences' lists each fenced file with its
// owners; two or more owners = a conflict, flagged before any merge is tried.
//
// Embedded terminal (CITY-D15 C): term-open spawns ONLY cmd.exe or the configured claude, in a folder
// inside the roots, under a real console (ConPTY, Vendor/node-pty — node tools/fetch-vendor.js node-pty).
// Output goes out over GET /api/term-stream (Server-Sent Events), which the browser cannot give a header,
// so it is authorised by an HttpOnly SameSite=Strict cookie set with the page; input, resize and close
// are ordinary token-checked actions. A terminal is code execution by design: --no-terminal turns it off.
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
const os = require('os');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');

const CITY = __dirname;
const REPO = path.resolve(CITY, '..');
const DIST = path.join(CITY, 'dist');
const TOKEN_FILE = path.join(CITY, '.companion-token');
const VERSION = '1';
const MAX_BODY = 16 * 1024;
const DRY = process.env.KP_DRY_RUN === '1';
const VENDOR = path.join(REPO, 'Vendor');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8797));
const CONFIG = path.resolve(opt('--config', path.join(CITY, 'companion.config.json')));
const PAGE = path.resolve(DIST, path.basename(opt('--page', 'vrg-codecity.html')));
const TERMINAL = !args.includes('--no-terminal');
const WATCH = !args.includes('--no-watch');

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
    git: user.git || firstExisting([path.join(apps, 'git', 'cmd', 'git.exe'), path.join(apps, 'git', 'bin', 'git.exe')]) || 'git',
    // the claude binary itself (not the .cmd shim), for `claude agents --json`; a config can name another command
    agentsCmd: user.agentsCmd || [firstExisting([path.join(apps, 'node', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
      process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')].filter(Boolean)) || 'claude', 'agents', '--json'],
    transcripts: user.transcripts || null
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
const VENDOR_FILES = {
  'xterm.js': [path.join(VENDOR, 'xterm', 'lib', 'xterm.js'), TYPES['.js']],
  'xterm.css': [path.join(VENDOR, 'xterm', 'css', 'xterm.css'), 'text/css; charset=utf-8'],
  'addon-fit.js': [path.join(VENDOR, 'xterm-fit', 'lib', 'addon-fit.js'), TYPES['.js']]
};
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
  if (!r.ok) return { ok: true, version: VERSION, repo: REPO, git: false, terminal: terminalOn() };
  const lines = r.out.split('\n').filter(Boolean);
  const head = lines[0] || '';
  const m = head.match(/^## ([^.\s]+)(?:\.\.\.\S+)?(?: \[(.*)\])?/) || [];
  const num = k => { const x = (m[2] || '').match(new RegExp(k + ' (\\d+)')); return x ? +x[1] : 0; };
  return { ok: true, version: VERSION, repo: REPO, branch: m[1] || null, dirty: lines.length - 1, ahead: num('ahead'), behind: num('behind'), terminal: terminalOn() };
}

// ---- terminals: id -> { pty, buf (last output, for a reconnecting page), clients (SSE responses) }
let ptyLib;
function loadPty() {
  if (ptyLib === undefined) { try { ptyLib = require(path.join(VENDOR, 'node-pty')); } catch (e) { ptyLib = null; } }
  return ptyLib;
}
const terminalOn = () => TERMINAL && (DRY || !!loadPty());
const TERMS = new Map(), TERM_MAX = 8, TERM_BUF = 256 * 1024;
let termSeq = 0;
function termEmit(t, event, data) {
  const msg = (event ? 'event: ' + event + '\n' : '') + 'data: ' + JSON.stringify(data) + '\n\n';
  for (const res of t.clients) res.write(msg);
}
function termOpen(dir, kind) {
  // the program is fixed here; the folder is the cwd, never part of a command line
  const argv = kind === 'claude' ? ['/k', CFG.claudeCmd] : [];
  if (DRY) return { dryRun: true, exe: 'cmd.exe', args: argv, cwd: dir, pty: true };
  if (TERMS.size >= TERM_MAX) return { error: 'legfeljebb ' + TERM_MAX + ' terminál lehet nyitva' };
  const env = Object.assign({}, process.env);
  env.SystemRoot = env.SystemRoot || 'C:\\Windows';   // without it PowerShell inside fails (8009001d)
  const pty = loadPty().spawn('cmd.exe', argv, { name: 'xterm-256color', cols: 100, rows: 30, cwd: dir, env, useConpty: true });
  const id = 't' + (++termSeq), t = { id, pty, kind, dir, buf: '', clients: new Set(), exited: null };
  pty.onData(d => { t.buf = (t.buf + d).slice(-TERM_BUF); termEmit(t, '', d); });
  pty.onExit(e => { t.exited = e.exitCode; termEmit(t, 'exit', e.exitCode); for (const r of t.clients) r.end(); TERMS.delete(id); });
  TERMS.set(id, t);
  return { id, kind, dir };
}
const termOf = id => (typeof id === 'string' ? TERMS.get(id) : null);
process.on('exit', () => { for (const t of TERMS.values()) try { t.pty.kill(); } catch (e) { /* gone */ } });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) process.on(sig, () => process.exit(0));

// ---- live repo: watch -> debounce -> SSE; the city rescanned on demand when HEAD moved
const LIVE_IGNORE = ['.git/objects/', 'node_modules/', 'Planner/apps/', 'Planner/home/', 'Planner/data/', 'Vendor/', 'Inventory/.cache/', 'CodeCity/dist/'];
const LIVE_GIT = /^\.git\/(HEAD|refs\/|logs\/HEAD|worktrees\/)/;
const LIVE_DEBOUNCE = 400;
const live = { clients: new Set(), fs: new Map(), git: false, timer: null, head: '', city: null, cityHead: null, scanning: null, watcher: null };
function liveEmit(event, data) {
  const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (const res of live.clients) res.write(msg);
}
async function liveHead() { const r = await git(['rev-parse', '--short', 'HEAD']); return r.ok ? r.out.trim() : ''; }
function liveFlush() {
  live.timer = null;
  if (live.fs.size) {
    const paths = [...live.fs].map(([p, kind]) => ({ p, kind }));
    live.fs.clear();
    liveEmit('fs', { paths, at: Date.now() });
  }
  if (live.git) {
    live.git = false;
    liveHead().then(head => { if (head && head !== live.head) { live.head = head; liveEmit('git', { head, at: Date.now() }); } });
  }
}
function liveOn(type, name) {
  if (!name) return;
  const rel = String(name).replace(/\\/g, '/');
  if (rel === '.git') return;
  if (rel.startsWith('.claude/worktrees/')) { worktreesSoon(); return; }
  if (rel.startsWith('.git/worktrees/') || /^\.git\/(HEAD|refs\/)/.test(rel)) worktreesSoon();
  if (rel.startsWith('.git/')) { if (LIVE_GIT.test(rel)) live.git = true; else return; }
  else if (LIVE_IGNORE.some(ig => rel.startsWith(ig)) || /(^|\/)(node_modules|\.cache)\//.test(rel)) return;
  else {
    let st = null;
    try { st = fs.statSync(path.join(REPO, rel)); } catch (e) { /* gone */ }
    if (st && st.isDirectory()) return;   // a folder's own event: its files report themselves
    live.fs.set(rel, st ? (type === 'rename' ? 'új / átnevezve' : 'módosult') : 'törölve');
  }
  clearTimeout(live.timer);
  live.timer = setTimeout(liveFlush, LIVE_DEBOUNCE);
}
function liveStart() {
  if (!WATCH || live.watcher) return;
  try {
    live.watcher = fs.watch(REPO, { recursive: true }, liveOn);
    // a burst (git checkout) can overflow the OS buffer: then say 'everything may have changed' via git
    live.watcher.on('error', () => { live.git = true; liveFlush(); });
  } catch (e) { live.watcher = null; }
  liveHead().then(h => { live.head = h; });
}
// the city as of HEAD now: the last scan when HEAD has not moved, else a fresh scan.js into the temp folder
function liveCity() {
  if (live.scanning) return live.scanning;
  return live.scanning = liveHead().then(head => {
    if (live.city && head === live.cityHead) return live.city;
    const out = path.join(os.tmpdir(), 'kodvaros-live-' + process.pid + '.city.json');
    return new Promise(resolve => execFile(process.execPath, [path.join(CITY, 'scan.js'), REPO, '--out', out], { timeout: 120000, windowsHide: true },
      err => { if (!err) try { live.city = fs.readFileSync(out, 'utf8'); live.cityHead = head; } catch (e) { /* keep the last */ } resolve(live.city); }));
  }).finally(() => { live.scanning = null; });
}

// ---- live Claude: sessions + transcript tails -> 'agents' and 'beam' events
const SESS = require('./sessions.js');
const AGENTS_EVERY = 6000, TAIL_EVERY = 1000;
const agents = { list: [], sig: '', poller: null, idleSince: 0, tails: new Map(), tailTimer: null, hooked: new Set() };
const repoReal = () => real(REPO);
const keyOf = x => (process.platform === 'win32' ? x.toLowerCase() : x).replace(/\\/g, '/').replace(/\/+$/, '');
// a path as the repo spells it ('' = the repo itself), or null when it is outside the repo
function repoRel(abs) {
  const a = keyOf(abs), r = keyOf(repoReal());
  if (a === r) return '';
  if (!a.startsWith(r + '/')) return null;
  return path.relative(repoReal(), abs).replace(/\\/g, '/');
}
// restricted zones: shown red, never blocked (D16 A); the name says what matched, not the path
const RESTRICTED = [[/(^|\/)\.ssh(\/|$)/i, '.ssh'], [/(^|\/)planner\/(data|home)(\/|$)/i, 'Planner/data, Planner/home'],
  [/\.credentials\.json$/i, '*.credentials.json'], [/(^|\/)h_backup_[^/]*(\/|$)/i, 'H_BACKUP_*'], [/\.pdf$/i, 'ügyfél-PDF (*.pdf)']];
const restrictedOf = rel => { const x = RESTRICTED.find(([re]) => re.test(rel)); return x ? x[1] : null; };
// a beam for one path: inside the repo -> its repo path; outside -> only its zone (drive + two folders)
function beamFor(id, kind, abs, phase) {
  const rel = repoRel(abs), out = { id, kind, at: Date.now() };
  if (phase) out.phase = phase;
  const k = keyOf(abs), r = restrictedOf(rel === null ? k : rel);
  if (r) out.restricted = r;
  if (rel !== null) {
    const wt = /^\.claude\/worktrees\/([^/]+)\/(.*)$/.exec(rel);
    out.p = wt ? wt[2] : rel;
    if (wt) out.wt = wt[1];
    if (kind === 2 && phase !== 'post') fenceAdd(id, out.p);
    return out;
  }
  const parts = path.resolve(abs).split(/[\\/]+/).filter(Boolean);
  out.outside = true;
  out.zone = parts.slice(0, parts.length > 3 ? 3 : Math.max(1, parts.length - 1)).join('\\');
  return out;
}
// ---- fences: path -> Map(owner -> time); owners are 's:<session>' (edits) and 'w:<worktree>' (git)
const FENCE_DAYS = 3;
const fences = { bySession: new Map(), byWorktree: new Map(), sig: '', timer: null, wtTimer: null, wtBusy: false };
function fenceAdd(id, rel) {
  let m = fences.bySession.get(rel);
  if (!m) fences.bySession.set(rel, m = new Map());
  m.set(id, Date.now());
  fencesSoon();
}
function fencesList() {
  const cut = Date.now() - FENCE_DAYS * 86400000, all = new Map();
  const own = (rel, o) => { if (!all.has(rel)) all.set(rel, []); all.get(rel).push(o); };
  for (const [rel, m] of fences.bySession) for (const [id, t] of m) { if (t < cut) m.delete(id); else own(rel, { kind: 'session', id }); }
  for (const [name, files] of fences.byWorktree) for (const rel of files) own(rel, { kind: 'worktree', id: name });
  return [...all].filter(([, o]) => o.length).map(([rel, owners]) => ({ p: rel, owners, conflict: owners.length > 1 })).sort((a, b) => a.p < b.p ? -1 : 1);
}
function fencesSoon() {
  clearTimeout(fences.timer);
  fences.timer = setTimeout(() => {
    const list = fencesList(), sig = JSON.stringify(list);
    if (sig !== fences.sig) { fences.sig = sig; liveEmit('fences', { list }); }
  }, 300);
}
// every worktree except the main checkout: what its branch changed against main, plus what is not committed yet
async function worktreesScan() {
  if (fences.wtBusy) return; fences.wtBusy = true;
  try {
    const wl = await git(['worktree', 'list', '--porcelain']);
    const main = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim() || 'main';
    const next = new Map();
    for (const block of wl.ok ? wl.out.split(/\r?\n\r?\n/) : []) {
      const dir = (/^worktree (.*)$/m.exec(block) || [])[1], br = (/^branch refs\/heads\/(.*)$/m.exec(block) || [])[1];
      if (!dir || keyOf(dir) === keyOf(repoReal())) continue;
      const name = path.basename(dir), files = new Set();
      if (br) { const d = await git(['diff', '--name-only', main + '...' + br]); if (d.ok) d.out.split(/\r?\n/).filter(Boolean).forEach(f => files.add(f)); }
      const st = await new Promise(res => execFile(CFG.git, ['-C', dir, 'status', '--porcelain=v1', '-uall'], { timeout: 30000, windowsHide: true, maxBuffer: 4 << 20 },
        (err, out) => res(err ? '' : String(out))));
      for (const line of st.split(/\r?\n/)) { const f = line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''); if (f) files.add(f); }
      if (files.size) next.set(name, [...files].slice(0, 2000));
    }
    fences.byWorktree = next;
    fencesSoon();
  } finally { fences.wtBusy = false; }
}
function worktreesSoon() { clearTimeout(fences.wtTimer); fences.wtTimer = setTimeout(worktreesScan, 1500); }
function transcriptOf(sid) {
  for (const base of CFG.transcripts || [SESS.projectsBase()]) {
    let dirs; try { dirs = fs.readdirSync(base); } catch (e) { continue; }
    for (const d of dirs) { const f = path.join(base, d, sid + '.jsonl'); if (exists(f)) return f; }
  }
  return null;
}
// the helper process: started with the first listening page, stopped 30 s after the last one left
function agentsPoller(on) {
  if (on && !agents.poller) {
    const child = spawn(process.execPath, [path.join(CITY, 'agents-poll.js'), String(AGENTS_EVERY), ...CFG.agentsCmd], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    let buf = '';
    child.stdout.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1); try { agentsHandle(JSON.parse(line)); } catch (e) { /* skip */ } } });
    child.on('exit', () => { if (agents.poller === child) agents.poller = null; });
    child.on('error', () => {});
    agents.poller = child;
  } else if (!on && agents.poller) { try { agents.poller.stdin.end(); agents.poller.kill(); } catch (e) { /* gone */ } agents.poller = null; }
}
process.on('exit', () => agentsPoller(false));
function agentsHandle(list) {
  if (!Array.isArray(list)) return;
  agents.list = list.filter(a => a && a.sessionId).map(a => ({ id: String(a.id || a.sessionId).slice(0, 8), sid: String(a.sessionId),
    name: String(a.name || '').slice(0, 80), state: String(a.state || a.status || ''), kind: String(a.kind || ''),
    inRepo: typeof a.cwd === 'string' && repoRel(a.cwd) !== null, startedAt: +a.startedAt || 0 }));
  const pub = agents.list.map(({ sid, ...rest }) => rest);
  const sig = JSON.stringify(pub);
  if (sig !== agents.sig) { agents.sig = sig; liveEmit('agents', { list: pub }); }
  // tail the sessions that may still act; drop the rest
  const keep = new Set();
  for (const a of agents.list) {
    if (a.state === 'done' || a.state === 'failed') continue;
    keep.add(a.sid);
    if (!agents.tails.has(a.sid)) {
      const f = transcriptOf(a.sid);
      let off = 0; try { off = fs.statSync(f).size; } catch (e) { /* not yet */ }
      agents.tails.set(a.sid, { id: a.id, file: f, off, rest: '', seen: new Set() });
    }
  }
  for (const sid of agents.tails.keys()) if (!keep.has(sid)) agents.tails.delete(sid);
}
function tailOnce() {
  if (!live.clients.size) {   // nobody listening: stop the poller after 30 s
    if (!agents.idleSince) agents.idleSince = Date.now();
    else if (agents.poller && Date.now() - agents.idleSince > 30000) agentsPoller(false);
    return;
  }
  agents.idleSince = 0;
  for (const [sid, t] of agents.tails) {
    if (!t.file) { t.file = transcriptOf(sid); if (!t.file) continue; try { t.off = fs.statSync(t.file).size; } catch (e) { /* later */ } continue; }
    let size; try { size = fs.statSync(t.file).size; } catch (e) { continue; }
    if (size < t.off) t.off = 0;   // rewritten
    if (size === t.off) continue;
    const fd = fs.openSync(t.file, 'r'), buf = Buffer.alloc(Math.min(size - t.off, 4 << 20));
    fs.readSync(fd, buf, 0, buf.length, t.off); fs.closeSync(fd);
    t.off += buf.length;
    const lines = (t.rest + buf.toString('utf8')).split('\n');
    t.rest = lines.pop();
    for (const line of lines) {
      if (!line.includes('"tool_use"')) continue;
      let o; try { o = JSON.parse(line); } catch (e) { continue; }
      const c = o.message && o.message.content;
      if (o.type !== 'assistant' || !Array.isArray(c)) continue;
      for (const b of c) {
        if (b.type !== 'tool_use' || t.seen.has(b.id)) continue;
        t.seen.add(b.id);
        if (agents.hooked.has(t.id)) continue;   // its hook reports this call already
        for (const { kind, p: tp } of SESS.callPaths(b) || []) liveEmit('beam', beamFor(t.id, kind, path.resolve(o.cwd || REPO, tp)));
      }
    }
  }
}
function agentsStart() {
  agentsPoller(true);
  if (agents.tailTimer) return;
  agents.tailTimer = setInterval(tailOnce, TAIL_EVERY);
  agents.tailTimer.unref();
}

// ---- catalog for the Ctrl+K palette (read-only GET): START.cmd tools, shortcut prompts, project agents, branches
async function catalog() {
  const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
  const list = (dir, ext) => { try { return fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort(); } catch (e) { return []; } };
  const start = read(path.join(REPO, 'Planner', 'START.cmd')), tools = [];
  for (const m of start.matchAll(/^set "T(\d+)_NAME=(.*)"\r?$/gm)) {
    const pm = new RegExp('^set "T' + m[1] + '_PATH=(.*)"\\r?$', 'm').exec(start);
    if (pm) tools.push({ n: +m[1], name: m[2], path: path.relative(REPO, path.resolve(REPO, 'Planner', pm[1].replace(/\\/g, '/'))).replace(/\\/g, '/') });
  }
  const pdir = path.join(REPO, 'tools', 'prompts'), adir = path.join(REPO, '.claude', 'agents');
  const prompts = list(pdir, '.txt').map(f => ({ name: f.replace(/\.txt$/, ''), text: read(path.join(pdir, f)).slice(0, 5000) }));
  const agents = list(adir, '.md').map(f => {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(path.join(adir, f))), get = k => (fm && new RegExp('^' + k + ':\\s*(.*)$', 'm').exec(fm[1]) || [])[1] || '';
    return { name: get('name') || f.replace(/\.md$/, ''), description: get('description').slice(0, 300) };
  });
  const b = await git(['branch', '--format=%(refname:short)']);
  return { tools, prompts, agents, branches: b.ok ? b.out.split('\n').map(s => s.trim()).filter(Boolean) : [] };
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
  'term-open': { keys: ['dir', 'kind'], async run(b) {
    if (!terminalOn()) return [503, { error: TERMINAL ? 'A beágyazott terminálhoz: node tools/fetch-vendor.js node-pty xterm xterm-fit' : 'A terminál ki van kapcsolva (--no-terminal)' }];
    if (b.kind !== 'shell' && b.kind !== 'claude') return [400, { error: 'kind: shell vagy claude' }];
    const d = safeDir(b.dir);
    if (!d) return [403, { error: 'nem engedélyezett mappa' }];
    const r = termOpen(d, b.kind);
    return r.error ? [429, r] : [200, r];
  } },
  'term-input': { keys: ['id', 'data'], async run(b) {
    const t = termOf(b.id);
    if (!t || typeof b.data !== 'string') return [404, { error: 'nincs ilyen terminál' }];
    t.pty.write(b.data); return [200, { ok: true }];
  } },
  'term-resize': { keys: ['id', 'cols', 'rows'], async run(b) {
    const t = termOf(b.id), ok = n => Number.isInteger(n) && n > 1 && n < 1000;
    if (!t || !ok(b.cols) || !ok(b.rows)) return [400, { error: 'id, cols, rows' }];
    t.pty.resize(b.cols, b.rows); return [200, { ok: true }];
  } },
  'term-close': { keys: ['id'], async run(b) {
    const t = termOf(b.id);
    if (!t) return [404, { error: 'nincs ilyen terminál' }];
    try { t.pty.kill(); } catch (e) { /* already gone */ }
    return [200, { ok: true }];
  } },
  // from CodeCity/hook.js: what one tool call of a Claude session is about to touch (pre) or touched (post)
  hook: { keys: ['sid', 'event', 'kind', 'paths'], async run(b) {
    const ok = typeof b.sid === 'string' && /^[0-9a-f-]{1,8}$/i.test(b.sid) && (b.event === 'pre' || b.event === 'post') &&
      [0, 1, 2].includes(b.kind) && Array.isArray(b.paths) && b.paths.length <= 20 && b.paths.every(x => typeof x === 'string' && x.length < 1024 && path.isAbsolute(x));
    if (!ok) return [400, { error: 'sid, event (pre|post), kind (0|1|2), paths (absolute, max 20)' }];
    agents.hooked.add(b.sid);
    for (const x of b.paths) liveEmit('beam', beamFor(b.sid, b.kind, x, b.event));
    return [200, { ok: true }];
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
    res.setHeader('Set-Cookie', 'kv_t=' + TOKEN + '; HttpOnly; SameSite=Strict; Path=/api/');   // for the SSE stream only
    return send(res, 200, html, 'text/html; charset=utf-8');
  }
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') return send(res, 405, { error: 'csak GET' });
    if (url.pathname.startsWith('/vendor/')) {
      const v = Object.prototype.hasOwnProperty.call(VENDOR_FILES, url.pathname.slice(8)) && VENDOR_FILES[url.pathname.slice(8)];
      return v && exists(v[0]) ? send(res, 200, fs.readFileSync(v[0]), v[1]) : send(res, 404, { error: 'nincs ilyen' });
    }
    const f = distFile(decodeURIComponent(url.pathname.slice(1)));
    return f ? send(res, 200, fs.readFileSync(f.file), f.type) : send(res, 404, { error: 'nincs ilyen' });
  }
  const origin = req.headers.origin;
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: 'origin' });
  if (req.method === 'GET' && url.pathname === '/api/status') return status().then(s => send(res, 200, s));
  if (req.method === 'GET' && url.pathname === '/api/catalog') return catalog().then(c => send(res, 200, c));
  if (req.method === 'GET' && (url.pathname === '/api/stream' || url.pathname === '/api/city')) {
    const ck = /(?:^|;\s*)kv_t=([0-9a-f]+)/.exec(String(req.headers.cookie || ''));
    if (!ck || ck[1].length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(ck[1]), Buffer.from(TOKEN))) return send(res, 401, { error: 'token' });
    if (url.pathname === '/api/city') return liveCity().then(c => (c ? send(res, 200, c) : send(res, 503, { error: 'a felmérés nem sikerült' })));
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.write('retry: 3000\n\n');
    res.write('event: hello\ndata: ' + JSON.stringify({ head: live.head, watching: !!live.watcher }) + '\n\n');
    if (agents.sig) res.write('event: agents\ndata: ' + agents.sig.replace(/^/, '{"list":') + '}\n\n');
    if (fences.sig) res.write('event: fences\ndata: {"list":' + fences.sig + '}\n\n');
    worktreesSoon();
    live.clients.add(res);
    agentsStart();
    req.on('close', () => live.clients.delete(res));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/term-stream') {
    const ck = /(?:^|;\s*)kv_t=([0-9a-f]+)/.exec(String(req.headers.cookie || ''));
    if (!ck || ck[1].length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(ck[1]), Buffer.from(TOKEN))) return send(res, 401, { error: 'token' });
    const t = termOf(url.searchParams.get('id'));
    if (!t) return send(res, 404, { error: 'nincs ilyen terminál' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.write('retry: 2000\n\n');
    if (t.buf) res.write('data: ' + JSON.stringify(t.buf) + '\n\n');   // what happened before this page joined
    t.clients.add(res);
    req.on('close', () => t.clients.delete(res));
    return;
  }
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
  liveStart();
  console.log('Kodvaros seged: http://localhost:' + port + '/  (port ' + port + ')' + (DRY ? ' [dry run]' : ''));
  if (!args.includes('--no-open')) openUrlOrFile('http://localhost:' + port + '/');
});
