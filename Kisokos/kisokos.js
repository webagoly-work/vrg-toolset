#!/usr/bin/env node
// VRG Kisokos — the one loader and checker for the Kisokos sources. Read-only on the sources
// except `md`, which writes the generated cheat sheet next to the cards.
//
//   node Kisokos/kisokos.js check     validate map.json and every card (ids, places, cross-references,
//                                     search terms); exit 1 on a problem
//   node Kisokos/kisokos.js md        write rogzitestechnika/KISOKOS.md, the readable cheat sheet
//   node Kisokos/kisokos.js stats     cards, bytes and cubes per volume and per knowledge base
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
const REFS = { anyag: ['bits', 'anchors', 'screws'], dubel: ['for'], furoszar: ['for'], csavar: ['for', 'with'], szerszam: ['for'] };
const KIND_HU = { anyag: 'Anyag', dubel: 'Dübel, horgony', furoszar: 'Fúrószár', csavar: 'Csavar', szerszam: 'Szerszám' };

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
  const cube = map.cubeBytes || 1024;
  for (const x of [...cards, ...sources]) x.cubes = Math.max(1, Math.round(x.bytes / cube));
  return { map, terms, termIds, cards, sources, problems, root, repo: REPO };
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
    if (!c.shop) P.push(`${who}: no shop`);
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
  }
  for (const s of K.sources) { placeOk(`source ${s.id}`, s.place); if (s.missing.length) P.push(`source ${s.id}: missing ${s.missing.join(', ')}`); }
  return P;
}

const name = (K, vol, id) => { const c = K.cards.find(x => x.vol === vol && x.id === id); return c ? c.title : id; };
function md(K = load()) {
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
      row('Hol kapható', c.shop); L.push('');
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

module.exports = { load, check, md, stats, KIND_HU };

if (require.main === module) {
  const cmd = process.argv[2];
  const K = load();
  if (cmd === 'check') {
    const P = check(K);
    console.log(P.length ? P.map(p => '✗ ' + p).join('\n') : `ok: ${K.cards.length} cards, ${K.terms.length} term nodes, ${K.sources.length} knowledge bases`);
    if (P.length) process.exitCode = 1;
  } else if (cmd === 'md') console.log(md(K));
  else if (cmd === 'stats') console.log(stats(K));
  else console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).slice(0, 8).map(l => l.slice(3)).join('\n'));
}
