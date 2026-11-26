// VRG Stack — N · Belépők (entry points), S11 of research/STRINGS-PLAN.md (§5, STK-Q24: T → N → P → K → J): every
// way to open a thing, as a node. CLAUDE.md: "a tool that is not in launcher/vrg-menu.json does not exist"; with N on
// the stack, a string that reaches C but no N is code nobody can open (DRIFT.md §11).
//
//   layer({ menu, catalog, mobile }) → { nodes, edges }      pure, from the three registries' contents:
//     launcher/vrg-menu.json    every START key (tools, project submenus and their items, dev items), the servers with
//                               their ports, the programs
//     launcher/vrg-catalog.json every unit the VRG Asztal shows, with its launch (a START act, a server, a page)
//                               and its vrg-app:// address when it is an in-shell app
//     Mobile …/core/Feature.kt  every VRG Mobile feature in the Catalogue (vrg://<id>), with its stage
//   A node's text carries its paths resolved into the repo (`{stack}\viewer.html` → `Stack/viewer.html`), so the join
//   links it to the C folder and G document it opens, and a GO phrase in a hint to its A node, with no extra rule.
//   unreachable(graph, S) → [{ pillar, name, mask }]          pillars whose string reaches C but no N
'use strict';

const C = require('./common');

const KIND = { path: 'start page', steps: 'start command', server: 'start server', menu: 'start menu', action: 'start action', exe: 'start program', folder: 'start folder' };

// {stack}\board.html → Stack/board.html (inside the repo) or the H: path as written (outside it)
function resolver(paths = {}) {
  const tok = { repo: '', stack: 'Stack' };
  const one = (s, depth = 0) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => {
    if (k in tok) return tok[k];
    if (paths[k] && depth < 4) return one(paths[k], depth + 1);
    return m;
  });
  return s => {
    const r = one(s).replace(/\\/g, '/').replace(/^\/+/, '');
    return /\{(full|vrg)\}/.test(r) || /^[A-Za-z]:\//.test(r) ? { outside: r } : { repo: r };
  };
}

function layer({ menu = null, catalog = null, mobile = '' } = {}) {
  const nodes = [], edges = [], ids = new Set();
  const add = n => { if (ids.has(n.id)) return; ids.add(n.id); nodes.push({ layer: 'N', t: '', tier: '', state: '', own: [], ...n }); };
  const where = resolver((menu && menu.paths) || {});
  const show = s => { const r = where(s); return r.repo != null ? r.repo : r.outside; };

  /* ---- START: every key, depth first; a submenu is its own node, its items hang from it */
  const start = (items, prefix, parent, lane) => {
    for (const it of items || []) {
      if (!it || !it.key) continue;
      const key = prefix ? prefix + '/' + it.key : it.key, id = 'N:start.' + key;
      const kind = KIND[['menu', 'server', 'steps', 'path', 'exe', 'folder', 'action'].find(k => it[k]) || 'action'];
      const targets = [it.path, it.page, it.then, it.folder, it.cwd, it.exe, ...((it.steps || []).flatMap(s => [s.exe, ...(s.args || [])]))].filter(Boolean).map(show);
      add({ id, kind, title: it.name, brief: [it.hint, it.server ? 'szerver ' + it.server : '', it.open || ''].filter(Boolean).join(' · '),
        lane, own: ['start:' + key], text: [it.name, it.hint, ...targets, it.open || ''].filter(Boolean).join('\n'),
        extra: { key, path: targets[0] || '' } });
      if (parent) edges.push({ a: parent, b: id, rel: 'contains' });
      if (it.server) edges.push({ a: id, b: 'N:server.' + it.server, rel: 'opens' });
      if (it.menu) start(it.menu.items, key, id, lane);
    }
  };
  if (menu && menu.start) for (const part of ['tools', 'projects', 'dev', 'bottom']) start(menu.start[part], '', null, 'start ' + part);

  for (const s of (menu && menu.servers) || []) {
    const js = s.js ? show(s.js) : '';
    add({ id: 'N:server.' + s.id, kind: 'server', title: s.name, brief: `:${s.port}${s.open ? ' ' + s.open : ''}`, lane: 'servers',
      own: ['srv:' + s.id, 'port:' + s.port], text: [s.name, js, s.open ? s.open.replace(/^\//, '') : ''].filter(Boolean).join('\n'), extra: { port: s.port, js } });
  }
  for (const p of (menu && menu.programs) || []) {
    // START A opens the programs list: a program's key there is its START act (the catalog launches s:A/1)
    add({ id: 'N:start.A/' + p.key, kind: 'program', title: p.name, brief: p.optional ? 'nem kötelező' : '', lane: 'programs',
      own: ['start:A/' + p.key], text: [p.name, show(p.exe)].join('\n'), extra: { key: 'A/' + p.key, exe: show(p.exe) } });
  }

  /* ---- the VRG Asztal's catalog: its launch points at a START act, a server or a page */
  for (const it of (catalog && catalog.items) || []) {
    const L = it.launch || {}, id = 'N:cat.' + it.id;
    const title = (it.title && (it.title.hu || it.title.en)) || it.id;
    const page = L.path ? (L.server === 'stack' ? 'Stack/' + L.path.replace(/^\//, '') : L.path.replace(/^\//, '')) : '';
    const app = L.app && page ? `vrg-app://${it.id}/${page}` : '';
    const dirs = (it.from || []).filter(f => /^dir:/.test(f)).map(f => f.slice(4));
    add({ id, kind: 'catalog', title, brief: [it.type, it.qualifier, it.level, it.status].filter(Boolean).join(' · '), state: it.status || '',
      lane: it.group || 'catalog', own: ['cat:' + it.id], text: [title, it.qualifier, page, app, ...dirs].filter(Boolean).join('\n'), extra: { type: it.type, level: it.level, page, app } });
    if (L.act) { const m = /^s:(.+)$/.exec(L.act); if (m) edges.push({ a: id, b: 'N:start.' + m[1], rel: 'launches' }); }
    if (L.server) edges.push({ a: id, b: 'N:server.' + L.server, rel: 'opens' });
    if (it.parent && !/^dev:/.test(it.parent)) edges.push({ a: 'N:cat.' + it.parent, b: id, rel: 'contains' });
    for (const f of it.from || []) { const m = /^feat:(.+)$/.exec(f); if (m) edges.push({ a: id, b: 'F:' + m[1], rel: 'opens' }); }
  }

  /* ---- VRG Mobile: the Catalogue's FeatureInfo entries (id, title, blurb, glyph, group, stage, WP) */
  const rx = /FeatureInfo\(\s*"([^"]+)",\s*"([^"]*)",\s*"([^"]*)",\s*"[^"]*",\s*Group\.(\w+),\s*Stage\.(\w+),\s*"([^"]*)"/g;
  let m;
  while ((m = rx.exec(mobile || ''))) {
    const [, fid, title, blurb, group, stage, wp] = m;
    add({ id: 'N:mob.' + fid, kind: 'mobile feature', title, brief: blurb, state: stage.toLowerCase(), lane: 'mobile ' + group.toLowerCase(),
      own: ['vrg:' + fid], text: [title, blurb, wp ? 'docs/mobile/WP/' + wp : '', 'Mobile/android/feature-' + fid].filter(Boolean).join('\n'), extra: { wp, stage: stage.toLowerCase() } });
  }
  return { nodes, edges };
}

/* ---- pillars whose string reaches code but no entry point: nothing opens them (DRIFT.md §11) */
function unreachable(graph, S, opts = {}) {
  const edges = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
  const ix = S.prepare(graph.nodes, edges), out = [];
  // the folders an entry point opens (N → C by path): a pillar whose code sits in one of them, or below, is reached
  // through that entry (Views lives in the Planner, which START 1 opens), even when its own string has no N
  const opened = new Set(edges.filter(e => e.a[0] === 'N' && e.b[0] === 'C').map(e => e.b.slice(2)));
  const inside = d => { for (let x = d; x; x = x.includes('/') ? x.slice(0, x.lastIndexOf('/')) : '') if (opened.has(x)) return true; return false; };
  for (const p of graph.entities || []) {
    const s = S.string(ix, 'E:' + p.id, opts); if (!s) continue;
    if (!s.reach.includes('C') || s.reach.includes('N')) continue;
    const dirs = s.members.filter(m => m.layer === 'C').map(m => m.id.slice(2));
    if (dirs.some(inside)) continue;
    out.push({ pillar: p.id, name: p.name, mask: s.mask, cls: s.cls, dirs: dirs.slice(0, 3) });
  }
  return out;
}

module.exports = { layer, unreachable, resolver };
