// Refined mark options, all on the traced silhouette: globe circle, ring end, neck flare, collar, leaves, screw base.
// Each mark is a list of ops run on one layer: fill | stroke | cut (fill erase) | cutstroke (stroke erase); g = bulb | leaf | base.
const CX = 499.84, CY = 262.26, RO = 187.26, TE = 95.5, TF = -140; // centre, outer radius, ring end, neck flare (deg clockwise from top)
const D = Math.PI / 180, f = v => +v.toFixed(2);
const P = (t, r) => [CX + r * Math.sin(t * D), CY - r * Math.cos(t * D)];
const pt = p => f(p[0]) + ' ' + f(p[1]);

function arc(w, t0 = TE, t1 = TF) { const r = RO - w / 2; return `M${pt(P(t0, r))}A${f(r)} ${f(r)} 0 ${Math.abs(t0 - t1) > 180 ? 1 : 0} 0 ${pt(P(t1, r))}`; }
function neck(w, join) { // flare -> collar -> right neck, ending inside the right leaf
  const r = RO - w / 2, a = P(TF, r), h = w / 2, y = 487 - h;
  return `${join ? 'L' : 'M'}${pt(a)}C${f(a[0] + 30)} ${f(a[1] + 25)} ${f(437 + h - 2)} ${f(447)} ${f(437 + h)} ${f(y - 9)}` +
    `Q${f(437 + h)} ${f(y)} ${f(446 + h)} ${f(y)}L${f(551 - h)} ${f(y)}Q${f(560 - h)} ${f(y)} ${f(561 - h)} ${f(y - 10)}C${f(563 - h)} 455 567 444 577 433`;
}
const bulbLine = w => arc(w) + neck(w, true);
const LEFT = 'M455 149C520 190 560 240 569 286C545 330 505 375 483 403C430 385 389 350 389 300C389 250 420 190 455 149Z';
const RIGHT = 'M659 293C668 375 640 428 580 435C560 437 545 430 535 418C522 390 525 345 545 322C570 296 615 290 659 293Z';
const SLIVER = 'M466 224C469 300 475 356 480 410L497 398C488 340 477 280 466 224Z';
const RIB_L = 'M466 222C470 300 478 360 487 404', RIB_R = 'M548 428C575 398 605 362 642 318';
const BAR1 = 'M441 512.5L559 505.5', BAR2 = 'M441 537L559 530';
const CAP = 'M450 555L549 555C549 578 525 593 499.5 593C474 593 450 578 450 555Z';
const leaves = (g, rib) => [
  { op: 'fill', d: LEFT, g: 'leaf' }, { op: 'cutstroke', d: RIGHT, w: 2 * g, g: 'leaf' }, { op: 'cut', d: RIGHT, g: 'leaf' },
  ...(rib.l === 'sliver' ? [{ op: 'cut', d: SLIVER, g: 'leaf' }] : [{ op: 'cutstroke', d: RIB_L, w: rib.l, cap: 'round', g: 'leaf' }])];
const rightLeaf = rib => [{ op: 'fill', d: RIGHT, g: 'leaf' }, { op: 'cutstroke', d: RIB_R, w: rib, cap: 'round', g: 'leaf' }];
const base = w => [{ op: 'stroke', d: BAR1, w, cap: 'round', g: 'base' }, { op: 'stroke', d: BAR2, w, cap: 'round', g: 'base' }, { op: 'fill', d: CAP, g: 'base' }];

function tapered() { // calligraphic ring: full silhouette outside, inner edge swells over the crown and thins to the ends
  const wt = t => 6 + 16 * Math.pow(Math.max(0, Math.cos(t * D * 0.62)), 2), o = [], i = [];
  for (let t = TE; t >= TF - 0.01; t -= 1) { o.push(P(t, RO)); i.push(P(t, RO - wt(t))); }
  return 'M' + o.map(pt).join('L') + 'L' + i.reverse().map(pt).join('L') + 'Z';
}

const MARKS = {
  E: { rw: 18, name: 'Refined original', ops: [...leaves(11, { l: 'sliver' }), { op: 'stroke', d: bulbLine(18), w: 18, cap: 'butt', join: 'round', g: 'bulb' }, ...rightLeaf(7), ...base(13)] },
  A: { rw: 9, name: 'Fine line', ops: [...leaves(9, { l: 3.5 }), { op: 'stroke', d: bulbLine(9), w: 9, cap: 'round', join: 'round', g: 'bulb' }, ...rightLeaf(3.5), ...base(9)] },
  B: { rw: 16, name: 'Tapered', ops: [...leaves(10, { l: 'sliver' }), { op: 'fill', d: tapered(), g: 'bulb' }, { op: 'stroke', d: neck(6), w: 6, cap: 'round', join: 'round', g: 'bulb' }, ...rightLeaf(6), ...base(10)] },
  C: { rw: 4, name: 'Instrument', ops: [
    { op: 'stroke', d: LEFT, w: 3.5, join: 'round', g: 'leaf' }, { op: 'stroke', d: RIB_L, w: 3.5, cap: 'round', g: 'leaf' },
    { op: 'cutstroke', d: RIGHT, w: 18, g: 'leaf' }, { op: 'cut', d: RIGHT, g: 'leaf' },
    { op: 'stroke', d: RIGHT, w: 3.5, join: 'round', g: 'leaf' }, { op: 'stroke', d: RIB_R, w: 3.5, cap: 'round', g: 'leaf' },
    { op: 'stroke', d: bulbLine(3.5), w: 3.5, cap: 'round', join: 'round', g: 'bulb' },
    { op: 'stroke', d: arc(3.5, 86, -132).replace(/A([\d.]+) ([\d.]+)/, (m, a) => m) , w: 3.5, cap: 'round', g: 'bulb', inset: 13 },
    { op: 'stroke', d: BAR1, w: 3.5, cap: 'round', g: 'base' }, { op: 'stroke', d: BAR2, w: 3.5, cap: 'round', g: 'base' }, { op: 'stroke', d: CAP, w: 3.5, join: 'round', g: 'base' }] },
  D: { rw: 3, name: 'Eclipse', ops: [...leaves(12, { l: 'sliver' }), { op: 'stroke', d: arc(2.5), w: 2.5, cap: 'round', g: 'bulb' }, { op: 'stroke', d: neck(4.5), w: 4.5, cap: 'round', join: 'round', g: 'bulb' }, ...rightLeaf(8), ...base(10)] }
};
// C's inner hairline sits 13 units inside the outer one
MARKS.C.ops.find(o => o.inset).d = (() => { const r = RO - 1.75 - 13; return `M${pt(P(86, r))}A${f(r)} ${f(r)} 0 1 0 ${pt(P(-132, r))}`; })();
module.exports = { MARKS };
// F, the chosen mix: E's large leaf, the original small leaf and screw base (as traced), A's fine bulb line
{
  const C = require('./logo.json').contours, poly = q => 'M' + q.map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
  const SMALL = poly(C[0].q.slice(145, 225)), BASE = [2, 3, 4].map(i => poly(C[i].q)).join('');
  // original bulb (thick neck, collar, stem, small leaf); the globe ring is pared from the inside down to a 9-unit line,
  // easing in from the neck so the thick lower part flows into the fine upper ring
  const BULB = poly(C[0].q), TT = 93.5;
  const wt = t => 9 + 17 * (1 - Math.pow(Math.min(1, Math.max(0, (t + 146) / 48)), 2) * (3 - 2 * Math.min(1, Math.max(0, (t + 146) / 48))));
  const pare = [], hole = [];
  for (let t = -146; t <= TT + 2.01; t += 1) { pare.push(P(t, RO - wt(t))); hole.push(P(t, 140)); }
  const PARE = 'M' + pare.map(pt).join('L') + 'L' + hole.reverse().map(pt).join('L') + 'Z';
  const TRIM = 'M' + [P(TT, 150), P(TT, 205), P(99, 205), P(99, 150)].map(pt).join('L') + 'Z';
  const tip = P(TT, RO - 4.5), CAPR = 'M' + pt([tip[0] + 4.5, tip[1]]) + 'A4.5 4.5 0 1 0 ' + pt([tip[0] - 4.5, tip[1]]) + 'A4.5 4.5 0 1 0 ' + pt([tip[0] + 4.5, tip[1]]) + 'Z';
  MARKS.F = { rw: 9, name: 'Mix', ops: [
    { op: 'fill', d: LEFT, g: 'leaf' }, { op: 'cutstroke', d: SMALL, w: 22, join: 'round', g: 'leaf' }, { op: 'cut', d: SMALL, g: 'leaf' }, { op: 'cut', d: SLIVER, g: 'leaf' },
    { op: 'fill', d: BULB, g: 'bulb' }, { op: 'cut', d: PARE, g: 'bulb' }, { op: 'cut', d: TRIM, g: 'bulb' }, { op: 'fill', d: CAPR, g: 'bulb' },
    { op: 'fill', d: BASE, g: 'base' }] };
}
