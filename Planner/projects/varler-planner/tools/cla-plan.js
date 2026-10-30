// The Alaprajz (V9a cut-plane plan) of a level, as the Planner draws it in 2D — for the ⏸ look sample.
//
//   node tools/cla-plan.js [plan.vplan.json] [--level=ground] [--cut=1200] [--scale=50] [--out=file.svg] [--png]
//   … --paper=A3|A4 [--tag=clanv4] [--title=CLANV4] [--rot=0]  → fig/<tag>-sheet-<paper>-<scale>.svg/png, the V9c export sheet
//     → docs/views/fig/cla-plan-<cut>.svg (+ .png at 2×, the headless Chrome of cla-axo.js)
//
// Boots the built Planner in jsdom, loads the plan, picks Render → Alaprajz (2D) and the cut height, then frames the
// scene layer (base units) around the level's walls, the dimension chains and the north arrow. A plain caption line under the drawing; no title block (V9c).
// Needs jsdom: NODE_PATH = the main checkout's Planner/projects/varler-planner/node_modules.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const planFile = args.find(a => !a.startsWith('--')) || path.join(REPO, 'Calculator/CLA-teszt_v2_butor.vplan.json');
const LEVEL = opt('level') || 'ground', CUT = +(opt('cut') || 1200), SCALE = +(opt('scale') || 50);
const PAPER = opt('paper'), TAG = opt('tag') || 'cla';   // V9c: --paper=A3|A4 → the Exportálás sheet (vexpPlanSheet) at --scale
const OUT = path.resolve(opt('out') || path.join(ROOT, 'docs/views/fig/' + (PAPER ? TAG + '-sheet-' + PAPER + '-' + SCALE : 'cla-plan-' + CUT) + '.svg'));

const HTML = process.env.PLANNER || path.join(ROOT, 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window; w.alert = () => {}; w.confirm = () => true;

setTimeout(() => {
  const doc = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  w.hardResetWorkspace(); w.applyProjectData(doc.project || doc);
  const st = w.__state; st.active = LEVEL; st.bpScale = SCALE;
  for (const l in st.levels) st.levels[l] = l === LEVEL;
  const sel = w.document.getElementById('style'); sel.value = 'alaprajz'; sel.onchange({ target: sel });
  w.apCutSet(CUT);
  if (PAPER) {   // the sheet exactly as the Exportálás menu writes it; the PNG at 96 dpi × 2
    const sel2 = w.document.getElementById('style'); sel2.value = 'normal'; sel2.onchange({ target: sel2 });
    const SH = w.vexpPlanSheet(PAPER, SCALE, opt('title') || (doc.name || 'CLA').split(' ')[0], { rot: +(opt('rot') || 0) });
    if (!SH.svg) { console.log(SH.fit.msg); process.exit(1); }
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, SH.svg);
    const PW = Math.round(SH.W / 25.4 * 96), PH = Math.round(SH.H / 25.4 * 96);
    console.log('wrote ' + path.relative(REPO, OUT) + '  ' + SH.W + ' × ' + SH.H + ' mm  ' + SH.fit.msg + '  labels ' + JSON.stringify(SH.stats.labels));
    if (args.includes('--png')) { const CHROME = path.resolve(REPO, '../tools/chrome-headless-shell/chrome-headless-shell.exe'), png = OUT.replace(/.svg$/, '.png');
      execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${PW},${PH}`, '--force-device-scale-factor=2',
        `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' }); console.log('wrote ' + path.relative(REPO, png)); }
    w.close(); return;
  }
  const scene = w.document.getElementById('vp').firstChild.innerHTML, S = w.eval('AP_LAST');
  // frame: the level's walls in base units + a margin
  const z = w.dz(LEVEL, 0), pts = [];
  const bb = w.bpBBox(LEVEL);   // + the V9b dimension chains (−x / −y, 1900 out) and the north arrow (+x side)
  for (const [x, y] of [[bb.x0 - 2600, bb.y0 - 2600], [bb.x1 + 2900, bb.y0 - 2600], [bb.x1 + 2900, bb.y1 + 300], [bb.x0 - 2600, bb.y1 + 300]]) pts.push(w.planToBase(x, y, z));
  const m = 40, x0 = Math.min(...pts.map(p => p[0])) - m, y0 = Math.min(...pts.map(p => p[1])) - m;
  const bw = Math.max(...pts.map(p => p[0])) - x0 + m, bh = Math.max(...pts.map(p => p[1])) - y0 + m;
  const W = 1400, k = W / bw, H = Math.round(bh * k) + 44;
  const cap = `Alaprajz · ${(doc.name || 'CLA').split(' ')[0]} · ${LEVEL} · vágás ${CUT} mm · M 1:${SCALE} · falak ${S.walls.cut} vágott · nyílások ${S.open.cut} vágott / ${S.open.hidden} takart · tárgyak ${S.obj.art} rajzolt, ${S.obj.outline} körvonal, ${S.obj.above} vágás fölött · végpontok ${S.dev.full} a vágás alatt / ${S.dev.above} fölötte (rejtve)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#fff"/><svg x="0" y="0" width="${W}" height="${H - 44}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)}">${scene}</svg>` +
    `<text x="16" y="${H - 16}" font-size="13" fill="#333">${cap.replace(/&/g, '&amp;')}</text></svg>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, svg);
  console.log(`wrote ${path.relative(REPO, OUT)}  ${W}x${H}  ${JSON.stringify({ walls: S.walls, open: S.open, obj: S.obj, dev: S.dev, labels: S.labels })}`);
  if (args.includes('--png')) {
    const CHROME = path.resolve(REPO, '../tools/chrome-headless-shell/chrome-headless-shell.exe');
    const png = OUT.replace(/\.svg$/, '.png');
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--window-size=${W},${H}`, '--force-device-scale-factor=2', `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' });
    console.log('wrote ' + path.relative(REPO, png));
  }
  w.close();
}, 80);
