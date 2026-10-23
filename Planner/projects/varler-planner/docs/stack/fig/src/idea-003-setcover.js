#!/usr/bin/env node
// IDEA-003 §5 — the SmartFrame slot set-cover.
// Exact search (every subset of the candidate slots) for the cheapest slot set that covers a
// target share of the portal functions, with the risers each slot needs counted once.
// Costs are RELATIVE UNITS (Ø68 standard box + its plaster work = 1.0), not forints: they rank
// options, they do not price them. Prices live in IDEA-002 §4.
//
//   node docs/stack/fig/src/idea-003-setcover.js            -> markdown to stdout
//   node docs/stack/fig/src/idea-003-setcover.js --write    -> also writes fig/IDEA-003_setcover.md
//
// Edit the tables below, re-run, paste nothing by hand: IDEA-003 links the generated file.
'use strict';
const fs = require('fs'), path = require('path');

// ── functions at a doorway (the user's list, IDEA-003 §1, plus the CLA portal demands) ──
// w = weight. 1 = ordinary; 2 = carries a standard (STD-003 portal tier, STD-008 NTL, egress).
const F = [
  ['F01', 'lábfény spot / LED lábfény feed',          1, 'low'],
  ['F02', 'nightlight socket',                          1, 'low'],
  ['F03', 'low-zone sensor (PIR / floor ToF)',          1, 'low'],
  ['F04', 'smart endpoint switch, low flush space',     1, 'low'],
  ['F05', 'dormant parallel switch (accessible)',       1, 'low'],
  ['F06', 'socket by the door (+300)',                  1, 'low'],
  ['F07', 'light switches',                             2, 'mid'],
  ['F08', 'shutter (redőny) switch',                    1, 'mid'],
  ['F09', 'extra flush light-control panel',            1, 'mid'],
  ['F10', 'CYD room display',                           1, 'mid'],
  ['F11', 'thermostat',                                 1, 'mid'],
  ['F12', 'chest/head-height sensor node',              1, 'mid'],
  ['F13', 'smart intercom panel',                       1, 'mid'],
  ['F14', 'notification light NTL-TR',                  2, 'mid'],
  ['F15', 'door contact / door state',                  2, 'mid'],
  ['F16', 'simple audio (speaker pair)',                1, 'mid'],
  ['F17', '12 V buzzer siren',                          1, 'mid'],
  ['F18', 'corner box: S3 head, bus A/B, RS-485',       2, 'high'],
  ['F19', 'kötődoboz for normal mains',                 1, 'high'],
  ['F20', 'AC/DC adapter point',                        1, 'high'],
  ['F21', 'upper parallel smart-up point',              1, 'high'],
  ['F22', 'cross-room channel over the door',           1, 'head'],
  ['F23', 'ToF pair looking down (STD-003 P-2)',        2, 'head'],
  ['F24', 'mmWave across the opening (P-3)',            1, 'head'],
  ['F25', 'BLE proxy / swarm radio position',           1, 'high'],
  ['F26', 'acoustic pair (two mics ≈ 1 m apart)',       1, 'head'],
  ['F27', 'door-angle sensing (hinge jamb)',            1, 'mid'],
  ['F28', 'leaf cable transfer (power into the leaf)',  1, 'mid'],
  ['F29', 'vertical light line / egress marker',        1, 'mid'],
  ['F30', 'room-climate pocket (T/RH, CO₂, lux)',       1, 'mid'],
];

// ── risers: the vertical chases a slot depends on (cost counted once per set) ──
const R = {
  RL: { n: 'latch riser (ZS-t, the traditional column)', c: 1.0 },  // exists in plain work too
  RH: { n: 'hinge riser (BRIDGE zone ZS-t(h), H0 → L0)',  c: 1.6 },  // the new chase: 2.2 m
  RR: { n: 'rail stub over the head (ZW-o)',              c: 0.8 },
};

// ── candidate slots: what each can hold, its box, its relative cost, the risers it needs ──
// Heights are for the CLA reference ceiling 2850 (IDEA-003 §3). A slot covers a function only if
// the function's zone, voltage class and reach rule allow it there (§5 explains each line).
const S = [
  ['L0', 'hinge foot 250 · Ø68 deep',              1.3, ['RH'], ['F01', 'F03', 'F04', 'F29']],
  ['L1', 'latch 300 · Ø68 (mains)',                1.0, ['RL'], ['F02', 'F06']],
  ['L2', 'latch 1000 · Ø68 deep, blank',           1.3, ['RL'], ['F05', 'F04']],
  ['M1', 'latch 1150 · Ø68',                       1.0, ['RL'], ['F14', 'F15']],
  ['M2', 'latch 1300 · Chorus ONE 2–4 mod (mains)',2.5, ['RL'], ['F07', 'F08', 'F09']],
  ['M3', 'hinge 1450 · 2-gang deep / panel box',   3.0, ['RH'], ['F09', 'F10', 'F11', 'F13', 'F16']],
  ['M4', 'hinge 1600 · Ø68 deep, vented cover',    1.3, ['RH'], ['F12', 'F30', 'F27']],
  ['MJ', 'hinge jamb 1000 · transfer + reed',      1.5, ['RH'], ['F27', 'F28', 'F15']],
  ['H0', 'hinge corner 2450 · K3 200×200 hatch',   6.0, ['RH', 'RR'], ['F18', 'F19', 'F20', 'F21', 'F25', 'F17']],
  ['H1', 'head 2400 · 2 × Ø68 on the rail line',   2.0, ['RR'], ['F23', 'F24', 'F26', 'F16', 'F17']],
  ['H2', 'head 2600 · channel conduits only',      0.6, ['RR'], ['F22']],
];

const fn = Object.fromEntries(F.map(([id, n, w]) => [id, { n, w }]));
const W_ALL = F.reduce((a, f) => a + f[2], 0);

function evaluate(mask) {
  const cov = new Set(), ris = new Set(); let c = 0; const ids = [];
  S.forEach((s, i) => { if (mask & (1 << i)) { ids.push(s[0]); c += s[2]; s[3].forEach(r => ris.add(r)); s[4].forEach(f => cov.add(f)); } });
  ris.forEach(r => { c += R[r].c; });
  let w = 0; cov.forEach(f => { w += fn[f].w; });
  return { ids, cost: +c.toFixed(1), cover: w / W_ALL, n: cov.size, ris: [...ris], cov };
}

function best(target) {
  let b = null;
  for (let m = 1; m < (1 << S.length); m++) {
    const e = evaluate(m);
    if (e.cover + 1e-9 < target) continue;
    if (!b || e.cost < b.cost || (e.cost === b.cost && e.ids.length < b.ids.length)) b = e;
  }
  return b;
}

const pct = x => Math.round(x * 100) + ' %';
const out = [];
out.push('# IDEA-003 — slot set-cover (generated)');
out.push('');
out.push('Generated by `docs/stack/fig/src/idea-003-setcover.js`. Do not edit by hand: change the tables in');
out.push('the script and re-run with `--write`. Costs are relative units (Ø68 box + plaster work = 1.0).');
out.push(`Weighted coverage: standard-bearing functions count twice (total weight ${W_ALL}).`);
out.push('');
out.push('## Optimal slot sets by coverage target');
out.push('');
out.push('| target | slots | risers | functions covered | weighted cover | cost |');
out.push('|---|---|---|---|---|---|');
for (const t of [0.5, 0.7, 0.8, 0.9, 1.0]) {
  const b = best(t);
  if (!b) { out.push(`| ≥ ${pct(t)} | — unreachable — | | | | |`); continue; }
  out.push(`| ≥ ${pct(t)} | ${b.ids.join(' · ')} | ${b.ris.join(' ')} | ${b.n} / ${F.length} | ${pct(b.cover)} | ${b.cost} |`);
}
const b90 = best(0.9);
out.push('');
out.push(`## Functions × slots — the ≥ 90 % set (${b90.ids.join(', ')})`);
out.push('');
out.push('| fn | function | w | ' + S.map(s => s[0]).join(' | ') + ' | covered by |');
out.push('|---|---|---|' + S.map(() => '---').join('|') + '|---|');
for (const [id, n, w] of F) {
  const cells = S.map(s => s[4].includes(id) ? (b90.ids.includes(s[0]) ? '**●**' : '○') : '');
  const by = S.filter(s => b90.ids.includes(s[0]) && s[4].includes(id)).map(s => s[0]);
  out.push(`| ${id} | ${n} | ${w} | ${cells.join(' | ')} | ${by.length ? by.join(', ') : '— not covered —'} |`);
}
out.push('');
out.push('**●** = in the chosen set and used · ○ = could hold it, slot not chosen');
out.push('');
// the naive comparison: one housing per function that needs one (F22 channel needs no box)
const naive = F.filter(f => f[0] !== 'F22').length;
const boxes = b90.ids.filter(id => id !== 'H2').reduce((a, id) => a + (id === 'H1' ? 2 : 1), 0);
out.push('## Naive vs standard, per fully equipped portal');
out.push('');
out.push('| | flush housings | vertical chases |');
out.push('|---|---|---|');
out.push(`| naive — one box per function | ${naive} | up to 3 (latch, hinge, extra for the leaf) |`);
out.push(`| the ≥ 90 % slot set | ${boxes} | ${b90.ris.filter(r => r !== 'RR').length} + the rail stub |`);
out.push('');
out.push('## Slot catalogue (as fed to the search)');
out.push('');
out.push('| slot | box | cost | needs | can hold |');
out.push('|---|---|---|---|---|');
for (const s of S) out.push(`| ${s[0]} | ${s[1]} | ${s[2]} | ${s[3].join(' ')} | ${s[4].join(' ')} |`);
out.push('');
out.push('| riser | what | cost |');
out.push('|---|---|---|');
for (const [k, r] of Object.entries(R)) out.push(`| ${k} | ${r.n} | ${r.c} |`);
const md = out.join('\n') + '\n';
process.stdout.write(md);
if (process.argv.includes('--write')) {
  const dst = path.join(__dirname, '..', 'IDEA-003_setcover.md');
  fs.writeFileSync(dst, md);
  process.stderr.write('wrote ' + dst + '\n');
}
