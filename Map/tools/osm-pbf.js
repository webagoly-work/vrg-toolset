// osm-pbf.js — a dependency-free reader of OpenStreetMap .osm.pbf files (protobuf varints + zlib are
// all the format needs). The same primitives as build-addresses.js, as a module, for the tools that
// came after it (build-pois.js).
//
//   const { readPbf } = require('./osm-pbf.js');
//   readPbf(file, { node(id, lon, lat, tags|null) {}, way(id, tags, refs) {} }, { nodes: true, ways: true })
//
// `tags` is a plain object, or null for a node without tags (only passed when `untagged: true`, the
// bulk of a file). `refs` are the way's node ids, already un-delta'd. Relations are not read.
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function varint(b, p) {
  let r = 0, m = 1, c;
  do { c = b[p.i++]; r += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
  return r;
}
const zz = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);
function skip(b, p, wt) {
  if (wt === 0) varint(b, p);
  else if (wt === 1) p.i += 8;
  else if (wt === 2) { const len = varint(b, p); p.i += len; }
  else if (wt === 5) p.i += 4;
  else throw new Error('wire type ' + wt);
}
function fields(b, start, end, cb) {
  const p = { i: start };
  while (p.i < end) {
    const tag = varint(b, p), f = Math.floor(tag / 8), wt = tag & 7;
    const at = p.i;
    if (cb(f, wt, p) === false) { p.i = at; skip(b, p, wt); }
  }
}
function packed(b, p, fn) {
  const len = varint(b, p), end = p.i + len, out = [];
  while (p.i < end) out.push(fn(varint(b, p)));
  return out;
}
const id = x => x;

function primitiveBlock(b, cb, opt) {
  const strings = [];
  let gran = 100, latOff = 0, lonOff = 0;
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
    if (f === 2 && opt.nodes) {                 // DenseNodes
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
        let t = null;
        if (kv.length) {
          while (k < kv.length && kv[k] !== 0) { (t = t || {})[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
          k++;
        }
        if (t || opt.untagged) cb.node(nid, coord(lonOff, lo), coord(latOff, la), t);
      }
    } else if (f === 1 && opt.nodes) {          // plain Node (rare)
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
      const t = keys.length ? tagsOf(keys, vals) : null;
      if (t || opt.untagged) cb.node(nid, coord(lonOff, lo), coord(latOff, la), t);
    } else if (f === 3 && opt.ways) {           // Way
      const len = varint(b, p), end = p.i + len;
      let wid = 0, keys = [], vals = [], refs = [];
      fields(b, p.i, end, (g, w, q) => {
        if (g === 1) wid = varint(b, q);
        else if (g === 2) keys = packed(b, q, id);
        else if (g === 3) vals = packed(b, q, id);
        else if (g === 8) refs = packed(b, q, zz);
        else return false;
      });
      p.i = end;
      if (!keys.length) return;
      let r = 0;
      cb.way(wid, tagsOf(keys, vals), refs.map(d => (r += d)));
    } else return false;
  });
}

/** Calls cb.node / cb.way for the file's primitives; opt.nodes / opt.ways / opt.untagged choose what. */
function readPbf(file, cb, opt) {
  opt = Object.assign({ nodes: true, ways: true, untagged: false }, opt);
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;
  let pos = 0, blocks = 0;
  const head4 = Buffer.alloc(4);
  try {
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
      primitiveBlock(raw, cb, opt);
      blocks++;
      if (cb.progress && blocks % 500 === 0) cb.progress(pos / size);
    }
  } finally { fs.closeSync(fd); }
  return blocks;
}

module.exports = { readPbf };
