// VRG Időjárás — a minimal ZIP reader (stored + deflate), enough for DWD .kmz and HungaroMet .csv.zip.
// Reads the central directory, so data descriptors and comments are handled. No ZIP64, no encryption.
'use strict';
const zlib = require('zlib');

function entries(buf) {
  // find the end-of-central-directory record (last 64 KB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    out.push({ name, method, csize, size, local });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

function read(buf, e) {
  const nlen = buf.readUInt16LE(e.local + 26), xlen = buf.readUInt16LE(e.local + 28);
  const start = e.local + 30 + nlen + xlen;
  const data = buf.slice(start, start + e.csize);
  if (e.method === 0) return data;
  if (e.method === 8) return zlib.inflateRawSync(data);
  throw new Error('zip method ' + e.method + ' not supported');
}

// the first entry whose name matches (or the first file), as a Buffer
function first(buf, re) {
  const list = entries(buf).filter(e => !e.name.endsWith('/'));
  const e = re ? list.find(x => re.test(x.name)) : list[0];
  if (!e) throw new Error('zip: no matching entry');
  return read(buf, e);
}

// write a one-file zip (deflate) — used by the tests to make .kmz / .csv.zip fixtures
function make(name, content) {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const comp = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const nameB = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28); cd.writeUInt32LE(0, 42);
  const cdOff = lh.length + nameB.length + comp.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cd.length + nameB.length, 12); end.writeUInt32LE(cdOff, 16);
  return Buffer.concat([lh, nameB, comp, cd, nameB, end]);
}
let TABLE;
function crc32(b) {
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

module.exports = { entries, read, first, make };
