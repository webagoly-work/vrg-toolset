#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check-start.js — keep Planner/START.cmd honest.
//
// START.cmd is the single entry point to the whole toolset, so a tool that is
// missing from it effectively does not exist for the person at the keyboard,
// and an entry pointing at a moved file is worse: the launcher looks fine
// until someone picks that number.
//
// This checks three things:
//   1. every registered T<n>_PATH resolves to a file on disk
//   2. TOOLCOUNT matches the number of registry entries actually defined
//   3. no obvious tool page in the repo is missing from the registry
//
//   node tools/check-start.js
//
// Exit code 1 if anything is wrong, so it can gate a commit.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PLANNER = path.join(REPO, 'Planner');
const START = path.join(PLANNER, 'START.cmd');
const BS = String.fromCharCode(92);

/* Where a tool page can plausibly live. Anything matching here but absent
   from the registry is reported — it is the "you added a tool and forgot the
   launcher" case, which is the whole reason this script exists. */
const TOOL_GLOBS = [
  { dir: '.', depth: 0 },
  { dir: 'Calculator', depth: 0 },
  { dir: 'MindMap', depth: 0 },
  { dir: 'Modder', depth: 0 },
  { dir: 'Toolbox', depth: 0 },
  { dir: 'Inventory/dist', depth: 0 },
  { dir: 'Planner/projects/varler-planner/dist', depth: 0 }
];

/* Not tools, whatever their extension says. */
const IGNORE = [
  /\.backup-/i,          // vrg_mindmap.backup-<stamp>.html
  /^varler_mindmd2\.html$/i,   // the dead MindMap ancestor, kept on purpose
  /^index\.html$/i,
  /node_modules/,
  /^Vendor[\\/]/
];

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { console.error('Nem olvasható: ' + file); process.exit(1); }
}

function listHtml(rel) {
  const dir = path.join(REPO, rel);
  let out = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!/\.html?$/i.test(name)) continue;
      const relPath = path.join(rel, name).split(path.sep).join('/');
      if (IGNORE.some(re => re.test(name) || re.test(relPath))) continue;
      out.push(relPath.replace(/^\.\//, ''));
    }
  } catch (e) { /* a folder that does not exist is simply not a source of tools */ }
  return out;
}

const src = read(START);
const problems = [];
const notes = [];

// --- 1 + 2: the registry itself -------------------------------------------
const declared = +((/^set "TOOLCOUNT=(\d+)"/m.exec(src)) || [])[1];
if (!declared) problems.push('TOOLCOUNT nincs megadva a START.cmd-ben.');

const entries = [];
for (let i = 1; i <= 99; i++) {
  const nm = (new RegExp('^set "T' + i + '_NAME=(.*)"', 'm').exec(src) || [])[1];
  const p = (new RegExp('^set "T' + i + '_PATH=(.*)"', 'm').exec(src) || [])[1];
  if (!nm && !p) continue;
  if (nm && !p) { problems.push('T' + i + ' neve megvan, de nincs T' + i + '_PATH.'); continue; }
  if (p && !nm) { problems.push('T' + i + ' útvonala megvan, de nincs T' + i + '_NAME.'); continue; }
  entries.push({ n: i, name: nm, p });
}

if (declared && entries.length !== declared) {
  problems.push('TOOLCOUNT=' + declared + ', de ' + entries.length + ' eszköz van definiálva. ' +
    'Aki a TOOLCOUNT fölé esik, azt a menü sosem mutatja meg.');
}

const registered = new Set();
for (const e of entries) {
  const abs = path.resolve(PLANNER, e.p.split(BS).join(path.sep));
  registered.add(path.relative(REPO, abs).split(path.sep).join('/'));
  if (!fs.existsSync(abs)) {
    problems.push('T' + e.n + ' (' + e.name + ') nem létező fájlra mutat:\n      ' + e.p);
  }
}

// --- 3: tools the registry has never heard of ------------------------------
const found = [];
for (const g of TOOL_GLOBS) found.push(...listHtml(g.dir));
for (const f of found) {
  if (!registered.has(f)) notes.push(f);
}

// --- report ----------------------------------------------------------------
console.log('START.cmd: ' + entries.length + ' eszköz, TOOLCOUNT=' + (declared || '?'));
for (const e of entries) {
  const abs = path.resolve(PLANNER, e.p.split(BS).join(path.sep));
  console.log('  ' + (fs.existsSync(abs) ? 'ok     ' : 'HIÁNYZIK') +
    ' T' + String(e.n).padEnd(3) + String(e.name).slice(0, 44).padEnd(46) + e.p);
}

if (notes.length) {
  console.log('\nEzek a lapok nincsenek a menüben — szándékos, vagy kimaradtak?');
  for (const f of notes) console.log('   ? ' + f);
}

if (problems.length) {
  console.log('\n' + problems.length + ' hiba:');
  for (const p of problems) console.log('  - ' + p);
  process.exitCode = 1;
} else {
  console.log('\nRendben: minden bejegyzés létező fájlra mutat.');
}
