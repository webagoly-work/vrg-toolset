#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-roads.js — the VRG Térkép's own road network for offline routing (WP M56, N2, D-129 A), from the
// OpenStreetMap extract the map already downloads (Map/data/src/hungary-latest.osm.pbf).
//
//   node Map/tools/build-roads.js <in.osm.pbf> <out.bin>
//
// What goes in: every way with a `highway` a car or a pedestrian can use (tracks, bridleways, construction
// and proposals are left out). The graph's nodes are the junctions and the ends of ways; an edge is the
// stretch of one way between two of them, with its length, a car speed, car-forward / car-backward / foot
// flags (one-ways, roundabouts, motorways; access=no/private; foot=no; no pedestrians on motorways and
// trunks) and its shape simplified to 4 m (Douglas-Peucker), so the route can be drawn.
//
// Car speed: 85 % of `maxspeed` (HU:urban 50, HU:rural 90, HU:motorway 130), else a typical speed for the
// road class (lib/route.js SPEED). On foot everything is walked at 4.8 km/h, steps at 2.5.
//
// Output (lib/route.js decode() reads it): "VRGR" 2 <varint headerLen> <header JSON> <deflate(payload)>.
// The payload is varints: nodes (delta lon/lat in 1e-5°, spatially sorted), the street names (count, then
// length + UTF-8 each; 0 is "no name"), then edges sorted by their first node (delta first node, zigzag
// delta second node, flags, speed, length in dm, name, shape point count, shape points as zigzag deltas
// from the first node). Flags: car forward / backward, foot, steps, roundabout, link, motorway or trunk.
// Version 1 (no names) is still read. Public data (ODbL).
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readPbf } = require('./osm-pbf.js');
const R = require('../lib/route.js');

const SKIP = new Set(['track', 'bridleway', 'construction', 'proposed', 'abandoned', 'raceway', 'bus_guideway', 'platform',
  'corridor', 'escape', 'elevator', 'rest_area', 'services', 'via_ferrata', 'disused']);
const CAR = new Set(Object.keys(R.SPEED));
const NO_FOOT = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link']);
const NO = new Set(['no', 'private']);

function maxspeed(v) {
  if (!v) return 0;
  const named = { 'HU:urban': 50, 'HU:rural': 90, 'HU:motorway': 130, 'HU:trunk': 110, walk: 5, living_street: 20 };
  if (named[v]) return named[v];
  const m = /^(\d+)/.exec(v);
  return m ? Number(m[1]) : 0;
}

/** The routing view of one way: { cls, flags, speed } or null when nobody may use it. */
function wayInfo(t) {
  const hw = t.highway;
  if (!hw || SKIP.has(hw) || t.area === 'yes') return null;
  let car = CAR.has(hw) && !NO.has(t.access || '') && !NO.has(t.motor_vehicle || '') && !NO.has(t.motorcar || '') && !NO.has(t.vehicle || '');
  if (t.motorcar === 'yes' || t.motor_vehicle === 'yes') car = CAR.has(hw) || hw === 'road';
  let foot = !NO_FOOT.has(hw) && !NO.has(t.foot || '') && !(NO.has(t.access || '') && t.foot !== 'yes' && t.foot !== 'designated');
  if (hw === 'cycleway' && !['yes', 'designated', 'permissive'].includes(t.foot)) foot = false;   // a cycle path: only when foot is allowed
  if (!car && !foot) return null;
  let fwd = car, back = car;
  const ow = t.oneway;
  const implied = t.junction === 'roundabout' || t.junction === 'circular' || hw === 'motorway';
  if (car) {
    if (ow === 'yes' || ow === 'true' || ow === '1' || (implied && ow !== 'no')) back = false;
    else if (ow === '-1' || ow === 'reverse') fwd = false;
  }
  const ms = maxspeed(t.maxspeed);
  const speed = car ? Math.max(5, Math.round(ms ? Math.min(ms * 0.85, (R.SPEED[hw] || 30) * 1.6) : (R.SPEED[hw] || 30))) : 0;
  const flags = (fwd ? R.CAR_FWD : 0) | (back ? R.CAR_BACK : 0) | (foot ? R.FOOT : 0) | (hw === 'steps' ? R.STEPS : 0) |
    (t.junction === 'roundabout' || t.junction === 'circular' ? R.ROUNDABOUT : 0) | (/_link$/.test(hw) ? R.LINK : 0) |
    (hw === 'motorway' || hw === 'trunk' ? R.FAST : 0);
  return { cls: hw, flags, speed, name: t.name || t.ref || '' };
}

// ---- varints ---------------------------------------------------------------
class Out {
  constructor() { this.bufs = []; this.b = Buffer.alloc(1 << 20); this.i = 0; }
  room(n) { if (this.i + n > this.b.length) { this.bufs.push(this.b.subarray(0, this.i)); this.b = Buffer.alloc(Math.max(1 << 20, n)); this.i = 0; } }
  v(n) { this.room(10); while (n >= 128) { this.b[this.i++] = (n % 128) | 128; n = Math.floor(n / 128); } this.b[this.i++] = n; }
  z(n) { this.v(n >= 0 ? 2 * n : -2 * n - 1); }
  done() { this.bufs.push(this.b.subarray(0, this.i)); return Buffer.concat(this.bufs); }
}

// ---- Douglas-Peucker on local metres ----------------------------------------
function simplify(pts, tol) {          // pts: [[lonE5, latE5], ...] including both ends; returns kept inner points
  if (pts.length <= 2) return [];
  const k = Math.cos(pts[0][1] / 1e5 * Math.PI / 180) * 1.11320, m = 1.10574;   // metres per 1e-5°
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0] * k, ay = pts[a][1] * m, bx = pts[b][0] * k, by = pts[b][1] * m;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let worst = -1, wd = tol;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * k, py = pts[i][1] * m;
      let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const out = [];
  for (let i = 1; i < pts.length - 1; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function buildRoads(file, log = () => {}) {
  const t0 = Date.now();
  // pass 1: the usable ways and every node id they use
  const ways = [];
  let refs = new Float64Array(1 << 22), nRefs = 0;
  const push = id => { if (nRefs === refs.length) { const a = new Float64Array(refs.length * 2); a.set(refs); refs = a; } refs[nRefs++] = id; };
  readPbf(file, {
    way(id, t, r) {
      if (r.length < 2) return;
      const w = wayInfo(t);
      if (!w) return;
      w.refs = r; ways.push(w);
      for (const x of r) push(x);
      push(r[0]); push(r[r.length - 1]);            // the ends count twice: always graph nodes
    },
    progress: f => log('  pass 1 ' + (f * 100).toFixed(0) + '%'),
  }, { nodes: false, ways: true });
  const sorted = refs.subarray(0, nRefs).sort();
  const uniq = new Float64Array(nRefs), cnt = new Uint8Array(nRefs);
  let nU = 0;
  for (let i = 0; i < nRefs; i++) {
    if (nU && uniq[nU - 1] === sorted[i]) { if (cnt[nU - 1] < 255) cnt[nU - 1]++; }
    else { uniq[nU] = sorted[i]; cnt[nU] = 1; nU++; }
  }
  refs = null;
  const find = id => { let lo = 0, hi = nU - 1; while (lo <= hi) { const mid = (lo + hi) >> 1, v = uniq[mid]; if (v === id) return mid; if (v < id) lo = mid + 1; else hi = mid - 1; } return -1; };
  // pass 2: the coordinates of those nodes
  const lon = new Int32Array(nU), lat = new Int32Array(nU), has = new Uint8Array(nU);
  readPbf(file, {
    node(id, x, y) { const j = find(id); if (j >= 0) { lon[j] = Math.round(x * 1e5); lat[j] = Math.round(y * 1e5); has[j] = 1; } },
    way() {},
    progress: f => log('  pass 2 ' + (f * 100).toFixed(0) + '%'),
  }, { nodes: true, ways: false, untagged: true });

  // the edges: each way cut at its junctions (a node used twice or more, or a way's end)
  const gIdx = new Int32Array(nU).fill(-1);
  let nG = 0;
  const gOf = j => (gIdx[j] < 0 ? (gIdx[j] = nG++) : gIdx[j]);
  const edges = [];                                 // [a, b, flags, speed, dm, shape, name]
  const names = [''], nameIdx = new Map([['', 0]]);  // street names for the guidance (N3); 0 = none
  const nameId = n => { let i = nameIdx.get(n); if (i === undefined) { i = names.length; names.push(n); nameIdx.set(n, i); } return i; };
  const segLen = (j1, j2) => R.distance(lon[j1] / 1e5, lat[j1] / 1e5, lon[j2] / 1e5, lat[j2] / 1e5);
  for (const w of ways) {
    const js = w.refs.map(find);
    let start = -1, len = 0, mid = [];
    for (let i = 0; i < js.length; i++) {
      const j = js[i];
      if (j < 0 || !has[j]) { start = -1; len = 0; mid = []; continue; }   // outside the extract: the way is cut there
      if (start < 0) { start = j; len = 0; mid = []; continue; }
      len += segLen(js[i - 1] >= 0 && has[js[i - 1]] ? js[i - 1] : start, j);
      const junction = cnt[j] > 1 || i === js.length - 1;
      if (!junction) { mid.push(j); continue; }
      if (j !== start) {                            // a way closing on itself with no junction between is skipped
        const pts = [[lon[start], lat[start]]].concat(mid.map(q => [lon[q], lat[q]]), [[lon[j], lat[j]]]);
        edges.push([gOf(start), gOf(j), w.flags, w.speed, Math.max(1, Math.round(len * 10)), simplify(pts, 4), nameId(w.name)]);
      }
      start = j; len = 0; mid = [];
    }
  }
  // spatial order for small deltas
  const gl = new Int32Array(nG), ga = new Int32Array(nG);
  for (let j = 0; j < nU; j++) if (gIdx[j] >= 0) { gl[gIdx[j]] = lon[j]; ga[gIdx[j]] = lat[j]; }
  const order = Array.from({ length: nG }, (_, i) => i).sort((p, q) => (Math.floor(ga[p] / 5000) - Math.floor(ga[q] / 5000)) || (gl[p] - gl[q]));
  const rank = new Int32Array(nG);
  order.forEach((g, r) => { rank[g] = r; });
  for (const e of edges) { e[0] = rank[e[0]]; e[1] = rank[e[1]]; }
  edges.sort((p, q) => p[0] - q[0] || p[1] - q[1]);

  const o = new Out();
  o.v(nG);
  let pl = 0, pa = 0;
  for (const g of order) { o.z(gl[g] - pl); o.z(ga[g] - pa); pl = gl[g]; pa = ga[g]; }
  o.v(names.length);
  for (const n of names) { const nb = Buffer.from(n, 'utf8'); o.v(nb.length); o.room(nb.length); nb.copy(o.b, o.i); o.i += nb.length; }
  o.v(edges.length);
  let prevA = 0, nShape = 0;
  for (const [a, b, flags, speed, dm, shape, name] of edges) {
    o.v(a - prevA); prevA = a;
    o.z(b - a); o.v(flags); o.v(speed); o.v(dm); o.v(name); o.v(shape.length);
    let x = gl[order[a]], y = ga[order[a]];
    for (const [sx, sy] of shape) { o.z(sx - x); o.z(sy - y); x = sx; y = sy; }
    nShape += shape.length;
  }
  const payload = zlib.deflateRawSync(o.done(), { level: 9 });
  const header = Buffer.from(JSON.stringify({ v: 2, built: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap (ODbL) via ' + path.basename(file),
    nodes: nG, edges: edges.length, names: names.length - 1, shape: nShape, speeds: R.SPEED }));
  const hl = new Out(); hl.v(header.length);
  const out = Buffer.concat([Buffer.from('VRGR'), Buffer.from([2]), hl.done(), header, payload]);
  log('  ' + ways.length + ' ways, ' + nG + ' junctions, ' + edges.length + ' edges, ' + nShape + ' shape points, ' +
    (out.length / 1e6).toFixed(1) + ' MB, in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  return out;
}

if (require.main === module) {
  const [IN, OUT] = process.argv.slice(2);
  if (!IN || !OUT) { console.error('usage: build-roads.js <in.osm.pbf> <out.bin>'); process.exit(2); }
  const out = buildRoads(IN, m => process.stdout.write(m + '\n'));
  fs.writeFileSync(OUT + '.part', out);
  fs.renameSync(OUT + '.part', OUT);
  console.log('  wrote ' + OUT);
}

module.exports = { buildRoads, wayInfo, simplify };
