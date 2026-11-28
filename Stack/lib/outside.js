// VRG Stack — O · Külső (outside), S18 of research/STRINGS-PLAN.md (§5; RULES §6a): what we depend on and under which
// licence. The vendored components, the npm packages our tracked package.json files name, the MCP servers the
// sessions are allowed to call. Programs on the PC are N nodes already (START A), so they are not repeated here.
//
//   read({ repo, files, grep, settings }) → { vendor, npm, mcp }
//     vendor  vendor-manifest.json (tools/fetch-vendor.js owns Vendor/): each component, its mode (fetch / npm /
//             reference), its pin (a tag, a branch, an exact npm version), its licence, the app it serves (aspect);
//             grep(targets) → { target: { code, docs } }: the tracked files that name it (its users, and the documents)
//     npm     every direct dependency of a tracked package.json, its version and licence from the package-lock next to it
//     mcp     every MCP server the settings name (mcpServers, or an allowed mcp__<server>__ tool)
//   layer(r) → { nodes, edges }   pure
//     O:vendor.<slug>   kind 'vendored' / 'reference'; title "<name> · <the app it serves>", so that app's pillar takes it in
//     O:npm.<name>      kind 'npm package'; text names the package.json folders, so the join links it to the code
//     O:mcp.<server>    kind 'mcp server'
//   checks(nodes) → { branch, copyleft, unknown }   CLAUDE.md "Vendored third-party code": a source pinned to a branch,
//     a copyleft licence in code we copy (fetch / npm, and used), a licence nobody confirmed (J signals)
'use strict';

const fs = require('fs');
const path = require('path');

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const COPYLEFT = /\b(A?GPL|LGPL|MPL|EUPL|SSPL)\b/i;
const KNOWN = /^(MIT|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|CC0-1\.0|Unlicense|Zlib|Python-2\.0|BlueOak-1\.0\.0|CC-BY-4\.0|MPL-2\.0|(A|L)?GPL-[23]\.0(-only|-or-later)?)$/;
const licenceOk = l => !!l && String(l).split(/\s+(?:OR|AND)\s+|[()]/).filter(Boolean).every(x => KNOWN.test(x.trim()));

function read({ repo, files = [], grep = () => ({}), settings = [] } = {}) {
  const man = readJson(path.join(repo, 'vendor-manifest.json')) || { components: [] };
  const used = grep((man.components || []).map(c => c.target || c.slug));
  const vendor = (man.components || []).map(c => ({ slug: c.slug, name: c.name || c.slug, repo: c.repo || '', mode: c.vendor || '', source: c.source || 'git',
    ref: c.source === 'npm' ? (c.npmVersion || '') : (c.ref || ''), refType: c.source === 'npm' ? 'version' : (c.refType || 'branch'), license: c.license || null,
    aspect: c.aspect || '', target: c.target || c.slug, usedBy: ((used[c.target || c.slug] || {}).code || []).slice().sort(), docs: ((used[c.target || c.slug] || {}).docs || []).slice().sort() }));

  const npm = new Map();
  for (const pj of files.filter(f => /(^|\/)package\.json$/.test(f) && !/(^|\/)(node_modules|Vendor)\//.test(f))) {
    const p = readJson(path.join(repo, pj)); if (!p) continue;
    const dir = path.posix.dirname(pj), lock = readJson(path.join(repo, dir, 'package-lock.json'));
    for (const [kind, deps] of [['dep', p.dependencies], ['dev', p.devDependencies]]) for (const [name, range] of Object.entries(deps || {})) {
      const lp = lock && lock.packages && lock.packages['node_modules/' + name];
      const e = npm.get(name) || npm.set(name, { name, versions: new Set(), license: null, usedBy: new Set(), dev: true }).get(name);
      e.versions.add((lp && lp.version) || range); e.usedBy.add(dir === '.' ? '' : dir); if (kind === 'dep') e.dev = false;
      if (lp && lp.license && !e.license) e.license = typeof lp.license === 'string' ? lp.license : lp.license.type || null;
    }
  }

  const mcp = new Map();
  for (const s of settings) {
    if (!s) continue;
    for (const name of Object.keys(s.mcpServers || {})) (mcp.get(name) || mcp.set(name, { name, from: new Set() }).get(name)).from.add('mcpServers');
    for (const rule of [...((s.permissions || {}).allow || [])]) { const m = /^mcp__([^_][\w-]*?)__/.exec(rule); if (m) (mcp.get(m[1]) || mcp.set(m[1], { name: m[1], from: new Set() }).get(m[1])).from.add('allowed tools'); }
  }
  return { vendor, npm: [...npm.values()].map(e => ({ ...e, versions: [...e.versions].sort(), usedBy: [...e.usedBy].sort() })).sort((a, b) => (a.name < b.name ? -1 : 1)),
    mcp: [...mcp.values()].map(e => ({ name: e.name, from: [...e.from].sort() })).sort((a, b) => (a.name < b.name ? -1 : 1)) };
}

function layer({ vendor = [], npm = [], mcp = [] } = {}) {
  const nodes = [], edges = [];
  const add = n => nodes.push({ layer: 'O', t: '', tier: '', own: [], lane: n.kind, ...n });
  for (const v of vendor) {
    add({ id: 'O:vendor.' + v.slug, kind: v.mode === 'reference' ? 'reference' : 'vendored', title: [v.name, v.aspect].filter(Boolean).join(' · '),
      brief: [v.repo, v.source === 'npm' ? `npm ${v.ref}` : `${v.refType} ${v.ref}`.trim(), v.license || 'licence unknown', v.mode, v.usedBy.length ? `used by ${v.usedBy.length} file${v.usedBy.length > 1 ? 's' : ''}` : 'no code uses it yet', v.docs.length ? `${v.docs.length} doc${v.docs.length > 1 ? 's' : ''} mention it` : ''].filter(Boolean).join(' · '),
      state: v.license || 'unknown', lane: v.aspect || 'other', own: ['vendor:' + v.slug], text: [v.name, v.repo, ...v.usedBy, ...v.docs].join('\n'),
      extra: { mode: v.mode, source: v.source, ref: v.ref, refType: v.refType, license: v.license, usedBy: v.usedBy, docs: v.docs, aspect: v.aspect } });
  }
  for (const p of npm) add({ id: 'O:npm.' + p.name, kind: 'npm package', title: p.name, brief: [p.versions.join(', '), p.license || 'licence not in a lockfile', p.dev ? 'dev only' : '', 'in ' + p.usedBy.map(d => d || '(root)').join(', ')].filter(Boolean).join(' · '),
    state: p.license || '', lane: p.dev ? 'npm dev' : 'npm', own: ['npm:' + p.name], text: [p.name, ...p.usedBy.filter(Boolean).map(d => d + '/package.json')].join('\n'), extra: { license: p.license, versions: p.versions, usedBy: p.usedBy, dev: p.dev } });
  for (const m of mcp) add({ id: 'O:mcp.' + m.name, kind: 'mcp server', title: m.name, brief: 'named in the settings: ' + m.from.join(', '), state: '', lane: 'mcp', own: ['mcp:' + m.name], text: m.name, extra: { from: m.from } });
  return { nodes, edges };
}

// CLAUDE.md "Vendored third-party code": a source pinned to a branch; copyleft in code we copy and use; a licence unknown
function checks(list) {
  const O = list.filter(n => n.layer === 'O' && n.extra);
  return {
    branch: O.filter(n => n.extra.source === 'git' && n.extra.mode === 'fetch' && n.extra.refType !== 'tag'),   // fetched as source: a tag (CLAUDE.md); an npm-mode one pins its version in package.json
    copyleft: O.filter(n => n.extra.license && COPYLEFT.test(n.extra.license) && !/\bOR\b/.test(n.extra.license) && n.extra.mode !== 'reference' && ((n.extra.usedBy || []).length || n.kind === 'npm package')),
    unknown: O.filter(n => (n.kind === 'vendored' || n.kind === 'reference') && !licenceOk(n.extra.license)),
  };
}

// which tracked files name a component: `Vendor/<target>` (a path) or `'Vendor', '<target>'` (path.join). One `git grep`
// for all targets, then each hit file read once; code files are its users, a document (.md, .txt) only mentions it.
// gitArgs(args) → stdout of `git <args>` in the repo (lib/common.js git)
const DOC = /\.(md|txt)$/i;
function grepper(repo, gitArgs) {
  return targets => {
    const out = {}; if (!targets.length) return out;
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pre = 'Vendor([/\\\\]|["\'`] *, *["\'`])', post = '([/\\\\"\'`]|$)';
    let s = '';
    try { s = gitArgs(['-c', 'core.quotepath=off', 'grep', '-l', '-z', '-I', '-E', pre + '(' + targets.map(esc).join('|') + ')' + post, '--', '.', ':!Vendor', ':!vendor-manifest.json']); }
    catch (e) { s = (e && e.stdout) || ''; }   // git grep exits 1 when nothing matches
    for (const f of String(s).split('\0').filter(Boolean)) {
      let t = ''; try { t = fs.readFileSync(path.join(repo, f), 'utf8'); } catch { continue; }
      for (const x of targets) if (new RegExp(pre + esc(x) + post).test(t)) { const o = out[x] || (out[x] = { code: [], docs: [] }); (DOC.test(f) ? o.docs : o.code).push(f); }
    }
    return out;
  };
}

module.exports = { read, layer, checks, licenceOk, grepper };
