// frame.js — boots the frame page: loads the tree, mounts the panes, persists the tree, reports the rects of view-backed panes.
// A pane module is a classic script panes/<kind>.js registering  VRGPanes[kind] = { mount(el, state, api), unmount(), state() }.
// One instance is made per pane (Object.create), so a module can keep per-pane data on `this`.
(function () {
  'use strict';
  const lib = window.VRGLayoutLib;
  const vrg = window.vrg;
  const P = window.VRGPanes = window.VRGPanes || {};
  const root = document.getElementById('root');
  const panes = new Map();                                   // pane id → { kind, body, inst }
  const loading = new Map();                                 // kind → Promise (script loaded or failed)
  let L = null, saveTimer = 0, boundsRaf = 0;
  const sent = new Map();                                    // viewId → last rect JSON

  // the Kezdőlap is a WebContentsView placed by main: the pane is only a box whose rect is reported
  P.home = { mount(el) { el.dataset.view = 'home'; }, unmount() {}, state() { return {}; } };

  const log = (level, msg) => { try { vrg && vrg.call('app', 'log', { level, msg: String(msg).slice(0, 500) }); } catch (e) {} };

  function loadKind(kind) {
    if (P[kind]) return Promise.resolve(true);
    if (!loading.has(kind)) {
      loading.set(kind, new Promise(res => {
        const s = document.createElement('script');
        s.src = 'panes/' + kind + '.js';
        s.onload = () => res(!!P[kind]);
        s.onerror = () => res(false);
        document.head.append(s);
      }));
    }
    return loading.get(kind);
  }

  function api(id) {
    return {
      id, vrg,
      replace: kind => L.commit(lib.replace(L.tree(), id, kind)),
      setState: s => { const t = lib.setState(L.tree(), id, s); if (t !== L.tree()) L.commit(t); },
      has: kind => lib.panes(L.tree()).some(p => p.kind === kind),
      open: (kind, state) => openKind(kind, state),                // a new tab next to the focused pane (term: Ctrl+Shift+T, profile menu)
    };
  }

  function drop(id) {
    const e = panes.get(id);
    if (!e) return;
    try { e.inst && e.inst.unmount && e.inst.unmount(); } catch (err) { log('error', 'unmount ' + id + ': ' + err.message); }
    e.body.remove();
    panes.delete(id);
  }

  function getBody(pane) {
    let e = panes.get(pane.id);
    if (e && e.kind !== pane.kind) { drop(pane.id); e = null; }
    if (e) return e.body;
    const body = document.createElement('div');
    body.dataset.pane = pane.id; body.dataset.kind = pane.kind;
    e = { kind: pane.kind, body, inst: null };
    panes.set(pane.id, e);
    loadKind(pane.kind).then(ok => {
      if (panes.get(pane.id) !== e) return;
      if (!ok) { body.textContent = 'Ez a panel még nem érhető el.'; body.title = 'This pane is not available yet.'; return; }
      e.inst = Object.create(P[pane.kind]);
      try { e.inst.mount(body, pane.state, api(pane.id)); } catch (err) { body.textContent = 'Hiba a panel indításakor.'; log('error', 'mount ' + pane.kind + ': ' + err.message); }
      if (pane.kind === 'term') decorateClaude(e.inst);
      scheduleBounds();
    });
    return body;
  }

  // ------------------------------------------------------------ persistence (debounced 500 ms)
  function snapshot() {
    let t = JSON.parse(JSON.stringify(L.tree()));
    for (const p of lib.panes(t)) {
      const e = panes.get(p.id);
      if (!e || !e.inst || !e.inst.state) continue;
      try { const s = e.inst.state(); const n = lib.setState(t, p.id, s || {}); if (n !== t) t = JSON.parse(JSON.stringify(n)); } catch (err) {}
    }
    return t;
  }
  function save() { saveTimer = 0; if (vrg && lib.validate(snapshot()).ok) vrg.layout.set(snapshot()); }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }

  // ------------------------------------------------------------ rects of view-backed panes
  function reportBounds() {
    boundsRaf = 0;
    if (!vrg || !vrg.layout) return;
    const seen = new Set();
    for (const el of root.querySelectorAll('[data-view]')) {
      const id = el.dataset.view;
      const r = el.getBoundingClientRect();
      const shown = !el.closest('[hidden]') && r.width > 0 && r.height > 0;
      seen.add(id);
      send(id, shown ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : { x: 0, y: 0, w: 0, h: 0 });
    }
    for (const id of sent.keys()) if (!seen.has(id)) send(id, { x: 0, y: 0, w: 0, h: 0 });
  }
  function send(id, rect) {
    const j = JSON.stringify(rect);
    if (sent.get(id) === j) return;
    sent.set(id, j);
    vrg.layout.bounds(id, rect).then(r => { if (!r || r.ok === false) sent.delete(id); });
  }
  function scheduleBounds() { if (!boundsRaf) boundsRaf = setTimeout(reportBounds, 16); }   // not rAF: a hidden window never fires it

  // ------------------------------------------------------------ boot
  async function boot() {
    let tree = null;
    try { const r = vrg && await vrg.layout.get(); if (r && r.ok && r.tree) tree = r.tree; } catch (e) {}
    if (!tree || !lib.validate(tree).ok) tree = lib.defaultTree();
    L = window.VRGLayout.create({
      root, getBody,
      onChange: (t, live) => { scheduleBounds(); if (!live) scheduleSave(); },
      onPanes: ids => { for (const id of [...panes.keys()]) if (!ids.has(id)) drop(id); scheduleBounds(); },
    });
    L.set(tree);
    window.VRGFrame = { tree: () => L.tree(), save, panes: () => [...panes.keys()], open: openKind, close: id => L.commit(lib.close(L.tree(), id)), pane: id => (panes.get(id) || {}).inst || null };
    window.addEventListener('resize', scheduleBounds);
    window.addEventListener('scroll', scheduleBounds, true);
    new ResizeObserver(scheduleBounds).observe(root);
    // a pane that swaps its view box (web: tab switch, a menu replacing the view) changes data-view / hidden, not the size
    new MutationObserver(scheduleBounds).observe(root, { subtree: true, attributes: true, attributeFilter: ['data-view', 'hidden'] });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) { clearTimeout(saveTimer); save(); } });
    scheduleBounds();
    if (vrg && vrg.on) vrg.on('layout', 'open', m => (m && m.kind === 'term' && typeof m.term === 'string' ? adoptTerm(m) : openKind(m.kind, m.state)));
    // "Terminál itt" (files pane): the files pane fires  vrg-open-term  with detail { at: <dir handle> }
    document.addEventListener('vrg-open-term', e => openKind('term', { prof: 'pwsh', at: e.detail && e.detail.at }));
    initPalette();
    initSelection();
    initSearch();
    window.VRGFrame.search = openSearch;
    window.VRGFrame.ctxAdd = ctxAdd;
    document.addEventListener('vrg-ctx-add', e => { if (e.detail) ctxAdd(e.detail); });
    // "Posta": a webmail account ('web:<id>', or the WP-26 short names gmail / outlook) opens its web tab; anything else focuses or opens the Mail pane (WP-28)
    window.VRGFrame.mail = (acc) => {
      if (acc === 'outlook' || acc === 'gmail') return openWeb('web:' + acc);
      if (typeof acc === 'string' && /^web:[a-z0-9_-]{1,40}$/.test(acc)) return openWeb(acc);
      const id = [...panes.keys()].find(k => panes.get(k).kind === 'mail');
      if (id) { L.focusPane(id); return true; }
      return !!openKind('mail', {});
    };
    document.addEventListener('vrg-open-mail', e => { window.VRGFrame.mail(e.detail && e.detail.acc); });
    window.VRGFrame.chat = openChat;
    window.VRGFrame.note = openNote;
    document.addEventListener('vrg-note', e => { if (e.detail) openNote(e.detail); });
    window.VRGFrame.openUrl = url => (typeof url === 'string' && /^https?:\/\//i.test(url) ? openWeb(url.slice(0, 4000)) : false);
    window.addEventListener('vrg-ctx-attach', e => { if (e.detail && typeof e.detail.packId === 'string') openChat({ kind: 'pack', packId: e.detail.packId }); });
    document.addEventListener('vrg-chat-attach', e => { if (e.detail) openChat(e.detail); });
    document.body.dataset.ready = '1';
  }

  // ------------------------------------------------------------ selection menu (WP-19)
  // A right-click on selected text in a local pane asks main for the native menu; a pane that handled the click itself (term, files) has
  // called preventDefault already. Inputs keep the normal menu. The choice comes back as  sel.pick { action, text }.
  function initSelection() {
    if (!vrg || !vrg.sel) return;
    document.addEventListener('contextmenu', e => {
      if (e.defaultPrevented || (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]'))) return;
      const text = String(window.getSelection ? window.getSelection() : '');
      if (!text.trim()) return;
      e.preventDefault();
      vrg.sel.menu(text.slice(0, 65536), 'frame');
    });
    if (vrg.on) vrg.on('sel', 'pick', onPick);
  }
  // Google / AI keresés: a web pane (made if none is open) takes a new tab on the search; the other actions wait for their WP
  async function onPick(m) {
    if (m && m.action === 'search.inner' && typeof m.text === 'string') { openSearch(m.text); return; }
    if (m && m.action === 'ctx' && typeof m.text === 'string') { ctxAdd(m.text); return; }
    if (m && m.action === 'chat' && typeof m.text === 'string') { openChat({ kind: 'sel', text: m.text }); return; }
    if (m && m.action === 'note' && typeof m.text === 'string') { openNote({ text: m.text, source: noteSource(m) }); return; }
    if (!m || typeof m.text !== 'string' || (m.action !== 'google' && m.action !== 'ai')) return;
    openWeb('srch:' + m.action + ':' + m.text.slice(0, 300));
  }
  // the note's source line from where the text was selected (DESK-Q65 B): a terminal, the chat, a file name, a web page URL; the frame itself has none
  function noteSource(m) {
    if (m.origin === 'term' || m.origin === 'chat') return { kind: m.origin, ref: '' };
    if (m.origin === 'file') return { kind: 'file', ref: m.text.slice(0, 200) };
    if (m.origin === 'web' && typeof m.ref === 'string' && /^https?:\/\//i.test(m.ref)) return { kind: 'url', ref: m.ref.slice(0, 500) };
    return undefined;
  }
  // a web pane (made if none is open) takes the target (an http(s) URL or srch:<id>:<words>) in a new tab
  async function openWeb(target) {
    let id = [...panes.keys()].find(k => panes.get(k).kind === 'web');
    if (id) L.focusPane(id); else id = openKind('web', {});
    if (!id) return false;
    let inst = null;
    for (let i = 0; i < 100 && !(inst && inst.openTarget); i++) { await new Promise(r => setTimeout(r, 50)); inst = (panes.get(id) || {}).inst; }
    if (!inst || !inst.openTarget) return false;
    inst.openTarget(target);
    return true;
  }

  // ------------------------------------------------------------ side chat (WP-24)
  // "Claude oldalchat": the chat pane (made if none is open) starts a new thread with the chip attached; nothing is sent until Enter.
  // chip = { kind:'sel', text } | { kind:'pack', packId } | { kind:'file', handle, name }. Fired by the selection menu, by the stack pane's
  // "Csatolás a csevegéshez" (vrg-ctx-attach, detail { packId }) and by any pane through  vrg-chat-attach  (detail = a chip).
  async function openChat(chip) {
    let id = [...panes.keys()].find(k => panes.get(k).kind === 'chat');
    if (id) L.focusPane(id); else id = openKind('chat', {});
    if (!id) return false;
    let inst = null;
    for (let i = 0; i < 100 && !(inst && inst.attach && inst.input); i++) { await new Promise(r => setTimeout(r, 50)); inst = (panes.get(id) || {}).inst; }
    if (!inst || !inst.attach) return false;
    if (chip) inst.attach(chip); else { inst.newThread(); }
    return true;
  }

  // ------------------------------------------------------------ dev notes (WP-25)
  // "Mentés fejlesztői jegyzetként": a small dialog (panes/note.js, loaded on first use). draft = { text, source?:{ kind, ref }, label? }.
  // Fired by the selection menu, by any pane through  vrg-note  (detail = a draft) and as  VRGFrame.note(draft).
  let noteLoad = null;
  async function openNote(draft) {
    if (!window.VRGNote) {
      noteLoad = noteLoad || new Promise(res => { const s = document.createElement('script'); s.src = 'panes/note.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
      if (!(await noteLoad) || !window.VRGNote) { noteLoad = null; return false; }
    }
    window.VRGNote.open(draft || {});
    return true;
  }

  // ------------------------------------------------------------ context pack (WP-22)
  // "Csomaghoz adás": the stack pane (made if none is open) takes the node ids in the text, or the text as a "kézi jegyzet".
  // Also reachable as  VRGFrame.ctxAdd(text | { nodes: [{ id, title?, layer? }] })  and the  vrg-ctx-add  event (detail = the same), for search hits.
  async function ctxAdd(what) {
    let id = [...panes.keys()].find(k => panes.get(k).kind === 'stack');
    if (id) L.focusPane(id); else id = openKind('stack', {});
    if (!id) return false;
    let inst = null;
    for (let i = 0; i < 100 && !(inst && inst.addText); i++) { await new Promise(r => setTimeout(r, 50)); inst = (panes.get(id) || {}).inst; }
    if (!inst || !inst.addText) return false;
    if (typeof what === 'string') await inst.addText(what);
    else if (what && Array.isArray(what.nodes)) inst.add(what.nodes);
    return true;
  }

  // ------------------------------------------------------------ internal search (WP-20)
  // "Belső keresés" is a panel over the layout (not a layout pane kind): Ctrl+Shift+F, or the selection menu. Esc / Bezár closes it.
  let searchBox = null, searchInst = null;
  async function openSearch(q) {
    if (searchBox && searchInst) { searchInst.focus(); if (q) searchInst.run(q); return searchBox; }
    if (!(await loadKind('search'))) { log('warn', 'search pane not available'); return null; }
    if (searchBox) return searchBox;
    const box = document.createElement('div');
    box.dataset.pane = 'search-panel'; box.dataset.kind = 'search'; box.setAttribute('role', 'dialog'); box.title = 'Internal search';
    box.style.cssText = 'position:fixed;inset:48px 5% 5% 5%;z-index:50;overflow:auto';
    const close = () => { try { searchInst.unmount(); } catch (e) {} box.remove(); searchBox = searchInst = null; };
    document.body.append(box);
    searchBox = box; searchInst = Object.create(P.search);
    searchInst.mount(box, {}, { vrg, close });
    searchInst.focus();
    if (q) searchInst.run(q);
    return box;
  }
  function initSearch() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); openSearch(String(window.getSelection ? window.getSelection() : '').trim().slice(0, 300)); }
    });
  }

  // ------------------------------------------------------------ palette (WP-08)
  // The keymap comes with vrg.layout.palette() (no extra channel). A fresh page also lifts a hide left over from a closed palette.
  async function initPalette() {
    if (!vrg || !vrg.layout || !window.VRGPalette) return;
    try { await vrg.layout.palette({ open: false }); } catch (e) {}
    try { const r = await vrg.layout.palette(); if (r && r.ok && r.keymap) window.VRGPalette.setKeymap(r.keymap); } catch (e) {}
  }

  // layout.open from main (a palette "pane:<kind>" command): a new tab in the focused group; the Kezdőlap is only focused
  function openKind(kind, state) {
    if (!L || typeof kind !== 'string' || !lib.KINDS.includes(kind)) return '';
    const t = JSON.parse(JSON.stringify(L.tree()));
    const all = lib.panes(t);
    if (kind === 'home' && all.some(p => p.kind === 'home')) { L.commit(lib.focus(L.tree(), all.find(p => p.kind === 'home').id)); L.focusPane('home'); return 'home'; }
    const at = lib.find(t, L.focused()) || lib.find(t, all[0].id);
    const used = new Set(all.map(p => p.id));
    let id = kind === 'home' ? 'home' : '';
    for (let i = 1; !id; i++) if (!used.has(kind + '-' + i)) id = kind + '-' + i;
    const s = state && typeof state === 'object' && !Array.isArray(state) ? JSON.parse(JSON.stringify(state)) : {};
    at.node.items.push({ id, kind, state: s });
    at.node.active = at.node.items.length - 1;
    if (!lib.validate(t).ok) return '';
    L.commit(t);
    L.focusPane(id);
    return id;
  }

  // ------------------------------------------------------------ embedded Claude Code (WP-16)
  // main opened the session (lib/claudeterm.js) and sends  layout.open { kind:'term', term, prof }: a new term pane takes it over
  // instead of starting a shell of its own. The pane has no `adopt` of its own (panes/term.js is not part of this WP), so the frame
  // builds the xterm through the pane's own methods and sets the session id.
  const libBase = () => new URL('../../tools/js-libs/', document.baseURI).href;
  const loadedLibs = {};
  function loadScript(url) {
    if (!loadedLibs[url]) loadedLibs[url] = new Promise(res => { const s = document.createElement('script'); s.src = url; s.onload = () => res(true); s.onerror = () => res(false); document.head.append(s); });
    return loadedLibs[url];
  }
  async function ensureXterm() {
    if (window.Terminal && window.FitAddon && window.FitAddon.FitAddon) return true;
    let libs = {};
    try { const i = await vrg.app.info(); libs = (i && i.libs) || {}; } catch (e) {}
    const xt = /^file:/i.test(libs.xterm || '') ? libs.xterm : libBase() + 'xterm/lib/xterm.js';
    const fit = /^file:/i.test(libs.fit || '') ? libs.fit : libBase() + 'xterm-addon-fit/lib/addon-fit.js';
    if (!window.Terminal && !(await loadScript(xt))) return false;
    if (!(window.FitAddon && window.FitAddon.FitAddon) && !(await loadScript(fit))) return false;
    return !!window.Terminal;
  }
  async function adoptTerm(m) {
    const id = openKind('term', {});                           // no prof: the pane stays idle (its profile menu is hidden below)
    if (!id) { try { vrg.term.kill(m.term); } catch (e) {} return ''; }
    let inst = null;
    for (let i = 0; i < 100 && !(inst && inst.root && inst.host); i++) { await new Promise(r => setTimeout(r, 50)); inst = (panes.get(id) || {}).inst; }
    if (!inst || !inst.root) { try { vrg.term.kill(m.term); } catch (e) {} return id; }
    inst.prof = typeof m.prof === 'string' ? m.prof : 'claude-a';
    inst.menu.hidden = true;
    if (!(await ensureXterm()) || !inst.root) { try { vrg.term.kill(m.term); } catch (e) {} if (inst.note) { inst.note.hidden = false; inst.note.textContent = 'A terminál ebben a buildben nem érhető el.'; } return id; }
    if (inst.note) inst.note.hidden = true;
    if (!inst.term) inst.build();
    inst.exited = false; inst.id = m.term; inst.root.dataset.term = m.term;
    inst.fit(true); inst.term.focus();
    decorateClaude(inst);
    return id;
  }

  // the A/B account switch in the tab strip of a Claude term pane: it only changes the setting claude.account (the next start uses it)
  function decorateClaude(inst) {
    if (!inst || !inst.bar || !/^claude-/.test(inst.prof || '') || inst.bar.querySelector('[data-role="claude-account"]')) return;
    const box = document.createElement('span'); box.dataset.role = 'claude-account'; box.title = 'Claude account';
    const btns = {};
    const mark = a => { for (const k of Object.keys(btns)) btns[k].setAttribute('aria-pressed', String(k === a)); };
    for (const a of ['A', 'B']) {
      const b = btns[a] = document.createElement('button'); b.type = 'button'; b.textContent = a; b.dataset.account = a; b.title = 'Claude account ' + a;
      b.addEventListener('click', () => { mark(a); try { vrg.call('app', 'setting', { k: 'claude.account', v: a }); } catch (e) {} });
      box.append(b);
    }
    inst.bar.append(box);
    mark(/-b$/.test(inst.prof) ? 'B' : 'A');
    try { vrg.call('app', 'setting', { k: 'claude.account' }).then(r => { if (r && (r.v === 'A' || r.v === 'B')) mark(r.v); }).catch(() => {}); } catch (e) {}
  }

  const wbar = document.getElementById('wbar');
  if (vrg && wbar) {
    wbar.addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (b) vrg.win(b.dataset.w); });
    wbar.addEventListener('dblclick', e => { if (!e.target.closest('button')) vrg.win('max'); });
  }
  boot();
})();
