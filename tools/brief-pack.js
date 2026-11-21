#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/brief-pack.js — rebuild docs/brief/PACK-A.md and PACK-B.md from their sources (fork F10, 2026-11-21).
// A pack is the brief followed by the system description, so one upload is enough for a fresh design session.
//
//   node tools/brief-pack.js           write both packs, then run tools/anon-check.js (exit 1 on a hit)
//   node tools/brief-pack.js --check   exit 1 when a pack is stale (does not write)
//
// Never edit a PACK file by hand: edit BRIEF-x.md / SYSTEM-x.md and re-run this.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'docs', 'brief');
const CHECK = process.argv.includes('--check');
let stale = 0;

for (const v of ['A', 'B']) {
  const brief = fs.readFileSync(path.join(DIR, 'BRIEF-' + v + '.md'), 'utf8').trim();
  const system = fs.readFileSync(path.join(DIR, 'SYSTEM-' + v + '.md'), 'utf8').trim();
  const out = [
    '<!-- Generated from BRIEF-' + v + '.md + SYSTEM-' + v + '.md. Do not edit; re-run the pack generator. -->',
    '',
    brief,
    '',
    '---',
    '',
    '<!-- ===================== PART 2: THE SYSTEM DESCRIPTION ===================== -->',
    '',
    system,
    '',
  ].join('\n');
  const file = path.join(DIR, 'PACK-' + v + '.md');
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (CHECK) {
    if (old !== out) { console.log('stale: PACK-' + v + '.md'); stale++; } else console.log('fresh: PACK-' + v + '.md');
    continue;
  }
  fs.writeFileSync(file, out);
  console.log('wrote PACK-' + v + '.md (' + Buffer.byteLength(out) + ' bytes, ' + out.split(/\s+/).filter(Boolean).length + ' words)');
}
if (CHECK) process.exit(stale ? 1 : 0);
const r = spawnSync(process.execPath, [path.join(__dirname, 'anon-check.js')], { stdio: 'inherit' });
process.exit(r.status || 0);
