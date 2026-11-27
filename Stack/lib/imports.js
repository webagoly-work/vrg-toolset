// VRG Stack — Függőségek, the import graph inside C (ROADMAP 2.8, RULES §6b, STRINGS-PLAN §5: "a sub-layer of C"):
// which file requires which, so `stack.js path`, impact analysis and the strings reach below folders.
//
//   scan(files, read) → { edges: [[from, to, how]], broken: [[from, spec, how]] }     pure over the tracked files
//     JS (.js .mjs .cjs .ts)  require('…'), import … from '…', import('…'), export … from '…', and
//                             require(path.join(__dirname, '…', '…')) with literal parts
//     HTML                    <script src="…">, <link href="….css">
//     CSS                     @import '…' / url(…)
//     PowerShell              . "$PSScriptRoot\x.ps1", & "$PSScriptRoot\…", -File …\x.ps1
//     Arduino .ino / .h       #include "x.h"
//   Only relative specs (./ ../ a sibling name for HTML, CSS, #include) are followed; a package name is O's (npm).
//   A spec resolves to a tracked file (as written, + .js .mjs .cjs .ts /index.js). One that resolves to none (missing,
//   or present but not committed yet) is
//   broken, unless it points into what a build writes or git ignores (out/ dist/ data/ node_modules/ Vendor/ build/,
//   or any path `git check-ignore` names), is a library header (#include), or is no statement of its own (an import
//   quoted in a test fixture, a dynamic import() run in a browser page).
//   layer(scan, folders) → { nodes, edges }
//     C:<file>   kind 'file', only for a file with an import in or out; own p:<file>, so a text naming the file now
//                links to the file, not only its folder; ← its folder 'contains'
//     C:<file> → C:<file>       'imports' (how: require / import / script / link / css / ps1 / include)
//     C:<folder> → C:<folder>   'depends', w = how many file imports cross between them
//   cycles(edges) → [[file …]]   import cycles (DRIFT §20)
'use strict';

const path = require('path');

const CODE = /\.(js|mjs|cjs|ts|html?|css|ps1|psm1|ino|h|hpp)$/i;
const SKIP = /^(Vendor|node_modules|Archive\/files)\/|\/(node_modules|dist|vendor)\/|\.min\.(js|css)$|(^|\/)(package-lock)\.json$/;
const GENERATED = /(^|\/)(out|dist|data|node_modules|Vendor|vendor|build|\.cache)\//;

function specsOf(file, text) {
  const ext = path.posix.extname(file).toLowerCase(), out = [];
  // strict: the match is a statement of its own (a line that starts with import / export, or `const x = require(…)`);
  // only a strict one can be reported broken — an import quoted in a test fixture or run in a browser page is not
  const lineOf = i => text.slice(text.lastIndexOf('\n', i) + 1, i);
  const push = (spec, how, strict = true) => { if (spec) out.push([spec.trim(), how, strict]); };
  const stmt = (m, rx) => rx.test(lineOf(m.index));
  const REQ = /^\s*(?:(?:const|let|var)\s+[\w${}\s,:]+=\s*)?$/, IMP = /^\s*$/;
  if (/^\.(js|mjs|cjs|ts)$/.test(ext)) {
    for (const m of text.matchAll(/\brequire\(\s*(['"`])([^'"`]+)\1\s*\)/g)) push(m[2], 'require', stmt(m, REQ));
    for (const m of text.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"`])([^'"`]+)\1/g)) push(m[2], 'import', stmt(m, IMP));
    for (const m of text.matchAll(/\bimport\s*(['"])([^'"]+)\1/g)) push(m[2], 'import', stmt(m, IMP));
    for (const m of text.matchAll(/\bimport\(\s*(['"`])([^'"`]+)\1\s*\)/g)) push(m[2], 'import', false);
    for (const m of text.matchAll(/\brequire\(\s*path\.(?:join|resolve)\(\s*__dirname\s*((?:,\s*(['"])[^'"]+\2\s*)+)\)\s*\)/g)) {
      const parts = [...m[1].matchAll(/(['"])([^'"]+)\1/g)].map(x => x[2]); push('./' + parts.join('/'), 'require', stmt(m, REQ));
    }
  } else if (/^\.html?$/.test(ext)) {
    for (const m of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1/gi)) push(m[2], 'script');
    for (const m of text.matchAll(/<link\b[^>]*\bhref\s*=\s*(['"])([^'"]+\.css(?:\?[^'"]*)?)\1/gi)) push(m[2], 'link');
  } else if (ext === '.css') {
    for (const m of text.matchAll(/@import\s+(?:url\()?\s*(['"])([^'"]+)\1/g)) push(m[2], 'css');
  } else if (/^\.psm?1$/.test(ext)) {
    for (const m of text.matchAll(/(?:^|\s)[.&]\s+["']?\$PSScriptRoot[\\/]([^"'\s]+\.psm?1)/gim)) push('./' + m[1].replace(/\\/g, '/'), 'ps1');
    for (const m of text.matchAll(/-File\s+["']?\$PSScriptRoot[\\/]([^"'\s]+\.ps1)/gi)) push('./' + m[1].replace(/\\/g, '/'), 'ps1');
  } else if (/^\.(ino|h|hpp)$/.test(ext)) {
    for (const m of text.matchAll(/^\s*#include\s+"([^"]+)"/gm)) push(m[1], 'include');
  }
  return out;
}

function resolve(from, spec, has) {
  if (/^[a-z][\w+.-]*:|^\/\/|^#|^data:/i.test(spec)) return { skip: true };            // a URL, an anchor, a data: URI
  const html = /\.(html?|css|ino|h|hpp)$/i.test(from);
  if (!/^\.{1,2}\//.test(spec) && !(html && !spec.startsWith('/') && !/^@/.test(spec))) return { skip: true };   // a package (O's)
  if (/\$\{|\{\{/.test(spec)) return { skip: true };                                      // a template
  const clean = spec.replace(/[?#].*$/, '');
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  if (base.startsWith('..')) return { skip: true };                                       // outside the repo (H:\VRG\Full\…)
  for (const c of [base, base + '.js', base + '.mjs', base + '.cjs', base + '.ts', base + '/index.js']) if (has(c)) return { to: c };
  if (GENERATED.test(base + '/') || GENERATED.test(base)) return { skip: true };          // what a build writes or git ignores
  if (/\.(ino|h|hpp)$/i.test(from)) return { skip: true };                                // #include "USB.h": a library header
  return { broken: true, base };
}

// ignored(paths) → the subset git ignores (a generated file a page loads: Dashboard/dashboard-data.js); default none
function scan(files, read, { ignored = () => new Set() } = {}) {
  const tracked = new Set(files), has = f => tracked.has(f);
  const edges = [], broken = [], seen = new Set();
  for (const f of files) {
    if (!CODE.test(f) || SKIP.test(f)) continue;
    const text = read(f); if (!text || text.length > 3e6) continue;
    for (const [spec, how, strict] of specsOf(f, text)) {
      const r = resolve(f, spec, has);
      if (r.to && r.to !== f) { const k = f + '>' + r.to; if (!seen.has(k)) { seen.add(k); edges.push([f, r.to, how]); } }
      else if (r.broken && strict) broken.push([f, spec, how, r.base]);
    }
  }
  const ign = broken.length ? ignored([...new Set(broken.map(b => b[3]))]) : new Set();
  return { edges, broken: broken.filter(b => !ign.has(b[3])).map(b => b.slice(0, 3)) };
}

// folders: the C adapter's folder node ids (without 'C:'); a file hangs from the deepest one above it
function layer({ edges = [], broken = [] } = {}, folders = new Set()) {
  const nodes = [], out = [], deg = new Map();
  const bump = (f, k) => { const d = deg.get(f) || deg.set(f, { in: 0, out: 0, broken: 0 }).get(f); d[k]++; };
  for (const [a, b] of edges) { bump(a, 'out'); bump(b, 'in'); }
  for (const [a] of broken) bump(a, 'broken');
  const folderOf = f => { for (let d = path.posix.dirname(f); d && d !== '.'; d = d.includes('/') ? path.posix.dirname(d) : '') if (folders.has(d)) return d; return ''; };
  for (const [f, d] of [...deg].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const dir = folderOf(f);
    nodes.push({ id: 'C:' + f, layer: 'C', kind: 'file', title: f, brief: `imports ${d.out} · imported by ${d.in}${d.broken ? ` · ${d.broken} broken` : ''}`,
      state: d.broken ? 'broken import' : '', t: '', tier: '', lane: dir || '(root)', own: ['p:' + f], text: f.replace(/[\/_\-.]/g, ' '), extra: { path: f, in: d.in, out: d.out, broken: d.broken } });
    if (dir) out.push({ a: 'C:' + dir, b: 'C:' + f, rel: 'contains' });
  }
  const cross = new Map();
  for (const [a, b, how] of edges) {
    out.push({ a: 'C:' + a, b: 'C:' + b, rel: 'imports', how });
    const fa = folderOf(a), fb = folderOf(b);
    if (fa && fb && fa !== fb) { const k = fa + '>' + fb; cross.set(k, (cross.get(k) || 0) + 1); }
  }
  for (const [k, w] of cross) { const [a, b] = k.split('>'); out.push({ a: 'C:' + a, b: 'C:' + b, rel: 'depends', w }); }
  return { nodes, edges: out };
}

// import cycles: Tarjan's strongly connected components with more than one file
function cycles(edges) {
  const adj = new Map(); for (const [a, b] of edges) (adj.get(a) || adj.set(a, []).get(a)).push(b);
  let i = 0; const idx = new Map(), low = new Map(), on = new Set(), st = [], out = [];
  const strong = v => {
    idx.set(v, i); low.set(v, i); i++; st.push(v); on.add(v);
    for (const w of adj.get(v) || []) { if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w))); }
    if (low.get(v) === idx.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) out.push(c.sort()); }
  };
  for (const v of adj.keys()) if (!idx.has(v)) strong(v);
  return out.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
}

module.exports = { scan, layer, cycles, specsOf, resolve };
