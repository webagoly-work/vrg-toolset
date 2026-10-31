#!/usr/bin/env node
// ---------------------------------------------------------------------------
// standin.js — DNA v2, the extracted half of a stand-in: what a model needs to
// make accurate guesses about a program without opening its files. It writes
// the file map, each file's purpose, the names it defines, and which files it
// leans on (the connectome). The authored half (why, invariants, seams) is
// kept by hand in docs/council/dna/authored/<id>.md and appended here.
//
//   node tools/standin.js <id> [--out dir] [--names]     one program
//   node tools/standin.js --all [--out dir]              every program below
//   node tools/standin.js --check [--out dir]            which stand-ins are stale
//
// --names lists every defined name; without it a file shows only the names
// other files use. Every fact here comes from the code at the commit in the
// header; nothing is written by a model. See docs/council/02_DNA-V2.md.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(path.dirname(REPO), '_admin', 'dna', 'standin');
const AUTHORED = path.join(REPO, 'docs', 'council', 'dna', 'authored');

const PROGRAMS = {
  planner: { t: 'Varler Planner', roots: ['Planner/projects/varler-planner/src'], shared: true },
  inventory: { t: 'VRG Inventory', roots: ['Inventory/src', 'Inventory/build', 'Inventory/tools'] },
  kapu: { t: 'VRG Kapu', roots: ['Hub/src', 'Hub/companion', 'tools/hub-admin'], shared: true },
  kodvaros: { t: 'VRG Kódváros', roots: ['CodeCity'], skip: /(^|\/)(dist|from-kapu)(\/|$)/ },
  mobile: { t: 'VRG Mobile', roots: ['Mobile/android', 'Mobile/tests'] },
  servicekit: { t: 'ServiceKit', roots: ['ServiceKit/core', 'ServiceKit/launcher'], skip: /launcher\/data\//, big: 90000 },
  launcher: { t: 'START launcher', roots: ['launcher'] },
  firmware: { t: 'Firmware', roots: ['Firmware'] },
};
const CODE = /\.(js|mjs|cjs|ps1|py|kt|ino|h|cpp)$/i;
const NOISE = new Set(['function', 'return', 'const', 'length', 'value', 'state', 'index', 'items', 'width', 'height', 'label', 'event']);

const git = args => execFileSync('git', args, { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
const tokens = n => Math.ceil(n / 4);

function usage() {
  console.error('node tools/standin.js <id> | --all | --check  [--out dir] [--names]\nids: ' + Object.keys(PROGRAMS).join(' '));
  process.exit(2);
}

function filesOf(p) {
  return git(['ls-files', ...p.roots]).split('\n')
    .filter(f => f && CODE.test(f) && !(p.skip && p.skip.test(f)) && !/\.min\.|(^|\/)(dist|build\/outputs)\//.test(f));
}

/* The stale check: a hash over the blobs of every source file at the current index. */
function fingerprint(p) {
  const blobs = git(['ls-files', '-s', ...p.roots]);
  return crypto.createHash('sha256').update(blobs).digest('hex').slice(0, 16);
}

/* Column-0 definitions only: anything indented is local to its function. */
const JS = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/gm,
  /^(?:export\s+)?class\s+([\w$]+)/gm,
  /^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=/gm,
];
const DEFS = {
  js: JS, mjs: JS, cjs: JS,
  ps1: [/^\s*function\s+([\w-]+)\s*[({]/gim],
  py: [/^(?:async\s+)?def\s+(\w+)/gm],
  kt: [/^(?:(?:private|internal|public|override|suspend|data|sealed|open)\s+)*(?:fun|class|object|interface)\s+(?:[\w<>?.]+\.)?(\w+)/gm],
  ino: [/^[A-Za-z_][\w:<>*& ]*\s+\*?([A-Za-z_]\w*)\s*\([^;]*$/gm],
  cpp: [/^[A-Za-z_][\w:<>*& ]*\s+\*?([A-Za-z_]\w*)\s*\([^;]*$/gm],
  h: [/^[A-Za-z_][\w:<>*& ]*\s+\*?([A-Za-z_]\w*)\s*\([^;]*$/gm],
};

/* The first comment in a file that says something, skipping rulers and boilerplate. */
function purpose(text) {
  const lines = text.split(/\r?\n/).slice(0, 24);
  for (const raw of lines) {
    const l = raw.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#+!?|<#)\s?/, '').trim();
    if (!/^(\/\/|\/\*|\*|#|<#)/.test(raw.trim())) continue;
    if (l.length < 12 || /^[-=_*~#\s]+$/.test(l) || /^(usr\/bin|Part of the|These files|by build\.js)/i.test(l)) continue;
    return l.replace(/^[\w.-]+\.\w+\s*[—:-]+\s*/, '').slice(0, 150);
  }
  return '';
}

function analyse(p) {
  const list = filesOf(p).map(f => {
    let text = '';
    try { text = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch { return null; }
    const defs = new Set();
    if (text.length <= (p.big || 400000) || /\.ps1$/i.test(f)) {
      for (const re of DEFS[path.extname(f).slice(1).toLowerCase()] || []) {
        for (const m of text.matchAll(re)) if (m[1].length > 2 && !NOISE.has(m[1])) defs.add(m[1]);
      }
    }
    return { f, text, bytes: text.length, lines: text.split('\n').length, defs, ids: new Set(text.match(/[A-Za-z_$][\w$-]{3,}/g) || []), why: purpose(text) };
  }).filter(Boolean);

  const owner = new Map();
  for (const m of list) for (const d of m.defs) if (!owner.has(d)) owner.set(d, m.f);
  for (const m of list) {
    const by = new Map();
    m.exported = new Set();
    for (const id of m.ids) {
      const o = owner.get(id);
      if (o && o !== m.f) by.set(o, (by.get(o) || 0) + 1);
    }
    if (!p.shared) {
      // ES modules and require(): the imports are the true edges.
      const dir = path.posix.dirname(m.f);
      for (const r of m.text.matchAll(/(?:from\s+|require\(|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
        const t = path.posix.normalize(path.posix.join(dir, r[1]));
        const hit = list.find(x => x.f === t || x.f === t + '.js' || x.f === t + '/index.js');
        if (hit) by.set(hit.f, (by.get(hit.f) || 0) + 1000);
      }
    }
    m.uses = [...by].sort((a, b) => b[1] - a[1]).filter(([, n]) => p.shared ? n >= 2 : n >= 1000).slice(0, 6).map(([k]) => k);
  }
  for (const m of list) for (const id of m.ids) { const o = owner.get(id); if (o && o !== m.f) list.find(x => x.f === o).exported.add(id); }
  return list;
}

function render(id, p, names) {
  const list = analyse(p);
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  const base = roots => roots.length === 1 ? roots[0] : '';
  const common = base(p.roots);
  const short = f => common ? f.slice(common.length + 1) : f;
  const total = list.reduce((s, m) => s + m.bytes, 0);
  const incoming = new Map();
  for (const m of list) for (const u of m.uses) incoming.set(u, (incoming.get(u) || 0) + 1);
  const hubs = [...incoming].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const out = [];
  out.push(`# Stand-in: ${p.t}`, '');
  out.push(`standin: ${id} · commit: ${head} · sources: ${fingerprint(p)} · files: ${list.length} · source bytes: ${total}`, '');
  out.push(`*Extracted from the code at that commit, not written by a model. ${p.shared ? '"Uses" comes from matching names across one shared scope, so an edge can be false; ' : '"Uses" comes from the imports; '}anything you conclude from this file is a guess until a session with the real repo confirms it.*`, '');
  if (hubs.length) {
    out.push('## Load-bearing files', '');
    out.push('Most other files lean on these, so a change here has the widest reach:', '');
    for (const [f, n] of hubs) out.push(`- \`${short(f)}\` — used by ${n} files`);
    out.push('');
  }
  out.push('## Files', '');
  for (const m of list) {
    out.push(`### ${short(m.f)} — ${m.lines} lines`);
    if (m.why) out.push(m.why);
    if (m.uses.length) out.push('Uses: ' + m.uses.map(u => path.posix.basename(short(u))).join(', '));
    const show = names ? [...m.defs] : [...m.exported];
    if (show.length) out.push((names ? 'Defines: ' : 'Others call: ') + show.slice(0, names ? 400 : 28).join(' ') + (!names && show.length > 28 ? ` … +${show.length - 28}` : ''));
    out.push('');
  }
  const authored = path.join(AUTHORED, id + '.md');
  if (fs.existsSync(authored)) out.push(fs.readFileSync(authored, 'utf8').trim(), '');
  else out.push('## Authored half', '', 'Not written yet: no why, invariants or seams for this program.', '');
  return { text: out.join('\n'), files: list.length, total };
}

function write(id, dir, names) {
  const r = render(id, PROGRAMS[id], names);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, id + (names ? '.full' : '') + '.md');
  fs.writeFileSync(file, r.text);
  const pct = (100 * r.text.length / r.total).toFixed(1);
  console.log(`${id.padEnd(11)} ${String(r.files).padStart(4)} files  ${String(tokens(r.total)).padStart(7)} tok source -> ${String(tokens(r.text.length)).padStart(6)} tok stand-in (${pct} %)  ${file}`);
}

function check(dir) {
  let stale = 0;
  for (const [id, p] of Object.entries(PROGRAMS)) {
    const file = path.join(dir, id + '.md');
    if (!fs.existsSync(file)) { console.log('missing ' + id); stale++; continue; }
    const m = /sources: ([0-9a-f]{16})/.exec(fs.readFileSync(file, 'utf8').slice(0, 600));
    const ok = m && m[1] === fingerprint(p);
    console.log((ok ? 'ok      ' : 'STALE   ') + id);
    if (!ok) stale++;
  }
  process.exit(stale ? 1 : 0);
}

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const dir = outAt >= 0 ? args[outAt + 1] : OUT;
const names = args.includes('--names');
const id = args.find((a, i) => !a.startsWith('--') && i !== outAt + 1);
if (args.includes('--check')) check(dir);
else if (args.includes('--all')) for (const k of Object.keys(PROGRAMS)) write(k, dir, names);
else if (id && PROGRAMS[id]) write(id, dir, names);
else usage();
