// Sketcher/test/roombox-browser.test.js — the Szobadoboz in a real browser (Playwright + WebGL), dev line skcam K1.
// It photographs a known room with a small ray caster (independent of lib/roombox.js), attaches the "photos" to the
// end-to-end package, opens the 3D box and checks that standing at the photo point shows the same picture: the
// projection is right when the 3D view and the photo agree pixel by pixel. Skips when Playwright is not installed.
//   node Sketcher/test/roombox-browser.test.js [--shots <dir>]   (--shots: also writes the views as PNG)
'use strict';
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP roombox-browser.test: playwright not installed'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'e2e', 'a-lakas-felujitas.json'), 'utf8')).package;
const outDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

(async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('SKIP roombox-browser.test: no browser (' + String(e.message).split('\n')[0] + ')'); process.exit(0); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'dist', 'vrg-sketcher.html'));
  await page.evaluate(p => window.__sketcher.load({ kind: p.kind, ...p }), pkg);

  // the ground truth: each wall its own colour with 50 cm stripes, a band at 1 m, a checker floor, a pale ceiling
  const made = await page.evaluate(async () => {
    const sk = window.__sketcher, RB = window.VRGRoomBox, room = sk.box.scene().find(r => r.id === 'R1');
    const W = 800, H = 600, out = [];
    const hues = [[220, 70, 60], [60, 160, 220], [90, 190, 90], [230, 190, 60], [170, 90, 200], [60, 200, 190]];
    for (const s of room.shots) {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H);
      const fv = RB.fov(26, W, H), y = s.deg * Math.PI / 180, fw = [Math.sin(y), 0, -Math.cos(y)], rt = [Math.cos(y), 0, Math.sin(y)], up = [0, 1, 0];
      const C = [s.plan[0], 1400, s.plan[1]];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const qx = (2 * (i + 0.5) / W - 1) * fv.tanH, qy = (1 - 2 * (j + 0.5) / H) * fv.tanV;
        const d = [fw[0] + rt[0] * qx + up[0] * qy, fw[1] + rt[1] * qx + up[1] * qy, fw[2] + rt[2] * qx + up[2] * qy];
        let best = Infinity, col = [0, 0, 0];
        room.walls.forEach((w, wi) => {                       // ray against each wall (a vertical plane segment)
          const ex = w.b[0] - w.a[0], ez = w.b[1] - w.a[1], den = d[0] * ez - d[2] * ex; if (Math.abs(den) < 1e-9) return;
          const t = ((w.a[0] - C[0]) * ez - (w.a[1] - C[2]) * ex) / den, u = ((w.a[0] - C[0]) * d[2] - (w.a[1] - C[2]) * d[0]) / den;
          const hy = C[1] + d[1] * t; if (t <= 0 || u < 0 || u > 1 || hy < 0 || hy > room.h || t >= best) return;
          best = t; const along = u * w.len, hue = hues[wi % hues.length], stripe = Math.floor(along / 500) % 2, band = Math.abs(hy - 1000) < 40;
          col = band ? [20, 20, 20] : hue.map(v => stripe ? v : v * 0.55);
        });
        if (d[1] < 0) { const t = -C[1] / d[1]; if (t < best) { best = t; const x = C[0] + d[0] * t, z = C[2] + d[2] * t; col = (Math.floor(x / 300) + Math.floor(z / 300)) % 2 ? [200, 200, 200] : [70, 70, 70]; } }
        if (d[1] > 0) { const t = (room.h - C[1]) / d[1]; if (t < best) { best = t; col = [240, 236, 220]; } }
        const k = (j * W + i) * 4; im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      out.push(new File([blob], s.file.split(/[\\/]/).pop(), { type: 'image/jpeg' }));
    }
    sk.front('vazlat');
    sk.box.attach(out);
    return { n: out.length, names: out.map(f => f.name), fovV: RB.fov(26, W, H).v };
  });
  ok(made.n === 2, 'two photos made for the kitchen');
  await page.waitForFunction(() => document.querySelector('.box-card') && /2 csatolva/.test(document.querySelector('.box-card').textContent), null, { timeout: 15000 });
  ok(true, 'the Vázlat card counts the attached photos');
  await page.click('[data-bact="open"]');
  await page.waitForFunction(() => { const b = document.getElementById('box3d'); return b && !b.hidden && b.dataset.drawn === '2'; }, null, { timeout: 15000 });
  ok(true, 'the box opens with both photos as textures');
  ok(await page.$eval('#bxroom', s => s.value) === 'R1', 'the first room with photos is chosen');
  ok(/Falak képpel/.test(await page.$eval('#bxside', s => s.textContent)), 'the side panel lists the room');
  if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await page.screenshot({ path: path.join(outDir, 'roombox-orbit.png') }); }

  // stand at the photo point, look where each photo looked, with the photo's own field of view: the 3D view must show
  // the photo again (the page keeps the upright photo canvases)
  for (const deg of [0, 180]) {
    const m = await page.evaluate(async ({ deg, fovV }) => {
      const sk = window.__sketcher, ui = sk.box.ui, c = document.getElementById('bxc');
      c.style.flex = 'none'; c.style.width = '800px'; c.style.height = '600px';
      const s = sk.box.scene().find(r => r.id === 'R1').shots.find(x => x.deg === deg);
      ui.mode = 'stand'; ui.point = s.point; ui.yaw = s.yaw; ui.pitch = 0; ui.fov = fovV; window.dispatchEvent(new Event('resize'));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const a = document.createElement('canvas'); a.width = 80; a.height = 60; a.getContext('2d').drawImage(c, 0, 0, 80, 60);
      const photo = sk.box.image(s.file); if (!photo) return { err: 'no photo canvas' };
      const b = document.createElement('canvas'); b.width = 80; b.height = 60; b.getContext('2d').drawImage(photo, 0, 0, 80, 60);
      const A = a.getContext('2d').getImageData(0, 0, 80, 60).data, B = b.getContext('2d').getImageData(0, 0, 80, 60).data;
      let sum = 0, n = 0, bad = 0;
      for (let k = 0; k < A.length; k += 4) { const e = (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2])) / 3; sum += e; n++; if (e > 60) bad++; }
      return { mean: sum / n, bad: bad / n };
    }, { deg, fovV: made.fovV });
    ok(!m.err, m.err || 'photo canvas kept');
    ok(m.mean < 18 && m.bad < 0.06, 'standing at the point, ' + deg + '°: the 3D view matches the photo (mean ' + (m.mean || 0).toFixed(1) + ', off ' + ((m.bad || 0) * 100).toFixed(1) + '%)');
    if (outDir) await page.screenshot({ path: path.join(outDir, 'roombox-stand-' + deg + '.png') });
  }
  // a correction is saved in the survey's box key and survives a save
  await page.evaluate(() => { const i = document.querySelector('[data-b="yaw"]'); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  const box = await page.evaluate(() => JSON.parse(window.__sketcher.save()).sketch.box);
  ok(box && box.shots && Object.values(box.shots).some(x => x.yaw === 3), 'the yaw correction is in the saved survey: ' + JSON.stringify(box));
  await page.click('[data-bact="close"]');
  ok(await page.$eval('#box3d', b => b.hidden), 'the box closes');
  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
