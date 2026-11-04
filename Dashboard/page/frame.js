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
    window.VRGFrame = { tree: () => L.tree(), save, panes: () => [...panes.keys()] };
    window.addEventListener('resize', scheduleBounds);
    window.addEventListener('scroll', scheduleBounds, true);
    new ResizeObserver(scheduleBounds).observe(root);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) { clearTimeout(saveTimer); save(); } });
    scheduleBounds();
    document.body.dataset.ready = '1';
  }

  const wbar = document.getElementById('wbar');
  if (vrg && wbar) {
    wbar.addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (b) vrg.win(b.dataset.w); });
    wbar.addEventListener('dblclick', e => { if (!e.target.closest('button')) vrg.win('max'); });
  }
  boot();
})();
