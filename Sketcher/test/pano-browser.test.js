// Sketcher/test/pano-browser.test.js — the Körkép in a real browser (skcam K4), on the Desktop page and on the phone's
// Szobadoboz page. Four 0.5× photos of the end-to-end kitchen are ray-cast from its photo point (test/raycast.js), three
// of them a little off from the side the survey says. ⟲ Igazítás must find those errors and write them into the survey's
// box key; ⇩ 360° kép must make a 2:1 JPEG that carries the GPano XMP (on the phone, handed to the VRGBox bridge).
// Skips when Playwright is not installed.
'use strict';
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP pano-browser.test: playwright not installed'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, e, m) => ok(a != null && Math.abs(a - b) <= e, m + ' (got ' + a + ', want ' + b + ' ± ' + e + ')');
const TRUE = { 0: [0, 0], 90: [93, 0], 180: [178, 2], 270: [271.5, 0] };     // the survey says 0 / 90 / 180 / 270, level

// the package with four 0.5× shots at F25 (their lens stored, as the phone's camera does since K1b)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'e2e', 'a-lakas-felujitas.json'), 'utf8')).package;
const f25 = pkg.plan.photos.find(p => p.id === 'F25');
f25.shots = [0, 90, 180, 270].map(d => ({ deg: d, side: '', file: 'F25_' + d + '.jpg', f35: 13 }));
const RAY = fs.readFileSync(path.join(ROOT, 'test', 'raycast.js'), 'utf8');

// in the page: the four photos as JPEG files, ray-cast with their true poses
const MAKE = async (TRUE) => {
  const RB = window.VRGRoomBox, room = window.__room();
  const files = [];
  for (const s of room.shots) {
    const t = TRUE[s.deg], cv = window.VRGRaycast.photo(room, s.plan, t[0], 13, 800, 600, room.eye, t[1]);
    files.push({ name: s.file, url: cv.toDataURL('image/jpeg', 0.92), blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92)) });
  }
  return files;
};

(async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('SKIP pano-browser.test: no browser'); process.exit(0); }

  // ---- the Desktop page
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'dist', 'vrg-sketcher.html'));
    await page.addScriptTag({ content: RAY });
    await page.evaluate(p => window.__sketcher.load(p), pkg);
    await page.evaluate(() => { window.__room = () => window.__sketcher.box.scene().find(r => r.id === 'R1'); });
    await page.evaluate('(' + MAKE.toString() + ')(' + JSON.stringify(TRUE) + ').then(files => { window.__sketcher.front("vazlat"); window.__sketcher.box.attach(files.map(f => new File([f.blob], f.name, { type: "image/jpeg" }))); })');
    await page.waitForFunction(() => /4 csatolva/.test((document.querySelector('.box-card') || {}).textContent || ''), null, { timeout: 20000 });
    await page.click('[data-bact="open"]');
    await page.waitForSelector('[data-bact="align"][data-p="F25"]', { timeout: 15000 });
    ok(await page.$('[data-bact="pano"][data-p="F25"]'), 'Desktop: the Körkép buttons are in the Szobadoboz panel');
    await page.click('[data-bact="align"][data-p="F25"]');
    await page.waitForFunction(() => /Igazítva|átfedés/.test(document.getElementById('bxside').textContent), null, { timeout: 20000 });
    const box = await page.evaluate(() => window.__sketcher.state().box);
    const sh = k => (box && box.shots && box.shots['F25/' + k]) || {};
    ok(/Igazítva \(4\/4 pár, körbe zárva\)/.test(await page.$eval('#bxside', e => e.textContent)), 'Desktop: all four pairs aligned, the ring closed');
    near(sh(90).yaw || 0, 3, 0.4, 'Desktop: K turned +3°'); near(sh(180).yaw || 0, -2, 0.4, 'Desktop: D turned −2°');
    near(sh(180).pitch || 0, 2, 0.4, 'Desktop: D tilted +2°'); near(sh(270).yaw || 0, 1.5, 0.4, 'Desktop: Ny turned +1.5°');
    await page.click('[data-bact="pano"][data-p="F25"]');
    await page.waitForFunction(() => window.__sketcher.box.ui.lastPano, null, { timeout: 60000 });
    const lp = await page.evaluate(() => window.__sketcher.box.ui.lastPano);
    ok(lp && /_F25_360\.jpg$/.test(lp.name) && lp.bytes > 100000 && lp.covered > 0.4, 'Desktop: a 360° JPEG was made: ' + JSON.stringify(lp));
    ok(!errors.length, 'Desktop: no page errors: ' + errors.join(' | '));
    await page.close();
  }

  // ---- the phone's Szobadoboz page (the four files as RoomBoxUi.kt puts them together), the VRGBox bridge
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const scripts = ['roombox.js', 'roombox-gl.js', 'pano.js', 'roombox-phone.js'].map(a => '<script>\n' + fs.readFileSync(path.join(ROOT, 'lib', a), 'utf8') + '\n</script>').join('\n');
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><script>' + RAY + '</script>' + scripts + '</body></html>');
    const inp = { name: 'Petőfi u. 7', plan: { data: { floors: pkg.plan.data.floors }, photos: pkg.plan.photos }, box: {}, level: { heightMm: 2700 }, images: {}, pano: true };
    await page.evaluate(async ([inp, MAKE, TRUE]) => {
      window.__room = () => window.VRGRoomBox.scene(inp.plan, inp.box, () => null, inp.level).find(r => r.id === 'R1');
      const files = await (eval('(' + MAKE + ')'))(TRUE);
      files.forEach(f => { inp.images[f.name] = f.url; });
      window.__panos = [];
      window.VRGBox = { input: () => JSON.stringify(inp), save: j => { window.__saved = j; }, close: () => {}, pano: (n, b) => window.__panos.push([n, b]) };
      window.__app = window.VRGRoomBoxPhone.run();
    }, [inp, MAKE.toString(), TRUE]);
    await page.waitForFunction(() => document.body.dataset.drawn === '4', null, { timeout: 20000 });
    ok(await page.$('[data-a="align"][data-p="F25"]'), 'phone: the Körkép buttons are in the sheet');
    await page.click('[data-a="align"][data-p="F25"]');
    const b = await page.evaluate(() => window.__app.box());
    near((b.shots['F25/90'] || {}).yaw || 0, 3, 0.4, 'phone: K turned +3°'); near((b.shots['F25/180'] || {}).pitch || 0, 2, 0.4, 'phone: D tilted +2°');
    await page.click('[data-a="pano"][data-p="F25"]');
    await page.waitForFunction(() => window.__panos.length > 0, null, { timeout: 60000 });
    const got = await page.evaluate(() => { const [n, b64] = window.__panos[0], bin = atob(b64); return { n, len: bin.length, soi: bin.charCodeAt(0) === 0xFF && bin.charCodeAt(1) === 0xD8, xmp: bin.slice(0, 2000).includes('GPano:ProjectionType="equirectangular"') }; });
    ok(got.soi && got.xmp && /_F25_360\.jpg$/.test(got.n) && got.len > 100000, 'phone: the 360° JPEG with its GPano XMP went to the bridge: ' + JSON.stringify(got));
    await page.click('[data-a="save"]');
    const saved = await page.evaluate(() => JSON.parse(window.__saved || '{}'));
    ok(saved.shots && saved.shots['F25/90'] && Math.abs(saved.shots['F25/90'].yaw - 3) < 0.4, 'phone: ✓ Kész hands the aligned corrections back');
    ok(!errors.length, 'phone: no page errors: ' + errors.join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
