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
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path'), os = require('os');
const build = require('../build.js');
const { createRegistry } = require('./lib/registry.js');
const { createRunner } = require('./lib/runbat.js');
const { createPorts } = require('./lib/ports.js');
const { createActs } = require('./lib/acts.js');
const { createSelftest } = require('./lib/selftest.js');

const PAGE = path.join(__dirname, '..', 'vrg-dashboard.html');
const SELFTEST = process.argv.includes('--selftest');
const TMP = path.join(os.tmpdir(), 'VRG');

if (!SELFTEST && !app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('VRG.Dashboard');

let win = null, pollTimer = 0;
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
  win.loadFile(PAGE);
}

ipcMain.handle('vrg:act', (e, id) => acts.runAct(id));
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

app.whenReady().then(async () => {
  build.write(); R.load();                                             // the page always starts on fresh data
  createWindow();
  await ports.pollPorts();
  pollTimer = setInterval(ports.pollPorts, 4000);
  if (SELFTEST) selftest();
});
