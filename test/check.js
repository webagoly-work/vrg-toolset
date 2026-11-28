#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check.js - VRG Containment, static checks that run anywhere Node does
// (test/selftest.ps1 runs the PowerShell itself, on Windows).
//
//   node Containment/test/check.js
//
// 1. profiles.json and sources.json open with their { format, version }
// 2. every profile has a unique id, a name, a hint and boolean switches;
//    the default profile exists; every field the scripts read is declared
// 3. the .cmd launchers have CRLF line endings
// 4. the .ps1 files are ASCII, BOM-less, and use no PowerShell 7-only syntax
// 5. the .gitignore keeps runtime/ and the exchange folders out of git
// Exit 1 on any failure.
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

const KIT = path.resolve(__dirname, '..');
let fails = 0;
function check(ok, what) {
  console.log((ok ? '  ok    ' : '  FAIL  ') + what);
  if (!ok) fails++;
}
function read(rel) { return fs.readFileSync(path.join(KIT, rel)); }

// 1-2. formats and profiles
const profiles = JSON.parse(read('profiles.json'));
check(profiles.format === 'vrg-containment-profiles' && profiles.version === 1, 'profiles.json: format + version');
const sources = JSON.parse(read('sources.json'));
check(sources.format === 'vrg-containment-sources' && sources.version === 1, 'sources.json: format + version');
check(!!(sources.qemu && sources.qemu.index && sources.qemu.pattern && sources.qemu.signer), 'sources.json: qemu index, pattern, signer');
check(!!(sources.guest && sources.guest.base && sources.guest.sums && sources.guest.pattern), 'sources.json: guest base, sums, pattern');
for (const k of ['qemu', 'guest']) {
  const pin = sources[k] && sources[k].pin;
  check(pin === null || /^https:\/\//.test(pin), 'sources.json: ' + k + '.pin is null or an https URL');
  try { new RegExp(sources[k].pattern); check(true, 'sources.json: ' + k + '.pattern is a valid regex'); }
  catch (e) { check(false, 'sources.json: ' + k + '.pattern is a valid regex (' + e.message + ')'); }
}

const FLAGS = ['network', 'clipboard', 'printer', 'vgpu', 'audioIn', 'videoIn', 'inbox', 'outbox'];
const NUMS = ['memoryMB', 'cpus'];
const ids = new Set();
for (const p of profiles.profiles) {
  check(/^[a-z][a-z0-9-]*$/.test(p.id) && !ids.has(p.id), 'profile ' + p.id + ': unique lowercase id');
  ids.add(p.id);
  check(typeof p.name === 'string' && typeof p.hint === 'string', 'profile ' + p.id + ': name and hint');
  check(/^[\x20-\x7e]*$/.test(p.name + p.hint), 'profile ' + p.id + ': name and hint are ASCII (the console shows them)');
  for (const f of FLAGS) check(typeof p[f] === 'boolean', 'profile ' + p.id + ': ' + f + ' is true/false');
  for (const f of NUMS) check(Number.isInteger(p[f]) && p[f] > 0, 'profile ' + p.id + ': ' + f + ' is a positive integer');
  const known = new Set(['id', 'name', 'hint', ...FLAGS, ...NUMS]);
  const extra = Object.keys(p).filter(k => !known.has(k));
  check(extra.length === 0, 'profile ' + p.id + ': no unknown fields' + (extra.length ? ' (' + extra.join(', ') + ')' : ''));
}
check(ids.has(profiles.default), 'the default profile "' + profiles.default + '" exists');
check(profiles.profiles.length <= 4, 'at most 4 profiles (the menu numbers both modes 1..8)');
const q = profiles.profiles.find(p => p.id === 'quarantine');
check(!!q && !q.network && !q.clipboard, 'quarantine has no network and no clipboard');

// Fields the scripts read from a profile ($box.x or Get-Flag $box 'x') must be declared.
const lib = read('core/contain-lib.ps1').toString('latin1');
const used = new Set();
for (const m of lib.matchAll(/\$box\.([A-Za-z]+)/g)) used.add(m[1]);
for (const m of lib.matchAll(/Get-Flag \$box '([A-Za-z]+)'/g)) used.add(m[1]);
const declared = new Set(['id', 'name', 'hint', ...FLAGS, ...NUMS]);
for (const u of used) check(declared.has(u), 'contain-lib.ps1 reads profile field "' + u + '", which profiles.json declares');

// 3. CRLF
for (const n of ['CONTAIN.cmd', 'SANDBOX.cmd', 'STICK.cmd']) {
  const b = read(n);
  let lf = 0, crlf = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 10) { lf++; if (i && b[i - 1] === 13) crlf++; }
  check(lf > 0 && lf === crlf, n + ': CRLF line endings');
  check(b.toString('latin1').includes('core\\contain.ps1'), n + ': calls core\\contain.ps1');
}

// 4. PowerShell: ASCII, no BOM, Windows PowerShell 5.1 syntax
const PS7 = [
  [/\?\?/, 'the ?? operator'],
  [/\?\./, 'the ?. operator'],
  [/-AsHashtable\b/, 'ConvertFrom-Json -AsHashtable'],
  [/ForEach-Object\s+-Parallel/, 'ForEach-Object -Parallel'],
  [/\$IsWindows\b/, '$IsWindows (PowerShell 6+)'],
  [/&&|\|\|/, 'pipeline chain operators && / ||'],
  [/\bclean\s*\{/, 'a clean block']
];
for (const rel of ['core/contain-lib.ps1', 'core/contain.ps1', 'test/selftest.ps1']) {
  const b = read(rel);
  check(!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf), rel + ': no BOM');
  const bad = [...b].findIndex(c => c > 0x7e || (c < 0x20 && c !== 10 && c !== 13 && c !== 9));
  check(bad < 0, rel + ': ASCII only' + (bad >= 0 ? ' (byte ' + bad + ')' : ''));
  // Strip comments and quoted strings before looking for syntax.
  const code = b.toString('latin1').split('\n').map(l => l.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/#.*$/, '')).join('\n');
  for (const [re, what] of PS7) check(!re.test(code), rel + ': no ' + what);
  check(!/\$args\s*=/.test(code), rel + ': does not assign the automatic $args');
  check(!/\$Profile\b/.test(code), rel + ': does not use $Profile (an automatic variable)');
  let depth = 0, min = 0;
  for (const c of code) { if (c === '{') depth++; else if (c === '}') { depth--; min = Math.min(min, depth); } }
  check(depth === 0 && min === 0, rel + ': braces balance');
}

// 5. .gitignore
const gi = read('.gitignore').toString();
check(/^runtime\/$/m.test(gi), '.gitignore: runtime/');
check(/^exchange\/inbox\/\*$/m.test(gi) && /^exchange\/outbox\/\*$/m.test(gi), '.gitignore: exchange/inbox and outbox contents');

console.log('');
if (fails) { console.log(fails + ' check(s) failed.'); process.exit(1); }
console.log('All checks passed.');
