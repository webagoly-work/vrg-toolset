#!/usr/bin/env node
// design-pack.js — the Claude Design batch pack (P13, KV-27; docs/city/README.md §7): a screenshot of every look of the
// city with CodeCity/tools/shot.js (headless Chrome, SwiftShader), into docs/city/design-pack/, plus its README with the
// list and the place for the user's dev notes (not guessed — README §7 says ask for them).
//   node CodeCity/tools/design-pack.js            all looks, 1200×750
//   node CodeCity/tools/design-pack.js alap ho    only these
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const CITY = path.resolve(__dirname, '..'), OUT = path.join(CITY, '..', 'docs', 'city', 'design-pack');
const PAGE = path.join(CITY, 'dist', 'vrg-codecity.html');

const LOOKS = [
  ['alap', 'lens=alap', 'Alap — the night city: lit windows = recent work (default, CITY-D6)'],
  ['ho', 'lens=ho', 'Hő — heat: recent changes, ironbow ramp'],
  ['kor', 'lens=kor', 'Kor — age: last touch, ruins after two years'],
  ['ugynok', 'lens=ugynok', 'Ügynök — which Claude session touched what'],
  ['tulaj', 'lens=tulaj', 'Tulaj — owner'],
  ['nyelv', 'lens=nyelv', 'Nyelv — language'],
  ['utak', 'lens=alap&roads=1', 'Utak — every import road (U)'],
  ['halk', 'lens=alap&glow=low', 'Halk fény — low glow (L, KV-27)'],
  ['minoseg-low', 'lens=alap&quality=low', 'Quality tier low — pixel ratio 0.75 (KV-27)'],
  ['tapeta', 'mode=wallpaper&fps=2', 'Tapéta — the wallpaper: the whole Land, no panels (KV-24)'],
  ['hullam', 'lens=alap&seatest=1', 'Hullám — Mélyvíz: one click on empty water sends a wave (CITY-D26; stepped at once for the shot)'],
];

const only = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const done = [];
for (const [id, hash, what] of LOOKS) {
  if (only.length && !only.includes(id)) continue;
  const png = path.join(OUT, id + '.png');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'shot.js'), `${PAGE}#${hash}`, png, '1200x750'], { encoding: 'utf8', env: Object.assign({}, process.env, { SHOT_MS: process.env.SHOT_MS || '9000' }) });
  const ok = r.status === 0 && fs.existsSync(png);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${id}  ${ok ? Math.round(fs.statSync(png).size / 1024) + ' KB' : (r.stderr || '').trim().slice(0, 200)}`);
  if (ok) done.push([id, hash, what]);
}
if (only.length) process.exit(0);

fs.writeFileSync(path.join(OUT, 'README.md'), `# Kódváros — Claude Design batch pack

Made by \`node CodeCity/tools/design-pack.js\` (KV-27, ${new Date().toISOString().slice(0, 10)}): every look of the city,
1200×750, headless Chrome with software WebGL (SwiftShader) — colours are right, glow and anti-aliasing are a little
softer than on a real GPU. Regenerate after a look changes; the page is \`CodeCity/dist/vrg-codecity.html\`.

| Look | Shot | Link hash |
|---|---|---|
${done.map(([id, hash, what]) => `| ${what} | [${id}.png](${id}.png) | \`#${hash}\` |`).join('\n')}

Not in the pack (need the live segéd or a desktop): the overlay (START.cmd K → F, \`#mode=overlay\`), the Stadion and
constructs with real programs, the metro, the ETW beams. Shoot them from the served page:
\`node CodeCity/tools/shot.js http://localhost:8797/#… out.png\`.

## Rules to keep (report §5.5, audited in docs/city/wp/p13-rules.md)

R1 grey-normal · R2 colour never alone · R3 one animation, one meaning · R4 signage only for active buildings ·
R5 places never move · R6 3D for overview, flat panels for reading · R7 every 3D path has a keyboard path ·
R8 active lenses/filters visible · R9 status on the object + one corner · R10 tweens ≥ 400 ms · R11 low glow, render on
demand · R12 card field order. Trademark limits (report §4): no "Tron", Grid/Recognizer/Encom/derezz terms, light-cycle
or identity-disc shapes.

## Skin: Mélyvíz (CITY-D26, 2026-10-27 — docs/city/melyviz.md)

The VRG dev-side style at its Kódváros setting: deep slate-void water ground with a refracted drafting grid, smoked-glass
panels with two cut corners, hairlines, condensed titles, mono readouts. M1 ice = the instrument and you, warm light = the
code's activity · M2 the water moves only on a click on empty water · M3 it simulates only while a wave lives (R11) ·
M4 it follows the lens · M5 square glass, no rounded corners, no drop shadows · M6 mono readouts, condensed titles ·
M7 the planet's ocean only from orbit. The style lab with every axis: https://claude.ai/artifact/9p2XW6rSijksZdDz8KgsSt

## Dev notes (the user's)

_To be written by the user for the Design batch (docs/city/README.md §7: ask for them first, do not guess)._
`);
console.log('README written: ' + path.relative(process.cwd(), path.join(OUT, 'README.md')));
