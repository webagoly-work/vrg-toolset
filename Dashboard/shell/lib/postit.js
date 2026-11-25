// postit.js — the Post-it overlay of the VRG Asztal (WP-50, docs/notes/POSTIT.md). Testers pin notes to a point of any screen;
// the developer calls their notes in and sees them on the same screens ("see what they see").
//
//   const postit = createPostit({ BrowserWindow, win, views, settings, dialog, dir, preload, page, ipc, types, log });
//   postit.sync()      the overlay window follows the settings (postit.enabled) and the main window's bounds
//   postit.changed()   the layout moved (a pane, the primary view): the overlay redraws
//
// Why a window of its own: in-shell apps, web tabs and the Kezdőlap are WebContentsViews, native layers above the frame page,
// so nothing drawn in the frame's DOM can sit over them. The overlay is a transparent, frameless child window over the main
// window's content area. It lets the mouse through (setIgnoreMouseEvents with forward) except over its own buttons, notes and
// editor, and while armed, when it takes the next click itself.
//
// Pure helpers (exported for node --test): screenOf(viewId, url), locate(pt, panes, frame), layout(panes, frame), createStore(dir).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const P = require('../../../shared/postit/postit-core.js');

const DEV_LEVELS = ['dev', 'all'];

// ---------------------------------------------------------------- where a point is (POSTIT.md §3.1)
// A view id and its URL → the anchor's screen key; null = a view the overlay does not anchor to.
function screenOf(id, url) {
  if (id === 'home') return { screen: 'd:home' };
  if (id === 'mailview') return { screen: 'd:mail' };
  let u = null;
  try { u = url ? new URL(url) : null; } catch (e) { u = null; }
  const detail = u ? (u.pathname + (u.hash || '')).slice(0, P.LIMITS.detail) : undefined;
  const m = /^app:([a-z0-9][a-z0-9._-]{0,60})$/.exec(String(id));
  if (m) return { screen: 'd:app/' + m[1], detail };
  if (/^w\d+$/.test(String(id))) {
    const host = u && /^https?:$/.test(u.protocol) ? u.hostname.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 100) : '';
    return { screen: host ? 'd:web/' + host : 'd:web', detail: u ? u.pathname.slice(0, P.LIMITS.detail) : undefined };
  }
  return null;
}

const inside = (pt, b) => pt.x >= b.x && pt.y >= b.y && pt.x < b.x + b.w && pt.y < b.y + b.h;

// panes = [{ screen, detail?, box:{x,y,w,h} }] bottom → top (the order views were added = their z-order);
// frame = { screen, box } the frame page itself (Irányítópult or Asztal view), under every pane.
function locate(pt, panes, frame) {
  for (let i = panes.length - 1; i >= 0; i--) if (inside(pt, panes[i].box)) return panes[i];
  return frame;
}

// what the overlay may draw on: every visible pane plus the frame, keyed by screen (a later pane of the same screen wins)
function layout(panes, frame) {
  const out = {};
  out[frame.screen] = frame.box;
  for (const p of panes) out[p.screen] = p.box;
  return out;
}

// ---------------------------------------------------------------- the store (<userDir>/postit/)
//   me.json     { id, created }                 this install's author id (random, never a name or a machine id)
//   mine.json   { notes: [...] }                 the notes made here
//   inbox.json  { authors: { id: { author, notes, importedAt } } }   the testers' notes called in (dev)
function createStore(dir) {
  const f = n => path.join(dir, n);
  const read = (n, def) => { try { const j = JSON.parse(fs.readFileSync(f(n), 'utf8')); return j && typeof j === 'object' ? j : def; } catch (e) { return def; } };
  const write = (n, v) => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = f(n) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(v, null, 1));
    fs.renameSync(tmp, f(n));
  };
  function me() {
    const m = read('me.json', null);
    if (m && typeof m.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(m.id)) return m;
    const n = { id: 'a-' + crypto.randomBytes(6).toString('hex'), created: Date.now() };
    write('me.json', n);
    return n;
  }
  const mine = () => { const j = read('mine.json', {}); return Array.isArray(j.notes) ? j.notes.filter(n => P.check(n).ok) : []; };
  const inbox = () => { const j = read('inbox.json', {}); return j && j.authors && typeof j.authors === 'object' ? j : { authors: {} }; };
  return {
    me, mine, inbox,
    saveMine: notes => write('mine.json', { notes: notes.slice(-P.LIMITS.notes) }),
    saveInbox: ib => write('inbox.json', ib),
  };
}

// ---------------------------------------------------------------- the overlay
function createPostit({ BrowserWindow, win, views, settings, dialog, dir, preload, page, ipc, types, log = () => {}, appName = 'VRG Asztal' }) {
  const store = createStore(dir);
  const S = { armed: false, overlay: null, hit: false, focused: false };
  const get = (k, def) => { try { return settings.get(k); } catch (e) { return def; } };
  const enabled = () => get('postit.enabled', false) === true;
  const devAllowed = () => DEV_LEVELS.includes(get('desk.level', 'user'));

  function contentBox() {
    const b = win.getContentBounds();
    return { x: 0, y: 0, w: b.width, h: b.height };
  }
  function frame() {
    const v = get('desk.view', 'dashboard');
    return { screen: 'd:frame/' + (v === 'desktop' ? 'desktop' : 'dashboard'), box: contentBox() };
  }
  function panes() {
    if (!views || views.isHidden()) return [];
    const out = [];
    for (const id of views.ids()) {
      const r = views.rect(id), v = views.get(id);
      if (!r || r.w <= 0 || r.h <= 0 || !v) continue;
      let url = '';
      try { url = v.webContents && !v.webContents.isDestroyed() ? v.webContents.getURL() : ''; } catch (e) {}
      const s = screenOf(id, url);
      if (s) out.push({ ...s, box: { x: r.x, y: r.y, w: r.w, h: r.h } });
    }
    return out;
  }

  // ---- the window
  function ignore(on) {
    const o = S.overlay;
    if (!o || o.isDestroyed()) return;
    if (on) o.setIgnoreMouseEvents(true, { forward: true }); else o.setIgnoreMouseEvents(false);
  }
  function capture() { ignore(!(S.armed || S.hit || S.focused)); }
  function place() {
    const o = S.overlay;
    if (!o || o.isDestroyed() || win.isDestroyed()) return;
    o.setBounds(win.getContentBounds());
    if (win.isMinimized() || !win.isVisible()) { if (o.isVisible()) o.hide(); }
    else if (!o.isVisible()) o.showInactive();
  }
  function open() {
    if (S.overlay && !S.overlay.isDestroyed()) return S.overlay;
    const o = new BrowserWindow({
      parent: win, frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, minimizable: false,
      maximizable: false, fullscreenable: false, skipTaskbar: true, show: false, focusable: true, backgroundColor: '#00000000',
      title: 'VRG Post-it',
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const url = require('url').pathToFileURL(page).href;
    o.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    o.webContents.on('will-navigate', (e, u) => { if (u.split('#')[0] !== url) e.preventDefault(); });
    o.on('closed', () => { if (S.overlay === o) S.overlay = null; });
    o.loadFile(page);
    o.once('ready-to-show', () => { place(); capture(); });
    S.overlay = o;
    return o;
  }
  function close() {
    S.armed = false; S.hit = false; S.focused = false;
    const o = S.overlay; S.overlay = null;
    if (o && !o.isDestroyed()) o.destroy();
  }
  function sync() {
    if (!win || win.isDestroyed()) return;
    if (enabled()) { open(); place(); capture(); changed(); } else close();
  }
  let pending = null;
  function changed() {
    if (pending) return;
    pending = setTimeout(() => { pending = null; if (S.overlay && !S.overlay.isDestroyed()) ipc.emit(S.overlay, 'postit', 'changed', {}); }, 60);
  }
  for (const ev of ['move', 'resize', 'maximize', 'unmaximize', 'restore', 'minimize', 'show', 'hide', 'enter-full-screen', 'leave-full-screen'])
    win.on(ev, () => { place(); changed(); });

  // ---- what the overlay draws
  function state() {
    const fr = frame(), ps = panes();
    const inbox = store.inbox();
    const hidden = get('postit.devHidden', []);
    const dev = devAllowed() && get('postit.dev', false) === true;
    return {
      enabled: enabled(), show: get('postit.show', true) === true, armed: S.armed, devAllowed: devAllowed(), dev,
      name: get('postit.name', ''), me: store.me().id,
      boxes: layout(ps, fr),
      mine: store.mine(),
      theirs: dev ? P.inboxNotes(inbox, hidden) : [],
      authors: Object.values(inbox.authors).map(e => ({ ...e.author, count: (e.notes || []).length, hidden: hidden.includes(e.author.id) })),
    };
  }

  const author = () => ({ id: store.me().id, name: get('postit.name', '') || 'névtelen', platform: 'desktop', app: appName });

  async function exportMine() {
    const notes = store.mine();
    if (!notes.length) return { ok: false, err: 'empty', hu: 'Még nincs Post-it jegyzet.' };
    const stamp = new Date().toISOString().slice(0, 10);
    const r = await dialog.showSaveDialog(win, { title: 'Post-it jegyzetek exportálása', defaultPath: 'postit-' + stamp + '.vrgpostit.json',
      filters: [{ name: 'VRG Post-it', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return { ok: false, err: 'cancelled' };
    fs.writeFileSync(r.filePath, JSON.stringify(P.bundle(author(), notes), null, 1));
    return { ok: true, count: notes.length, file: path.basename(r.filePath) };
  }

  async function importBundles() {
    const r = await dialog.showOpenDialog(win, { title: 'Tesztelői Post-it jegyzetek behívása', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'VRG Post-it', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { ok: false, err: 'cancelled' };
    let inbox = store.inbox(), added = 0, updated = 0;
    const bad = [];
    for (const f of r.filePaths.slice(0, 50)) {
      let text = '';
      try { if (fs.statSync(f).size > 2e6) throw new Error('size'); text = fs.readFileSync(f, 'utf8'); } catch (e) { bad.push(path.basename(f)); continue; }
      const p = P.parse(text);
      if (!p.ok) { bad.push(path.basename(f) + ' (' + p.err + ')'); continue; }
      const m = P.mergeInbox(inbox, p.bundle);
      inbox = m.inbox; added += m.added; updated += m.updated;
    }
    store.saveInbox(inbox);
    if (devAllowed() && added) { try { settings.set('postit.dev', true); } catch (e) {} }
    changed();
    return { ok: bad.length < r.filePaths.length, added, updated, bad };
  }

  // ---- IPC (ns postit); the overlay page and the frame page may call (the frame for the settings sheet's buttons)
  const coord = types.int(-20000, 20000);
  ipc.register('postit', 'state', {}, async () => state());
  ipc.register('postit', 'arm', { on: types.bool }, async ({ on }) => { S.armed = on && enabled(); capture(); changed(); return { armed: S.armed }; });
  ipc.register('postit', 'show', { on: types.bool }, async ({ on }) => { settings.set('postit.show', on); changed(); return {}; });
  ipc.register('postit', 'dev', { on: types.bool }, async ({ on }) => {
    if (on && !devAllowed()) return { ok: false, err: 'forbidden', hu: 'A fejlesztői réteg Dev szinten érhető el.' };
    settings.set('postit.dev', on); changed(); return {};
  });
  ipc.register('postit', 'hit', { on: types.bool }, async ({ on }) => { S.hit = on; capture(); return {}; });
  ipc.register('postit', 'focus', { on: types.bool }, async ({ on }) => {
    S.focused = on; capture();
    const o = S.overlay;
    if (on && o && !o.isDestroyed()) o.focus(); else if (!on && !win.isDestroyed()) win.focus();
    return {};
  });
  // the armed click: where it landed, as an anchor; disarms (one note per arming)
  ipc.register('postit', 'place', { x: coord, y: coord }, async ({ x, y }) => {
    const hit = locate({ x, y }, panes(), frame());
    S.armed = false; capture();
    const a = P.fromPx(x, y, hit.box);
    return { anchor: { screen: hit.screen, ...(hit.detail ? { detail: hit.detail } : {}), ...a } };
  });
  ipc.register('postit', 'save', { id: types.text(40), text: types.text(P.LIMITS.text), anchor: types.json(1024), state: types.enum(...P.STATES) }, async (p) => {
    const notes = store.mine();
    if (p.id) {
      const i = notes.findIndex(n => n.id === p.id);
      if (i < 0) return { ok: false, err: 'not-found', hu: 'Nincs ilyen jegyzet.' };
      const n = { ...notes[i], text: p.text != null ? p.text : notes[i].text, state: p.state || notes[i].state, edited: Date.now() };
      if (!P.check(n).ok) return { ok: false, err: 'bad-request', hu: 'Üres jegyzet nem menthető.' };
      notes[i] = n; store.saveMine(notes); changed();
      return { note: n };
    }
    const n = P.make({ text: p.text, anchor: p.anchor });
    const c = P.check(n);
    if (!c.ok) return { ok: false, err: 'bad-request', hu: c.err === 'text' ? 'Üres jegyzet nem menthető.' : 'Érvénytelen hely.' };
    notes.push(n); store.saveMine(notes); changed();
    return { note: n };
  }, { optional: ['id', 'text', 'anchor', 'state'] });
  ipc.register('postit', 'remove', { id: types.text(40) }, async ({ id }) => {
    const notes = store.mine(), left = notes.filter(n => n.id !== id);
    if (left.length === notes.length) return { ok: false, err: 'not-found', hu: 'Nincs ilyen jegyzet.' };
    store.saveMine(left); changed(); return {};
  });
  // the developer marks a tester's note done in the inbox (the tester's own copy is theirs)
  ipc.register('postit', 'settle', { author: types.text(40), id: types.text(40), state: types.enum(...P.STATES) }, async (p) => {
    const ib = store.inbox(), e = ib.authors[p.author];
    const n = e && (e.notes || []).find(x => x.id === p.id);
    if (!n) return { ok: false, err: 'not-found', hu: 'Nincs ilyen jegyzet.' };
    n.state = p.state; store.saveInbox(ib); changed(); return {};
  });
  ipc.register('postit', 'devHide', { id: types.text(40), hide: types.bool }, async ({ id, hide }) => {
    const h = new Set(get('postit.devHidden', []));
    if (hide) h.add(id); else h.delete(id);
    settings.set('postit.devHidden', [...h].slice(0, 200)); changed(); return {};
  });
  ipc.register('postit', 'export', {}, async () => exportMine());
  ipc.register('postit', 'import', {}, async () => importBundles());
  ipc.register('postit', 'clearMine', {}, async () => { store.saveMine([]); changed(); return {}; });

  const overlayUrl = () => require('url').pathToFileURL(page).href;
  return { sync, changed, close, state, overlayUrl, store, isOpen: () => !!(S.overlay && !S.overlay.isDestroyed()) };
}

module.exports = { createPostit, createStore, screenOf, locate, layout, DEV_LEVELS };
