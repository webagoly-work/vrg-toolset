#!/usr/bin/env node
// VRG Kisokos — the one loader and checker for the Kisokos sources. Read-only on the sources
// except `md`, which writes the generated cheat sheet next to the cards.
//
//   node Kisokos/kisokos.js check     validate map.json and every card (ids, places, cross-references,
//                                     search terms); exit 1 on a problem
//   node Kisokos/kisokos.js md        write each volume's KISOKOS.md cheat sheet (and, for the lines,
//                                     svg/<id>.svg one-pagers + svg/spektrum.svg through lib/vonal-svg.js;
//                                     for the fixtures svg/<id>.svg through lib/lampa-svg.js)
//   node Kisokos/kisokos.js stats     cards, bytes and cubes per volume and per knowledge base
//   node Kisokos/kisokos.js keszlet [--add]   Készlet products linked to cards (keszlet.json); suggestions for the
//                                     unlinked ones by name and category; --add writes the suggestions in, for review
//
// Used by Stack/lib/layers.js (layer K) and Stack/lib/kisokos.js (the 3D page's data) through load().
//
// The sources:
//   map.json                    the core, 8 axes × 2 poles × 4 rings of term nodes, the volumes, and the
//                               knowledge bases outside the Kisokos (Rajztár, Készlet, CoreRef, Modulshop)
//   <volume dir>/*.json         { about, kind, added, cards: [...] }, one file per card kind
// A card's place is { core: '<axis><pole>' } (core knowledge, leaning to that pole's entry point) or
// { term: '<axis><pole><ring>', overlap: 0..1, hang?: n } (its own thing, gravitating to a term node;
// overlap = the share of it that lies inside the core).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..');
const LANGS = ['hu', 'en', 'de'];
const REFS = { anyag: ['bits', 'anchors', 'screws'], dubel: ['for'], furoszar: ['for'], csavar: ['for', 'with'], szerszam: ['for'], vonal: ['related'], lampa: ['related'], eloiras: ['related'], lecke: ['prereq'] };
const XREFS = { lampa: ['fixing', 'lines', 'norms'], lecke: ['links'] };   // links into other volumes, written '<volume>.<id>'
const KIND_HU = { anyag: 'Anyag', dubel: 'Dübel, horgony', furoszar: 'Fúrószár', csavar: 'Csavar', szerszam: 'Szerszám', vonal: 'Vonal', lampa: 'Lámpatest-típus', eloiras: 'Előírás', lecke: 'Lecke' };
const VS = require('./lib/vonal-svg');
const LS = require('./lib/lampa-svg');

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
function bytesOf(p) {
  const abs = path.join(REPO, p);
  if (!fs.existsSync(abs)) return { bytes: 0, files: 0, missing: true };
  const st = fs.statSync(abs);
  if (st.isFile()) return { bytes: st.size, files: 1 };
  let bytes = 0, files = 0;
  for (const e of fs.readdirSync(abs)) { const r = bytesOf(path.join(p, e)); bytes += r.bytes; files += r.files; }
  return { bytes, files };
}

function load(root = ROOT) {
  const map = readJson(path.join(root, 'map.json'));
  const problems = [];
  const terms = [];
  for (const ax of map.axes) for (const pole of ['A', 'B']) (ax.terms[pole] || []).forEach((t, i) => terms.push({
    id: `${ax.n}${pole}${i + 1}`, axis: ax.n, pole, ring: i + 1, title: t[0], desc: t[1], vols: t[2] || [], poleName: ax[pole], axisName: ax.hu }));
  const termIds = new Set(terms.map(t => t.id));
  const cards = [];
  for (const vol of map.volumes) {
    if (!vol.dir) continue;
    const dir = path.join(root, vol.dir);
    if (!fs.existsSync(dir)) { problems.push(`volume ${vol.id}: folder ${vol.dir} is missing`); continue; }
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
      let src; try { src = readJson(path.join(dir, f)); } catch (e) { problems.push(`${vol.dir}/${f}: not valid JSON (${e.message})`); continue; }
      for (const c of src.cards || []) cards.push({ ...c, vol: vol.id, kind: src.kind, added: c.added || src.added || '', file: `Kisokos/${vol.dir}/${f}`,
        gid: `${vol.id}.${c.id}`, bytes: Buffer.byteLength(JSON.stringify(c), 'utf8') });
    }
  }
  const sources = (map.sources || []).map(s => {
    let bytes = 0, files = 0; const missing = [];
    for (const p of s.paths) { const r = bytesOf(p); bytes += r.bytes; files += r.files; if (r.missing) missing.push(p); }
    return { ...s, bytes, files, missing };
  });
  let symbols = null;
  try { const sj = readJson(path.join(REPO, 'shared', 'rajztar', 'data', 'symbols.json')); symbols = new Set((sj.items || sj.symbols || []).map(s => s.id)); } catch { symbols = null; }
  // Készlet links (keszlet.json): product (vrg_id, stable) → card; the Inventory is read for names and prices only
  let keszlet = { relations: {}, links: [] }, inventory = new Map();
  try { keszlet = readJson(path.join(root, 'keszlet.json')); } catch { /* no links yet */ }
  try { for (const it of readJson(path.join(REPO, keszlet.source || 'Inventory/data/vrg-inventory.json')).items || []) inventory.set(it.vrg_id, it); } catch { inventory = null; }
  for (const l of keszlet.links || []) {
    const c = cards.find(x => x.gid === l.card), it = inventory && inventory.get(l.vrg);
    if (c) (c.stock = c.stock || []).push({ vrg: l.vrg, rel: l.rel, why: l.why || '', name: it ? it.megnevezes : '', price: it && it.becsult_ar ? it.becsult_ar.brutto_huf : null });
  }
  const cube = map.cubeBytes || 1024;
  for (const x of [...cards, ...sources]) x.cubes = Math.max(1, Math.round(x.bytes / cube));
  return { map, terms, termIds, cards, sources, problems, symbols, keszlet, inventory, root, repo: REPO };
}

function check(K = load()) {
  const P = [...K.problems];
  const axisPoles = new Set(K.map.axes.flatMap(a => [a.n + 'A', a.n + 'B']));
  const placeOk = (who, pl) => {
    if (!pl) return P.push(`${who}: no place`);
    if (pl.core) { if (!axisPoles.has(pl.core)) P.push(`${who}: place.core "${pl.core}" is not an axis pole (e.g. 8A)`); }
    else if (pl.term) {
      if (!K.termIds.has(pl.term)) P.push(`${who}: place.term "${pl.term}" is not a term node`);
      if (pl.overlap !== undefined && !(pl.overlap >= 0 && pl.overlap <= 1)) P.push(`${who}: place.overlap must be 0..1`);
    } else P.push(`${who}: place needs core or term`);
  };
  const seen = new Set(), byVol = {};
  for (const c of K.cards) (byVol[c.vol] = byVol[c.vol] || new Set()).add(c.id);
  for (const c of K.cards) {
    const who = `${c.file} ${c.id}`;
    if (!/^[a-z0-9-]+$/.test(c.id || '')) P.push(`${who}: id must be lowercase letters, digits and hyphens`);
    if (seen.has(c.gid)) P.push(`${who}: duplicate id ${c.gid}`); seen.add(c.gid);
    if (!c.title) P.push(`${who}: no title`);
    placeOk(who, c.place);
    for (const l of LANGS) if (!c.terms || !Array.isArray(c.terms[l]) || !c.terms[l].length) P.push(`${who}: no ${l} search terms`);
    if (!c.shop && c.kind !== 'lecke') P.push(`${who}: no shop`);
    const ids = byVol[c.vol];
    for (const field of REFS[c.kind] || []) {
      let v = c[field]; if (field === 'bits' || field === 'note') v = c.drill && c.drill.bits;
      if (field === 'anchors') v = c.anchors ? [...(c.anchors.light || []), ...(c.anchors.medium || []), ...(c.anchors.heavy || [])] : [];
      for (const r of v || []) if (!ids.has(r)) P.push(`${who}: ${field} names "${r}", which is not a card in this volume`);
    }
    if (c.kind === 'anyag') {
      if (!c.recognise) P.push(`${who}: no recognise`);
      if (!c.drill || !['igen', 'nem', 'óvatosan'].includes(c.drill.hammer)) P.push(`${who}: drill.hammer must be igen, nem or óvatosan`);
      if (!Array.isArray(c.traps)) P.push(`${who}: traps must be a list`);
    }
    for (const field of XREFS[c.kind] || []) for (const r of c[field] || []) {
      const m = /^([a-z]+)\.([a-z0-9-]+)$/.exec(r);
      if (!m || !(byVol[m[1]] && byVol[m[1]].has(m[2]))) P.push(`${who}: ${field} names "${r}", which is not a card (write <volume>.<id>, e.g. rg.gipszkarton)`);
    }
    if (c.kind === 'lampa') {
      for (const f of ['what', 'mounting', 'sources', 'rooms']) if (!c[f]) P.push(`${who}: no ${f}`);
      if (!(Number.isInteger(c.family) && LS.FAM[c.family])) P.push(`${who}: family must be 1..10`);
      if (!c.protection || !c.protection.ip) P.push(`${who}: no protection.ip`);
      if (!c.distribution || !LS.TYPES[c.distribution.type]) P.push(`${who}: distribution.type must be one of ${Object.keys(LS.TYPES).join(', ')}`);
      else if (['wide', 'narrow', 'updown', 'up'].includes(c.distribution.type) && !(c.distribution.angle > 0 && c.distribution.angle < 180)) P.push(`${who}: distribution.angle (beam, degrees) is needed for ${c.distribution.type}`);
      if (c.symbol && K.symbols && !K.symbols.has(c.symbol)) P.push(`${who}: symbol "${c.symbol}" is not in shared/rajztar/data/symbols.json`);
      for (const f of ['install', 'traps']) if (!Array.isArray(c[f])) P.push(`${who}: ${f} must be a list`);
    }
    if (c.kind === 'lecke') {
      if (![1, 2, 3].includes(c.level)) P.push(`${who}: level must be 1, 2 or 3`);
      if (!Number.isInteger(c.chapter)) P.push(`${who}: chapter must be a number`);
      for (const f of ['goals', 'body', 'exercises', 'safety']) if (!Array.isArray(c[f]) || !c[f].length) P.push(`${who}: ${f} must be a non-empty list`);
      if (!c.example || !c.example.task || !Array.isArray(c.example.steps) || !c.example.result) P.push(`${who}: example needs task, steps and result`);
      for (const e of c.exercises || []) if (!e.q || !e.a) P.push(`${who}: every exercise needs q and a (the answer)`);
      for (const f of c.formulas || []) if (!f.f || !f.mean) P.push(`${who}: every formula needs f and mean`);
    }
    if (c.kind === 'eloiras') {
      if (!c.source || !c.source.ref || !c.source.kind) P.push(`${who}: source needs kind and ref (a summary always names what it summarises)`);
      for (const f of ['scope', 'applies']) if (!c[f]) P.push(`${who}: no ${f}`);
      for (const f of ['points', 'values']) if (!Array.isArray(c[f]) || !c[f].length) P.push(`${who}: ${f} must be a non-empty list`);
    }
    if (c.kind === 'vonal') {
      for (const f of ['how', 'medium', 'signal', 'rate', 'distance', 'topology', 'home']) if (!c[f]) P.push(`${who}: no ${f}`);
      if (!VS.KCOL[c.waveform]) P.push(`${who}: waveform must be one of ${Object.keys(VS.KCOL).join(', ')}`);
      if (!Array.isArray(c.bands) || c.bands.some(b => !Array.isArray(b) || b.length !== 2 || !(b[0] > 0) || !(b[1] >= b[0]) || b[1] > 1e16))
        P.push(`${who}: bands must be [[fmin, fmax], …] in Hz, 0 < fmin ≤ fmax ([] for DC)`);
      if (c.waveform === 'dc' && c.bands && c.bands.length) P.push(`${who}: a dc line has no bands`);
      for (const f of ['install', 'traps']) if (!Array.isArray(c[f])) P.push(`${who}: ${f} must be a list`);
    }
  }
  const pairs = new Set();
  for (const l of (K.keszlet && K.keszlet.links) || []) {
    const who = `keszlet.json ${l.vrg} → ${l.card}`;
    if (K.inventory && !K.inventory.has(l.vrg)) P.push(`${who}: ${l.vrg} is not in the Inventory`);
    if (!K.cards.some(c => c.gid === l.card)) P.push(`${who}: ${l.card} is not a card`);
    if (!(K.keszlet.relations || {})[l.rel]) P.push(`${who}: relation "${l.rel}" is not one of ${Object.keys(K.keszlet.relations || {}).join(', ')}`);
    const k = l.vrg + '|' + l.card; if (pairs.has(k)) P.push(`${who}: listed twice`); pairs.add(k);
  }
  for (const s of K.sources) { placeOk(`source ${s.id}`, s.place); if (s.missing.length) P.push(`source ${s.id}: missing ${s.missing.join(', ')}`); }
  return P;
}

const name = (K, vol, id) => { const c = K.cards.find(x => x.vol === vol && x.id === id); return c ? c.title : id; };
function md(K = load()) {
  const out = [];
  if (K.cards.some(c => c.vol === 'rg')) out.push(mdRg(K));
  if (K.cards.some(c => c.vol === 'kv')) out.push(mdKv(K));
  if (K.cards.some(c => c.vol === 'vt')) out.push(mdVt(K));
  if (K.cards.some(c => c.vol === 'el')) out.push(mdEl(K));
  if (K.cards.some(c => c.vol === 'tk')) out.push(mdTk(K));
  return out.join('\n');
}

const REL_HU = { termek: 'termék', alkatresz: 'alkatrész', fenyforras: 'fényforrás', hasznalja: 'használja', kivaltja: 'kiváltja', szabvany: 'szabvány' };
const huf = n => n == null ? '' : ' · ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';
function stockRows(L, c) {
  if (!c.stock || !c.stock.length) return;
  L.push('- **A Készletben:**');
  for (const s of c.stock) L.push(`  - \`${s.vrg}\` ${s.name}${huf(s.price)} — *${REL_HU[s.rel] || s.rel}*${s.why ? ': ' + s.why : ''}`);
}

// suggestions for unlinked Készlet products: name and category patterns → card and relation
const SUGGEST = [
  [/NYM-J|H07V-[UK]|NYY-J|N?A?YY-J|EAYY|H05VV-F|H05RR-F|\d+\s*mkh/i, 'kv.halozat-50hz', 'termek'],
  [/CAT ?5|CAT ?6|UTP|FTP|számítógép vezeték/i, 'kv.ethernet', 'termek'],
  [/RJ45|8P8C|keystone/i, 'kv.ethernet', 'alkatresz'],
  [/TV aljzat|F-csatlakozó|koax|SAT /i, 'kv.koax-tv', 'alkatresz'],
  [/gipszkarton doboz/i, 'rg.gipszkarton', 'alkatresz'],
  [/reflektor/i, 'vt.reflektor', 'termek'],
  [/\bWi-?Fi\b|\bZigbee\b|\bokos (dugalj|kapcsoló|relé|izzó)/i, 'kv.ism-24', 'hasznalja'],
  [/dimmer|fényerőszab/i, 'el.szerelvenyek', 'szabvany'],
];
function keszletReport(K, add) {
  if (!K.inventory) return 'Inventory/data/vrg-inventory.json could not be read';
  const linked = new Set(K.keszlet.links.map(l => l.vrg));
  const sugg = [];
  for (const [vrg, it] of K.inventory) {
    if (linked.has(vrg)) continue;
    const text = it.megnevezes;   // the name only: category names ("Okos eszközök és csengők") are too broad
    const hit = SUGGEST.find(([re, card]) => re.test(text) && K.cards.some(c => c.gid === card));
    if (hit) sugg.push({ vrg, card: hit[1], rel: hit[2], why: 'javaslat (ellenőrizendő): ' + it.megnevezes.slice(0, 90) });
  }
  const byCard = {}; for (const l of K.keszlet.links) byCard[l.card] = (byCard[l.card] || 0) + 1;
  const L = [`${K.keszlet.links.length} links, ${linked.size} of ${K.inventory.size} Készlet products linked to ${Object.keys(byCard).length} cards`,
    ...Object.entries(byCard).sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${String(n).padStart(3)}  ${c}`),
    `${sugg.length} suggestions for unlinked products:`, ...sugg.map(s => `  ${s.vrg} → ${s.card} (${s.rel})  ${s.why.replace(/^javaslat \(ellenőrizendő\): /, '')}`)];
  if (add && sugg.length) {
    const f = path.join(K.root, 'keszlet.json'); let s = fs.readFileSync(f, 'utf8');
    const lines = sugg.map(x => '    ' + JSON.stringify({ vrg: x.vrg, card: x.card, rel: x.rel, why: x.why }).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
    s = s.replace(/\n  \]\n\}\s*$/, ',\n\n' + lines.join(',\n') + '\n  ]\n}\n');
    JSON.parse(s); fs.writeFileSync(f, s);
    L.push(`added ${sugg.length} suggested links to keszlet.json (marked "javaslat"); review them`);
  }
  return L.join('\n');
}

const LEVEL_HU = { 1: 'Kezdő', 2: 'Szakmunkás', 3: 'Mester, tervező' };
function mdTk(K) {
  const vol = K.map.volumes.find(v => v.id === 'tk');
  const dir = path.join(K.root, vol.dir);
  const cs = K.cards.filter(c => c.vol === 'tk').sort((a, b) => a.level - b.level || a.chapter - b.chapter);
  const any = r => { const m = /^([a-z]+)\.(.+)$/.exec(r); return m ? name(K, m[1], m[2]) : r; };
  const L = ['# Tankönyv — a Kisokos', '',
    '*Generálva a lecke-kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel. Saját írás; a számpéldák kerekítettek. ' +
    'Vázlat: minden lecke ellenőrzésre vár. A tanterv: `docs/kisokos/tankonyv.md`.*', ''];
  for (const lv of [...new Set(cs.map(c => c.level))]) {
    L.push(`## ${lv}. szint: ${LEVEL_HU[lv]}`, '');
    for (const c of cs.filter(x => x.level === lv)) L.push(`- [${c.title}](#${c.id})`);
    L.push('');
    for (const c of cs.filter(x => x.level === lv)) {
      L.push(`<a id="${c.id}"></a>`, '', `### ${c.title}`, '');
      if (c.prereq && c.prereq.length) L.push(`*Előtte:* ${c.prereq.map(r => name(K, 'tk', r)).join(', ')}`, '');
      L.push('**Célok**', '', ...c.goals.map(g => `- ${g}`), '');
      L.push(...c.body.flatMap(p => [p, '']));
      if (c.formulas && c.formulas.length) { L.push('**Képletek**', ''); for (const f of c.formulas) L.push(`- \`${f.f}\` — ${f.mean}`); L.push(''); }
      L.push('**Kidolgozott példa**', '', c.example.task, '', ...c.example.steps.map((s, i) => `${i + 1}. ${s}`), '', `→ ${c.example.result}`, '');
      L.push('**Gyakorló feladatok**', '');
      c.exercises.forEach((e, i) => L.push(`${i + 1}. ${e.q}`, `   <details><summary>Megoldás</summary>${e.a}</details>`));
      L.push('', '**Biztonság**', '', ...c.safety.map(s => `- ${s}`), '');
      if (c.links && c.links.length) L.push(`*Kapcsolódó kártyák:* ${c.links.map(any).join(', ')}`, '');
    }
  }
  fs.writeFileSync(path.join(dir, 'KISOKOS.md'), L.join('\n'));
  return `wrote ${path.relative(K.repo, path.join(dir, 'KISOKOS.md'))} (${cs.length} lessons)`;
}

function mdEl(K) {
  const vol = K.map.volumes.find(v => v.id === 'el');
  const dir = path.join(K.root, vol.dir);
  const cs = K.cards.filter(c => c.vol === 'el');
  const users = id => K.cards.filter(c => (c.norms || []).includes('el.' + id)).map(c => c.title);
  const L = ['# Előírások — a Kisokos', '',
    '*Generálva a kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel. Minden kártya SAJÁT összefoglaló és hivatkozás, ' +
    'nem a szabvány vagy a jogszabály szövege: az a megvásárolt példányban, illetve a Nemzeti Jogszabálytárban van. ' +
    'A számok tájékoztatók; munka előtt a hatályos kiadással kell egyeztetni. Vázlat: minden kártya ellenőrzésre vár.*', '',
    '| Előírás | Mire | Forrás |', '|---|---|---|'];
  for (const c of cs) L.push(`| ${c.title} | ${String(c.scope).split('. ')[0].replace(/\|/g, '/')} | ${c.source.ref} |`);
  L.push('');
  for (const c of cs) {
    L.push(`## ${c.title}`, '');
    if (c.aka && c.aka.length) L.push(`*Más néven:* ${c.aka.join(', ')}`, '');
    L.push(c.scope, '', '**Lényeg (saját összefoglaló):**', '');
    for (const p of c.points) L.push(`- ${p}`);
    L.push('', '**Számok (tájékoztató, a hatályos kiadással egyeztetendő):**', '');
    for (const v of c.values) L.push(`- ${v}`);
    L.push('', `- **Hol érvényes:** ${c.applies}`, `- **Forrás:** ${c.source.kind}: ${c.source.ref} — ${c.source.from || ''}`);
    const u = users(c.id); if (u.length) L.push(`- **Erre hivatkozó típusok:** ${u.join(', ')}`);
    if (c.related && c.related.length) L.push(`- **Kapcsolódó előírások:** ${c.related.map(r => name(K, 'el', r)).join(', ')}`);
    L.push(`- **Keresőszavak:** HU: ${c.terms.hu.join(' · ')} — EN: ${c.terms.en.join(' · ')} — DE: ${c.terms.de.join(' · ')}`);
    stockRows(L, c); L.push('');
  }
  fs.writeFileSync(path.join(dir, 'KISOKOS.md'), L.join('\n'));
  return `wrote ${path.relative(K.repo, path.join(dir, 'KISOKOS.md'))} (${cs.length} cards)`;
}

function mdVt(K) {
  const vol = K.map.volumes.find(v => v.id === 'vt');
  const dir = path.join(K.root, vol.dir), sdir = path.join(dir, 'svg');
  const cs = K.cards.filter(c => c.vol === 'vt').sort((a, b) => a.family - b.family);
  fs.mkdirSync(sdir, { recursive: true });
  const keep = new Set(cs.map(c => c.id + '.svg'));
  for (const f of fs.readdirSync(sdir)) if (f.endsWith('.svg') && !keep.has(f)) fs.unlinkSync(path.join(sdir, f));
  for (const c of cs) fs.writeFileSync(path.join(sdir, c.id + '.svg'), LS.card(c));
  const any = r => { const m = /^([a-z]+)\.(.+)$/.exec(r); return m ? name(K, m[1], m[2]) : r; };
  const cell = s => String(s || '').replace(/\|/g, '/');
  const L = ['# Lámpák és világítótestek — a Kisokos', '',
    '*Generálva a kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel, a kártyát szerkeszd a `lampak.json`-ban. ' +
    'Egy kártya = egy lámpatest-típus, nem termék. A fényeloszlás-rajz típusonként általános (sematikus), nem egy termék mért adata. ' +
    'Vázlat: minden kártya ellenőrzésre vár; a pontos adat a termék adatlapján van.*', '',
    '## Gyorstábla', '', '| Típus | Család | Szerelés | Védettség | Fényeloszlás | Rajzjel |', '|---|---|---|---|---|---|'];
  for (const c of cs) L.push(`| ${c.title} | ${LS.FAM[c.family]} | ${cell(c.mounting)} | ${cell(c.protection.ip)} | ${LS.TYPES[c.distribution.type]}${c.distribution.angle ? ' ' + c.distribution.angle + '°' : ''} | \`${c.symbol || ''}\` |`);
  L.push('');
  for (const fam of [...new Set(cs.map(c => c.family))]) {
    L.push(`## ${fam}. ${LS.FAM[fam]}`, '');
    for (const c of cs.filter(x => x.family === fam)) {
      L.push(`### ${c.title}`, '');
      if (c.aka && c.aka.length) L.push(`*Más néven:* ${c.aka.join(', ')}`, '');
      L.push(`![${c.title}](svg/${c.id}.svg)`, '', c.what, '');
      const row = (k, v) => { if (v) L.push(`- **${k}:** ${v}`); };
      const ph = c.photometry || {}, pr = c.protection || {};
      row('Szerelés', c.mounting); row('Fényforrás', c.sources); row('Védettség', [pr.ip, pr.ik, pr.class].filter(Boolean).join(' · '));
      row('Fény', [ph.lm, ph.cct, ph.cri, ph.beam].filter(Boolean).join(' · '));
      row('Vezérlés', c.control + (c.lines && c.lines.length ? ` (vonalak: ${c.lines.map(any).join(', ')})` : ''));
      if (c.install && c.install.length) { L.push('- **Beépítés:**'); for (const t of c.install) L.push(`  - ${t}`); }
      if (c.fixing && c.fixing.length) row('Rögzítés', c.fixing.map(any).join(', '));
      row('Előírás', c.rules + (c.norms && c.norms.length ? ` (kártyák: ${c.norms.map(any).join(', ')})` : '')); row('Rajzjel', c.symbol ? '`' + c.symbol + '` (Rajztár)' : ''); row('Hova', c.rooms);
      if (c.traps && c.traps.length) { L.push('- **Buktatók:**'); for (const t of c.traps) L.push(`  - ${t}`); }
      if (c.related && c.related.length) row('Rokon típusok', c.related.map(r => name(K, 'vt', r)).join(', '));
      L.push(`- **Keresőszavak:** HU: ${c.terms.hu.join(' · ')} — EN: ${c.terms.en.join(' · ')} — DE: ${c.terms.de.join(' · ')}`);
      row('Hol kapható', c.shop); stockRows(L, c); L.push('');
    }
  }
  fs.writeFileSync(path.join(dir, 'KISOKOS.md'), L.join('\n'));
  return `wrote ${path.relative(K.repo, path.join(dir, 'KISOKOS.md'))} (${cs.length} cards) + ${cs.length} svg`;
}

function mdKv(K) {
  const vol = K.map.volumes.find(v => v.id === 'kv');
  const dir = path.join(K.root, vol.dir), sdir = path.join(dir, 'svg');
  const cs = K.cards.filter(c => c.vol === 'kv');
  fs.mkdirSync(sdir, { recursive: true });
  const keep = new Set(['spektrum.svg', ...cs.map(c => c.id + '.svg')]);
  for (const f of fs.readdirSync(sdir)) if (f.endsWith('.svg') && !keep.has(f)) fs.unlinkSync(path.join(sdir, f));
  fs.writeFileSync(path.join(sdir, 'spektrum.svg'), VS.spectrum(cs));
  for (const c of cs) fs.writeFileSync(path.join(sdir, c.id + '.svg'), VS.onePager(c, cs));
  const nm = id => name(K, 'kv', id);
  const L = ['# Kommunikációs vonalak — a Kisokos', '',
    '*Generálva a kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel, a kártyát szerkeszd a `vonalak.json`-ban. ' +
    'Vázlat: minden kártya ellenőrzésre vár. Minden vonal ugyanazt a rajzot kapja (`svg/<id>.svg`): a sávjai a közös 1 Hz – 1 PHz skálán, ' +
    'alatta a hullámhossz, halványan a többi vonal, a jelalak és a fő számok.*', '',
    '![Minden vonal egy skálán](svg/spektrum.svg)', '',
    '## Gyorstábla', '', '| Vonal | Csoport | Sáv | Sebesség | Távolság | A lakásban |', '|---|---|---|---|---|---|'];
  const cell = s => String(s || '').replace(/\|/g, '/');
  for (const c of cs) L.push(`| ${c.title} | ${c.group || ''} | ${VS.bandText(c.bands)} | ${cell(c.rate)} | ${cell(c.distance)} | ${cell(c.home)} |`);
  L.push('');
  const groups = [...new Set(cs.map(c => c.group || ''))];
  for (const g of groups) {
    L.push(`## ${g ? g[0].toUpperCase() + g.slice(1) : 'Egyéb'}`, '');
    for (const c of cs.filter(x => (x.group || '') === g)) {
      L.push(`### ${c.title}`, '');
      if (c.aka && c.aka.length) L.push(`*Más néven:* ${c.aka.join(', ')}`, '');
      L.push(`![${c.title}](svg/${c.id}.svg)`, '', c.how, '');
      const row = (k, v) => { if (v) L.push(`- **${k}:** ${v}`); };
      row('Közeg', c.medium); row('Jel', `${c.signal} (${VS.KNAME[c.waveform]})`); row('Sáv', VS.bandText(c.bands)); row('Hullámhossz', VS.lambdaText(c.bands));
      row('Sebesség', c.rate); row('Távolság', c.distance); row('Topológia', c.topology); row('Táplálás', c.power);
      row('Kábel', c.cable); row('Csatlakozó', c.connector); row('Szabvány', c.standard); row('A lakásban', c.home);
      if (c.install && c.install.length) { L.push('- **Szerelés:**'); for (const t of c.install) L.push(`  - ${t}`); }
      if (c.traps && c.traps.length) { L.push('- **Buktatók:**'); for (const t of c.traps) L.push(`  - ${t}`); }
      if (c.related && c.related.length) row('Rokon vonalak', c.related.map(nm).join(', '));
      L.push(`- **Keresőszavak:** HU: ${c.terms.hu.join(' · ')} — EN: ${c.terms.en.join(' · ')} — DE: ${c.terms.de.join(' · ')}`);
      row('Hol kapható', c.shop); stockRows(L, c); L.push('');
    }
  }
  fs.writeFileSync(path.join(dir, 'KISOKOS.md'), L.join('\n'));
  return `wrote ${path.relative(K.repo, path.join(dir, 'KISOKOS.md'))} (${cs.length} cards) + ${cs.length + 1} svg`;
}

function mdRg(K) {
  const vol = K.map.volumes.find(v => v.id === 'rg');
  const cs = K.cards.filter(c => c.vol === 'rg');
  const L = []; const nm = id => name(K, 'rg', id); const list = a => (a || []).map(nm).join(', ') || '—';
  L.push('# Rögzítéstechnika — a Kisokos', '',
    '*Generálva a kártyákból (`node Kisokos/kisokos.js md`); ne szerkeszd kézzel, a kártyát szerkeszd a JSON-ban. ' +
    'Vázlat: minden kártya ellenőrzésre vár (reviewed). A teherbírás mindig a gyártói adatlapon van.*', '');
  const byKind = k => cs.filter(c => c.kind === k);
  L.push('## Gyorstábla: mibe mit', '', '| Anyag | Ütve? | Fúrószár | Könnyű | Közepes | Nehéz |', '|---|---|---|---|---|---|');
  for (const c of byKind('anyag')) L.push(`| ${c.title} | ${c.drill.hammer} | ${list(c.drill.bits)} | ${list(c.anchors.light)} | ${list(c.anchors.medium)} | ${list(c.anchors.heavy)} |`);
  L.push('');
  for (const kind of ['anyag', 'dubel', 'furoszar', 'csavar', 'szerszam']) {
    L.push(`## ${KIND_HU[kind]}`, '');
    for (const c of byKind(kind)) {
      L.push(`### ${c.title}`, '');
      if (c.aka && c.aka.length) L.push(`*Más néven:* ${c.aka.join(', ')}`, '');
      const row = (k, v) => { if (v) L.push(`- **${k}:** ${v}`); };
      if (kind === 'anyag') {
        row('Felismerés', c.recognise); row('Fúrás', `${c.drill.hammer === 'igen' ? 'ütve' : c.drill.hammer === 'nem' ? 'ütés nélkül' : 'óvatosan, ütés nélkül kezdve'} · ${list(c.drill.bits)}. ${c.drill.note || ''}`);
        row('Dübel', `könnyű: ${list(c.anchors.light)} · közepes: ${list(c.anchors.medium)} · nehéz: ${list(c.anchors.heavy)}. ${c.anchors.note || ''}`);
        row('Csavar', list(c.screws));
      } else {
        row('Hogyan tart', c.holds); row('Befogás', c.shank); row('Üzemmód', c.mode); row('Menet', c.thread); row('Fej', c.head); row('Mi ez', c.what);
        row('Mibe', list(c.for)); row('Dübelhez', c.with && c.with.length ? list(c.with) : '');
        row('Fúrás', c.drill); row('Csavar', c.screw); row('Méretek', c.sizes); row('Használat', c.use);
      }
      if (c.traps && c.traps.length) { L.push('- **Buktatók:**'); for (const t of c.traps) L.push(`  - ${t}`); }
      L.push(`- **Keresőszavak:** HU: ${c.terms.hu.join(' · ')} — EN: ${c.terms.en.join(' · ')} — DE: ${c.terms.de.join(' · ')}`);
      row('Hol kapható', c.shop); stockRows(L, c); L.push('');
    }
  }
  const out = path.join(K.root, vol.dir, 'KISOKOS.md');
  fs.writeFileSync(out, L.join('\n'));
  return `wrote ${path.relative(K.repo, out)} (${cs.length} cards)`;
}

function stats(K = load()) {
  const by = {};
  for (const c of K.cards) { const k = c.vol + ' · ' + c.kind; by[k] = by[k] || { n: 0, bytes: 0, cubes: 0 }; by[k].n++; by[k].bytes += c.bytes; by[k].cubes += c.cubes; }
  const rows = Object.entries(by).map(([k, v]) => `${k.padEnd(18)} ${String(v.n).padStart(3)} cards ${String(v.bytes).padStart(7)} B ${String(v.cubes).padStart(4)} cubes`);
  for (const s of K.sources) rows.push(`${('source · ' + s.id).padEnd(18)} ${String(s.files).padStart(3)} files ${String(s.bytes).padStart(7)} B ${String(s.cubes).padStart(4)} cubes`);
  return rows.join('\n');
}

module.exports = { load, check, md, stats, KIND_HU, VS, LS, XREFS };

if (require.main === module) {
  const cmd = process.argv[2];
  const K = load();
  if (cmd === 'check') {
    const P = check(K);
    console.log(P.length ? P.map(p => '✗ ' + p).join('\n') : `ok: ${K.cards.length} cards, ${K.terms.length} term nodes, ${K.sources.length} knowledge bases`);
    if (P.length) process.exitCode = 1;
  } else if (cmd === 'md') console.log(md(K));
  else if (cmd === 'stats') console.log(stats(K));
  else if (cmd === 'keszlet') console.log(keszletReport(K, process.argv.includes('--add')));
  else console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).slice(0, 8).map(l => l.slice(3)).join('\n'));
}
