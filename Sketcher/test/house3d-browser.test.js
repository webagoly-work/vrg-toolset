// Sketcher/test/house3d-browser.test.js — the Ház 3D viewer on the Desktop page (skcam K5), Playwright + WebGL.
// A house file is made from the known house (test/house-scene.js) in a shrunk, shifted frame, as a reconstruction
// comes without a size. Through the viewer: the scale from the front wall's 10 m, then the side wall and the height
// must read true; ⇩ Mentés hands the file back with the scale and the measurement. A .house3d.json dropped on the
// page's Megnyitás opens the viewer. Skips when Playwright is not installed.
'use strict';
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP house3d-browser.test: playwright not installed'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const S = require(path.join(__dirname, 'house-scene.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const within = (a, b, rel, m) => ok(a != null && Math.abs(a - b) <= b * rel, m + ' (got ' + a + ', want ' + b + ' ± ' + rel * 100 + ' %)');

// the cloud: points every 25 cm on the four walls; model units = mm / 2700 (no size), the middle shifted
const U = 2700, off = [0.3, -0.2, 0.1], pts = [], rgb = [];
S.WALLS.forEach((w, wi) => {
  for (let u = 0; u <= w.len + 1; u += 250) for (let y = 0; y <= S.HOUSE.h + 1; y += 250) {
    const x = w.a[0] + (w.b[0] - w.a[0]) * u / w.len, z = w.a[1] + (w.b[1] - w.a[1]) * u / w.len;
    pts.push(x / U + off[0], y / U + off[1], z / U + off[2]); rgb.push(120 + wi * 30, 150, 170);
  }
});
const cams = S.ring(12, 14000, 1600).map(c => ({ name: c.name, c: [c.c[0] / U + off[0], c.c[1] / U + off[1], c.c[2] / U + off[2]], d: [-c.c[0], 0, -c.c[2]].map(v => v / 14000) }));
const house = { kind: 'vrg-house3d', v: 1, name: 'teszt-haz', created: 1, tool: {}, report: { images: 12, registered: 12, points: pts.length / 3, err: 0.5 }, up: [0, 1, 0], pts, rgb, cams, scale: null, measures: [] };
const W = p => [p[0] / U + off[0], p[1] / U + off[1], p[2] / U + off[2]];
const FRONT_L = W([-5000, 0, -4000]), FRONT_R = W([5000, 0, -4000]), SIDE_B = W([5000, 0, 4000]), FRONT_TOP = W([-5000, 6000, -4000]);

(async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('SKIP house3d-browser.test: no browser'); process.exit(0); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'dist', 'vrg-sketcher.html'));
  // dropping the file on the page's Megnyitás opens the viewer
  await page.setInputFiles('#fopen', { name: 'teszt-haz.house3d.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(house)) });
  await page.waitForSelector('.h3 .h3-c', { timeout: 10000 });
  ok(/12 \/ 12/.test(await page.$eval('.h3-side', e => e.textContent)), 'the viewer opens from Megnyitás and shows the report');
  ok(/Még nincs lépték/.test(await page.$eval('.h3-side', e => e.textContent)), 'no scale yet, and it says so');
  // the handle of the open viewer: reopen through the page's hook (the same screen)
  await page.evaluate(h => { document.querySelector('.h3').remove(); window.__h3 = window.__sketcher.house.open(h, 'teszt-haz.house3d.json'); window.__saved = null; }, house);
  const tap = async p => page.evaluate(p => { const s = window.__h3.project(p); window.__h3.tapAt(s[0], s[1]); }, p);
  // 📏 the scale: the front wall's bottom corners, 10 m apart
  await page.click('.h3 [data-h="mode"][data-m="scale"]');
  await tap(FRONT_L); await tap(FRONT_R);
  await page.fill('.h3 [data-h="scalemm"]', '10000');
  await page.click('.h3 [data-h="setscale"]');
  const sc = await page.evaluate(() => window.__h3.house().scale);
  within(sc && sc.mmPerUnit, U, 0.01, 'the scale from the 10 m wall');
  // ↔ the side wall (8 m) and the height (6 m)
  await page.click('.h3 [data-h="mode"][data-m="measure"]');
  await page.evaluate(() => { window.__h3.ui.az = 35; window.__h3.ui.el = 25; window.__h3.draw(); });
  await tap(FRONT_R); await tap(SIDE_B);
  await tap(FRONT_L); await tap(FRONT_TOP);
  const ms = await page.evaluate(() => { const h = window.__h3.house(); return h.measures.map(m => window.VRGHouse3d.mm(h, m.a, m.b)); });
  within(ms[0], 8000, 0.01, 'the side wall');
  within(ms[1], 6000, 0.01, 'the height');
  ok(/8 m|8,0/.test(await page.$eval('.h3-side', e => e.textContent)), 'the side panel lists the measurements');
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'vrg-house3d-view.png') });
  // ⇩ Mentés: the file comes back with the scale and the measurements (the page downloads it)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.click('.h3 [data-h="save"]')]);
  ok(dl && /teszt-haz\.house3d\.json$/.test(dl.suggestedFilename()), 'Mentés downloads <name>.house3d.json');
  if (dl) { const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); ok(saved.scale && saved.measures.length === 2, 'the saved file carries the scale and both measurements'); }
  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
