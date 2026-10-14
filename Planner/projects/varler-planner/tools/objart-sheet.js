// The object line-art contact sheet (Views V8): every object of a batch at its catalogue size and resized, each
// as a third-angle set (T above F, L left of F, R right of F when the item lists it), through the Planner's own
// objArt() (src/05zb-objart.js).
//
//   node tools/objart-sheet.js [--batch=first5] [--out=file.svg] [--png]
//     → docs/views/fig/objart-<batch>.svg (+ .png at 2×, the headless Chrome p33-axo.js uses)
//
// Scale 1 : 25 at 3 px per paper mm, so the art's paper-mm line widths (objArtCss(25)) print true. Captions go
// through tools/baseline/labels.js (the legible-sheets rule: nothing on top of anything). Boots the built Planner
// in jsdom: NODE_PATH = the main checkout's Planner/projects/varler-planner/node_modules.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const LBL = require('./baseline/labels');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };

// a batch = columns of rows {name, resized size}
const BATCHES = {
  first5: [
    [{ n: 'Kanapé 3ü', r: { w: 2800, d: 950, h: 850 } }, { n: 'Ágy 200×160', r: { w: 900, d: 2000, h: 550 } }, { n: 'WC csésze', r: { w: 500, d: 650, h: 800 } }],
    [{ n: 'Konyhapult 120', r: { w: 1800, d: 600, h: 900 } }, { n: 'Felsőszekrény', r: { w: 1000, d: 350, h: 900 } }, { n: 'Hűtő 60', r: { w: 600, d: 600, h: 850 } }]]
};
const BATCH = opt('batch') || 'first5';
if (!BATCHES[BATCH]) { console.error('unknown batch: ' + BATCH + ' (have: ' + Object.keys(BATCHES).join(', ') + ')'); process.exit(1); }
const OUT = path.resolve(opt('out') || path.join(ROOT, 'docs/views/fig/objart-' + BATCH + '.svg'));

const K = 25, PX = 3 / K;                       // 1 : 25, 3 px per paper mm → px per model mm
const M = 30, GH = 26, GV = 30, GB = 70, GC = 60, LET = 22, CAP = 24, TITLE = 26;
const PART_HU = { seat: 'ülőpárna', pillow: 'párna', door: 'ajtó', drawer: 'fiók', shelf: 'polc' };
const mm = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HTML = process.env.PLANNER || path.join(ROOT, 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window; w.alert = () => {}; w.confirm = () => true;

setTimeout(() => {
  const L = LBL.create();
  let art = '', deco = '', fixed = '';
  // one block: the views of `name` at size s, top-left at (x, y); returns its size and what to print under it
  function block(name, s, x, y, dry) {
    const it = w.objArtItem(name);
    const has = v => it.art.includes(v), z = s || { w: it.w, d: it.d, h: it.h };
    const Lw = has('L') ? z.d * PX : 0, Rw = has('R') ? z.d * PX : 0, Fw = z.w * PX, Fh = z.h * PX, Th = has('T') ? z.d * PX : 0;
    const fx = x + (Lw ? Lw + GH : 0), fy = y + (Th ? Th + GV : 0);
    const VW = (Lw ? Lw + GH : 0) + Fw + (Rw ? GH + Rw : 0), H = (Th ? Th + GV : 0) + Fh + LET + CAP;
    const parts = {};
    for (const v of ['L', 'F']) if (has(v)) { const r = w.objArt(name, v, s, { css: false }); for (const k in r.parts) parts[k] = Math.max(parts[k] || 0, r.parts[k]); }
    const fam = w.eval('OBJART')[name].fam;
    const cnt = fam === 'wc' ? 'nyújtva, fix részletek (D-V8-1)' : Object.keys(PART_HU).filter(k => parts[k]).map(k => parts[k] + ' ' + PART_HU[k]).join(' · ');
    const cap = (s ? 'átméretezve' : 'katalógus') + ' · ' + z.w + ' × ' + z.d + ' × ' + z.h + (cnt ? ' · ' + cnt : '');
    const W = Math.max(VW, LBL.textW(cap, 12) + 16);          // a block is at least as wide as its caption
    if (dry) return { W, H };
    const place = { F: [fx, fy, Fw, Fh], L: [x, fy, Lw, Fh], R: [fx + Fw + GH, fy, Rw, Fh], T: [fx, y, Fw, Th] };
    for (const v of ['T', 'L', 'F', 'R']) { if (!has(v)) continue;
      const r = w.objArt(name, v, s, { css: false }), [px, py, pw, ph] = place[v];
      art += `<svg x="${mm(px)}" y="${mm(py)}" width="${mm(pw)}" height="${mm(ph)}" viewBox="${r.vb.join(' ')}" overflow="visible">${r.body}</svg>`;
      L.blockRect(px, py, px + pw, py + ph);
      L.add({ x: px + pw / 2, y: py + ph + 3, text: v, size: 11, color: '#555', r: 2, pref: [90], pri: 2 }); }
    // the floor line under F and L (sheet decoration, not part of the art)
    deco += `<line x1="${mm(x - 6)}" y1="${mm(fy + Fh)}" x2="${mm(fx + Fw + (Rw ? GH + Rw : 0) + 6)}" y2="${mm(fy + Fh)}" stroke="#9aa" stroke-width=".8"/>`;
    L.add({ x: x + W / 2, y: fy + Fh + LET + 2, text: cap, size: 12, color: s ? '#1f5f8b' : '#333', r: 2, pref: [90], pri: 3 });
    return { W, H };
  }
  // layout: columns of rows, two blocks per row
  const cols = BATCHES[BATCH];
  const rowSize = o => { const a = block(o.n, null, 0, 0, true), b = block(o.n, o.r, 0, 0, true); return { a, b, W: a.W + GB + b.W, H: TITLE + Math.max(a.H, b.H) }; };
  let cx = M, H = 0; const top = M + 50;
  for (const col of cols) {
    const sizes = col.map(rowSize), CW = Math.max(...sizes.map(z => z.W));
    let y = top;
    col.forEach((o, i) => { const z = sizes[i];
      fixed += `<text x="${mm(cx)}" y="${mm(y + 15)}" font-size="15" font-weight="600" fill="#222">${esc(o.n)}</text>`;
      L.blockRect(cx, y, cx + 260, y + 20);
      block(o.n, null, cx, y + TITLE);
      block(o.n, o.r, cx + z.a.W + GB, y + TITLE);
      y += z.H + GC; });
    H = Math.max(H, y); cx += CW + GB + 20;
  }
  const W = Math.round(cx - GB - 20 + M), HH = Math.round(H - GC + M);
  const head = `<text x="${M}" y="${M + 6}" font-size="20" font-weight="700" fill="#111">Objektum vonalrajzok · V8a · első 5 ⏸</text>` +
    `<text x="${M}" y="${M + 30}" font-size="12.5" fill="#555">1 : 25 · F elölnézet · L bal oldal (eleje jobbra) · T felülnézet (eleje lent) · katalógusméret és átméretezve · vonalak: kontúr 0,35 · részlet 0,18 · rejtett 0,13 szaggatott</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}" font-family="Segoe UI, Arial, sans-serif">` +
    `<style>${w.objArtCss(K)}</style><rect width="${W}" height="${HH}" fill="#fff"/>${head}${fixed}${deco}${art}${L.render()}</svg>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, svg);
  console.log(`wrote ${path.relative(REPO, OUT)}  ${W}x${HH}  labels ${L.count()}`);
  if (args.includes('--png')) {
    const CHROME = path.resolve(REPO, '../Planner_VRG_U100/Planner/apps/chrome-headless-shell/chrome-headless-shell.exe');
    const png = OUT.replace(/\.svg$/, '.png');
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--window-size=${W},${HH}`, '--force-device-scale-factor=2', `--screenshot=${png}`, 'file:///' + OUT.split(path.sep).join('/')], { stdio: 'ignore' });
    console.log('wrote ' + path.relative(REPO, png));
  }
  w.close();
}, 50);
