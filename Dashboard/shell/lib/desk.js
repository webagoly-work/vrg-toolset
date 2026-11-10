// desk.js — the VRG Asztal's two primary views, as pure functions shared by main (CommonJS) and the frame page (window.VRGDeskLib).
// WP-41 / WP-42 / WP-43 (Desktop unify U5–U7). No DOM, no Electron: node --test loads it as it is.
//   createDoubleTap({ key, ms })   feed(input, now) → true when the second tap of the key lands within ms (Electron input objects)
//   boot({ authEnabled })          the boot steps: ['splash', 'gate'?, 'ready']
//   sections(list, level, defs)    the Dashboard view's sections from catalog.listFor(level)
//   suiTree(list, level, groups)   the ◣ Sarokvezérlő menu tree, by function
//   stackDial(list)                the ◢ Rétegverem dial's rows: layers F I Q L A U R C G Z, then the pages
//   dock(list, level, pinned, running)   the bottom dock: pinned User apps, (Dev) a divider + dev items, then running windows
//   topStrip(list, chosen)         the top strip: built-in widgets + catalog shortcuts, in the chosen order
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGDeskLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LEVELS = ['user', 'dev', 'all'];
  const RANK = { user: 0, dev: 1, all: 2 };
  const VIEWS = ['dashboard', 'desktop'];
  const LAYERS = ['F', 'I', 'Q', 'L', 'A', 'U', 'R', 'C', 'G', 'Z'];
  const STACK_PAGES = ['stack.connectome', 'stack.orb', 'stack.layers', 'stack.search'];
  const GROUP_ORDER = ['munka', 'alkalmazasok', 'fajlok', 'rendszer', 'fejlesztes'];
  const DEFAULT_TOGGLE = { key: 'Tab', ms: 350 };
  const MAX_DOCK = 16, MAX_TOP = 12;
  // built-in top-strip widgets (DESKU-Q13); catalog items with surfaces.top join them as shortcuts
  const WIDGETS = {
    'w:clock':   { hu: 'Óra', en: 'Clock' },
    'w:servers': { hu: 'Szerverek', en: 'Servers up' },
    'w:git':     { hu: 'Git állapot', en: 'Git state' },
    'w:backup':  { hu: 'Utolsó mentés', en: 'Last backup' },
    'w:search':  { hu: 'Gyorskeresés', en: 'Quick search' },
    'w:ring':    { hu: 'Divergencia gyűrű', en: 'Divergence ring' },
    'w:level':   { hu: 'Szint', en: 'Level' },
  };
  const DEFAULT_TOP = ['w:clock', 'w:search', 'w:servers', 'w:git', 'w:backup', 'w:ring', 'console', 'w:level'];

  // ------------------------------------------------------------ double tap (main: before-input-event on every webContents)
  function toggleSpec(keymap) {
    const k = keymap && typeof keymap.desktopToggleKey === 'string' && /^[A-Za-z0-9]{1,12}$/.test(keymap.desktopToggleKey) ? keymap.desktopToggleKey : DEFAULT_TOGGLE.key;
    const ms = keymap && Number.isInteger(keymap.desktopToggleMs) && keymap.desktopToggleMs >= 150 && keymap.desktopToggleMs <= 1000 ? keymap.desktopToggleMs : DEFAULT_TOGGLE.ms;
    return { key: k, ms };
  }
  function createDoubleTap(spec) {
    const s = toggleSpec(spec && spec.key ? { desktopToggleKey: spec.key, desktopToggleMs: spec.ms } : spec);
    let last = -Infinity;
    return {
      spec: s,
      // input: { type:'keyDown'|'keyUp', key, control, alt, shift, meta, isAutoRepeat }
      feed(input, now) {
        if (!input || input.type !== 'keyDown') return false;
        const plainKey = input.key === s.key && !input.control && !input.alt && !input.shift && !input.meta;
        if (!plainKey || input.isAutoRepeat) { if (input.key !== s.key || !input.isAutoRepeat) last = -Infinity; return false; }
        if (now - last <= s.ms) { last = -Infinity; return true; }
        last = now;
        return false;
      },
      reset() { last = -Infinity; },
    };
  }
  // what the page's focused element must not be for the toggle to fire (evaluated in the webContents that had the keys)
  // a focused iframe is followed into its document; one we cannot look into (cross-origin) counts as taking text, so the keys stay
  // with the page (theresa, U9: typing inside an iframe read as "not editable")
  const EDITABLE_FN = 'function(a){while(a&&/^i?frame$/i.test(a.tagName||"")){var d=null;try{d=a.contentDocument;}catch(x){}if(!d)return true;a=d.activeElement;}' +
    'if(!a)return false;var t=(a.tagName||"").toLowerCase();' +
    'if(t==="textarea"||t==="select")return true;if(t==="input"){var y=(a.type||"text").toLowerCase();return !/^(button|checkbox|radio|range|color|submit|reset|image|file)$/.test(y);}' +
    'if(a.isContentEditable)return true;return !!(a.closest&&a.closest(".xterm,[data-kind=\\"term\\"]"));}';
  const EDITABLE_PROBE = '(' + EDITABLE_FN + ')(document.activeElement)';
  // main runs the probe asynchronously, after Tab has already moved the focus (into the first input of a form, typically); so every
  // watched webContents also gets this recorder in an isolated world (the page can neither see nor fake it): at each Tab keydown,
  // before the browser moves focus, it notes whether the focus took text, with the time. main reads the last two notes at the second
  // tap and trusts them only when they are a fresh pair (readPair): a slow renderer may not have recorded the second tap yet.
  const TAB_WORLD = 1013;
  const TAB_RECORDER = '(function(){if(window.__vrgTabEd)return;var ed=(' + EDITABLE_FN + ');window.__vrgTabEd=[];' +
    'window.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var l=window.__vrgTabEd;l.push({e:ed(document.activeElement),t:performance.now()});if(l.length>2)l.shift();},true);return true;})()';
  const TAB_READ = '(function(){var l=window.__vrgTabEd;if(!l||l.length<2)return null;var n=performance.now();' +
    'return{p:[l[0].e,l[1].e],gap:l[1].t-l[0].t,age:n-l[1].t};})()';
  // the recorder's answer → 'toggle' | 'keep' (a text field at either tap) | 'stale' (not this pair: read again or fall back)
  function readPair(rec, ms) {
    if (!rec || !Array.isArray(rec.p) || rec.p.length !== 2 || !(rec.gap >= 0) || !(rec.age >= 0)) return 'stale';
    if (rec.age > 400 || rec.gap > ms + 100) return 'stale';
    return rec.p[0] || rec.p[1] ? 'keep' : 'toggle';
  }

  // ------------------------------------------------------------ boot (WP-43): splash → gate (only with auth.enabled) → ready
  function boot(o) { return o && o.authEnabled === true ? ['splash', 'gate', 'ready'] : ['splash', 'ready']; }
  function nextBoot(step, o) { const s = boot(o); const i = s.indexOf(step); return i < 0 ? s[0] : s[Math.min(i + 1, s.length - 1)]; }

  // ------------------------------------------------------------ Dashboard view sections
  const within = (lv, level) => RANK[lv] <= RANK[level];
  // defs = catalog sections { id: { hu, en, level } }; apps are grouped by group / sub; in Dev every tile carries what hangs behind it
  function sections(list, level, defs, groups) {
    if (!LEVELS.includes(level)) level = 'user';
    const byId = new Map(list.map(i => [i.id, i]));
    const out = [];
    for (const [id, d] of Object.entries(defs || {})) {
      if (!within(d.level, level)) continue;
      const sec = { id, hu: d.hu, en: d.en, level: d.level, groups: [], items: [] };
      if (id === 'katalogus') { sec.items = list.map(i => i.id); out.push(sec); continue; }
      const mine = list.filter(i => i.surfaces && i.surfaces.dashboard === id && (!i.parent || !byId.has(i.parent) || id !== 'apps' || !(byId.get(i.parent).surfaces || {}).dashboard));
      if (id === 'apps') {
        const by = {};
        for (const i of mine) { const k = i.group + '/' + (i.sub || ''); (by[k] = by[k] || []).push(i.id); }
        for (const g of GROUP_ORDER) {
          const gd = (groups || {})[g] || {};
          const subs = Object.keys(gd.subs || {});
          for (const sub of subs.length ? subs.concat(['']) : ['']) {
            const ids = by[g + '/' + sub];
            if (ids && ids.length) sec.groups.push({ group: g, sub, hu: sub ? gd.subs[sub] : (gd.hu || g), items: ids });
          }
        }
      } else sec.items = mine.map(i => i.id);
      if (sec.items.length || sec.groups.length || ['ma', 'programok', 'munkak', 'allapot', 'vonalak', 'meroszamok', 'szerverek'].includes(id)) out.push(sec);
    }
    return out;
  }
  // what is drawn attached under a tile: its catalog children of this level (a user feature under its app at every level), and in
  // Dev / All also its START submenu actions and its servers
  function attached(item, list, level) {
    if (!item) return { items: [], acts: [], servers: [] };
    const ch = item.children || { items: [], acts: [], servers: [] };
    const known = new Set(list.map(i => i.id));
    const dev = RANK[level] >= RANK.dev;
    return { items: (ch.items || []).filter(id => known.has(id)), acts: dev ? ch.acts || [] : [], servers: dev ? ch.servers || [] : [] };
  }

  // ------------------------------------------------------------ ◣ Sarokvezérlő: the catalog by function
  // node = { label, en?, children:[node] } | leaf { id, label, en?, icon?, kind:'item'|'cmd', status? }
  function suiTree(list, level, groups) {
    if (!LEVELS.includes(level)) level = 'user';
    const leaf = i => ({ id: i.id, label: i.hu, en: i.en, icon: i.icon || '', kind: 'item', status: i.status, opens: i.opens !== false });
    const byGroup = g => list.filter(i => i.group === g && i.type !== 'category');
    const root = { label: 'MENÜ', en: 'Menu', children: [] };
    for (const g of GROUP_ORDER) {
      if (g === 'fejlesztes' && RANK[level] < RANK.dev) continue;
      const gd = (groups || {})[g] || { hu: g, en: g, subs: {} };
      const node = { label: gd.hu, en: gd.en, children: [] };
      if (g === 'fejlesztes') {
        for (const r of list.filter(i => i.type === 'category')) {
          const kids = list.filter(i => i.parent === r.id).map(i => {
            const sub = list.filter(x => x.parent === i.id && x.group === 'fejlesztes');
            return sub.length ? { label: i.hu, en: i.en, children: [leaf(i)].concat(sub.map(leaf)) } : leaf(i);
          });
          if (kids.length) node.children.push({ label: r.hu, en: r.en, children: kids });
        }
      } else {
        const items = byGroup(g).filter(i => g !== 'rendszer' || !['desktop'].includes(i.id));
        const subs = Object.keys(gd.subs || {});
        if (subs.length) {
          for (const s of subs) { const k = items.filter(i => i.sub === s); if (k.length) node.children.push({ label: gd.subs[s], children: k.map(leaf) }); }
          for (const i of items.filter(i => !i.sub || !subs.includes(i.sub))) node.children.push(leaf(i));
        } else node.children = items.map(leaf);
        if (g === 'rendszer') node.children.push({ label: 'Szint', en: 'Level', children: LEVELS.map(lv => ({ id: 'lvl:' + lv, label: { user: 'Felhasználó', dev: 'Fejlesztő', all: 'Minden' }[lv], en: lv, kind: 'cmd', stay: true })) });
      }
      if (node.children.length) root.children.push(node);
    }
    return root;
  }
  // every leaf with its breadcrumb, for type-to-search
  function leaves(tree) {
    const out = [];
    const walk = (n, trail) => { for (const c of n.children || []) { if (c.children) walk(c, trail.concat(c.label)); else out.push({ ...c, trail }); } };
    walk(tree, []);
    return out;
  }

  // ------------------------------------------------------------ ◢ the Rétegverem dial: one row per layer, then the pages
  function stackDial(list) {
    const rows = [];
    for (const L of LAYERS) { const i = list.find(x => x.surfaces && x.surfaces.stack === L); if (i) rows.push({ id: i.id, label: i.hu, en: i.en, icon: L, kind: 'item', layer: L, opens: i.opens !== false }); }
    for (const id of STACK_PAGES) { const i = list.find(x => x.id === id); if (i) rows.push({ id: i.id, label: i.hu, en: i.en, icon: i.icon || '', kind: 'item', opens: i.opens !== false }); }
    return { label: 'RÉTEGVEREM', en: 'VRG Stack', children: rows };
  }

  // ------------------------------------------------------------ dock and top strip
  // pinned = the user's list (setting desk.dock) or null = the catalog's surfaces.dock; running = [{ pane, kind, label }] from the layout
  function dock(list, level, pinned, running) {
    const known = new Map(list.map(i => [i.id, i]));
    const base = Array.isArray(pinned) ? pinned.filter(id => known.has(id)) : list.filter(i => i.surfaces && i.surfaces.dock).map(i => i.id);
    const user = base.filter(id => known.get(id).level === 'user').slice(0, MAX_DOCK);
    const dev = RANK[level] >= RANK.dev ? base.filter(id => known.get(id).level !== 'user').slice(0, MAX_DOCK) : [];
    return { pinned: user, dev, running: Array.isArray(running) ? running.slice(0, 20) : [] };
  }
  function topChoices(list) {
    return Object.keys(WIDGETS).map(id => ({ id, hu: WIDGETS[id].hu, en: WIDGETS[id].en, widget: true }))
      .concat(list.filter(i => i.surfaces && i.surfaces.top).map(i => ({ id: i.id, hu: i.hu, en: i.en, widget: false })));
  }
  function topStrip(list, chosen) {
    const avail = new Map(topChoices(list).map(c => [c.id, c]));
    const ids = (Array.isArray(chosen) ? chosen : DEFAULT_TOP).filter((id, n, a) => avail.has(id) && a.indexOf(id) === n).slice(0, MAX_TOP);
    return ids.map(id => avail.get(id));
  }
  const validTop = v => Array.isArray(v) && v.length <= MAX_TOP && v.every(x => typeof x === 'string' && /^[a-z0-9:.-]{1,60}$/.test(x));
  const validDock = v => v === null || (Array.isArray(v) && v.length <= MAX_DOCK * 2 && v.every(x => typeof x === 'string' && /^[a-z0-9:.-]{1,60}$/.test(x)));

  return {
    LEVELS, RANK, VIEWS, LAYERS, WIDGETS, DEFAULT_TOP, DEFAULT_TOGGLE, GROUP_ORDER, EDITABLE_PROBE, TAB_WORLD, TAB_RECORDER, TAB_READ, readPair,
    toggleSpec, createDoubleTap, boot, nextBoot, sections, attached, suiTree, leaves, stackDial, dock, topChoices, topStrip, validTop, validDock,
  };
});
