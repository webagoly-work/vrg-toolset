// OBJLIB from the catalogue (Views WP V7).
//
//   node tools/objlib-gen.js          rewrite the OBJLIB block in src/02-state.js
//   node tools/objlib-gen.js --check  exit 1 if the block is out of date (no write)
//
// docs/views/OBJECTS-CATALOGUE.md is the source of truth: edit a row there, run this, rebuild.
// One OBJLIB group per catalogue section ("## Nappali (living room)" → cat 'Nappali'); the
// "Egyedi méret…" custom box is lifted into its own first group, as the picker always had it.
// Names are kept exactly — saved projects reference objects by name.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CAT = path.join(ROOT, 'docs/views/OBJECTS-CATALOGUE.md');
const SRC = path.join(ROOT, 'src/02-state.js');

function parse(md) {
  const groups = []; let g = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^## (.+?)(?: \(.*\))?\s*$/);
    if (h) { g = { cat: h[1].trim(), items: [] }; groups.push(g); continue; }
    if (!g || !/^\| /.test(line) || /^\| name|^\|---/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map(s => s.trim());
    if (c.length < 5) continue;
    const [n, size, flags, art] = c;
    const num = size.replace(/\(.*?\)/g, '').split('×').map(s => parseInt(s.replace(/\s/g, ''), 10));   // "650–1250" → 650
    if (num.length !== 3 || num.some(isNaN)) throw new Error('size not w × d × h: ' + line);
    const it = { n, w: num[0], d: num[1], h: num[2] };
    if (n === 'Egyedi méret…') it.custom = true;
    const views = art.split(/\s+/).filter(v => /^[FLRT]$/.test(v));
    if (views.length) { it.art = views; if (views.includes('L') && !views.includes('R')) it.sym = true; }
    it.room = g.cat;
    g.items.push(it);
  }
  const out = [{ cat: 'Egyedi', items: [] }];
  for (const gr of groups) for (const it of gr.items) if (it.custom) { delete it.room; out[0].items.push(it); }
  for (const gr of groups) { const items = gr.items.filter(it => !it.custom); if (items.length) out.push({ cat: gr.cat, items }); }
  return out;
}

const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
function emit(groups) {
  let s = 'const OBJLIB=[   // generated from docs/views/OBJECTS-CATALOGUE.md by tools/objlib-gen.js — edit the catalogue, not this\n';
  groups.forEach((g, gi) => {
    s += ` {cat:${q(g.cat)},items:[\n`;
    g.items.forEach((it, i) => {
      const f = [`n:${q(it.n)}`];
      if (it.custom) f.push('custom:true');
      f.push(`w:${it.w}`, `d:${it.d}`, `h:${it.h}`);
      if (it.room) f.push(`room:${q(it.room)}`);
      if (it.art) f.push(`art:[${it.art.map(q).join(',')}]`);
      if (it.sym) f.push('sym:true');
      s += `  {${f.join(',')}}${i < g.items.length - 1 ? ',' : ''}\n`;
    });
    s += ` ]}${gi < groups.length - 1 ? ',' : ''}\n`;
  });
  return s + '];\n';
}

const groups = parse(fs.readFileSync(CAT, 'utf8'));
const block = emit(groups);
const src = fs.readFileSync(SRC, 'utf8');
const a = src.indexOf('const OBJLIB=['), b = src.indexOf('let objPick=');
if (a < 0 || b < a) throw new Error('OBJLIB block not found in 02-state.js');
const next = src.slice(0, a) + block + src.slice(b);
const n = groups.reduce((k, g) => k + g.items.length, 0);
if (process.argv.includes('--check')) {
  if (next !== src) { console.log('OBJLIB is out of date — run: node tools/objlib-gen.js'); process.exit(1); }
  console.log(`OBJLIB up to date (${n} items, ${groups.length} groups)`);
} else {
  fs.writeFileSync(SRC, next);
  console.log(`OBJLIB written: ${n} items in ${groups.length} groups`);
}
