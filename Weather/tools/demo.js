#!/usr/bin/env node
// VRG Időjárás — offline demo: the page on INVENTED data, with no network and without touching the real database.
//
//   node Weather/tools/demo.js [--port 8809] [--no-open]
//
// Writes recorded answers for "now" (test/fixtures.js: a frosty morning, a gusty afternoon, a yellow wind warning,
// evening rain, one nearby strike) into Weather/data/demo/, runs the 'reggel' pipeline on them in evaluation mode
// (so the key-gated sources show too) and serves the page from that separate data folder. The page shows the
// VISSZAJÁTSZÁS and KIÉRTÉKELÉS badges, so nobody takes it for real weather.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'data', 'demo');
const CFG = path.join(DEMO, 'config');
fs.mkdirSync(CFG, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'config'))) if (f.endsWith('.json') && f !== 'settings.local.json') fs.copyFileSync(path.join(ROOT, 'config', f), path.join(CFG, f));
fs.writeFileSync(path.join(CFG, 'settings.local.json'), JSON.stringify({ use: 'evaluation' }));
const src = JSON.parse(fs.readFileSync(path.join(CFG, 'sources.json'), 'utf8'));
src.sources.find(s => s.id === 'hungaromet-lightning').enabled = true;
fs.writeFileSync(path.join(CFG, 'sources.json'), JSON.stringify(src));
try { fs.rmSync(path.join(DEMO, 'db'), { recursive: true, force: true }); } catch {}

process.env.VRG_WEATHER_CONFIG = CFG;
process.env.VRG_WEATHER_DATA = path.join(DEMO, 'db');
// invented job sites too (the Map's test fixtures), never the real jobs folder
process.env.VRG_JOBS_DIR = path.join(ROOT, '..', 'Map', 'test', 'fixtures', 'jobs');
const port = (process.argv.find(a => /^--port=?/.test(a)) || '').split('=')[1] || process.argv[process.argv.indexOf('--port') + 1];
process.env.VRG_WEATHER_PORT = /^\d+$/.test(port || '') ? port : '8809';

const replay = path.join(DEMO, 'replay');
require('../test/fixtures').make(replay, new Date().toISOString());

(async () => {
  const C = require('../lib/commands');
  const ctx = C.context({ replay });
  const r = await require('../lib/pipeline').runPipeline(ctx, 'reggel', C.dispatch);
  await C.dispatch(ctx, ['pv', 'budapest']);
  ctx.db.close();
  console.log('Bemutato adatok (KITALALT): ' + r.status);
  process.argv = [process.argv[0], path.join(ROOT, 'serve.js'), '--replay', replay, ...process.argv.slice(2).filter(a => a === '--no-open')];
  require('../serve.js');
})();
