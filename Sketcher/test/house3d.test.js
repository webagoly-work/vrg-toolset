// Sketcher/test/house3d.test.js — Ház 3D file maths (lib/house3d.js, dev line skcam K5), in Node, without COLMAP.
// A COLMAP text model is written by hand from known cameras and points (tilted and shifted, as COLMAP's arbitrary frame
// is); reading it must turn it upright, centre it, keep only the reliable points, and measure true after one scale.
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'house3d.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e, m) => ok(a != null && Math.abs(a - b) <= e, m + ' (got ' + a + ', want ' + b + ' ± ' + e + ')');

// ---- a model in a tilted, shifted, scaled frame: world → COLMAP frame = s · Q · (x) + T
const s = 0.37, T = [3, -1, 5];
const Q = H.toUp([0.3, 0.8, -0.5]);        // some rotation (the one that turns that vector to +Y)
const toC = p => { const r = [Q[0][0] * p[0] + Q[0][1] * p[1] + Q[0][2] * p[2], Q[1][0] * p[0] + Q[1][1] * p[1] + Q[1][2] * p[2], Q[2][0] * p[0] + Q[2][1] * p[1] + Q[2][2] * p[2]]; return [s * r[0] + T[0], s * r[1] + T[1], s * r[2] + T[2]]; };
// world cameras on a ring at 1.6 m looking at the middle (mm); COLMAP stores R (world→camera) and t = −R·C
function quatOf(R) {              // rotation matrix (rows) → [w, x, y, z]
  const tr = R[0][0] + R[1][1] + R[2][2]; let w, x, y, z;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; w = S / 4; x = (R[2][1] - R[1][2]) / S; y = (R[0][2] - R[2][0]) / S; z = (R[1][0] - R[0][1]) / S; }
  else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) { const S = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) * 2; w = (R[2][1] - R[1][2]) / S; x = S / 4; y = (R[0][1] + R[1][0]) / S; z = (R[0][2] + R[2][0]) / S; }
  else if (R[1][1] > R[2][2]) { const S = Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]) * 2; w = (R[0][2] - R[2][0]) / S; x = (R[0][1] + R[1][0]) / S; y = S / 4; z = (R[1][2] + R[2][1]) / S; }
  else { const S = Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]) * 2; w = (R[1][0] - R[0][1]) / S; x = (R[0][2] + R[2][0]) / S; y = (R[1][2] + R[2][1]) / S; z = S / 4; }
  return [w, x, y, z];
}
const mmul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const tr3 = A => [0, 1, 2].map(i => [0, 1, 2].map(j => A[j][i]));
const cams = [], imgLines = [];
for (let i = 0; i < 12; i++) {
  const a = i / 12 * 2 * Math.PI, C = [Math.cos(a) * 14, 1.6, Math.sin(a) * 14];
  const f = [-C[0], 2.5 - C[1], -C[2]], fl = Math.hypot(...f), fw = f.map(v => v / fl);
  const rt = [fw[1] * 0 - fw[2] * 1, fw[2] * 0 - fw[0] * 0, fw[0] * 1 - fw[1] * 0]; const rl = Math.hypot(...rt); const r = rt.map(v => v / rl);
  const up = [r[1] * fw[2] - r[2] * fw[1], r[2] * fw[0] - r[0] * fw[2], r[0] * fw[1] - r[1] * fw[0]];
  // camera axes in world: x = r, y = −up (image y down), z = fw; R_wc rows = those axes; in COLMAP's frame R = R_wc · Qᵀ
  const Rw = [r, up.map(v => -v), fw], R = mmul(Rw, tr3(Q)), Cc = toC(C), t = R.map(row => -(row[0] * Cc[0] + row[1] * Cc[1] + row[2] * Cc[2]));
  cams.push(C);
  imgLines.push([i + 1, ...quatOf(R), ...t, 1, 'haz_' + String(i).padStart(2, '0') + '.png'].join(' '), '');
}
const pts = [], ptLines = [];
let id = 1;
for (let x = -5; x <= 5; x += 1) for (let y = 0; y <= 6; y += 1) { pts.push([x, y, -4]); pts.push([x, y, 4]); }
pts.forEach(p => { const c = toC(p); ptLines.push([id++, ...c, 200, 180, 160, 0.6, 1, 1, 2, 2, 3, 3].join(' ')); });
ptLines.push([id++, ...toC([0, 3, 0]), 255, 0, 0, 5.0, 1, 1, 2, 2, 3, 3].join(' '));        // a high reprojection error: dropped
ptLines.push([id++, ...toC([0, 2, 0]), 0, 255, 0, 0.5, 1, 1].join(' '));                    // seen once: dropped
const model = { cameras: '1 SIMPLE_RADIAL 960 720 800 480 360 0.01', images: '# comment\n' + imgLines.join('\n'), points: ptLines.join('\n') };

{
  ok(H.parseCameras(model.cameras)['1'].w === 960, 'cameras.txt');
  ok(H.parseImages(model.images).length === 12, 'images.txt: 12 photos, the point lines skipped');
  const P = H.parsePoints(model.points); ok(P.length === pts.length + 2 && P[0].track === 3, 'points3D.txt with track lengths (3 photos each)');
  const h = H.build(model, { name: 'teszt', now: 1 });
  ok(h.kind === 'vrg-house3d' && h.report.registered === 12 && h.cams.length === 12, 'the file: 12 cameras');
  ok(h.report.points === pts.length, 'unreliable points dropped (' + h.report.points + ' of ' + (pts.length + 2) + ')');
  const ys = h.cams.map(c => c.c[1]), sd = Math.sqrt(ys.reduce((a, y) => a + y * y, 0) / ys.length);
  near(sd, 0, 1e-6, 'upright: the cameras (all at 1.6 m) at one height');
  const mid = h.cams.reduce((a, c) => [a[0] + c.c[0] / 12, a[1] + c.c[1] / 12, a[2] + c.c[2] / 12], [0, 0, 0]);
  near(Math.hypot(...mid), 0, 1e-6, 'centred on the cameras');
  // up: a wall point higher in the world is higher in the file
  const top = h.pts.slice(0, 3), bottom = [];
  ok(h.pts.length === pts.length * 3 && h.rgb.length === pts.length * 3, 'points and colours');
  // scale from two cameras 28 m apart (opposite on the ring), then a wall's width
  const a = h.cams.find(c => /haz_00/.test(c.name)).c, b = h.cams.find(c => /haz_06/.test(c.name)).c;
  ok(H.mm(h, a, b) === null, 'no scale yet: no millimetres');
  const hs = H.setScale(h, a, b, 28000);
  // the front wall's corners (−5, 0, −4) and (5, 0, −4) are points 0 and the last of the first row … find them by world truth
  const W = pts.map(p => p.join(','));
  const i0 = W.indexOf('-5,0,-4'), i1 = W.indexOf('5,0,-4'), i2 = W.indexOf('-5,6,-4');
  const P0 = h.pts.slice(i0 * 3, i0 * 3 + 3), P1 = h.pts.slice(i1 * 3, i1 * 3 + 3), P2 = h.pts.slice(i2 * 3, i2 * 3 + 3);
  near(H.mm(hs, P0, P1), 10000, 2, 'the 10 m wall measures 10 m after one scale');
  near(H.mm(hs, P0, P2), 6000, 2, 'the 6 m height');
  ok(P2[1] > P0[1], 'up is up');
  let threw = false; try { H.setScale(h, a, a, 1000); } catch (e) { threw = true; } ok(threw, 'a scale needs two different points');
  ok(H.is(hs) && !H.is({ kind: 'vrg-vazlat' }), 'is()');
  const arr = H.arrays(hs); ok(arr.n === pts.length && arr.pos instanceof Float32Array, 'arrays for drawing');
}

// ---- PLY (the dense cloud)
{
  const ascii = 'ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n1 2 3 10 20 30\n4 5 6 40 50 60\n';
  const a = H.parsePly(Buffer.from(ascii));
  ok(a.length === 2 && a[1].xyz[2] === 6 && a[1].rgb[0] === 40, 'ASCII PLY');
  const head = 'ply\nformat binary_little_endian 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n';
  const body = Buffer.alloc(2 * 27);
  [[1.5, -2, 3, 0, 1, 0, 9, 8, 7], [4, 5, 6.25, 1, 0, 0, 1, 2, 3]].forEach((v, k) => { for (let i = 0; i < 6; i++) body.writeFloatLE(v[i], k * 27 + i * 4); body[k * 27 + 24] = v[6]; body[k * 27 + 25] = v[7]; body[k * 27 + 26] = v[8]; });
  const b = H.parsePly(Buffer.concat([Buffer.from(head), body]));
  ok(b.length === 2 && b[0].xyz[0] === 1.5 && b[1].xyz[2] === 6.25 && b[0].rgb.join() === '9,8,7', 'binary PLY with normals');
  const hd = H.withDense(H.build(model, { minTrack: 2 }), model, [{ xyz: toC([0, 1, -4]), rgb: [1, 2, 3] }]);
  ok(hd.report.dense && hd.pts.length === 3, 'a dense cloud replaces the sparse one, in the same frame');
}

console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
