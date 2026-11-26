// Sketcher/test/marker.test.js — the VRG mérőkártya found in a photo (skcam K3 follow-up), plain node.
// A wall is "photographed" by its own pinhole camera (independent of lib/marker.js and lib/plane.js): the printed card
// taped up (drawn from the same cell layout the card's SVG prints), a socket, a dark picture frame, a floor; the photo is
// anti-aliased, unevenly lit and noisy. The card must be found with the right id and way up, its corners within a
// fraction of a pixel, and the Síkmérés must then measure true heights from them without a single tap.
//   node Sketcher/test/marker.test.js
'use strict';
const path = require('path'), fs = require('fs');
const M = require('../lib/marker.js'), P = require('../lib/plane.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

// ---- the codes ----------------------------------------------------------------------------------------------------
const pop = x => { let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };
const turn = c => { let o = 0; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) if ((c >> (r * 4 + k)) & 1) o |= 1 << (k * 4 + (3 - r)); return o; };
const turns = c => [c, turn(c), turn(turn(c)), turn(turn(turn(c)))];
{
  let self = 99, other = 99;
  M.CODES.forEach((c, i) => {
    const t = turns(c); self = Math.min(self, pop(c ^ t[1]), pop(c ^ t[2]), pop(c ^ t[3]));
    M.CODES.forEach((d, j) => { if (j > i) t.forEach(x => { other = Math.min(other, pop(x ^ d)); }); });
  });
  ok(self >= 8, 'each code reads differently in all four turns (≥ 8 bits): ' + self);
  ok(other >= 7, 'any two codes differ by ≥ 7 bits in any turn: ' + other);
  ok(M.CARDS.length === M.CODES.length && M.CARDS.every(c => c.mm > 0), 'a printed size per code');
}

// ---- the printed card ---------------------------------------------------------------------------------------------
{
  const s = M.svg(0);
  ok(/width="(\d+(\.\d+)?)mm"/.test(s) && +/width="([\d.]+)mm"/.exec(s)[1] > 150, 'the SVG is sized in real millimetres');
  ok(/a fekete négyzet 150 × 150 mm/.test(s) && /100 mm/.test(s), 'it names the square and has a 100 mm check ruler');
  const blacks = (s.match(/<rect x=/g) || []).length;
  ok(blacks === pop(M.CODES[0]), 'one black cell per set bit (' + blacks + ')');
  ok(/100 %/.test(M.page(0)) && (M.page(2).match(/<svg/g) || []).length === 4, 'the page prints at 100 %; the small card four times');
  ok(/a fekete négyzet 120 × 120 mm/.test(M.svg(0, 120)), 'a typed size prints that size');
}

// ---- the photographed wall (test/card-scene.js) ------------------------------------------------------------------
const photo = o => require('./card-scene.js').photo(Object.assign({ codes: M.CODES }, o));
const pxErr = (a, b, W, H) => Math.max(...a.map((p, i) => Math.hypot((p[0] - b[i][0]) * W, (p[1] - b[i][1]) * H)));

const cases = [
  { name: 'straight on', o: {} },
  { name: 'turned 25°, a quarter-turned card', o: { yaw: 25, rot: 1, cx: 1500 } },
  { name: 'from below (tilted up 12°), upside down, card 1', o: { pitch: 12, rot: 2, id: 1, S: 100, cx: 1300, cy: 1100 } },
  { name: 'small and noisy (60 mm card at 2.6 m)', o: { id: 2, S: 60, dist: 2600, noise: 12, rot: 3, cx: 1600, cy: 1300 } },
  { name: 'steep (45°) and dim', o: { yaw: -45, x0: 1900, vignette: 0.6 } },
];
for (const c of cases) {
  const t0 = Date.now(), ph = photo(c.o), found = M.detect(ph.img), ms = Date.now() - t0;
  const d = found[0], want = c.o.id || 0;
  ok(found.length === 1, c.name + ': exactly one card found (' + found.length + ')');
  if (!d) continue;
  ok(d.id === want && d.mm === M.card(want).mm, c.name + ': the right card (' + d.id + ', ' + d.mm + ' mm)');
  const e = pxErr(d.pts, ph.truth, ph.W, ph.H);
  console.log('  ' + c.name + ': ' + e.toFixed(2) + ' px, side ' + d.px + ' px, ' + ms + ' ms');
  ok(e < 0.4, c.name + ': its corners in their printed order within 0.4 px (' + e.toFixed(2) + ' px, ' + d.px + ' px side, ' + ms + ' ms)');
}

// nothing to find: a photo with no card, a card cut off by the frame's edge, a black square with no code
{
  const blank = photo({ S: 0.001, cx: -9999 });
  ok(M.detect(blank.img).length === 0, 'a wall with no card: nothing found');
  const cut = photo({ cx: 3420 });   // the photo ends at about 3480 mm: the card half outside
  ok(M.detect(cut.img).every(d => d.pts.every(p => p[0] >= 0 && p[0] <= 1)), 'a card cut by the edge is not offered');
}
{
  const ph = photo({}), d = ph.img.data;          // paint the code area black: a plain black square is no card
  const box = ph.truth, u0 = Math.min(...box.map(p => p[0])), u1 = Math.max(...box.map(p => p[0])), v0 = Math.min(...box.map(p => p[1])), v1 = Math.max(...box.map(p => p[1]));
  for (let j = Math.floor(v0 * ph.H); j < v1 * ph.H; j++) for (let i = Math.floor(u0 * ph.W); i < u1 * ph.W; i++) { const k = (j * ph.W + i) * 4; d[k] = d[k + 1] = d[k + 2] = 25; }
  ok(M.detect(ph.img).length === 0, 'a black square with no code is not a card');
}

// ---- measuring with it: no taps on the reference ------------------------------------------------------------------
// the card taped low (its bottom 40 cm above the floor), near what is measured, as the screen's hint asks
{
  const ph = photo({ yaw: 20, cx: 1250, cy: 2050 }), d = M.detect(ph.img)[0];
  const rec = { aspect: ph.W / ph.H, ref: { kind: 'kartya', w: d.mm, h: d.mm, pts: d.pts }, floor: [ph.cam([1000, 2600]), ph.cam([1700, 2600])],
    lines: [{ a: ph.cam([1800, 2300]), b: ph.cam([1100, 1900]) }], marks: [{ p: ph.cam([1800, 2300]) }, { p: ph.cam([1500, 1700]) }] };
  const m = P.measure(rec), f = P.frame(rec);
  const rel = (a, b) => Math.abs(a - b) / b;
  ok(rel(m.marks[0].mm, 300) < 0.01, 'the socket 30 cm up, from the found card: ' + m.marks[0].mm + ' mm');
  ok(rel(m.marks[1].mm, 900) < 0.015, 'a point 90 cm up: ' + m.marks[1].mm + ' mm');
  ok(rel(m.lines[0].mm, Math.round(Math.hypot(700, 400))) < 0.015, 'a distance beside it: ' + m.lines[0].mm + ' mm (want ' + Math.round(Math.hypot(700, 400)) + ')');
  ok(P.quality(f, [ph.cam([1800, 2300])]).grade !== 'tavoli' && P.quality(f, [ph.cam([300, 600])]).grade === 'tavoli', 'near the card is graded usable, across the wall távoli');
  ok(P.ref('kartya') && P.clean(rec).ref.kind === 'kartya', 'the card is a known reference kind and is kept as one');
}

// ---- the phone bundles it (feature-sketch PLANE_ASSETS, PlaneUi.kt) -------------------------------------------------
{
  const ROOT = path.join(__dirname, '..', '..');
  const g = fs.readFileSync(path.join(ROOT, 'Mobile', 'android', 'feature-sketch', 'build.gradle.kts'), 'utf8');
  const k = fs.readFileSync(path.join(ROOT, 'Mobile', 'android', 'feature-sketch', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'sketch', 'ui', 'PlaneUi.kt'), 'utf8');
  ok(/val PLANE_ASSETS = listOf\([^)]*"marker\.js"/.test(g) && /val ASSETS = listOf\([^)]*"marker\.js"/.test(k), 'the phone bundles marker.js with the Síkmérés');
}

console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
