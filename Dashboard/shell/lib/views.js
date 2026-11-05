// views.js — the view host: WebContentsViews that main places at the rect the frame page reports (WP-07).
//   const views = createViews({ WebContentsView, win, preload, homePage, log });
//   views.createLocal('home')                     the D0–D4 page with the existing preload (the Kezdőlap)
//   views.createWeb({ partition, id? })           isolated web content (WP-17) → { id, view } | null
//   views.setBounds(id, {x,y,w,h}) · hideAll() · showAll() · destroy(id) · has(id) · ids() · get(id)
// Electron objects are passed in, so node --test can load this file with fakes.
'use strict';

const MAX = 20000;
const clampInt = v => Math.max(0, Math.min(MAX, Math.round(v)));
const validRect = r => !!r && typeof r === 'object' && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k]));

function createViews({ WebContentsView, win, preload, homePage, log = () => {} }) {
  const map = new Map();                                    // id → { view, rect, wanted }
  let hidden = false, webSeq = 0;

  const alive = e => e && !win.isDestroyed() && !(e.view.webContents && e.view.webContents.isDestroyed());
  function apply(e) {
    if (!alive(e)) return;
    const show = e.wanted && !hidden && e.rect.w > 0 && e.rect.h > 0;
    if (show) e.view.setBounds({ x: e.rect.x, y: e.rect.y, width: e.rect.w, height: e.rect.h });
    e.view.setVisible(!!show);
  }

  function createLocal(id) {
    if (id !== 'home') return null;
    if (map.has(id)) return map.get(id).view;
    const view = new WebContentsView({
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const e = { view, rect: { x: 0, y: 0, w: 0, h: 0 }, wanted: false };
    map.set(id, e);
    win.contentView.addChildView(view);
    view.setVisible(false);                                 // hidden until the frame reports a rect
    const wc = view.webContents;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));    // links go through act ids
    const url = require('url').pathToFileURL(homePage).href;
    wc.on('will-navigate', (ev, u) => { if (u.split('#')[0] !== url) ev.preventDefault(); });
    wc.loadFile(homePage);
    log('view created', id);
    return view;
  }

  // Isolated web content (WP-17): webPrefs() only, no preload. Returns { id, view } (hidden until bounds arrive); lib/web.js wires the guards.
  function createWeb({ partition = 'persist:vrg-web', id } = {}) {
    if (id !== undefined && (typeof id !== 'string' || map.has(id))) return null;
    while (!id || map.has(id)) id = 'w' + (++webSeq);
    const view = new WebContentsView({ webPreferences: webPrefs(partition) });
    map.set(id, { view, rect: { x: 0, y: 0, w: 0, h: 0 }, wanted: false });
    win.contentView.addChildView(view);
    view.setVisible(false);
    log('view created', id);
    return { id, view };
  }

  function setBounds(id, rect) {
    const e = map.get(id);
    if (!e || !validRect(rect)) return false;
    e.rect = { x: clampInt(rect.x), y: clampInt(rect.y), w: clampInt(rect.w), h: clampInt(rect.h) };
    e.wanted = e.rect.w > 0 && e.rect.h > 0;
    apply(e);
    return true;
  }
  function hideAll() { hidden = true; for (const e of map.values()) apply(e); }
  function showAll() { hidden = false; for (const e of map.values()) apply(e); }
  function destroy(id) {
    const e = map.get(id);
    if (!e) return false;
    map.delete(id);
    try {
      if (!win.isDestroyed()) win.contentView.removeChildView(e.view);
      if (!e.view.webContents.isDestroyed()) e.view.webContents.close();
    } catch (err) { log('view destroy failed', id); }
    return true;
  }
  function destroyAll() { for (const id of [...map.keys()]) destroy(id); }

  return {
    createLocal, createWeb, setBounds, hideAll, showAll, destroy, destroyAll,
    has: id => map.has(id), ids: () => [...map.keys()], get: id => (map.has(id) ? map.get(id).view : null),
    rect: id => (map.has(id) ? { ...map.get(id).rect } : null), isHidden: () => hidden,
  };
}

// webPreferences for web content (WP-17 and later). Never a preload: a web page gets no window.vrg and no ipcRenderer.
// `extra` may only add keys that keep it isolated; preload / nodeIntegration / contextIsolation / sandbox / webviewTag are fixed.
const FIXED = ['preload', 'nodeIntegration', 'nodeIntegrationInSubFrames', 'nodeIntegrationInWorker', 'contextIsolation', 'sandbox', 'webviewTag'];
function webPrefs(partition = 'persist:vrg-web', extra = {}) {
  const out = { ...extra };
  for (const k of FIXED) delete out[k];
  return { ...out, partition, sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false, webviewTag: false, spellcheck: false };
}

module.exports = { createViews, webPrefs };
