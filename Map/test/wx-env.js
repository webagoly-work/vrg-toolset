// The W layer's test environment, built once per process, BEFORE Weather/lib is first required (it reads its env at
// load time): a throwaway VRG Időjárás config + database filled from invented answers at the real "now"
// (Weather/test/fixtures.js: a front crossing Hungary, stations, strikes, radar frames, a wind warning), and a stub
// basemap — a valid PMTiles archive with no tiles — so the page can run without the 1.7 GB download.
// INVENTED DATA ONLY. Nothing here touches the network or the real Weather/data.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAP = path.resolve(__dirname, '..'), REPO = path.resolve(MAP, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-wx-'));
const CFG = path.join(TMP, 'wx-config'), DATA = path.join(TMP, 'wx-data'), REPLAY = path.join(TMP, 'wx-replay'), BASE = path.join(TMP, 'map-data');

// ---------------------------------------------------------------- a PMTiles v3 archive with no tiles
function emptyPmtiles() {
  const meta = Buffer.from(JSON.stringify({ name: 'vrg-test-stub', vector_layers: [] }));
  const root = Buffer.from([0]);                      // a directory with zero entries (varint 0)
  const h = Buffer.alloc(127);
  h.write('PMTiles', 0, 'ascii'); h[7] = 3;
  const u64 = (v, o) => h.writeBigUInt64LE(BigInt(v), o);
  u64(127, 8); u64(root.length, 16);                  // root directory
  u64(127 + root.length, 24); u64(meta.length, 32);   // metadata
  u64(127 + root.length + meta.length, 40); u64(0, 48);  // leaf directories
  u64(127 + root.length + meta.length, 56); u64(0, 64);  // tile data
  u64(0, 72); u64(0, 80); u64(0, 88);                 // addressed tiles, entries, contents
  h[96] = 1; h[97] = 1; h[98] = 1; h[99] = 1;         // clustered, internal compression none, tile compression none, mvt
  h[100] = 0; h[101] = 14;
  h.writeInt32LE(16.0e7, 102); h.writeInt32LE(45.6e7, 106); h.writeInt32LE(23.0e7, 110); h.writeInt32LE(48.7e7, 114);
  h[118] = 7; h.writeInt32LE(19.04e7, 119); h.writeInt32LE(47.5e7, 123);
  return Buffer.concat([h, root, meta]);
}
fs.mkdirSync(BASE, { recursive: true });
fs.writeFileSync(path.join(BASE, 'hungary.pmtiles'), emptyPmtiles());
fs.writeFileSync(path.join(BASE, 'manifest.json'), JSON.stringify({ parts: { basemap: { fetched: 'stub (test)' } } }));

// ---------------------------------------------------------------- the weather config + database
fs.mkdirSync(CFG, { recursive: true });
const WCFG = path.join(REPO, 'Weather', 'config');
for (const f of fs.readdirSync(WCFG)) if (f.endsWith('.json') && f !== 'settings.local.json') fs.copyFileSync(path.join(WCFG, f), path.join(CFG, f));
fs.writeFileSync(path.join(CFG, 'settings.local.json'), JSON.stringify({ use: 'evaluation', contact: 'test@example.invalid' }));
const src = JSON.parse(fs.readFileSync(path.join(CFG, 'sources.json'), 'utf8'));
for (const id of ['hungaromet-lightning', 'hungaromet-radar']) src.sources.find(s => s.id === id).enabled = true;
fs.writeFileSync(path.join(CFG, 'sources.json'), JSON.stringify(src));
process.env.VRG_WEATHER_CONFIG = CFG;
process.env.VRG_WEATHER_DATA = DATA;
const NOW = new Date(Math.floor(Date.now() / 60e3) * 60e3).toISOString();

let built = null;
/** fill the database once: fixtures at NOW, the 'reggel'-like chain; jobsDir = the job fixture the Map uses */
function build(jobsDir) {
  if (built) return built;
  built = (async () => {
    require(path.join(REPO, 'Weather', 'test', 'fixtures.js')).make(REPLAY, NOW);
    const keepJobs = process.env.VRG_JOBS_DIR;
    if (jobsDir) process.env.VRG_JOBS_DIR = jobsDir;
    const C = require(path.join(REPO, 'Weather', 'lib', 'commands.js'));
    const ctx = C.context({ replay: REPLAY });
    try { for (const argv of [['init'], ['sync-jobs'], ['fetch'], ['fuse'], ['alerts']]) await C.dispatch(ctx, argv); }
    finally { ctx.db.close(); if (keepJobs === undefined) delete process.env.VRG_JOBS_DIR; else process.env.VRG_JOBS_DIR = keepJobs; }
    return { DATA, BASE };
  })();
  return built;
}

process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });
module.exports = { build, TMP, DATA, BASE, CFG, REPLAY, NOW, emptyPmtiles };
