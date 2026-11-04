/* VRG UI Kit — actions.js — the one action registry.
   One entry declares an action AND every surface it appears on. The command palette, context menus,
   toolbars, the status bar and keyboard shortcuts all read this list; none keeps its own.
   Shape (a superset of Planner's 05c-actions.js and MindMap's ACT):

     VK.actions.register({
       id: 'node.new',                  // unique, dotted, English
       label: 'Új buborék',             // Hungarian UI text
       hint: 'Új buborék a vászon közepén',   // one line under the label in the palette
       group: 'Létrehozás',             // palette/menu grouping
       icon: 'plus',                    // sprite name (icons/icons.json)
       keys: ['mod+n'],                 // 'mod' = Ctrl (Cmd on macOS); 'shift', 'alt'; key = KeyboardEvent.key lower-cased
       at: ['palette', 'menu:canvas', 'toolbar:main'],   // surfaces; 'menu:<ctx>' and 'toolbar:<id>' are free-form
       when: ctx => true,               // offered right now?
       checked: ctx => false,           // optional: a toggle — menus show a check, toolbars aria-pressed
       danger: false,                   // optional: red in menus
       progress: ctx => 0.4,            // optional: 0…1 or null (indeterminate) — its MINI shows it (components/mini.js)
       state: ctx => 'running',         // optional: idle|running|done|error|waiting|paused|off — drives the MINI
       caption: 'SYNC',                 // optional: micro caption under the MINI
       run: ctx => {}                   // the work
     })

   ctx is whatever the app passes (selection, mode…). VK.actions.setContext(fn) installs the default
   provider; surfaces call VK.actions.ctx() so they all judge against the same state.
   Works as a classic <script> (window.VK.actions) and as an ES-module side-effect import.
   Depends on: nothing (uses VK.fold from core.js when present). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.actions) return;

  var list = [];
  var ctxFn = function () { return {}; };
  var subs = [];
  var isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  function changed(kind, a) { subs.slice().forEach(function (f) { try { f(kind, a); } catch (e) { console.error(e); } }); }
  function norm(a) {
    if (!a.at && a.surfaces) a.at = a.surfaces;
    a.at = a.at || ['palette'];
    a.keys = (a.keys || []).map(normKey);
    return a;
  }
  function normKey(k) {
    var parts = String(k).toLowerCase().split('+').map(function (s) { return s.trim(); });
    var key = parts.pop(); if (key === '') key = '+';
    var mods = ['mod', 'ctrl', 'shift', 'alt'].filter(function (m) { return parts.indexOf(m) >= 0 || (m === 'mod' && parts.indexOf('cmd') >= 0); });
    if (mods.indexOf('ctrl') >= 0 && mods.indexOf('mod') < 0) { mods[mods.indexOf('ctrl')] = 'mod'; }
    return mods.concat([key]).join('+');
  }

  function register(a) {
    if (!a || !a.id) throw new Error('VK.actions.register: id required');
    norm(a);
    var i = list.findIndex(function (x) { return x.id === a.id; });
    if (i >= 0) list[i] = a; else list.push(a);
    changed('register', a);
    return a;
  }
  function registerAll(arr) { (arr || []).forEach(register); return list.length; }
  function unregister(id) { var i = list.findIndex(function (x) { return x.id === id; }); if (i >= 0) { var a = list.splice(i, 1)[0]; changed('unregister', a); } }
  function get(id) { return list.find(function (x) { return x.id === id; }) || null; }
  function all() { return list.slice(); }

  function setContext(fn) { ctxFn = fn || function () { return {}; }; changed('context'); }
  function ctx(extra) { var c = {}; try { c = ctxFn() || {}; } catch (e) { console.error(e); } if (extra) for (var k in extra) c[k] = extra[k]; return c; }

  function enabled(a, c) { if (!a.when) return true; try { return !!a.when(c || ctx()); } catch (e) { return false; } }
  function checked(a, c) { if (!a.checked) return undefined; try { return !!a.checked(c || ctx()); } catch (e) { return false; } }

  /** actions placed on a surface ('palette', 'menu:node', 'toolbar:main', 'statusbar' …), in registry order.
   *  opts.all → include disabled ones (menus show them greyed, palettes hide them). */
  function forSurface(surface, c, opts) {
    c = c || ctx();
    return list.filter(function (a) {
      if (a.at.indexOf(surface) < 0 && !(surface !== 'palette' && a.at.indexOf('*') >= 0)) return false;
      return (opts && opts.all) || enabled(a, c);
    });
  }
  function surfaces() { var s = {}; list.forEach(function (a) { a.at.forEach(function (x) { s[x] = true; }); }); return Object.keys(s); }

  /** run an action; returns true when it ran. Errors are reported, never thrown into the UI loop. */
  function run(id, c, source) {
    var a = typeof id === 'string' ? get(id) : id; if (!a) return false;
    c = c || ctx(); if (!enabled(a, c)) return false;
    try { a.run(c, source); } catch (e) { console.error(e); changed('error', { action: a, error: e }); return false; }
    recent(a.id);
    changed('run', a);
    return true;
  }

  // ---- recency (the palette shows recent actions first on an empty query) ----
  var recentIds = [];
  function recent(id) { if (id) { recentIds = [id].concat(recentIds.filter(function (x) { return x !== id; })).slice(0, 8); } return recentIds.slice(); }

  // ---- keyboard ----
  function keyString(e) {
    var p = [];
    if (e.ctrlKey || e.metaKey) p.push('mod');
    if (e.shiftKey && (e.key.length > 1 || /[a-z0-9]/i.test(e.key))) p.push('shift');
    if (e.altKey) p.push('alt');
    var k = (e.key || '').toLowerCase(); if (k === ' ') k = 'space'; if (k === 'esc') k = 'escape';
    p.push(k); return p.join('+');
  }
  function forKey(str, c) { c = c || ctx(); return list.find(function (a) { return a.keys.indexOf(str) >= 0 && enabled(a, c); }) || null; }
  /** human label for a key string: 'mod+shift+k' → 'Ctrl+Shift+K' (⌘⇧K on macOS) */
  var KEYNAME = { arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', escape: 'Esc', space: 'Szóköz', enter: 'Enter',
    delete: 'Del', backspace: '⌫', tab: 'Tab', pageup: 'PgUp', pagedown: 'PgDn', home: 'Home', end: 'End' };
  function keyLabel(k) {
    return String(k).split('+').map(function (p) {
      if (p === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (p === 'shift') return isMac ? '⇧' : 'Shift';
      if (p === 'alt') return isMac ? '⌥' : 'Alt';
      return KEYNAME[p] || (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1));
    }).join(isMac ? '' : '+');
  }
  function keyParts(k) { return keyLabel(k).split(isMac ? /(?=.)/ : '+'); }

  /** one keydown listener for every registered shortcut. Skips editable targets unless the key has a modifier
   *  or the action sets keysInInputs:true. Returns an unbind function. */
  function bindKeys(target) {
    target = target || document;
    function onKey(e) {
      if (e.defaultPrevented || e.isComposing) return;
      var t = e.target, editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      var s = keyString(e), c = ctx(), a = forKey(s, c);
      if (!a) return;
      if (editable && !/^(mod|alt)\+/.test(s) && !a.keysInInputs) return;
      e.preventDefault();
      run(a, c, 'key');
    }
    target.addEventListener('keydown', onKey);
    return function () { target.removeEventListener('keydown', onKey); };
  }

  // ---- fuzzy match (Hungarian-folded): word start > substring > in-order characters ----
  var FOLD = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ő': 'o', 'ú': 'u', 'ü': 'u', 'ű': 'u' };
  function fold(s) { return VK.fold ? VK.fold(s) : String(s || '').toLowerCase().replace(/[áéíóöőúüű]/g, function (c) { return FOLD[c]; }); }
  /** score(query, text) → number (0 = no match) and match positions for highlighting */
  function score(q, text) {
    if (!q) return { score: 1, hits: [] };
    var t = fold(text), f = fold(q).trim(); if (!f) return { score: 1, hits: [] };
    var re = /[a-z0-9]+/g, m;
    while ((m = re.exec(t))) if (t.indexOf(f, m.index) === m.index) return { score: 1000 - t.length / 50, hits: range(m.index, f.length) };
    var at = t.indexOf(f);
    if (at >= 0) return { score: 500 - at - t.length / 50, hits: range(at, f.length) };
    var hits = [], j = 0, run = 0, s = 0;
    for (var i = 0; i < t.length && j < f.length; i++) {
      if (t[i] === f[j]) { hits.push(i); run = (hits.length > 1 && hits[hits.length - 2] === i - 1) ? run + 1 : 1; s += run * 2; j++; }
    }
    if (j < f.length) return { score: 0, hits: [] };
    return { score: s - t.length / 20, hits: hits };
  }
  function range(a, n) { var r = []; for (var i = 0; i < n; i++) r.push(a + i); return r; }
  /** palette search: [{action, score, hits}] best first; matches label, then hint/group/keywords at lower weight */
  function search(q, surface, c) {
    var pool = forSurface(surface || 'palette', c);
    if (!q) {
      var rec = recent(); return pool.map(function (a) { var ri = rec.indexOf(a.id); return { action: a, score: ri >= 0 ? 100 - ri : 0, hits: [], recent: ri >= 0 }; })
        .sort(function (x, y) { return y.score - x.score; });
    }
    return pool.map(function (a) {
      var m = score(q, a.label);
      if (!m.score) { var alt = score(q, [a.hint, a.group, (a.keywords || []).join(' ')].join(' ')); if (alt.score) m = { score: alt.score / 4, hits: [] }; }
      return { action: a, score: m.score, hits: m.hits };
    }).filter(function (r) { return r.score > 0; }).sort(function (x, y) { return y.score - x.score; });
  }

  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }

  VK.actions = {
    register: register, registerAll: registerAll, unregister: unregister, get: get, all: all,
    setContext: setContext, ctx: ctx, enabled: enabled, checked: checked,
    forSurface: forSurface, surfaces: surfaces, run: run, recent: recent,
    keyString: keyString, forKey: forKey, keyLabel: keyLabel, keyParts: keyParts, bindKeys: bindKeys, normKey: normKey,
    score: score, search: search, fold: fold, subscribe: subscribe, isMac: isMac
  };
})(typeof window !== 'undefined' ? window : globalThis);
