#!/usr/bin/env node
// tools/build-bp-heights.js — measured building heights for the VRG Térkép's B layer: a GeoJSON of footprints with a
// height (the Budapest Open Data Atlas "Épületmagasság", or any other) → Map/data/bp-heights.bin (lib/heights.js).
//
//   node Map/tools/build-bp-heights.js <footprints.geojson> [--field DN] [--out Map/data/bp-heights.bin]
//                                      [--source "…"] [--licence "…"] [--min 2] [--max 400]
//
// The height field: --field, else the first of DN, height, HEIGHT, magassag, MAGASSAG, epulet_mag that holds a number.
// Coordinates: WGS84 lon/lat, or EOV (EPSG:23700, metres: east ≈ 400 000–950 000, north ≈ 30 000–370 000), which is
// recognised and converted (lib/heights.js eovToWgs). Heights outside [--min, --max] metres are left out (a broken
// value; the map then falls back to OSM). The output is local data (Map/data is gitignored): the licence of the source
// is recorded in the file and in data/manifest.json, and must be checked before the data is shared anywhere.
'use strict';
const fs = require('fs'), path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'heights.js'));
const MAP = path.join(__dirname, '..');
const FIELDS = ['DN', 'height', 'HEIGHT', 'magassag', 'MAGASSAG', 'epulet_mag'];

function args(a) { const o = { _: [] }; for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) o[a[i].slice(2)] = a[++i]; else o._.push(a[i]); } return o; }

/** EOV or WGS84? Looks at the first coordinates. */
function isEov(fc) {
  for (const f of fc.features || []) {
    const g = f.geometry; if (!g) continue;
    const p = g.type === 'Polygon' ? g.coordinates[0][0] : g.type === 'MultiPolygon' ? g.coordinates[0][0][0] : null;
    if (p) return p[0] > 300000 && p[0] < 1000000 && p[1] > 0 && p[1] < 400000;
  }
  return false;
}

function convert(fc, o) {
  const opt = o || {}, min = +(opt.min || 2), max = +(opt.max || 400);
  const eov = isEov(fc), tr = eov ? p => H.eovToWgs(p[0], p[1]) : p => [p[0], p[1]];
  let field = opt.field;
  if (!field) for (const f of fc.features || []) { const p = f.properties || {}; field = FIELDS.find(k => p[k] != null && !isNaN(parseFloat(p[k]))); if (field) break; }
  if (!field) throw new Error('no height field (tried ' + FIELDS.join(', ') + '): give --field');
  const out = []; let skipped = 0;
  for (const f of fc.features || []) {
    const g = f.geometry, h = parseFloat((f.properties || {})[field]);
    if (!g || !(h >= min && h <= max)) { skipped++; continue; }
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) out.push({ h, rings: poly.map(r => r.map(tr)) });
  }
  return { buildings: out, field, eov, skipped };
}

function main() {
  const a = args(process.argv.slice(2));
  const inp = a._[0];
  if (!inp || !fs.existsSync(inp)) { console.log('Használat: node Map/tools/build-bp-heights.js <footprints.geojson> [--field DN] [--out Map/data/bp-heights.bin] [--source "…"] [--licence "…"]'); process.exit(2); }
  const fc = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const c = convert(fc, a);
  const meta = { kind: 'vrg-heights', built: new Date().toISOString().slice(0, 10), source: a.source || path.basename(inp), licence: a.licence || 'ellenőrizendő', field: c.field, crs: c.eov ? 'EPSG:23700 → WGS84' : 'WGS84' };
  const bin = H.encode(c.buildings, meta);
  const out = a.out || path.join(MAP, 'data', 'bp-heights.bin');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bin);
  // the manifest the rest of Map/data keeps (tools/fetch-data.js)
  const mf = path.join(path.dirname(out), 'manifest.json');
  try {
    const m = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
    (m.parts || (m.parts = {}))['bp-heights'] = { file: path.basename(out), source: meta.source, licence: meta.licence, built: meta.built, bytes: bin.length, buildings: H.decode(bin).n };
    fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
  } catch (e) { console.log('(a manifest.json nem frissült: ' + e.message + ')'); }
  console.log('kész: ' + path.relative(process.cwd(), out) + ' · ' + H.decode(bin).n + ' épület (' + c.field + (c.eov ? ', EOV-ből' : '') + '), ' + c.skipped + ' kihagyva, ' + Math.round(bin.length / 1024) + ' KB');
}

if (require.main === module) { try { main(); } catch (e) { console.error('[bp-heights] ' + e.message); process.exit(1); } }
module.exports = { convert, isEov };
