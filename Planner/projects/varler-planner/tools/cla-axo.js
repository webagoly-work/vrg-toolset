// A level of a plan as a clean axonometric — through the Planner's own view core (06c-view-core.js).
//
//   node tools/cla-axo.js [plan.vplan.json] [--level=ground] [--yaw=225] [--pitch=50] [--explode=900|600|wall] [--plates=900|600|wall] [--leaders=all] [--out=file.svg] [--png]
//
// V0 (2026-10-11) drew CLA with its own copy of the grid painter (kept as tools/cla-axo-v0.js);
// since V1 the painter lives in the Planner and this tool only boots the built Planner in jsdom,
// loads the plan and calls viewRender() + viewSheetSvg() (the sheet frame: title + legend, moved
// into the Planner by V4). Needs jsdom: NODE_PATH = the main checkout's
// Planner/projects/varler-planner/node_modules.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const planFile = args.find(a => !a.startsWith('--')) || path.join(REPO, 'Calculator/CLA-teszt_v2_butor.vplan.json');
const OUT = path.resolve(opt('out') || path.join(ROOT, 'docs/views/fig/cla-axo.svg'));
const def = { level: opt('level') || 'ground', yaw: +(opt('yaw') || 225), pitch: +(opt('pitch') || 50), k: 0.105, cut: 1500, nearCut: 1000, plinth: 200 };
const EXPL = opt('explode'), PLAT = opt('plates');   // V6: the stack plates, step 900 | 600 | wall   // V5: the static exploded view, step 900 | 600 | wall

const HTML = process.env.PLANNER || path.join(ROOT, 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window; w.alert = () => {}; w.confirm = () => true;

setTimeout(() => {
  const doc = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  w.hardResetWorkspace(); w.applyProjectData(doc.project || doc);
  if (EXPL) def.explode = { step: w.viewExplodeStep(def.level, EXPL) };
  if (PLAT) def.plates = { step: w.viewExplodeStep(def.level, PLAT), leaders: opt('leaders') === 'all' ? 'all' : 'key' };
  const R = w.viewRender(def), sheet = w.viewSheetSvg(R, Object.assign({ title: (doc.name || 'CLA').split(' ')[0] }, PLAT ? { sub: `Axonometria · nézet ${def.yaw}° / ${def.pitch}° · rétegek ${R.stats.plates.length}, lépcső ${R.stats.step} mm · ${R.stats.devices} végpont` } : EXPL ? { sub: `Axonometria · nézet ${def.yaw}° / ${def.pitch}° · szétszedve, lépcső ${R.stats.step} mm · ${R.stats.devices} végpont` } : {})), W = sheet.W, HH = sheet.H, svg = sheet.svg;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, svg);
  console.log(`wrote ${path.relative(REPO, OUT)}  ${W}x${HH}  grid ${R.stats.grid.join('x')}  far ${R.stats.far.join(' ')}  near ${R.stats.near.join(' ')}  endpoints ${R.stats.devices}  sprites ${R.stats.sprites}`);
  if (args.includes('--png')) {
    const CHROME = path.resolve(REPO, '../tools/chrome-headless-shell/chrome-headless-shell.exe');
    const png = OUT.replace(/\.svg$/, '.png');
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--window-size=${W},${HH}`, '--force-device-scale-factor=2', `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' });
    console.log('wrote ' + path.relative(REPO, png));
  }
  w.close();
}, 50);
