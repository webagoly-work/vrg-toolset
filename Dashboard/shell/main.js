// main.js — the VRG Desktop Dashboard shell: bootstrap only. Electron from H:\VRG\Full\tools\electron, no npm install:
//   ..\..\..\tools\electron\electron.exe Dashboard\shell            (or "VRG Irányítópult.cmd" next to the page)
//   ... shell --selftest [--shot <out.png>] [--probe <wp>]   load, check the page, plan every act without running it, quit
// Rules (DASHBOARD-IDEA Q1 = B):
// - one frameless window loading ../vrg-dashboard.html; contextIsolation on, nodeIntegration off, sandboxed preload;
// - only this process starts programs, opens folders and starts servers, and only for an `act` id that collect()
//   (../build.js, from vrg-menu.json + features.json + the DevLog) hands out (lib/acts.js). The page never sends a path;
// - a START item runs the way vrg-ui.ps1 runs it (lib/runbat.js); action / phase / menu items stay in START: refused;
// - every 4 s the registry's server ports are probed on 127.0.0.1 and the result goes to the page (lib/ports.js).
'use strict';
const { app, BrowserWindow, WebContentsView, ipcMain, shell, screen, globalShortcut, Tray, Menu, nativeImage, safeStorage, clipboard, session } = require('electron');
const path = require('path'), os = require('os');
const build = require('../build.js');
const { createRegistry } = require('./lib/registry.js');
const { createRunner } = require('./lib/runbat.js');
const { createPorts } = require('./lib/ports.js');
const { createActs } = require('./lib/acts.js');
const { createSelftest } = require('./lib/selftest.js');
const { createIpc, types } = require('./lib/ipc.js');
const { createWinModes } = require('./lib/winmodes.js');
const { createTray } = require('./lib/tray.js');
const { createAudit } = require('./lib/audit.js');
const settings = require('./lib/settings.js');
const { createSecrets } = require('./lib/secrets.js');

const layoutLib = require('./lib/layout.js');
const { createViews } = require('./lib/views.js');
const { createPalette, loadKeymap } = require('./lib/palette.js');
const quickLib = require('./lib/quick.js');
const { createJobs } = require('./lib/jobs.js');

const PAGE = path.join(__dirname, '..', 'vrg-dashboard.html');                 // the Kezdőlap, shown in a view
const FRAME = path.join(__dirname, '..', 'page', 'vrg-desktop.html');          // the main window: the frame page
const SELFTEST = process.argv.includes('--selftest');
const TMP = path.join(os.tmpdir(), 'VRG');
if (SELFTEST) process.env.VRG_DESK_HOME = path.join(TMP, 'desk-test-home');       // the selftest never touches the real home (CONTRACT §4.9)
const secrets = createSecrets({ safeStorage });                                  // main-only: no IPC reaches it
// a selftest always starts from the default layout: panes a previous test run saved (terminal panes re-open as new sessions) must not start anything
if (SELFTEST) { try { settings.set('layout.tree', null); } catch (e) {} }

if (!SELFTEST && !app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('VRG.Dashboard');

let win = null, pollTimer = 0, winmodes = null, tray = null, views = null;
const log = (...a) => console.log('[dash]', ...a);
const R = createRegistry({ build, log });
const run = createRunner({ R, shell, tmp: TMP });
const homeWc = () => { const v = views && views.get('home'); return v && !v.webContents.isDestroyed() ? v.webContents : null; };
const toPages = (ch, ...a) => {                                                // the frame and the Kezdőlap view both get the D1 events
  if (win && !win.isDestroyed()) win.webContents.send(ch, ...a);
  const h = homeWc(); if (h) h.send(ch, ...a);
};
const ports = createPorts({ R, run, onChange: p => toPages('vrg:ports', p) });
// claudeterm (WP-16, DESK-Q41 B): s:C/*, cont: and go: open Claude in an embedded terminal pane (setting term.embedClaude, default on).
// The arrow is resolved at call time: claudeTermGet and the pty manager are defined further down.
const acts = createActs({ R, run, ports, log, claudeterm: { open: o => claudeTermGet().open(o) } });

// The selftest looks at "the page" through win.webContents: that is now the Kezdőlap view (D1 ids ≥ 30), everything
// else (modes, sizes) is the real window. win.desk hands the frame and the views to the WP-07 probe.
const selftestWin = () => new Proxy(win, {
  get(t, k) {
    if (k === 'desk') return { frame: t, home: homeWc(), views, palette, jobs, selMenu, web: webHost, webOps, webBm, innerSearch, mail: { lib: mailLib, providers: mailProviders, secrets, test: mailTest } };
    if (k === 'webContents') {
      const wc = homeWc() || t.webContents;
      return new Proxy(wc, { get(w, p) {
        if (p === 'once') return (ev, cb) => (ev === 'did-finish-load' && !w.isLoading() ? setImmediate(cb) : w.once(ev, cb));
        const v = w[p]; return typeof v === 'function' ? v.bind(w) : v;
      } });
    }
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  },
});
const selftest = createSelftest({ app, getWin: selftestWin, build, R, acts, run, ports, argv: process.argv, tmp: TMP, stopPolling: () => clearInterval(pollTimer) });

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 820, minHeight: 560, frame: false, show: false, backgroundColor: '#0a141c',
    title: 'VRG Irányítópult',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const pageUrl = require('url').pathToFileURL(FRAME).href;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));         // links go through act ids
  win.webContents.on('will-navigate', (e, url) => { if (url.split('#')[0] !== pageUrl) e.preventDefault(); });
  win.on('maximize', () => toPages('vrg:max', true));
  win.on('unmaximize', () => toPages('vrg:max', false));
  views = createViews({ WebContentsView, win, preload: path.join(__dirname, 'preload.js'), homePage: PAGE, log });
  if (SELFTEST || layoutLib.panes(currentTree().tree).some(p => p.kind === 'home')) views.createLocal('home');
  win.on('closed', () => { webHost.closeAll(); views.destroyAll(); });
  win.once('ready-to-show', () => { if (!SELFTEST) win.show(); });
  winmodes = createWinModes({
    win, screen, log, settings,
  });
  win.loadFile(FRAME);
}

// the layout tree lives in the settings key layout.tree (null = the default tree)
function currentTree() {
  let t = null;
  try { t = settings.get('layout.tree'); } catch (e) {}
  return { tree: t && layoutLib.validate(t).ok ? t : layoutLib.defaultTree() };
}

function setupShell() {
  if (SELFTEST) return;                                    // the selftest never grabs the hotkey or adds a tray icon
  winmodes.restore();
  tray = createTray({
    Tray, Menu, nativeImage, iconPath: path.join(__dirname, 'icon.png'),
    handlers: {
      mode: m => { winmodes.mode(m); tray.setMode(m); },
      show: () => { if (win.isMinimized()) win.restore(); win.show(); win.focus(); },
      refresh: () => { build.write(); R.load(); ports.pollPorts(); reload(); },
      quit: () => app.quit(),
    },
  });
  tray.setMode(winmodes.state().mode);
  let ok = false;
  try { ok = globalShortcut.register(HOTKEY, () => { winmodes.toggleOverlay(); tray.setMode(winmodes.state().mode); }); } catch (e) {}
  if (!ok) {
    audit.write({ ch: 'app.hotkey', ok: false, err: 'taken', key: HOTKEY });
    win.webContents.once('did-finish-load', () => toast('A gyorsbillentyű foglalt: Ctrl+Alt+Space', 'The hotkey is taken: Ctrl+Alt+Space'));
  }
  // quick bar (WP-30): works while another program has focus; brings the window forward (also from the hidden overlay), then the page opens the bar
  const quickKey = quickLib.loadHotkey(path.join(__dirname, '..', 'config', 'keymap.json'));
  let qok = false;
  try {
    qok = globalShortcut.register(quickKey, () => {
      if (winmodes.state().mode === 'overlay' && !winmodes.state().visible) { winmodes.toggleOverlay(); tray.setMode(winmodes.state().mode); }
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
      ipc.emit(win, 'quick', 'open', {});
    });
  } catch (e) {}
  if (!qok) {
    audit.write({ ch: 'app.hotkey', ok: false, err: 'taken', key: quickKey });
    win.webContents.once('did-finish-load', () => toast('A gyorskereső billentyű foglalt: ' + quickKey, 'The quick bar hotkey is taken: ' + quickKey));
  }
}

// IPC v2: schema-checked channels (lib/ipc.js, API.md). Only these two pages may call; a web view never can.
const fileUrl = p => require('url').pathToFileURL(p).href;
const audit = createAudit(SELFTEST ? { dir: path.join(TMP, 'desk-test-audit') } : {});   // default dir = paths.logs()
const ipc = createIpc({
  ipcMain, audit, log,
  allowedUrls: () => [fileUrl(PAGE), fileUrl(path.join(__dirname, '..', 'page', 'vrg-desktop.html'))],
});
// libs: file: script URLs of the vendored libraries (tools/js-libs); a library that is not there is null, the page copes
const jsLib = (...rel) => {
  const base = process.env.VRG_JSLIBS || path.join(process.env.VRG_FULL || 'H:\\VRG\\Full', 'tools', 'js-libs');
  const f = path.join(base, ...rel);
  return require('fs').existsSync(f) ? require('url').pathToFileURL(f).href : null;
};
const libUrls = () => ({
  dompurify: jsLib('dompurify', 'DOMPurify-main', 'dist', 'purify.min.js'),
  markdownIt: jsLib('markdown-it', 'dist', 'markdown-it.min.js'),           // 14.1.0 UMD bundle from npm (DESK-Q36, see its VENDOR.json)
});
ipc.register('app', 'info', {}, async () => ({
  version: app.getVersion(), user: 'founder', mode: winmodes ? winmodes.state().mode : 'ablak', features: ipc.namespaces(), libs: libUrls(),
}));

// window modes (WP-04): ablak / munka / overlay, tray, global hotkey, login auto-start
const HOTKEY = 'Control+Alt+Space';
const toast = (hu, en) => ipc.emit(win, 'app', 'toast', { ok: false, hu, en: en || hu });
ipc.register('app', 'mode', { m: types.enum('ablak', 'munka', 'overlay') }, async ({ m }) => {
  const r = winmodes.mode(m);
  if (r.ok && tray) tray.setMode(m);
  return r;
});
ipc.register('app', 'toggleOverlay', {}, async () => {
  const r = winmodes.toggleOverlay();
  if (tray) tray.setMode(winmodes.state().mode);
  return { visible: r.visible };
});
ipc.register('app', 'autostart', { on: types.bool, userGesture: types.bool }, async (p, e) => {
  const cur = () => !!app.getLoginItemSettings().openAtLogin;
  if (p.on === undefined) return { on: cur() };
  const w = BrowserWindow.fromWebContents(e.sender);
  if (p.userGesture !== true || !w || w !== win || !w.isFocused()) return { ok: false, err: 'forbidden', hu: 'Csak felhasználói kattintásból.' };
  app.setLoginItemSettings({ openAtLogin: p.on });
  return { on: cur() };
}, { optional: ['on', 'userGesture'] });

// app.log: page-side log lines (frame.js; preload for channels main does not know, DESK-Q18). Page text, marked as such.
ipc.register('app', 'log', { level: types.enum('info', 'warn', 'error'), msg: types.text(500) }, async ({ level, msg }) => {
  audit.write({ ch: 'app.log', ok: true, from: 'page', level, msg });
  return {};
});
ipc.register('app', 'setting', { k: types.text(80), v: types.json(4096) }, async ({ k, v }) => {
  if (!settings.has(k)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen beállítás.' };
  if (v === undefined) return { v: settings.get(k) };
  try { return { v: settings.set(k, v) }; } catch (e) { return { ok: false, err: 'bad-request', hu: 'Érvénytelen érték.' }; }
}, { optional: ['v'] });

// layout (WP-07): the tree, and the rects of the view-backed panes. Views are only ever the ones main knows (viewId 'home').
const reload = () => { const h = homeWc(); if (h) h.reload(); else if (win) win.webContents.reload(); };
const coord = types.int(-20000, 20000), size = types.int(0, 20000);
ipc.register('layout', 'get', {}, async () => currentTree());
ipc.register('layout', 'set', { tree: types.json(65536) }, async ({ tree }) => {
  const v = layoutLib.validate(tree);
  if (!v.ok) return { ok: false, err: 'bad-request', hu: 'Érvénytelen elrendezés.' };
  settings.set('layout.tree', tree);
  const homes = layoutLib.panes(tree).some(p => p.kind === 'home');
  if (!homes && views.has('home')) views.destroy('home');                        // the pane closed: its view goes
  return {};
});
ipc.register('layout', 'bounds', { viewId: types.id, rect: types.obj({ x: coord, y: coord, w: size, h: size }) }, async ({ viewId, rect }) => {
  if (webHost.has(viewId)) return { ok: webHost.bounds(viewId, rect) };           // web tabs (WP-17)
  if (viewId !== 'home') return { ok: false, err: 'bad-request', hu: 'Ismeretlen nézet.' };
  if (!views.has(viewId)) {
    if (!layoutLib.panes(currentTree().tree).some(p => p.kind === 'home')) return { ok: false, err: 'not-found', hu: 'Nincs ilyen panel.' };
    views.createLocal(viewId);
  }
  return { ok: views.setBounds(viewId, rect) };
});

// command palette (WP-08): the index, and run(id) re-resolved in main. palette({open}) hides / shows the web views under the overlay.
const palette = createPalette({ R, acts, log, openPane: kind => ipc.emit(win, 'layout', 'open', { kind, state: {} }) });
ipc.register('layout', 'palette', { open: types.bool }, async ({ open }) => {
  if (open === true) views.hideAll(); else if (open === false) views.showAll();
  if (open === false) return {};
  return { items: palette.index(), recent: palette.recent(), keymap: loadKeymap(path.join(__dirname, '..', 'config', 'keymap.json')) };
}, { optional: ['open'] });
ipc.register('layout', 'run', { cmdId: types.text(80) }, async ({ cmdId }) => palette.run(cmdId));

// job queue (WP-09): long work runs here; the page sees updates, answers questions and cancels. fs.answer will call jobs.answer (WP-12).
const jobs = createJobs({ emit: (type, data) => ipc.emit(win, 'jobs', type, data) });
ipc.register('jobs', 'list', {}, async () => ({ jobs: jobs.list() }));
ipc.register('jobs', 'cancel', { job: types.id }, async ({ job }) => jobs.cancel(job));
ipc.register('jobs', 'answer', { job: types.id, choice: types.id, all: types.bool }, async ({ job, choice, all }) => jobs.answer(job, choice, all), { optional: ['all'] });

// file roots, handles, listing (WP-10): the page holds handles only, main re-resolves every one against the roots
const paths = require('./lib/paths.js');
const { createRoots } = require('./lib/roots.js');
const { createHandles, createFsView } = require('./lib/handles.js');
const cloudattr = require('./lib/cloudattr.js');
const REPO_DIR = path.join(__dirname, '..', '..');
const FULL_DIR = require('fs').existsSync(path.join(REPO_DIR, '..', 'notes', 'features')) ? path.join(REPO_DIR, '..') : (process.env.VRG_FULL || 'H:\\VRG\\Full');
const fsRoots = createRoots({
  configFile: path.join(__dirname, '..', 'config', 'roots.json'), repo: path.resolve(REPO_DIR), full: path.resolve(FULL_DIR),
  getPath: n => app.getPath(n), machineFile: paths.machine(),
});
const fsHandles = createHandles({ roots: fsRoots });
const fsView = createFsView({ roots: fsRoots, handles: fsHandles, cloud: cloudattr });
ipc.register('fs', 'roots', {}, async () => { fsRoots.load(); return { roots: fsView.rootList() }; });
ipc.register('fs', 'list', { dir: types.handle, sort: types.enum('name', 'size', 'mtime'), filter: types.text(100) },
  async ({ dir, sort, filter }) => fsView.list(dir, { sort, filter }), { optional: ['sort', 'filter'] });
ipc.register('fs', 'stat', { h: types.handle }, async ({ h }) => fsView.stat(h));

// file operations as jobs (WP-12): copy / move / rename / mkdir / trash; conflict answers go to the job queue
const { createFsOps } = require('./lib/fsops.js');
const fsOps = createFsOps({ fs: require('fs'), shell, jobs, handles: fsHandles, roots: fsRoots, view: fsView, cloud: cloudattr });
const policy = types.enum('ask', 'skip', 'overwrite', 'rename');
ipc.register('fs', 'copy', { src: types.arr(types.handle, 500), dst: types.handle, policy }, async ({ src, dst, policy }) => fsOps.copy(src, dst, policy), { optional: ['policy'] });
ipc.register('fs', 'move', { src: types.arr(types.handle, 500), dst: types.handle, policy }, async ({ src, dst, policy }) => fsOps.move(src, dst, policy), { optional: ['policy'] });
ipc.register('fs', 'rename', { h: types.handle, name: types.name }, async ({ h, name }) => fsOps.rename(h, name));
ipc.register('fs', 'mkdir', { dir: types.handle, name: types.name }, async ({ dir, name }) => fsOps.mkdir(dir, name));
ipc.register('fs', 'trash', { h: types.arr(types.handle, 500) }, async ({ h }) => fsOps.trash(h));
ipc.register('fs', 'answer', { job: types.id, choice: types.enum('skip', 'overwrite', 'rename', 'cancel', 'yes'), all: types.bool },
  async ({ job, choice, all }) => jobs.answer(job, choice, all), { optional: ['all'] });

// viewer and open-with (WP-13): read / open / reveal / edit / copyPath, all by handle
const { createFileView } = require('./lib/fsview.js');
const codeExe = () => {                                              // paths.code from the single action registry, {full} filled in
  try {
    const menu = JSON.parse(require('fs').readFileSync(path.join(REPO_DIR, 'launcher', 'vrg-menu.json'), 'utf8'));
    const c = menu && menu.paths && menu.paths.code;
    return typeof c === 'string' ? c.replace(/\{full\}/g, path.resolve(FULL_DIR)) : '';
  } catch (e) { return ''; }
};
const fileView = createFileView({ fs: require('fs'), shell, clipboard, handles: fsHandles, roots: fsRoots, cloud: cloudattr, execFile: require('child_process').execFile, codePath: codeExe });
ipc.register('fs', 'read', { h: types.handle, max: types.int(1, 2 * 1024 * 1024), fetch: types.bool },
  async ({ h, max, fetch }) => fileView.read(h, { max, fetch }), { optional: ['max', 'fetch'] });
ipc.register('fs', 'open', { h: types.handle }, async ({ h }) => fileView.open(h));
ipc.register('fs', 'reveal', { h: types.handle }, async ({ h }) => fileView.reveal(h));
ipc.register('fs', 'edit', { h: types.handle }, async ({ h }) => fileView.edit(h));
ipc.register('fs', 'copyPath', { h: types.handle }, async ({ h }) => fileView.copyPath(h));

// terminals (WP-14): ConPTY sessions owned by main; the page names a profile id and a folder handle, nothing else
const ptyLib = require('./lib/pty.js');
let ptyMgr = null;
const termMgr = () => {
  if (ptyMgr) return ptyMgr;
  ptyMgr = ptyLib.createPty({
    profiles: require('./lib/claudeterm.js').withBinOverride(ptyLib.readProfiles(path.join(__dirname, '..', 'config', 'profiles.json')), process.env, s => R.expand(s)),
    expand: s => R.expand(s), env: process.env,
    spawn: ptyLib.nodePtySpawn(ptyLib.loadNodePty(path.join(FULL_DIR, 'tools', 'js-libs', 'node-pty'))),
  });
  ptyMgr.on('data', m => ipc.emit(win, 'term', 'data', m));
  ptyMgr.on('exit', m => ipc.emit(win, 'term', 'exit', m));
  ptyMgr.on('title', m => ipc.emit(win, 'term', 'title', m));
  return ptyMgr;
};
const termAt = v => types.handle(v) || v === 'repo' || (typeof v === 'string' && /^line:[\w-]+$/.test(v));
const termId = v => typeof v === 'string' && /^t[0-9]{1,6}$/.test(v);
ipc.register('term', 'profiles', {}, async () => ({ profiles: termMgr().profiles() }));
ipc.register('term', 'open', { prof: types.id, at: termAt }, async ({ prof, at }) => {
  const cwd = ptyLib.resolveAt(at, { handles: fsHandles, repo: path.resolve(REPO_DIR), lines: R.C ? R.C.data.lines : [] });
  if (!cwd) return { ok: false, err: 'not-found', hu: 'Nincs ilyen mappa.' };
  const r = termMgr().open(prof, cwd);
  return r.term ? { term: r.term, title: r.title } : r;
}, { optional: ['at'] });
ipc.register('term', 'write', { term: termId, data: types.text(65536) }, async ({ term, data }) => { termMgr().write(term, data); return {}; });
ipc.register('term', 'resize', { term: termId, cols: types.int(2, 500), rows: types.int(2, 300) }, async ({ term, cols, rows }) => { termMgr().resize(term, cols, rows); return {}; });
ipc.register('term', 'kill', { term: termId }, async ({ term }) => { termMgr().kill(term); return {}; });
app.on('before-quit', () => { if (ptyMgr) ptyMgr.killAll(); });

// web views (WP-17): isolated tabs; the page names a URL or a view id, main does the rest. Downloads land in the `downloads` root after a yes.
const { createWebHost } = require('./lib/web.js');
const testDownloads = path.join(TMP, 'desk-test-downloads');                      // the selftest never writes into the real Downloads
if (SELFTEST) { try { require('fs').rmSync(testDownloads, { recursive: true, force: true }); require('fs').mkdirSync(testDownloads, { recursive: true }); } catch (e) {} }
// selection menu (WP-19): a feature that is not built stays false, so its item shows greyed with "(később)"
const { createSelMenu } = require('./lib/selmenu.js');
const selMenu = createSelMenu({
  Menu, clipboard, emit: (type, data) => ipc.emit(win, 'sel', type, data),
  features: () => ({ 'web.open': true, 'search.inner': true, 'chat.start': true, 'note.save': true, ctx: true }),   // all built (WP-20, 24, 25, 22); DESK-Q54/56/62 A
});
const webHost = createWebHost({
  onSelection: o => selMenu.popup({ ...o, window: win }),
  getViews: () => views, getSession: p => session.fromPartition(p), settings, jobs,
  emit: (type, data) => ipc.emit(win, 'web', type, data),
  downloadsDir: () => {
    if (SELFTEST) return testDownloads;
    fsRoots.load();
    const r = fsRoots.get('downloads');
    return r ? r.real : null;
  },
  tmpDir: path.join(TMP, SELFTEST ? 'desk-test-dlpart' : 'dl-part'), log,
});
const webSweep = setInterval(() => webHost.sweep(), 60000);
webSweep.unref();
app.on('certificate-error', webHost.certError);

// browser (WP-18): omnibox, find, zoom, bookmarks, history. The page sends words, ids and view ids; main turns them into URLs (lib/search.js).
const search = require('./lib/search.js');
const { createBookmarks } = require('./lib/bookmarks.js');
const webBm = createBookmarks({ file: () => path.join(paths.userDir(), 'web.json'), days: () => settings.get('web.history.days') });
const readJsonList = f => { try { const j = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', 'config', f), 'utf8')); return Array.isArray(j) ? j : []; } catch (e) { return []; } };
const webServers = () => (R.C && R.C.menu && R.C.menu.servers) || [];
const NO_TARGET = { ok: false, err: 'not-found', hu: 'Nincs ilyen cél.' };
// open() targets: an http(s) URL, srv:<id>, web:<id> (config/web.json), srch:<id>:<words> (config/search.json), omni:<omnibox text>
const isTarget = v => typeof v === 'string' && v.length <= 4200 && (types.url(v) || /^(srv|web):[a-z0-9_-]{1,40}$/i.test(v) || /^srch:[a-z0-9_-]{1,40}:[\s\S]{0,2000}$/i.test(v) || /^omni:[\s\S]{1,4096}$/.test(v));
function targetUrl(target) {
  let m;
  if (types.url(target)) return target;
  if ((m = /^srv:([a-z0-9_-]+)$/i.exec(target))) { const s = R.server(m[1]); return s ? R.serverUrl(s) : ''; }
  if ((m = /^web:([a-z0-9_-]+)$/i.exec(target))) { const p = readJsonList('web.json').find(x => x && x.id === m[1]); return p && types.url(p.url) ? p.url : ''; }
  if ((m = /^srch:([a-z0-9_-]+):([\s\S]*)$/i.exec(target))) return search.providerUrl(m[1], m[2]);
  if (target.startsWith('omni:')) return search.toUrl(target.slice(5), { servers: webServers() });
  return '';
}
const webOps = {
  open: target => { const url = targetUrl(target); return url ? webHost.open({ url }) : { ...NO_TARGET }; },
  go: (view, input) => { const url = search.toUrl(input, { servers: webServers() }); return url ? webHost.go(view, url) : { ok: false, err: 'bad-request', hu: 'Üres cím.' }; },
  find: (view, q, dir) => webHost.find(view, q, dir),
  zoom: (view, z) => webHost.zoom(view, z),
  external: view => webHost.external(view, u => shell.openExternal(u)),
  bookmarks: () => ({ bookmarks: webBm.list() }),
  bookmark: view => { const s = webHost.state(view); return s ? webBm.toggle(s.url, s.title) : { ok: false, err: 'not-found', hu: 'Nincs ilyen lap.' }; },
  history: q => ({ history: webBm.history(q) }),
  clearHistory: () => { webBm.clear(); return {}; },
  servers: () => ({
    servers: webServers().map(s => ({ id: s.id, name: s.name, port: s.port })),
    presets: readJsonList('web.json').filter(p => p && typeof p.id === 'string').map(p => ({ id: p.id, hu: String(p.hu || p.id) })),
    providers: search.loadProviders().map(p => ({ id: p.id, hu: String(p.hu || p.id) })),
  }),
};
webHost.on((type, d) => { if (type === 'state' && d && !d.loading && d.title !== 'Hiba' && webHost.webContents(d.view)) webBm.visit(d.url, d.title); });
app.on('before-quit', () => webBm.flush());
ipc.register('web', 'open', { target: isTarget, newTab: types.bool }, async ({ target }) => webOps.open(target), { optional: ['newTab'] });
ipc.register('web', 'go', { view: types.id, input: types.text(4096) }, async ({ view, input }) => webOps.go(view, input));
ipc.register('web', 'find', { view: types.id, q: types.text(200), dir: types.enum('next', 'prev') }, async ({ view, q, dir }) => webOps.find(view, q, dir), { optional: ['dir'] });
ipc.register('web', 'zoom', { view: types.id, z: v => (typeof v === 'number' && v >= 0.25 && v <= 5) || ['in', 'out', 'reset'].includes(v) }, async ({ view, z }) => webOps.zoom(view, z));
ipc.register('web', 'external', { view: types.id }, async ({ view }) => webOps.external(view));
ipc.register('web', 'bookmarks', {}, async () => webOps.bookmarks());
ipc.register('web', 'bookmark', { view: types.id }, async ({ view }) => webOps.bookmark(view));
ipc.register('web', 'history', { q: types.text(200) }, async ({ q }) => webOps.history(q), { optional: ['q'] });
ipc.register('web', 'clearHistory', {}, async () => webOps.clearHistory());
ipc.register('web', 'servers', {}, async () => webOps.servers());
ipc.register('web', 'nav', { view: types.id, cmd: types.enum('back', 'fwd', 'reload', 'stop', 'home') }, async ({ view, cmd }) => webHost.nav(view, cmd));
ipc.register('web', 'close', { view: types.id }, async ({ view }) => webHost.close(view));
ipc.register('web', 'answer', { ask: types.id, allow: types.bool }, async ({ ask, allow }) => webHost.answer(ask, allow));

// selection menu (WP-19): the page sends the selected text and where it came from; main pops the native menu, the choice returns as event sel.pick.
// dryRun is a probe-only flag (selftest runs only): it returns the labels instead of popping the menu.
ipc.register('sel', 'menu', { text: types.text(65536), origin: types.enum('frame', 'term', 'file', 'chat'), dryRun: types.bool }, async ({ text, origin, dryRun }) => {
  if (dryRun === true && SELFTEST) { const t = selMenu.build(text, origin); return { template: t ? selMenu.labels(t) : null }; }
  return { shown: selMenu.popup({ text, origin, window: win }) };
}, { optional: ['dryRun'] });

// internal search (WP-20): the VRG Stack and the code index. The page sends words and a hit index; stack dir, repo and handles are main's.
const { createInnerSearch } = require('./lib/innersearch.js');
const nodeExe = () => { const n = path.join(FULL_DIR, 'tools', 'node', 'node.exe'); return require('fs').existsSync(n) ? n : 'node'; };
const innerSearch = createInnerSearch({
  execFile: require('child_process').execFile, node: nodeExe(), full: path.resolve(FULL_DIR), repo: path.resolve(REPO_DIR),
  issue: abs => { if (!fsRoots.list().length) fsRoots.load(); return fsHandles.issue(abs); },
  statusFile: path.join(FULL_DIR, 'notes', 'stack', 'out', 'STATUS.md'),
});
ipc.register('search', 'inner', { q: types.text(300), layers: types.text(20), budget: types.int(100, 4000) }, async ({ q, layers, budget }) => innerSearch.inner({ q, layers, budget }), { optional: ['layers', 'budget'] });
// quick bar (WP-30): route() decides, main executes what is main's (a palette command, a web URL it resolves itself); the rest goes back as { kind, text }
// for the page to open (search panel, chat, note dialog, palette). An empty input only returns the history.
const quickHistory = quickLib.createHistory({ file: path.join(paths.userDir(), 'quick.json') });
ipc.register('search', 'quick', { input: types.text(500) }, async ({ input }) => {
  const r = quickLib.route(input, { items: palette.index() });
  if (r.kind === 'none') return { kind: 'none', history: quickHistory.list() };
  quickHistory.add(input);
  const out = { kind: r.kind, text: r.text, history: quickHistory.list() };
  if (r.kind === 'command') { const c = await palette.run(r.target); return { ...out, ...(c && c.ok === false ? c : {}) }; }
  if (['google', 'ai', 'url', 'server'].includes(r.kind)) {
    const url = targetUrl(r.target);
    return url ? { ...out, url } : { ...NO_TARGET };
  }
  return out;
});
ipc.register('search', 'openHit', { kind: types.enum('code'), i: types.int(0, 199) }, async ({ i }) => innerSearch.openHit(i));
ipc.register('search', 'node', { id: types.text(160) }, async ({ id }) => innerSearch.node(id));

// context packs (WP-22): stack-json.js writes the pack, main keeps packId → file, "send to Claude" opens an embedded Claude terminal (WP-16)
const { createCtx, validId: ctxId } = require('./lib/ctx.js');
const { createClaudeTerm } = require('./lib/claudeterm.js');
let claudeTerm = null;
const claudeTermGet = () => { if (!claudeTerm) claudeTerm = createClaudeTerm({ pty: termMgr(), emit: (ns, type, d) => ipc.emit(win, ns, type, d), env: process.env, expand: s => R.expand(s), log, repo: path.resolve(REPO_DIR) }); return claudeTerm; };
const claudeTermLazy = { open: o => claudeTermGet().open(o), resume: (account, session) => claudeTermGet().resume(account, session) };
const ctxLib = createCtx({
  execFile: require('child_process').execFile, node: nodeExe(), stackDir: path.join(FULL_DIR, 'notes', 'stack'),
  paths, claudeterm: claudeTermLazy, repo: path.resolve(REPO_DIR),
});
const ctxIds = max => v => Array.isArray(v) && v.length >= 1 && v.length <= max && v.every(ctxId);
ipc.register('ctx', 'expand', { ids: ctxIds(50), layers: types.text(20), depth: types.int(1, 2) }, async ({ ids, layers, depth }) => ctxLib.expand(ids, layers, depth));
ipc.register('ctx', 'pack', { ids: ctxIds(80), budget: types.int(300, 20000), withL0: types.bool, withLines: types.bool, note: types.text(2000) },
  async ({ ids, budget, withL0, withLines, note }) => ctxLib.pack(ids, { budget, withL0, withLines, note }), { optional: ['withL0', 'withLines', 'note'] });
ipc.register('ctx', 'clusters', {}, async () => ctxLib.clusters());
ipc.register('ctx', 'saveCluster', { name: types.text(80), ids: ctxIds(80) }, async ({ name, ids }) => ctxLib.saveCluster(name, ids));
ipc.register('ctx', 'deleteCluster', { id: types.id }, async ({ id }) => ctxLib.deleteCluster(id));
ipc.register('ctx', 'sendToClaude', { packId: types.id, how: types.enum('term-A', 'term-B', 'chat') }, async ({ packId, how }) => ctxLib.sendToClaude(packId, how));

// chat engine (WP-23): headless `claude -p` stream-json; the prompt goes on stdin, the page gets deltas as events (chat.*)
const { createChat } = require('./lib/chat.js');
const chatLib = createChat({
  // the test binary (VRG_CLAUDE_BIN = a .js) runs through process.execPath = electron.exe: only then it needs ELECTRON_RUN_AS_NODE to behave as node (stdin works)
  spawn: (exe, args, o) => require('child_process').spawn(exe, args, exe === process.execPath ? { ...o, env: { ...o.env, ELECTRON_RUN_AS_NODE: '1' } } : o),
  execFile: require('child_process').execFile, env: process.env, repo: path.resolve(REPO_DIR),
  bin: () => R.C ? R.expand('{claude}') : '', claudeDirB: path.join(path.resolve(FULL_DIR), 'home', 'claude-account-b'), paths,
  emit: (type, data) => ipc.emit(win, 'chat', type.replace(/^chat\./, ''), data),
  packText: id => { const f = ctxLib.packFile(id); try { return f ? require('fs').readFileSync(f, 'utf8') : null; } catch (e) { return null; } },
  readFile: async h => {
    const r = await fileView.read(h, { max: 65536 });
    if (!r || r.kind !== 'text' || typeof r.text !== 'string') return null;
    const st = await fsView.stat(h);
    return { name: st && st.item && st.item.name, text: r.text };
  },
  keepText: () => { try { return settings.get('chat.keepText') === true; } catch (e) { return false; } },   // default off (DESK-Q60 A)
  log,
});
ipc.register('chat', 'start', {
  account: types.enum('A', 'B'), prompt: types.text(256 * 1024), tools: types.enum('read', 'none'),
  attach: types.obj({ text: types.text(64 * 1024), packId: types.id, file: types.handle }, { optional: ['text', 'packId', 'file'] }),
}, async p => chatLib.start(p), { optional: ['attach'] });
ipc.register('chat', 'follow', { chat: types.id, prompt: types.text(256 * 1024) }, async ({ chat, prompt }) => chatLib.follow(chat, prompt));
ipc.register('chat', 'stop', { chat: types.id }, async ({ chat }) => chatLib.stop(chat));
ipc.register('chat', 'list', {}, async () => chatLib.list());
ipc.register('chat', 'history', { chat: types.id }, async ({ chat }) => chatLib.history(chat));   // DESK-Q63 B
// "Folytatás terminálban" (WP-24): main looks the session up itself; the page only names the chat
ipc.register('chat', 'toTerminal', { chat: types.id }, async ({ chat }) => {
  const c = chatLib.list().chats.find(x => x.chat === chat);
  if (!c) return { ok: false, err: 'not-found', hu: 'Nincs ilyen beszélgetés.' };
  if (!c.session) return { ok: false, err: 'not-found', hu: 'A beszélgetés még nem folytatható.' };
  const r = claudeTermLazy.resume(c.account, c.session);
  return r && r.term ? { term: r.term } : (r || { ok: false, err: 'error', hu: 'A terminál nem indult el.' });
});
app.on('before-quit', () => chatLib.killAll());

// dev notes (WP-25): the Divergence outbox through `tools/divergence.js jot`; the page names a topic, a title, a text and a source label, never a path
const { createNotes, TOPIC_RE: NOTE_TOPIC } = require('./lib/notes.js');
const notesLib = createNotes({ execFile: require('child_process').execFile, node: nodeExe(), repo: path.resolve(REPO_DIR) });
ipc.register('note', 'topics', {}, async () => ({ ok: true, ...notesLib.topics() }));
ipc.register('note', 'save', {
  topic: v => typeof v === 'string' && NOTE_TOPIC.test(v), title: types.text(120), text: types.text(64 * 1024),
  source: types.obj({ kind: types.enum('url', 'file', 'node', 'term', 'chat'), ref: types.text(500) }),
}, async p => notesLib.save(p), { optional: ['source'] });

// git panel (WP-31, DESK-Q11 A): status / branches / commit / guarded push. The page names a repo id and file indexes of the last status reply, never a path.
// A push that needs credentials runs in an embedded `cmd` terminal (WP-15) so Git Credential Manager's own prompt shows; the panel never sees credentials.
const gitExe = () => {                                                            // paths.git from the single action registry, {full} filled in
  try {
    const g = JSON.parse(require('fs').readFileSync(path.join(REPO_DIR, 'launcher', 'vrg-menu.json'), 'utf8')).paths.git;
    const f = typeof g === 'string' ? g.replace(/\{full\}/g, path.resolve(FULL_DIR)) : '';
    return f && require('fs').existsSync(f) ? f : 'git';
  } catch (e) { return 'git'; }
};
const gitLib = require('./lib/git.js').createGit({
  execFile: require('child_process').execFile, git: gitExe(), node: nodeExe(), anonymiseJs: path.join(path.resolve(REPO_DIR), 'tools', 'anonymise.js'),
  repos: () => ((R.C && R.C.menu && R.C.menu.repos) || []).filter(r => r && r.name && r.path).map(r => ({ name: r.name, path: R.expand(r.path) })),
  openTerm: (cwd, args) => {
    if (SELFTEST) return { ok: false, hu: 'A teszt nem nyit terminált.' };
    const t = termMgr().open('cmd', cwd);
    if (!t.term) return t;
    ipc.emit(win, 'layout', 'open', { kind: 'term', term: t.term, prof: 'cmd' });
    setTimeout(() => { try { termMgr().write(t.term, '"' + gitExe() + '" ' + args + '\r'); } catch (e) {} }, 1000);
    return { term: t.term };
  },
});
const gitRepo = types.id, gitIx = types.int(0, 9999);
ipc.register('git', 'repos', {}, async () => gitLib.repos());
ipc.register('git', 'status', { repo: gitRepo }, async ({ repo }) => gitLib.status(repo));
ipc.register('git', 'branches', { repo: gitRepo }, async ({ repo }) => gitLib.branches(repo));
ipc.register('git', 'worktrees', { repo: gitRepo }, async ({ repo }) => gitLib.worktrees(repo));
ipc.register('git', 'log', { repo: gitRepo, n: types.int(1, 200) }, async ({ repo, n }) => gitLib.log(repo, n));
ipc.register('git', 'diff', { repo: gitRepo, fileIx: gitIx, cached: types.bool }, async ({ repo, fileIx, cached }) => gitLib.diff(repo, fileIx, cached), { optional: ['cached'] });
ipc.register('git', 'branch', { repo: gitRepo, name: types.text(60), switch: types.bool }, async ({ repo, name, switch: sw }) => gitLib.branch(repo, name, sw), { optional: ['switch'] });
ipc.register('git', 'commit', { repo: gitRepo, fileIxs: types.arr(gitIx, 2000), msg: types.text(2000) }, async ({ repo, fileIxs, msg }) => gitLib.commit(repo, fileIxs, msg));
ipc.register('git', 'push', { repo: gitRepo, confirm: types.text(80) }, async ({ repo, confirm }) => gitLib.push(repo, confirm));

// mail (WP-27): Gmail over OAuth (PKCE, loopback, system browser) + the webmail presets. Tokens stay in secrets.bin; the page gets ids and bools.
const { createOAuth } = require('./lib/oauth.js');
const { createGmail } = require('./lib/gmail.js');
const { createMail, createSanitizer, linkPolicy } = require('./lib/mail.js');
const { webPrefs } = require('./lib/views.js');
const mailProviders = require('./lib/oauth.js').loadProviders();                 // one object: the WP-28 probe points it at the mock
const oauthLib = createOAuth({
  secrets, audit, providers: mailProviders,
  opener: async url => { if (SELFTEST || !types.url(url)) throw new Error('no-browser'); await shell.openExternal(url); },   // the selftest never opens a browser
});
// WP-28: the message HTML is sanitized here in main (DOMPurify in a hidden, sandboxed helper view with no preload), never in a page with window.vrg.
const mailSanitizer = createSanitizer({
  WebContentsView, webPrefs, log,
  source: () => { const u = libUrls().dompurify; if (!u) throw new Error('DOMPurify not vendored'); return require('fs').readFileSync(require('url').fileURLToPath(u), 'utf8'); },
});
const mailTest = { loopback: false };                                             // selftest only: lets the read view load the mock's http://127.0.0.1 image
const mailLink = u => {                                                           // a click in the read view: http(s) → the browser pane, mailto → copy offer, rest refused
  const p = linkPolicy(u);
  ipc.emit(win, 'mail', 'link', p.action === 'web' ? { action: 'web', url: p.url } : p.offer ? { action: 'refuse', offer: p.offer, address: p.address, hu: p.hu } : { action: p.action });
};
const mailDownloads = () => {
  if (SELFTEST) return testDownloads;
  fsRoots.load();
  const r = fsRoots.get('downloads');
  return r ? r.real : null;
};
const mailLib = createMail({
  oauth: oauthLib, gmail: createGmail({ oauth: oauthLib, providers: mailProviders }), presets: () => readJsonList('web.json'),
  jobs, downloadsDir: mailDownloads, sanitize: html => mailSanitizer.sanitize(html), loopback: () => SELFTEST && mailTest.loopback,
  template: (() => { try { return require('fs').readFileSync(path.join(__dirname, '..', 'page', 'mailview.html'), 'utf8'); } catch (e) { return ''; } })(),
  readView: {
    show: (doc, o) => views.createMailView(doc, { onLink: mailLink, onSelection: text => selMenu.popup({ text, origin: 'web', ref: '', window: win }) }),
    hide: () => views.destroy('mailview'),
  },
});
app.on('will-quit', () => mailSanitizer.close());
ipc.register('mail', 'accounts', {}, async () => ({ accounts: mailLib.accounts() }));
ipc.register('mail', 'signIn', { acc: types.id }, async ({ acc }) => mailLib.signIn(acc));
ipc.register('mail', 'signOut', { acc: types.id }, async ({ acc }) => mailLib.signOut(acc));
ipc.register('mail', 'list', { acc: types.id, q: types.text(200), page: types.text(200) }, async ({ acc, q, page }) => mailLib.list(acc, q, page), { optional: ['q', 'page'] });
ipc.register('mail', 'get', { acc: types.id, msg: types.id }, async ({ acc, msg }) => {
  const r = await mailLib.get(acc, msg);
  return r.ok ? { ok: true, headers: r.headers, html: r.html, text: r.text, attachments: r.attachments.map(a => ({ att: a.att, name: a.name, size: a.size })) } : r;   // html is sanitized (WP-28, DESK-Q72)
});
ipc.register('mail', 'saveAttachment', { acc: types.id, msg: types.id, att: types.id }, async ({ acc, msg, att }) => mailLib.saveAttachment(acc, msg, att));
ipc.register('mail', 'render', { acc: types.id, msg: types.id, images: types.bool }, async ({ acc, msg, images }) => mailLib.render(acc, msg, images));
ipc.register('mail', 'closeView', {}, async () => mailLib.closeView());

// presets and feeds (WP-29): config/presets.json + <userDir>/presets.json; each run is a job, results are cached in the cache dir.
// An item's target (act id, web:/srv:/srch:, or the cached http(s) link) is resolved here; the page only sends a preset id and an item index.
const presetsMod = require('./lib/presets.js');
const readJsonFile = f => { try { return JSON.parse(require('fs').readFileSync(f, 'utf8')); } catch (e) { return null; } };
const presetsLib = presetsMod.createPresets({
  jobs, log,
  configFile: path.join(__dirname, '..', 'config', 'presets.json'),
  userFile: () => readJsonFile(path.join(paths.userDir(), 'presets.json')),
  cacheFile: () => path.join(paths.cache(), 'presets.json'),
  sources: {
    driftFile: path.join(FULL_DIR, 'notes', 'stack', 'out', 'DRIFT.md'),
    repoPath: name => { const r = ((R.C && R.C.menu && R.C.menu.repos) || []).find(x => x && x.name === name); return r ? R.expand(r.path) : ''; },
    ports: () => webServers().map(s => ({ id: s.id, name: s.name, port: s.port, up: !!ports.ports[s.port] })),
    lines: () => (R.C && R.C.data && R.C.data.lines) || [],
    mail: { accounts: () => mailLib.accounts(), list: (acc, q) => mailLib.list(acc, q) },
  },
});
presetsMod.bind(presetsLib);                                                      // the palette's pre:<id> items run through it
if (!SELFTEST) presetsLib.start();
ipc.register('feed', 'presets', {}, async () => presetsLib.list());
ipc.register('feed', 'run', { pre: types.id }, async ({ pre }) => presetsLib.run(pre));
ipc.register('feed', 'results', {}, async () => presetsLib.results());
ipc.register('feed', 'open', { pre: types.id, i: types.int(0, 199) }, async ({ pre, i }) => {
  const r = presetsLib.resolveOpen(pre, i);
  if (!r.ok) return r;
  if (isTarget(r.target)) return webOps.open(r.target);
  const c = await palette.run(r.target);
  return c && c.ok === false ? { ok: false, err: c.err || 'error', hu: c.hu } : { ok: true };
});
app.on('will-quit', () => presetsLib.stop());

ipc.legacy('handle', 'vrg:act',(e, id) => acts.runAct(id));
ipc.legacy('handle', 'vrg:ports', () => ports.ports);
ipc.legacy('handle', 'vrg:refresh', () => { build.write(); R.load(); ports.pollPorts(); reload(); return true; });
ipc.legacy('on', 'vrg:win', (e, cmd) => {
  if (!win) return;
  if (cmd === 'min') win.minimize();
  else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (cmd === 'close') win.close();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (tray) tray.destroy(); if (ptyMgr) ptyMgr.killAll(); });   // DESK-Q40: before-quit can be skipped (session end); will-quit kills what is left

app.whenReady().then(async () => {
  build.write(); R.load();                                             // the page always starts on fresh data
  createWindow();
  setupShell();
  await ports.pollPorts();
  pollTimer = setInterval(ports.pollPorts, 4000);
  if (SELFTEST) selftest();
});
