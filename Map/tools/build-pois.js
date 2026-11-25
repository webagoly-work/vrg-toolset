#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-pois.js — the Térkép-feed's points of interest (WP M55), from the OpenStreetMap extract the map
// already downloads (Map/data/src/hungary-latest.osm.pbf). All of Hungary, the categories of lib/feed.js.
//
//   node Map/tools/build-pois.js <in.osm.pbf> <out.json>
//
// Two passes, so a shop drawn as a building outline gets a point without keeping every node of the
// country in memory: 1) the ways that are points of interest, and the node ids they use; 2) the nodes
// that are points of interest, and the coordinates of those ids. A way's point is the mean of its nodes.
// Relations (a hospital drawn as a multipolygon) are not read: rare, and usually one of its parts is a
// tagged way or node too.
//
// Output (compact, lib/feed.js index() decodes it):
//   { v, built, source, s: [strings], cats: { <cat>: [[lonE5, latE5, nameIdx, kindIdx], ...] } }
// Public data (ODbL): kept on the phone like the address index.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const { readPbf } = require('./osm-pbf.js');
const F = require('../lib/feed.js');

const HU = [15.9, 45.6, 23.0, 48.7];        // Hungary with a margin (the basemap's box)
const inHu = (lon, lat) => lon >= HU[0] && lon <= HU[2] && lat >= HU[1] && lat <= HU[3];

function buildPois(file, log = () => {}) {
  const t0 = Date.now();
  // pass 1: the ways
  const ways = [];                             // [cat, name, kind, refs]
  const need = new Set();
  readPbf(file, {
    way(id, t, refs) {
      const cat = F.classify(t);
      if (!cat || cat === 'otthon') return;
      ways.push([cat, t.name || t.brand || '', F.kindOf(t), refs]);
      for (const r of refs) need.add(r);
    },
    progress: f => log('  pass 1 ' + (f * 100).toFixed(0) + '%'),
  }, { nodes: false, ways: true });
  // pass 2: the nodes
  const rows = [];                             // [cat, name, kind, lon, lat]
  const at = new Map();
  readPbf(file, {
    node(id, lon, lat, t) {
      if (need.has(id)) at.set(id, [lon, lat]);
      if (!t) return;
      const cat = F.classify(t);
      if (cat && cat !== 'otthon' && inHu(lon, lat)) rows.push([cat, t.name || t.brand || '', F.kindOf(t), lon, lat]);
    },
    way() {},
    progress: f => log('  pass 2 ' + (f * 100).toFixed(0) + '%'),
  }, { nodes: true, ways: false, untagged: true });
  for (const [cat, name, kind, refs] of ways) {
    let sx = 0, sy = 0, c = 0;
    const seen = new Set();
    for (const r of refs) { if (seen.has(r)) continue; seen.add(r); const p = at.get(r); if (p) { sx += p[0]; sy += p[1]; c++; } }
    if (c && inHu(sx / c, sy / c)) rows.push([cat, name, kind, sx / c, sy / c]);
  }
  // one point per place: a stop has a pole on each side of the road and often a platform too, a shop a
  // node and a building; the same name and category within 40 m is one point
  const out = { v: 1, built: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap (ODbL) via ' + path.basename(file), s: [], cats: {} };
  const sIdx = new Map();
  const si = str => { let i = sIdx.get(str); if (i === undefined) { i = out.s.length; out.s.push(str); sIdx.set(str, i); } return i; };
  const cell = new Map();
  let dropped = 0;
  for (const [cat, name, kind, lon, lat] of rows) {
    const key = cat + '|' + name + '|' + Math.round(lon * 1000) + '|' + Math.round(lat * 1000);
    const near = [];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const l = cell.get(cat + '|' + name + '|' + (Math.round(lon * 1000) + dx) + '|' + (Math.round(lat * 1000) + dy));
      if (l) near.push(...l);
    }
    if (name && near.some(p => F.distance(lon, lat, p[0], p[1]) < 40)) { dropped++; continue; }
    let l = cell.get(key); if (!l) cell.set(key, l = []);
    l.push([lon, lat]);
    (out.cats[cat] = out.cats[cat] || []).push([Math.round(lon * 1e5), Math.round(lat * 1e5), si(name), si(kind)]);
  }
  out.counts = Object.fromEntries(Object.entries(out.cats).map(([k, v]) => [k, v.length]));
  log('  ' + rows.length + ' objects, ' + dropped + ' duplicates dropped, in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  return out;
}

if (require.main === module) {
  const [IN, OUT] = process.argv.slice(2);
  if (!IN || !OUT) { console.error('usage: build-pois.js <in.osm.pbf> <out.json>'); process.exit(2); }
  const out = buildPois(IN, m => process.stdout.write(m + '\r'));
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('\n  wrote ' + OUT + ': ' + JSON.stringify(out.counts) + ', ' + (fs.statSync(OUT).size / 1e6).toFixed(1) + ' MB');
}

module.exports = { buildPois };
