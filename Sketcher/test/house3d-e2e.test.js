// Sketcher/test/house3d-e2e.test.js — Ház 3D end to end (skcam K5): 40 photos of a known house (test/house-scene.js:
// 10 × 8 m, 6 m walls) taken on a 14 m ring at eye height, through Sketcher/tools/house3d.js and COLMAP, into a
// .house3d.json; one known distance sets the scale and everything else must measure true. Slow (about 2–3 minutes on
// a CPU); skipped when COLMAP is not installed (tools/house3d.js findColmap) or with VRG_SKIP_SLOW=1.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'lib', 'house3d.js')), S = require(path.join(__dirname, 'house-scene.js'));
const { findColmap } = require(path.join(ROOT, 'tools', 'house3d.js'));
if (process.env.VRG_SKIP_SLOW === '1') { console.log('SKIP house3d-e2e.test: VRG_SKIP_SLOW=1'); process.exit(0); }
if (!findColmap()) { console.log('SKIP house3d-e2e.test: COLMAP not installed'); process.exit(0); }
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-house3d-e2e-'));
const ring = S.ring(40, 14000, 1600), truth = Object.fromEntries(ring.map(c => [c.name, c.c]));
ring.forEach(c => fs.writeFileSync(path.join(dir, c.name), S.png(S.render(c.c, [0, 2500, 0], 26, 960, 720))));
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'house3d.js'), dir, '--name', 'teszt-haz'], { encoding: 'utf8', maxBuffer: 1 << 26 });
ok(r.status === 0, 'house3d.js ran (' + Math.round((Date.now() - t0) / 1000) + ' s): ' + (r.stderr || '').trim().split('\n').slice(-2).join(' | '));
const file = path.join(dir, 'teszt-haz.house3d.json');
if (fs.existsSync(file)) {
  const h = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(H.is(h), 'a house3d file');
  ok(h.report.registered >= 36, 'at least 36 of 40 photos placed (' + h.report.registered + ')');
  ok(h.report.points >= 2000, 'a cloud of ' + h.report.points + ' points');
  // the scale from two cameras on opposite sides (a tape between two spots), then every other camera distance
  const cs = h.cams, a = cs[0], b = cs[Math.floor(cs.length / 2)];
  const hs = H.setScale(h, a.c, b.c, H.dist(truth[a.name], truth[b.name]));
  let worst = 0;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const t = H.dist(truth[cs[i].name], truth[cs[j].name]); worst = Math.max(worst, Math.abs(H.mm(hs, cs[i].c, cs[j].c) - t) / t);
  }
  ok(worst < 0.02, 'after one scale, every camera-to-camera distance within 2 % (worst ' + (worst * 100).toFixed(2) + ' %)');
  const ys = cs.map(c => c.c[1] * hs.scale.mmPerUnit), my = ys.reduce((x, y) => x + y) / ys.length;
  const sd = Math.sqrt(ys.reduce((s2, y) => s2 + (y - my) ** 2, 0) / ys.length);
  ok(sd < 100, 'upright: the cameras (all at 1.6 m) within ' + sd.toFixed(0) + ' mm of one height');
  // the points sit on the walls: their distance from the middle between the walls' 4 m and the corners' 6.4 m
  const k = hs.scale.mmPerUnit, hd = [];
  for (let i = 0; i < hs.pts.length; i += 3) hd.push(Math.hypot(hs.pts[i], hs.pts[i + 2]) * k);
  hd.sort((x, y) => x - y);
  const lo = hd[Math.floor(hd.length * 0.01)], hi = hd[Math.floor(hd.length * 0.995)];
  ok(Math.abs(lo - 4000) < 150 && Math.abs(hi - Math.hypot(5000, 4000)) < 200, 'the walls where they are: ' + lo.toFixed(0) + ' … ' + hi.toFixed(0) + ' mm from the middle (4000 … 6403)');
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
