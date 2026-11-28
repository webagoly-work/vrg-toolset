#!/usr/bin/env node
// VRG Stack — a layer letter means one layer on every branch (STK-P214).
//
//   node tools/check-layer-letters.js [--remote origin] [--all]
//
// The K collision (main's Kisokos and an unmerged branch's Kérések both took K, STK-P212) was found only when the two
// met in a merge. This check finds it while both are still open: it reads this checkout's layer table and the layer
// list on the tip of every branch on the remote, and fails when one letter names two different layers.
//
// Every branch, old or new, lists its layers in Stack/lib/meta.js as `{ code: 'X', id: 'name', …`, so that file is
// read as text (`git show`), never run. Branches already merged into the remote's main are skipped (with --all they
// are checked too); so are the data branches (city-pages, stack-pages, …), which carry no Stack.
// Also checked here: the table itself (schema/layers.js) has no letter twice, and agrees with meta.js.
// Exit 0 when every letter is unambiguous, 1 when not (each clash names the branches), 2 when it cannot run.
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const META = 'Stack/lib/meta.js';
const DATA_BRANCHES = /^(city-pages|stack-pages|solomon-data|mobile-log)$/;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REMOTE = arg('--remote', 'origin'), ALL = process.argv.includes('--all');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });

// letter → layer id, from a meta.js text (no code is run)
function lettersOf(text) {
  const map = new Map();
  for (const m of String(text).matchAll(/\{\s*code:\s*'([A-Z])',\s*id:\s*'([\w-]+)'/g)) {
    if (map.has(m[1]) && map.get(m[1]) !== m[2]) map.set(m[1], map.get(m[1]) + '|' + m[2]);
    else map.set(m[1], m[2]);
  }
  return map;
}

function main() {
  const problems = [], notes = [];

  // 1. this checkout: the table and meta.js agree, and no letter is used twice
  const T = require(path.join(ROOT, 'Stack', 'schema', 'layers.js'));
  const codes = T.LIST.map(l => l.code);
  for (const c of codes) if (codes.indexOf(c) !== codes.lastIndexOf(c)) problems.push(`schema/layers.js: ${c} is in the table twice`);
  const fs = require('fs');
  const mine = lettersOf(fs.readFileSync(path.join(ROOT, META), 'utf8'));
  for (const [c, id] of mine) {
    if (id.includes('|')) problems.push(`${META}: ${c} is used by ${id.split('|').join(' and ')}`);
    if (!T.BY[c]) problems.push(`${META}: ${c} (${id}) is not in schema/layers.js`);
  }
  for (const c of T.MASK) if (!mine.has(c)) problems.push(`schema/layers.js: ${c} has no row in ${META}`);

  // 2. every branch on the remote
  let refs;
  try { refs = git('for-each-ref', '--format=%(refname:short)', `refs/remotes/${REMOTE}`).split('\n').filter(Boolean); }
  catch (e) { console.error(`check-layer-letters: cannot list ${REMOTE}'s branches: ${e.message.split('\n')[0]}`); return 2; }
  const main = `${REMOTE}/main`;
  if (!refs.includes(main)) { console.error(`check-layer-letters: ${main} is not fetched (git fetch ${REMOTE})`); return 2; }
  const seen = new Map();   // letter → id → [branches]
  const add = (c, id, b) => { if (!seen.has(c)) seen.set(c, new Map()); const m = seen.get(c); (m.get(id) || m.set(id, []).get(id)).push(b); };
  for (const [c, id] of mine) add(c, id, '(this checkout)');
  let read = 0, merged = 0, without = 0;
  for (const ref of refs) {
    const name = ref.slice(REMOTE.length + 1);
    if (name === 'HEAD' || DATA_BRANCHES.test(name)) continue;
    if (!ALL && ref !== main) {
      try { git('merge-base', '--is-ancestor', ref, main); merged++; continue; } catch (e) { /* not merged: check it */ }
    }
    let text;
    try { text = git('show', `${ref}:${META}`); } catch (e) { without++; continue; }   // a branch from before the Stack
    read++;
    for (const [c, id] of lettersOf(text)) for (const one of id.split('|')) add(c, one, name);
  }

  // 3. a letter with two ids is a clash, but only when this checkout is one side of it (a clash between two other
  //    branches is theirs to settle; it is listed, not failed)
  for (const [c, ids] of [...seen].sort()) {
    if (ids.size < 2) continue;
    const lines = [...ids].map(([id, bs]) => `    ${id}: ${bs.slice(0, 6).join(', ')}${bs.length > 6 ? ` … +${bs.length - 6}` : ''}`);
    const ours = [...ids.values()].some(bs => bs.includes('(this checkout)'));
    (ours ? problems : notes).push(`layer letter ${c} means ${ids.size} different layers:\n${lines.join('\n')}`);
  }

  console.log(`check-layer-letters: ${codes.length} letters in the table; ${read} branches read, ${merged} merged into main skipped, ${without} without a Stack`);
  for (const n of notes) console.log('note (between other branches): ' + n);
  if (problems.length) {
    for (const p of problems) console.log('FAIL ' + p);
    console.log('Give the newer layer a free letter (schema/layers.js and lib/meta.js), or merge the other branch first.');
    return 1;
  }
  console.log('ok: every layer letter means one layer');
  return 0;
}

process.exitCode = main();
