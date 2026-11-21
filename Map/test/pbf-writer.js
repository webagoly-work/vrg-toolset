// A minimal .osm.pbf writer for tests: dense nodes and ways in one zlib block, the same format as a
// Geofabrik extract, so the tools' readers (tools/osm-pbf.js) are tested on a real file. Invented data.
//
//   writePbf(file, { nodes: [{ id, lon, lat, tags }], ways: [{ id, refs, tags }] })
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function varint(n) {                       // non-negative, up to 2^53
  const out = [];
  while (n >= 128) { out.push((n % 128) | 128); n = Math.floor(n / 128); }
  out.push(n);
  return Buffer.from(out);
}
const zig = n => (n >= 0 ? 2 * n : -2 * n - 1);
const key = (f, wt) => varint(f * 8 + wt);
const bytes = (f, buf) => Buffer.concat([key(f, 2), varint(buf.length), buf]);
const vint = (f, n) => Buffer.concat([key(f, 0), varint(n)]);
const packed = (f, nums) => bytes(f, Buffer.concat(nums.map(varint)));
const delta = arr => arr.map((v, i) => zig(v - (i ? arr[i - 1] : 0)));

function block(nodes, ways) {
  const strings = [''], idx = new Map([['', 0]]);
  const si = s => { if (!idx.has(s)) { idx.set(s, strings.length); strings.push(s); } return idx.get(s); };
  const ids = nodes.map(n => n.id), lats = nodes.map(n => Math.round(n.lat * 1e7)), lons = nodes.map(n => Math.round(n.lon * 1e7));
  const kv = [];
  for (const n of nodes) { for (const [k, v] of Object.entries(n.tags || {})) kv.push(si(k), si(v)); kv.push(0); }
  const dense = Buffer.concat([packed(1, delta(ids)), packed(8, delta(lats)), packed(9, delta(lons)), packed(10, kv)]);
  const wayBufs = ways.map(w => {
    const ks = Object.keys(w.tags || {}), vs = Object.values(w.tags || {});
    return bytes(3, Buffer.concat([vint(1, w.id), packed(2, ks.map(si)), packed(3, vs.map(si)), packed(8, delta(w.refs))]));
  });
  const groupNodes = bytes(2, bytes(2, dense));
  const groupWays = bytes(2, Buffer.concat(wayBufs));
  const table = bytes(1, Buffer.concat(strings.map(s => bytes(1, Buffer.from(s, 'utf8')))));
  return Buffer.concat([table, groupNodes, ways.length ? groupWays : Buffer.alloc(0), vint(17, 100)]);
}

function framed(type, raw) {
  const blob = Buffer.concat([vint(2, raw.length), bytes(3, zlib.deflateSync(raw))]);
  const header = Buffer.concat([bytes(1, Buffer.from(type)), vint(3, blob.length)]);
  const len = Buffer.alloc(4); len.writeUInt32BE(header.length);
  return Buffer.concat([len, header, blob]);
}

function writePbf(file, { nodes = [], ways = [] }) {
  const head = Buffer.concat([bytes(4, Buffer.from('OsmSchema-V0.6')), bytes(4, Buffer.from('DenseNodes'))]);
  fs.writeFileSync(file, Buffer.concat([framed('OSMHeader', head), framed('OSMData', block(nodes, ways))]));
}

module.exports = { writePbf };
