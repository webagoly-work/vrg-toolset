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
const { app, BrowserWindow, WebContentsView, ipcMain, shell, screen, globalShortcut, Tray, Menu, nativeImage, safeStorage } = require('electron');
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
const { createJobs } = require('./lib/jobs.js');

const PAGE = path.join(__dirname, '..', 'vrg-dashboard.html');                 // the Kezdőlap, shown in a view
const FRAME = path.join(__dirname, '..', 'page', 'vrg-desktop.html');          // the main window: the frame page
const SELFTEST = process.argv.includes('--selftest');
const TMP = path.join(os.tmpdir(), 'VRG');
if (SELFTEST) process.env.VRG_DESK_HOME = path.join(TMP, 'desk-test-home');       // the selftest never touches the real home (CONTRACT §4.9)
const secrets = createSecrets({ safeStorage });                                  // main-only: no IPC reaches it

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
const acts = createActs({ R, run, ports, log });

// The selftest looks at "the page" through win.webContents: that is now the Kezdőlap view (D1 ids ≥ 30), everything
// else (modes, sizes) is the real window. win.desk hands the frame and the views to the WP-07 probe.
const selftestWin = () => new Proxy(win, {
  get(t, k) {
    if (k === 'desk') return { frame: t, home: homeWc(), views, palette, jobs };
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
  win.on('closed', () => { views.destroyAll(); });
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
}

// IPC v2: schema-checked channels (lib/ipc.js, API.md). Only these two pages may call; a web view never can.
const fileUrl = p => require('url').pathToFileURL(p).href;
const audit = createAudit(SELFTEST ? { dir: path.join(TMP, 'desk-test-audit') } : {});   // default dir = paths.logs()
const ipc = createIpc({
  ipcMain, audit, log,
  allowedUrls: () => [fileUrl(PAGE), fileUrl(path.join(__dirname, '..', 'page', 'vrg-desktop.html'))],
});
ipc.register('app', 'info', {}, async () => ({
  version: app.getVersion(), user: 'founder', mode: winmodes ? winmodes.state().mode : 'ablak', features: ipc.namespaces(),
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

ipcMain.handle('vrg:act',(e, id) => acts.runAct(id));
ipcMain.handle('vrg:ports', () => ports.ports);
ipcMain.handle('vrg:refresh', () => { build.write(); R.load(); ports.pollPorts(); reload(); return true; });
ipcMain.on('vrg:win', (e, cmd) => {
  if (!win) return;
  if (cmd === 'min') win.minimize();
  else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (cmd === 'close') win.close();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (tray) tray.destroy(); });

app.whenReady().then(async () => {
  build.write(); R.load();                                             // the page always starts on fresh data
  createWindow();
  setupShell();
  await ports.pollPorts();
  pollTimer = setInterval(ports.pollPorts, 4000);
  if (SELFTEST) selftest();
});
