// catalog.js — launcher/vrg-catalog.json: WHAT exists in the VRG Asztal, its type, level, parent and surfaces (U4, WP-40).
//   const cat = createCatalog({ file, collect: () => R.C, kinds: layout.KINDS });
//   cat.load() · cat.errors() · cat.listFor('user'|'dev'|'all') · cat.get(id) · cat.children(id) · cat.resolve(id) · cat.appTarget(id)
// HOW to run stays in vrg-menu.json: launch.act is a START act id (collect().startActs), launch.server a server id, launch.feature a
// features id whose first link act opens it. The page only ever names a catalog id; resolve() turns it into what main does.
// Pure: no Electron, so node --test loads it with a fake collect().
'use strict';
const fs = require('fs'), path = require('path');

const LEVELS = ['user', 'dev', 'all'];
const RANK = { user: 0, dev: 1, all: 2 };
const STATUS = ['live', 'beta', 'dev', 'planned', 'idea', 'retire'];
const FRAMES = ['palette', 'quick', 'search', 'workspaces', 'note', 'settings'];
const VIEWS = ['dashboard', 'desktop'];
const ID_RE = /^[a-z0-9][a-z0-9.:-]{0,59}$/;
const STACK = ['F', 'I', 'Q', 'L', 'A', 'U', 'R', 'C', 'G', 'Z', 'page', '*', ''];

function readCatalog(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j || !Array.isArray(j.items)) throw new Error('catalog: no items array');
  return j;
}

// the act that opens features node `fid`: its first link with an act (f:<id>:<i>, srv:<id>, …), or ''
function featureAct(C, fid) {
  const f = ((C && C.data && C.data.features) || []).find(x => x.id === fid);
  const l = f && (f.links || []).find(x => x && x.act);
  return l ? l.act : '';
}
const featureExists = (C, fid) => ((C && C.data && C.data.features) || []).some(x => x.id === fid);
const serverOf = (C, id) => ((C && C.menu && C.menu.servers) || []).find(s => s.id === id) || null;

// every problem with the catalog as human-readable lines; empty = valid
function validate(cat, { C, kinds = [] } = {}) {
  const errs = [];
  const items = cat.items || [], byId = new Map();
  for (const it of items) {
    const at = 'item ' + (it && it.id ? it.id : '?');
    if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id)) { errs.push(at + ': bad id'); continue; }
    if (byId.has(it.id)) errs.push(at + ': duplicate id');
    byId.set(it.id, it);
    if (!it.title || typeof it.title.hu !== 'string' || !it.title.hu || typeof it.title.en !== 'string' || !it.title.en) errs.push(at + ': title {hu, en} missing');
    if (!LEVELS.includes(it.level)) errs.push(at + ': level must be user, dev or all');
    if (typeof it.type !== 'string' || !it.type) errs.push(at + ': type missing');
    if (!STATUS.includes(it.status)) errs.push(at + ': status must be one of ' + STATUS.join(', '));
    if (!cat.groups || !cat.groups[it.group]) errs.push(at + ': unknown group ' + it.group);
    else if (it.sub && it.group !== 'fejlesztes' && !(it.sub in (cat.groups[it.group].subs || {}))) errs.push(at + ': unknown sub ' + it.sub);
    const s = it.surfaces || {};
    if (s.dashboard && !(cat.sections && cat.sections[s.dashboard])) errs.push(at + ': unknown dashboard section ' + s.dashboard);
    if (s.stack !== undefined && !STACK.includes(s.stack)) errs.push(at + ': bad stack layer ' + s.stack);
    const L = it.launch || {};
    const C2 = C || {};
    if (L.act && !(C2.startActs && C2.startActs[L.act])) errs.push(at + ': launch.act ' + L.act + ' is not a START act');
    if (L.app && !L.act) errs.push(at + ': launch.app needs launch.act');
    if (L.server && !serverOf(C2, L.server)) errs.push(at + ': launch.server ' + L.server + ' is not in vrg-menu.json servers');
    if (L.path && (typeof L.path !== 'string' || !/^\/[\w./-]{0,200}$/.test(L.path) || L.path.includes('..'))) errs.push(at + ': bad launch.path');
    if (L.path && !L.server) errs.push(at + ': launch.path needs launch.server');
    if (L.pane && !kinds.includes(L.pane)) errs.push(at + ': launch.pane ' + L.pane + ' is not a pane kind');
    if (L.feature && !featureExists(C2, L.feature)) errs.push(at + ': launch.feature ' + L.feature + ' is not a features node');
    else if (L.feature && !featureAct(C2, L.feature)) errs.push(at + ': launch.feature ' + L.feature + ' has nothing to open');
    if (L.view && !VIEWS.includes(L.view)) errs.push(at + ': launch.view must be dashboard or desktop');
    if (L.frame && !FRAMES.includes(L.frame)) errs.push(at + ': launch.frame must be one of ' + FRAMES.join(', '));
    if (L.start && !/^[A-Z0-9]$/.test(L.start)) errs.push(at + ': launch.start must be a START key');
    for (const sv of it.servers || []) if (!serverOf(C2, sv)) errs.push(at + ': server ' + sv + ' is not in vrg-menu.json');
    if (it.devMenu && !((C2.menu && C2.menu.start && [].concat(C2.menu.start.projects || [], C2.menu.start.dev || [])) || []).some(p => p.key === it.devMenu && p.menu))
      errs.push(at + ': devMenu ' + it.devMenu + ' is not a START submenu');
  }
  for (const it of items) {
    if (!it || !byId.has(it.id)) continue;
    const at = 'item ' + it.id;
    if (it.parent !== undefined && it.parent !== '') {
      const p = byId.get(it.parent);
      if (!p) errs.push(at + ': parent ' + it.parent + ' does not exist');
      else if (p.id === it.id) errs.push(at + ': is its own parent');
    }
    // a dev item hangs behind a user item or a dev root (or another dev item); an all item may hang anywhere
    if (it.level === 'dev' && it.type !== 'dev root' && !it.parent) errs.push(at + ': a dev item needs a parent');
    if (it.level === 'dev' && it.parent && byId.get(it.parent) && byId.get(it.parent).level === 'all') errs.push(at + ': a dev item cannot sit behind an all item');
    const seen = new Set([it.id]);                                   // no parent cycles
    for (let p = byId.get(it.parent); p; p = byId.get(p.parent)) { if (seen.has(p.id)) { errs.push(at + ': parent cycle'); break; } seen.add(p.id); }
  }
  return errs;
}

function createCatalog({ file, collect = () => null, kinds = [] }) {
  let cat = { items: [], groups: {}, sections: {} }, errors = ['not loaded'], byId = new Map();

  function load() {
    try { cat = readCatalog(file); errors = validate(cat, { C: collect(), kinds }); }
    catch (e) { cat = { items: [], groups: {}, sections: {} }; errors = ['catalog: ' + e.message]; }
    byId = new Map(cat.items.filter(i => i && typeof i.id === 'string').map(i => [i.id, i]));
    return errors;
  }

  const get = id => byId.get(id) || null;
  const within = (it, level) => RANK[it.level] <= RANK[level];

  // what hangs behind an item: catalog children, its START submenu actions, its servers (resolved from vrg-menu.json)
  function children(id, level = 'all') {
    const it = get(id);
    if (!it) return null;
    const C = collect() || {};
    const items = cat.items.filter(x => x.parent === id && within(x, level)).map(x => x.id);
    const acts = [];
    if (it.devMenu && RANK[level] >= RANK.dev) {
      const all = [].concat((C.menu && C.menu.start && C.menu.start.projects) || [], (C.menu && C.menu.start && C.menu.start.dev) || []);
      const top = all.find(p => p.key === it.devMenu);
      for (const m of (top && top.menu && top.menu.items) || []) {
        const a = 's:' + it.devMenu + '/' + m.key;
        if (C.startActs && C.startActs[a]) acts.push({ act: a, hu: m.name, hint: m.hint || '' });
      }
    }
    const servers = RANK[level] >= RANK.dev ? (it.servers || []).map(s => serverOf(C, s)).filter(Boolean).map(s => ({ id: s.id, name: s.name, port: s.port, act: 'srv:' + s.id })) : [];
    return { items, acts, servers };
  }

  // the items of `level` and below, each with its title, type, surfaces and (for dev / all) what hangs behind it
  function listFor(level) {
    if (!LEVELS.includes(level)) level = 'user';
    return cat.items.filter(it => within(it, level)).map(it => ({
      id: it.id, hu: it.title.hu, en: it.title.en, type: it.type, level: it.level, parent: it.parent || '', group: it.group, sub: it.sub || '',
      status: it.status, icon: it.icon || '', surfaces: { ...(it.surfaces || {}) }, opens: !!resolve(it.id), children: children(it.id, level),
    }));
  }

  // id → what main does: { do:'act', act, app? } | { do:'web', server, url } | { do:'pane', kind } | { do:'view', view, section? }
  //                     | { do:'frame', frame } | { do:'start', key } | null (nothing to open, or unknown)
  function resolve(id) {
    const it = get(id);
    if (!it) return null;
    const L = it.launch || {}, C = collect() || {};
    if (L.act && C.startActs && C.startActs[L.act]) return { do: 'act', act: L.act, app: !!L.app };
    if (L.server) { const s = serverOf(C, L.server); return s ? { do: 'web', server: s.id, url: 'http://127.0.0.1:' + s.port + (L.path || s.open || '/') } : null; }
    if (L.pane && kinds.includes(L.pane)) return { do: 'pane', kind: L.pane };
    if (L.feature) { const a = featureAct(C, L.feature); return a ? { do: 'act', act: a, app: false } : null; }
    if (L.view && VIEWS.includes(L.view)) return { do: 'view', view: L.view, section: typeof L.section === 'string' ? L.section : '' };
    if (L.frame && FRAMES.includes(L.frame)) return { do: 'frame', frame: L.frame };
    if (L.start) return { do: 'start', key: L.start };
    return null;
  }

  // in-shell HTML app (DESKU-Q08): the page a START tool item points at, as a repo-relative path, and the folders vrg-app:// may serve
  //   → { page: 'Calculator/x.html', allow: ['Calculator/', 'shared/'] } | null.  repo = the repo root; expand = R.expand
  function appTarget(id, { repo, expand }) {
    const r = resolve(id);
    if (!r || r.do !== 'act' || !r.app) return null;
    const C = collect() || {};
    const t = C.startActs && C.startActs[r.act];
    if (!t || typeof t.path !== 'string' || !/\.html?$/i.test(t.path)) return null;
    const abs = path.resolve(expand(t.path));
    const rel = path.relative(path.resolve(repo), abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    const page = rel.split(path.sep).join('/');
    const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
    return { page, allow: dir ? [dir, 'shared/'] : [page, 'shared/'] };     // a page at the repo root is served alone (+ shared/)
  }

  // the one catalog id whose origin an in-shell app uses: the item that "is" that START tool (from: menu:tool:<key>), so the
  // Planner opened as "Ügyfélnézet" or "Varler Planner" shares one origin, one localStorage (vrg-app://planner/)
  function appOwner(id) {
    const r = resolve(id);
    if (!r || r.do !== 'act' || !r.app) return null;
    const key = r.act.replace(/^s:/, '');
    const owner = cat.items.find(x => (x.from || []).includes('menu:tool:' + key)) || cat.items.find(x => x.launch && x.launch.act === r.act && x.launch.app);
    return owner ? owner.id : id;
  }

  return {
    load, errors: () => errors.slice(), get, children, listFor, resolve, appTarget, appOwner,
    raw: () => cat, groups: () => cat.groups || {}, sections: () => cat.sections || {},
  };
}

module.exports = { createCatalog, validate, LEVELS, RANK, FRAMES, VIEWS, readCatalog, featureAct };
