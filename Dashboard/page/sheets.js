// sheets.js — the Lapok (Sheets) layer of the VRG Asztal's workspace (WP-46). A Lap is a 4 × 4 grid over the Desktop area holding the
// windows the user works with; any pane (files, terminal, browser, mail, chat, git, an in-shell app, a server page …) can be a window.
// The grid logic is shell/lib/sheets.js (window.VRGSheetsLib); the panes are mounted by frame.js (VRGFrame.host), so a window is the
// same pane the split Munkapad has, and moving or resizing it never remounts it (a terminal keeps its session).
//   open window = all 16 cells (max) · double-click the header of a full window = back to one cell · double-click a small window's
//   header = full · drag an edge or a corner = resize, snapped to cells, stopping at the neighbours · drag the header = move (onto a
//   window of the same size = swap) · right-click an empty cell (or click its ＋) = the picker: a Kommand search bar over everything
//   that opens as a window · the sheet tabs sit in the top strip or the dock (doc.bar) · Munkapad = the old split tree.
//   window.VRGSheets = { on(), ready, openKind(kind, state), findKind(kind), focus(id), close(id), closeSheet(sid), stateOf(id), focused(), showTree(),
//                        activate(sid), sync(shown), barInto(el, where), pick(cell), doc(), presets(), newSheet(preset), state() }
(function () {
  'use strict';
  const lib = window.VRGSheetsLib;
  const vrg = window.vrg;
  const N = lib.N;
  const $ = s => document.querySelector(s);
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  // the pane kinds a window can be, as the picker lists them (the vrg namespace a build must have, null = always)
  const KINDS = [
    ['files', 'Fájlok', 'Files', 'fs', 'FÁ'], ['term', 'Terminál', 'Terminal', 'term', '>_'], ['web', 'Böngésző', 'Browser', 'web', 'WW'],
    ['mail', 'Posta', 'Mail', 'mail', '@'], ['chat', 'Claude chat', 'Chat', 'chat', 'CL'], ['git', 'Git', 'Git', 'git', 'GI'],
    ['feed', 'Hírfolyam', 'Feeds', 'feed', 'HÍ'], ['stack', 'Kontextuscsomag', 'Context pack', null, 'KC'], ['home', 'Kezdőlap', 'Home', null, 'KE'],
  ];
  const LABEL = { home: 'Kezdőlap', empty: 'Üres', files: 'Fájlok', term: 'Terminál', web: 'Böngésző', mail: 'Posta', stack: 'Kontextuscsomag',
    chat: 'Claude chat', note: 'Jegyzet', git: 'Git', feed: 'Hírfolyam', app: 'Alkalmazás' };
  const URLISH = /^(https?:\/\/\S+|www\.\S+|[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;

  const S = {
    doc: lib.empty(), presets: [], catalog: [], groups: {}, features: null, shown: false, loaded: false,
    els: new Map(),                                                       // win id → { el, head, title, body, kind }
    pendingCell: null, pendingOpen: '', drag: null, popup: null, saveTimer: 0, saving: Promise.resolve(),
  };
  const F = () => window.VRGFrame || null;
  const active = () => lib.sheetOf(S.doc, S.doc.active);
  const level = () => (window.VRGDesk ? window.VRGDesk.level() : 'user');
  const toast = (ok, hu, en) => { if (window.VRGToasts) window.VRGToasts.toast({ ok, hu, en: en || hu }); };
  const cover = on => { try { vrg && vrg.call('desktop', 'cover', { on: !!on }); } catch (e) {} };
  const log = (lv, msg) => { try { vrg && vrg.call('app', 'log', { level: lv, msg: String(msg).slice(0, 500) }); } catch (e) {} };

  // ------------------------------------------------------------ the DOM: one layer in the workspace, beside the split tree
  const ws = $('[data-role="workspace"]');
  const treeRoot = $('#root');
  const layer = h('div', { 'data-role': 'sh-layer', hidden: true, 'aria-label': 'Lap' });
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const cell = h('div', { 'data-role': 'sh-cell', 'data-c': c, 'data-r': r, style: `grid-area:${r + 1} / ${c + 1}` },
      h('button', { type: 'button', class: 'plus', tabindex: '-1', title: 'Megnyitás ide… (jobb klikk is) / Open here', onclick: e => { e.stopPropagation(); pick({ c, r }); } }, '＋'));
    cell.addEventListener('contextmenu', e => { e.preventDefault(); pick({ c, r }); });
    cells.push(cell);
    layer.append(cell);
  }
  const ghost = h('div', { 'data-role': 'sh-ghost', hidden: true });
  layer.append(ghost);
  if (ws) ws.append(layer);
  new ResizeObserver(() => F() && F().bounds()).observe(layer);

  // ------------------------------------------------------------ the doc: every change goes through commit()
  // save 'now' for structure (a window opened / closed / moved: main keeps app views alive by what is saved), 'later' for pane state
  function commit(next, how) {
    if (!next || next === S.doc) return false;
    S.doc = next;
    render();
    if (how === 'later') { clearTimeout(S.saveTimer); S.saveTimer = setTimeout(save, 600); } else save();
    return true;
  }
  function snapshot() {
    let d = S.doc;
    const host = F() && F().host;
    if (!host) return d;
    for (const w of lib.wins(d)) {
      const inst = host.inst(w.id);
      if (!inst || typeof inst.state !== 'function') continue;
      try { const s = inst.state(); if (s && typeof s === 'object') d = lib.setState(d, w.id, s); } catch (e) {}
    }
    return d;
  }
  function save() {
    clearTimeout(S.saveTimer); S.saveTimer = 0;
    if (!vrg || !vrg.sheets || !S.loaded) return S.saving;
    S.doc = snapshot();
    const doc = S.doc;
    S.saving = S.saving.then(() => vrg.sheets.set(doc)).then(r => { if (r && r.ok === false) log('warn', 'sheets.set: ' + (r.err || '') + ' ' + (r.hu || '')); }).catch(() => {});
    return S.saving;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.saveTimer) save(); });

  // ------------------------------------------------------------ windows
  function titleOf(w) {
    if (w.kind === 'app') return (w.state && (w.state.title || w.state.id)) || LABEL.app;
    if (w.open && w.open.startsWith('cat:')) { const it = S.catalog.find(i => i.id === w.open.slice(4)); if (it && w.kind !== 'web') return it.hu; if (it) return it.hu; }
    return LABEL[w.kind] || w.kind;
  }
  // the api a pane gets in a window (frame.js gives tree panes the same shape)
  function paneApi(id) {
    return {
      id, vrg,
      replace: kind => commit(lib.setKind(S.doc, id, kind, 'pane:' + kind)),
      setState: s => commit(lib.setState(S.doc, id, s), 'later'),
      has: kind => anyOfKind(kind),
      open: (kind, state) => (F() ? F().open(kind, state) : ''),
    };
  }
  function anyOfKind(kind) { const f = F(); return !!f && f.panes().some(p => f.kindOf(p) === kind); }

  function makeWin(w) {
    const title = h('b', {}, titleOf(w));
    const btnMax = h('button', { type: 'button', 'data-act': 'max', title: 'Teljes / Full (dupla kattintás a fejlécen)' }, '▢');
    const head = h('div', { 'data-role': 'sh-head' },
      h('span', { class: 'tab' }, h('i', { class: 'ic' }, (KINDS.find(k => k[0] === w.kind) || [])[4] || (w.kind === 'app' ? '◧' : '·')), title),
      h('span', { class: 'sp' }),
      btnMax,
      h('button', { type: 'button', 'data-act': 'min', title: 'Kicsi: egy cella / Small: one cell' }, '▁'),
      h('button', { type: 'button', 'data-act': 'close', title: 'Bezárás / Close' }, '✕'));
    const body = h('div', { 'data-role': 'sh-body' });
    const el = h('div', { 'data-role': 'sh-win', 'data-win': w.id, 'data-kind': w.kind, tabindex: '-1' }, head, body,
      lib.EDGES.map(e => h('i', { 'data-edge': e })));
    // header: buttons, double-click, right-click menu, drag to move
    head.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      e.stopPropagation();
      const a = b.dataset.act, cur = lib.findWin(S.doc, w.id);
      if (!cur) return;
      if (a === 'close') close(w.id);
      else if (a === 'min') commit(lib.minimize(S.doc, w.id));
      else if (a === 'max') commit(cur.win.max ? lib.restore(S.doc, w.id) : lib.maximize(S.doc, w.id));
    });
    head.addEventListener('dblclick', e => { if (e.target.closest('button')) return; e.preventDefault(); commit(lib.toggleMax(S.doc, w.id)); });
    head.addEventListener('contextmenu', e => { e.preventDefault(); winMenu(w.id, e.clientX, e.clientY); });
    head.addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('button')) startDrag(e, w.id, 'move'); });
    for (const hd of el.querySelectorAll('[data-edge]')) hd.addEventListener('pointerdown', e => { if (e.button === 0) startDrag(e, w.id, 'resize', hd.dataset.edge); });
    el.addEventListener('pointerdown', () => { if (S.doc.active && active() && active().focus !== w.id) commit(lib.focusWin(S.doc, w.id), 'later'); }, true);
    el.addEventListener('focusin', () => { if (active() && active().focus !== w.id) commit(lib.focusWin(S.doc, w.id), 'later'); });
    const rec = { el, head, title, body, btnMax, kind: '' };
    S.els.set(w.id, rec);
    layer.append(el);
    mountPane(w, rec);
    return rec;
  }
  function mountPane(w, rec) {
    const f = F();
    if (!f || !f.host) return;
    if (rec.kind && rec.kind !== w.kind) { f.host.drop(w.id); rec.body.textContent = ''; }
    if (rec.kind === w.kind && rec.body.firstChild) return;
    rec.kind = w.kind;
    rec.el.dataset.kind = w.kind;
    rec.body.append(f.host.body({ id: w.id, kind: w.kind, state: w.state }, paneApi));
  }

  // ------------------------------------------------------------ render: the active Lap's windows placed; the rest hidden, still mounted
  function render() {
    const s = active();
    const live = new Set(lib.wins(S.doc).map(w => w.id));
    for (const [id, rec] of [...S.els]) if (!live.has(id)) { const f = F(); if (f && f.host) f.host.drop(id); rec.el.remove(); S.els.delete(id); }
    const shown = s ? new Map(lib.view(s).map(v => [v.id, v])) : new Map();
    for (const sh of S.doc.sheets) for (const w of sh.wins) {
      const rec = S.els.get(w.id) || makeWin(w);
      if (rec.kind !== w.kind) mountPane(w, rec);
      const v = shown.get(w.id);
      rec.el.hidden = !v || v.covered;
      if (!v) continue;
      const R = v.rect;
      rec.el.style.gridArea = `${R.r + 1} / ${R.c + 1} / span ${R.h} / span ${R.w}`;
      rec.el.dataset.max = w.max ? '1' : '';
      rec.el.dataset.size = w.max ? 'full' : w.w + 'x' + w.h;
      rec.el.dataset.focus = s.focus === w.id ? '1' : '';
      rec.title.textContent = titleOf(w);
      rec.btnMax.textContent = w.max ? '⧉' : '▢';
      rec.btnMax.title = w.max ? 'Vissza a helyére / Restore' : 'Teljes / Full';
    }
    // the free cells show their ＋; a full window hides the grid under it
    const occ = s ? lib.occupancy(s) : new Array(N * N).fill('');
    const hasMax = !!(s && s.wins.some(w => w.max));
    cells.forEach((cell, i) => { cell.dataset.free = occ[i] ? '' : '1'; cell.hidden = hasMax; });
    layer.dataset.empty = s && s.wins.length ? '' : '1';
    sync(S.shown);
    drawBars();
    if (F()) F().bounds();
  }

  // the workspace shows the active Lap when windows are shown and a Lap is active; the split tree when the Munkapad is
  function sync(shown) {
    S.shown = !!shown;
    const onSheet = S.shown && !!S.doc.active;
    layer.hidden = !onSheet;
    if (treeRoot) treeRoot.hidden = !(S.shown && !S.doc.active);
    document.body.dataset.sheet = onSheet ? S.doc.active : '';
    if (F()) F().bounds();
  }
  function showDesktop() {
    const D = window.VRGDesk;
    if (D) { if (D.view() !== 'desktop') D.setView('desktop'); D.showWindows(true); } else sync(true);
  }

  // ------------------------------------------------------------ what the frame asks (window.VRGSheets)
  function openKind(kind, state, o) {
    const s = active();
    if (!s || !lib.KINDS.includes(kind)) return '';
    const f = F();
    if (kind === 'home') {                                               // one Kezdőlap: focus it where it is (on a Lap, or '' = the tree)
      const hit = lib.wins(S.doc).find(w => w.kind === 'home');
      if (hit) { focus(hit.id); return hit.id; }
      if (anyOfKind('home')) { showTree(); if (f) f.openKindInTree('home'); showDesktop(); return 'home'; }   // it is on the Munkapad
    }
    const id = lib.newPaneId(S.doc, kind, f ? f.panes() : []);
    const open = (o && o.open) || S.pendingOpen || 'pane:' + kind;
    const cell = (o && o.cell) || S.pendingCell;
    S.pendingCell = null; S.pendingOpen = '';
    const st = state && typeof state === 'object' && !Array.isArray(state) ? JSON.parse(JSON.stringify(state)) : {};
    if (!commit(lib.openWin(S.doc, s.id, { id, kind, open, state: st }, cell, o && o.max === false ? { max: false } : null))) {
      toast(false, 'A lap megtelt: ' + s.name, 'The sheet is full.');
      return '';
    }
    showDesktop();
    focusDom(id);
    return id;
  }
  function findKind(kind) { const s = active(); const w = s && s.wins.find(x => x.kind === kind); return w ? w.id : ''; }
  function focus(id) {
    const hit = lib.findWin(S.doc, id);
    if (!hit) return false;
    let d = lib.activate(S.doc, hit.sheet.id);
    d = lib.focusWin(d, id);
    if (hit.win.w === 1 && hit.win.h === 1 && !hit.win.max && hit.sheet.wins.some(w => w.max)) d = lib.maximize(d, id);   // a small one under a full one comes up
    commit(d, 'later');
    showDesktop();
    focusDom(id);
    return true;
  }
  // a preset's focus holds for up to 12 s: windows that are still starting (a terminal focuses itself when its shell is up) do not
  // take the keyboard from it. A click anywhere, or a key outside the held window, ends the hold: then it is the user's choice.
  // focusin is the fast path; the timer covers a window without the OS focus, where focus() moves activeElement without an event.
  let hold = null;
  const holdFocus = id => {
    hold = { id, until: Date.now() + 12000 };                          // long enough for cold-started shells; any user input ends it
    const t = setInterval(() => {
      const hit = lib.findWin(S.doc, id);
      if (!hold || hold.id !== id || Date.now() > hold.until || !hit || hit.sheet.id !== S.doc.active) { clearInterval(t); if (hold && hold.id === id) hold = null; return; }
      const a = document.activeElement;
      if ((a && a.closest && a.closest('[data-role="sh-win"]') && !inHeld(a)) || (active() && active().focus !== id)) reclaim(id);
    }, 120);
  };
  // the keyboard AND the sheet's focus record back to the held window (the record follows focusin, which a window without the OS
  // focus does not get)
  function reclaim(id) {
    if (active() && active().focus !== id) commit(lib.focusWin(S.doc, id), 'later');
    focusDom(id);
  }
  const inHeld = t => !!(hold && t && t.closest && t.closest('[data-role="sh-win"][data-win="' + hold.id + '"]'));
  document.addEventListener('focusin', e => {
    if (!hold) return;
    if (Date.now() > hold.until || !lib.findWin(S.doc, hold.id)) { hold = null; return; }
    const w = e.target && e.target.closest && e.target.closest('[data-role="sh-win"]');
    if (w && !inHeld(e.target)) reclaim(hold.id);
  }, true);
  document.addEventListener('pointerdown', e => { if (e.isTrusted) hold = null; }, true);
  document.addEventListener('keydown', e => { if (e.isTrusted && !inHeld(e.target)) hold = null; }, true);
  function focusDom(id) {
    setTimeout(() => {
      const rec = S.els.get(id), inst = F() && F().host.inst(id);
      try { if (inst && typeof inst.focusInput === 'function') inst.focusInput(); else if (inst && typeof inst.focus === 'function') inst.focus(); else if (rec) rec.el.focus({ preventScroll: true }); } catch (e) {}
    }, 30);
  }
  function close(id) { return commit(lib.closeWin(S.doc, id)); }
  function stateOf(id) { const hit = lib.findWin(S.doc, id); return hit ? hit.win.state : null; }
  function activate(sid) {
    commit(lib.activate(S.doc, sid), 'later');
    showDesktop();
  }
  function showTree() { if (S.doc.active) commit(lib.activate(S.doc, ''), 'later'); }

  // ------------------------------------------------------------ dragging: resize by an edge / corner, move by the header
  function cellAt(x, y) {
    const r = layer.getBoundingClientRect(), cs = getComputedStyle(layer);
    const pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0, pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const cw = (r.width - pl - pr) / N, ch = (r.height - pt - pb) / N;
    return { c: Math.max(0, Math.min(N - 1, Math.floor((x - r.left - pl) / cw))), r: Math.max(0, Math.min(N - 1, Math.floor((y - r.top - pt) / ch))) };
  }
  function showGhost(t, ok) {
    if (!t) { ghost.hidden = true; return; }
    ghost.hidden = false;
    ghost.style.gridArea = `${t.r + 1} / ${t.c + 1} / span ${t.h} / span ${t.w}`;
    ghost.dataset.ok = ok ? '1' : '0';
  }
  function startDrag(e, id, mode, edge) {
    const hit = lib.findWin(S.doc, id);
    if (!hit || hit.win.max) return;                                     // a full window does not move or resize
    e.preventDefault();
    const tgt = e.currentTarget;
    try { tgt.setPointerCapture(e.pointerId); } catch (err) {}
    const start = { x: e.clientX, y: e.clientY };
    const grab = cellAt(e.clientX, e.clientY);
    const d = S.drag = { id, mode, edge, live: mode === 'resize', grab: { c: grab.c - hit.win.c, r: grab.r - hit.win.r }, tile: null, cell: null };
    const target = cell => {
      const s = active();
      if (!s) return null;
      if (mode === 'resize') return { tile: lib.resizeTarget(s, id, edge, cell), ok: true };
      const m = lib.moveTarget(s, id, { c: cell.c - d.grab.c, r: cell.r - d.grab.r });
      const w = s.wins.find(x => x.id === id);
      return m ? { tile: m.tile, ok: true } : { tile: { c: Math.max(0, Math.min(N - w.w, cell.c - d.grab.c)), r: Math.max(0, Math.min(N - w.h, cell.r - d.grab.r)), w: w.w, h: w.h }, ok: false };
    };
    const onMove = ev => {
      if (!d.live) { if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 6) return; d.live = true; }
      if (!document.body.dataset.shDrag) { document.body.dataset.shDrag = mode; cover(true); }
      d.cell = cellAt(ev.clientX, ev.clientY);
      const t = target(d.cell);
      showGhost(t && t.tile, t && t.ok);
    };
    // move / up are watched on the document: a lost pointer capture (a native view, a window edge) never strands the drag
    const onUp = ev => {
      if (ev && ev.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      if (ev && ev.type === 'pointercancel') d.cell = null;             // cancelled: nothing changes
      const was = document.body.dataset.shDrag;
      delete document.body.dataset.shDrag;
      showGhost(null);
      S.drag = null;
      if (was) cover(false);
      if (!d.live || !d.cell) return;
      if (mode === 'resize') commit(lib.resize(S.doc, id, edge, d.cell));
      else commit(lib.move(S.doc, id, { c: d.cell.c - d.grab.c, r: d.cell.r - d.grab.r }));
    };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
  }

  // ------------------------------------------------------------ popups: menus and the picker (native views are hidden meanwhile)
  function closePopup() {
    if (!S.popup) return;
    const p = S.popup; S.popup = null;
    p.el.remove();
    document.removeEventListener('pointerdown', p.outside, true);
    cover(false);
  }
  function popup(el, x, y) {
    closePopup();
    cover(true);
    el.style.left = '0px'; el.style.top = '0px';
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    const outside = e => { if (!el.contains(e.target)) closePopup(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePopup(); } });
    S.popup = { el, outside };
    return el;
  }
  // items: { hu, en?, run?, off?, sub?: items, sep?, keep? }
  function menu(items, x, y) {
    const box = h('div', { 'data-role': 'sh-menu', role: 'menu', tabindex: '-1' });
    const draw = (list, back) => {
      box.textContent = '';
      if (back) box.append(h('button', { type: 'button', class: 'back', onclick: () => draw(back) }, '‹ vissza'));
      for (const it of list) {
        if (it.sep) { box.append(h('hr')); continue; }
        box.append(h('button', { type: 'button', role: 'menuitem', disabled: !!it.off, title: it.en || '', 'data-item': it.id || null,
          onclick: async () => { if (it.sub) { draw(it.sub, list); return; } if (!it.keep) closePopup(); if (it.run) await it.run(); } }, it.hu, it.sub ? h('span', { class: 'k' }, '›') : it.k ? h('span', { class: 'k' }, it.k) : null));
      }
    };
    draw(items);
    popup(box, x, y);
    box.focus();
    return box;
  }
  function winMenu(id, x, y) {
    const hit = lib.findWin(S.doc, id); if (!hit) return;
    const others = S.doc.sheets.filter(s => s.id !== hit.sheet.id);
    menu([
      { hu: hit.win.max ? 'Vissza a helyére' : 'Teljes képernyő', en: hit.win.max ? 'Restore' : 'Full', k: hit.win.max ? '' : '2× klikk', run: () => commit(hit.win.max ? lib.restore(S.doc, id) : lib.maximize(S.doc, id)) },
      { hu: 'Kicsi (1 cella)', en: 'Small, one cell', k: hit.win.max ? '2× klikk' : '', run: () => commit(lib.minimize(S.doc, id)) },
      { hu: 'Áthelyezés lapra', en: 'Move to sheet', off: !others.length, sub: others.map(s => ({ hu: s.name, run: () => commit(lib.moveToSheet(S.doc, id, s.id)) })) },
      { sep: true },
      { hu: 'Bezárás', en: 'Close', k: 'Ctrl+W', run: () => close(id) },
    ], x, y);
  }

  // ------------------------------------------------------------ the picker: a Kommand bar over everything that opens as a window
  async function loadCatalog() {
    if (!vrg || !vrg.desktop) return;
    try { const r = await vrg.desktop.catalog('all'); if (r && r.ok !== false) { S.catalog = r.items || []; S.groups = r.groups || {}; } } catch (e) {}
    if (!S.features) { try { const i = await vrg.app.info(); S.features = (i && i.features) || []; } catch (e) { S.features = []; } }
  }
  const RANK = { user: 0, dev: 1, all: 2 };
  function choices(q) {
    const lv = RANK[level()] === undefined ? 0 : RANK[level()];
    const out = [];
    const t = q.trim();
    if (t && URLISH.test(t)) out.push({ id: 'url', hu: 'Megnyitás a böngészőben: ' + t, en: 'Open in the browser', grp: 'Parancs', ic: 'WW', go: () => openUrlAt(t) });
    for (const k of KINDS) {
      if (k[3] && S.features && !S.features.includes(k[3])) continue;
      out.push({ id: 'pane:' + k[0], hu: k[1], en: k[2], grp: 'Ablakok', ic: k[4], go: () => openKind(k[0], k[0] === 'term' ? { prof: 'pwsh' } : {}, { open: 'pane:' + k[0] }) });
    }
    if (S.features && S.features.includes('term')) for (const p of ['cmd', 'bash', 'node', 'claude-a', 'claude-b'])
      out.push({ id: 'term:' + p, hu: 'Terminál · ' + p, en: 'Terminal ' + p, grp: 'Ablakok', ic: '>_', go: () => openKind('term', { prof: p }, { open: 'pane:term' }) });
    for (const it of S.catalog) {
      if (!it.opens || RANK[it.level] > lv || it.type === 'category') continue;
      const grp = (S.groups[it.group] || {}).hu || it.group || 'Egyéb';
      out.push({ id: 'cat:' + it.id, hu: it.hu, en: it.en, grp: it.win ? grp : 'Indítás külön (nem ablak)', ic: it.icon || it.hu.slice(0, 2).toUpperCase(), ext: !it.win, go: () => openCat(it) });
    }
    if (!t) return out;
    const P = window.VRGPaletteLib;
    const hits = P ? P.search(out.map(o => ({ ...o, hu: o.hu + ' ' + o.grp, en: o.en || '' })), t).map(x => out.find(o => o.id === x.id)).filter(Boolean)
      : out.filter(o => (o.hu + ' ' + o.en + ' ' + o.grp).toLowerCase().includes(t.toLowerCase()));
    if (out[0] && out[0].id === 'url' && !hits.includes(out[0])) hits.unshift(out[0]);
    return hits;
  }
  async function openCat(it) {
    if (!it.win) { if (window.VRGDesk) window.VRGDesk.open(it.id); return; }                 // runs as before (START act, view, …)
    const cell = S.pendingCell, open = 'cat:' + it.id;
    const r = await vrg.call('desktop', 'open', { id: it.id });
    if (!r || r.ok === false) { toast(false, (r && r.hu) || 'Nem nyitható meg.', 'Cannot open.'); return; }
    if (r.do === 'pane') return openKind(r.kind, {}, { open, cell });
    if (r.do === 'app') {
      const f = F(), ex = f && f.panes().find(p => f.kindOf(p) === 'app' && (f.stateOf(p) || {}).id === r.id);
      if (ex) { f.focus(ex); toast(true, it.hu + ' már nyitva van.', 'Already open.'); return; }
      return openKind('app', { id: r.id, title: r.title || it.hu }, { open, cell });
    }
    if (r.do === 'web') return openUrlAt(r.url, { open, cell });
    if (window.VRGDesk && window.VRGDesk.apply) window.VRGDesk.apply(r);
  }
  async function openUrlAt(url, o) {
    const u = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const id = openKind('web', {}, { open: (o && o.open) || 'pane:web', cell: (o && o.cell) || S.pendingCell });
    if (!id) return '';
    const host = F() && F().host;
    let inst = null;
    for (let i = 0; i < 100 && !(inst && inst.openTarget); i++) { await new Promise(r => setTimeout(r, 50)); inst = host && host.inst(id); }
    if (inst && inst.openTarget) inst.openTarget(u.slice(0, 4000));
    return id;
  }
  async function pick(cell) {
    const s = active();
    if (!s) return null;
    if (!S.catalog.length) await loadCatalog();
    const at = cell && lib.freeCell(s, cell);
    if (!at) { toast(false, 'A lap megtelt.', 'The sheet is full.'); return null; }
    const inp = h('input', { type: 'search', 'data-role': 'sh-pick-input', placeholder: 'Mit nyissak meg ide?  név, parancs vagy cím…', spellcheck: 'false', autocomplete: 'off' });
    const list = h('div', { 'data-role': 'sh-pick-list', role: 'listbox' });
    const hint = h('div', { class: 'hint' }, 'Enter: megnyitás · ↑↓: választás · Esc: bezár', h('span', { class: 'en' }, 'cell ' + (at.c + 1) + ',' + (at.r + 1)));
    const box = h('div', { 'data-role': 'sh-pick', role: 'dialog', 'aria-label': 'Megnyitás ide' }, inp, list, hint);
    let shown = [], sel = 0;
    const go = async o => { closePopup(); S.pendingCell = at; try { await o.go(); } finally { S.pendingCell = null; } };
    const draw = () => {
      shown = choices(inp.value).slice(0, 400);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.textContent = '';
      let grp = '';
      shown.forEach((o, i) => {
        if (!inp.value.trim() && o.grp !== grp) { grp = o.grp; list.append(h('div', { class: 'grp' }, grp)); }
        list.append(h('button', { type: 'button', role: 'option', 'data-pick': o.id, 'data-sel': i === sel ? '1' : '', class: o.ext ? 'ext' : '', title: o.en || '',
          onclick: () => go(o), onmousemove: () => { if (sel !== i) { sel = i; mark(); } } },
          h('i', { class: 'ic' }, o.ic || '·'), h('span', { class: 't' }, o.hu), inp.value.trim() ? h('span', { class: 'k' }, o.grp) : o.ext ? h('span', { class: 'k' }, '↗') : null));
      });
      if (!shown.length) list.append(h('div', { class: 'none' }, 'Nincs találat.'));
    };
    const mark = () => { [...list.querySelectorAll('[data-pick]')].forEach((b, i) => { b.dataset.sel = i === sel ? '1' : ''; if (i === sel) b.scrollIntoView({ block: 'nearest' }); }); };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) go(shown[sel]); }
    });
    draw();
    const cr = cells[at.r * N + at.c].getBoundingClientRect();
    popup(box, cr.left + 8, cr.top + 8);
    inp.focus();
    return box;
  }

  // ------------------------------------------------------------ the sheet bar (top strip or dock) and new sheets from presets
  async function newSheet(preset) {
    if (S.doc.sheets.length >= lib.MAX_SHEETS) { toast(false, 'Legfeljebb ' + lib.MAX_SHEETS + ' lap lehet.', 'Too many sheets.'); return ''; }
    if (!S.catalog.length) await loadCatalog();
    let wins = [];
    if (preset && preset.wins && preset.wins.length) {
      const f = F();
      const resolved = new Map();
      for (const pw of preset.wins) {
        if (!pw.open.startsWith('cat:')) continue;
        const it = S.catalog.find(i => i.id === pw.open.slice(4));
        if (!it || !it.win) continue;                                    // only window items: a preset never starts a program by itself
        const r = await vrg.call('desktop', 'open', { id: it.id });
        if (r && r.do === 'pane') resolved.set(pw.open, { kind: r.kind, open: pw.open, state: {} });
        else if (r && r.do === 'app' && !(f && f.panes().some(p => f.kindOf(p) === 'app' && (f.stateOf(p) || {}).id === r.id))) resolved.set(pw.open, { kind: 'app', open: pw.open, state: { id: r.id, title: r.title || it.hu } });
        else if (r && r.do === 'web') resolved.set(pw.open, { kind: 'web', open: pw.open, state: {}, url: r.url });
      }
      const home = anyOfKind('home');
      wins = lib.fromPreset(S.doc, { id: preset.id, name: preset.name, wins: preset.wins }, pw => {
        if (pw.open.startsWith('cat:')) return resolved.get(pw.open) || null;
        const kind = pw.open.slice(5);
        if (kind === 'home' && home) return null;
        return { kind, open: pw.open, state: pw.state };
      }, f ? f.panes() : []) || [];
      S.presetUrls = new Map(wins.filter(w => w.open.startsWith('cat:') && resolved.get(w.open) && resolved.get(w.open).url).map(w => [w.id, resolved.get(w.open).url]));
    }
    const ok = commit(lib.addSheet(S.doc, preset && preset.wins && preset.wins.length ? preset.name : 'Lap', wins));   // a blank one is just "Lap"
    if (!ok) { toast(false, 'A lap nem jött létre.', 'The sheet was not made.'); return ''; }
    showDesktop();
    if (S.presetUrls && S.presetUrls.size) {                             // server pages of a preset: their windows get the page
      const host = F() && F().host;
      for (const [id, url] of S.presetUrls) {
        (async () => { let inst = null; for (let i = 0; i < 100 && !(inst && inst.openTarget); i++) { await new Promise(r => setTimeout(r, 50)); inst = host && host.inst(id); } if (inst && inst.openTarget) inst.openTarget(url); })();
      }
      S.presetUrls = null;
    }
    const fid = preset ? lib.presetFocus(preset, wins) : '';           // the window the preset names gets the keyboard (Dev/Code: the browser)
    if (fid) { holdFocus(fid); focus(fid); }
    return S.doc.active;
  }
  function plusMenu(x, y) {
    const lv = RANK[level()] || 0;
    const pre = S.presets.filter(p => (RANK[p.level] || 0) <= lv);
    const mine = S.doc.mine;
    menu([
      ...pre.map(p => ({ hu: p.name, en: p.en, id: 'preset:' + p.id, k: p.wins.length ? p.wins.length + ' ablak' : '', run: () => newSheet(p) })),
      ...(mine.length ? [{ sep: true }, ...mine.map(p => ({ hu: '★ ' + p.name, en: 'My preset', id: 'mine:' + p.id, k: p.wins.length + ' ablak', run: () => newSheet(p) }))] : []),
      ...(mine.length ? [{ hu: 'Saját sablon törlése', en: 'Delete a preset of mine', sub: mine.map(p => ({ hu: p.name, run: () => commit(lib.removePreset(S.doc, p.id)) })) }] : []),
    ], x, y);
  }
  function tabMenu(sid, x, y) {
    const s = lib.sheetOf(S.doc, sid); if (!s) return;
    const i = S.doc.sheets.indexOf(s);
    let sure = false;
    menu([
      { hu: 'Átnevezés', en: 'Rename', run: () => rename(sid) },
      { hu: 'Mentés sablonként', en: 'Save as a preset', run: () => {
        const id = (s.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lap').slice(0, 24);
        if (commit(lib.savePreset(S.doc, sid, id, s.name))) toast(true, 'Sablon mentve: ' + s.name, 'Preset saved.');
      } },
      { hu: 'Balra', en: 'Move left', off: i === 0, run: () => commit(lib.moveSheet(S.doc, sid, -1)) },
      { hu: 'Jobbra', en: 'Move right', off: i === S.doc.sheets.length - 1, run: () => commit(lib.moveSheet(S.doc, sid, 1)) },
      { hu: 'Sáv: ' + (S.doc.bar === 'top' ? 'alulra (dokk)' : 'felülre'), en: 'Bar position', run: () => commit(lib.setBar(S.doc, S.doc.bar === 'top' ? 'bottom' : 'top')) },
      { sep: true },
      { hu: s.wins.length ? 'Bezárás (' + s.wins.length + ' ablak is)' : 'Bezárás', en: 'Close the sheet', keep: !!s.wins.length, id: 'close-sheet', run: () => {
        if (s.wins.length && !sure) { sure = true; const b = S.popup && S.popup.el.querySelector('[data-item="close-sheet"]'); if (b) b.textContent = 'Biztosan? Kattints újra'; return; }
        closePopup();
        commit(lib.removeSheet(S.doc, sid));
      } },
    ], x, y);
  }
  function rename(sid) {
    const tab = document.querySelector('[data-role="sh-tab"][data-sheet="' + sid + '"]');
    const s = lib.sheetOf(S.doc, sid);
    if (!tab || !s) return;
    const inp = h('input', { type: 'text', value: s.name, maxlength: '40', 'data-role': 'sh-rename' });
    tab.textContent = ''; tab.append(inp); inp.focus(); inp.select();
    const done = ok => { if (ok && inp.value.trim()) commit(lib.renameSheet(S.doc, sid, inp.value.trim())); else drawBars(); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true));
  }
  function bar() {
    const box = h('span', { 'data-role': 'sh-bar', 'data-at': S.doc.bar });
    const tab = (sid, label, title) => {
      const b = h('button', { type: 'button', 'data-role': 'sh-tab', 'data-sheet': sid, 'aria-pressed': String(S.doc.active === sid), title, onclick: () => activate(sid) }, label);
      if (sid) {
        b.addEventListener('contextmenu', e => { e.preventDefault(); tabMenu(sid, e.clientX, e.clientY); });
        b.addEventListener('dblclick', e => { e.preventDefault(); rename(sid); });
        const s = lib.sheetOf(S.doc, sid); if (s && s.wins.length) b.append(h('span', { class: 'n' }, String(s.wins.length)));
      }
      return b;
    };
    if (S.doc.sheets.length) box.append(tab('', '▦ Munkapad', 'A régi osztott munkapad / The split workbench'));
    for (const s of S.doc.sheets) box.append(tab(s.id, s.name, 'Lap / Sheet · jobb klikk: menü'));
    box.append(h('button', { type: 'button', 'data-role': 'sh-new', title: 'Új lap / New sheet', onclick: e => { const r = e.currentTarget.getBoundingClientRect(); plusMenu(r.left, S.doc.bar === 'top' ? r.bottom + 4 : r.top); } }, S.doc.sheets.length ? '＋' : '＋ Lap'));
    return box;
  }
  // desk.js asks for the bar each time it draws the top strip ('top') or the dock ('bottom')
  function barInto(el, where) { if (el && where === S.doc.bar) el.prepend(bar()); }
  function drawBars() {
    for (const old of document.querySelectorAll('[data-role="sh-bar"]')) old.remove();
    barInto($('[data-role="topstrip"]'), 'top');
    barInto($('[data-role="dock"]'), 'bottom');
  }

  // ------------------------------------------------------------ keys on a Lap: Ctrl+Alt+↑ full · Ctrl+Alt+↓ small · Ctrl+W close ·
  // Ctrl+Alt+←/→ previous / next sheet · Ctrl+Alt+N the picker on the first free cell
  document.addEventListener('keydown', e => {
    if (!document.body.dataset.sheet || S.popup) return;
    const s = active(); if (!s) return;
    const f = s.focus;
    if (e.ctrlKey && e.altKey && e.key === 'ArrowUp' && f) { e.preventDefault(); commit(lib.maximize(S.doc, f)); }
    else if (e.ctrlKey && e.altKey && e.key === 'ArrowDown' && f) { e.preventDefault(); commit(lib.minimize(S.doc, f)); }
    else if (e.ctrlKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const i = S.doc.sheets.findIndex(x => x.id === s.id), j = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (j >= 0 && j < S.doc.sheets.length) activate(S.doc.sheets[j].id);
    } else if (e.ctrlKey && e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); pick(lib.freeCell(s) || { c: 0, r: 0 }); }
    else if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W') && f) { e.preventDefault(); close(f); }
  });

  // ------------------------------------------------------------ boot
  async function boot() {
    for (let i = 0; i < 200 && !(F() && F().host); i++) await new Promise(r => setTimeout(r, 25));
    let r = null;
    try { r = vrg && vrg.sheets ? await vrg.sheets.get() : null; } catch (e) {}
    if (r && r.ok !== false) {
      S.presets = Array.isArray(r.presets) ? r.presets : [];
      if (r.doc && lib.validate(r.doc).ok) S.doc = r.doc;
    }
    S.loaded = true;
    render();
    loadCatalog().then(() => render());
  }
  const ready = boot();

  window.VRGSheets = {
    ready, on: () => !!S.doc.active, openKind, findKind, focus, close, closeSheet: sid => commit(lib.removeSheet(S.doc, sid)), holding: () => (hold && Date.now() <= hold.until ? hold.id : ''), stateOf, focused: () => (active() ? active().focus : ''), showTree, activate, sync,
    barInto, pick, newSheet, menu, doc: () => S.doc, presets: () => S.presets, save, layer,
    state: () => ({ active: S.doc.active, sheets: S.doc.sheets.length, wins: (active() || { wins: [] }).wins.map(w => ({ id: w.id, kind: w.kind, c: w.c, r: w.r, w: w.w, h: w.h, max: w.max })), shown: S.shown, popup: !!S.popup }),
  };
})();
