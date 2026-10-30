// Views V4 ⏸ look sample: CLA and CLANV4 side by side, through the Planner's own export (vexpSheet).
//
//   node tools/v4-look.js [--zoom=2] [--out=docs/views/fig/v4-look-cla-clanv4.svg]   → .svg + .png
//
// Two columns (CLA | CLANV4), two rows (Felülnézet = the export default | Axonometria preset), each the
// framed Tiszta sheet of the plan's busiest level. Needs jsdom: NODE_PATH = the main checkout's
// Planner/projects/varler-planner/node_modules.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..'), REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2), opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const OUT = path.resolve(opt('out') || path.join(ROOT, 'docs/views/fig/v4-look-cla-clanv4.svg')), ZOOM = +(opt('zoom') || 2);
const PLANS = [['CLA', path.join(REPO, 'Calculator/CLA-teszt_v2_butor.vplan.json')], ['CLANV4', path.resolve(REPO, '../CLANV4_ajanlat/CLANV4.vplan(5).json')]];
const HTML = process.env.PLANNER || path.join(ROOT, 'dist', 'varler_planner.html');

function sheets(name, file) {
  return new Promise(res => {
    const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
    const w = dom.window; w.alert = () => {}; w.confirm = () => true;
    setTimeout(() => {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      w.hardResetWorkspace(); w.applyProjectData(doc.project || doc);
      const st = w.__state, n = {}; w.__data.devices.forEach(d => { n[d.level] = (n[d.level] || 0) + 1; });
      st.active = Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'ground'; st.zoom = ZOOM;
      const out = ['top', 'axo'].map(k => w.vexpSheet(k, name));
      console.log(`${name}: level ${st.active}, ${out.map(s => s.view.k + ' ' + s.W + 'x' + s.H + ' far ' + s.R.stats.far.length + ' near ' + s.R.stats.near.length).join(' · ')}`);
      w.close(); res(out);
    }, 900);
  });
}
(async () => {
  const cols = []; for (const [n, f] of PLANS) cols.push(await sheets(n, f));
  const G = 30, cw = cols.map(c => Math.max(...c.map(s => s.W))), rh = [0, 1].map(r => Math.max(...cols.map(c => c[r].H)));
  const W = cw.reduce((a, b) => a + b, 0) + G * (cols.length + 1), H = rh[0] + rh[1] + 3 * G;
  let body = '', x = G;
  cols.forEach((c, i) => { let y = G; c.forEach((s, r) => { body += `<g transform="translate(${x},${y})">${s.svg.replace(/^<svg /, '<svg x="0" y="0" ')}</g>`; y += rh[r] + G; }); x += cw[i] + G; });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#e9e7e1"/>${body}</svg>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, svg);
  const CHROME = path.resolve(REPO, '../tools/chrome-headless-shell/chrome-headless-shell.exe'), png = OUT.replace(/\.svg$/, '.png');
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${W},${H}`, '--force-device-scale-factor=1',
    `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' });
  console.log(`wrote ${path.relative(REPO, OUT)} + .png  ${W}x${H}`);
})();
