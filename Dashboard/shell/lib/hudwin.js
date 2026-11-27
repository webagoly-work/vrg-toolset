// hudwin.js — the Parancs-héj's answer outside the VRG Asztal (WP-56): a small always-on-top window that shows the overlay's short answer
// while another program is in front (the global push-to-talk key). It never takes the focus, never takes input, and hides itself.
//   const h = createHudWin({ BrowserWindow, screen, file, preload, log });
//   h.show({ state, say, detail })   state: 'listen' | 'busy' | 'result' | 'error' | 'speak' · h.hide() · h.destroy()
// The page (page/hud.html) only receives (window.hud.on); it has no vrg API and sends nothing back.
'use strict';

const HIDE_MS = { result: 6500, error: 6500, speak: 9000, acting: 15000 };
const W = 420, H = 96, MARGIN = 18;
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const STATES = ['listen', 'busy', 'result', 'error', 'speak', 'acting'];   // acting: WP-58, a red frame while an action runs

// the message the hud page gets: fixed keys, plain text, capped
function message(m) {
  const o = m && typeof m === 'object' ? m : {};
  return { state: STATES.includes(o.state) ? o.state : 'result', say: clean(o.say, 120), detail: clean(o.detail, 240) };
}
// bottom-right of the work area of the display the cursor is on
function place(area) {
  const a = area || { x: 0, y: 0, width: 1280, height: 720 };
  return { x: Math.round(a.x + a.width - W - MARGIN), y: Math.round(a.y + a.height - H - MARGIN), width: W, height: H };
}

function createHudWin({ BrowserWindow, screen, file, preload, log = () => {} } = {}) {
  let win = null, timer = null, ready = null;
  function ensure() {
    if (win && !win.isDestroyed()) return ready;
    win = new BrowserWindow({
      ...place(null), frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true,
      alwaysOnTop: true, show: false, hasShadow: false, fullscreenable: false,
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    ready = win.loadFile(file).catch(e => log('hudwin', 'load failed', e && e.message));
    win.on('closed', () => { win = null; });
    return ready;
  }
  async function show(m) {
    const msg = message(m);
    await ensure();
    if (!win) return false;
    try {
      const pt = screen && screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : null;
      const d = pt && screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint(pt) : (screen && screen.getPrimaryDisplay ? screen.getPrimaryDisplay() : null);
      win.setBounds(place(d && d.workArea));
    } catch (e) {}
    win.webContents.send('hud', msg);
    if (!win.isVisible()) win.showInactive();
    clearTimeout(timer);
    if (HIDE_MS[msg.state]) timer = setTimeout(hide, HIDE_MS[msg.state]);
    return true;
  }
  function hide() { clearTimeout(timer); if (win && !win.isDestroyed() && win.isVisible()) win.hide(); }
  function destroy() { clearTimeout(timer); if (win && !win.isDestroyed()) win.destroy(); win = null; }
  return { show, hide, destroy };
}

module.exports = { createHudWin, message, place, STATES };
