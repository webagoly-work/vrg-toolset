#!/usr/bin/env node
// build.js — Rajztár: validate the data store, emit data/symbols.json, render catalog.html.
//   node shared/rajztar/build.js          build + check (exit 1 on any error)
//   node shared/rajztar/build.js --check  check only, write nothing
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const D = (f) => path.join(ROOT, 'data', f);
const read = (f) => JSON.parse(fs.readFileSync(D(f), 'utf8'));
const CHECK_ONLY = process.argv.includes('--check');

const sources = read('sources.json');
const formats = read('formats.json');
const conventions = read('conventions.json');
const documents = read('documents.json');
const symbols = require('./src/symbols.src.js');
// Edits made in the Stúdió's symbol editor come back as data/symbols.overrides.json: a record with
// a known id replaces it, a new id is added. They go through the same checks as the source.
const OVR = D('symbols.overrides.json');
if (fs.existsSync(OVR)) {
  const o = JSON.parse(fs.readFileSync(OVR, 'utf8'));
  for (const it of o.items || []) { const i = symbols.findIndex((s) => s.id === it.id); if (i >= 0) symbols[i] = it; else symbols.push(it); }
  console.log(`  merged ${(o.items || []).length} symbol override(s) from data/symbols.overrides.json`);
}
const R = require('./src/render.js');

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

// ---------------------------------------------------------------- checks
const srcIds = new Set(sources.items.map((s) => s.id));
const docIds = new Set(documents.docTypes.map((d) => d.id));
const classIds = documents.projectClasses.map((c) => c.id);
const phaseIds = new Set(documents.phases.map((p) => p.id));
const CATS = { conn: 'Vezetők, csatlakozások', sw: 'Kapcsoló- és védőkészülékek', meas: 'Mérés, jelzés', src: 'Források, átalakítók, gépek', board: 'Elosztók, dobozok', inst: 'Szerelvények (alaprajz)', lum: 'Lámpatestek', wc: 'Gyengeáram', fire: 'Tűzjelző', lps: 'Villámvédelem, földelés', ann: 'Alaprajzi jelölések' };
const CONF = { iec: 'IEC 60617 forma', 'iec-approx': 'IEC család, saját arány', 'hu-practice': 'hazai gyakorlat', vrg: 'VRG saját' };

const seenSrc = new Set();
for (const s of sources.items) { if (seenSrc.has(s.id)) err(`sources: duplicate id ${s.id}`); seenSrc.add(s.id); if (!sources.kinds[s.kind]) err(`sources: ${s.id} unknown kind ${s.kind}`); }

const refSrc = (where, b) => { for (const id of [].concat(b || [])) if (!srcIds.has(id)) err(`${where}: unknown source '${id}'`); };
for (const p of documents.phases) refSrc(`phase ${p.id}`, p.basis);
for (const d of documents.docTypes) {
  refSrc(`doc ${d.id}`, d.basis);
  for (const c of classIds) if (!d.need || !(c in d.need)) err(`doc ${d.id}: need missing class ${c}`);
  for (const [c, v] of Object.entries(d.need || {})) { if (!'RCO-'.includes(v)) err(`doc ${d.id}: need ${c}=${v}`); if (v === 'C' && !d.cond) warn(`doc ${d.id}: 'C' without cond`); }
  for (const p of d.phases || []) if (!phaseIds.has(p)) err(`doc ${d.id}: unknown phase ${p}`);
  for (const c of d.symbols || []) if (!CATS[c]) err(`doc ${d.id}: unknown symbol category ${c}`);
  if (d.scale && !formats.scales.byDocType[d.scale]) err(`doc ${d.id}: unknown scale group ${d.scale}`);
}
for (const [cls, list] of Object.entries(documents.packages)) {
  if (cls === 'about') continue;
  if (!classIds.includes(cls)) err(`package: unknown class ${cls}`);
  for (const id of list) if (!docIds.has(id)) err(`package ${cls}: unknown doc ${id}`);
}

const symIds = new Set();
for (const s of symbols) {
  const w = `symbol ${s.id}`;
  if (symIds.has(s.id)) err(`${w}: duplicate`); symIds.add(s.id);
  if (!CATS[s.cat]) err(`${w}: unknown cat ${s.cat}`);
  if (!s.id.startsWith(s.cat + '.')) err(`${w}: id must start with '${s.cat}.'`);
  if (!CONF[s.conf]) err(`${w}: unknown conf ${s.conf}`);
  if (!s.hu || !s.en) err(`${w}: hu/en name missing`);
  if (!(s.w > 0 && s.h > 0)) err(`${w}: bad box`);
  if (s.std && s.std.ref) refSrc(w, s.std.ref);
  for (const u of s.use || []) if (!docIds.has(u)) err(`${w}: use refers to unknown doc ${u}`);
  for (const p of s.ports || []) if (p.x < -0.01 || p.y < -0.01 || p.x > s.w + 0.01 || p.y > s.h + 0.01) err(`${w}: port ${p.id} outside the box`);
  if (/[<>]/.test(s.body.replace(/<text\b[^>]*>[^<]*<\/text>/g, '').replace(/<\/?(path|rect|circle|ellipse|line|polygon|g|text)\b[^>]*>/g, '').replace(/[^<>]/g, ''))) err(`${w}: body has an element the renderer does not know`);
  const bad = (s.body.match(/class='([^']+)'/g) || []).map((m) => m.slice(7, -1)).filter((c) => !['f', 'w', 'dot', 't'].includes(c));
  if (bad.length) err(`${w}: unknown class ${bad.join(',')}`);
  // schematic devices: ports on the 2,5 mm module (IEC 61082 grid)
  if (['sw', 'meas', 'src'].includes(s.cat)) for (const p of s.ports || []) if (Math.abs(p.x / 2.5 - Math.round(p.x / 2.5)) > 1e-6 || Math.abs(p.y / 2.5 - Math.round(p.y / 2.5)) > 1e-6) err(`${w}: port ${p.id} off the 2,5 mm grid`);
}
for (const sc of conventions.switchCodes.items) if (!symIds.has(sc.symbol)) err(`switchCodes ${sc.code}: unknown symbol ${sc.symbol}`);
for (const [name, lay] of Object.entries(formats.titleBlock.layouts)) {
  if (!lay.cells) continue;
  const keys = new Set(formats.titleBlock.mandatoryFields.map((f) => f.key).concat(['logo']));
  for (const c of lay.cells) {
    if (!keys.has(c.field)) err(`titleBlock ${name}: unknown field ${c.field}`);
    if (c.x + c.w > lay.w + 1e-6 || c.y + c.h > lay.h + 1e-6) err(`titleBlock ${name}: cell ${c.field} outside ${lay.w}×${lay.h}`);
  }
  if (lay.w > 180) err(`titleBlock ${name}: wider than 180 mm (ISO 7200)`);
  const must = formats.titleBlock.mandatoryFields.filter((f) => f.mmk && /^[A-H]$/.test(f.mmk) && !f.optional).map((f) => f.key);
  if (name === 'mmk-180x62') for (const m of must) if (!lay.cells.some((c) => c.field === m)) err(`titleBlock ${name}: MMK field '${m}' has no cell`);
}

// ---------------------------------------------------------------- report
const byCat = {}; for (const s of symbols) byCat[s.cat] = (byCat[s.cat] || 0) + 1;
const byConf = {}; for (const s of symbols) byConf[s.conf] = (byConf[s.conf] || 0) + 1;
console.log(`Rajztar: ${sources.items.length} sources, ${documents.docTypes.length} document types, ${symbols.length} symbols`);
console.log('  by category: ' + Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('  by confidence: ' + Object.entries(byConf).map(([k, v]) => `${k} ${v}`).join(', '));
for (const m of warns) console.log('  warn: ' + m);
if (errors.length) { for (const m of errors) console.log('  ERROR: ' + m); process.exit(1); }
console.log('  checks: OK');
if (CHECK_ONLY) process.exit(0);

// ---------------------------------------------------------------- emit symbols.json
const out = {
  $schema: 'rajztar/symbols/1',
  about: 'Rajzjeltár. Generated by shared/rajztar/build.js from src/symbols.src.js — do not edit by hand. Units: mm on paper, origin top-left, y down. body = SVG elements; classes f (fill), w (wide pen), dot (mechanical link), t (text). Render with src/render.js symbolToSvg().',
  generated: new Date().toISOString().slice(0, 10),
  categories: CATS, confidence: CONF,
  pens: { schematic: formats.lines.groups.schematic, plan: formats.lines.groups.plan },
  items: symbols
};
fs.writeFileSync(D('symbols.json'), JSON.stringify(out, null, 1) + '\n');

// ---------------------------------------------------------------- catalog.html
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const srcName = Object.fromEntries(sources.items.map((s) => [s.id, s.code]));
const card = (s) => `<figure class="sym" data-cat="${s.cat}" data-q="${esc((s.id + ' ' + s.hu + ' ' + s.en + ' ' + (s.code || '')).toLowerCase())}">
<div class="pic">${R.symbolToSvg(s, { px: 6, formats, ports: true })}</div>
<figcaption><b>${esc(s.hu)}</b><span class="en">${esc(s.en)}</span><code>${esc(s.id)}</code>
<span class="meta"><i class="c-${s.conf}">${esc(CONF[s.conf])}</i>${s.refdes ? `<i>-${esc(s.refdes)}</i>` : ''}${s.code ? `<i>${esc(s.code)}</i>` : ''}${s.std && s.std.part ? `<i>60617-${s.std.part}</i>` : ''}</span>
${s.note ? `<small>${esc(s.note)}</small>` : ''}</figcaption></figure>`;

const symSection = Object.keys(CATS).map((c) => `<section class="cat" id="c-${c}"><h3>${esc(CATS[c])} <span>${byCat[c] || 0}</span></h3><div class="grid">${symbols.filter((s) => s.cat === c).map(card).join('')}</div></section>`).join('');

const needCell = (v) => `<td class="n n-${v === '-' ? 'x' : v}">${v === '-' ? '·' : v}</td>`;
const docRows = documents.docTypes.map((d) => `<tr><th scope="row"><code>${d.id}</code> ${esc(d.hu)}<small>${esc(d.en)}${d.clause ? ' · MMK ' + esc(d.clause) : ''}</small>
<details><summary>Tartalom (${d.content.length})</summary><ul>${d.content.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${(d.rules || []).length ? `<p class="rules">${d.rules.map(esc).join(' · ')}</p>` : ''}${d.cond ? `<p class="cond">Feltétel: ${esc(d.cond)}</p>` : ''}<p class="basis">${[].concat(d.basis).map((b) => esc(srcName[b] || b)).join(' · ')}</p></details></th>
${classIds.map((c) => needCell(d.need[c])).join('')}<td class="sh">${esc(d.sheet || '')}${d.scale ? '<br>' + esc(formats.scales.byDocType[d.scale].join(', ')) : ''}</td></tr>`).join('');

const sheetSvg = (() => {
  const all = formats.sheets.series; const k = 0.16; let x = 0; const parts = [];
  for (const s of all.slice().reverse()) { const portrait = s.id === 'A4'; const w = (portrait ? s.w : s.h) * k, h = (portrait ? s.h : s.w) * k; parts.push(`<g transform="translate(${x},${190 - h})"><rect width="${w}" height="${h}" fill="var(--wash)" stroke="currentColor" stroke-width="0.6"/><rect x="${20 * k}" y="${10 * k}" width="${w - 30 * k}" height="${h - 20 * k}" fill="none" stroke="currentColor" stroke-width="0.4" opacity=".6"/><text x="4" y="14" font-size="11">${s.id}</text><text x="4" y="27" font-size="8" opacity=".7">${s.w}×${s.h}</text></g>`); x += w + 10; }
  return `<svg viewBox="0 0 ${x} 192" class="sheets" role="img" aria-label="ISO 5457 lapméretek">${parts.join('')}</svg>`;
})();
const lineSvg = formats.lines.types.map((t) => {
  const d = (t.id.endsWith('.2') ? 0.7 : 0.35); const dash = t.dash ? t.dash.map((v) => v * d * 4).join(' ') : '';
  return `<div class="line"><svg viewBox="0 0 200 10"><line x1="2" y1="5" x2="198" y2="5" stroke="currentColor" stroke-width="${d * 4}" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg><span><code>${t.id}</code> ${esc(t.name)} — ${esc(t.use)}</span></div>`;
}).join('');
const tbVals = { client: 'Minta Kft. · 1036 Budapest, Példa u. 1.', site: '1121 Budapest, Mintafa u. 3. · hrsz. 10234/5', office: 'Varler Villamos · 1111 Budapest · +36 1 000 0000 · varler.hu', 'people.0': 'Minta Mérnök · V 01-0000', 'people.1': 'Munkatárs', 'people.2': 'Szerkesztő', 'people.3': 'Ellenőr', phase: 'KIVITELI', part: 'Épületvillamosság – erősáram', jobNo: '2026-041', title: 'Földszint – világítás', scale: 'M 1:50 @ A3', date: '2026.11.17', docType: 'Alaprajz', sheetNo: 'V-104 · R02' };
const tb = R.titleBlockToSvg(formats.titleBlock.layouts['mmk-180x62'], formats.titleBlock.mandatoryFields, tbVals, { px: 4.2 });
const srcRows = sources.items.map((s) => `<tr><td><code>${esc(s.code)}</code></td><td>${esc(s.title)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</td><td><span class="k k-${s.kind}">${esc(s.kind)}</span></td><td>${s.verified && s.verified.startsWith('http') ? `<a href="${esc(s.verified)}">ellenőrizve</a>` : esc(s.verified)}</td></tr>`).join('');

const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VRG Rajztár</title>
<style>
:root{--ink:#2f2c28;--ink2:#6b645b;--lab:#9b9389;--hair:#d9d3ca;--wash:#f5f2ed;--paper:#fffdf9;--acc:#b5452f;--ok:#3f7a4a;--warn:#b07a1a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#ece6dc;--ink2:#b9b1a5;--lab:#8d857a;--hair:#3b3732;--wash:#24211e;--paper:#1a1816;--acc:#e0795f;--ok:#7fbf8a;--warn:#e0b060}}
:root[data-theme=dark]{--ink:#ece6dc;--ink2:#b9b1a5;--lab:#8d857a;--hair:#3b3732;--wash:#24211e;--paper:#1a1816;--acc:#e0795f;--ok:#7fbf8a;--warn:#e0b060}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.45 Bahnschrift,"DIN Alternate","Segoe UI",sans-serif}
header{padding:28px 24px 8px;max-width:1240px;margin:auto}h1{font:600 30px/1.1 Sitka,Georgia,serif;margin:0 0 6px;letter-spacing:.02em}
header p{color:var(--ink2);max-width:780px;margin:4px 0}.stats{display:flex;gap:18px;flex-wrap:wrap;margin:14px 0 0}.stats b{font-size:22px;display:block}.stats span{color:var(--lab);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
nav{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--hair)}nav div{max-width:1240px;margin:auto;padding:8px 24px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
nav a{color:var(--ink);text-decoration:none;font-size:13px;letter-spacing:.06em;text-transform:uppercase}nav a:hover{color:var(--acc)}nav input{margin-left:auto;min-width:180px;padding:5px 9px;border:1px solid var(--hair);background:var(--wash);color:var(--ink);border-radius:4px;font:inherit}
main{max-width:1240px;margin:auto;padding:0 24px 60px}h2{font:600 22px Sitka,Georgia,serif;margin:38px 0 6px;border-bottom:1px solid var(--hair);padding-bottom:6px}h2+p{color:var(--ink2);margin-top:4px}
h3{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin:26px 0 10px}h3 span{color:var(--lab)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.sym{margin:0;border:1px solid var(--hair);border-radius:6px;padding:10px;background:var(--paper);display:flex;flex-direction:column;gap:6px}
.pic{height:112px;display:flex;align-items:center;justify-content:center;background:var(--wash);border-radius:4px;color:var(--ink)}.pic svg{max-width:100%;max-height:104px}
figcaption b{display:block;font-weight:600;font-size:13px}.en{display:block;color:var(--lab);font-size:12px}code{font:12px Consolas,monospace;color:var(--ink2)}
.meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.meta i{font-style:normal;font-size:10.5px;padding:1px 6px;border:1px solid var(--hair);border-radius:9px;color:var(--ink2)}
.c-iec{border-color:var(--ok)!important;color:var(--ok)!important}.c-vrg{border-color:var(--acc)!important;color:var(--acc)!important}.c-hu-practice{border-color:var(--warn)!important;color:var(--warn)!important}
small{display:block;color:var(--lab);font-size:11.5px;margin-top:3px}
.legendkey{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ink2)}.legendkey i{font-style:normal}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--hair);padding:6px 8px;text-align:left;vertical-align:top}
thead th{background:var(--wash);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);position:sticky;top:44px}
td.n{text-align:center;font-weight:600;width:62px}.n-R{color:var(--acc)}.n-C{color:var(--warn)}.n-O{color:var(--ok)}.n-x{color:var(--lab)}td.sh{color:var(--ink2);font-size:12px;width:150px}
details summary{cursor:pointer;color:var(--ink2);font-size:12px;margin-top:3px}details ul{margin:4px 0 4px 18px;padding:0;font-weight:400}.rules,.cond,.basis{font-weight:400;font-size:12px;color:var(--ink2);margin:4px 0}.basis{color:var(--lab)}
.k{font-size:11px;padding:1px 6px;border-radius:9px;border:1px solid var(--hair)}.k-law{color:var(--acc);border-color:var(--acc)}.k-chamber,.k-operator{color:var(--warn);border-color:var(--warn)}
.sheets{width:100%;max-width:760px;height:auto;color:var(--ink);font-family:Bahnschrift,sans-serif}.tb{color:var(--ink);overflow-x:auto}.tb svg{max-width:100%;height:auto}
.line{display:flex;align-items:center;gap:12px;margin:4px 0}.line svg{width:200px;flex:none;color:var(--ink)}.line span{font-size:12.5px;color:var(--ink2)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px}
.lad span{display:inline-block;margin-right:14px;vertical-align:baseline}
@media (max-width:600px){header,main,nav div{padding-left:16px;padding-right:16px}.grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}nav input{margin-left:0;width:100%}thead th{position:static}}
</style></head><body>
<header><h1>VRG Rajztár</h1><p>Villamos és épületvillamossági tervdokumentációk offline adattára: dokumentumtípusok, formai szabályok, rajzjelek. A generáló motor ebből dolgozik. Ezt a lapot a <code>shared/rajztar/build.js</code> generálja az adatfájlokból, kézzel ne szerkeszd.</p>
<div class="stats"><div><b>${symbols.length}</b><span>rajzjel</span></div><div><b>${documents.docTypes.length}</b><span>dokumentumtípus</span></div><div><b>${documents.projectClasses.length}</b><span>projektosztály</span></div><div><b>${sources.items.length}</b><span>forrás</span></div><div><b>${out.generated}</b><span>generálva</span></div></div></header>
<nav><div><a href="#jelek">Rajzjelek</a><a href="#dok">Dokumentumok</a><a href="#form">Formátum</a><a href="#forras">Források</a><input id="q" type="search" placeholder="Jel keresése…" aria-label="Rajzjel keresése"></div></nav>
<main>
<h2 id="jelek">Rajzjelek</h2><p>Méret: papíron mm, 6× nagyítva. Piros pont = csatlakozási pont, kék kereszt = beszúrási pont, szaggatott alapvonal = falsík. A sémajelek csatlakozási pontjai a 2,5 mm-es modulhálón vannak (MSZ EN 61082-1).</p>
<div class="legendkey">${Object.entries(CONF).map(([k, v]) => `<i class="meta"><i class="c-${k}">${esc(v)}</i> ${byConf[k] || 0}</i>`).join('')}</div>
${symSection}
<h2 id="dok">Dokumentumtípusok és projektosztályok</h2><p>R = kötelező · C = feltételes · O = ajánlott · · = nem jellemző. Forrás: MMK Tervdokumentációs Szabályzat 7. és 12. fejezet, 191/2009, 40/2017 NGM, MSZ 447:2019, OTSZ.</p>
<div class="tw"><table><thead><tr><th>Dokumentum</th>${documents.projectClasses.map((c) => `<th title="${esc(c.examples.join(', '))}">${esc(c.hu)}</th>`).join('')}<th>Lap / lépték</th></tr></thead><tbody>${docRows}</tbody></table></div>
<h3>Projektosztályok</h3><div class="cols">${documents.projectClasses.map((c) => `<div><b>${esc(c.hu)}</b><small>${esc(c.examples.join(' · '))}</small><p style="margin:6px 0;font-size:13px">${esc(c.designDuty)}</p></div>`).join('')}</div>
<h2 id="form">Formátum</h2><p>Lap, keret, rajzpecsét, vonalak, betű. Forrás: MSZ EN ISO 5457, 7200, 128, 3098, 5455 és az MMK szabályzat 3–4. fejezete.</p>
<h3>Lapméretek (ISO 5457), 20 mm lefűzési margóval</h3>${sheetSvg}
<h3>Rajzpecsét – mmk-180x62 (MMK 4. fejezet A–H mezők + ISO 7200)</h3><div class="tb">${tb}</div>
<h3>Vonalfajták (ISO 128)</h3>${lineSvg}
<h3>Betűmagasságok (ISO 3098, B típus)</h3><div class="lad">${formats.lettering.heights.map((h) => `<span style="font-size:${h * 3.2}px">${h}</span>`).join('')}</div>
<h2 id="forras">Források</h2><p>„ellenőrizve” = a 2026-11-17-i kutatásban a hivatkozott oldalon megnéztük; „knowledge” = szakmai tudás, idézés előtt a hatályos kiadással egyeztetni.</p>
<div class="tw"><table><thead><tr><th>Jelzet</th><th>Cím</th><th>Fajta</th><th>Állapot</th></tr></thead><tbody>${srcRows}</tbody></table></div>
</main>
<script>
const q=document.getElementById('q');q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();document.querySelectorAll('.sym').forEach(f=>{f.style.display=!v||f.dataset.q.includes(v)?'':'none'});document.querySelectorAll('section.cat').forEach(s=>{s.style.display=[...s.querySelectorAll('.sym')].some(f=>f.style.display!=='none')?'':'none'});if(v)location.hash='jelek';});
</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'catalog.html'), html);

// ---------------------------------------------------------------- studio.html (one offline file)
const inl = (o) => JSON.stringify(o).replace(/<\//g, '<\\/');
const studio = fs.readFileSync(path.join(ROOT, 'src', 'studio.html'), 'utf8')
  .replace('/*DATA*/', () => `window.RAJZTAR=${inl({ sources, formats, conventions, documents, symbols: out })};`)
  .replace('/*RENDER*/', () => fs.readFileSync(path.join(ROOT, 'src', 'render.js'), 'utf8').replace(/<\//g, '<\\/'))
  .replace('/*APP*/', () => fs.readFileSync(path.join(ROOT, 'src', 'studio.js'), 'utf8').replace(/<\//g, '<\\/'));
fs.writeFileSync(path.join(ROOT, 'studio.html'), studio);
console.log('  wrote data/symbols.json, catalog.html, studio.html (' + Math.round(studio.length / 1024) + ' KB)');
