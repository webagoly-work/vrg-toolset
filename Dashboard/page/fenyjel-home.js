// fenyjel-home.js — the VRG Asztal's home in the Fényjel look (shared/fenyjel/DESIGN.md §7.3; rollout R4).
// When ui.look is "fenyjel", desk.js hands the Irányítópult view to this module instead of drawing its sections:
//   rail      the eight function families (a glyph each); picking one filters the grid, ⌂ shows everything
//   main      LED clock and day, the search (the command palette), three continue cards (open jobs, then DevLog lines
//             waiting on you), the program grid: the catalog's items as pixel glyphs with one word
//   console   this PC (vrg desktop.sys: CPU, memory, work drive, uptime), START's servers with start/stop switches, and the
//             last things the shell said (its toasts)
// It draws only; every action goes back through what desk.js passes in (open by catalog id, run an act, a server). The glyphs
// come from shared/fenyjel/icons.js (window.FJIcons). Test: Dashboard/test/wp-58.test.js (every catalog item has a glyph here).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGFenyjelHome = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Catalog id → [glyph, family, one word]. A family colours the glyph and its socket; the word sits under the tile. */
  const GLYPHS = {
    planner: ['planner', 'plan', 'Tervező'], rajztar: ['sketch', 'plan', 'Rajztár'], sketcher: ['sketch', 'plan', 'Vázlat'],
    'sketcher.house3d': ['measure', 'plan', 'Ház 3D'], 'client-preview': ['screen', 'plan', 'Ügyfél'], map: ['map', 'plan', 'Térkép'],
    jobs: ['pcwin', 'plan', 'Munkák'],
    'workflow-kit': ['quote', 'stock', 'Workflow'], 'calc-panel': ['calc', 'stock', 'Panel'], 'calc-general': ['calc', 'stock', 'Kalkulátor'],
    'calc-led': ['calc', 'stock', 'LED'], inventory: ['inventory', 'stock', 'Készlet'], valena: ['inventory', 'stock', 'Valena'],
    buildtree: ['stack', 'stock', 'BuildTree'],
    kisokos: ['catalog', 'know', 'Kisokos'], bridge: ['archive', 'know', 'BRIDGE'], archive: ['archive', 'know', 'Archívum'],
    mindmap: ['sphere', 'know', 'MindMap'], web: ['web', 'know', 'Böngésző'], browser: ['web', 'know', 'VRG Web'],
    'layer.i': ['notes', 'know', 'Ötletek'], 'layer.f': ['stack', 'know', 'Kiemelt'], 'layer.q': ['archive', 'know', 'Döntések'],
    'konnektom-labor': ['net', 'link', 'Konnektóm'], console: ['control', 'link', 'Console'], mobile: ['devices', 'link', 'Mobile'],
    'servicekit-phone': ['devices', 'link', 'SK Phone'], 'servicekit-cyd': ['control', 'link', 'SK CYD'],
    'layer.k': ['city', 'run', 'Kisokos 3D'], openmct: ['radar', 'run', 'Open MCT'], research: ['pulse', 'run', 'Kutatás'],
    mail: ['inbox', 'alert', 'Posta'], feed: ['pager', 'alert', 'Hírek'],
    weather: ['weather', 'env', 'Időjárás'],
    files: ['pcwin', 'sys', 'Fájlok'], servicekit: ['devices', 'sys', 'ServiceKit'], otg: ['devices', 'sys', 'OTG'],
    search: ['search', 'ui', 'Keresés'], 'stack.search': ['search', 'know', 'Verem'],
    // Fejlesztés (shown from the dev level on): code and git run, the agents link, the knowledge maps know, the boards link.
    'rajztar.catalog': ['catalog', 'plan', 'Katalógus'], 'konnektom-labor-cmd': ['terminal', 'link', 'Labor .cmd'],
    term: ['terminal', 'run', 'Terminál'], git: ['git', 'run', 'Git'], vscode: ['devlap', 'run', 'VS Code'], github: ['git', 'run', 'GitHub'],
    commit: ['git', 'run', 'Commit'], gitlog: ['notes', 'run', 'Napló'], 'claude-code': ['claude', 'link', 'Claude'],
    chat: ['claude', 'link', 'Oldalchat'], context: ['stack', 'link', 'Kontextus'], council: ['account', 'link', 'Tanács'],
    prompts: ['notes', 'link', 'Promptok'], go: ['launch', 'run', 'GO'], trace: ['pulse', 'link', 'Nyom'],
    sessions: ['sheets', 'link', 'Munkamenet'], controller: ['control', 'link', 'Vezérlő'], munkavaszon: ['desk', 'link', 'Munkavászon'],
    stack: ['stack', 'know', 'Rétegverem'], 'stack.connectome': ['net', 'know', 'Konnektóm'], 'stack.orb': ['sphere', 'know', 'Holo'],
    'stack.layers': ['stack', 'know', 'Rétegek'], 'layer.l': ['map', 'know', 'Vonalak'], threadboard: ['sheets', 'know', 'Threads'],
    'layer.a': ['control', 'know', 'Irányítás'], 'layer.u': ['pulse', 'know', 'Futásnapló'], 'layer.r': ['git', 'know', 'Commitok'],
    'layer.c': ['city', 'know', 'Kódváros'], 'layer.g': ['sphere', 'know', 'Gömb'], codecity: ['city', 'run', 'Kódváros'],
    solomon: ['sphere', 'run', 'Solomon'], divergence: ['radar', 'alert', 'Divergencia'], devnote: ['fuzet', 'know', 'Jegyzet'],
    docs: ['archive', 'know', 'Dokumentum'], coreref: ['catalog', 'know', 'CoreRef'], start: ['launch', 'sys', 'START'],
    backup: ['vault', 'sys', 'BACKUP'], servers: ['ports', 'sys', 'Szerverek'], check: ['pulse', 'alert', 'Ellenőrzés'],
    'desktop-exe': ['pcwin', 'sys', 'Desktop'], kapu: ['account', 'sys', 'Kapu'], vendor: ['drop', 'sys', 'Vendor'],
    toolbox: ['apps', 'sys', 'Toolbox'], zen: ['web', 'run', 'Zen'], 'planner-cyd': ['control', 'link', 'CYD'],
    'board-console': ['control', 'link', 'Board'], knobpad: ['mouse', 'link', 'Knob Pad'], 'esp-lab': ['devices', 'link', 'ESP labor'],
    uikit: ['apps', 'ui', 'UI Kit'], melyviz: ['drop', 'ui', 'Mélyvíz'], logo: ['tag', 'ui', 'Logó'],
  };
  /** A catalog group's family, for an item without a glyph yet (it shows its monogram in that colour). */
  const GROUP_FAMILY = { munka: 'plan', alkalmazasok: 'run', fajlok: 'sys', rendszer: 'sys', fejlesztes: 'run' };
  const FAMILY_ORDER = ['plan', 'stock', 'link', 'know', 'run', 'alert', 'env', 'sys', 'ui'];
  const RAIL = [['planner', 'plan'], ['inventory', 'stock'], ['mouse', 'link'], ['notes', 'know'], ['launch', 'run'], ['inbox', 'alert'], ['weather', 'env'], ['settings', 'sys']];
  const STEPS = ['intake', 'funnel', 'plan', 'price', 'doc', 'delivered'];
  const DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

  /** The pure part, testable without a page: what the grid shows for the catalog and a family filter. */
  function glyphOf(it) {
    const g = GLYPHS[it.id];
    if (g) return { glyph: g[0], family: g[1], word: g[2] };
    return { glyph: null, family: GROUP_FAMILY[it.group] || 'sys', word: String(it.hu || it.id).split(/\s+/).pop().slice(0, 10) };
  }
  function gridItems(items, family) {
    return (items || [])
      .filter(it => it.opens && it.group !== 'rendszer')
      .map(it => Object.assign({ it }, glyphOf(it)))
      .filter(x => !family || x.family === family)
      .sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));
  }
  /** Up to three continue cards: open jobs first (their step meter), then DevLog lines waiting on you. */
  function continueCards(data) {
    const d = data || {};
    const jobs = (d.jobs || []).map(j => ({ kind: 'job', title: j.code, sub: j.lastChange || 'munka', glyph: 'planner', family: 'plan',
      share: STEPS.filter(s => j.has && j.has[s]).length / STEPS.length, act: j.act }));
    const lines = (d.lines || []).filter(l => l.status === 'waiting').map(l => ({ kind: 'line', title: l.name, sub: l.nextStep || 'vár rád',
      glyph: 'launch', family: 'run', share: null, act: l.contAct || l.act }));
    return jobs.concat(lines).slice(0, 3);
  }
  const pct = v => Math.round(Math.max(0, Math.min(1, v)) * 100) + '%';

  if (typeof document === 'undefined') return { GLYPHS, glyphOf, gridItems, continueCards, FAMILY_ORDER };

  // ---------------------------------------------------------------- the page
  const W = window;
  const S = { family: '', sys: null, timer: 0, clock: 0, log: [], hooked: false, ctx: null, root: null };
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const I = () => W.FJIcons;
  const glyph = (name, fam) => (I() && I().ICONS[name] ? I().svg(name, { colour: I().familyColour(fam) }) : '');
  const digits = t => (I() ? I().digits(t) : t);
  const socket = (name, fam, cls, mono) => h('span', { class: 'fj-socket' + (cls ? ' ' + cls : ''), 'data-fj-family': fam, html: name ? glyph(name, fam) : '' },
    name ? null : h('span', { class: 'fjh-mono' }, mono || '?'));

  // the shell's toasts are the console's log: wrapped once, the last 6 kept
  function hookToasts() {
    if (S.hooked || !W.VRGToasts) return;
    S.hooked = true;
    const orig = W.VRGToasts.toast;
    W.VRGToasts.toast = function (r) {
      try { S.log.push({ at: new Date(), ok: !(r && r.ok === false), hu: (r && (r.hu || r.en)) || '' }); S.log = S.log.slice(-6); drawLog(); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  function rail() {
    const btn = (name, fam, value, label) => h('button', { type: 'button', class: 'fjh-railbtn' + (S.family === value ? ' on' : ''), title: label, 'aria-label': label,
      'aria-pressed': String(S.family === value), onclick: () => { S.family = value; render(S.root, S.ctx); } }, socket(name, fam, 'fj-socket--sm'));
    return h('nav', { class: 'fjh-rail', 'aria-label': 'Családok' },
      btn('home', 'ui', '', 'Minden'),
      h('span', { class: 'fjh-raildiv' }),
      RAIL.map(([g, f]) => btn(g, f, f, (I() && I().FAMILIES[f] ? I().FAMILIES[f].hu : f))));
  }

  function clockRow(ctx) {
    const now = new Date();
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    return h('div', { class: 'fjh-top' },
      h('span', { class: 'fjh-clock', 'data-role': 'fj-clock', html: digits(hm) }),
      h('span', { class: 'fjh-date' }, DAYS[now.getDay()], h('br'), now.getFullYear() + '. ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + '.'),
      h('button', { type: 'button', class: 'fjh-search', onclick: () => ctx.palette() },
        h('span', { class: 'fjh-searchic', html: glyph('search', 'ui') }), 'Keresés programok, munkák, parancsok között', h('kbd', {}, 'Ctrl Shift P')),
      ctx.levelControl ? ctx.levelControl() : null);
  }

  function cards(ctx) {
    const list = continueCards(ctx.data);
    if (!list.length) return h('div', { class: 'fjh-empty' }, 'Nincs folytatható munka.');
    return h('div', { class: 'fjh-recent' }, list.map((c, i) => h('section', {
      class: 'fjh-card fj-plane fj-plane--hue' + (i === 0 ? ' fj-brackets fj-brackets--hue' : ''), 'data-fj-family': c.family },
      h('div', { class: 'fjh-cardtop' }, socket(c.glyph, c.family, 'fj-socket--sm'),
        h('div', { class: 'fjh-tt' }, h('b', { class: 'fj-title' }, c.title), h('span', { class: 'fj-sub' }, c.sub)),
        h('button', { type: 'button', class: 'fj-btn fj-btn--solid fjh-go', disabled: !c.act, onclick: () => c.act && ctx.runAct(c.act) }, 'Folytatás')),
      c.share != null ? h('div', { class: 'fjh-meterrow' }, h('div', { class: 'fj-meter', style: '--v:' + c.share }), h('span', { class: 'fj-num', html: digits(pct(c.share)) })) : null)));
  }

  function grid(ctx) {
    const list = gridItems(ctx.items, S.family);
    if (!list.length) return h('div', { class: 'fjh-empty' }, 'Ebben a családban nincs program ezen a szinten.');
    return h('div', { class: 'fjh-grid' }, list.map(x => h('button', {
      type: 'button', class: 'fj-tile' + (x.it.status && x.it.status !== 'live' ? ' fjh-beta' : ''), 'data-fj-family': x.family, 'data-id': x.it.id,
      title: x.it.hu + ' · ' + (x.it.label || x.it.type || '') + (x.it.status && x.it.status !== 'live' ? ' · ' + x.it.status : ''),
      onclick: () => ctx.open(x.it.id) }, socket(x.glyph, x.family, '', x.it.icon), h('span', {}, x.word))));
  }

  function gauge(name, fam, label, share, warnAt) {
    const warn = share >= warnAt;
    return h('div', { class: 'fjh-gauge', 'data-fj-family': fam, 'aria-label': label + ': ' + pct(share), role: 'img' },
      h('span', { class: 'fjh-gic', html: glyph(name, fam) }),
      h('div', { class: 'fj-meter', 'data-s': warn ? 'warn' : null, style: '--v:' + share }),
      h('span', { class: 'fj-num fjh-gv' + (warn ? ' warn' : ''), html: digits(pct(share)) }));
  }
  const gb = b => (b / 1e9).toFixed(1).replace('.', ',') + ' GB';

  function side(ctx) {
    const s = S.sys;
    const up = s && s.ok;
    const servers = (ctx.data && ctx.data.servers) || [];
    const upCount = servers.filter(v => ctx.ports[v.port]).length;
    return h('aside', { class: 'fjh-side', 'data-fj-family': 'link' },
      h('div', { class: 'fjh-head' }, socket('devices', 'link', 'fj-socket--sm'),
        h('div', { class: 'fjh-tt' }, h('b', { class: 'fj-title' }, up ? s.host : 'Ez a gép'),
          h('span', { class: 'fj-mono' }, h('i', { class: 'fj-led', 'data-s': up ? 'ok' : null }), up ? '  fut ' + uptime(s.uptime) : '  mérés…'))),
      h('section', { class: 'fj-plane fjh-gauges', 'data-role': 'fj-gauges' }, up ? [
        gauge('pulse', 'run', 'Processzor', s.cpu, 0.9),
        gauge('stack', 'know', 'Memória', s.mem.total ? s.mem.used / s.mem.total : 0, 0.85),
        s.disk ? gauge('archive', 'stock', 'Lemez ' + s.disk.root, s.disk.used / s.disk.total, 0.85) : null,
        h('div', { class: 'fj-mono' }, gb(s.mem.used) + ' / ' + gb(s.mem.total) + ' · ' + s.cores + ' mag'),
      ] : h('span', { class: 'fj-sub' }, 'Mérés…')),
      h('section', { class: 'fj-plane fj-plane--flat fjh-srv', 'data-role': 'fj-servers' },
        h('div', { class: 'fjh-srvhead' }, h('span', { class: 'fj-pixel' }, 'Szerverek'), h('span', { class: 'fj-num', html: digits(upCount + '/' + servers.length) })),
        servers.map(v => {
          const on = !!ctx.ports[v.port];
          return h('div', { class: 'fjh-srvrow', 'data-fj-family': 'run' },
            h('i', { class: 'fj-led', 'data-s': on ? 'hue' : null }),
            h('button', { type: 'button', class: 'fjh-srvname', title: 'Megnyitás / Open', onclick: () => ctx.openServer(v.id) }, v.name),
            h('span', { class: 'fj-mono' }, ':' + v.port),
            h('button', { type: 'button', class: 'fj-switch', role: 'switch', 'aria-checked': String(on), 'aria-label': v.name + (on ? ' leállítása' : ' indítása'),
              onclick: () => (on ? ctx.serverStop(v.id) : ctx.serverStart(v.id)) }));
        })),
      h('div', { class: 'fj-console', 'data-fj-family': 'run', 'data-role': 'fj-log' }));
  }
  function uptime(sec) { const m = Math.floor(sec / 60), hh = Math.floor(m / 60), d = Math.floor(hh / 24); return d ? d + ' nap ' + (hh % 24) + ' óra' : hh ? hh + ' óra ' + (m % 60) + ' perc' : m + ' perc'; }

  function drawLog() {
    const el = S.root && S.root.querySelector('[data-role="fj-log"]');
    if (!el) return;
    el.textContent = '';
    S.log.forEach(l => el.append(h('div', {}, h('span', { class: 't' }, String(l.at.getHours()).padStart(2, '0') + ':' + String(l.at.getMinutes()).padStart(2, '0')),
      ' ', h('span', { class: l.ok ? 'ok' : 'w' }, l.ok ? '✓' : '!'), ' ', l.hu)));
    el.append(h('div', {}, h('span', { class: 'h' }, 'vrg>'), ' ', h('span', { class: 'cur' })));
  }

  async function pollSys() {
    const ctx = S.ctx;
    if (!ctx || !S.root || !S.root.isConnected || S.root.hidden) return;
    try { const r = await ctx.sys(); if (r && r.ok) { S.sys = r; const g = S.root.querySelector('.fjh-side'); if (g) g.replaceWith(side(ctx)); drawLog(); } } catch (e) {}
  }

  function render(root, ctx) {
    S.root = root; S.ctx = ctx;
    hookToasts();
    const keep = root.scrollTop;
    root.textContent = '';
    root.append(h('div', { class: 'fjh fj-ground', 'data-fj-family': 'ui' },
      rail(),
      h('main', { class: 'fjh-main' }, clockRow(ctx), cards(ctx), grid(ctx)),
      side(ctx)));
    root.scrollTop = keep;
    drawLog();
    clearInterval(S.timer); clearInterval(S.clock);
    S.timer = setInterval(pollSys, 3000);
    S.clock = setInterval(() => {
      const c = root.querySelector('[data-role="fj-clock"]'); const n = new Date();
      if (c) c.innerHTML = digits(String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'));
    }, 15000);
    if (!S.sys) pollSys();
  }
  function stop() { clearInterval(S.timer); clearInterval(S.clock); }

  return { GLYPHS, glyphOf, gridItems, continueCards, FAMILY_ORDER, render, stop };
});
