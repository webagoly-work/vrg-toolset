// workspaces.js — saved workspaces (WP-34, API.md vrg.layout workspaces) in <userDir>/workspaces.json.
//   const ws = createWorkspaces({ file, roots, getTree, terms, openTerm, fs?, now? });
//   ws.save(name, lineId?) → { ok, id, name, line? }      ws.open(id) → { ok, id, name, tree, terms, tabs, cluster?, skipped }
//   ws.list() → [{ id, name, line? }]                      ws.forLine(lineId) → { id, name } | null          ws.remove(id)
// A row is { id, name, line?, tree, terms:[{ prof, root, names }], tabs:[{ url }], cluster?, at }. Folders are stored as a root id plus
// folder names, never as an absolute path; only http(s) URLs are kept. open() starts the terminals as NEW sessions through openTerm()
// and hands the tree, the new session ids, the tab URLs and the cluster back; the frame page applies them (a term pane is adopted, tabs
// go into the web pane). `roots` = { get(id) → { real } | null, rootOf(abs) → id | null }; `terms()` = [{ prof, abs }] of the live sessions.
'use strict';
const nodeFs = require('fs'), path = require('path'), crypto = require('crypto');
const layout = require('./layout.js');

const MAX_ROWS = 50;
const MAX_TABS = 40;
const MAX_TERMS = 12;
const MAX_NAMES = 24;
const NAME_MAX = 60;
const LINE_RE = /^[\w-]{1,60}$/;
const ID_RE = /^w[0-9a-f]{12}$/;
const NODE_RE = /^[A-Z]:[^\s,]{1,150}$/;                       // a VRG Stack node id (lib/ctx.js)
const DRIVE_RE = /[A-Za-z]:[\\/]/;

const bad = (hu, err = 'bad-request') => ({ ok: false, err, hu });
const okUrl = u => {
  if (typeof u !== 'string' || !u.length || u.length > 500) return false;
  try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
};
const clone = v => JSON.parse(JSON.stringify(v));
const cleanName = s => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '');
const safeSeg = n => typeof n === 'string' && n.length > 0 && n.length <= 200 && !/[\\/:*?"<>|\u0000-\u001f]/.test(n) && n !== '.' && n !== '..';

function createWorkspaces({ file, roots, getTree, terms = () => [], openTerm, defaultDir = () => '', fs = nodeFs, now = () => new Date() } = {}) {
  if (typeof file !== 'function' && typeof file !== 'string') throw new Error('workspaces: file missing');
  const where = () => (typeof file === 'function' ? file() : file);

  function read() {
    try {
      const j = JSON.parse(fs.readFileSync(where(), 'utf8'));
      return Array.isArray(j) ? j.filter(r => r && ID_RE.test(r.id) && typeof r.name === 'string' && r.tree) : [];
    } catch (e) { return []; }
  }
  function write(rows) {
    const f = where(), tmp = f + '.tmp';
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 1));
    fs.renameSync(tmp, f);
  }

  // root id + folder names of an absolute folder, or null when it is under no root
  function relOf(abs) {
    const id = roots.rootOf(abs);
    const r = id && roots.get(id);
    if (!r) return null;
    const rel = path.relative(r.real, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    const names = rel.split(/[\\/]/).filter(Boolean);
    return names.length <= MAX_NAMES && names.every(safeSeg) ? { root: id, names } : null;
  }

  // the tree to keep: terminal panes go (they re-open as new sessions), web tabs are saved apart, nothing that looks like a path stays in a state
  function treeToKeep(tree) {
    let t = clone(tree);
    for (const p of layout.panes(t)) if (p.kind === 'term') t = layout.close(t, p.id);
    for (const p of layout.panes(t)) {
      if (p.kind === 'web') p.state = {};
      else if (DRIVE_RE.test(JSON.stringify(p.state))) p.state = {};
    }
    return layout.validate(t).ok ? t : layout.defaultTree();
  }
  function tabsOf(tree) {
    const out = [], seen = new Set();
    for (const p of layout.panes(tree)) {
      if (p.kind !== 'web' || !p.state || !Array.isArray(p.state.tabs)) continue;
      for (const u of p.state.tabs) if (okUrl(u) && !seen.has(u) && out.length < MAX_TABS) { seen.add(u); out.push({ url: u }); }
    }
    return out;
  }
  function clusterOf(tree) {
    const ids = [];
    for (const p of layout.panes(tree)) {
      if (p.kind !== 'stack' || !p.state || !Array.isArray(p.state.nodes)) continue;
      for (const n of p.state.nodes) { const id = n && typeof n === 'object' ? n.id : n; if (typeof id === 'string' && NODE_RE.test(id) && !ids.includes(id) && ids.length < 80) ids.push(id); }
    }
    return ids.length ? { ids } : undefined;
  }

  function save(name, lineId) {
    const n = cleanName(name);
    if (!n || n.length > NAME_MAX) return bad('Érvénytelen név.');
    if (lineId !== undefined && !(typeof lineId === 'string' && LINE_RE.test(lineId))) return bad('Érvénytelen vonal.');
    const cur = getTree();
    if (!cur || !layout.validate(cur).ok) return bad('Nincs mentendő elrendezés.');
    let rows = read();
    const same = rows.find(r => r.name.toLowerCase() === n.toLowerCase());
    if (!same && rows.length >= MAX_ROWS) return bad('Legfeljebb ' + MAX_ROWS + ' munkatér lehet.', 'limit');
    const row = { id: same ? same.id : 'w' + crypto.randomBytes(6).toString('hex'), name: n };
    if (lineId) row.line = lineId;
    row.tree = treeToKeep(cur);
    row.terms = [];
    for (const s of terms().slice(0, MAX_TERMS)) {
      if (!s || typeof s.prof !== 'string' || !/^[\w-]{1,40}$/.test(s.prof)) continue;
      const rel = typeof s.abs === 'string' ? relOf(s.abs) : null;
      row.terms.push(rel ? { prof: s.prof, root: rel.root, names: rel.names } : { prof: s.prof, root: '', names: [] });
    }
    row.tabs = tabsOf(cur);
    const cl = clusterOf(cur);
    if (cl) row.cluster = cl;
    row.at = now().toISOString();
    if (lineId) rows = rows.map(r => (r.line === lineId && r.id !== row.id ? (({ line, ...rest }) => rest)(r) : r));   // one workspace per line
    rows = same ? rows.map(r => (r === same ? row : r)) : [...rows, row];
    write(rows);
    return { ok: true, id: row.id, name: row.name, ...(row.line ? { line: row.line } : {}) };
  }

  // root + names → an existing folder under that root, else the root itself; no root → the default folder
  function dirOf(t) {
    const r = t && typeof t.root === 'string' && t.root ? roots.get(t.root) : null;
    if (!r) return defaultDir();
    let cur = r.real;
    const names = Array.isArray(t.names) ? t.names : [];
    for (const nm of names) {
      if (!safeSeg(nm)) return r.real;
      const next = path.join(cur, nm);
      try { if (!fs.statSync(next).isDirectory()) return r.real; } catch (e) { return r.real; }
      cur = next;
    }
    return roots.rootOf(cur) === t.root ? cur : r.real;       // a junction leading out of the root counts as missing
  }

  function open(id) {
    const row = typeof id === 'string' ? read().find(r => r.id === id) : null;
    if (!row) return bad('Nincs ilyen munkatér.', 'not-found');
    if (!layout.validate(row.tree).ok) return bad('A munkatér elrendezése sérült.', 'error');
    const out = [], skipped = [];
    for (const t of (Array.isArray(row.terms) ? row.terms : []).slice(0, MAX_TERMS)) {
      const dir = dirOf(t);
      const r = dir ? openTerm(t.prof, dir) : null;
      if (r && r.term) out.push({ term: r.term, prof: t.prof, title: r.title });
      else skipped.push(t.prof);
    }
    const res = { ok: true, id: row.id, name: row.name, tree: clone(row.tree), terms: out, tabs: (row.tabs || []).filter(x => x && okUrl(x.url)).map(x => x.url), skipped };
    if (row.line) res.line = row.line;
    if (row.cluster && Array.isArray(row.cluster.ids)) res.cluster = { ids: row.cluster.ids.filter(x => NODE_RE.test(x)) };
    return res;
  }

  const list = () => read().map(r => ({ id: r.id, name: r.name, ...(r.line ? { line: r.line } : {}) }));
  function forLine(lineId) {
    const r = typeof lineId === 'string' ? read().find(x => x.line === lineId) : null;
    return r ? { id: r.id, name: r.name } : null;
  }
  function remove(id) {
    const rows = read(), left = rows.filter(r => r.id !== id);
    if (left.length === rows.length) return bad('Nincs ilyen munkatér.', 'not-found');
    write(left);
    return { ok: true };
  }

  return { save, open, list, forLine, remove };
}

module.exports = { createWorkspaces, MAX_ROWS, LINE_RE };
