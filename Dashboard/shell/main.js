// main.js — the VRG Desktop Dashboard shell (D1). Electron from H:\VRG\Full\tools\electron, no npm install:
//   ..\..\..\tools\electron\electron.exe Dashboard\shell            (or "VRG Irányítópult.cmd" next to the page)
//   ... shell --selftest [--shot <out.png>] [--probe <wp>]   load, check the page, plan every act without running it, quit
// Rules (DASHBOARD-IDEA Q1 = B):
// - one frameless window loading ../vrg-dashboard.html; contextIsolation on, nodeIntegration off, sandboxed preload;
// - only this process starts programs, opens folders and starts servers, and only for an `act` id that collect()
//   (../build.js, from vrg-menu.json + features.json + the DevLog) hands out. The page never sends a path;
// - a START item runs the way vrg-ui.ps1 runs it (same tokens, same quoting, steps in a console of their own);
// - action / phase / menu items (commit, backup, submenus) stay in START: refused here;
// - every 4 s the registry's server ports are probed on 127.0.0.1 and the result goes to the page.
'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), net = require('net');
const { spawn, execFile } = require('child_process');
const build = require('../build.js');

const PAGE = path.join(__dirname, '..', 'vrg-dashboard.html');
const ARGV = process.argv;
const SELFTEST = ARGV.includes('--selftest');
const arg = name => { const i = ARGV.indexOf(name); return i > 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : ''; };
// a capture only with --shot <file> (or the older form --selftest <file>); --no-shot always wins
const SHOT = SELFTEST && !ARGV.includes('--no-shot') ? (arg('--shot') || arg('--selftest')) : '';
const PROBE = SELFTEST ? arg('--probe') : '';
const TMP = path.join(os.tmpdir(), 'VRG');
// the first prompt of a "continue" session; it only reads, so nothing runs before the user says so
const CONTINUE = 'Continue this dev line: read CLAUDE.md in this folder, check the real state, then tell me where it stands and the next step.';

if (!SELFTEST && !app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('VRG.Dashboard');

let win = null, C = null, ports = {}, dry = null;                 // dry: a list that collects plans instead of running
const log = (...a) => console.log('[dash]', ...a);
// vrg-ui.ps1 falls back to the program on PATH when the portable one is absent; here also when the portable
// Claude Code is broken (its claude.cmd points at bin\claude.exe, which a failed self-update can leave missing)
let claudeFix = null;
function findClaude() {
  const portable = C.expand('{claude}');
  const exe = path.join(path.dirname(portable), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  if (exists(portable) && (!/claude\.cmd$/i.test(portable) || exists(exe))) return null;
  try { return require('child_process').execFileSync('where.exe', ['claude.cmd'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)[0].trim() || null; }
  catch (e) { return null; }
}
function load() {
  C = build.collect();
  claudeFix = findClaude();
  if (claudeFix) { const base = C.expand; C.expand = s => base(String(s == null ? '' : s).split('{claude}').join(claudeFix)); log('portable Claude Code is broken, using', claudeFix); }
  return C;
}

// ---------------------------------------------------------------- vrg-ui.ps1 equivalents
const P = s => C.expand(s);
const Q = a => /\s/.test(a) && !a.includes('"') ? '"' + a + '"' : a;             // vrg-ui.ps1 Q
const argList = list => (list || []).filter(x => x != null).map(x => Q(P(x)));
const T = (s, v) => Object.keys(v).reduce((a, k) => a.split('{' + k + '}').join(v[k]), s || '');
const ui = k => (C.menu.ui || {})[k] || k;
const say = (ok, hu, en) => ({ ok, hu, en });
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };

function needs(it) {
  if (it.needs) return P(it.needs);
  if (it.exe && !/^(cmd|powershell|explorer)\.exe$/i.test(it.exe)) return P(it.exe);
  return '';
}
// a .cmd in %TEMP%\VRG that runs `lines`; mode 'start' = its own console, 'min' = minimised, 'hidden' = no console
function runBat(name, cwd, lines, mode) {
  name = String(name).replace(/[&|<>^%"()]/g, '');                 // a window title, not a command
  const body = ['@echo off', 'chcp 65001 >nul', `title VRG ${name}`, `cd /d "${cwd}"`, ...lines];
  if (dry) { dry.push({ bat: name, mode, cwd, lines }); return; }
  fs.mkdirSync(TMP, { recursive: true });
  const bat = path.join(TMP, 'dash-' + Math.random().toString(16).slice(2, 10) + '.cmd');
  fs.writeFileSync(bat, body.join('\r\n') + '\r\n', 'utf8');
  const how = mode === 'hidden' ? `"${bat}"` : `start "VRG ${name}"${mode === 'min' ? ' /min' : ''} "${bat}"`;
  spawn('cmd.exe', ['/d', '/c', how], { cwd, detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
}
// start a program the way Start-Process does: GUI programs just open, console ones get their own window
function startExe(name, exe, args, cwd) {
  runBat(name, cwd, [`start "" ${Q(exe)} ${args.join(' ')}`.replace(/%/g, '%%')], 'hidden');
}
function openPath(p) { if (dry) { dry.push({ openPath: p }); return; } shell.openPath(p); }
function openUrl(u) { if (!/^https?:\/\//.test(u)) return; if (dry) { dry.push({ url: u }); return; } shell.openExternal(u); }
// HTML opens in the registry's first browser (START's chooser default), anything else with its Windows program
function openDoc(p, name) {
  if (/\.html?$/i.test(p)) {
    const b = (C.menu.browsers || []).find(x => x.exe && exists(P(x.exe)));
    if (b) { startExe(name, P(b.exe), [...argList(b.args), Q(p)], path.dirname(p)); return; }
  }
  openPath(p);
}

function server(id) { return (C.menu.servers || []).find(s => s.id === id); }
const serverUrl = s => 'http://localhost:' + s.port + (s.open || '/');
function up(port) {
  return new Promise(res => {
    const k = net.connect({ host: '127.0.0.1', port }); let done = false;
    const end = v => { if (!done) { done = true; k.destroy(); res(v); } };
    k.setTimeout(300, () => end(false)); k.on('connect', () => end(true)); k.on('error', () => end(false));
  });
}
function startServer(s, extra = []) {
  const cwd = s.cwd ? P(s.cwd) : C.paths.REPO;
  if (s.bat) { const f = P(s.bat); if (!exists(f)) return T(ui('missing'), { path: f });
    runBat(String(s.port), path.dirname(f), [`call "${f}"`], 'min'); return ''; }
  const js = P(s.js), node = P('{node}');
  if (!exists(js)) return T(ui('missing'), { path: js });
  if (!exists(node)) return T(ui('missing'), { path: node });
  runBat(String(s.port), cwd, [`"${node}" "${js}" ${argList([...(s.args || []), ...extra]).join(' ')}`.replace(/%/g, '%%')], 'min');
  return '';
}
async function openServer(s) {
  if (await up(s.port)) { openUrl(serverUrl(s)); return say(true, T(ui('opened'), { name: s.name }), 'opened'); }
  const err = startServer(s); if (err) return say(false, err, 'not found');
  if (s.self || dry) return say(true, T(ui('started'), { name: s.name }), 'started');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await up(s.port)) { pollPorts(); openUrl(serverUrl(s)); return say(true, T(ui('opened'), { name: s.name }), 'started and opened'); }
  }
  return say(false, T(ui('noAnswer'), { port: s.port }), 'no answer in 10 s');
}

async function act(it) {                                            // vrg-ui.ps1 Act, minus the console-only kinds
  if (it.action || it.phase || it.menu || it.servers || it.programs || it.prompts)
    return say(false, 'Ez a START-ban fut.', 'This one runs in START.');
  if (it.steps) {
    const cwd = it.cwd ? P(it.cwd) : C.paths.REPO;
    const lines = it.steps.map(s => ('call ' + Q(P(s.exe)) + ' ' + argList(s.args).join(' ')).replace(/%/g, '%%') + ' || goto :fail');
    const then = it.then ? P(it.then) : '';
    const b = then && (C.menu.browsers || []).find(x => x.exe && exists(P(x.exe)));
    if (then) lines.push(b ? `start "" ${Q(P(b.exe))} ${argList(b.args).join(' ')} ${Q(then)}`.replace(/%/g, '%%') : `start "" "${then}"`);
    lines.push('echo.', 'echo   Kesz.', 'goto :end', ':fail', 'echo.', 'echo   HIBA, a tovabbi lepesek elmaradtak.', ':end', 'echo.', 'pause');
    runBat(it.name, cwd, lines, 'start');
    return say(true, T(ui('window'), { name: it.name }), 'runs in its own window');
  }
  if (it.groups) {                                                  // Zen: one window per group, the rest as tabs
    const exe = P(it.exe); if (!exists(exe)) return say(false, T(ui('missing'), { path: exe }), 'not found');
    for (const g of it.groups) {
      const pages = g.map(P).filter(x => /^https?:/.test(x) || exists(x));
      for (let i = 0; i < pages.length; i++) {
        startExe(it.name, exe, [i ? '-new-tab' : '-new-window', Q(pages[i])], path.dirname(exe));
        if (!i && !dry) await new Promise(r => setTimeout(r, 3000));
      }
    }
    return say(true, T(ui('opened'), { name: it.name }), 'opened');
  }
  if (it.path) {
    const p = P(it.path); if (!exists(p)) return say(false, T(ui('missing'), { path: p }), 'not found');
    let warn = '';
    if (it.before) {
      if (dry) dry.push({ before: P(it.before.exe), args: (it.before.args || []).map(P) });
      else warn = await new Promise(res => execFile(P(it.before.exe), (it.before.args || []).map(P), { timeout: 120e3, windowsHide: true },
        e => res(e ? T(ui('beforeFailed'), { note: String(it.before.note || '').replace(/…$/, '') }) : '')));
    }
    openDoc(p, it.name);
    return say(!warn, warn || T(ui('opened'), { name: it.name }), warn ? 'opened, the step before failed' : 'opened');
  }
  if (it.exe) {
    const need = needs(it); if (need && !exists(need)) return say(false, T(ui('missing'), { path: need }), 'not installed');
    if (it.ensure && !exists(P(it.ensure.path))) return say(false, 'Először a START-ból indítsd: ' + (it.ensure.note || ''), 'Run it from START once first (it downloads what it needs).');
    if (it.server) { const s = server(it.server); if (s && !(await up(s.port))) { const err = startServer(s, it.serverArgs || []); if (err) return say(false, err, 'not found'); } }
    const exe = P(it.exe);
    startExe(it.name, exe, argList(it.args), it.cwd ? P(it.cwd) : /\\/.test(exe) ? path.dirname(exe) : C.paths.REPO);
    return say(true, T(ui('started'), { name: it.name }), 'started');
  }
  if (it.server) { const s = server(it.server); return s ? openServer(s) : say(false, 'Ismeretlen szerver', 'unknown server'); }
  if (it.url) { openUrl(P(it.url)); return say(true, T(ui('opened'), { name: it.name }), 'opened'); }
  if (it.folder) { const f = P(it.folder); if (!exists(f)) return say(false, T(ui('missing'), { path: f }), 'not found');
    openPath(f); return say(true, T(ui('opened'), { name: it.name }), 'opened'); }
  return say(false, 'Nincs teendő', 'nothing to do');
}

// ---------------------------------------------------------------- act ids → registry items (the allow-list)
function lookup(id) {
  if (typeof id !== 'string' || id.length > 80) return null;
  let m;
  if ((m = id.match(/^s:([^/]+(?:\/[^/]+)?)$/))) return C.startActs[id] ? { item: C.startActs[id] } : null;
  if ((m = id.match(/^srv:([\w-]+)$/))) { const s = server(m[1]); return s ? { item: { server: s.id, name: s.name } } : null; }
  if ((m = id.match(/^f:([a-z]\d+):(\d+)$/))) {
    const f = C.data.features.find(x => x.id === m[1]); const l = f && f.links[+m[2]];
    if (!l || l.act !== id) return null;
    if (l.kind === 'folder') return { item: { folder: l.path, name: f.title } };
    if (l.kind === 'doc') return { item: { path: l.path, name: f.title } };
    if (l.kind === 'program') return { item: { exe: l.path, name: f.title } };   // START.cmd, BACKUP.cmd … from features.json
    return null;
  }
  // D2: Claude Code is START → C → 1 from the registry; only the folder (DevLog) or the codephrase (GO-*.md) changes
  if ((m = id.match(/^cont:([\w-]+)$/))) {
    const l = C.data.lines.find(x => x.id === m[1]); const c = C.claude && C.startActs[C.claude];
    if (!l || l.contAct !== id || !c) return null;
    return { item: { ...c, name: 'Claude · ' + l.name, cwd: l.sessionPath, args: [...(c.args || []), CONTINUE] } };
  }
  if ((m = id.match(/^go:([A-Z0-9]+)$/))) {
    const g = C.data.go.find(x => x.name === m[1]); const c = C.claude && C.startActs[C.claude];
    if (!g || !g.act || !c) return null;
    return { item: { ...c, name: 'Claude · GO ' + g.name, args: [...(c.args || []), 'GO ' + g.name] } };
  }
  if ((m = id.match(/^godoc:([A-Z0-9]+)$/))) { const g = C.data.go.find(x => x.name === m[1]); return g ? { doc: g.file, name: 'GO ' + g.name } : null; }
  // D4: jobs by anonymised code; the folder and document paths come from collect()'s private map, never from the page
  if ((m = id.match(/^job:([A-Z]{1,3}\d{1,3}(?:-[A-Z]{2,4})?)$/))) { const p = C.jobsPriv[m[1]]; return p && p.folder ? { item: { folder: p.folder, name: m[1] } } : null; }
  if ((m = id.match(/^jobdoc:([A-Z]{1,3}\d{1,3}(?:-[A-Z]{2,4})?)$/))) { const p = C.jobsPriv[m[1]]; return p && p.doc ? { doc: p.doc, name: m[1] } : null; }
  if ((m = id.match(/^line:([\w-]+)$/))) { const l = C.data.lines.find(x => x.id === m[1]); return l && l.sessionPath ? { item: { folder: l.sessionPath, name: l.name } } : null; }
  if ((m = id.match(/^linedoc:([\w-]+)$/))) { const l = C.data.lines.find(x => x.id === m[1]); return l && l.docPath ? { doc: l.docPath, name: l.name } : null; }
  return null;
}
async function runAct(id) {
  const hit = lookup(id);
  if (!hit) { log('refused', id); return say(false, 'Nincs a nyilvántartásban: ' + id, 'Not in the registry.'); }
  if (hit.doc) { openPath(hit.doc); return say(true, T(ui('opened'), { name: hit.name }), 'opened'); }
  try { const r = await act(hit.item); log(id, r.ok ? 'ok' : 'no', r.hu); return r; }
  catch (e) { log(id, 'error', e.message); return say(false, e.message, 'error'); }
}

// ---------------------------------------------------------------- ports
let pollTimer = 0;
async function pollPorts() {
  const list = C.menu.servers || [];
  const res = await Promise.all(list.map(s => up(s.port)));
  const next = Object.fromEntries(list.map((s, i) => [s.port, res[i]]));
  if (JSON.stringify(next) !== JSON.stringify(ports)) { ports = next; if (win && !win.isDestroyed()) win.webContents.send('vrg:ports', ports); }
  return ports;
}

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 820, minHeight: 560, frame: false, show: false, backgroundColor: '#0a141c',
    title: 'VRG Irányítópult',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const pageUrl = require('url').pathToFileURL(PAGE).href;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));         // links go through act ids
  win.webContents.on('will-navigate', (e, url) => { if (url.split('#')[0] !== pageUrl) e.preventDefault(); });
  win.on('maximize', () => win.webContents.send('vrg:max', true));
  win.on('unmaximize', () => win.webContents.send('vrg:max', false));
  win.once('ready-to-show', () => { if (!SELFTEST) win.show(); });
  win.loadFile(PAGE);
}

ipcMain.handle('vrg:act', (e, id) => runAct(id));
ipcMain.handle('vrg:ports', () => ports);
ipcMain.handle('vrg:refresh', () => { build.write(); load(); pollPorts(); win.webContents.reload(); return true; });
ipcMain.on('vrg:win', (e, cmd) => {
  if (!win) return;
  if (cmd === 'min') win.minimize();
  else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (cmd === 'close') win.close();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  build.write(); load();                                               // the page always starts on fresh data
  createWindow();
  await pollPorts();
  pollTimer = setInterval(pollPorts, 4000);
  if (SELFTEST) selftest();
});

// ---------------------------------------------------------------- selftest: nothing is launched
async function selftest() {
  const out = { ok: true, errors: [] };
  try {
    await new Promise(r => win.webContents.once('did-finish-load', r));
    await new Promise(r => setTimeout(r, 1200));
    win.webContents.send('vrg:ports', ports);
    await new Promise(r => setTimeout(r, 300));
    out.page = await win.webContents.executeJavaScript(`({ shell: !!window.vrg, tiles: document.querySelectorAll('.tile').length,
      acts: document.querySelectorAll('[data-act]').length, up: document.querySelectorAll('.chip.srv.up').length,
      wbar: !!document.querySelector('.wbar'), title: document.title })`);
    out.claudeFix = claudeFix;
    out.portsUp = Object.entries(ports).filter(([, v]) => v).map(([k]) => +k);
    // every id the page carries must resolve; every one is planned dry
    const ids = await win.webContents.executeJavaScript(`[...new Set([...document.querySelectorAll('[data-act]')].map(e => e.dataset.act))]`);
    out.ids = ids.length; out.plans = {};
    for (const id of ids) {
      dry = []; const r = await runAct(id);
      // job paths can carry client names: the log keeps only that a path was resolved
      out.plans[id] = { r: r.ok ? 'ok' : 'NO: ' + r.hu, ops: /^job/.test(id) ? dry.map(o => Object.keys(o).join('+') + ' (job path)') : dry }; dry = null;
      if (!r.ok && !/START-ban|nincs telepítve|Nem található|Először/.test(r.hu)) out.errors.push(id + ': ' + r.hu);
    }
    for (const bad of ['../../Windows/System32/calc.exe', 'f:p1:99', 's:Q', 's:S', 'srv:nope', 'line:../x']) {
      dry = []; const r = await runAct(bad); dry = null;
      if (r.ok) out.errors.push('accepted ' + bad);
    }
    // --probe <wp>: the WP's own probe in shell/selftest/<wp>.js, if it exists; its { ok, errors } is merged in
    if (PROBE) {
      const pf = /^[\w-]+$/.test(PROBE) ? path.join(__dirname, 'selftest', PROBE + '.js') : '';
      if (pf && exists(pf)) {
        const r = await require(pf)({ win, app, build, C, runAct, lookup, ports, tmp: TMP }) || {};
        out.probe = { name: PROBE, ...r };
        if (r.ok === false) out.ok = false;
        for (const e of r.errors || []) out.errors.push(PROBE + ': ' + e);
      }
    }
    // --run <id>: run one act for real (a live check on this PC), then wait for its port if it is a server
    const ri = process.argv.indexOf('--run');
    if (ri > 0) { const id = process.argv[ri + 1]; out.run = { id, r: await runAct(id) }; await pollPorts(); out.run.portsUp = Object.entries(ports).filter(([, v]) => v).map(([k]) => +k); }
    const si = process.argv.indexOf('--scroll');                       // --scroll <css selector>: capture from there
    if (si > 0) { await win.webContents.executeJavaScript(`document.querySelectorAll('details.stats').forEach(d => { if (!d.matches(${JSON.stringify(process.argv[si + 1])})) d.open = false; }); (document.querySelector(${JSON.stringify(process.argv[si + 1])}) || document.body).scrollIntoView(); 1`); await new Promise(r => setTimeout(r, 300)); }
    // a hidden window keeps its first frame; shown off-screen it repaints what the --scroll step changed
    if (SHOT && si > 0) { win.setPosition(-4000, 0); win.showInactive(); await new Promise(r => setTimeout(r, 600)); }
    if (SHOT) { win.setSize(1500, 950); const img = await win.webContents.capturePage(); fs.writeFileSync(SHOT, img.toPNG()); out.shot = SHOT; }
  } catch (e) { out.errors.push(e.stack); }
  out.ok = !out.errors.length;
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'dash-selftest.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ok: out.ok, page: out.page, ids: out.ids, portsUp: out.portsUp, errors: out.errors }));
  clearInterval(pollTimer); app.exit(out.ok ? 0 : 1);
}
