// winmodes.js — window modes (WP-04, DESK-Q08 A): ablak (normal frameless), munka (full screen, covers the taskbar),
// overlay (always on top, hidden / shown by a global hotkey). Nothing here changes Windows itself.
//   const wm = createWinModes({ win, screen, file, log, onChange });  wm.mode('munka');  wm.toggleOverlay();
// Electron objects are passed in, so node --test can load this file with a fake window.
'use strict';
const fs = require('fs');

const MODES = ['ablak', 'munka', 'overlay'];
const isMode = m => typeof m === 'string' && MODES.includes(m);
const rectOk = b => !!b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k])) && b.width > 0 && b.height > 0;
const pickRect = b => ({ x: b.x, y: b.y, width: b.width, height: b.height });

// apply(win, screen, mode, display, st): put the window into `mode`. st = { normalBounds } is the remembered normal size.
function apply(win, screen, mode, display, st = {}) {
  if (!isMode(mode)) throw new Error('winmodes: unknown mode ' + mode);
  if (mode === 'ablak') {
    win.setAlwaysOnTop(false);
    win.setFullScreen(false);
    if (rectOk(st.normalBounds)) win.setBounds(pickRect(st.normalBounds));
  } else if (mode === 'munka') {
    win.setAlwaysOnTop(false);
    if (display && rectOk(display.bounds)) win.setBounds(pickRect(display.bounds));   // full screen goes to the display that holds the window
    win.setFullScreen(true);
  } else {
    win.setFullScreen(false);
    win.setAlwaysOnTop(true, 'screen-saver');
    const area = display && (rectOk(display.workArea) ? display.workArea : display.bounds);
    if (rectOk(area)) win.setBounds(pickRect(area));
  }
}

function createWinModes({ win, screen, file = '', log = () => {}, onChange = () => {} }) {
  const st = { mode: 'ablak', displayId: null, normalBounds: null, visible: true };

  const displayFor = () => {
    try { return screen.getDisplayMatching(win.getBounds()); } catch (e) { return screen.getPrimaryDisplay(); }
  };
  const save = () => {
    if (!file) return;
    try { fs.writeFileSync(file, JSON.stringify({ mode: st.mode, displayId: st.displayId, bounds: st.normalBounds })); }
    catch (e) { log('winstate not saved'); }
  };
  const load = () => {
    if (!file) return null;
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { mode: isMode(j.mode) ? j.mode : 'ablak', displayId: Number.isInteger(j.displayId) ? j.displayId : null, bounds: rectOk(j.bounds) ? pickRect(j.bounds) : null };
    } catch (e) { return null; }
  };

  function mode(m) {
    if (!isMode(m)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen ablakmód.' };
    if (st.mode === 'ablak' && m !== 'ablak') st.normalBounds = pickRect(win.getBounds());   // remember before leaving
    const display = displayFor();
    if (display && display.id != null) st.displayId = display.id;
    apply(win, screen, m, display, st);
    st.mode = m;
    if (!st.visible) { win.show(); st.visible = true; }
    save(); onChange(st.mode);
    return { ok: true, mode: st.mode };
  }

  // the hotkey: outside overlay it enters overlay; inside overlay it hides / shows (hiding keeps terminals alive)
  function toggleOverlay() {
    if (st.mode !== 'overlay') { mode('overlay'); win.show(); st.visible = true; return { ok: true, visible: true }; }
    if (st.visible) { win.hide(); st.visible = false; }
    else { win.show(); win.focus(); st.visible = true; }
    return { ok: true, visible: st.visible };
  }

  // restore the saved state at start (a hidden overlay is never restored hidden)
  function restore() {
    const s = load();
    if (!s) return false;
    st.normalBounds = s.bounds; st.displayId = s.displayId;
    if (s.bounds && s.mode === 'ablak') win.setBounds(s.bounds);
    if (s.mode !== 'ablak') mode(s.mode);
    return true;
  }

  return { mode, toggleOverlay, restore, state: () => ({ mode: st.mode, displayId: st.displayId, bounds: st.normalBounds, visible: st.visible }) };
}

module.exports = { MODES, isMode, apply, createWinModes };
