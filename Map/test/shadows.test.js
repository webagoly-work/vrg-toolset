// The Árnyék layer (lib/shadow-layer.js) in headless Chromium with the real MapLibre, on invented
// buildings (a GeoJSON stand-in for the basemap's `buildings` layer, no map data or network needed).
// Checks: the S panel opens with the day's sunrise / sunset, the shadow lands on the side away from the
// sun (pixels darker there, not on the sunny side), it moves when the time moves, nothing at night.
// Needs Playwright (require('playwright')) and Vendor/maplibre-gl (node tools/fetch-vendor.js
// maplibre-gl); without them it says so and skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), http = require('http');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const ML = path.join(REPO, 'Vendor', 'maplibre-gl', 'dist');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body{margin:0;height:100%} #map{position:absolute;inset:0} #sun-panel{position:absolute;bottom:0;left:0;background:#fff;font-size:11px}</style>
</head><body><div id="map"></div><button id="b-sun"></button><section id="sun-panel" hidden></section>
<script src="/lib/sun.js"></script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
import { initShadows } from '/lib/shadow-layer.js';
const C = [19.05, 47.5], d = 0.00025;
const box = (x, y, h) => ({ type: 'Feature', id: x * 10 + y, properties: { kind: 'building', height: h },
  geometry: { type: 'Polygon', coordinates: [[[C[0] + x * d, C[1] + y * d], [C[0] + (x + 1) * d, C[1] + y * d], [C[0] + (x + 1) * d, C[1] + (y + 1) * d], [C[0] + x * d, C[1] + (y + 1) * d], [C[0] + x * d, C[1] + y * d]]] } });
const style = { version: 8, sources: { protomaps: { type: 'geojson', data: { type: 'FeatureCollection', features: [box(0, 0, 40)] } } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f0ece2' } },
           { id: 'buildings', type: 'fill', source: 'protomaps', paint: { 'fill-color': '#cdbfab' } },
           { id: 'buildings-3d', type: 'fill-extrusion', source: 'protomaps', paint: { 'fill-extrusion-color': '#d2c4b0', 'fill-extrusion-height': ['get', 'height'] } }] };
const map = new maplibregl.Map({ container: 'map', style, center: [C[0] + d / 2, C[1] + d / 2], zoom: 17.5, pitch: 0, canvasContextAttributes: { preserveDrawingBuffer: true } });
const mem = {};
const store = { get: (k, v) => (k in mem ? mem[k] : v), set: (k, v) => { mem[k] = v; } };
map.once('load', () => {
  window.shadows = initShadows({ map, params: new URLSearchParams(location.search), store, toast: () => {} });
  window.ready = true;
});
window.map = map;
window.px = (lon, lat) => { const p = map.project([lon, lat]); return [Math.round(p.x), Math.round(p.y)]; };
window.C = C; window.D = d;
</script></body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = null;
    if (u === '/harness.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HARNESS); return; }
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
  if (!pw || !fs.existsSync(path.join(ML, 'maplibre-gl.mjs'))) {
    console.log('  skip (needs Playwright and Vendor/maplibre-gl: node tools/fetch-vendor.js maplibre-gl)');
    return;
  }
  const srv = await serve();
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 600 }, timezoneId: 'Europe/Budapest' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    // a winter afternoon: the sun low in the south-west, the shadow long to the north-east
    await page.goto(`http://127.0.0.1:${srv.address().port}/harness.html?arnyek=2026-12-21T14:30`);
    await page.waitForFunction(() => window.ready && window.shadows && window.shadows.isOn(), null, { timeout: 30000 });
    await page.waitForFunction(() => window.shadows.count > 0, null, { timeout: 15000 });
    await page.waitForTimeout(600);

    const lum = async (dx, dy) => page.evaluate(([dx, dy]) => {
      const [x, y] = window.px(window.C[0] + dx * window.D, window.C[1] + dy * window.D);
      const gl = window.map.getCanvas().getContext('webgl2') || window.map.getCanvas().getContext('webgl');
      const r = window.devicePixelRatio || 1, h = window.map.getCanvas().height;
      const b = new Uint8Array(4); gl.readPixels(Math.round(x * r), Math.round(h - y * r), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
      return (b[0] + b[1] + b[2]) / 3;
    }, [dx, dy]);

    await t('the panel: the day, sunrise and sunset, the sun in the south-west', async () => {
      const txt = await page.textContent('#sun-panel');
      assert.ok(/7:2\d|07:2\d/.test(txt) && /15:5\d/.test(txt), 'sunrise ~07:29, sunset ~15:55: ' + txt);
      assert.ok(/DNy/.test(txt), 'south-west: ' + txt);
      assert.strictEqual(await page.inputValue('#sun-date'), '2026-12-21');
    });

    await t('the shadow falls north-east of the building, not south-west', async () => {
      const ne = await lum(2.2, 1.8), sw = await lum(-1.2, -1.2), far = await lum(-3, 3);
      assert.ok(ne < far - 25, `north-east darker: ${ne} vs open ground ${far}`);
      assert.ok(Math.abs(sw - far) < 6, `south-west lit: ${sw} vs ${far}`);
    });

    await t('the time slider moves it: in the morning the shadow is north-west', async () => {
      await page.evaluate(() => window.shadows.set(new Date(2026, 11, 21, 9, 30)));
      await page.waitForTimeout(500);
      const nw = await lum(-1.6, 2.2), ne = await lum(2.2, 1.8);
      assert.ok(nw < ne - 25, `north-west now darker: ${nw} vs north-east ${ne}`);
      assert.ok(/DK/.test(await page.textContent('#sun-read')), 'the sun south-east');
    });

    await t('at night there is no shadow; off clears it', async () => {
      await page.evaluate(() => window.shadows.set(new Date(2026, 11, 21, 20, 0)));
      await page.waitForTimeout(400);
      assert.strictEqual(await page.evaluate(() => window.shadows.count), 0);
      assert.ok(/horizont alatt/.test(await page.textContent('#sun-read')));
      await page.evaluate(() => window.shadows.set(new Date(2026, 11, 21, 14, 30)));
      await page.click('#sun-x');
      await page.waitForTimeout(400);
      assert.strictEqual(await page.evaluate(() => window.shadows.isOn()), false);
      assert.ok(await page.isHidden('#sun-panel'));
      const ne = await lum(2.2, 1.8), far = await lum(-3, 3);
      assert.ok(Math.abs(ne - far) < 6, 'no shadow left: ' + ne + ' vs ' + far);
    });

    await t('no page errors', async () => { assert.deepStrictEqual(errors, []); });
  } finally {
    await browser.close();
    srv.close();
  }
};
