#!/usr/bin/env node
// ---------------------------------------------------------------------------
// fetch-data.js — download everything VRG Térkép needs to run offline, into
// Map/data/ (gitignored, rebuildable by running this again).
//
//   node Map/tools/fetch-data.js            fetch what is missing
//   node Map/tools/fetch-data.js --refresh  fetch everything again (new OSM week)
//   node Map/tools/fetch-data.js --only=basemap,terrain
//
// Parts (all free, keyless):
//   pmtiles   the pmtiles CLI (protomaps/go-pmtiles, BSD-3)  -> H:\VRG\Full\tools\pmtiles
//   vendor    maplibre-gl, pmtiles, @protomaps/basemaps via tools/fetch-vendor.js
//   fonts     Noto Sans glyph ranges (OFL) from protomaps/basemaps-assets
//   sprites   Protomaps v4 "light" icons (CC0 / BSD per basemaps-assets)
//   basemap   Hungary from the newest Protomaps daily planet build, z0-15
//             (OpenStreetMap data, ODbL)                    ~1 GB
//   terrain   Hungary from the Mapterhorn planet, z0-12, Terrarium WebP
//             (Copernicus GLO-30 and national DEMs, see mapterhorn.com)  ~0.35 GB
//   osm       Geofabrik hungary-latest.osm.pbf (ODbL)       ~0.33 GB
//   addresses build-addresses.js: the offline search index from the .pbf
//
// Every part is recorded in Map/data/manifest.json: source, date, licence, size.
// Console output stays ASCII (the START console garbles accents).
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const DATA = path.join(MAP, 'data');
const TOOLS = path.join(path.dirname(REPO), 'tools');
const PMTILES_DIR = path.join(TOOLS, 'pmtiles');
const PMTILES = path.join(PMTILES_DIR, process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles');
const PMTILES_VERSION = '1.31.2';
const BBOX_HU = '16.11,45.73,22.90,48.59';
const ASSETS = 'https://protomaps.github.io/basemaps-assets';
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
// Latin, Latin Extended-A (ő ű), general punctuation (– „ ” …), letterlike.
const RANGES = ['0-255', '256-511', '8192-8447'];

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const onlyArg = (args.find(a => a.startsWith('--only=')) || '').slice(7);
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const want = p => !only || only.has(p);

const MANIFEST = path.join(DATA, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { parts: {} };
const today = new Date().toISOString().slice(0, 10);
function record(part, info) {
  manifest.parts[part] = Object.assign({ fetched: today }, info);
  manifest.updated = today;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}
const mb = n => (n / 1e6).toFixed(1) + ' MB';
const have = f => fs.existsSync(f) && fs.statSync(f).size > 0 && !refresh;

async function download(url, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'VRG-Terkep/1 (offline map build)' } });
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || 0;
  const tmp = file + '.part';
  const out = fs.createWriteStream(tmp);
  let got = 0, shown = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
    if (total > 20e6 && got - shown > 25e6) { shown = got; process.stdout.write('    ' + mb(got) + ' / ' + mb(total) + '\r'); }
  }
  await new Promise((r, j) => out.end(e => (e ? j(e) : r())));
  fs.renameSync(tmp, file);
  return got;
}

function run(exe, argv, opts) {
  const r = spawnSync(exe, argv, Object.assign({ stdio: 'inherit' }, opts));
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(path.basename(exe) + ' exited with ' + r.status);
}

async function partPmtiles() {
  if (fs.existsSync(PMTILES)) return;
  console.log('- pmtiles CLI v' + PMTILES_VERSION);
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const zip = path.join(PMTILES_DIR, 'pmtiles.zip');
  await download(`https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Windows_${arch}.zip`, zip);
  run('tar', ['-xf', zip, '-C', PMTILES_DIR]);   // Windows 10+ tar.exe reads zip
  fs.unlinkSync(zip);
}

function partVendor() {
  const need = ['maplibre-gl/dist/maplibre-gl.mjs', 'pmtiles/dist/pmtiles.js', 'protomaps-basemaps/dist/cjs/index.cjs']
    .filter(f => !fs.existsSync(path.join(REPO, 'Vendor', f)));
  if (!need.length) return;
  console.log('- vendor: maplibre-gl, pmtiles, protomaps-basemaps');
  run(process.execPath, [path.join(REPO, 'tools', 'fetch-vendor.js'), 'maplibre-gl', 'pmtiles', 'protomaps-basemaps']);
}

async function partFonts() {
  let n = 0;
  for (const f of FONTS) for (const r of RANGES) {
    const file = path.join(DATA, 'fonts', f, r + '.pbf');
    if (have(file)) continue;
    await download(`${ASSETS}/fonts/${encodeURIComponent(f)}/${r}.pbf`, file); n++;
  }
  if (n || !manifest.parts.fonts) {
    console.log('- fonts: ' + n + ' glyph ranges');
    record('fonts', { source: ASSETS + '/fonts', licence: 'SIL OFL 1.1 (Noto Sans)' });
  }
}

async function partSprites() {
  let n = 0;
  for (const s of ['light.json', 'light.png', 'light@2x.json', 'light@2x.png']) {
    const file = path.join(DATA, 'sprites', s);
    if (have(file)) continue;
    await download(`${ASSETS}/sprites/v4/${s}`, file); n++;
  }
  if (n || !manifest.parts.sprites) {
    console.log('- sprites: ' + n + ' files');
    record('sprites', { source: ASSETS + '/sprites/v4/light', licence: 'see github.com/protomaps/basemaps-assets' });
  }
}

async function partBasemap() {
  const file = path.join(DATA, 'hungary.pmtiles');
  if (have(file)) return;
  const builds = await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json();
  const latest = builds[builds.length - 1];
  const url = 'https://build.protomaps.com/' + latest.key;
  console.log('- basemap: Hungary from ' + latest.key + ' (schema v' + latest.version + '), ~1 GB');
  for (let i = 1; ; i++) {          // the remote read is sometimes cut by the antivirus; a retry resumes cleanly
    try { run(PMTILES, ['extract', url, file, '--bbox=' + BBOX_HU, '--download-threads=4']); break; }
    catch (e) { if (i >= 3) throw e; console.log('  retry ' + i + ' ...'); }
  }
  record('basemap', { file: 'hungary.pmtiles', source: url, schema: 'Protomaps v' + latest.version, bbox: BBOX_HU,
    licence: 'ODbL - (c) OpenStreetMap contributors; tiles by Protomaps', bytes: fs.statSync(file).size });
}

async function partTerrain() {
  const file = path.join(DATA, 'terrain.pmtiles');
  if (have(file)) return;
  const url = 'https://download.mapterhorn.com/planet.pmtiles';
  console.log('- terrain: Hungary from Mapterhorn z0-12, ~0.35 GB');
  for (let i = 1; ; i++) {
    try { run(PMTILES, ['extract', url, file, '--bbox=' + BBOX_HU, '--maxzoom=12', '--download-threads=4']); break; }
    catch (e) { if (i >= 3) throw e; console.log('  retry ' + i + ' ...'); }
  }
  record('terrain', { file: 'terrain.pmtiles', source: url, encoding: 'terrarium', maxzoom: 12, bbox: BBOX_HU,
    licence: 'Mapterhorn - Copernicus GLO-30 and others, attribution per mapterhorn.com/attribution', bytes: fs.statSync(file).size });
}

async function partOsm() {
  const file = path.join(DATA, 'src', 'hungary-latest.osm.pbf');
  if (have(file)) return;
  const url = 'https://download.geofabrik.de/europe/hungary-latest.osm.pbf';
  console.log('- osm: ' + url + ', ~0.33 GB');
  const n = await download(url, file);
  record('osm', { file: 'src/hungary-latest.osm.pbf', source: url, licence: 'ODbL - (c) OpenStreetMap contributors', bytes: n });
}

function partAddresses() {
  const file = path.join(DATA, 'addresses.json');
  const pbf = path.join(DATA, 'src', 'hungary-latest.osm.pbf');
  if (!fs.existsSync(pbf)) { console.log('- addresses: skipped, no OSM extract (run with --only=osm first)'); return; }
  if (have(file) && fs.statSync(file).mtimeMs > fs.statSync(pbf).mtimeMs) return;
  console.log('- addresses: building the offline search index');
  run(process.execPath, ['--max-old-space-size=6144', path.join(__dirname, 'build-addresses.js'), pbf, file]);
  record('addresses', { file: 'addresses.json', source: 'built from src/hungary-latest.osm.pbf by Map/tools/build-addresses.js',
    licence: 'ODbL - (c) OpenStreetMap contributors', bytes: fs.statSync(file).size });
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  if (want('vendor')) partVendor();
  if (want('pmtiles') || want('basemap') || want('terrain')) await partPmtiles();
  if (want('fonts')) await partFonts();
  if (want('sprites')) await partSprites();
  if (want('basemap')) await partBasemap();
  if (want('terrain')) await partTerrain();
  if (want('osm')) await partOsm();
  if (want('addresses')) partAddresses();
  console.log('Map data ready: ' + DATA);
})().catch(e => { console.error('FAILED: ' + e.message); process.exitCode = 1; });
