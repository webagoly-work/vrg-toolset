// A level of a plan as a clean axonometric — through the Planner's own view core (06c-view-core.js).
//
//   node tools/p33-axo.js [plan.vplan.json] [--level=ground] [--yaw=225] [--pitch=50] [--out=file.svg] [--png]
//
// V0 (2026-10-11) drew P33 with its own copy of the grid painter (kept as tools/p33-axo-v0.js);
// since V1 the painter lives in the Planner and this tool only boots the built Planner in jsdom,
// loads the plan, calls viewRender() and adds the sheet frame (title + legend; V4 moves the frame
// into the Planner's export). Needs jsdom: NODE_PATH = the main checkout's
// Planner/projects/varler-planner/node_modules.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const planFile = args.find(a => !a.startsWith('--')) || path.join(REPO, 'Calculator/P33-teszt_v2_butor.vplan.json');
const OUT = path.resolve(opt('out') || path.join(ROOT, 'docs/views/fig/p33-axo.svg'));
const def = { level: opt('level') || 'ground', yaw: +(opt('yaw') || 225), pitch: +(opt('pitch') || 50), k: 0.105, cut: 1500, nearCut: 1000, plinth: 200 };

const HTML = process.env.PLANNER || path.join(ROOT, 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window; w.alert = () => {}; w.confirm = () => true;

const ROLE_HU = { 'sys:MAINS': 'Erősáram', 'sys:DED': 'Dedikált körök', 'sys:SOC': 'Dugaljak', 'sys:LIGHT': 'Világítás', 'sys:LV': 'Törpefeszültség (A)', 'sys:BUSB': 'Biztosított 24 V (B)',
  'sys:CONTROL': 'Vezérlés', 'sys:DATA': 'Adat / PoE', 'sys:SENSOR': 'Érzékelők', 'sys:HMI': 'Kezelőfelületek',
  'sys:MEDIA': 'Média és hang', 'sys:USB': 'USB', 'sys:SECURITY': 'Biztonságtechnika', hw: 'Hardver', base: 'BASE' };
const LEVEL_HU = { basement: 'PINCE', ground: 'FÖLDSZINT', upper: 'EMELET' };

setTimeout(() => {
  const doc = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  w.hardResetWorkspace(); w.applyProjectData(doc.project || doc);
  const R = w.viewRender(def), S = w.VIEW_STYLES.tiszta, STK = w.eval('STK_COL'), H = w.eval('LH')[def.level];
  const b = R.bounds, M = 70, LEG = 270, top = 40;
  const W = Math.ceil(b.maxX - b.minX + 2 * M + LEG), HH = Math.ceil(b.maxY - b.minY + 2 * M + top);
  const roles = R.roles.filter(r => ROLE_HU[r]);
  let leg = `<g transform="translate(${W - LEG + 10},${M + top})"><text class="lh" x="0" y="0">VÉGPONTOK RENDSZERENKÉNT</text>`;
  roles.forEach((r, k) => { const y = 20 + k * 17; leg += `<rect x="0" y="${y - 7}" width="9" height="9" fill="${STK[r]}"/><text class="lt" x="16" y="${y + 1}">${ROLE_HU[r]}</text>`; });
  const y2 = 20 + roles.length * 17 + 18; leg += `<text class="lh" x="0" y="${y2}">JELEK</text>`;
  const sym = [['circle', 'Lámpa (mennyezet, ejtővonallal)'], ['dot', 'Dugalj'], ['sq', 'Kapcsoló / doboz'], ['dia', 'Egyéb végpont'], ['fade', 'Fal túloldalán']];
  sym.forEach(([k, t], n) => { const y = y2 + 20 + n * 17, cx = 4.5, cy = y - 3, c = '#555';
    leg += k === 'circle' ? `<circle cx="${cx}" cy="${cy}" r="3.6" fill="#fff" stroke="${c}" stroke-width="1.3"/>`
      : k === 'dot' ? `<circle cx="${cx}" cy="${cy}" r="3" fill="${c}"/>` : k === 'sq' ? `<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" fill="${c}"/>`
      : k === 'dia' ? `<path d="M${cx} ${cy - 4}l4 4l-4 4l-4 -4z" fill="${c}"/>` : `<circle cx="${cx}" cy="${cy}" r="3" fill="${c}" opacity="0.45"/>`;
    leg += `<text class="lt" x="16" y="${y + 1}">${t}</text>`; });
  const y3 = y2 + 20 + sym.length * 17 + 14;
  leg += `<text class="lh" x="0" y="${y3}">FALAK</text>`
    + `<rect x="0" y="${y3 + 9}" width="9" height="9" fill="#fff" stroke="${S.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3 + 17}">Távoli külső fal — teljes ${H} mm</text>`
    + `<rect x="0" y="${y3 + 26}" width="9" height="9" fill="${S.face['wall.top.cut']}" stroke="${S.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3 + 34}">Vágott fal — belső ${def.cut} · kamera felőli külső ${def.nearCut} mm</text></g>`;
  const title = `<g transform="translate(${M},${M - 18})"><text class="t1" x="0" y="0">${(doc.name || 'P33').split(' ')[0].toUpperCase()} · ${LEVEL_HU[def.level] || def.level}</text>`
    + `<text class="t2" x="0" y="18">Axonometria · nézet ${def.yaw}° / ${def.pitch}° · vágás ${def.cut} / ${def.nearCut} mm · ${R.stats.devices} végpont · nézeti mag (V1)</text></g>`;
  const defs = w.eval('viewDefs')(S).replace('</style>', `.t1{font-family:Marcellus,Georgia,serif;font-size:22px;letter-spacing:3px}.t2{font-size:10.5px;fill:${S.inkSoft};letter-spacing:.4px}`
    + `.lh{font-size:8.4px;letter-spacing:1.6px;font-weight:600}.lt{font-size:8.6px;fill:#3b3a36}</style>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="vw" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}">${defs}`
    + `<rect width="100%" height="100%" fill="${S.paper}"/>${title}`
    + `<g transform="translate(${(M - b.minX).toFixed(1)},${(M + top - b.minY).toFixed(1)})" stroke-linejoin="round">${R.body}</g>${leg}</svg>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, svg);
  console.log(`wrote ${path.relative(REPO, OUT)}  ${W}x${HH}  grid ${R.stats.grid.join('x')}  far ${R.stats.far.join(' ')}  near ${R.stats.near.join(' ')}  endpoints ${R.stats.devices}  sprites ${R.stats.sprites}`);
  if (args.includes('--png')) {
    const CHROME = path.resolve(REPO, '../Planner_VRG_U100/Planner/apps/chrome-headless-shell/chrome-headless-shell.exe');
    const png = OUT.replace(/\.svg$/, '.png');
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--window-size=${W},${HH}`, '--force-device-scale-factor=2', `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' });
    console.log('wrote ' + path.relative(REPO, png));
  }
  w.close();
}, 50);
