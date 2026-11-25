// Sketcher/test/plane.test.js — Síkmérés maths (lib/plane.js, dev line skcam K3): the homography, the corner order,
// the reference turned the other way, distances and heights on the plane, the reach grade, the stored record.
// The "photos" are made by a known projective map from the wall (mm) to the photo, so every true value is known.
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', 'lib', 'plane.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e, m) => ok(a != null && Math.abs(a - b) <= e, m + ' (got ' + a + ', want ' + b + ' ± ' + e + ')');

// A wall seen at an angle: plane mm (x right, y DOWN from the top of the wall) → a 4:3 photo, by a pinhole camera.
// The wall is 2600 mm high; the floor line is y = 2600. The camera stands 2.5 m off the wall, 1.3 m up, turned 25°.
const ASPECT = 4 / 3;
function camera(yawDeg, dist, eyeY, x0) {
  const y = yawDeg * Math.PI / 180, f = 1 / (2 * Math.tan(32 * Math.PI / 180));   // ~64° horizontal field of view
  return pt => {
    // wall point in camera space: wall x along the wall, wall up = -y
    const X = pt[0] - x0, Y = eyeY - pt[1], Z = dist;
    const cx = X * Math.cos(y) - Z * Math.sin(y), cz = X * Math.sin(y) + Z * Math.cos(y);
    const u = 0.5 + (f * cx / cz) / ASPECT, v = 0.5 - f * Y / cz;
    return [u, v];
  };
}
const shot = camera(25, 2500, 1300, 1600);
const A4 = [[1000, 900], [1210, 900], [1210, 1197], [1000, 1197]];     // an A4 sheet taped upright to the wall
const rec = { aspect: ASPECT, ref: { kind: 'a4', w: 210, h: 297, pts: A4.map(shot) } };

// ---- the frame and exact distances
{
  const f = P.frame(rec);
  ok(f && f.w === 210 && f.h === 297, 'the A4 frame as tapped');
  const a = [600, 1500], b = [2300, 2100];
  near(P.distance(f, shot(a), shot(b)), Math.hypot(1700, 600), 1e-6, 'a distance across the wall is exact');
  near(P.distance(f, shot([1000, 900]), shot([1210, 900])), 210, 1e-6, 'the reference edge itself');
  const back = P.toPlane(f, shot([1500, 2000]));
  near(back[0], 500, 1e-6, 'a point maps back to the plane, from the sheet\'s top-left corner (x)'); near(back[1], 1100, 1e-6, '… and y');
}
// ---- the taps in any order give the same frame
{
  const shuffled = Object.assign({}, rec, { ref: Object.assign({}, rec.ref, { pts: [rec.ref.pts[2], rec.ref.pts[0], rec.ref.pts[3], rec.ref.pts[1]] }) });
  const f = P.frame(shuffled);
  near(P.distance(f, shot([600, 1500]), shot([2300, 2100])), Math.hypot(1700, 600), 1e-6, 'corners tapped in any order');
  ok(P.order([[0, 0], [1, 1], [1, 0], [0.5, 0.5]]) === null, 'a non-convex quad is no rectangle');
}
// ---- an A4 sheet lying landscape, chosen as "A4": the long edges are across, so w and h swap by themselves
{
  const L = [[1000, 900], [1297, 900], [1297, 1110], [1000, 1110]];
  const f = P.frame({ aspect: ASPECT, ref: { kind: 'a4', w: 210, h: 297, pts: L.map(shot) } });
  ok(f && f.w === 297 && f.h === 210, 'a landscape sheet is read the right way round');
  near(P.distance(f, shot([600, 1500]), shot([2300, 2100])), Math.hypot(1700, 600), 1e-6, '… and measures true');
  const forced = P.frame({ aspect: ASPECT, ref: { kind: 'a4', w: 210, h: 297, turn: false, pts: L.map(shot) } });
  ok(forced.w === 210 && forced.h === 297, 'turn: false is the user\'s word: no swap, whatever the picture suggests');
}
// ---- heights above the floor line
{
  const fr = Object.assign({}, rec, { floor: [shot([300, 2600]), shot([2800, 2600])] }), f = P.frame(fr);
  near(P.height(f, fr.floor, shot([1800, 2300])), 300, 1e-6, 'a socket 30 cm up');
  near(P.height(f, fr.floor, shot([700, 1500])), 1100, 1e-6, 'a switch 110 cm up');
  near(P.height(f, [fr.floor[1], fr.floor[0]], shot([700, 1500])), 1100, 1e-6, 'the floor line drawn right to left');
  ok(P.height(f, fr.floor, shot([700, 2700])) < 0, 'below the floor line is negative');
}
// ---- realistic taps: ±1.5 px on a 4000 px photo keep a 1–2 m measurement within 1 %
{
  let worst = 0;
  for (let k = 0; k < 40; k++) {
    const jit = p => [p[0] + (Math.sin(k * 7.1 + p[0] * 99) * 1.5) / 4000, p[1] + (Math.cos(k * 3.3 + p[1] * 77) * 1.5) / 3000];
    const f = P.frame({ aspect: ASPECT, ref: { kind: 'a4', w: 210, h: 297, pts: A4.map(shot).map(jit) } });
    const d = P.distance(f, shot([1100, 1500]), shot([1100, 2600])); worst = Math.max(worst, Math.abs(d - 1100) / 1100);
  }
  ok(worst < 0.01, 'tap error of 1.5 px: the worst 1.1 m height error ' + (worst * 100).toFixed(2) + ' % (< 1 %)');
}
// ---- reach grade and the horizon
{
  const f = P.frame(rec);
  ok(P.quality(f, [shot([1100, 1000]), shot([1150, 1300])]).grade === 'jo', 'next to the sheet: jó');
  ok(P.quality(f, [shot([1100, 1000]), shot([2200, 1700])]).grade === 'kozepes', 'some way off (about 4 sheets): közepes');
  ok(P.quality(f, [shot([2600, 2500])]).grade === 'tavoli', 'far from the sheet: távoli');
  ok(P.distance(f, [0.5, 0.5], [5, -40]) === null || true, 'a point past the horizon does not throw');
}
// ---- the stored record
{
  const r = P.clean({ aspect: ASPECT, ref: Object.assign({}, rec.ref, { kind: 'xyz' }), floor: [shot([300, 2600]), shot([2800, 2600])],
    lines: [{ a: shot([600, 1500]), b: shot([2300, 2100]), mm: 1, label: 'Dugalj – kapcsoló' }, { a: [0.1, 0.1] }],
    marks: [{ p: shot([1800, 2300]) }], junk: 1, at: 5 });
  ok(r.ref.kind === 'egyeni', 'an unknown reference kind becomes egyéni');
  ok(r.lines.length === 1 && r.lines[0].mm === 1803 && r.lines[0].label === 'Dugalj – kapcsoló', 'the stored mm is recomputed, not trusted: ' + JSON.stringify(r.lines));
  ok(r.marks[0].mm === 300 && !('junk' in r) && r.at === 5, 'heights recomputed, unknown keys dropped');
  ok(P.clean({ aspect: 1.3 }) === null, 'an empty record is no record');
  ok(JSON.stringify(P.summary(r)) === JSON.stringify(['Dugalj – kapcsoló: 1,8 m', 'Magasság 1: 300 mm']), 'the readable lines: ' + JSON.stringify(P.summary(r)));
  ok(P.keyOf('F25', 450) === 'F25/90' && P.keyOf('C3') === 'C3', 'the photo keys');
  ok(P.REFS.find(x => x.id === 'a4').h === 297, 'the A4 preset');
}

// ---- the phone bundles exactly these files (feature-sketch/build.gradle.kts PLANE_ASSETS) and PlaneUi.kt loads them
{
  const fs = require('fs'), A = ['plane.js', 'plane-ui.js'];
  const g = fs.readFileSync(path.join(__dirname, '..', '..', 'Mobile', 'android', 'feature-sketch', 'build.gradle.kts'), 'utf8');
  const m = /val PLANE_ASSETS = listOf\(([^)]*)\)/.exec(g);
  ok(m && JSON.stringify(m[1].split(',').map(x => x.trim().replace(/"/g, ''))) === JSON.stringify(A), 'PLANE_ASSETS = ' + A.join(', '));
  const ui = fs.readFileSync(path.join(__dirname, '..', '..', 'Mobile', 'android', 'feature-sketch', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'sketch', 'ui', 'PlaneUi.kt'), 'utf8');
  ok(A.every(a => ui.includes('"' + a + '"')) && ui.includes('VRGPlaneUI.run()') && ui.includes('"VRGPlaneIO"'), 'PlaneUi.kt loads the same files and names the bridge plane-ui.js reads');
}

console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
