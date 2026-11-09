#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-addresses.js — the offline search index of VRG Térkép, built from an
// OpenStreetMap .osm.pbf extract (Geofabrik hungary-latest).
//
//   node Map/tools/build-addresses.js <in.osm.pbf> <out.json> [--bbox=w,s,e,n]
//
// What goes in:
//   places   every named settlement/suburb in Hungary (city..hamlet)
//   streets  named roads inside the detail box (Budapest + Pest county)
//   addr     every house number inside the detail box (nodes and building ways)
//
// Output (compact, the page decodes it):
//   { v, built, bbox, s: [strings], places: [[name, kind, lon, lat]],
//     streets: [[streetIdx, cityIdx, lon, lat]], addr: [[cityIdx, streetIdx, hn, pc, lon, lat]] }
//   lon/lat are integers in 1e-5 degrees (~1 m).
//
// Zero dependencies: protobuf varints and zlib are all the .pbf format needs.
// Relations (multipolygon buildings) are skipped — a few hundred addresses.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const [IN, OUT] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!IN || !OUT) { console.error('usage: build-addresses.js <in.osm.pbf> <out.json> [--bbox=w,s,e,n]'); process.exit(2); }
const bboxArg = (process.argv.find(a => a.startsWith('--bbox=')) || '--bbox=18.55,46.85,20.40,48.00').slice(7);
const [W, S, E, N] = bboxArg.split(',').map(Number);
const inBox = (lon, lat) => lon >= W && lon <= E && lat >= S && lat <= N;

// ---- protobuf primitives ---------------------------------------------------
// Numbers, not BigInt: OSM ids and coordinates stay far below 2^53.
function varint(b, p) {
  let r = 0, m = 1, c;
  do { c = b[p.i++]; r += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
  return r;
}
const zz = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);
function skip(b, p, wt) {
  if (wt === 0) varint(b, p);
  else if (wt === 1) p.i += 8;
  else if (wt === 2) { const len = varint(b, p); p.i += len; }   // not p.i += varint(): that reads p.i first
  else if (wt === 5) p.i += 4;
  else throw new Error('wire type ' + wt);
}
// Iterate the fields of a message in b[start, end): cb(field, wireType, p)
function fields(b, start, end, cb) {
  const p = { i: start };
  while (p.i < end) {
    const tag = varint(b, p), f = Math.floor(tag / 8), wt = tag & 7;
    const at = p.i;
    if (cb(f, wt, p) === false) { p.i = at; skip(b, p, wt); }
  }
}
function packed(b, p, fn) {           // packed repeated varints -> array (fn maps each)
  const len = varint(b, p), end = p.i + len, out = [];
  while (p.i < end) out.push(fn(varint(b, p)));
  return out;
}
const id = x => x;

// ---- collected data --------------------------------------------------------
let cap = 1 << 22, nNodes = 0;
let nodeId = new Float64Array(cap), nodeLon = new Int32Array(cap), nodeLat = new Int32Array(cap);
function keepNode(i, lon, lat) {
  if (nNodes === cap) {
    cap *= 2;
    const a = new Float64Array(cap); a.set(nodeId); nodeId = a;
    const o = new Int32Array(cap); o.set(nodeLon); nodeLon = o;
    const t = new Int32Array(cap); t.set(nodeLat); nodeLat = t;
  }
  nodeId[nNodes] = i; nodeLon[nNodes] = Math.round(lon * 1e7); nodeLat[nNodes] = Math.round(lat * 1e7); nNodes++;
}
function findNode(i) {                // the .pbf is sorted by id, so binary search
  let lo = 0, hi = nNodes - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, v = nodeId[mid];
    if (v === i) return mid;
    if (v < i) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

const PLACE = new Set(['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet', 'borough']);
const ROAD = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'living_street', 'pedestrian', 'service', 'track', 'footway', 'cycleway', 'road', 'primary_link', 'secondary_link']);
const places = [], addrs = [], roads = [];

function onTags(tags, lon, lat) {    // a node or the centroid of a way
  if (tags.place && tags.name && PLACE.has(tags.place)) places.push([tags.name, tags.place, lon, lat]);
  if (tags['addr:housenumber'] && inBox(lon, lat)) {
    const street = tags['addr:street'] || tags['addr:place'] || '';
    if (street) addrs.push([tags['addr:city'] || '', street, tags['addr:housenumber'], tags['addr:postcode'] || '', lon, lat]);
  }
}

// ---- blocks ----------------------------------------------------------------
function primitiveBlock(b) {
  let strings = [], gran = 100, latOff = 0, lonOff = 0;
  const groups = [];
  fields(b, 0, b.length, (f, wt, p) => {
    if (f === 1) {
      const len = varint(b, p), end = p.i + len;
      fields(b, p.i, end, (g, w, q) => {
        if (g !== 1) return false;
        const l = varint(b, q); strings.push(b.toString('utf8', q.i, q.i + l)); q.i += l;
      });
      p.i = end;
    } else if (f === 2) { const len = varint(b, p); groups.push([p.i, p.i + len]); p.i += len; }
    else if (f === 17) gran = varint(b, p);
    else if (f === 19) latOff = zz(varint(b, p));
    else if (f === 20) lonOff = zz(varint(b, p));
    else return false;
  });
  const coord = (off, v) => 1e-9 * (off + gran * v);
  const tagsOf = (keys, vals) => { const t = {}; for (let k = 0; k < keys.length; k++) t[strings[keys[k]]] = strings[vals[k]]; return t; };

  for (const [gs, ge] of groups) fields(b, gs, ge, (f, wt, p) => {
    if (f === 2) {                    // DenseNodes
      const len = varint(b, p), end = p.i + len;
      let ids = [], lats = [], lons = [], kv = [];
      fields(b, p.i, end, (g, w, q) => {
        if (g === 1) ids = packed(b, q, zz);
        else if (g === 8) lats = packed(b, q, zz);
        else if (g === 9) lons = packed(b, q, zz);
        else if (g === 10) kv = packed(b, q, id);
        else return false;
      });
      p.i = end;
      let nid = 0, la = 0, lo = 0, k = 0;
      for (let n = 0; n < ids.length; n++) {
        nid += ids[n]; la += lats[n]; lo += lons[n];
        const lat = coord(latOff, la), lon = coord(lonOff, lo);
        if (inBox(lon, lat)) keepNode(nid, lon, lat);
        if (kv.length) {
          let t = null;
          while (k < kv.length && kv[k] !== 0) { (t = t || {})[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
          k++;
          if (t) onTags(t, lon, lat);
        }
      }
    } else if (f === 1) {             // plain Node (rare in Geofabrik files)
      const len = varint(b, p), end = p.i + len;
      let nid = 0, la = 0, lo = 0, keys = [], vals = [];
      fields(b, p.i, end, (g, w, q) => {
        if (g === 1) nid = zz(varint(b, q));
        else if (g === 2) keys = packed(b, q, id);
        else if (g === 3) vals = packed(b, q, id);
        else if (g === 8) la = zz(varint(b, q));
        else if (g === 9) lo = zz(varint(b, q));
        else return false;
      });
      p.i = end;
      const lat = coord(latOff, la), lon = coord(lonOff, lo);
      if (inBox(lon, lat)) keepNode(nid, lon, lat);
      if (keys.length) onTags(tagsOf(keys, vals), lon, lat);
    } else if (f === 3) {             // Way
      const len = varint(b, p), end = p.i + len;
      let keys = [], vals = [], refs = [];
      fields(b, p.i, end, (g, w, q) => {
        if (g === 2) keys = packed(b, q, id);
        else if (g === 3) vals = packed(b, q, id);
        else if (g === 8) refs = packed(b, q, zz);
        else return false;
      });
      p.i = end;
      if (!keys.length) return;
      const t = tagsOf(keys, vals);
      const isAddr = !!t['addr:housenumber'], isRoad = t.highway && t.name && ROAD.has(t.highway);
      const isPlace = t.place && t.name && PLACE.has(t.place);
      if (!isAddr && !isRoad && !isPlace) return;
      let r = 0, sx = 0, sy = 0, c = 0, mid = null;
      const pts = [];
      for (const d of refs) { r += d; const j = findNode(r); if (j >= 0) pts.push(j); }
      if (!pts.length) return;
      for (const j of pts) { sx += nodeLon[j]; sy += nodeLat[j]; c++; }
      const cx = sx / c / 1e7, cy = sy / c / 1e7;
      if (isRoad) { mid = pts[pts.length >> 1]; roads.push([t.name, nodeLon[mid] / 1e7, nodeLat[mid] / 1e7]); }
      if (isAddr || isPlace) onTags(t, cx, cy);
    } else return false;
  });
}

// ---- file loop ---------------------------------------------------------------
const t0 = Date.now();
const fd = fs.openSync(IN, 'r');
const size = fs.fstatSync(fd).size;
let pos = 0, blocks = 0;
const head4 = Buffer.alloc(4);
while (pos < size) {
  fs.readSync(fd, head4, 0, 4, pos); pos += 4;
  const hlen = head4.readUInt32BE(0);
  const hb = Buffer.alloc(hlen); fs.readSync(fd, hb, 0, hlen, pos); pos += hlen;
  let type = '', dlen = 0;
  fields(hb, 0, hlen, (f, wt, p) => {
    if (f === 1) { const l = varint(hb, p); type = hb.toString('utf8', p.i, p.i + l); p.i += l; }
    else if (f === 3) dlen = varint(hb, p);
    else return false;
  });
  const blob = Buffer.alloc(dlen); fs.readSync(fd, blob, 0, dlen, pos); pos += dlen;
  if (type !== 'OSMData') continue;
  let raw = null;
  fields(blob, 0, dlen, (f, wt, p) => {
    if (f === 1 || f === 3) { const l = varint(blob, p); const part = blob.subarray(p.i, p.i + l); p.i += l; raw = f === 1 ? part : zlib.inflateSync(part); }
    else return false;
  });
  if (!raw) throw new Error('unsupported blob compression (only raw and zlib)');
  primitiveBlock(raw);
  if (++blocks % 500 === 0) process.stdout.write('  ' + (pos / size * 100).toFixed(0) + '%  nodes ' + nNodes + '  addr ' + addrs.length + '\r');
}
fs.closeSync(fd);
console.log('  read ' + blocks + ' blocks in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s: ' +
  places.length + ' places, ' + roads.length + ' road ways, ' + addrs.length + ' addresses');

// ---- settle every row on a settlement name ---------------------------------
// Budapest: addresses carry addr:city=Budapest and a postcode 1DDx -> district DD.
const settlements = places.filter(p => p[1] === 'city' || p[1] === 'town' || p[1] === 'village');
function nearestSettlement(lon, lat) {
  let best = '', bd = Infinity;
  const k = Math.cos(lat * Math.PI / 180);
  for (const s of settlements) {
    const dx = (s[2] - lon) * k, dy = s[3] - lat, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = s[0]; }
  }
  return best;
}
// Street name -> cities seen on its addresses, with a point each: a road takes the city of the
// nearest address on the same street (within ~2 km), so a street on Budapest's edge is not
// filed under the neighbouring village just because that village's centre is closer.
const byStreet = new Map();
for (const a of addrs) {
  if (!a[0]) a[0] = nearestSettlement(a[4], a[5]);
  let l = byStreet.get(a[1]); if (!l) byStreet.set(a[1], l = []);
  l.push(a);
}
const streets = new Map();       // "name|city" -> [name, city, lon, lat]
for (const [name, lon, lat] of roads) {
  let city = '', bd = 4e-4;      // (~2 km)^2 in degrees^2
  const k = Math.cos(lat * Math.PI / 180);
  for (const a of byStreet.get(name) || []) {
    const dx = (a[4] - lon) * k, dy = a[5] - lat, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; city = a[0]; }
  }
  if (!city) city = nearestSettlement(lon, lat);
  const key = name + '|' + city;
  if (!streets.has(key)) streets.set(key, [name, city, lon, lat]);
}
for (const [name, list] of byStreet) {     // streets known only from addresses (addr:place, squares)
  for (const a of list) { const key = name + '|' + a[0]; if (!streets.has(key)) streets.set(key, [name, a[0], a[4], a[5]]); }
}

// ---- write -----------------------------------------------------------------
const sIdx = new Map(), s = [];
const si = str => { let i = sIdx.get(str); if (i === undefined) { i = s.length; s.push(str); sIdx.set(str, i); } return i; };
const q = x => Math.round(x * 1e5);
const out = {
  v: 1,
  built: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap (ODbL) via ' + require('path').basename(IN),
  bbox: [W, S, E, N],
  places: places.map(p => [p[0], p[1], q(p[2]), q(p[3])]),
  streets: [...streets.values()].map(r => [si(r[0]), si(r[1]), q(r[2]), q(r[3])]),
  addr: addrs.map(a => [si(a[0]), si(a[1]), a[2], a[3], q(a[4]), q(a[5])]),
  s,
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('  wrote ' + OUT + ': ' + out.places.length + ' places, ' + out.streets.length + ' streets, ' +
  out.addr.length + ' addresses, ' + (fs.statSync(OUT).size / 1e6).toFixed(1) + ' MB');
