// Test environment: a throwaway config + data folder + recorded answers, set up once per process BEFORE
// any lib module is required (lib/common.js reads the env at load time). Invented data only, no network.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOW = '2026-11-18T05:00:00Z';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-weather-test-'));
const CFG = path.join(TMP, 'config'), DATA = path.join(TMP, 'data'), REPLAY = path.join(TMP, 'replay');

fs.mkdirSync(CFG, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'config'))) if (f.endsWith('.json') && f !== 'settings.local.json') fs.copyFileSync(path.join(ROOT, 'config', f), path.join(CFG, f));
// evaluation mode so the key-gated sources run on the recorded answers; lightning on
fs.writeFileSync(path.join(CFG, 'settings.local.json'), JSON.stringify({ use: 'evaluation', contact: 'test@example.invalid' }));
const src = JSON.parse(fs.readFileSync(path.join(CFG, 'sources.json'), 'utf8'));
src.sources.find(s => s.id === 'hungaromet-lightning').enabled = true;
src.sources.find(s => s.id === 'hungaromet-radar').enabled = true;
fs.writeFileSync(path.join(CFG, 'sources.json'), JSON.stringify(src));

Object.assign(process.env, {
  VRG_WEATHER_CONFIG: CFG, VRG_WEATHER_DATA: DATA, VRG_WEATHER_NOW: NOW,
  VRG_JOBS_DIR: path.join(ROOT, '..', 'Map', 'test', 'fixtures', 'jobs'),
});
require('./fixtures').make(REPLAY, NOW);

process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });
module.exports = { ROOT, NOW, TMP, CFG, DATA, REPLAY };
