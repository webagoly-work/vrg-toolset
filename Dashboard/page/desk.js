// desk.js — the VRG Asztal's primary views in the frame page (WP-41 Dashboard view + level switch + toggle, WP-42 Desktop view, WP-43 boot).
// Loaded after frame.js. Data: vrg.desktop.catalog(level) (the catalog, level-filtered, with what hangs behind each item),
// window.VRG_DASH (../dashboard-data.js: the Kezdőlap's D0–D4 data, reused), vrg.ports(). Opening anything sends a catalog id
// (vrg.desktop.open) or an act id the registry already hands out (vrg.act); never a path (CONTRACT §3).
//   window.VRGDesk = { view(), setView(v), level(), setLevel(lv), toggle(), open(id), sui, stack, render(), state() }
(function () {
  'use strict';
  const vrg = window.vrg;
  const D = window.VRGDeskLib;
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
  const LV_HU = { user: 'Felhasználó', dev: 'Fejlesztő', all: 'Minden' };
  const LV_EN = { user: 'User', dev: 'Dev', all: 'All' };
  const PANE_HU = { home: 'Kezdőlap', empty: 'Üres', files: 'Fájlok', term: 'Terminál', web: 'Böngésző', mail: 'Posta', stack: 'Kontextuscsomag', chat: 'Claude', note: 'Jegyzet', git: 'Git', feed: 'Hírfolyam', app: 'Alkalmazás' };

  const S = { level: 'user', view: 'dashboard', top: null, dock: null, auth: false, toggle: D.DEFAULT_TOGGLE, items: [], groups: {}, sections: {}, ports: {}, ready: false, wsShown: false };
  const byId = id => S.items.find(i => i.id === id) || null;
  const data = () => window.VRG_DASH || {};
  const toast = (ok, hu, en) => { if (window.VRGToasts) window.VRGToasts.toast({ ok, hu, en: en || hu }); };
  const call = (fn, p) => (vrg && vrg.call ? vrg.call('desktop', fn, p || {}) : Promise.resolve({ ok: false }));
  const setting = (k, v) => (vrg && vrg.call ? vrg.call('app', 'setting', v === undefined ? { k } : { k, v }) : Promise.resolve({}));
  const relayout = () => window.dispatchEvent(new Event('resize'));          // the frame re-reports the view rects (hidden ancestors → 0)

  // ------------------------------------------------------------ the DOM the frame page provides (vrg-desktop.html)
  const stage = $('#stage'), dash = $('[data-role="dashboard"]'), desk = $('[data-role="desktop"]'), ws = $('[data-role="workspace"]');
  const root = $('#root'), ground = $('[data-role="ground"]'), top = $('[data-role="topstrip"]'), dockEl = $('[data-role="dock"]');
  const bootEl = $('[data-role="boot"]');

  // ------------------------------------------------------------ views, level, toggle
  function setView(v, o) {
    if (!D.VIEWS.includes(v)) return S.view;
    S.view = v;
    dash.hidden = v !== 'dashboard';
    desk.hidden = v !== 'desktop';
    document.body.dataset.view = v;
    const t = $('[data-role="view-toggle"]');
    if (t) { t.textContent = v === 'dashboard' ? '⊞' : '▤'; t.title = v === 'dashboard' ? 'Asztal nézet (dupla Tab) / Desktop view' : 'Irányítópult nézet (dupla Tab) / Dashboard view'; }
    if (!(o && o.nosave)) setting('desk.view', v);
    if (S.sui) S.sui.close();
    if (S.stack) S.stack.close();
    relayout();
    return v;
  }
  const toggle = () => setView(S.view === 'dashboard' ? 'desktop' : 'dashboard');
  async function setLevel(lv) {
    if (!D.LEVELS.includes(lv)) return S.level;
    S.level = lv;
    await setting('desk.level', lv);
    await loadCatalog();
    render();
    return lv;
  }
  async function loadCatalog() {
    const r = await call('catalog', { level: S.level });
    if (r && r.ok !== false) { S.items = r.items || []; S.groups = r.groups || {}; S.sections = r.sections || {}; }
    document.body.dataset.level = S.level;
  }
  function levelControl() {
    return h('span', { 'data-role': 'level', title: 'Szint / Level' }, D.LEVELS.map(lv =>
      h('button', { type: 'button', 'data-level': lv, 'aria-pressed': String(lv === S.level), title: LV_EN[lv], onclick: e => { e.stopPropagation(); setLevel(lv); } }, LV_HU[lv])));
  }

  // ------------------------------------------------------------ opening: a catalog id → what main says to do
  function showWindows(on) {
    S.wsShown = !!on;
    root.hidden = !on;
    ground.hidden = !!on;
    relayout();
    drawDock();
  }
  async function openItem(id) {
    if (typeof id !== 'string' || !id) return false;
    const r = await call('open', { id });
    if (!r || r.ok === false) { toast(false, (r && r.hu) || 'Nem nyitható meg.', 'Cannot open.'); return false; }
    return applyOpen(r);
  }
  async function applyOpen(r) {
    const F = window.VRGFrame;
    switch (r.do) {
      case 'view': setView(r.view); if (r.section) { const s = document.getElementById('sec-' + r.section); if (s) s.scrollIntoView(); } return true;
      case 'frame':
        if (r.frame === 'palette' && window.VRGPalette) window.VRGPalette.open();
        else if (r.frame === 'quick' && window.VRGQuickBar) window.VRGQuickBar.open();
        else if (r.frame === 'search' && F) F.search('');
        else if (r.frame === 'workspaces' && F) { setView('desktop'); showWindows(true); F.workspaces(); }
        else if (r.frame === 'note' && F) F.note({});
        else if (r.frame === 'settings') openSettings();
        return true;
      case 'start': toast(false, 'Ez a START-ban fut (' + r.key + ').', 'This one runs in START (' + r.key + ').'); return false;
      case 'done': toast(r.result && r.result.ok !== false, (r.result && r.result.hu) || 'Elindítva.', (r.result && r.result.en) || 'Started.'); return true;
    }
    setView('desktop');
    showWindows(true);
    if (r.do === 'pane' && F) { const ex = F.panes().find(p => (F.kindOf ? F.kindOf(p) : '') === r.kind); if (ex && F.focus && ['files', 'git', 'mail', 'feed', 'chat'].includes(r.kind)) F.focus(ex); else F.open(r.kind, {}); return true; }
    if (r.do === 'web' && F) return F.openUrl(r.url);
    if (r.do === 'app' && F) {
      const ex = F.panes().find(p => F.kindOf && F.kindOf(p) === 'app' && (F.stateOf(p) || {}).id === r.id);
      if (ex) F.focus(ex); else F.open('app', { id: r.id, title: r.title || r.id });
      return true;
    }
    return false;
  }
  async function openServer(id) {                                       // a registry server in the browser pane, started if it is down
    const r = await call('server', { id });
    if (!r || r.ok === false) { toast(false, (r && r.hu) || 'A szerver nem indult.', 'The server did not start.'); return false; }
    return applyOpen(r);
  }
  async function runAct(act) {
    if (!vrg || typeof act !== 'string') return;
    const r = await vrg.act(act);
    if (r && r.hu) toast(r.ok !== false, r.hu, r.en);
  }

  // ------------------------------------------------------------ Irányítópult nézet
  function tile(it) {
    const att = D.attached(it, S.items, S.level);
    const t = h('div', { class: 'tile', 'data-id': it.id, 'data-level': it.level, 'data-role': 'tile' },
      h('button', { type: 'button', class: 'main', disabled: !it.opens, title: it.en + ' · ' + it.type, onclick: () => openItem(it.id) },
        h('span', { class: 'mono' }, it.icon || it.hu.slice(0, 2).toUpperCase()),
        h('span', {}, h('span', { class: 't' }, it.hu, it.status !== 'live' ? h('span', { class: 'st' }, it.status) : null), h('span', { class: 'ty' }, it.label || it.type))));
    const rows = [];
    for (const cid of att.items) { const c = byId(cid); if (c) rows.push(h('button', { type: 'button', 'data-child': cid, title: c.en, onclick: () => openItem(cid) }, c.hu, h('span', { class: 'k' }, c.level))); }
    for (const a of att.acts) rows.push(h('button', { type: 'button', 'data-act': a.act, title: a.hint || '', onclick: () => runAct(a.act) }, a.hu, h('span', { class: 'k' }, a.act.replace(/^s:/, 'START '))));
    for (const s of att.servers) rows.push(h('button', { type: 'button', 'data-server': s.id, onclick: () => openServer(s.id) }, s.name, h('span', { class: 'k' + (S.ports[s.port] ? ' up' : '') }, ':' + s.port)));
    if (rows.length) t.append(h('div', { class: 'att', 'data-role': 'attached' }, rows));
    return t;
  }
  const tiles = ids => h('div', { class: 'tiles' }, ids.map(byId).filter(Boolean).map(tile));
  const empty = (hu, en) => h('div', { class: 'empty', title: en }, hu);

  function secMa() {
    const d = data(), out = [];
    const waiting = (d.lines || []).filter(l => l.status === 'waiting').slice(0, 6);
    out.push(h('div', { class: 'dash-grp' }, 'Rád vár'));
    out.push(h('div', { class: 'rows', 'data-role': 'waiting' }, waiting.length ? waiting.map(l =>
      h('button', { type: 'button', title: l.brief || '', onclick: () => (l.contAct ? runAct(l.contAct) : l.act ? runAct(l.act) : null) },
        h('span', { class: 'c' }, l.name), h('span', { class: 'd' }, l.nextStep || ''), h('span', { class: 'd' }, (l.quietDays ? l.quietDays + ' napja' : '') + (l.contAct ? ' ▶' : '')))) : [empty('Semmi nem vár rád.', 'Nothing is waiting.')]));
    const b = (d.stats && d.stats.backup) || null;
    const u = (d.stats && d.stats.git && d.stats.git.uncommitted) || 0;
    out.push(h('div', { class: 'kpis', style: 'margin-top:8px' },
      h('div', { class: 'kpi' }, h('div', { class: 'n' }, String((d.jobs || []).length)), h('div', { class: 'l' }, 'nyitott munka · open jobs')),
      h('div', { class: 'kpi' }, h('div', { class: 'n' }, b ? b.age + ' n' : '—'), h('div', { class: 'l' }, 'az utolsó mentés óta · since backup')),
      h('div', { class: 'kpi' }, h('div', { class: 'n' }, String(u)), h('div', { class: 'l' }, 'nem commitolt fájl · uncommitted')),
      h('div', { class: 'kpi' }, h('div', { class: 'n' }, String((d.servers || []).filter(s => S.ports[s.port]).length) + ' / ' + (d.servers || []).length), h('div', { class: 'l' }, 'szerver fut · servers up'))));
    const feeds = S.items.filter(i => i.surfaces && i.surfaces.dashboard === 'ma');
    if (feeds.length) out.push(h('div', { class: 'dash-grp' }, 'Hírfolyam'), tiles(feeds.map(i => i.id)));
    return out;
  }
  function secApps(sec) {
    return sec.groups.map(g => [h('div', { class: 'dash-grp' }, (S.groups[g.group] || {}).hu + (g.sub ? ' · ' + g.hu : '')), tiles(g.items)]).flat();
  }
  function secMunkak(sec) {
    const jobs = data().jobs || [];
    const STEP = ['intake', 'funnel', 'plan', 'price', 'doc', 'delivered'];
    const rows = jobs.map(j => h('button', { type: 'button', title: 'Munka megnyitása / Open job', onclick: () => j.act && runAct(j.act) },
      h('span', { class: 'c' }, j.code), h('span', { class: 'steps', title: STEP.join(' · ') }, STEP.map(s => h('i', { class: j.has && j.has[s] ? 'on' : '' }))),
      h('span', { class: 'd' }, j.lastChange || '')));
    return [h('div', { class: 'rows', 'data-role': 'job-list' }, rows.length ? rows : [empty('Nincs nyitott munka.', 'No open jobs.')]), sec.items.length ? tiles(sec.items) : null];
  }
  function secAllapot(sec) {
    const d = data(), st = d.stats || {}, b = st.backup || {}, g = st.git || {};
    const disks = (st.disks || []).map(x => h('div', { class: 'kpi' }, h('div', { class: 'n' }, Math.round(x.free / 1e9) + ' GB'), h('div', { class: 'l' }, x.drive + ' szabad · free')));
    return [h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('div', { class: 'n' }, b.ok === false ? 'HIBA' : b.when ? b.when.slice(5, 16) : '—'), h('div', { class: 'l' }, 'utolsó mentés · last backup')),
      h('div', { class: 'kpi' }, h('div', { class: 'n', style: 'font-size:14px' }, g.branch || '—'), h('div', { class: 'l' }, 'ág · branch')),
      disks), sec.items.length ? tiles(sec.items) : null];
  }
  function secVonalak(sec) {
    const lines = (data().lines || []).filter(l => ['active', 'waiting'].includes(l.status));
    return [h('div', { class: 'rows', 'data-role': 'lines' }, lines.length ? lines.map(l => h('button', { type: 'button', title: l.brief || '', onclick: () => (l.contAct ? runAct(l.contAct) : l.act && runAct(l.act)) },
      h('span', { class: 'c' }, l.name), h('span', { class: 'd' }, l.nextStep || ''), h('span', { class: 'd' }, l.status + (l.contAct ? ' ▶' : '')))) : [empty('Nincs aktív vonal.', 'No active lines.')]),
      h('div', { class: 'dash-grp' }, 'GO kódszavak'), h('div', { class: 'rows' }, (data().go || []).map(g => h('button', { type: 'button', onclick: () => g.act && runAct(g.act) }, h('span', { class: 'c' }, 'GO ' + g.name), h('span', { class: 'd' }, g.title || ''), h('span', { class: 'd' }, '▶')))),
      sec.items.length ? tiles(sec.items) : null];
  }
  function secSzerverek(sec) {
    const sv = data().servers || [];
    return [h('div', { class: 'rows', 'data-role': 'servers' }, sv.map(s => h('button', { type: 'button', 'data-server': s.id, onclick: () => openServer(s.id) },
      h('span', { class: 'c' }, ':' + s.port), h('span', {}, s.name), h('span', { class: 'd', 'data-up': S.ports[s.port] ? '1' : '0' }, S.ports[s.port] ? 'fut' : 'áll')))), sec.items.length ? tiles(sec.items) : null];
  }
  function secMeroszamok(sec) {
    const st = data().stats || {};
    const bars = (weeks, label) => { const mx = Math.max(1, ...(weeks || []).map(w => w.n)); return [h('div', { class: 'dash-grp' }, label), h('div', { class: 'bars' }, (weeks || []).map(w => h('div', { title: w.label + ': ' + w.n }, h('i', { style: 'height:' + Math.round(70 * w.n / mx) + 'px' }), h('span', {}, w.label.slice(3)))))]; };
    const tiers = st.tiers || {};
    return [h('div', { class: 'kpis' }, Object.keys(tiers).map(k => h('div', { class: 'kpi' }, h('div', { class: 'n' }, String(tiers[k])), h('div', { class: 'l' }, 'szint ' + k + ' · tier ' + k)))),
      ...bars(st.git && st.git.weeks, 'Commitok hetente'), ...bars(st.sessions && st.sessions.weeks, 'Munkamenetek hetente'), sec.items.length ? tiles(sec.items) : null];
  }
  function secKatalogus() {
    const inp = h('input', { type: 'search', 'data-role': 'catalog-filter', placeholder: 'Szűrés… / Filter' });
    const tb = h('tbody');
    const draw = () => {
      const q = inp.value.trim();
      const rows = q && window.VRGPaletteLib ? window.VRGPaletteLib.search(S.items.map(i => ({ ...i, hu: i.hu + ' ' + i.id + ' ' + i.type + ' ' + (i.qualifier || ''), en: i.en })), q).map(x => byId(x.id)) : S.items;
      tb.textContent = '';
      for (const i of rows) tb.append(h('tr', { 'data-id': i.id, 'data-open': i.opens ? '1' : '', onclick: () => i.opens && openItem(i.id) },
        h('td', {}, i.hu), h('td', {}, i.label || i.type), h('td', { class: 'lv' }, i.level), h('td', { class: 'lv' }, i.parent), h('td', { class: 'lv' }, i.status), h('td', { class: 'lv' }, i.id)));
    };
    inp.addEventListener('input', draw);
    draw();
    return [inp, h('table', { class: 'cat' }, h('thead', {}, h('tr', {}, ['Név', 'Típus', 'Szint', 'Szülő', 'Állapot', 'Azonosító'].map(x => h('th', {}, x)))), tb)];
  }
  // ------------------------------------------------------------ Programok (WP-45): ghosts to tick and install, solid icons to start
  // The list comes from vrg.programs.list(level) (launcher/programs.json + the ServiceKit catalog). Installing makes one job per
  // program in main; its jobs.update events move the bar on that ghost and the list is re-read when one finishes.
  const PG = { items: [], sel: new Set(), jobs: new Map(), prog: {}, q: '', box: null, wired: false };
  const pcall = (fn, p) => (vrg && vrg.call ? vrg.call('programs', fn, p || {}) : Promise.resolve({ ok: false }));
  function wirePrograms() {
    if (PG.wired || !vrg || !vrg.on) return;
    PG.wired = true;
    vrg.on('jobs', 'update', m => {
      if (m.kind !== 'program') return;
      const id = PG.jobs.get(m.job); if (!id) return;
      PG.prog[id] = { state: m.state, done: m.done, total: m.total, hu: m.hu, err: m.err };
      if (['done', 'failed', 'cancelled'].includes(m.state)) {
        PG.jobs.delete(m.job);                                          // the toast itself comes from toasts.js, as for every job
        loadPrograms();
      } else drawPrograms();
    });
  }
  async function loadPrograms() {
    const r = await pcall('list', { level: S.level });
    if (r && r.ok !== false) {
      PG.items = r.programs || [];
      for (const p of PG.items) if (p.job && !PG.jobs.has(p.job)) PG.jobs.set(p.job, p.id);
      for (const id of [...PG.sel]) { const p = PG.items.find(x => x.id === id); if (!p || p.installed || p.mode !== 'install') PG.sel.delete(id); }
      for (const id of Object.keys(PG.prog)) { const p = PG.items.find(x => x.id === id); if (!p || !p.job) delete PG.prog[id]; }
    }
    drawPrograms();
  }
  async function installSelected() {
    const ids = [...PG.sel];
    if (!ids.length) return;
    const r = await pcall('install', { ids });
    if (!r || r.ok === false) { toast(false, (r && r.hu) || 'A telepítés nem indult.', 'Install did not start.'); return; }
    for (const s of r.started || []) { PG.jobs.set(s.job, s.id); PG.prog[s.id] = { state: 'queued', done: 0, total: 0, hu: 'sorban áll' }; PG.sel.delete(s.id); }
    if ((r.skipped || []).length) toast(false, r.skipped.length + ' kihagyva (' + r.skipped.map(s => s.id).join(', ') + ')', 'Skipped.');
    drawPrograms();
  }
  async function progAction(fn, id) {
    const r = await pcall(fn, { id });
    if (r && r.hu) toast(r.ok !== false, r.hu, r.en);
  }
  function progCard(p) {
    const busy = PG.prog[p.id] && !['done', 'failed', 'cancelled'].includes(PG.prog[p.id].state);
    const st = p.installed ? 'installed' : busy ? 'busy' : p.mode === 'page' ? 'page' : 'ghost';
    const sel = PG.sel.has(p.id);
    const tip = (p.desc.hu || p.name) + (p.sizeMB ? ' · ~' + p.sizeMB + ' MB' : '') + (p.version ? ' · ' + p.version : '');
    const click = () => {
      if (st === 'installed') return progAction('launch', p.id);
      if (st === 'ghost') { if (sel) PG.sel.delete(p.id); else PG.sel.add(p.id); drawPrograms(); }
      if (st === 'page') return progAction('page', p.id);
    };
    const kids = [h('button', { type: 'button', class: 'pm', title: tip, 'aria-pressed': st === 'ghost' ? String(sel) : null, onclick: click },
      h('span', { class: 'mono' }, p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??'),
      h('span', { class: 't' }, p.name),
      h('span', { class: 'ty' }, st === 'installed' ? 'indítás' : st === 'busy' ? (PG.prog[p.id].hu || '').replace(/^.*· /, '') : st === 'page' ? (p.hasPage ? 'letöltő oldal ↗' : 'kézi telepítés') : (sel ? '✓ kijelölve' : 'telepíthető') + (p.sizeMB ? ' · ' + p.sizeMB + ' MB' : '')))];
    if (st === 'busy') { const g = PG.prog[p.id]; kids.push(h('i', { class: 'bar', style: 'width:' + (g.total ? Math.round(100 * g.done / g.total) : 8) + '%' })); }
    if (st === 'installed') kids.push(h('button', { type: 'button', class: 'pf', title: 'Mappa megnyitása / Open folder', onclick: e => { e.stopPropagation(); progAction('folder', p.id); } }, '▤'));
    return h('div', { class: 'prog', 'data-prog': p.id, 'data-state': st, 'data-level': p.level, 'data-selected': sel ? '1' : '' }, kids);
  }
  function drawPrograms() {
    const box = PG.box; if (!box || !box.isConnected) return;
    const q = PG.q.trim().toLowerCase();
    const items = q ? PG.items.filter(p => (p.name + ' ' + p.id + ' ' + p.catHu + ' ' + p.desc.hu + ' ' + p.desc.en).toLowerCase().includes(q)) : PG.items;
    const inst = PG.items.filter(p => p.installed).length;
    const free = PG.items.filter(p => !p.installed && p.mode === 'install');
    const head = h('div', { class: 'prog-head', 'data-role': 'prog-head' },
      h('span', { class: 'sub' }, inst + ' telepítve · ' + (PG.items.length - inst) + ' elérhető'),
      h('input', { type: 'search', 'data-role': 'prog-filter', placeholder: 'Szűrés… / Filter', value: PG.q, oninput: e => { PG.q = e.target.value; drawPrograms(); const f = PG.box.querySelector('[data-role="prog-filter"]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } } }),
      h('span', { class: 'sp' }),
      h('button', { type: 'button', 'data-role': 'prog-all', disabled: !free.length, onclick: () => { for (const p of items) if (!p.installed && p.mode === 'install' && !PG.prog[p.id]) PG.sel.add(p.id); drawPrograms(); } }, 'Mind kijelölése'),
      h('button', { type: 'button', 'data-role': 'prog-none', disabled: !PG.sel.size, onclick: () => { PG.sel.clear(); drawPrograms(); } }, 'Törlés'),
      h('button', { type: 'button', class: 'go', 'data-role': 'prog-install', disabled: !PG.sel.size, onclick: installSelected }, 'Telepítés (' + PG.sel.size + ')'));
    const groups = [];
    let cur = null;
    for (const p of items) { if (!cur || cur.cat !== p.cat) { cur = { cat: p.cat, hu: p.catHu, items: [] }; groups.push(cur); } cur.items.push(p); }
    box.textContent = '';
    box.append(head, ...(groups.length ? groups.map(g => [h('div', { class: 'dash-grp' }, g.hu), h('div', { class: 'progs' }, g.items.map(progCard))]).flat()
      : [empty(PG.items.length ? 'Nincs találat.' : 'Nincs program a listában.', 'Nothing here.')]));
  }
  function secProgramok() {
    wirePrograms();
    PG.box = h('div', { 'data-role': 'programs' });
    drawPrograms();
    loadPrograms();
    return [PG.box];
  }

  // ------------------------------------------------------------ Archívum (WP-47): the Artifact Archive, VRG first, newest first
  // vrg.archive.list() reads Archive/index.json in main; a card opens the archive app at that entry (archive.show → #<id>), ▶ runs the
  // page itself; Hozzáadás asks main for a file dialog (the page never names a path) with the note typed here.
  const AR = { items: [], scope: 'vrg', q: '', form: false, box: null };
  const KIND_HU = { tool: 'eszköz', explainer: 'magyarázó', mockup: 'látványterv', board: 'tábla', game: 'játék', manual: 'kézikönyv', study: 'tanulmány', dashboard: 'irányítópult', design: 'dizájn' };
  const acall = (fn, p) => (vrg && vrg.call ? vrg.call('archive', fn, p || {}) : Promise.resolve({ ok: false }));
  async function loadArchive() {
    const r = await acall('list');
    AR.items = r && r.ok !== false ? r.items || [] : [];
    AR.err = r && r.ok === false ? r.hu : '';
    drawArchive();
  }
  async function showArchived(id, run) {
    const r = await acall('show', run ? { id, run: true } : { id });
    if (!r || r.ok === false) { toast(false, (r && r.hu) || 'Nem nyitható meg.', 'Cannot open.'); return; }
    openItem('archive');
  }
  function archiveForm() {
    const f = h('form', { class: 'arch-form', 'data-role': 'arch-form', onsubmit: async e => {
      e.preventDefault();
      const v = n => (f.elements[n].value || '').trim();
      const meta = { title: v('title'), group: v('group'), kind: v('kind'), vrg: f.elements.vrg.checked, url: v('url'), purpose: v('purpose'), summary: v('summary'),
        context: v('context').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6), tags: v('tags').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12) };
      for (const k of Object.keys(meta)) if (meta[k] === '' || (Array.isArray(meta[k]) && !meta[k].length)) delete meta[k];
      const r = await acall('add', { meta });
      if (!r || r.ok === false) { if (!r || r.err !== 'cancelled') toast(false, (r && r.hu) || 'Nem sikerült.', 'Not added.'); return; }
      toast(true, r.hu, 'Archived.');
      AR.form = false;
      await loadArchive();
      showArchived(r.id);
    } },
      h('label', {}, 'Cím', h('input', { name: 'title', maxlength: 200, placeholder: 'üresen: a lap <title>-je' })),
      h('label', {}, 'Csoport', h('input', { name: 'group', maxlength: 60, placeholder: 'pl. VRG core, BRIDGE' })),
      h('label', {}, 'Fajta', h('select', { name: 'kind' }, Object.keys(KIND_HU).map(k => h('option', { value: k }, KIND_HU[k])))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'vrg', checked: true }), 'VRG-hez tartozik'),
      h('label', { class: 'wide' }, 'claude.ai link', h('input', { name: 'url', maxlength: 120, placeholder: 'https://claude.ai/artifact/…' })),
      h('label', { class: 'wide' }, 'Mi ez (1–2 mondat)', h('textarea', { name: 'summary', maxlength: 1000, rows: 2 })),
      h('label', { class: 'wide' }, 'Miért készült', h('textarea', { name: 'purpose', maxlength: 600, rows: 2 })),
      h('label', { class: 'wide' }, 'Mi zajlott akkor (soronként egy)', h('textarea', { name: 'context', rows: 3 })),
      h('label', { class: 'wide' }, 'Címkék (vesszővel)', h('input', { name: 'tags' })),
      h('div', { class: 'wide fa' }, h('button', { type: 'submit', class: 'go' }, 'Fájl kiválasztása és mentés…'), h('button', { type: 'button', onclick: () => { AR.form = false; drawArchive(); } }, 'Mégse')));
    return f;
  }
  function drawArchive() {
    const box = AR.box; if (!box || !box.isConnected) return;
    const q = AR.q.trim().toLowerCase();
    const all = AR.items;
    const items = all.filter(i => (AR.scope === 'all' || (AR.scope === 'vrg') === !!i.vrg) && (!q || (i.title + ' ' + i.group + ' ' + i.summary).toLowerCase().includes(q)));
    const nv = all.filter(i => i.vrg).length;
    const seg = (k, t) => h('button', { type: 'button', 'data-scope': k, 'aria-pressed': String(AR.scope === k), onclick: () => { AR.scope = k; drawArchive(); } }, t);
    const head = h('div', { class: 'prog-head', 'data-role': 'arch-head' },
      h('span', { class: 'sub' }, all.length + ' oldal · ' + nv + ' VRG · ' + (all.length - nv) + ' egyéb'),
      h('span', { class: 'arch-seg' }, seg('vrg', 'VRG'), seg('other', 'Egyéb'), seg('all', 'Mind')),
      h('input', { type: 'search', 'data-role': 'arch-filter', placeholder: 'Szűrés… / Filter', value: AR.q, oninput: e => { AR.q = e.target.value; drawArchive(); const f = AR.box.querySelector('[data-role="arch-filter"]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } } }),
      h('span', { class: 'sp' }),
      h('button', { type: 'button', 'data-role': 'arch-open', onclick: () => openItem('archive') }, 'Archívum megnyitása'),
      h('button', { type: 'button', class: 'go', 'data-role': 'arch-add', onclick: () => { AR.form = !AR.form; drawArchive(); } }, '＋ Hozzáadás'));
    const card = i => h('div', { class: 'arch' + (i.vrg ? '' : ' o'), 'data-arch': i.id },
      h('button', { type: 'button', class: 'am', title: i.summary || i.title, onclick: () => showArchived(i.id) },
        h('span', { class: 't' }, i.title), h('span', { class: 'ty' }, i.created + ' · ' + [i.group, KIND_HU[i.kind] || i.kind].filter(Boolean).join(' · '))),
      i.saved ? h('button', { type: 'button', class: 'pf', title: 'Megnyitás / Run', onclick: e => { e.stopPropagation(); showArchived(i.id, true); } }, '▶') : null);
    box.textContent = '';
    box.append(head);
    if (AR.form) box.append(archiveForm());
    if (AR.err) { box.append(empty(AR.err, 'The archive could not be read.')); return; }
    const halves = [['VRG', items.filter(i => i.vrg)], ['Egyéb projektek', items.filter(i => !i.vrg)]].filter(x => x[1].length);
    box.append(...(halves.length ? halves.map(([n, l]) => [h('div', { class: 'dash-grp' }, n + ' · ' + l.length), h('div', { class: 'archs' }, l.map(card))]).flat()
      : [empty(all.length ? 'Nincs találat.' : 'Az archívum üres.', 'Nothing here.')]));
  }
  function secArchivum() {
    AR.box = h('div', { 'data-role': 'archive' });
    drawArchive();
    loadArchive();
    return [AR.box];
  }

  const SEC = { ma: secMa, apps: secApps, programok: secProgramok, archivum: secArchivum, munkak: secMunkak, allapot: secAllapot, vonalak: secVonalak, szerverek: secSzerverek, meroszamok: secMeroszamok, katalogus: secKatalogus };

  function renderDashboard() {
    const secs = D.sections(S.items, S.level, S.sections, S.groups);
    const inner = h('div', { class: 'dash-in' },
      h('div', { 'data-role': 'dash-head' }, h('h1', {}, 'Irányítópult'), h('span', { class: 'sub' }, 'VRG Asztal · ' + (data().generated || '')), h('span', { class: 'sp' }),
        levelControl(), h('span', { class: 'sub', title: 'Double Tab: Desktop view' }, 'dupla Tab → Asztal')),
      h('nav', { 'data-role': 'dash-nav' }, secs.map(s => h('a', { href: '#sec-' + s.id, 'data-level': s.level, onclick: e => { e.preventDefault(); document.getElementById('sec-' + s.id).scrollIntoView(); } }, s.hu))),
      secs.map(s => h('section', { class: 'dash-sec', id: 'sec-' + s.id, 'data-section': s.id, 'data-level': s.level },
        h('h2', {}, s.hu, h('span', { class: 'en' }, s.en), s.level !== 'user' ? h('span', { class: 'lv' }, LV_HU[s.level]) : null),
        (SEC[s.id] || (x => (x.items.length ? [tiles(x.items)] : [])))(s))));
    const keep = dash.scrollTop;
    dash.textContent = '';
    dash.append(inner);
    dash.scrollTop = keep;
  }

  // ------------------------------------------------------------ Asztal nézet: top strip, dock, dials
  let clockTimer = 0;
  function ringSvg() {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 20 20'); s.dataset.role = 'ring';
    for (const [r, o] of [[8, 1], [5, .6]]) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '10'); c.setAttribute('cy', '10'); c.setAttribute('r', String(r)); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'currentColor'); c.setAttribute('stroke-opacity', String(o)); s.append(c); }
    return s;
  }
  function widget(c) {
    const d = data(), st = d.stats || {};
    if (!c.widget) return h('button', { type: 'button', 'data-w': c.id, title: c.en, onclick: () => openItem(c.id) }, (byId(c.id) || {}).icon || '', ' ', c.hu);
    switch (c.id) {
      case 'w:clock': { const e = h('span', { 'data-w': c.id, title: c.en }); const tick = () => { const n = new Date(); e.textContent = n.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) + '  ' + n.toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' }); }; tick(); clearInterval(clockTimer); clockTimer = setInterval(tick, 15000); return e; }
      case 'w:search': return h('button', { type: 'button', 'data-w': c.id, title: 'Quick bar', onclick: () => window.VRGQuickBar && window.VRGQuickBar.open() }, '⌕ Keresés');
      case 'w:servers': { const sv = d.servers || [], up = sv.filter(s => S.ports[s.port]).length; return h('button', { type: 'button', 'data-w': c.id, title: c.en, onclick: () => (S.level === 'user' ? setView('dashboard') : openItem('servers')) }, h('i', { class: 'dot' + (up ? ' ok' : '') }), up + '/' + sv.length + ' szerver'); }
      case 'w:git': { const g = st.git || {}; return h('button', { type: 'button', 'data-w': c.id, title: c.en, onclick: () => openItem('git') }, h('i', { class: 'dot' + (g.uncommitted ? ' warn' : ' ok') }), (g.branch || 'git') + (g.uncommitted ? ' · ' + g.uncommitted : '')); }
      case 'w:backup': { const b = st.backup || {}; return h('button', { type: 'button', 'data-w': c.id, title: c.en + (b.when ? ' ' + b.when : ''), onclick: () => openItem('backup') }, h('i', { class: 'dot' + (b.ok === false ? ' crit' : b.age > 7 ? ' warn' : ' ok') }), 'mentés ' + (b.age !== undefined ? b.age + ' n' : '—')); }
      case 'w:ring': return h('button', { type: 'button', 'data-w': c.id, title: c.en, onclick: () => openItem('divergence') }, ringSvg());
      case 'w:level': return h('span', { 'data-w': c.id }, levelControl());
    }
    return h('span', {}, c.hu);
  }
  function drawTop() {
    top.textContent = '';
    for (const c of D.topStrip(S.items, S.top)) top.append(widget(c));
    top.append(h('span', { class: 'sp' }), h('button', { type: 'button', 'data-role': 'customize', title: 'Customise the top strip', onclick: openCustomize }, '⚙ Testreszabás'));
  }
  function running() {
    const F = window.VRGFrame;
    if (!F || !F.panes) return [];
    return F.panes().filter(p => F.kindOf(p) !== 'empty').map(p => {
      const k = F.kindOf(p), st = F.stateOf(p) || {};
      return { pane: p, kind: k, label: k === 'app' ? ((byId(st.id) || {}).hu || st.title || st.id) : PANE_HU[k] || k, app: k === 'app' ? st.id : '' };
    });
  }
  function drawDock() {
    if (!dockEl) return;
    const F = window.VRGFrame, run = running();
    const dk = D.dock(S.items, S.level, S.dock, run);
    const runIds = new Set(run.map(r => r.app).filter(Boolean));
    const btn = id => { const i = byId(id); return i ? h('button', { type: 'button', 'data-id': id, 'data-level': i.level, 'data-running': runIds.has(id) ? '1' : '', title: i.hu + ' / ' + i.en, onclick: () => openItem(id) }, i.icon || i.hu.slice(0, 2)) : null; };
    dockEl.textContent = '';
    dk.pinned.forEach(id => dockEl.append(btn(id)));
    if (dk.dev.length) { dockEl.append(h('span', { class: 'div' })); dk.dev.forEach(id => dockEl.append(btn(id))); }
    if (dk.running.length) {
      dockEl.append(h('span', { class: 'div' }));
      const foc = F && F.focused ? F.focused() : '';
      for (const r of dk.running) dockEl.append(h('button', { type: 'button', class: 'win', 'data-pane': r.pane, 'data-focus': S.wsShown && r.pane === foc ? '1' : '', title: r.label, onclick: () => { setView('desktop'); showWindows(true); F.focus(r.pane); drawDock(); } }, r.label));
    }
    dockEl.append(h('span', { class: 'div' }), h('button', { type: 'button', 'data-role': 'show-desktop', title: S.wsShown ? 'Asztal megjelenítése / Show desktop' : 'Ablakok / Show windows', onclick: () => showWindows(!S.wsShown) }, S.wsShown ? '▁' : '▣'));
  }
  async function pickSui(leaf) {
    if (leaf.kind === 'cmd' && /^lvl:/.test(leaf.id)) { await setLevel(leaf.id.slice(4)); return 'stay'; }
    openItem(leaf.id);
  }
  function drawDials() {
    const tree = D.suiTree(S.items, S.level, S.groups), st = D.stackDial(S.items);
    const cover = on => call('cover', { on: !!on });                       // web / app views are native: hide them while a column is open
    if (!S.sui) S.sui = window.VRGSuiDial.create({ host: desk, side: 'left', tree, label: 'Menü', en: 'Main menu', glyph: '≡', onPick: pickSui, onOpen: v => { if (v && S.stack) S.stack.close(); cover(v || (S.stack && S.stack.isOpen())); }, match: (items, q) => window.VRGPaletteLib ? window.VRGPaletteLib.search(items.map(x => ({ ...x, hu: x.label + ' ' + (x.trail || []).join(' '), en: x.en || '' })), q) : [] });
    else S.sui.setTree(tree);
    if (!S.stack) S.stack = window.VRGSuiDial.create({ host: desk, side: 'right', tree: st, label: 'Rétegverem', en: 'VRG Stack', glyph: '◈', onPick: leaf => openItem(leaf.id), onOpen: v => { if (v && S.sui) S.sui.close(); cover(v || (S.sui && S.sui.isOpen())); } });
    else S.stack.setTree(st);
  }

  // ------------------------------------------------------------ sheets: Testreszabás (top strip), Beállítások
  function sheet(titleHu, titleEn, body, onOk) {
    const old = $('[data-role="sheet"]'); if (old) old.remove();
    call('cover', { on: true });
    const close = () => { box.remove(); call('cover', { on: false }); };
    const box = h('div', { 'data-role': 'sheet', role: 'dialog' }, h('h3', {}, titleHu, h('span', { class: 'en' }, titleEn)), h('div', { class: 'body' }, body),
      h('div', { class: 'foot' }, onOk ? h('button', { type: 'button', 'data-role': 'sheet-ok', onclick: async () => { await onOk(); close(); } }, 'Mentés') : null, h('button', { type: 'button', 'data-role': 'sheet-close', onclick: close }, 'Bezár')));
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.append(box);
    return box;
  }
  function openCustomize() {
    const choices = D.topChoices(S.items);
    let order = D.topStrip(S.items, S.top).map(c => c.id);
    const list = h('div', { 'data-role': 'top-choices' });
    const draw = () => {
      list.textContent = '';
      const rest = choices.filter(c => !order.includes(c.id));
      for (const id of order.concat(rest.map(c => c.id))) {
        const c = choices.find(x => x.id === id), on = order.includes(id), at = order.indexOf(id);
        list.append(h('div', { class: 'row', 'data-choice': id },
          h('label', {}, h('input', { type: 'checkbox', checked: on, onchange: e => { order = e.target.checked ? order.concat(id) : order.filter(x => x !== id); draw(); } }), c.hu, h('span', { class: 'note' }, c.widget ? '' : ' (parancsikon)')),
          h('span', { class: 'sp' }),
          on ? h('button', { type: 'button', title: 'Fel / Up', disabled: at === 0, onclick: () => { order.splice(at - 1, 0, order.splice(at, 1)[0]); draw(); } }, '▲') : null,
          on ? h('button', { type: 'button', title: 'Le / Down', disabled: at === order.length - 1, onclick: () => { order.splice(at + 1, 0, order.splice(at, 1)[0]); draw(); } }, '▼') : null));
      }
    };
    draw();
    sheet('Testreszabás', 'Customise the top strip', [h('div', { class: 'note' }, 'A felső sáv elemei és sorrendje. Felhasználónként mentődik.'), list], async () => {
      S.top = order.slice(0, 12);
      await setting('desk.top', S.top);
      drawTop();
    });
  }
  function openSettings() {
    const lv = h('div', { class: 'row' }, h('span', {}, 'Szint'), h('span', { class: 'sp' }), levelControl());
    const view = h('div', { class: 'row' }, h('span', {}, 'Induló nézet: az utoljára használt'), h('span', { class: 'sp' }), h('span', { class: 'note' }, S.view === 'dashboard' ? 'Irányítópult' : 'Asztal'));
    const auth = h('div', { class: 'row' }, h('span', {}, 'Kapu belépés'), h('span', { class: 'sp' }), h('span', { class: 'note', 'data-role': 'auth-state' }, S.auth ? 'bekapcsolva' : 'kikapcsolva (a Kapu hitelesítése még nem kész)'));
    const tg = h('div', { class: 'row' }, h('span', {}, 'Nézetváltás'), h('span', { class: 'sp' }), h('span', { class: 'note' }, 'dupla ' + S.toggle.key + ' (' + S.toggle.ms + ' ms) · dupla kattintás az üres háttéren · ⊞ a jobb felső sarokban'));
    sheet('Beállítások', 'Settings', [lv, view, auth, tg, h('div', { class: 'note' }, 'A billentyű és az idő: Dashboard/config/keymap.json (desktopToggleKey, desktopToggleMs).')]);
  }

  // ------------------------------------------------------------ render, events, boot
  function render() { renderDashboard(); drawTop(); drawDock(); drawDials(); document.body.dataset.level = S.level; }
  function hookEvents() {
    if (vrg && vrg.on) {
      vrg.on('desktop', 'toggle', () => { if (S.ready) toggle(); });
      vrg.on('desktop', 'link', m => { if (m && typeof m.url === 'string' && window.VRGFrame) { setView('desktop'); showWindows(true); window.VRGFrame.openUrl(m.url); } });
      vrg.on('desktop', 'cmd', m => {
        const c = m && m.cmd;
        if (c === 'toggle') toggle(); else if (c === 'view:dashboard') setView('dashboard'); else if (c === 'view:desktop') setView('desktop');
        else if (typeof c === 'string' && c.startsWith('level:')) setLevel(c.slice(6)); else if (c === 'settings') openSettings(); else if (c === 'customize') openCustomize();
      });
    }
    if (vrg && vrg.onPorts) vrg.onPorts(p => { S.ports = p || {}; if (S.ready) { drawTop(); if (S.view === 'dashboard') renderDashboard(); } });
    const tg = $('[data-role="view-toggle"]'); if (tg) tg.addEventListener('click', toggle);
    // double-click / double-tap on empty background: the Desktop ground, or the Dashboard's page margin
    ws.addEventListener('dblclick', e => { if (!S.wsShown || e.target === ws) toggle(); });
    dash.addEventListener('dblclick', e => { if (e.target === dash || e.target.classList.contains('dash-in') || e.target.classList.contains('dash-sec')) toggle(); });
    // the layout changes (open / close / focus) → the dock's running windows; no panes left → the empty ground; a pane opened from
    // elsewhere (the palette, a hotkey, a link) while it would be hidden → the Desktop view with its windows shown, never an unseen pane
    new MutationObserver(() => { clearTimeout(S.mo); S.mo = setTimeout(() => {
      const now = running(), was = S.panes || new Set();
      S.panes = new Set(now.map(r => r.pane));
      if (S.ready && now.some(r => !was.has(r.pane)) && (S.view !== 'desktop' || !S.wsShown)) { setView('desktop'); showWindows(true); return; }
      if (S.wsShown && !now.length) showWindows(false);
      drawDock();
    }, 120); })
      .observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-focus', 'data-active'] });
    // double Tab in the frame page itself (main watches the other views): decided before Tab moves the focus, so a text field,
    // a terminal or a contenteditable at either tap keeps its Tab; the second tap is consumed when it toggles
    let tapAt = -Infinity, tapEd = false;
    const takesText = t => !!t && t.nodeType === 1 && (/^(textarea|select)$/i.test(t.tagName) || (/^input$/i.test(t.tagName) && !/^(button|checkbox|radio|range|color|submit|reset|image|file)$/i.test(t.type || 'text')) || t.isContentEditable || !!(t.closest && t.closest('.xterm, [data-kind=term]')));
    document.addEventListener('keydown', e => {
      if (e.key !== S.toggle.key || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) { if (!e.repeat) tapAt = -Infinity; return; }
      if (e.repeat) return;
      const now = performance.now(), ed = takesText(e.target);
      if (now - tapAt <= S.toggle.ms && !ed && !tapEd && S.ready) { e.preventDefault(); tapAt = -Infinity; toggle(); return; }
      tapAt = now; tapEd = ed;
    }, true);
    document.addEventListener('keydown', e => {                       // Esc on the Desktop's own chrome = show the empty desktop
      if (e.key !== 'Escape' || S.view !== 'desktop' || !S.wsShown || e.defaultPrevented) return;
      const t = e.target;
      if (t === document.body || (t.closest && t.closest('[data-role="dock"], [data-role="topstrip"]'))) { showWindows(false); }
    });
  }
  function bootScreen(step) {
    bootEl.hidden = step === 'ready';
    bootEl.dataset.step = step;
    bootEl.textContent = '';
    if (step === 'splash') bootEl.append(h('div', { class: 'mark' }, 'VRG Asztal'), h('div', { class: 'msg' }, 'Indul…', h('span', { class: 'en' }, 'Starting')));
    if (step === 'gate') bootEl.append(h('div', { class: 'mark' }, 'VRG Kapu'),
      h('div', { class: 'msg', 'data-role': 'gate' }, 'A belépés itt lesz: a Kapu hitelesítése még nem kész.', h('span', { class: 'en' }, 'Sign-in goes here; the Kapu authentication is not built yet.')),
      h('button', { type: 'button', 'data-role': 'gate-continue', onclick: () => advance('gate') }, 'TOVÁBB'));
  }
  async function advance(step) {
    const next = D.nextBoot(step, { authEnabled: S.auth });
    bootScreen(next);
    if (next === 'ready') {
      S.ready = true;
      document.body.dataset.boot = 'ready';
      setView(S.view, { nosave: true });
    } else document.body.dataset.boot = next;
  }
  async function boot() {
    bootScreen('splash');
    document.body.dataset.boot = 'splash';
    for (let i = 0; i < 100 && !window.VRGFrame; i++) await new Promise(r => setTimeout(r, 30));
    const st = await call('state', {});
    if (st && st.ok !== false) {
      S.level = D.LEVELS.includes(st.level) ? st.level : 'user';
      S.view = D.VIEWS.includes(st.view) ? st.view : 'dashboard';
      S.top = Array.isArray(st.top) ? st.top : null;
      S.dock = Array.isArray(st.dock) ? st.dock : null;
      S.auth = st.auth === true;
      if (st.toggle) S.toggle = st.toggle;
      S.start = st.start === 'windows' ? 'windows' : '';
      if (S.start) S.view = 'desktop';
    }
    try { S.ports = (vrg && vrg.ports && await vrg.ports()) || {}; } catch (e) {}
    await loadCatalog();
    hookEvents();
    showWindows(S.start === 'windows' || running().some(r => r.kind !== 'home'));
    S.panes = new Set(running().map(r => r.pane));
    render();
    await advance('splash');
  }

  window.VRGDesk = {
    view: () => S.view, setView, level: () => S.level, setLevel, toggle, open: openItem, render, showWindows,
    get sui() { return S.sui; }, get stack() { return S.stack; },
    state: () => ({ view: S.view, level: S.level, items: S.items.length, wsShown: S.wsShown, ready: S.ready, boot: document.body.dataset.boot, auth: S.auth }),
    openSettings, openCustomize, advance,
  };
  if (stage && dash && desk) boot();
})();
