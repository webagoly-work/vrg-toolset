// Builds a reduced VRG Stack dataset from the repo checkout alone (no transcripts / memory / DevLog).
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const REPO = process.argv[2], OUT = process.argv[3];
const sh = c => execSync(c, { cwd: REPO, maxBuffer: 1 << 28 }).toString();
const files = sh('git ls-files -z').split('\0').filter(Boolean);
const ent = JSON.parse(fs.readFileSync(path.join(REPO, 'Stack/entities.json'), 'utf8'));
const nodes = [], idx = new Map(), edges = [];
const add = (id, L, kind, title, bytes, extra) => { idx.set(id, nodes.length); nodes.push(Object.assign({ id, L, kind, title, b: bytes }, extra || {})); return nodes.length - 1; };
const link = (a, b, v) => { if (idx.has(a) && idx.has(b)) edges.push([idx.get(a), idx.get(b), v]); };
function layerOf(f) {
  const b = path.basename(f);
  if (/^GO-.*\.md$/.test(b) && !f.includes('/')) return ['L', 'line'];
  if (/DECISIONS\.md$/.test(b)) return ['Q', 'decision file'];
  if (f.startsWith('.claude/agents/')) return ['A', 'agent'];
  if (f.startsWith('.claude/')) return ['A', 'house rules'];
  if (b === 'CLAUDE.md') return ['A', 'house rules'];
  if (/\.(md|txt)$/i.test(b)) return f.startsWith('docs/research') ? ['I', 'idea'] : ['G', 'document'];
  if (/\.html?$/i.test(b) && !/(test|fixture|dist)/.test(f)) return ['F', 'app'];
  if (/\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|mp3|wav|pdf)$/i.test(b)) return ['F', 'asset'];
  if (/^(tools|launcher)\//.test(f)) return ['A', 'tool'];
  return ['C', 'code'];
}
const pillarOf = f => { for (const p of ent.pillars) for (const q of p.paths || []) if (f === q || f.startsWith(q + '/')) return p.id; return ''; };
for (const f of files) {
  let b = 0; try { b = fs.statSync(path.join(REPO, f)).size; } catch (e) { continue; }
  const [L, kind] = layerOf(f);
  add('C:' + f, L, kind, f, b, { p: pillarOf(f) });
}
for (const p of ent.pillars) { add('E:' + p.id, 'E', 'pillar', p.name, 2048, { area: p.area, p: p.id }); }
for (const n of nodes.slice()) if (n.p && n.L !== 'E') link('E:' + n.p, n.id, 'pillar');
// decisions: every Q id defined in a DECISIONS file (table row)
for (const f of files.filter(f => /DECISIONS\.md$/.test(f))) {
  const t = fs.readFileSync(path.join(REPO, f), 'utf8');
  for (const m of t.matchAll(/^\|\s*\**([A-Z][A-Z0-9]*-Q\d+[a-z]?)\**\s*\|([^|\n]*)\|([^|\n]*)/gm)) {
    const id = 'Q:' + m[1]; if (idx.has(id)) continue;
    const open = /nyitott|open|\?\s*$/i.test(m[3]) && !/\*\*[A-D]\*\*/.test(m[3]);
    add(id, 'Q', 'decision', m[1] + ' ' + m[2].trim().slice(0, 70), 600, { open: open ? 1 : 0 });
    link(id, 'C:' + f, 'in');
  }
}
// GO lines mention paths
const fileSet = new Set(files);
for (const f of files.filter(f => /^GO-.*\.md$/.test(f))) {
  const t = fs.readFileSync(path.join(REPO, f), 'utf8');
  const seen = new Set();
  for (const m of t.matchAll(/`([A-Za-z0-9_\-./]+\.[a-z]{1,5})`/g)) { const q = m[1].replace(/^\.\//, ''); if (fileSet.has(q) && !seen.has(q)) { seen.add(q); link('C:' + f, 'C:' + q, 'names'); } }
  for (const m of t.matchAll(/\b([A-Z][A-Z0-9]*-Q\d+)\b/g)) link('C:' + f, 'Q:' + m[1], 'asks');
}
// commits
const log = sh("git log --format='@@%h|%ad|%an|%P|%s' --date=iso-strict --name-only");
const commits = [];
for (const blk of log.split('@@').filter(Boolean)) {
  const [head, ...rest] = blk.split('\n'); const [h, d, an, par, ...s] = head.split('|');
  const fl = rest.map(x => x.trim()).filter(Boolean);
  commits.push({ h, d, s: s.join('|'), par: par.split(' ').filter(Boolean).length, fl });
}
commits.reverse();
for (const c of commits) {
  add('R:' + c.h, 'R', c.par > 1 ? 'merge' : 'commit', c.h + ' ' + c.s.slice(0, 90), 400 + 60 * c.fl.length, { t: c.d });
  for (const f of c.fl) link('R:' + c.h, 'C:' + f, 'touches');
  for (const m of c.s.matchAll(/\b([A-Z][A-Z0-9]*-Q\d+)\b/g)) link('R:' + c.h, 'Q:' + m[1], 'answers');
}
const used = new Set(); edges.forEach(e => { used.add(e[0]); used.add(e[1]); });
const cols = ['id', 'L', 'kind', 'title', 'b', 'p', 't', 'open', 'area'];
const out = {
  about: 'Reduced VRG Stack, from the repo checkout only (git ls-files + git log + entities.json + DECISIONS files). No transcripts, memory, runs or DevLog harvest: U is empty.',
  head: commits[commits.length - 1].h, built: new Date().toISOString().slice(0, 16), cols,
  nodes: nodes.map(n => cols.map(c => n[c] == null ? '' : n[c])), edges: edges.flat(), commits: commits.map(c => [c.h, c.d, c.s.slice(0, 110), c.fl.map(f => idx.get('C:' + f) ?? -1).filter(i => i >= 0)]),
  areas: ent.areas, pillars: ent.pillars.map(p => [p.id, p.name, p.area]),
};
const s = 'window.STK=' + JSON.stringify(out) + ';';
fs.writeFileSync(OUT, s);
const byL = {}; nodes.forEach(n => byL[n.L] = (byL[n.L] || 0) + 1);
console.log('nodes', nodes.length, byL, 'edges', edges.length, 'commits', commits.length, 'bytes', s.length);
