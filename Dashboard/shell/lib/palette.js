// palette.js — the command palette (API.md vrg.layout.palette / run): the index of everything the Desktop can open, the matcher
// (shared with the page as window.VRGPaletteLib) and run(id), which re-resolves every id in main (CONTRACT §2).
//   const pal = createPalette({ R, acts, openPane, modules?, store? });
//   pal.index() → [{ id, hu, en, kind }]     pal.run(id) → { ok, hu, en }     pal.recent() → [id]
// Ids: acts (s: cont: go:) and pane:<kind> are owned here; prof: root: pre: web: belong to modules that expose
// paletteItems() and run(id) (lib/profiles.js, roots.js, presets.js, web.js); a module that does not exist yet is skipped.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGPaletteLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_RECENT = 30;
  const PANES = { home: ['Kezdőlap', 'Home'], empty: ['Üres panel', 'Empty pane'], files: ['Fájlok', 'Files'], term: ['Terminál', 'Terminal'],
    web: ['Böngésző', 'Browser'], mail: ['Posta', 'Mail'], stack: ['Folyamatok', 'Stack'], chat: ['Chat', 'Chat'], note: ['Jegyzet', 'Note'],
    git: ['Git: állapot, ágak, commit, push', 'Git panel'], feed: ['Hírek', 'Feeds'],
    workspaces: ['Munkaterek', 'Saved workspaces'] };                 // not a layout kind: the frame opens its panel (DESK-Q93, WP-35a)
  const OWNERS = { 'prof:': 'profiles', 'root:': 'roots', 'pre:': 'presets', 'web:': 'web', 'desk:': 'deskcmds' };   // desk: the VRG Asztal's views and levels (WP-41), passed in by main
  const KIND = { 's:': 'start', 'cont:': 'start', 'go:': 'start', 'pane:': 'pane', 'prof:': 'term', 'root:': 'root', 'pre:': 'preset', 'web:': 'web', 'desk:': 'desk' };
  const DEFAULT_KEYMAP = { palette: 'Ctrl+Shift+P', closeTab: 'Ctrl+W', split: 'Ctrl+\\', splitStacked: 'Ctrl+Shift+\\',
    focusLeft: 'Ctrl+Alt+Left', focusRight: 'Ctrl+Alt+Right', focusUp: 'Ctrl+Alt+Up', focusDown: 'Ctrl+Alt+Down' };

  // ------------------------------------------------------------ matching (pure, also runs in the page)
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

  // every query word must be a prefix of a word in hu + en; rank = sum of the positions of those words, then recent use, then index order
  function search(items, query, recent) {
    const rec = Array.isArray(recent) ? recent : [];
    const rank = id => { const i = rec.indexOf(id); return i < 0 ? 1e6 : i; };
    const q = words(query);
    const out = [];
    items.forEach((it, n) => {
      if (!q.length) { out.push({ it, score: 0, r: rank(it.id), n }); return; }
      const w = words(it.hu + ' ' + it.en);
      let score = 0;
      for (const x of q) {
        const at = w.findIndex(y => y.startsWith(x));
        if (at < 0) return;
        score += at;
      }
      out.push({ it, score, r: rank(it.id), n });
    });
    out.sort((a, b) => a.score - b.score || a.r - b.r || a.n - b.n);
    return out.map(x => x.it);
  }

  // "Ctrl+Shift+P" against a keydown event
  const KEYS = { left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown', esc: 'escape', space: ' ' };
  function matchKey(spec, e) {
    if (typeof spec !== 'string' || !spec || !e || typeof e.key !== 'string') return false;
    const at = spec.lastIndexOf('+', spec.length - 2);
    const mods = (at < 0 ? '' : spec.slice(0, at)).toLowerCase().split('+').filter(Boolean);
    const k = at < 0 ? spec : spec.slice(at + 1);
    if (mods.some(m => !['ctrl', 'alt', 'shift'].includes(m))) return false;
    const key = (KEYS[k.toLowerCase()] || k).toLowerCase();
    return !!e.ctrlKey === mods.includes('ctrl') && !!e.altKey === mods.includes('alt') && !!e.shiftKey === mods.includes('shift') && e.key.toLowerCase() === key;
  }

  const kindOf = id => { const p = Object.keys(KIND).find(x => id.startsWith(x)); return p ? KIND[p] : null; };

  // config/keymap.json: only the known actions, only well-formed specs; anything else falls back to the default
  function loadKeymap(file, fs) {
    const out = { ...DEFAULT_KEYMAP };
    try {
      const j = JSON.parse((fs || require('fs')).readFileSync(file, 'utf8'));
      for (const k of Object.keys(DEFAULT_KEYMAP)) if (typeof j[k] === 'string' && /^(?:(?:Ctrl|Alt|Shift)\+)*(?:[^\s+]{1,12}|\+)$/.test(j[k])) out[k] = j[k];
    } catch (e) {}
    return out;
  }

  // ------------------------------------------------------------ main side
  function fileStore() {
    const fs = require('fs'), path = require('path');
    const file = () => path.join(require('./paths.js').userDir(), 'palette.json');
    return {
      load() { try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); return Array.isArray(j['palette.recent']) ? j['palette.recent'] : []; } catch (e) { return []; } },
      save(list) { const f = file(), tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ 'palette.recent': list }, null, 1)); fs.renameSync(tmp, f); },
    };
  }

  function createPalette({ R, acts, openPane, modules, store, log = () => {} }) {
    const mods = modules || {};
    const st = store || fileStore();
    const say = (ok, hu, en) => ({ ok, hu, en });

    function owner(id) {
      const p = Object.keys(OWNERS).find(x => id.startsWith(x));
      if (!p) return null;
      if (!(p in mods)) {
        try { mods[p] = require('./' + OWNERS[p] + '.js'); } catch (e) { mods[p] = null; }       // not built yet → skipped
      }
      const m = mods[p];
      return m && typeof m.paletteItems === 'function' ? { p, m } : null;
    }

    function index() {
      const C = R.C, out = [], seen = new Set();
      const add = (id, hu, en) => {
        if (typeof id !== 'string' || id.length > 80 || seen.has(id) || !kindOf(id) || !hu) return;
        seen.add(id); out.push({ id, hu: String(hu), en: String(en || ''), kind: kindOf(id) });
      };
      for (const t of C.data.start || []) {
        if (t.act) add(t.act, t.name, t.hint);
        for (const s of t.subs || []) if (s.act) add(s.act, t.name + ' · ' + s.name, s.hint);
      }
      for (const p of C.data.programs || []) if (p.act) add(p.act, p.name, '');
      for (const id of Object.keys(C.startActs || {})) if (acts.lookup(id)) add(id, C.startActs[id].name, C.startActs[id].hint);
      for (const l of C.data.lines || []) if (l.contAct) add(l.contAct, 'Claude · ' + l.name, 'continue');
      for (const g of C.data.go || []) if (g.act) add(g.act, 'Claude · GO ' + g.name + ' ' + (g.title || ''), '');
      for (const k of Object.keys(PANES)) add('pane:' + k, PANES[k][0], PANES[k][1]);
      for (const p of Object.keys(OWNERS)) {
        const o = owner(p);
        if (!o) continue;
        let items = [];
        try { items = o.m.paletteItems() || []; } catch (e) { log('palette items failed', p); }
        for (const it of items) if (it && typeof it.id === 'string' && it.id.startsWith(p)) add(it.id, it.hu, it.en);
      }
      return out;
    }

    const recent = () => { const r = st.load(); return r.filter(x => typeof x === 'string').slice(0, MAX_RECENT); };
    function remember(id) {
      try { st.save([id, ...recent().filter(x => x !== id)].slice(0, MAX_RECENT)); } catch (e) { log('palette recent not saved'); }
    }

    async function run(id) {
      if (typeof id !== 'string' || id.length > 80 || !kindOf(id)) { log('refused', id); return { ...say(false, 'Ismeretlen parancs.', 'Unknown command.'), err: 'bad-request' }; }
      let r;
      if (id.startsWith('pane:')) {
        const kind = id.slice(5);
        if (!Object.prototype.hasOwnProperty.call(PANES, kind)) return { ...say(false, 'Ismeretlen panel.', 'Unknown pane.'), err: 'bad-request' };
        openPane(kind);
        r = say(true, PANES[kind][0] + ' megnyitva', 'opened');
      } else {
        if (!index().some(x => x.id === id)) { log('refused', id); return { ...say(false, 'Nincs a nyilvántartásban: ' + id, 'Not in the registry.'), err: 'bad-request' }; }
        const o = owner(id);
        if (o) {
          if (typeof o.m.run !== 'function') return say(false, 'Ez még nem futtatható.', 'Not runnable yet.');
          r = await o.m.run(id);
        } else r = await acts.runAct(id);
      }
      if (r && r.ok !== false) remember(id);
      return r;
    }

    return { index, run, recent };
  }

  return { createPalette, search, fold, words, matchKey, loadKeymap, kindOf, DEFAULT_KEYMAP, PANES, MAX_RECENT };
});
