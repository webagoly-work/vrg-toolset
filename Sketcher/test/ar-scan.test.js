// Sketcher/test/ar-scan.test.js — the Google AR csomag's room scan (skcam K6, WP M64) on the Desktop. The phone's AR
// meter writes a scan as a vrg-house3d file that is already to scale (ARCore works in metres); sketch-core ArTest
// writes such a file of a known 4 × 3 m room, 2.6 m high, with two AR distances, to fixtures/ar-scan.house3d.json.
// Here the Desktop's own house3d.js must read it as a house file and measure it true with no 📏 Lépték step, and the
// Desktop page's Ház 3D viewer must open it from Megnyitás already to scale (Playwright; that half skips without it).
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'lib', 'house3d.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol, m) => ok(a != null && Math.abs(a - b) <= tol, m + ' (got ' + a + ', want ' + b + ' ± ' + tol + ')');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ar-scan.house3d.json'), 'utf8')), house = fx.house;
ok(H.is(house), 'a house3d file');
ok(house.tool && house.tool.arcore === true, 'it says it came from ARCore');
ok(house.scale && house.scale.mmPerUnit === 1000, 'to scale already: 1 unit = 1 m');
near(H.mm(house, house.measures[0].a, house.measures[0].b), 4000, 1, 'the long wall, as measured on the phone');
near(H.mm(house, house.measures[1].a, house.measures[1].b), 2600, 1, 'the ceiling height');
// the points span the room: 4 m × 2.6 m × 3 m
const ext = [0, 1, 2].map(k => { let lo = Infinity, hi = -Infinity; for (let i = k; i < house.pts.length; i += 3) { lo = Math.min(lo, house.pts[i]); hi = Math.max(hi, house.pts[i]); } return Math.round((hi - lo) * 1000); });
near(ext[0], 4000, 110, 'the room is 4 m along x'); near(ext[1], 2600, 110, '2.6 m high (+Y up)'); near(ext[2], 3000, 110, '3 m along z');
// any two points of the cloud measure in mm with no scale step (the viewer's ↔ Mérés)
near(H.mm(house, [0, 0, 0], [1, 0, 0]), 1000, 0, 'a metre is 1000 mm');
ok(house.pts.length / 3 === house.report.points && house.rgb.length === house.pts.length, 'one colour per point');
ok(house.cams.length === 12 && house.cams.every(c => /^ar-\d{3}$/.test(c.name)), 'the camera path as cameras');

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('ar-scan.test: browser part skipped (playwright not installed)'); return; }
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('ar-scan.test: browser part skipped (no browser)'); return; }
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'dist', 'vrg-sketcher.html'));
  await page.setInputFiles('#fopen', { name: 'nappali-ar.house3d.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(house)) });
  await page.waitForSelector('.h3 .h3-c', { timeout: 10000 });
  const side = await page.$eval('.h3-side', e => e.textContent);
  ok(!/Még nincs lépték/.test(side), 'the viewer opens to scale (no 📏 Lépték needed)');
  const labels = await page.$$eval('.h3-side [data-h="label"]', es => es.map(e => e.value));
  ok(labels.join('|') === 'Hosszú fal|Belmagasság', 'the phone\'s two distances are listed with their names: ' + labels.join('|'));
  ok(/4 m|4,00? m|4000/.test(side) && /2,6 m|2,60 m|2600/.test(side), 'and their lengths: ' + side.replace(/\s+/g, ' ').slice(0, 200));
  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  await browser.close();
})().then(() => {
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
}).catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
