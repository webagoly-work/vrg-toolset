// Sketcher/test/plane-browser.test.js — the Síkmérés screen in a real browser (skcam K3), on the Desktop page and on
// the phone's page. A wall is "photographed" at an angle (a pinhole camera, independent of lib/plane.js): an A4 sheet
// taped up, a socket box 30 cm and a switch 110 cm above the floor. The test taps the sheet's corners, the floor line
// and the boxes through the screen, and the heights and the distance must come out true within 1 %.
// Skips when Playwright is not installed.   node Sketcher/test/plane-browser.test.js [--shots <dir>]
'use strict';
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP plane-browser.test: playwright not installed'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'e2e', 'a-lakas-felujitas.json'), 'utf8')).package;
const outDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const within = (a, b, rel, m) => ok(a != null && Math.abs(a - b) <= b * rel, m + ' (got ' + a + ' mm, want ' + b + ' ± ' + (rel * 100) + ' %)');

// the scene, in wall mm (x right, y DOWN from the top of a 2600 mm wall; the floor is y = 2600)
const SCENE = { a4: [[1000, 900], [1210, 900], [1210, 1197], [1000, 1197]], socket: [1800, 2300], sw: [700, 1500], floor: [[1300, 2600], [2600, 2600]] };   // both inside the photo
// painted into the page: the camera maps wall → photo (u, v in 0…1); the photo is made by inverting it per pixel
const PAINT = `
window.__wall = (function () {
  const W = 1600, H = 1200, ASPECT = W / H, yaw = 22 * Math.PI / 180, dist = 2600, eye = 1350, x0 = 1500;
  const f = 1 / (2 * Math.tan(33 * Math.PI / 180));
  const cam = p => { const X = p[0] - x0, Y = eye - p[1], Z = dist, cx = X * Math.cos(yaw) - Z * Math.sin(yaw), cz = X * Math.sin(yaw) + Z * Math.cos(yaw);
    return [0.5 + (f * cx / cz) / ASPECT, 0.5 - f * Y / cz]; };
  // pixel → wall: intersect the pixel's ray with the wall plane
  const back = (u, v) => { const cx = (u - 0.5) * ASPECT / f, cy = (0.5 - v) / f;     // direction (cx, cy, 1) in camera space
    const dx = cx * Math.cos(yaw) + Math.sin(yaw), dz = -cx * Math.sin(yaw) + Math.cos(yaw);   // to wall space (z toward the wall)
    const t = dist / dz; return t > 0 ? [x0 + dx * t, eye - cy * t] : null; };
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), im = g.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = back((i + 0.5) / W, (j + 0.5) / H); let col = [10, 10, 10];
    if (p) {
      const [x, y] = p;
      col = y > 2600 ? ((Math.floor(x / 300) + Math.floor(y / 300)) % 2 ? [120, 110, 100] : [90, 80, 72]) : [214, 204, 186];
      if (x >= 1000 && x <= 1210 && y >= 900 && y <= 1197) col = (x < 1004 || x > 1206 || y < 904 || y > 1193) ? [20, 20, 20] : [250, 250, 250];
      if (Math.abs(x - 1800) < 40 && Math.abs(y - 2300) < 40) col = [30, 60, 160];
      if (Math.abs(x - 700) < 40 && Math.abs(y - 1500) < 40) col = [160, 40, 30];
    }
    const k = (j * W + i) * 4; im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return { canvas: c, cam, W, H };
})();`;

async function measureOn(page, label) {
  // ① the sheet's corners (in a scrambled order), ② the floor line, ④ the two boxes, ③ the distance between them
  const r = await page.evaluate(async (S) => {
    const pl = window.__plane, cam = window.__wall.cam, tap = p => { const q = cam(p); pl.tapAt(q[0], q[1]); };
    [S.a4[2], S.a4[0], S.a4[3], S.a4[1]].forEach(tap);
    pl.el.querySelector('[data-s="floor"]').click(); S.floor.forEach(tap);
    pl.el.querySelector('[data-s="height"]').click(); tap(S.socket); tap(S.sw);
    pl.el.querySelector('[data-s="dist"]').click(); tap(S.socket); tap(S.sw);
    const rec = pl.record();
    return { marks: rec.marks.map(m => m.mm), lines: rec.lines.map(l => l.mm), sheet: pl.el.querySelector('.pl-sheet').textContent };
  }, SCENE);
  within(r.marks[0], 300, 0.01, label + ': the socket box 30 cm up');
  within(r.marks[1], 1100, 0.01, label + ': the switch 110 cm up');
  within(r.lines[0], Math.round(Math.hypot(1100, 800)), 0.01, label + ': socket to switch');
  ok(/jó|közepes/.test(r.sheet), label + ': the reach grade is shown');
  return r;
}

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.log('SKIP plane-browser.test: no browser'); process.exit(0); }
  // ---- the Desktop page: the photo attached under a capture's name, 📏 Mérés on its card
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'dist', 'vrg-sketcher.html'));
    await page.evaluate(p => window.__sketcher.load(p), pkg);
    await page.evaluate(PAINT);
    await page.evaluate(async () => {
      const blob = await new Promise(r => window.__wall.canvas.toBlob(r, 'image/jpeg', 0.92));
      window.__sketcher.front('kamera');
      window.__sketcher.box.attach([new File([blob], 'C-eloszto.jpg', { type: 'image/jpeg' })]);
    });
    await page.waitForSelector('#main [data-pact="open"][data-key="C30"]', { timeout: 15000 });
    ok(true, 'Desktop: the C30 card offers 📏 Mérés once its photo is attached');
    await page.click('#main [data-pact="open"][data-key="C30"]');
    await page.waitForSelector('.pl .pl-c');
    await page.evaluate(() => { const el = document.querySelector('.pl'); window.__plane = null;
      // the open screen's handle: reopen through the hook to get it (the click opened the same screen)
      el.remove(); });
    await page.evaluate(() => { const S = window.__sketcher; const im = S.box.image('C-eloszto.jpg');
      window.__plane = window.VRGPlaneUI.open(document.getElementById('root'), { image: im, title: 'teszt', record: null,
        onSave: rec => { window.__savedRec = rec; } }); });
    await measureOn(page, 'Desktop');
    if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await page.screenshot({ path: path.join(outDir, 'plane-desktop.png') }); }
    // the real path: the card's button → Mentés → the survey's planes key and the card's summary
    await page.evaluate(() => window.__plane.close());
    await page.click('#main [data-pact="open"][data-key="C30"]');
    await page.evaluate(async (S) => {
      const el = document.querySelector('.pl'), cv = el.querySelector('.pl-c'), cam = window.__wall.cam;
      // drive it with real pointer events this time: the four corners
      const im = window.__sketcher.box.image('C-eloszto.jpg'), r = cv.getBoundingClientRect();
      const s = Math.min(r.width / im.width, r.height / im.height) * 0.98, ox = (r.width - im.width * s) / 2, oy = (r.height - im.height * s) / 2;
      const at = p => { const q = cam(p); return [r.left + ox + q[0] * im.width * s, r.top + oy + q[1] * im.height * s]; };
      const tapEv = (x, y) => ['pointerdown', 'pointerup'].forEach(t => cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: x, clientY: y, bubbles: true })));
      S.a4.forEach(p => tapEv(...at(p)));
      el.querySelector('[data-s="floor"]').click(); S.floor.forEach(p => tapEv(...at(p)));
      el.querySelector('[data-s="height"]').click(); tapEv(...at(S.socket));
      el.querySelector('[data-p="save"]').click();
    }, SCENE);
    const saved = await page.evaluate(() => window.__sketcher.state().planes);
    ok(saved && saved.C30 && saved.C30.ref.pts.length === 4 && saved.C30.marks.length === 1, 'Desktop: Mentés writes the planes key: ' + JSON.stringify(saved && saved.C30 && saved.C30.marks));
    within(saved && saved.C30 && saved.C30.marks[0].mm, 300, 0.015, 'Desktop: real pointer taps (screen-pixel rounding) still measure the socket');
    ok(/Magasság 1: \d+ mm/.test(await page.$eval('#main [data-cap="C30"]', e => e.textContent)), 'Desktop: the card shows the result');
    const file = await page.evaluate(() => JSON.parse(window.__sketcher.save()).sketch.planes);
    ok(file && file.C30, 'Desktop: the saved survey carries it');
    ok(!errors.length, 'Desktop: no page errors: ' + errors.join(' | '));
    await page.close();
  }
  // ---- the phone's page: plane.js + plane-ui.js + run(), the photo as a data: URL through VRGPlaneIO
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const scripts = ['plane.js', 'plane-ui.js'].map(a => '<script>\n' + fs.readFileSync(path.join(ROOT, 'lib', a), 'utf8') + '\n</script>').join('\n');
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + scripts + '</body></html>');
    await page.evaluate(PAINT);
    await page.evaluate(() => {
      const url = window.__wall.canvas.toDataURL('image/jpeg', 0.92);
      window.__out = null; window.__closed = false;
      window.VRGPlaneIO = { input: () => JSON.stringify({ image: url, title: 'Elosztó · C30', record: null }), save: j => { window.__out = j; }, close: () => { window.__closed = true; }, fail: m => { window.__fail = m; } };
      window.VRGPlaneUI.run();
    });
    await page.waitForFunction(() => window.__plane || window.__fail, null, { timeout: 15000 });
    ok(!(await page.evaluate(() => window.__fail)), 'phone: the screen opens from the bridge');
    await measureOn(page, 'phone');
    if (outDir) await page.screenshot({ path: path.join(outDir, 'plane-phone.png') });
    await page.click('[data-p="save"]');
    const out = await page.evaluate(() => window.__out && JSON.parse(window.__out));
    ok(out && out.marks.length === 2 && out.lines.length === 1 && out.ref.kind === 'a4', 'phone: ✓ Mentés hands the record back through the bridge');
    ok(!errors.length, 'phone: no page errors: ' + errors.join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
