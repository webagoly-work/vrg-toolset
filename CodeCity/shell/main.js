// main.js — the Kódváros overlay shell (P12 L2, KV-25; report §1.5, CITY-D20 A). Electron, pinned in vendor-manifest.json,
// unpacked by CodeCity/tools/fetch-electron.js into Planner/apps/electron. Started by START.cmd K → F, or by hand:
//   Planner\apps\electron\electron.exe CodeCity\shell [--port 8797] [--hotkey Control+Alt+K] [--selftest]
// - one transparent, frameless, always-on-top window per monitor, each loading the segéd page with #mode=overlay;
// - the hotkey summons and hides all of them (Esc hides too); if the combination is taken, the tray says so and the
//   fallback Control+Alt+Shift+K is tried — globalShortcut.register only returns false, it never throws;
// - click-through with forward: the windows ignore the mouse except where the page reports something solid (a panel,
//   a building, a plate — 00-wallpaper.js), so the desktop under the empty sky stays usable;
// - hidden = hide(): the page sees visibilitychange and closes its stream; nothing draws, the segéd drops the samplers;
// - tray: show/hide, click-through on/off, reload, quit. One instance: starting it again summons the running one.
// - KV-26: while summoned, the open windows' capture sources (id, handle, a 480×300 thumbnail — no title) go to the page
//   (36-portal puts them on the program constructs: three refreshed every second, the rest every 3 s); the page's hand-off hides the overlay with Esc still held:
//   Esc (or the hotkey) then brings the overlay back and tells the page to put the window back.
// Nothing here talks to anything but 127.0.0.1:<port>; navigation off that origin and new windows are refused.
'use strict';
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, dialog, desktopCapturer } = require('electron');
const path = require('path'), http = require('http');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = +arg('--port', 8797), ORIGIN = `http://127.0.0.1:${PORT}`;
const HOTKEYS = [arg('--hotkey', 'Control+Alt+K'), 'Control+Alt+Shift+K'];
const SELFTEST = process.argv.includes('--selftest') || process.argv.includes('--portal-test');

if (!app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('VRG.Kodvaros.Overlay');

const state = { wins: [], shown: false, clickThrough: true, hotkey: null, tray: null, summonMs: [], portal: false, srcTimer: 0, liveHs: new Set(), scan: 0, scanning: false };
const log = (...a) => console.log('[kv-shell]', ...a);

// a 16×16 tray icon drawn in code (a cyan hexagon ring), so the shell has no binary asset
function trayIcon() {
  const n = 16, buf = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5), d = Math.max(dx * 0.866 + dy * 0.5, dy);
    const o = (y * n + x) * 4;
    if (d < 7.2 && d > 4.6) { buf[o] = 0xff; buf[o + 1] = 0xd3; buf[o + 2] = 0x6f; buf[o + 3] = 0xff; }   // BGRA #6fd3ff
  }
  return nativeImage.createFromBitmap(buf, { width: n, height: n });
}

function pageUrl(i) { return `${ORIGIN}/#mode=overlay&display=${i}`; }

function makeWindow(display, i) {
  const b = display.bounds;
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, show: false, frame: false, transparent: true, hasShadow: false,
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true,
    backgroundColor: '#00000000', title: 'Kódváros overlay',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: true },
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setIgnoreMouseEvents(state.clickThrough, { forward: true });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN + '/')) e.preventDefault(); });
  if (process.env.KV_SHELL_DEBUG) w.webContents.on('console-message', (e) => log(`page ${i}: ${e.message}`));
  w.loadURL(pageUrl(i));
  w.kvDisplay = display.id;
  return w;
}

function buildWindows() {
  for (const w of state.wins) w.destroy();
  state.wins = screen.getAllDisplays().map(makeWindow);
  state.shown = false;
}

// summon: every window shows; the one under the cursor gets the focus, so the palette and Esc reach the page
async function show() {
  const t0 = process.hrtime.bigint();
  const at = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
  for (const w of state.wins) if (w.kvDisplay !== at) w.showInactive();
  const main = state.wins.find(w => w.kvDisplay === at) || state.wins[0];
  main.show(); main.focus();
  state.shown = true; state.portal = false;
  if (!globalShortcut.isRegistered('Escape')) globalShortcut.register('Escape', escape);

  // painted = two animation frames after showing (the compositor has the page on screen)
  await main.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  state.summonMs.push(ms);
  log(`summoned in ${ms.toFixed(0)} ms`);
  // only now the window screens (36-portal): a capture scan right at the summon would slow the first frame
  if (state.shown) { state.scan = 0; sendSources(); clearInterval(state.srcTimer); state.srcTimer = setInterval(sendSources, 1000); }
  return ms;
}
function hide(keepEsc) {
  for (const w of state.wins) w.hide();
  state.shown = false;
  clearInterval(state.srcTimer); state.srcTimer = 0;
  if (keepEsc !== true) globalShortcut.unregister('Escape');
}
// the page handed a window off (36-portal): hidden, but Esc still brings the city back
function handoff() { state.portal = true; hide(true); }
async function back() {
  state.portal = false;
  await show();
  const main = state.wins.find(w => w.isFocused()) || state.wins[0];
  main.webContents.send('kv-return');
}
const escape = () => (state.portal ? back() : hide());
const toggle = () => (state.portal ? back() : state.shown ? hide() : show());

// the open windows for the page's screens: id + handle + a JPEG picture, never the title; the overlay's own windows left
// out. One scan a second (~0.3 s, async): the page's three live windows get a 960×600 picture every scan, the rest a
// 480 px one every third scan (then no picture, the page keeps the last).
async function sendSources() {
  if (!state.shown || state.scanning) return;
  state.scanning = true;
  const full = state.scan++ % 3 === 0;
  try {
    const own = new Set(state.wins.map(w => w.getNativeWindowHandle().readBigUInt64LE(0).toString()));
    const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 960, height: 600 }, fetchWindowIcons: false }).catch(() => []);
    if (!state.shown) return;
    const list = srcs.map(s => ({ s, h: +s.id.split(':')[1] })).filter(x => x.h && !own.has(String(x.h))).map(({ s, h }) => {
      const sz = s.thumbnail.getSize(), live = state.liveHs.has(h), img = s.thumbnail.isEmpty() || !(live || full) ? null
        : 'data:image/jpeg;base64,' + (live ? s.thumbnail : s.thumbnail.resize({ width: 480 })).toJPEG(72).toString('base64');
      return { id: s.id, h, w: sz.width, hh: sz.height, img };
    });
    for (const w of state.wins) if (!w.isDestroyed()) w.webContents.send('kv-sources', list);
  } finally { state.scanning = false; }
}

function setClickThrough(on) {
  state.clickThrough = on;
  for (const w of state.wins) w.setIgnoreMouseEvents(on, { forward: true });
  refreshTray();
}

function refreshTray() {
  if (!state.tray) return;
  state.tray.setToolTip(`Kódváros overlay — ${state.hotkey || 'no hotkey'}`);
  state.tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Megjelenítés / elrejtés${state.hotkey ? '  (' + state.hotkey + ')' : ''}`, click: toggle },
    { label: 'Átkattintás az üres égen', type: 'checkbox', checked: state.clickThrough, click: m => setClickThrough(m.checked) },
    { label: 'Újratöltés', click: () => state.wins.forEach((w, i) => w.loadURL(pageUrl(i))) },
    { type: 'separator' },
    { label: 'Kilépés', click: () => app.quit() },
  ]));
}

function registerHotkey() {
  for (const k of HOTKEYS) {
    if (globalShortcut.register(k, toggle)) { state.hotkey = k; break; }
    log(`hotkey ${k} is taken by another program`);
  }
  if (state.hotkey !== HOTKEYS[0]) {
    const msg = state.hotkey ? `${HOTKEYS[0]} foglalt egy másik programnál — helyette: ${state.hotkey}` : `Egyik gyorsbillentyű sem szabad (${HOTKEYS.join(', ')}) — a tálcaikonnal hívd elő, vagy indítsd --hotkey <kombináció>-val.`;
    state.tray.displayBalloon({ title: 'Kódváros overlay', content: msg, iconType: 'warning' });
  }
}

const segedUp = () => new Promise(r => { const q = http.get(ORIGIN + '/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); q.setTimeout(1500, () => { q.destroy(); r(false); }); });

// the page reports where it is solid; with click-through on, everything else falls through to the desktop
ipcMain.on('kv-solid', (e, solid) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w && state.clickThrough) w.setIgnoreMouseEvents(!solid, { forward: true });
});
ipcMain.on('kv-hide', () => hide());
ipcMain.on('kv-handoff', handoff);
ipcMain.on('kv-live', (e, hs) => { if (Array.isArray(hs)) state.liveHs = new Set(hs.slice(0, 3).filter(Number.isInteger)); });

app.on('second-instance', () => { if (!state.shown) show(); });
app.on('window-all-closed', e => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(async () => {
  state.tray = new Tray(trayIcon());
  state.tray.on('click', toggle);
  refreshTray();
  if (!(await segedUp())) {
    if (SELFTEST) { console.log(JSON.stringify({ pass: false, error: `no segéd on ${ORIGIN}` })); app.exit(1); return; }
    dialog.showMessageBoxSync({ type: 'warning', title: 'Kódváros overlay', message: `A Kódváros segéd nem fut (${ORIGIN}).`, detail: 'Indítsd el: START.cmd → K → S (élő mód), aztán az overlayt újra.' });
    app.quit(); return;
  }
  buildWindows();
  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(ev, () => { const was = state.shown; buildWindows(); if (was) show(); });
  registerHotkey();
  refreshTray();
  log(`ready: ${state.wins.length} monitor(s), hotkey ${state.hotkey || 'none'}, ${ORIGIN}`);
  if (process.argv.includes('--selftest')) require('./selftest.js')({ state, show, hide, log, escape });
  if (process.argv.includes('--portal-test')) require('./portaltest.js')({ state, show, log });   // KV-26 check, Zen open
});
