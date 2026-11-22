// Sketcher/test/roombox-phone.test.js — the Szobadoboz as the phone runs it (skcam K1b, WP M59).
//
// 1. The asset list: feature-sketch/build.gradle.kts copies exactly lib/roombox.js, roombox-gl.js, roombox-phone.js.
// 2. The phone's input (Sketcher/test/fixtures/roombox-input.json, written by sketch-core RoomBoxTest) through the
//    Desktop's maths: the rooms in mm, the shot that carries its lens (f35 from the in-app camera), the room height.
// 3. In a phone-sized browser (Playwright + WebGL; skipped without Playwright): the page put together the way
//    RoomBoxUi.kt does (the three files inlined, a VRGBox bridge), with photos ray-cast from the photo point
//    (test/raycast.js): standing at the point with each photo's own field of view, the view must be the photo again;
//    then a correction and ✓ Kész must hand the `box` key back through the bridge.
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const RB = require(path.join(ROOT, 'lib', 'roombox.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const ASSETS = ['roombox.js', 'roombox-gl.js', 'roombox-phone.js'];

// ---- 1. the asset list in the Gradle build
{
  const g = fs.readFileSync(path.join(ROOT, '..', 'Mobile', 'android', 'feature-sketch', 'build.gradle.kts'), 'utf8');
  const m = /val ROOMBOX_ASSETS = listOf\(([^)]*)\)/.exec(g);
  ok(m, 'build.gradle.kts declares ROOMBOX_ASSETS');
  ok(m && JSON.stringify(m[1].split(',').map(s => s.trim().replace(/"/g, ''))) === JSON.stringify(ASSETS), 'ROOMBOX_ASSETS = ' + ASSETS.join(', ') + (m ? ' (got ' + m[1] + ')' : ''));
  ASSETS.forEach(a => ok(fs.existsSync(path.join(ROOT, 'lib', a)), 'lib/' + a + ' exists'));
  const ui = fs.readFileSync(path.join(ROOT, '..', 'Mobile', 'android', 'feature-sketch', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'sketch', 'ui', 'RoomBoxUi.kt'), 'utf8');
  ok(ASSETS.every(a => ui.includes('"' + a + '"')), 'RoomBoxUi.kt loads the same three files');
}

// ---- 2. the phone's input through the Desktop's maths
const inp = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'roombox-input.json'), 'utf8')).input;
{
  const sc = RB.scene(inp.plan, inp.box, () => null, inp.level);
  ok(sc.length === inp.plan.data.floors.length, 'one box per room the phone solved');
  const k = sc.find(r => r.id === 'R1');
  ok(k && k.h === 2650, 'the corrections the phone keeps are applied (h)');
  const n = k && k.shots.find(s => s.deg === 0), d = k && k.shots.find(s => s.deg === 180);
  ok(n && n.f35 === 13 && n.f35src === 'lencse', 'the shot with a stored lens uses it (lencse): ' + (n && n.f35 + ' ' + n.f35src));
  ok(d && d.f35 === 26 && d.f35src === 'alap', 'a shot without one falls back to the main lens');
  const typed = RB.scene(inp.plan, { shots: { [n.key]: { f35: 15 } } }, () => null, inp.level).find(r => r.id === 'R1').shots.find(s => s.deg === 0);
  ok(typed.f35 === 15 && typed.f35src === 'kezi', 'a typed field of view still beats the lens');
  ok(Object.keys(inp.images).length === sc.reduce((a, r) => a + r.shots.length, 0), 'an image for every shot');
}

// ---- 3. in a phone-sized browser
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP roombox-phone browser part: playwright not installed'); return done(); }
(async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('SKIP roombox-phone browser part: no browser'); return done(); }
  const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // the page as RoomBoxUi.kt builds it: the three files inlined, then run()
  const scripts = ASSETS.map(a => '<script>\n' + fs.readFileSync(path.join(ROOT, 'lib', a), 'utf8') + '\n</script>').join('\n');
  const raycast = '<script>\n' + fs.readFileSync(path.join(ROOT, 'test', 'raycast.js'), 'utf8') + '\n</script>';
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + raycast + scripts + '</body></html>');
  // the photos: ray-cast from the phone's photo point with each shot's own lens, as JPEGs under their board names
  await page.evaluate(async (inp) => {
    const room = window.VRGRoomBox.scene(inp.plan, inp.box, () => null, inp.level).find(r => r.id === 'R1');
    for (const s of room.shots) {
      const cv = window.VRGRaycast.photo(room, s.plan, s.deg, s.f35, 800, 600, room.eye);
      inp.images[s.file] = cv.toDataURL('image/jpeg', 0.92);
    }
    window.__saved = null; window.__closed = false;
    window.VRGBox = { input: () => JSON.stringify(inp), save: j => { window.__saved = j; }, close: () => { window.__closed = true; } };
    window.__app = window.VRGRoomBoxPhone.run();
  }, inp);
  await page.waitForFunction(() => document.body.dataset.drawn === '2', null, { timeout: 15000 });
  ok(true, 'the box draws both photos as textures');
  ok(await page.$eval('#rbroom', s => s.value) === 'R1', 'the first room with photos is chosen');
  ok(/fal képpel/.test(await page.$eval('#rbkv', e => e.textContent)), 'the sheet shows the room');
  ok(/a kamerától/.test(await page.$eval('#rbbody', e => e.textContent)), 'the stored lens is named as the field of view\'s source');
  if (process.argv.includes('--shots')) await page.screenshot({ path: process.argv[process.argv.indexOf('--shots') + 1] + '/roombox-phone.png' });

  for (const deg of [0, 180]) {
    const m = await page.evaluate(async (deg) => {
      const app = window.__app, c = document.getElementById('rbc');
      c.style.flex = 'none'; c.style.width = '400px'; c.style.height = '300px';
      const s = app.scene().find(r => r.id === 'R1').shots.find(x => x.deg === deg);
      app.ui.mode = 'stand'; app.ui.point = s.point; app.ui.yaw = s.yaw; app.ui.pitch = 0; app.ui.fov = s.fovV;
      app.draw();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return window.VRGRaycast.compare(c, app.images(s.file));
    }, deg);
    ok(m.mean < 18 && m.bad < 0.06, 'standing at the point, ' + deg + '°: the view is the photo again (mean ' + m.mean.toFixed(1) + ', off ' + (m.bad * 100).toFixed(1) + '%)');
  }

  // a touch drag rotates the dollhouse; then corrections, and ✓ Kész hands the box key back
  await page.evaluate(() => { const app = window.__app, c = document.getElementById('rbc'); c.style.flex = ''; c.style.width = ''; c.style.height = ''; app.ui.mode = 'orbit'; app.draw(); });
  const az0 = await page.evaluate(() => window.__app.ui.az);
  const bb = await page.$eval('#rbc', c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('rbc'), ev = (t, X) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: X, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', x); ev('pointermove', x + 60); ev('pointerup', x + 60);
  }, bb);
  ok(await page.evaluate(() => window.__app.ui.az) !== az0, 'a one-finger drag rotates the view');
  await page.evaluate(() => {
    const h = document.querySelector('[data-b="h"]'); h.value = '255'; h.dispatchEvent(new Event('change', { bubbles: true }));
    const y = document.querySelector('[data-b="yaw"]'); y.value = '2.5'; y.dispatchEvent(new Event('input', { bubbles: true })); y.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('[data-a="save"]');
  const saved = await page.evaluate(() => window.__saved && JSON.parse(window.__saved));
  ok(saved && saved.h && saved.h.R1 === 2550, 'Kész hands back the room height: ' + JSON.stringify(saved));
  ok(saved && saved.shots && Object.values(saved.shots).some(x => x.yaw === 2.5), 'and the direction correction');
  await page.click('[data-a="close"]');
  ok(await page.evaluate(() => window.__closed), '✕ leaves through the bridge');
  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.log('FAIL: ' + e.message); fail++; done(); });

function done() {
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
}
