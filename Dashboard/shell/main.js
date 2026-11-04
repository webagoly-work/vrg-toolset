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
const { app, BrowserWindow, ipcMain, shell, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
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

const PAGE = path.join(__dirname, '..', 'vrg-dashboard.html');
const SELFTEST = process.argv.includes('--selftest');
const TMP = path.join(os.tmpdir(), 'VRG');

if (!SELFTEST && !app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('VRG.Dashboard');

let win = null, pollTimer = 0, winmodes = null, tray = null;
const log = (...a) => console.log('[dash]', ...a);
const R = createRegistry({ build, log });
const run = createRunner({ R, shell, tmp: TMP });
const ports = createPorts({ R, run, onChange: p => { if (win && !win.isDestroyed()) win.webContents.send('vrg:ports', p); } });
const acts = createActs({ R, run, ports, log });
const selftest = createSelftest({ app, getWin: () => win, build, R, acts, run, ports, argv: process.argv, tmp: TMP, stopPolling: () => clearInterval(pollTimer) });

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
  winmodes = createWinModes({
    win, screen, log,
    file: SELFTEST ? path.join(TMP, 'desk-test-winstate.json') : path.join(app.getPath('userData'), 'winstate.json'),   // WP-06 moves it
  });
  win.loadFile(PAGE);
}

function setupShell() {
  if (SELFTEST) return;                                    // the selftest never grabs the hotkey or adds a tray icon
  winmodes.restore();
  tray = createTray({
    Tray, Menu, nativeImage, iconPath: path.join(__dirname, 'icon.png'),
    handlers: {
      mode: m => { winmodes.mode(m); tray.setMode(m); },
      show: () => { if (win.isMinimized()) win.restore(); win.show(); win.focus(); },
      refresh: () => { build.write(); R.load(); ports.pollPorts(); win.webContents.reload(); },
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
const audit = createAudit(SELFTEST ? { dir: path.join(TMP, 'desk-test-audit') } : {});
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

ipcMain.handle('vrg:act',(e, id) => acts.runAct(id));
ipcMain.handle('vrg:ports', () => ports.ports);
ipcMain.handle('vrg:refresh', () => { build.write(); R.load(); ports.pollPorts(); win.webContents.reload(); return true; });
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
