// lib/modules.js — Browser/modules.json (T8: the VRG Böngésző's parts as plugins): read it, check it, and resolve a build.
//
//   const M = require('./lib/modules.js')
//   M.load()                      → the manifest, checked (throws with every problem listed)
//   M.check(manifest, readFile)   → [problems]   (readFile(rel) gives a source under src/; used by the tests)
//   M.resolve(manifest, without)  → { order, built, mods }   order = the files to concatenate, mods = what VB_DATA.mods gets
//
// What is checked, beyond the shape: every source file under src/core, src/app and src/vendor is in exactly one part; a
// part's files really do what it declares — a fetch( needs `net`, a window location.assign / .open( needs `web`, a
// .localStorage needs `storage`, and every '/api/…' or '/__vrg/…' route a file names is declared by its part (or a switch
// of it), by a core part, or by a part it requires; switch ids, nav routes and nav positions are unique; a plugin's requires come earlier. Comments are not code:
// they are stripped before the audit.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'modules.json');
const FORMAT = 'vrg.browser-modules';
const NEEDS = ['net', 'web', 'storage'];
const KINDS = ['core', 'plugin'];
const HOST_KINDS = ['desktop', 'mobile', 'served', 'file', 'web'];
const COUNTS = ['bookmarks', 'history', 'unread', 'jobs', 'notebooks'];
const ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)?$/;
const SWITCH_ID = /^[a-z][a-z0-9]*$/;
const ROUTE = /^\/(api|__vrg)\/[a-z]+$/;
// a host a part may reach: self (its own origin: the Asztal's door, or serve.js when served), a host[:port|:*], or * (web only)
const HOST = /^(self|\*|[a-z0-9.-]+(:(\d{1,5}|\*))?)$/;

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

function check(m, readFile) {
  const out = [];
  const bad = t => out.push(t);
  if (!m || m.format !== FORMAT) return ['format is not ' + FORMAT];
  if (m.v !== 1) return ['v ' + m.v + ' is not 1'];
  if (!Array.isArray(m.parts) || !m.parts.length) return ['no parts'];
  const ids = new Set(), files = new Map(), switches = new Map(), routes = new Map(), ats = new Map();
  // a route is the part's own, a core part's (always built), or one of a part it requires; its switch still gates it
  const routesOf = p => (p.api || []).concat(...(p.switches || []).map(s => s.api || []));
  const mayCall = (p, r) => routesOf(p).includes(r) || m.parts.some(q => q && (q.kind === 'core' || (p.requires || []).includes(q.id)) && routesOf(q).includes(r));
  for (const [i, p] of m.parts.entries()) {
    const at = 'parts[' + i + ']' + (p && p.id ? ' ' + p.id : '');
    if (!p || !ID.test(p.id || '')) { bad(at + ': id'); continue; }
    if (ids.has(p.id)) bad(at + ': id twice');
    if (!KINDS.includes(p.kind)) bad(at + ': kind ' + p.kind);
    if (!p.hu) bad(at + ': hu');
    if (p.kind === 'plugin' && !p.desc) bad(at + ': a plugin says what it is (desc)');
    for (const r of p.requires || []) if (!ids.has(r)) bad(at + ': requires ' + r + ', which is not an earlier part');
    ids.add(p.id);
    if (!Array.isArray(p.files) || !p.files.length) bad(at + ': files');
    for (const f of p.files || []) {
      if (files.has(f)) bad(at + ': ' + f + ' is already in ' + files.get(f));
      files.set(f, p.id);
    }
    const needs = p.needs || [];
    for (const n of needs) if (!NEEDS.includes(n)) bad(at + ': need ' + n + ' (one of ' + NEEDS.join(', ') + ')');
    const hosts = p.hosts || [];
    if ((needs.includes('net') || needs.includes('web')) && !hosts.length) bad(at + ': net / web name their hosts');
    if (!needs.includes('net') && !needs.includes('web') && hosts.length) bad(at + ': hosts without net or web');
    for (const h of hosts) {
      if (!HOST.test(h)) bad(at + ': host ' + h);
      if (h === '*' && !needs.includes('web')) bad(at + ': * is for web (opening any page the user asks for), not net');
    }
    const api = (p.api || []).slice();
    for (const s of p.switches || []) {
      const sat = at + ' switch ' + (s && s.id);
      if (!s || !SWITCH_ID.test(s.id || '')) { bad(sat + ': id'); continue; }
      if (switches.has(s.id)) bad(sat + ': id twice');
      switches.set(s.id, p.id);
      if (!s.hu || !s.desc) bad(sat + ': hu and desc');
      if (typeof s.on !== 'boolean') bad(sat + ': on is true or false');
      for (const k of s.runs || []) if (!HOST_KINDS.includes(k)) bad(sat + ': runs ' + k);
      api.push(...(s.api || []));
    }
    for (const r of api) {
      if (!ROUTE.test(r)) bad(at + ': route ' + r);
      if (routes.has(r)) bad(at + ': route ' + r + ' is already ' + routes.get(r) + "'s");
      routes.set(r, p.id);
    }
    if (api.length && !needs.includes('net')) bad(at + ': routes need net');
    for (const n of p.nav || []) {
      const nat = at + ' nav ' + n.route;
      if (typeof n.route !== 'string' || !/^[a-z]*$/.test(n.route)) bad(nat + ': route');
      if ([...ats.values()].some(x => x.route === n.route)) bad(nat + ': route twice');
      if (!Number.isInteger(n.at) || ats.has(n.at)) bad(nat + ': at is a free whole number');
      ats.set(n.at, n);
      if (!n.hu || !n.icon || !/^[a-z]+$/.test(n.view || '')) bad(nat + ': hu, icon, view');
      if (n.module && switches.get(n.module) !== p.id) bad(nat + ': module ' + n.module + ' is not a switch of this part');
      if (n.count && !COUNTS.includes(n.count)) bad(nat + ': count ' + n.count + ' (one of ' + COUNTS.join(', ') + ')');
    }
    // the audit: what the files do against what the part declares
    for (const f of p.files || []) {
      let src;
      try { src = readFile(f); } catch (e) { bad(at + ': ' + f + ' does not exist'); continue; }
      const code = strip(src);
      if (/\bfetch\s*\(/.test(code) && !needs.includes('net')) bad(at + ': ' + f + ' calls fetch( but the part does not need net');
      if (/\blocation\.assign\s*\(|\b(?:w|win|window|root)\.open\s*\(/.test(code) && !needs.includes('web')) bad(at + ': ' + f + ' opens pages but the part does not need web');
      if (/\.localStorage\b/.test(code) && !needs.includes('storage')) bad(at + ': ' + f + ' reaches localStorage but the part does not need storage');
      for (const x of code.matchAll(/['"](\/(?:api|__vrg)\/[a-z]+)/g)) if (!mayCall(p, x[1])) bad(at + ': ' + f + ' calls ' + x[1] + ', which neither its part, a core part nor a part it requires declares');
    }
  }
  if (!ats.has(0) || ats.get(0).route !== '') bad('the home (route "") is the first nav entry, at 0');
  return out;
}

function sources(root) {
  const list = [];
  for (const d of ['core', 'app', 'vendor']) {
    const dir = path.join(root, 'src', d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.js')) list.push(d + '/' + f);
  }
  return list;
}

function load(file) {
  const m = JSON.parse(fs.readFileSync(file || FILE, 'utf8'));
  const problems = check(m, rel => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8'));
  const listed = new Set(m.parts.flatMap(p => p.files || []));
  for (const f of sources(ROOT)) if (!listed.has(f)) problems.push('src/' + f + ' is in no part of modules.json');
  if (problems.length) throw new Error('modules.json:\n  ' + problems.join('\n  '));
  return m;
}

/** The build without the named plugins: the load order and what the page learns about its parts. */
function resolve(m, without) {
  const drop = new Set(without || []);
  for (const id of drop) {
    const p = m.parts.find(x => x.id === id);
    if (!p) throw new Error('modules: no part ' + id);
    if (p.kind !== 'plugin') throw new Error('modules: ' + id + ' is core and is always built');
  }
  const kept = m.parts.filter(p => !drop.has(p.id));
  for (const p of kept) for (const r of p.requires || []) if (drop.has(r)) throw new Error('modules: ' + p.id + ' requires ' + r);
  const switches = [], nav = [], api = {};
  for (const p of kept) {
    for (const r of p.api || []) api[r] = '';
    for (const s of p.switches || []) {
      switches.push({ id: s.id, part: p.id, hu: s.hu, desc: s.desc, on: s.on, runs: s.runs || null });
      for (const r of s.api || []) api[r] = s.id;
    }
    for (const n of p.nav || []) nav.push(Object.assign({ part: p.id }, n));
  }
  nav.sort((a, b) => a.at - b.at);
  const parts = kept.map(p => ({ id: p.id, kind: p.kind, hu: p.hu, desc: p.desc || '', needs: p.needs || [], hosts: p.hosts || [] }));
  return {
    order: kept.flatMap(p => p.files),
    built: kept.map(p => p.id),
    mods: { v: m.v, parts, switches, nav, api, without: [...drop].sort() },
  };
}

module.exports = { load, check, resolve, sources, strip, FILE, FORMAT, NEEDS, COUNTS };
