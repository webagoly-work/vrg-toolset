// The Épületmagasság layer (lib/heights-layer.js, B) in headless Chromium with the real MapLibre: an invented heights
// file (made here with lib/heights.js) served as /data/bp-heights.bin. The B button wakes up only when the file is
// there; on, the measured buildings stand in 3D and the basemap's OSM buildings step aside inside the file's area;
// a click tells the height; the Árnyék layer then casts the measured buildings' shadows. Needs Playwright and
// Vendor/maplibre-gl; without them it says so and skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../lib/heights.js');

const MAP = path.resolve(__dirname, '..');
const ML = path.join(MAP, '..', 'Vendor', 'maplibre-gl', 'dist');
const C = [19.05, 47.5], d = 0.00025;
const sq = (x, y) => [[C[0] + x * d, C[1] + y * d], [C[0] + (x + 1) * d, C[1] + y * d], [C[0] + (x + 1) * d, C[1] + (y + 1) * d], [C[0] + x * d, C[1] + (y + 1) * d], [C[0] + x * d, C[1] + y * d]];
const FILE = H.encode([{ h: 48, rings: [sq(0, 0)] }, { h: 12.5, rings: [sq(3, 0)] }, { h: 30, rings: [sq(0, 3)] }], { source: 'teszt-atlasz' });

const HARNESS = (withFile) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body{margin:0;height:100%} #map{position:absolute;inset:0}</style>
</head><body><div id="map"></div><button id="b-heights">B</button><button id="b-sun">S</button><section id="sun-panel" hidden></section>
<script src="/lib/sun.js"></script><script src="/lib/heights.js"></script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
import { initHeights } from '/lib/heights-layer.js';
import { initShadows } from '/lib/shadow-layer.js';
const C = [${C}], d = ${d};
const style = { version: 8, sources: { protomaps: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f0ece2' } },
           { id: 'buildings-3d', type: 'fill-extrusion', source: 'protomaps', paint: { 'fill-extrusion-color': '#d2c4b0', 'fill-extrusion-height': 7 } }] };
const map = new maplibregl.Map({ container: 'map', style, center: [C[0] + 2 * d, C[1] + 2 * d], zoom: 17, canvasContextAttributes: { preserveDrawingBuffer: true } });
const mem = {}, toasts = [];
const store = { get: (k, v) => (k in mem ? mem[k] : v), set: (k, v) => { mem[k] = v; } };
map.once('load', () => {
  window.heights = initHeights({ map, store, toast: m => toasts.push(m), url: '${withFile ? '/data/bp-heights.bin' : '/data/none.bin'}' });
  window.shadows = initShadows({ map, params: new URLSearchParams(), store, toast: () => {} });
  window.ready = true;
});
window.map = map; window.toasts = toasts;
</script></body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/harness.html' || u === '/nofile.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HARNESS(u === '/harness.html')); return; }
    if (u === '/data/bp-heights.bin') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': FILE.length }); res.end(req.method === 'HEAD' ? undefined : Buffer.from(FILE)); return; }
    let f = null;
    if (u.startsWith('/vendor/maplibre-gl/')) f = path.join(ML, path.basename(u));
    else if (u.startsWith('/lib/')) f = path.join(MAP, 'lib', path.basename(u));
    if (!f || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

module.exports = async t => {
  let pw = null;
  try { pw = require('playwright'); } catch { /* not installed here */ }
  if (!pw || !fs.existsSync(path.join(ML, 'maplibre-gl.mjs'))) { console.log('  skip (needs Playwright and Vendor/maplibre-gl: node tools/fetch-vendor.js maplibre-gl)'); return; }
  const srv = await serve();
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 600 }, timezoneId: 'Europe/Budapest' });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const press = sel => page.evaluate(s => document.querySelector(s).click(), sel);

    await t('without the file the B button stays greyed and says how to make it', async () => {
      await page.goto(base + '/nofile.html');
      await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
      await page.waitForTimeout(300);
      assert.ok(await page.evaluate(() => document.querySelector('#b-heights').disabled));
      assert.ok(/build-bp-heights/.test(await page.getAttribute('#b-heights', 'title')));
    });

    await t('B on: the measured buildings in 3D, the OSM ones aside', async () => {
      await page.goto(base + '/harness.html');
      await page.waitForFunction(() => window.ready && !document.querySelector('#b-heights').disabled, null, { timeout: 30000 });
      await press('#b-heights');
      await page.waitForFunction(() => window.heights.count === 3, null, { timeout: 10000 });
      assert.ok(await page.evaluate(() => !!window.map.getLayer('bp-heights-3d')));
      assert.strictEqual(await page.evaluate(() => window.map.getLayoutProperty('buildings-3d', 'visibility')), 'none');
      assert.strictEqual(await page.evaluate(() => window.heights.set().meta.source), 'teszt-atlasz');
    });

    await t('the shadows come from the measured buildings', async () => {
      await page.evaluate(() => { window.shadows.toggle(true); window.shadows.set(new Date(2026, 11, 21, 13, 0)); });
      await page.waitForFunction(() => window.shadows.count === 3, null, { timeout: 10000 });
      assert.strictEqual(await page.evaluate(() => window.shadows.measured), true);
      assert.ok(/mérésből/.test(await page.textContent('#sun-panel')));
    });

    await t('a click tells the height', async () => {
      await page.evaluate(() => { const p = window.map.project([19.05 + 0.000125, 47.5 + 0.000125]); window.map.fire('click', { point: p, lngLat: window.map.unproject(p), originalEvent: {} }); });
      await page.waitForTimeout(300);
      const t2 = await page.evaluate(() => window.toasts.join(' | '));
      assert.ok(/48 m/.test(t2) && /teszt-atlasz/.test(t2), 'the height and its source: ' + t2);
    });

    await t('B off: the OSM buildings come back', async () => {
      await press('#b-heights');
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => !window.map.getLayer('bp-heights-3d')));
      assert.strictEqual(await page.evaluate(() => window.map.getLayoutProperty('buildings-3d', 'visibility')), 'visible');
    });

    await t('no page errors', async () => { assert.deepStrictEqual(errors, []); });
  } finally {
    await browser.close();
    srv.close();
  }
};
