// layout.js — the layout tree (API.md vrg.layout): pure functions, shared by main (CommonJS) and the frame page (classic script, window.VRGLayoutLib).
//   tree = { v:1, root }   node = split { dir:'h'|'v', ratio, a, b }  |  tabs { active, items:[pane] }
//   pane = { id:[a-z0-9-]{1,40}, kind, state }   'h' = side by side (a left, b right), 'v' = stacked (a top, b bottom)
// validate() → { ok:true } | { ok:false, err }. The ops return a new valid tree, or the same tree object when the op cannot apply.
// A path addresses a node from the root: '' = root, then one 'a' / 'b' per split.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGLayoutLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KINDS = ['home', 'empty', 'files', 'term', 'web', 'mail', 'stack', 'chat', 'note', 'git', 'feed'];
  const MAX_DEPTH = 6, MAX_PANES = 40, MAX_STATE = 8192;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const sameKeys = (o, keys) => { const k = Object.keys(o); return k.length === keys.length && keys.every(x => has(o, x)); };
  const isTabs = n => plain(n) && has(n, 'items');
  const isSplit = n => plain(n) && has(n, 'a');
  const clone = v => JSON.parse(JSON.stringify(v));

  function validate(tree) {
    const bad = err => ({ ok: false, err });
    if (!plain(tree) || !sameKeys(tree, ['v', 'root']) || tree.v !== 1) return bad('tree');
    const ids = new Set(), seen = new Set();
    let err = '';
    const walk = (n, depth) => {
      if (err) return;
      if (!plain(n)) { err = 'node'; return; }
      if (depth > MAX_DEPTH) { err = 'depth'; return; }
      if (seen.has(n)) { err = 'cycle'; return; }
      seen.add(n);
      if (isSplit(n)) {
        if (!sameKeys(n, ['dir', 'ratio', 'a', 'b'])) { err = 'split-keys'; return; }
        if (n.dir !== 'h' && n.dir !== 'v') { err = 'dir'; return; }
        if (typeof n.ratio !== 'number' || !(n.ratio >= 0.1 && n.ratio <= 0.9)) { err = 'ratio'; return; }
        walk(n.a, depth + 1); walk(n.b, depth + 1);
      } else if (isTabs(n)) {
        if (!sameKeys(n, ['active', 'items'])) { err = 'tabs-keys'; return; }
        if (!Array.isArray(n.items) || !n.items.length) { err = 'empty-group'; return; }
        if (!Number.isInteger(n.active) || n.active < 0 || n.active >= n.items.length) { err = 'active'; return; }
        for (const p of n.items) {
          if (!plain(p) || !sameKeys(p, ['id', 'kind', 'state'])) { err = 'pane-keys'; return; }
          if (typeof p.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.id)) { err = 'pane-id'; return; }
          if (ids.has(p.id)) { err = 'duplicate-id'; return; }
          ids.add(p.id);
          if (!KINDS.includes(p.kind)) { err = 'kind'; return; }
          if (!plain(p.state)) { err = 'state'; return; }
          let s = ''; try { s = JSON.stringify(p.state); } catch (e) { err = 'state'; return; }
          if (s.length > MAX_STATE) { err = 'state-size'; return; }
          if (ids.size > MAX_PANES) { err = 'too-many-panes'; return; }
        }
      } else err = 'node-type';
    };
    walk(tree.root, 1);
    return err ? bad(err) : { ok: true };
  }

  const pane = (id, kind, state) => ({ id, kind, state: state || {} });
  const group = items => ({ active: 0, items });
  function defaultTree() {
    return { v: 1, root: { dir: 'h', ratio: 0.62, a: group([pane('home', 'home')]), b: group([pane('empty-1', 'empty')]) } };
  }

  // -------- reading
  function panes(tree) {
    const out = [];
    const walk = n => { if (isSplit(n)) { walk(n.a); walk(n.b); } else if (isTabs(n)) n.items.forEach(p => out.push(p)); };
    walk(tree.root);
    return out;
  }
  // → { path, node, index, pane } | null
  function find(tree, paneId) {
    let hit = null;
    const walk = (n, path) => {
      if (hit) return;
      if (isSplit(n)) { walk(n.a, path + 'a'); walk(n.b, path + 'b'); }
      else if (isTabs(n)) { const i = n.items.findIndex(p => p.id === paneId); if (i >= 0) hit = { path, node: n, index: i, pane: n.items[i] }; }
    };
    walk(tree.root, '');
    return hit;
  }
  function nodeAt(tree, path) {
    let n = tree.root;
    for (const c of String(path)) { if (!isSplit(n) || (c !== 'a' && c !== 'b')) return null; n = n[c]; }
    return n;
  }
  function freshId(tree, base) {
    const used = new Set(panes(tree).map(p => p.id));
    for (let i = 1; ; i++) { const id = (base + '-' + i).slice(0, 40); if (!used.has(id)) return id; }
  }
  const checked = (next, prev) => (validate(next).ok ? next : prev);

  // -------- ops (each works on a clone)
  function split(tree, paneId, dir) {
    if (dir !== 'h' && dir !== 'v') return tree;
    const t = clone(tree), hit = find(t, paneId);
    if (!hit) return tree;
    const fresh = group([pane(freshId(t, 'empty'), 'empty')]);
    const s = { dir, ratio: 0.5, a: hit.node, b: fresh };
    if (hit.path === '') t.root = s;
    else { const parent = nodeAt(t, hit.path.slice(0, -1)); parent[hit.path.slice(-1)] = s; }
    return checked(t, tree);
  }

  // removes the pane from a mutable tree; an emptied group is dropped and its split collapses into the sibling
  function removeIn(t, paneId) {
    const hit = find(t, paneId);
    if (!hit) return false;
    const g = hit.node;
    g.items.splice(hit.index, 1);
    if (g.items.length) {
      if (hit.index < g.active) g.active -= 1;
      if (g.active >= g.items.length) g.active = g.items.length - 1;
      return true;
    }
    if (hit.path === '') { t.root = group([pane(freshId(t, 'empty'), 'empty')]); return true; }
    const parentPath = hit.path.slice(0, -1), side = hit.path.slice(-1), parent = nodeAt(t, parentPath);
    const sibling = parent[side === 'a' ? 'b' : 'a'];
    if (parentPath === '') t.root = sibling;
    else nodeAt(t, parentPath.slice(0, -1))[parentPath.slice(-1)] = sibling;
    return true;
  }
  function close(tree, paneId) {
    const t = clone(tree);
    return removeIn(t, paneId) ? checked(t, tree) : tree;
  }

  function move(tree, paneId, targetTabsPath, index) {
    const t = clone(tree), hit = find(t, paneId), target = nodeAt(t, targetTabsPath);
    if (!hit || !isTabs(target) || !Number.isInteger(index)) return tree;
    const item = hit.pane;
    if (target === hit.node) {                                   // reorder inside one group
      const items = target.items;
      items.splice(hit.index, 1);
      items.splice(Math.max(0, Math.min(items.length, index)), 0, item);
      target.active = items.indexOf(item);
      return checked(t, tree);
    }
    if (!removeIn(t, paneId)) return tree;                        // target keeps its identity: collapse only re-links nodes
    target.items.splice(Math.max(0, Math.min(target.items.length, index)), 0, item);
    target.active = target.items.indexOf(item);
    return checked(t, tree);
  }

  function focus(tree, paneId) {
    const t = clone(tree), hit = find(t, paneId);
    if (!hit) return tree;
    hit.node.active = hit.index;
    return t;
  }
  function setRatio(tree, path, ratio) {
    const t = clone(tree), n = nodeAt(t, path);
    if (!isSplit(n) || typeof ratio !== 'number' || !Number.isFinite(ratio)) return tree;
    n.ratio = Math.max(0.1, Math.min(0.9, ratio));
    return t;
  }
  // replace a pane by another kind (the "Üres panel" picking a kind); the id stays unless the new kind is home
  function replace(tree, paneId, kind, state) {
    const t = clone(tree), hit = find(t, paneId);
    if (!hit || !KINDS.includes(kind)) return tree;
    if (kind === 'home' && panes(t).some(p => p.kind === 'home')) return tree;   // one Kezdőlap view
    hit.node.items[hit.index] = pane(kind === 'home' ? 'home' : paneId, kind, state);
    return checked(t, tree);
  }
  function setState(tree, paneId, state) {
    const t = clone(tree), hit = find(t, paneId);
    if (!hit) return tree;
    hit.pane.state = state;
    return checked(t, tree);
  }

  return { KINDS, MAX_DEPTH, MAX_PANES, MAX_STATE, validate, defaultTree, panes, find, nodeAt, split, close, move, focus, setRatio, replace, setState };
});
