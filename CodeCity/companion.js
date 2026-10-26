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
// File panel (P5, KV-12; CITY-D10 A, D14 A): GET /api/file (cookie) reads a text file of the repo — not .git,
// not a restricted zone, at most 2 MB. POST file-save (token) is the only write the segéd does: the page shows a
// diff and asks first; here the file must still be what the page opened (else 409), the current copy goes to
// .cache/vrg-safety/<time>/<path> (gitignored) before anything is written, and the file's line ends are kept.
// CodeMirror 6 comes from Vendor as ES modules (/vendor/esm/<slug>/…, a fixed list), mapped by an import map
// that is put into the served page.
//
// Jobs (P6, KV-14): the Node servers of START.cmd's HELYI SZERVEREK list (read from START.cmd, never a second
// list) plus a fixed set of builds and tests; started from argument arrays with this Node, output kept in a
// 500-line ring per job and streamed ('job', 'joblog'); stop = taskkill /PID <pid> /T /F (the whole tree).
// The port street: the TCP LISTEN table (netstat -ano) + process names (tasklist), polled every 5 s while a
// page listens ('ports'). Only listening ports, never connections.
// Pipes (P6, KV-15): for each build, the newest source file against the page it builds; a source newer than
// the page = a stale build ('pipes', rechecked on file changes). Each test and build job names the district
// it speaks for, so the page can put weather over it.
//
// Git as metro lines (P7, KV-16), read-only: GET /api/gitmap — every local branch against the main branch
// (ahead/behind, the files it changed = its stations, its last commits), the worktrees and the HEAD reflog;
// GET /api/merge-preview?branch= — git merge-tree --write-tree (git 2.38+; the portable git is 2.55), which
// merges in memory and touches neither the working tree nor a ref: clean, or the conflicting files. The city
// never merges (CITY-D10 A); merging is a pre-filled Claude prompt, so no safety ref is ever needed here.
//
// The Land (P8, KV-17): GET /api/land = CodeCity/land.json (places on fixed hex slots). GET /api/disk = Tárház:
// disk-walk.js sums the H: drive's folder sizes in its own process (~45 s, two levels, links not followed,
// restricted folders walled); the answer is kept in memory only (CITY-D27 A, the user's choice 2026-10-26) and
// re-walked after 10 minutes; a finished walk goes out on the stream as 'disk'.
//
// Erőmű, Pályaudvar, Határ, shoreline (P8, KV-18; Tier 0, unelevated, read-only; CITY-D23 A, D24 A): while a page
// listens, probe-tier0.ps1 samples CPU / RAM / disk / NIC / GPU every ~3 s ('power'); tracert finds the chain once
// (this PC → the TP-Link station → the Huawei border → the ISP), then a ping to each every 10 s says which is up,
// and arp -a counts the devices on the station's yard. Established connections leaving the LAN are counted per dock
// of CodeCity/ports.json (by remote port) and per country (DB-IP Lite in .cache/dbip, if fetched). Only counts go
// out ('net'): no address, no host name (CITY-D27 A).
//
// Embedded terminal (CITY-D15 C): term-open spawns ONLY cmd.exe or the configured claude, in a folder
// inside the roots, under a real console (ConPTY, Vendor/node-pty — node tools/fetch-vendor.js node-pty).
// Output goes out over GET /api/term-stream (Server-Sent Events), which the browser cannot give a header,
// so it is authorised by an HttpOnly SameSite=Strict cookie set with the page; input, resize and close
// are ordinary token-checked actions. A terminal is code execution by design: --no-terminal turns it off.
// A Claude tab starts as `claude --session-id <uuid> -n kodvaros-<folder>` (KV-13), so after a restart of the
// segéd term-resume can bring exactly that conversation back (`claude --resume <uuid>`; only a UUID is accepted).
// The terminals get a CLAUDE_CODE_GIT_BASH_PATH that exists (the portable Git) when the inherited one does not.
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
    transcripts: user.transcripts || null,
    // Claude Code needs Git Bash on Windows; the user-level value may point to a folder that is gone
    gitBash: user.gitBash || (exists(process.env.CLAUDE_CODE_GIT_BASH_PATH || '') ? process.env.CLAUDE_CODE_GIT_BASH_PATH
      : firstExisting([path.join(apps, 'git', 'bin', 'bash.exe'), 'H:\\_desktop\\Git\\bin\\bash.exe']))
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
  'addon-fit.js': [path.join(VENDOR, 'xterm-fit', 'lib', 'addon-fit.js'), TYPES['.js']],
  'markdown-it.js': [path.join(VENDOR, 'markdown-it', 'dist', 'browser', 'markdown-it.umd.min.js'), TYPES['.js']],
  'purify.js': [path.join(VENDOR, 'dompurify', 'dist', 'purify.min.js'), TYPES['.js']]
};
// CodeMirror 6 and its parts, as ES modules: bare name -> Vendor folder + entry (the page's import map)
const ESM = {
  '@codemirror/state': ['cm-state', 'dist/index.js'], '@codemirror/view': ['cm-view', 'dist/index.js'], '@codemirror/commands': ['cm-commands', 'dist/index.js'],
  '@codemirror/language': ['cm-language', 'dist/index.js'], '@codemirror/merge': ['cm-merge', 'dist/index.js'], '@codemirror/streamparser': ['cm-streamparser', 'dist/index.js'],
  '@lezer/common': ['lezer-common', 'dist/index.js'], '@lezer/highlight': ['lezer-highlight', 'dist/index.js'], '@lezer/lr': ['lezer-lr', 'dist/index.js'],
  '@marijn/find-cluster-break': ['find-cluster-break', 'src/index.js'], crelt: ['crelt', 'index.js'], 'style-mod': ['style-mod', 'src/style-mod.js'], 'w3c-keyname': ['w3c-keyname', 'index.js']
};
const ESM_SLUGS = new Set(Object.values(ESM).map(x => x[0]));
const IMPORT_MAP = JSON.stringify({ imports: Object.fromEntries(Object.entries(ESM).map(([n, [slug, f]]) => [n, '/vendor/esm/' + slug + '/' + f])) });
const esmReady = () => [...ESM_SLUGS].every(sl => exists(path.join(VENDOR, sl, 'package.json')));
function esmFile(rest) {
  const m = /^([a-z0-9-]+)\/((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.js)$/.exec(rest);
  if (!m || !ESM_SLUGS.has(m[1]) || m[2].split('/').some(x => x === '..' || x.startsWith('.'))) return null;
  const base = path.join(VENDOR, m[1]);
  let rp; try { rp = fs.realpathSync(path.join(base, m[2])); } catch (e) { return null; }
  return under(rp, real(base)) ? rp : null;
}
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
  // core.quotepath=false: Hungarian file names come back as written, not as \303\263 escapes
  return new Promise(resolve => execFile(CFG.git, ['-c', 'core.quotepath=false', ...argv], { cwd: REPO, timeout: 30000, windowsHide: true, maxBuffer: 1 << 20 },
    (err, stdout, stderr) => resolve({ ok: !err, code: err ? err.code : 0, out: String(stdout), err: String(stderr) })));
}
async function status() {
  const r = await git(GIT.status);
  if (!r.ok) return { ok: true, version: VERSION, repo: REPO, git: false, terminal: terminalOn(), editor: esmReady() };
  const lines = r.out.split('\n').filter(Boolean);
  const head = lines[0] || '';
  const m = head.match(/^## ([^.\s]+)(?:\.\.\.\S+)?(?: \[(.*)\])?/) || [];
  const num = k => { const x = (m[2] || '').match(new RegExp(k + ' (\\d+)')); return x ? +x[1] : 0; };
  return { ok: true, version: VERSION, repo: REPO, branch: m[1] || null, dirty: lines.length - 1, ahead: num('ahead'), behind: num('behind'), terminal: terminalOn(), editor: esmReady() };
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
// a segéd started from inside a Claude session inherits that session's markers; a Claude in the panel would then
// count as its child (no transcript, so no resume) and get its messaging channel — drop them, keep the user's
// own settings (CLAUDE_CONFIG_DIR, the Git Bash path, …)
const CLAUDE_SESSION_ENV = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_JOB_DIR|CLAUDE_EFFORT|CLAUDE_CODE_(AGENT|CHILD_SESSION|ENTRYPOINT|EXECPATH|MESSAGING_\w+|SESSION_\w+|ALT_SCREEN_FULL_REPAINT))$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function termOpen(dir, kind, resume) {
  // the program is fixed here; the folder is the cwd, never part of a command line; the only values that
  // reach the line are a UUID (made here, or checked against UUID) and a name made of [a-z0-9-]
  let argv = [], session = null;
  if (kind === 'claude') {
    session = resume || crypto.randomUUID();
    const label = 'kodvaros-' + (path.basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repo');
    argv = resume ? ['/k', CFG.claudeCmd, '--resume', session] : ['/k', CFG.claudeCmd, '--session-id', session, '-n', label];
  }
  if (DRY) return { dryRun: true, exe: 'cmd.exe', args: argv, cwd: dir, pty: true, session };
  if (TERMS.size >= TERM_MAX) return { error: 'legfeljebb ' + TERM_MAX + ' terminál lehet nyitva' };
  const env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) if (CLAUDE_SESSION_ENV.test(k)) delete env[k];
  env.SystemRoot = env.SystemRoot || 'C:\\Windows';   // without it PowerShell inside fails (8009001d)
  if (CFG.gitBash) env.CLAUDE_CODE_GIT_BASH_PATH = CFG.gitBash;
  const pty = loadPty().spawn('cmd.exe', argv, { name: 'xterm-256color', cols: 100, rows: 30, cwd: dir, env, useConpty: true });
  const id = 't' + (++termSeq), t = { id, pty, kind, dir, session, buf: '', clients: new Set(), exited: null };
  pty.onData(d => { t.buf = (t.buf + d).slice(-TERM_BUF); termEmit(t, '', d); });
  pty.onExit(e => { t.exited = e.exitCode; termEmit(t, 'exit', e.exitCode); for (const r of t.clients) r.end(); TERMS.delete(id); });
  TERMS.set(id, t);
  return { id, kind, dir, session };
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
  pipesSoon();
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
      const st = await new Promise(res => execFile(CFG.git, ['-c', 'core.quotepath=false', '-C', dir, 'status', '--porcelain=v1', '-uall'], { timeout: 30000, windowsHide: true, maxBuffer: 4 << 20 },
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

// ---- files for the panel: repo text files only; the write keeps a safety copy and refuses a stale base
const FILE_MAX = 2 * 1024 * 1024;
function repoFile(rel) {
  const p = safePath(rel);
  if (!p) return { code: 403, error: 'nem engedélyezett hely' };
  const r = repoRel(p);
  if (r === null || r === '' || r === '.git' || r.startsWith('.git/')) return { code: 403, error: 'csak a repó fájljai (a .git nem)' };
  if (restrictedOf(r)) return { code: 403, error: 'korlátozott zóna: ' + restrictedOf(r) };
  let st; try { st = fs.statSync(p); } catch (e) { return { code: 404, error: 'nincs ilyen fájl' }; }
  if (!st.isFile()) return { code: 400, error: 'nem fájl' };
  if (st.size > FILE_MAX) return { code: 413, error: 'túl nagy (2 MB fölött)' };
  return { p, rel: r };
}
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
function fileRead(rel) {
  const f = repoFile(rel);
  if (f.error) return f;
  const buf = fs.readFileSync(f.p);
  if (buf.subarray(0, 8000).includes(0)) return { code: 415, error: 'bináris fájl' };
  return { code: 200, body: { path: f.rel, text: buf.toString('utf8'), hash: sha1(buf), eol: buf.includes('\r\n') ? 'crlf' : 'lf' } };
}

// ---- jobs: START.cmd's local servers + builds + tests; one supervised process each
const JOB_LINES = 500;
const jobs = { list: null, run: new Map(), ports: [], portsSig: '', portTimer: null, polling: false };
function jobDefs() {
  if (jobs.list) return jobs.list;
  const start = (() => { try { return fs.readFileSync(path.join(REPO, 'Planner', 'START.cmd'), 'utf8'); } catch (e) { return ''; } })();
  const v = (k) => (new RegExp('^set "' + k + '=(.*)"\\r?$', 'm').exec(start) || [])[1];
  const out = [];
  for (let n = 1; n <= 20; n++) {
    const name = v('LH' + n + '_NAME'), js = v('LH' + n + '_JS');
    if (!name) continue;
    const port = +v('LH' + n + '_PORT'), lpath = v('LH' + n + '_PATH') || '/';
    const def = { id: 'lh' + n, name, kind: 'server', port, path: lpath, key: n === 10 ? '0' : String(n) };
    if (js) { def.cmd = [path.join(REPO, js.replace(/\\/g, '/')), ...(v('LH' + n + '_ARGS') || '').split(/\s+/).filter(Boolean)]; def.script = js.replace(/\\/g, '/'); }
    else def.why = 'saját indítója van (.bat) — a START.cmd O) menüjéből indul';
    out.push(def);
  }
  const npm = path.join(REPO, 'Planner', 'apps', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const fixed = [
    ['codecity-build', 'Kódváros oldal (build)', 'build', ['CodeCity/build.js'], null, 'CodeCity'],
    ['hub-build', 'VRG Kapu (build)', 'build', ['tools/build-hub.js'], null, 'Hub'],
    ['planner-build', 'Varler Planner (npm run build)', 'build', [npm, 'run', 'build'], 'Planner/projects/varler-planner', 'Planner'],
    ['codecity-selftest', 'Kódváros selftest', 'test', ['CodeCity/tools/selftest.js'], null, 'CodeCity'],
    ['check-start', 'START.cmd ellenőrzés', 'test', ['tools/check-start.js'], null, 'Planner'],
    ['hub-test', 'VRG Kapu tesztek', 'test', ['Hub/test/run.js'], null, 'Hub']
  ];
  for (const [id, name, kind, argv, cwd, district] of fixed) {
    const script = path.isAbsolute(argv[0]) ? argv[0] : path.join(REPO, argv[0]);
    if (!exists(script)) continue;
    out.push({ id, name, kind, cmd: [script, ...argv.slice(1)], cwd: cwd ? path.join(REPO, cwd) : REPO, script: argv[0], district });
  }
  return jobs.list = out;
}
const jobState = def => {
  const r = jobs.run.get(def.id), ext = def.port && jobs.ports.find(x => x.port === def.port && (!r || x.pid !== r.pid));
  return { id: def.id, name: def.name, kind: def.kind, port: def.port || null, path: def.path || null, key: def.key || null, why: def.why || null,
    state: r && r.code === null ? 'fut' : ext ? 'fut (máshonnan)' : r ? (r.stopped ? 'leállítva' : r.code === 0 ? 'kész' : 'hiba') : 'áll',
    code: r ? r.code : null, pid: r && r.code === null ? r.pid : null, startedAt: r ? r.at : null, ownPid: ext ? ext.pid : null, script: def.script || null, district: def.district || null };
};
const jobsPub = () => jobDefs().map(jobState);
function jobLog(r, text) {
  const lines = (r.rest + text).split(/\r?\n/);
  r.rest = lines.pop();
  if (!lines.length) return;
  r.lines.push(...lines); if (r.lines.length > JOB_LINES) r.lines.splice(0, r.lines.length - JOB_LINES);
  liveEmit('joblog', { id: r.id, lines });
}
function jobStart(id) {
  const def = jobDefs().find(d => d.id === id);
  if (!def) return [404, { error: 'nincs ilyen feladat' }];
  if (!def.cmd) return [409, { error: def.why }];
  const st = jobState(def);
  if (st.state === 'fut' || st.state === 'fut (máshonnan)') return [409, { error: 'már fut' + (st.ownPid ? ' (PID ' + st.ownPid + ')' : '') }];
  if (DRY) return [200, { dryRun: true, exe: process.execPath, args: def.cmd, cwd: def.cwd || REPO }];
  const child = spawn(process.execPath, def.cmd, { cwd: def.cwd || REPO, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const r = { id, pid: child.pid, at: Date.now(), code: null, lines: [], rest: '' };
  jobs.run.set(id, r);
  child.stdout.on('data', d => jobLog(r, String(d)));
  child.stderr.on('data', d => jobLog(r, String(d)));
  child.on('error', e => { jobLog(r, 'HIBA: ' + e.message + '\n'); });
  child.on('exit', code => { if (r.rest) jobLog(r, '\n'); r.code = code === null ? -1 : code; liveEmit('job', jobState(def)); portsSoon(); });
  liveEmit('job', jobState(def)); portsSoon();
  return [200, jobState(def)];
}
function jobStop(id) {
  const r = jobs.run.get(id);
  if (!r || r.code !== null) return [409, { error: 'nem a Kódváros indította, vagy már áll' }];
  if (DRY) return [200, { dryRun: true, exe: 'taskkill', args: ['/PID', String(r.pid), '/T', '/F'] }];
  r.stopped = true;   // asked for: 'leállítva', not 'hiba'
  return new Promise(res => execFile('taskkill', ['/PID', String(r.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 },
    err => res(err ? [500, { error: 'a leállítás nem sikerült' }] : [200, { ok: true }])));
}
process.on('exit', () => { for (const r of jobs.run.values()) if (r.code === null) try { require('child_process').execFileSync('taskkill', ['/PID', String(r.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch (e) { /* gone */ } });
// the port street: LISTEN sockets and the program behind each
function portsPoll() {
  if (jobs.polling || !live.clients.size) return;
  jobs.polling = true;
  execFile('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true, timeout: 10000, maxBuffer: 4 << 20 }, (err, out) => {
    if (err) { jobs.polling = false; return; }
    netConnections(String(out));   // the shoreline: connections leaving the LAN, as counts
    const seen = new Map();
    for (const line of String(out).split(/\r?\n/)) {
      const m = /^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(line);
      if (m && /^(127\.0\.0\.1|0\.0\.0\.0|\[::\]|\[::1\])$/.test(m[1]) && !seen.has(+m[2])) seen.set(+m[2], { port: +m[2], pid: +m[3], local: m[1] === '127.0.0.1' || m[1] === '[::1]' });
    }
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 10000, maxBuffer: 8 << 20 }, (e2, tl) => {
      jobs.polling = false;
      const names = new Map();
      if (!e2) for (const line of String(tl).split(/\r?\n/)) { const m = /^"([^"]+)","(\d+)"/.exec(line); if (m) names.set(+m[2], m[1]); }
      const defs = jobDefs();
      jobs.ports = [...seen.values()].sort((a, b) => a.port - b.port).map(x => {
        const d = defs.find(j => j.port === x.port), own = [...jobs.run.values()].find(r => r.code === null && r.pid === x.pid);
        return { port: x.port, pid: x.pid, proc: names.get(x.pid) || '', local: x.local, job: d ? d.id : null, name: d ? d.name : (x.port === LIVE_PORT ? 'Kódváros segéd' : null), ours: !!own || x.port === LIVE_PORT };
      });
      const sig = JSON.stringify(jobs.ports);
      if (sig !== jobs.portsSig) { jobs.portsSig = sig; liveEmit('ports', { list: jobs.ports }); liveEmit('jobs', { list: jobsPub() }); }
    });
  });
}
// ---- pipes: sources -> the page they build; stale when a source is newer than the page
const PIPES = [
  { id: 'codecity', name: 'Kódváros oldal', src: ['CodeCity/src', 'CodeCity/build.js'], out: 'CodeCity/dist/vrg-codecity.html', job: 'codecity-build' },
  { id: 'hub', name: 'VRG Kapu', src: ['Hub/src', 'tools/build-hub.js'], out: 'Hub/dist/vrg-kapu.html', job: 'hub-build' },
  { id: 'planner', name: 'Varler Planner', src: ['Planner/projects/varler-planner/src'], out: 'Planner/projects/varler-planner/dist/varler_planner.html', job: 'planner-build' },
  { id: 'inventory', name: 'VRG Készlet', src: ['Inventory/src', 'Inventory/build'], out: 'Inventory/dist/vrg-inventory.html', job: null }
];
const pipes = { sig: '', timer: null };
function newest(rel, depth = 0) {
  const p = path.join(REPO, rel);
  let st; try { st = fs.statSync(p); } catch (e) { return null; }
  if (st.isFile()) return { t: st.mtimeMs, p: rel };
  if (depth > 6) return null;
  let best = null;
  for (const n of fs.readdirSync(p)) { if (n === 'node_modules' || n.startsWith('.')) continue; const x = newest(rel + '/' + n, depth + 1); if (x && (!best || x.t > best.t)) best = x; }
  return best;
}
function pipesList() {
  return PIPES.map(pp => {
    let out; try { out = fs.statSync(path.join(REPO, pp.out)).mtimeMs; } catch (e) { out = null; }
    const src = pp.src.map(x => newest(x)).filter(Boolean).sort((a, b) => b.t - a.t)[0] || null;
    if (!src && out === null) return null;
    return { id: pp.id, name: pp.name, out: pp.out, job: pp.job, src: pp.src[0], newest: src ? src.p : null,
      stale: !!(src && (out === null || src.t > out + 1000)), outAt: out, srcAt: src ? src.t : null };
  }).filter(Boolean);
}
function pipesSoon(ms = 1500) {
  clearTimeout(pipes.timer);
  pipes.timer = setTimeout(() => { const list = pipesList(), sig = JSON.stringify(list.map(x => [x.id, x.stale]));
    if (sig !== pipes.sig) { pipes.sig = sig; liveEmit('pipes', { list }); } }, ms);
}
function portsSoon() { setTimeout(portsPoll, 600); }
function portsStart() { if (!jobs.portTimer) { jobs.portTimer = setInterval(portsPoll, 5000); jobs.portTimer.unref(); } portsPoll(); }

// ---- git map: branches as metro lines, worktrees, reflog (all reads)
const lines = s2 => s2.split(/\r?\n/).filter(Boolean);
async function gitBranches() { const r = await git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']); return r.ok ? lines(r.out) : []; }
async function gitMap() {
  const main = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim() || 'main';
  const out = { main, branches: [], worktrees: [], reflog: [] };
  for (const b of await gitBranches()) {
    if (b === main) continue;
    const lr = await git(['rev-list', '--left-right', '--count', main + '...' + b]);
    const [behind, ahead] = lr.ok ? lr.out.trim().split(/\s+/).map(Number) : [0, 0];
    const files = await git(['diff', '--name-only', main + '...' + b]);
    const log = await git(['log', '--format=%h%x09%ct%x09%s', '-n', '30', main + '..' + b]);
    out.branches.push({ name: b, ahead, behind, files: files.ok ? lines(files.out).slice(0, 500) : [],
      commits: log.ok ? lines(log.out).map(l => { const [h, t, ...m] = l.split('\t'); return { h, t: +t, s: m.join('\t').slice(0, 120) }; }) : [] });
  }
  const wl = await git(['worktree', 'list', '--porcelain']);
  for (const block of wl.ok ? wl.out.split(/\r?\n\r?\n/) : []) {
    const dir = (/^worktree (.*)$/m.exec(block) || [])[1], br = (/^branch refs\/heads\/(.*)$/m.exec(block) || [])[1];
    if (dir) out.worktrees.push({ name: path.basename(dir), branch: br || null, main: keyOf(dir) === keyOf(repoReal()) });
  }
  const rl = await git(['reflog', '-n', '60', '--format=%h%x09%gd%x09%ct%x09%gs']);
  out.reflog = rl.ok ? lines(rl.out).map(l => { const [h, gd, t, ...m] = l.split('\t'); return { h, gd, t: +t, s: m.join('\t').slice(0, 120) }; }) : [];
  return out;
}
async function mergePreview(branch) {
  const main = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim() || 'main';
  if (typeof branch !== 'string' || branch === main || !(await gitBranches()).includes(branch)) return { code: 404, error: 'nincs ilyen ág' };
  const base = (await git(['merge-base', main, branch])).out.trim();
  const ours = base ? lines((await git(['diff', '--name-only', base, main])).out) : [];
  const theirs = base ? lines((await git(['diff', '--name-only', base, branch])).out) : [];
  const mt = await git(['merge-tree', '--write-tree', '--name-only', '--no-messages', main, branch]);
  const conflicts = mt.code === 1 ? lines(mt.out).slice(1) : [];
  if (!mt.ok && mt.code !== 1) return { code: 500, error: 'git merge-tree: ' + mt.err.split('\n')[0] };
  return { code: 200, body: { main, branch, clean: mt.ok, conflicts, both: ours.filter(f => theirs.includes(f)), theirs: theirs.slice(0, 500), ours: ours.length } };
}

// ---- Tárház: the H: walk, in memory only
const DISK_ROOT = path.parse(REPO).root, DISK_TTL = 10 * 60 * 1000;
const disk = { data: null, child: null };
function diskWalk() {
  if (disk.child || (disk.data && Date.now() - disk.data.at < DISK_TTL)) return;
  if (DRY) { disk.data = { root: DISK_ROOT, at: Date.now(), partial: false, dirs: [], dryRun: true }; return; }
  const child = spawn(process.execPath, [path.join(CITY, 'disk-walk.js'), DISK_ROOT, '45', REPO], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.on('exit', () => { disk.child = null; try { disk.data = JSON.parse(out); liveEmit('disk', disk.data); } catch (e) { /* keep the last */ } });
  child.on('error', () => { disk.child = null; });
  disk.child = child;
}
process.on('exit', () => { if (disk.child) try { disk.child.kill(); } catch (e) { /* gone */ } });
const landJson = () => { try { return JSON.parse(fs.readFileSync(path.join(CITY, 'land.json'), 'utf8')); } catch (e) { return null; } };

// ---- Erőmű: the Tier 0 sampler (a PowerShell helper, while a page listens)
const power = { child: null, last: null };
function powerStart() {
  if (power.child || DRY) return;
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(CITY, 'probe-tier0.ps1'), String(process.pid), '2000'],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  let buf = '';
  child.stdout.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
    try { power.last = JSON.parse(l); liveEmit('power', power.last); } catch (e) { /* skip */ } } });
  child.on('exit', () => { if (power.child === child) power.child = null; });
  child.on('error', () => {});
  power.child = child;
}
function powerStop() { if (power.child) { try { power.child.kill(); } catch (e) { /* gone */ } power.child = null; } }
process.on('exit', powerStop);
// ---- Pályaudvar, Határ, shoreline
const net = { hops: null, tracing: false, state: null, timer: null, devices: 0, docks: [], countries: [], dbip: undefined, sig: '' };
const PORTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(CITY, 'ports.json'), 'utf8')).docks; } catch (e) { return [{ id: 'other', name: 'Egyéb', ports: [] }]; } })();
const ipInt = ip => ip.split('.').reduce((a, b) => a * 256 + (+b), 0);
const isLocal = ip => /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(ip);
function dbip() {
  if (net.dbip !== undefined) return net.dbip;
  net.dbip = null;
  try {
    const text = require('zlib').gunzipSync(fs.readFileSync(path.join(REPO, '.cache', 'dbip', 'dbip-country-lite.csv.gz'))).toString('utf8');
    const rows = [];
    for (const line of text.split('\n')) { const [a, b, cc] = line.split(','); if (a && !a.includes(':') && cc) rows.push([ipInt(a), ipInt(b), cc.trim()]); }
    net.dbip = rows;
  } catch (e) { /* not fetched: node CodeCity/tools/fetch-dbip.js */ }
  return net.dbip;
}
function countryOf(ip) {
  const rows = dbip(); if (!rows) return null;
  const n = ipInt(ip); let lo = 0, hi = rows.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (n < rows[m][0]) hi = m - 1; else if (n > rows[m][1]) lo = m + 1; else return rows[m][2]; }
  return null;
}
const run = (exe, argv, ms = 15000) => new Promise(res => execFile(exe, argv, { windowsHide: true, timeout: ms, maxBuffer: 4 << 20 }, (err, out) => res(err && !out ? '' : String(out))));
async function ping(ip) {
  if (!ip) return { up: false };
  const t0 = Date.now(), out = await run('ping', ['-n', '1', '-w', '800', ip], 5000);
  return { up: /TTL=/i.test(out), ms: Date.now() - t0 };   // TTL= is in every language's ping output
}
async function netProbe() {
  if (!live.clients.size || DRY) return;
  if (!net.hops && !net.tracing) {   // once: the chain this PC goes out through
    net.tracing = true;
    const out = await run('tracert', ['-d', '-h', '3', '-w', '400', '1.1.1.1'], 30000);
    const ips = [...out.matchAll(/^\s*\d+\s.*?(\d+\.\d+\.\d+\.\d+)\s*$/gm)].map(m => m[1]);
    net.hops = { station: ips[0] || null, border: ips[1] || null, isp: ips[2] || null };
    net.tracing = false;
  }
  if (!net.hops) return;
  const [st, bd, inet] = await Promise.all([ping(net.hops.station), ping(net.hops.border), ping('1.1.1.1')]);
  const arp = await run('arp', ['-a'], 8000);
  const yard = net.hops.station ? net.hops.station.split('.').slice(0, 3).join('.') + '.' : '';
  net.devices = yard ? (arp.match(new RegExp('^\\s*' + yard.replace(/\./g, '\\.') + '\\d+\\s+([0-9a-f]{2}-){5}[0-9a-f]{2}\\s+\\S+', 'gmi')) || [])
    .filter(l => !/ff-ff-ff-ff-ff-ff/i.test(l) && !/\.255\s/.test(l)).length : 0;
  net.state = { at: Date.now(), station: { up: st.up, ms: st.ms, known: !!net.hops.station }, border: { up: bd.up, ms: bd.ms, known: !!net.hops.border },
    internet: { up: inet.up, ms: inet.ms }, devices: net.devices, docks: net.docks, countries: net.countries, dbip: !!dbip() };
  const sig = JSON.stringify([st.up, bd.up, inet.up, net.devices, net.docks, net.countries]);
  if (sig !== net.sig) { net.sig = sig; liveEmit('net', net.state); }
}
// called with each netstat output (the port street's poll): the connections that leave the LAN, as counts
function netConnections(netstat) {
  const docks = new Map(), cc = new Map();
  for (const line of netstat.split(/\r?\n/)) {
    const m = /^\s*TCP\s+\S+\s+(\d+\.\d+\.\d+\.\d+):(\d+)\s+ESTABLISHED/.exec(line);
    if (!m || isLocal(m[1])) continue;
    const d = PORTS.find(x => x.ports.includes(+m[2])) || PORTS.find(x => x.id === 'other');
    docks.set(d.id, (docks.get(d.id) || 0) + 1);
    const c = countryOf(m[1]); if (c) cc.set(c, (cc.get(c) || 0) + 1);
  }
  net.docks = PORTS.map(d => ({ id: d.id, name: d.name, n: docks.get(d.id) || 0 })).filter(d => d.n);
  net.countries = [...cc].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => ({ cc: c, n }));
}
function netStart() {
  powerStart();
  if (!net.timer) { net.timer = setInterval(() => { if (!live.clients.size) { if (!net.idle) net.idle = Date.now(); else if (Date.now() - net.idle > 30000) powerStop(); return; } net.idle = 0; powerStart(); netProbe(); }, 10000); net.timer.unref(); }
  netProbe();
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
  // a Claude conversation of an earlier tab, after a restart of the segéd: only a UUID is accepted
  'term-resume': { keys: ['dir', 'session'], async run(b) {
    if (!terminalOn()) return [503, { error: 'a terminál nem fut' }];
    if (typeof b.session !== 'string' || !UUID.test(b.session)) return [400, { error: 'session: egy munkamenet-azonosító (UUID)' }];
    const d = safeDir(b.dir);
    if (!d) return [403, { error: 'nem engedélyezett mappa' }];
    const r = termOpen(d, 'claude', b.session);
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
  // the panel's save, after the user saw the diff and confirmed: a safety copy first, then the write
  'file-save': { keys: ['path', 'text', 'base'], async run(b) {
    if (typeof b.path !== 'string' || typeof b.text !== 'string' || typeof b.base !== 'string') return [400, { error: 'path, text, base' }];
    const f = repoFile(b.path);
    if (f.error) return [f.code, { error: f.error }];
    const cur = fs.readFileSync(f.p);
    if (sha1(cur) !== b.base) return [409, { error: 'a fájl közben megváltozott — nyisd meg újra, és nézd át' }];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const safety = path.join(REPO, '.cache', 'vrg-safety', stamp, f.rel);
    if (DRY) return [200, { dryRun: true, path: f.rel, safety: path.relative(REPO, safety).replace(/\\/g, '/') }];
    fs.mkdirSync(path.dirname(safety), { recursive: true });
    fs.writeFileSync(safety, cur);
    const text = cur.includes('\r\n') ? b.text.replace(/\r?\n/g, '\r\n') : b.text;
    fs.writeFileSync(f.p, text);
    return [200, { ok: true, path: f.rel, hash: sha1(Buffer.from(text)), safety: path.relative(REPO, safety).replace(/\\/g, '/') }];
  } },
  'job-start': { keys: ['id'], async run(b) { return typeof b.id === 'string' ? jobStart(b.id) : [400, { error: 'id' }]; } },
  'job-stop': { keys: ['id'], async run(b) { return typeof b.id === 'string' ? jobStop(b.id) : [400, { error: 'id' }]; } },
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
    const html = fs.readFileSync(PAGE, 'utf8').replace(/<head>/i, m => m + '<script>window.KV_COMPANION={token:' + JSON.stringify(TOKEN) + ',port:' + LIVE_PORT + '};</script>' +
      (esmReady() ? '<script type="importmap">' + IMPORT_MAP + '</script>' : ''));
    res.setHeader('Set-Cookie', 'kv_t=' + TOKEN + '; HttpOnly; SameSite=Strict; Path=/api/');   // for the SSE stream only
    return send(res, 200, html, 'text/html; charset=utf-8');
  }
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') return send(res, 405, { error: 'csak GET' });
    if (url.pathname.startsWith('/vendor/esm/')) {
      const f = esmFile(url.pathname.slice(12));
      return f ? send(res, 200, fs.readFileSync(f), TYPES['.js']) : send(res, 404, { error: 'nincs ilyen' });
    }
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
  if (req.method === 'GET' && (url.pathname === '/api/stream' || url.pathname === '/api/city' || url.pathname === '/api/file' || url.pathname === '/api/jobs' || url.pathname === '/api/gitmap' || url.pathname === '/api/merge-preview' || url.pathname === '/api/land' || url.pathname === '/api/disk')) {
    const ck = /(?:^|;\s*)kv_t=([0-9a-f]+)/.exec(String(req.headers.cookie || ''));
    if (!ck || ck[1].length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(ck[1]), Buffer.from(TOKEN))) return send(res, 401, { error: 'token' });
    if (url.pathname === '/api/land') { const l = landJson(); return send(res, l ? 200 : 404, l || { error: 'CodeCity/land.json hiányzik' }); }
    if (url.pathname === '/api/disk') { diskWalk(); return send(res, 200, disk.data ? Object.assign({ walking: !!disk.child }, disk.data) : { walking: true, dirs: [] }); }
    if (url.pathname === '/api/gitmap') return gitMap().then(m => send(res, 200, m));
    if (url.pathname === '/api/merge-preview') return mergePreview(url.searchParams.get('branch')).then(r => send(res, r.code, r.body || { error: r.error }));
    if (url.pathname === '/api/jobs') return send(res, 200, { list: jobsPub(), logs: Object.fromEntries([...jobs.run].map(([id, r]) => [id, r.lines.slice(-200)])), ports: jobs.ports });
    if (url.pathname === '/api/file') { const r = fileRead(url.searchParams.get('path') || ''); return send(res, r.code, r.body || { error: r.error }); }
    if (url.pathname === '/api/city') return liveCity().then(c => (c ? send(res, 200, c) : send(res, 503, { error: 'a felmérés nem sikerült' })));
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.write('retry: 3000\n\n');
    res.write('event: hello\ndata: ' + JSON.stringify({ head: live.head, watching: !!live.watcher }) + '\n\n');
    if (agents.sig) res.write('event: agents\ndata: ' + agents.sig.replace(/^/, '{"list":') + '}\n\n');
    if (fences.sig) res.write('event: fences\ndata: {"list":' + fences.sig + '}\n\n');
    worktreesSoon();
    portsStart();
    netStart();
    if (power.last) res.write('event: power\ndata: ' + JSON.stringify(power.last) + '\n\n');
    if (net.state) res.write('event: net\ndata: ' + JSON.stringify(net.state) + '\n\n');
    res.write('event: pipes\ndata: ' + JSON.stringify({ list: pipesList() }) + '\n\n');
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
