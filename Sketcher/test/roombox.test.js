// Sketcher/test/roombox.test.js — Szobadoboz maths (lib/roombox.js, dev line skcam K1): EXIF, field of view, the
// projection back into a photo, which walls a photo point can see, and the scene built from a real package.
'use strict';
const path = require('path'), fs = require('fs');
const RB = require(path.join(__dirname, '..', 'lib', 'roombox.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, m + ' (got ' + a + ', want ' + b + ' ± ' + e + ')');

// ---- field of view: a 26 mm-equivalent 4:3 photo is ~66° × 51°; 13 mm is ~105°
{
  const a = RB.fov(26, 4000, 3000), b = RB.fov(13, 4000, 3000), p = RB.fov(26, 3000, 4000);
  near(a.h, 67.3, 1, 'fov 26 mm, landscape, horizontal'); near(a.v, 53.1, 1, 'fov 26 mm, landscape, vertical');
  near(b.h, 106.3, 1, 'fov 13 mm ultrawide, horizontal');
  near(p.h, a.v, 0.01, 'portrait swaps the angles');
  ok(RB.fov(0, 0, 0).h > 60, 'missing data falls back to the main lens');
}

// ---- EXIF: build a tiny JPEG with an Exif block (big endian), FocalLengthIn35mmFilm 13, FocalLength 2.2, orientation 6
function jpegWithExif(le) {
  const bytes = [];
  const u16 = v => le ? [v & 255, v >> 8] : [v >> 8, v & 255];
  const u32 = v => le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const tiff = [];
  tiff.push(...(le ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(8));
  // IFD0 at 8: two entries (orientation, ExifIFD pointer)
  tiff.push(...u16(2));
  tiff.push(...u16(0x0112), ...u16(3), ...u32(1), ...u16(6), 0, 0);
  const exifAt = 8 + 2 + 2 * 12 + 4;
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifAt));
  tiff.push(...u32(0));
  // Exif IFD: 4 entries; the RATIONAL's value after it
  const ratAt = exifAt + 2 + 4 * 12 + 4;
  tiff.push(...u16(4));
  tiff.push(...u16(0x920A), ...u16(5), ...u32(1), ...u32(ratAt));
  tiff.push(...u16(0xA002), ...u16(4), ...u32(1), ...u32(4000));
  tiff.push(...u16(0xA003), ...u16(4), ...u32(1), ...u32(3000));
  tiff.push(...u16(0xA405), ...u16(3), ...u32(1), ...u16(13), 0, 0);
  tiff.push(...u32(0));
  tiff.push(...u32(22), ...u32(10));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  bytes.push(0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0);                        // a dummy APP0 first
  bytes.push(0xFF, 0xE1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1);
  bytes.push(0xFF, 0xDA, 0, 2, 0xFF, 0xD9);
  return new Uint8Array(bytes);
}
for (const le of [false, true]) {
  const e = RB.exif(jpegWithExif(le));
  ok(e.f35 === 13, 'exif f35 (' + (le ? 'II' : 'MM') + '): ' + e.f35);
  near(e.focal || 0, 2.2, 1e-9, 'exif focal length (' + (le ? 'II' : 'MM') + ')');
  ok(e.orient === 6 && e.w === 4000 && e.h === 3000, 'exif orientation and size (' + (le ? 'II' : 'MM') + '): ' + JSON.stringify(e));
}
ok(Object.keys(RB.exif(new Uint8Array([1, 2, 3]))).length === 0, 'not a JPEG: empty');
ok(Object.keys(RB.exif(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0]))).length === 0, 'truncated Exif: empty, no throw');

// ---- the projection: a camera at the middle of a 4 × 3 m room, facing É (deg 0 = up on the plan = −y)
{
  const fv = RB.fov(26, 4000, 3000), cam = { pos: [2000, 1400, 1500], basis: RB.basis(0, 0), tanH: fv.tanH, tanV: fv.tanV };
  const c = RB.project(cam, [2000, 1400, 0]);
  ok(c && Math.abs(c[0] - 0.5) < 1e-9 && Math.abs(c[1] - 0.5) < 1e-9, 'straight ahead lands in the middle of the photo');
  const r = RB.project(cam, [2400, 1400, 0]); ok(r && r[0] > 0.5, 'a point to the east (right) is right of centre');
  const u = RB.project(cam, [2000, 2000, 0]); ok(u && u[1] < 0.5, 'a higher point is above centre');
  ok(RB.project(cam, [2000, 1400, 3000]) === null, 'behind the camera: not in the photo');
  ok(RB.project(cam, [500, 1400, 0]) === null, 'a point 45° to the left at 1× is outside the frame (the corner gap of four shots)');
  const wide = RB.fov(13, 4000, 3000), cw = Object.assign({}, cam, { tanH: wide.tanH, tanV: wide.tanV });
  ok(RB.project(cw, [500, 1400, 0]) !== null, 'with 0.5× the same point is in the frame');
  const k = Object.assign({}, cam, { basis: RB.basis(90, 0) }), e = RB.project(k, [4000, 1400, 1500]);
  ok(e && Math.abs(e[0] - 0.5) < 1e-9, 'deg 90 faces K (+x)');
  const p = Object.assign({}, cam, { basis: RB.basis(0, 10) }), q = RB.project(p, [2000, 1400 + 1500 * Math.tan(10 * Math.PI / 180), 0]);
  ok(q && Math.abs(q[1] - 0.5) < 1e-9, 'pitch tilts the optical axis up');
}

// ---- geometry: an L-shaped room hides one wall from a point in its other arm
{
  const L = [[0, 0], [4000, 0], [4000, 2000], [2000, 2000], [2000, 4000], [0, 4000]];
  const ws = RB.walls(L);
  ok(ws.length === 6, 'six walls');
  ok(ws.every(w => RB.inside([w.mid[0] + w.n[0] * 10, w.mid[1] + w.n[1] * 10], L)), 'every normal points into the room');
  const cam = [3500, 500], far = ws.find(w => w.a[0] === 2000 && w.a[1] === 4000);   // the bottom edge of the lower arm
  ok(RB.seen(cam, far, ws) < 0.5, 'the far end of the other arm is hidden behind the corner');
  ok(RB.seen(cam, ws[0], ws) === 1, 'the near wall is in plain sight');
  const tris = RB.triangulate(L);
  const area = tris.reduce((a, t) => a + Math.abs(RB.signedArea(t.map(i => L[i]))), 0);
  near(area, Math.abs(RB.signedArea(L)), 1e-6, 'ear clipping covers the L exactly');
  const cw = L.slice().reverse(); near(RB.triangulate(cw).reduce((a, t) => a + Math.abs(RB.signedArea(t.map(i => cw[i]))), 0), 12e6, 1e-6, 'either winding');
}

// ---- the scene from the real end-to-end package (phone → package), with a correction in `box`
{
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'e2e', 'a-lakas-felujitas.json'), 'utf8')).package;
  const box = { h: { R1: 2650 }, shots: { 'F25/0': { yaw: 4, f35: 14 } } };
  const meta = f => /eszak/.test(f) ? { f35: 26, w: 4000, h: 3000 } : null;
  const sc = RB.scene(fx.plan, box, meta, { heightMm: 2700 });
  ok(sc.length === (fx.plan.data.floors || []).length, 'one box per floor');
  const k = sc.find(r => r.id === 'R1');
  ok(k && k.h === 2650, 'the per-room ceiling height is used');
  ok(k && k.shots.length === 2, 'the kitchen has its two Fotópont shots');
  const n = k.shots.find(s => s.deg === 0);
  ok(n.yaw === 4 && n.f35 === 14 && n.f35src === 'kezi', 'the shot correction overrides EXIF');
  const d = k.shots.find(s => s.deg === 180);
  ok(d.f35 === 26 && d.f35src === 'alap', 'no EXIF, no correction: the main lens');
  ok(k.cover.filter(Boolean).length >= 2, 'the north and south walls have a photo');
  ok(sc.filter(r => r.id !== 'R1').every(r => r.h === 2700), 'other rooms take the level height');
}

// ---- corner snapping (K1 polish): the corners seen in the photo give back the true direction and lens
{
  // a 5 × 4 m room, the photo point 1.5 m from the left wall; the photo faces up (É), really 7° to the right, with a 0.5× lens
  const plan = { data: { floors: [{ id: 'S', poly: [[0, 0], [5000, 0], [5000, 4000], [0, 4000]] }] },
    photos: [{ id: 'F1', x: 1500, y: 2600, shots: [{ deg: 0, side: 'É', file: 'a.jpg' }] }] };
  const meta = () => ({ w: 4000, h: 3000 });
  const truth = RB.scene(plan, { shots: { 'F1/0': { yaw: 7, f35: 15 } } }, meta)[0], ts = truth.shots[0];
  const lines = RB.cornerLines(truth, ts);
  ok(lines.length >= 2 && lines.every(l => l.u > -0.3 && l.u < 1.3), 'the corners in front of the camera: ' + lines.map(l => l.i).join(','));
  ok(lines.some(l => l.i === 0) && lines.some(l => l.i === 1), 'both far corners (0 and 1) are offered');
  ok(!lines.some(l => l.i === 2 || l.i === 3), 'the corners behind the camera are not');
  const l0 = lines.find(l => l.i === 0);
  ok(l0.bottom[1] > l0.u * 0 + 0.5 && l0.top[1] < 0.5, 'a corner line runs from the floor (below the middle) to the ceiling (above)');
  // the user drags the corners of the uncorrected box onto where they really are (the true camera's u)
  const plain = RB.scene(plan, {}, meta)[0], ps = plain.shots[0];
  const marks = lines.filter(l => l.i <= 1).map(l => ({ i: l.i, u: l.u }));
  const two = RB.snap(plain, ps, marks);
  near(two.yaw, 7, 0.1, 'two corners: the direction');
  near(two.f35, 15, 0.3, 'two corners: the lens (0.5×)');
  ok(two.err < 0.002, 'and both corners land where they were dragged (' + two.err + ')');
  // one corner with the lens already right: the direction alone
  const lensOk = RB.scene(plan, { shots: { 'F1/0': { f35: 15 } } }, meta)[0];
  const one = RB.snap(lensOk, lensOk.shots[0], [marks[0]]);
  near(one.yaw, 7, 0.1, 'one corner: the direction'); ok(one.f35 === undefined, 'one corner leaves the lens alone');
  // the result put back into the box puts the lines where they were dragged
  const fixed = RB.scene(plan, { shots: { 'F1/0': { yaw: two.yaw, f35: two.f35 } } }, meta)[0];
  RB.cornerLines(fixed, fixed.shots[0]).filter(l => l.i <= 1).forEach(l => near(l.u, marks.find(m => m.i === l.i).u, 0.003, 'corner ' + l.i + ' lands on its mark'));
  // corners dragged the wrong way round (crossed): no lens fits, nothing is applied
  ok(RB.snap(plain, ps, [{ i: 0, u: marks[1].u }, { i: 1, u: marks[0].u }]) === null, 'crossed corners give no answer');
  ok(RB.snap(plain, ps, []) === null, 'no mark, no answer');
  // a turned photo (side K, 90°) with a pitch: still the direction
  const plan2 = { data: plan.data, photos: [{ id: 'F2', x: 2500, y: 2000, shots: [{ deg: 90, side: 'K', file: 'b.jpg' }] }] };
  const t2 = RB.scene(plan2, { shots: { 'F2/90': { yaw: -4.5, pitch: 6, f35: 26 } } }, meta)[0];
  const m2 = RB.cornerLines(t2, t2.shots[0]).map(l => ({ i: l.i, u: l.u }));
  const s2 = RB.snap(RB.scene(plan2, { shots: { 'F2/90': { pitch: 6, f35: 26 } } }, meta)[0], RB.scene(plan2, { shots: { 'F2/90': { pitch: 6, f35: 26 } } }, meta)[0].shots[0], m2.slice(0, 1));
  near(s2.yaw, -4.5, 0.15, 'a pitched photo facing K: the direction from one corner');
}

console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
