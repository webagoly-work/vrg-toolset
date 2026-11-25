// F1 (VRG Sketcher Helyszín): Map/lib/site-layer.js in a real browser with the real MapLibre, on a blank style (no map
// data, no network): the outline drawn by taps and corrected by dragging, the satellite layer asked for only after its
// tap, the sketch placed (fit, turned, dragged), the answer to the phone and, embedded, to the Desktop's window.
// Needs Playwright with a Chromium (the cloud sessions have one) and Vendor/maplibre-gl (node tools/fetch-vendor.js
// maplibre-gl); without them it says so and skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), http = require('http');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const ML = path.join(REPO, 'Vendor', 'maplibre-gl', 'dist');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body,#map{margin:0;height:100%}</style></head><body><div id="map"></div><div id="toast"></div>
<script src="/lib/site-math.js"></script><script src="/lib/site-layer.js" defer></script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
const map = new maplibregl.Map({ container: 'map', center: [19.08, 47.515], zoom: 19, fadeDuration: 0,
  style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eeeeee' } }] } });
window.vrgMap = { map, maplibregl };
</script></body></html>`;
const PARENT = `<!doctype html><html><body style="margin:0"><iframe id="f" src="/harness.html" style="width:900px;height:700px;border:0"></iframe>
<script>window.got = []; addEventListener('message', e => { window.got.push(e.data);
  if (e.data && e.data.kind === 'vrg-site-ready') document.getElementById('f').contentWindow.postMessage(window.survey, '*'); });</script></body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const send = (body, t) => { r.writeHead(200, { 'Content-Type': t }); r.end(body); };
    if (u === '/harness.html') return send(HARNESS, 'text/html');
    if (u === '/parent.html') return send(PARENT, 'text/html');
    let f = null;
    if (u.startsWith('/lib/')) f = path.join(MAP, 'lib', path.basename(u));
    if (u.startsWith('/vendor/maplibre-gl/')) f = path.join(ML, path.basename(u));
    if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    send(fs.readFileSync(f), types[path.extname(f)] || 'application/octet-stream');
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}

const ROOMS = [{ name: 'Nappali', poly: [[0, 0], [7, 0], [7, 7.8], [0, 7.8]] }, { name: 'Konyha', poly: [[7, 0], [11.8, 0], [11.8, 7.8], [7, 7.8]] }];

module.exports = async t => {
  let pw = null;
  try { pw = require('playwright'); } catch { /* not installed */ }
  if (!pw || !fs.existsSync(path.join(ML, 'maplibre-gl.mjs'))) { console.log('  skip site-layer: needs Playwright and Vendor/maplibre-gl'); return; }
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [], sat = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith(base)) return r.continue(); if (u.includes('arcgisonline.com')) sat.push(u); return r.abort(); });
    await page.goto(base + '/harness.html');
    await page.waitForFunction(() => window.vrgSite && window.vrgSite.ready, null, { timeout: 30000 });
    const st = () => page.evaluate(() => window.vrgSite.state());
    const px = ll => page.evaluate(([lat, lon]) => { const p = window.vrgMap.map.project([lon, lat]); return { x: p.x, y: p.y }; }, ll);
    const btn = a => page.click(`#site-panel button[data-a="${a}"]`);
    const settle = () => page.waitForTimeout(150);

    await t('opens on a survey with no outline: ▱ Körvonal, a hint, nothing asked of the satellite server', async () => {
      await page.evaluate(rooms => window.vrgSite.open({ id: 'T1', name: 'Teszt', lat: 47.515, lon: 19.08, outline: [], rooms },
        { done: r => { window.__res = r; }, canCenter: true }), ROOMS);
      await settle();
      const s = await st();
      assert.strictEqual(s.mode, 'outline'); assert.strictEqual(s.outline.length, 0);
      assert.match(await page.textContent('#site-panel'), /Koppints az épület sarkaira/);
      assert.strictEqual(sat.length, 0);
    });

    await t('four taps draw the outline; a dragged corner moves; a white midpoint adds a corner', async () => {
      for (const [x, y] of [[300, 200], [600, 200], [600, 420], [300, 420]]) { await page.mouse.click(x, y); await settle(); }
      let s = await st();
      assert.strictEqual(s.outline.length, 4, JSON.stringify(s.outline)); assert.strictEqual(s.src, 'rajz');
      const c0 = await px(s.outline[0]);
      await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await page.mouse.move(c0.x - 15, c0.y - 10, { steps: 4 }); await page.mouse.up(); await settle();
      s = await st();
      assert.strictEqual(s.outline.length, 4, 'a drag is not a new corner');
      const moved = await px(s.outline[0]);
      assert.ok(Math.abs(moved.x - (c0.x - 15)) < 3 && Math.abs(moved.y - (c0.y - 10)) < 3, JSON.stringify(moved));
      const a = await px(s.outline[1]), b = await px(s.outline[2]);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      await page.mouse.move(m.x, m.y); await page.mouse.down(); await page.mouse.move(m.x + 20, m.y, { steps: 4 }); await page.mouse.up(); await settle();
      s = await st();
      assert.strictEqual(s.outline.length, 5, 'the midpoint became a corner');
      // tap a corner: selected; ✕ Sarok deletes it
      const c4 = await px(s.outline[2]); await page.mouse.click(c4.x, c4.y); await settle();
      await btn('del'); await settle();
      assert.strictEqual((await st()).outline.length, 4);
    });

    await t('🛰 asks the satellite tiles only now; an outline traced over it is marked so', async () => {
      assert.strictEqual(sat.length, 0, 'not before the tap');
      await btn('sat'); await page.waitForTimeout(600);
      assert.ok(sat.length > 0, 'tiles requested after the tap'); assert.ok(sat.every(u => u.startsWith('https://server.arcgisonline.com/')));
      assert.match(await page.textContent('#site-panel'), /Esri/);
      await btn('undo'); await settle(); await page.mouse.click(300, 420); await settle();
      assert.strictEqual((await st()).src, 'muhold');
    });

    await t('◫ Vázlat: fitted to the outline; ⟳ 15° turns it and the report says so; ⤢ fits again', async () => {
      await btn('m-place'); await settle();
      let s = await st();
      assert.strictEqual(s.mode, 'place'); assert.ok(s.place && s.place.auto);
      const rot0 = s.place.rot;
      assert.match(await page.textContent('#site-panel'), /Elfordulás: /);
      await btn('r15'); await settle();
      s = await st();
      assert.ok(Math.abs(s.place.rot - (rot0 + 15)) < 1e-6 && !s.place.auto);
      assert.match(await page.textContent('#site-panel'), /kilóg|elfordulnak/);
      await btn('fit'); await settle();
      assert.ok(Math.abs((await st()).place.rot - rot0) < 1e-6);
    });

    await t('the sketch is dragged by its body; ✓ Kész hands back outline, source, placement and the map centre', async () => {
      const s0 = await st();
      const c = await px([s0.place.lat, s0.place.lon]);
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 40, c.y + 25, { steps: 5 }); await page.mouse.up(); await settle();
      const s1 = await st();
      assert.ok(s1.place.lon > s0.place.lon && s1.place.lat < s0.place.lat && !s1.place.auto, 'moved east and south');
      assert.strictEqual(s1.outline.length, s0.outline.length, 'dragging the sketch did not add a corner');
      await btn('center'); await btn('done'); await settle();
      const r = await page.evaluate(() => window.__res);
      assert.strictEqual(r.kind, 'vrg-site-result'); assert.strictEqual(r.v, 1); assert.strictEqual(r.id, 'T1');
      assert.strictEqual(r.outline.length, 4); assert.strictEqual(r.outlineSrc, 'muhold');
      assert.ok(r.place && typeof r.place.rot === 'number' && r.place.auto === false);
      assert.ok(Array.isArray(r.center) && r.center.length === 2);
      assert.strictEqual(await page.$('#site-panel'), null, 'the panel closed');
      assert.strictEqual(await page.evaluate(() => window.vrgMap.map.getLayer('vrg-sat') ? window.vrgMap.map.getLayoutProperty('vrg-sat', 'visibility') : 'none'), 'none', 'satellite off again');
    });

    await t('embedded (the Desktop Sketcher): the survey by postMessage, the answer back to the parent only', async () => {
      const p2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
      p2.on('pageerror', e => errors.push(e.message));
      await p2.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
      await p2.addInitScript(rooms => { window.survey = { kind: 'vrg-site', v: 1, id: 'D1', name: 'Asztal', lat: 47.515, lon: 19.08,
        outline: [[47.51503, 19.07993], [47.51503, 19.08007], [47.51497, 19.08007], [47.51497, 19.07993]], outlineSrc: 'osm', rooms }; }, ROOMS);
      await p2.goto(base + '/parent.html');
      const f = p2.frameLocator('#f');
      await f.locator('#site-panel').waitFor({ timeout: 30000 });
      assert.match(await f.locator('#site-panel').textContent(), /Asztal/);
      await f.locator('#site-panel button[data-a="done"]').click();
      await p2.waitForFunction(() => window.got.some(m => m.kind === 'vrg-site-result'));
      const r = await p2.evaluate(() => window.got.find(m => m.kind === 'vrg-site-result'));
      assert.strictEqual(r.id, 'D1'); assert.strictEqual(r.outlineSrc, 'osm', 'untouched OSM outline stays OSM'); assert.ok(r.place && r.place.auto);
      await p2.close();
    });

    await t('M51: the Sketcher\'s switched-off site features are left out of the panel', async () => {
      await page.evaluate(rooms => window.vrgSite.open({ id: 'T3', name: 'Kapcsolók', lat: 47.515, lon: 19.08, outline: [], rooms, hide: ['satellite', 'outline'] },
        { done: r => { window.__res = r; }, canCenter: true }), ROOMS);
      await settle();
      assert.strictEqual(await page.locator('#site-panel button[data-a="sat"]').count(), 0, '🛰 hidden');
      assert.strictEqual(await page.locator('#site-panel button[data-a="m-outline"]').count(), 0, '▱ hidden');
      assert.strictEqual(await page.locator('#site-panel button[data-a="m-place"]').count(), 1, '◫ stays');
      assert.strictEqual((await st()).mode, 'place');
      await btn('cancel'); await settle();
    });

    await t('no page errors', async () => { assert.deepStrictEqual(errors, []); });
  } finally { await browser.close(); srv.close(); }
};
