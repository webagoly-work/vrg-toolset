// Sketcher/test/pano.test.js — Körkép maths (lib/pano.js, dev line skcam K4), in Node.
//
// The phone's own viewer input (fixtures/roombox-input.json: the kitchen in mm and its photo point) and the ray caster
// (test/raycast.js) make four 0.5× photos of a known room from the photo point, three of them taken a little off from
// the side the survey says (turned +3°, −2° and tilted +2°, +1.5°). Aligning the neighbours must find those errors; the
// panorama built with the fixes must look like a fresh photo taken in a direction between two shots; the 360° file
// must carry its GPano XMP.
'use strict';
const path = require('path'), fs = require('fs');
const RB = require(path.join(__dirname, '..', 'lib', 'roombox.js'));
const PA = require(path.join(__dirname, '..', 'lib', 'pano.js'));
const RC = require(path.join(__dirname, 'raycast.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e, m) => ok(a != null && Math.abs(a - b) <= e, m + ' (got ' + a + ', want ' + b + ' ± ' + e + ')');

const inp = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'roombox-input.json'), 'utf8')).input;
// four shots at the kitchen's photo point, all with the 0.5× lens (13 mm): the survey's sides and how they were really taken
const plan = JSON.parse(JSON.stringify(inp.plan));
const fp = plan.photos.find(p => p.id === 'F25');
fp.shots = [0, 90, 180, 270].map(d => ({ deg: d, side: '', file: 'F25_' + d + '.jpg', f35: 13 }));
const TRUE = { 0: { yaw: 0, pitch: 0 }, 90: { yaw: 93, pitch: 0 }, 180: { yaw: 178, pitch: 2 }, 270: { yaw: 271.5, pitch: 0 } };
const room = RB.scene(plan, {}, () => null, inp.level).find(r => r.id === 'R1');
const W = 480, H = 360, images = {};
room.shots.forEach(s => { const t = TRUE[s.deg]; images[s.file] = RC.pixels(room, s.plan, t.yaw, 13, W, H, room.eye, t.pitch); });
const meta = f => ({ w: W, h: H });

// ---- the basics
{
  const d = PA.dirOf(90, 0); near(d[0], 1, 1e-9, 'lon 90 is K (+x)');
  near(PA.dirOf(0, 90)[1], 1, 1e-9, 'lat 90 is straight up');
  const cam = { basis: PA.basis(0, 0), tanH: 1, tanV: 1 };
  const c = PA.q(cam, PA.dirOf(0, 0)); ok(c && Math.abs(c[0]) < 1e-9 && Math.abs(c[1]) < 1e-9, 'straight ahead is the middle');
  ok(PA.q(cam, PA.dirOf(180, 0)) === null, 'behind is not in the frame');
  const sh = room.shots;
  ok(PA.overlap(sh[0], sh[1]) && PA.overlap(sh[0], sh[1]).width > 10, '0.5× neighbours overlap (' + (PA.overlap(sh[0], sh[1]) || {}).width + '°)');
  const narrow = RB.scene(plan, { shots: Object.fromEntries(sh.map(s => [s.key, { f35: 26 }])) }, () => null, inp.level).find(r => r.id === 'R1').shots;
  ok(PA.overlap(narrow[0], narrow[1]) === null, '1× neighbours leave a gap: no overlap to match');
}

// ---- aligning: the errors are found
const t0 = Date.now();
const al = PA.align(room.shots, images);
const took = Date.now() - t0;
{
  ok(al.ring && al.pairs.every(p => p.ok), 'all four pairs match and the ring closes: ' + JSON.stringify(al.pairs.map(p => [p.a, p.b, p.dyaw, p.dpitch, p.score && +p.score.toFixed(2)])));
  const fx = k => al.fixes['F25/' + k] || {};
  near(fx(0).dyaw, 0, 1e-9, 'the first shot stays');
  near(fx(90).dyaw, 3, 0.3, 'K was turned +3°'); near(fx(180).dyaw, -2, 0.3, 'D was turned −2°'); near(fx(270).dyaw, 1.5, 0.3, 'Ny was turned +1.5°');
  near(fx(180).dpitch, 2, 0.3, 'D was tilted +2°'); near(fx(90).dpitch, 0, 0.3, 'K was level');
  ok(took < 20000, 'aligning four photos took ' + took + ' ms');
}

// ---- the panorama, with the fixes: a fresh photo between two shots looks the same
{
  const box = { shots: {} };
  Object.entries(al.fixes).forEach(([k, f]) => { box.shots[k] = { yaw: f.dyaw, pitch: f.dpitch, f35: 13 }; });
  const fixed = RB.scene(plan, box, meta, inp.level).find(r => r.id === 'R1');
  const pano = PA.equirect(fixed.shots, images, 1024, 512);
  // landscape 0.5× photos reach about ±40° up and down: the ring around the horizon is whole, the poles stay dark
  ok(pano.w === 1024 && pano.h === 512 && pano.covered > 0.4, 'a 2:1 panorama, the band of the walls covered (' + (pano.covered * 100).toFixed(0) + ' % of the rows × columns)');
  let ring = 0; for (let i = 0; i < 1024; i++) { const k = (256 * 1024 + i) * 4; if (!(pano.data[k] === 28 && pano.data[k + 1] === 32 && pano.data[k + 2] === 36)) ring++; }
  ok(ring === 1024, 'the horizon is covered all the way round (' + ring + ' / 1024)');
  // look from the photo point toward 45° (between É and K, where two photos meet) with a 1× lens, from the panorama
  const truth = RC.pixels(fixed, fixed.shots[0].plan, 45, 26, 160, 120, fixed.eye, 0);
  const cam = { basis: PA.basis(45, 0), tanH: 0, tanV: 0 }, d35 = Math.hypot(36, 24), dg = Math.hypot(160, 120);
  cam.tanH = (d35 * 160 / dg) / 2 / 26; cam.tanV = (d35 * 120 / dg) / 2 / 26;
  const c = [0, 0, 0];
  let err = 0, bad = 0, n = 0;
  for (let j = 0; j < 120; j++) for (let i = 0; i < 160; i++) {
    const qx = (2 * (i + 0.5) / 160 - 1) * cam.tanH, qy = (1 - 2 * (j + 0.5) / 120) * cam.tanV, B = cam.basis;
    const d = [B.fwd[0] + B.r[0] * qx + B.up[0] * qy, B.fwd[1] + B.r[1] * qx + B.up[1] * qy, B.fwd[2] + B.r[2] * qx + B.up[2] * qy];
    const L = Math.hypot(...d), lat = Math.asin(d[1] / L) / Math.PI * 180, lon = ((Math.atan2(d[0], -d[2]) / Math.PI * 180) + 360) % 360;
    PA.sample(pano, lon / 360, (90 - lat) / 180, c);
    const k = (j * 160 + i) * 4, e = (Math.abs(c[0] - truth.data[k]) + Math.abs(c[1] - truth.data[k + 1]) + Math.abs(c[2] - truth.data[k + 2])) / 3;
    err += e; n++; if (e > 60) bad++;
  }
  ok(err / n < 14 && bad / n < 0.05, 'the panorama between É and K matches a fresh photo (mean ' + (err / n).toFixed(1) + ', off ' + (bad / n * 100).toFixed(1) + ' %)');
  // without the fixes the seam is worse
  const raw = RB.scene(plan, { shots: Object.fromEntries(room.shots.map(s => [s.key, { f35: 13 }])) }, meta, inp.level).find(r => r.id === 'R1');
  const p0 = PA.equirect(raw.shots, images, 1024, 512);
  let e0 = 0;
  for (let j = 0; j < 512; j += 4) for (let i = 0; i < 1024; i += 4) { const k = (j * 1024 + i) * 4; e0 += Math.abs(p0.data[k] - pano.data[k]); }
  ok(e0 > 0, 'the fixes change the panorama');
}

// ---- the fixes into the box key, and the report
{
  const b = PA.applyFixes({ h: { R1: 2650 }, shots: { 'F25/90': { yaw: 1, f35: 13 } } }, { 'F25/0': { dyaw: 0, dpitch: 0 }, 'F25/90': { dyaw: 2, dpitch: 0 }, 'F25/180': { dyaw: -2, dpitch: 1.5 } });
  ok(b.h.R1 === 2650 && b.shots['F25/90'].yaw === 3 && b.shots['F25/90'].f35 === 13, 'fixes add to what is there');
  ok(b.shots['F25/180'].yaw === -2 && b.shots['F25/180'].pitch === 1.5 && !b.shots['F25/0'], 'new ones appear, zeros do not');
  ok(/^Igazítva \(4\/4 pár, körbe zárva\): /.test(PA.report(al)), 'the report: ' + PA.report(al));
  ok(/0,5×/.test(PA.report({ fixes: {}, pairs: [{ ok: false }], ring: false })), 'no overlap: the report says why');
}

// ---- the 360° file
{
  const x = PA.xmp(4096, 2048, 0);
  ok(/GPano:ProjectionType="equirectangular"/.test(x) && /FullPanoWidthPixels="4096"/.test(x), 'GPano XMP');
  const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 1, 2, 0xFF, 0xD9]);
  const out = PA.withXmp(jpg, x);
  ok(out[0] === 0xFF && out[1] === 0xD8 && out[2] === 0xFF && out[3] === 0xE1, 'the XMP block right after the start');
  const len = (out[4] << 8) | out[5];
  ok(Buffer.from(out.subarray(6, 6 + 29)).toString('latin1') === 'http://ns.adobe.com/xap/1.0/\u0000', 'the XMP namespace header');
  ok(out[4 + len] === 0xFF && out[5 + len] === 0xE0, 'the original segments follow, intact');
  let threw = false; try { PA.withXmp(new Uint8Array([1, 2, 3]), x); } catch (e) { threw = true; } ok(threw, 'not a JPEG: refused');
}

console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
