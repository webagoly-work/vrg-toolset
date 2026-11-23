// The Domborzat mérése layer (lib/relief-layer.js, R) and the hills' shadow in the Árnyék layer (lib/shadow-layer.js
// with the relief heights) in headless Chromium with the real MapLibre, on an invented terrain: a north-south ridge
// 300 m high, 1.5 km east of the middle, on 100 m flat ground (a lib/dem.js source over made-up tiles; no map data or
// network). Needs Playwright and Vendor/maplibre-gl; without them it says so and skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), http = require('http');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const ML = path.join(REPO, 'Vendor', 'maplibre-gl', 'dist');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body{margin:0;height:100%} #map{position:absolute;inset:0} #sun-panel,#relief-panel{position:absolute;bottom:0;background:#fff;font-size:11px} #relief-panel{right:0}</style>
</head><body><div id="map"></div><button id="b-sun">S</button><button id="b-relief">R</button>
<section id="sun-panel" hidden></section><section id="relief-panel" hidden></section>
<script src="/lib/sun.js"></script><script src="/lib/relief.js"></script><script src="/lib/dem.js"></script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
import { initShadows } from '/lib/shadow-layer.js';
import { initRelief } from '/lib/relief-layer.js';
const C = [19.05, 47.5], RIDGE = C[0] + 0.02;
// the made-up terrain: 100 m, a ridge to 400 m along lon = RIDGE (half-width about 250 m)
const height = (lon, lat) => 100 + 300 * Math.exp(-(((lon - RIDGE) * 75000) ** 2) / (2 * 250 * 250));
const SIZE = 128;
const getTile = async (z, x, y) => {
  const t = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) t[j * SIZE + i] = height(VRGDem.tileLon(x + (i + 0.5) / SIZE, z), VRGDem.tileLat(y + (j + 0.5) / SIZE, z));
  return t;
};
const dem = VRGDem.source(getTile, { z: 12, size: SIZE, maxTiles: 200 });
const style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f0ece2' } }] };
const map = new maplibregl.Map({ container: 'map', style, center: C, zoom: 13, canvasContextAttributes: { preserveDrawingBuffer: true } });
const mem = {};
const store = { get: (k, v) => (k in mem ? mem[k] : v), set: (k, v) => { mem[k] = v; } };
map.once('load', () => {
  window.relief = initRelief({ map, params: new URLSearchParams(), store, toast: () => {}, dem });
  window.shadows = initShadows({ map, params: new URLSearchParams(location.search), store, toast: () => {}, relief: window.relief });
  window.ready = true;
});
window.map = map; window.C = C; window.RIDGE = RIDGE; window.height = height;
window.at = (lon, lat) => map.fire('mousemove', { lngLat: { lng: lon, lat }, point: map.project([lon, lat]) });
window.click = (lon, lat) => map.fire('click', { lngLat: { lng: lon, lat }, point: map.project([lon, lat]) });
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
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, timezoneId: 'Europe/Budapest' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${srv.address().port}/harness.html`);
    // the buttons sit under the map in this bare harness: press them as a script would
    const press = sel => page.evaluate(s => document.querySelector(s).click(), sel);
    await page.waitForFunction(() => window.ready && window.relief, null, { timeout: 30000 });

    await t('R: the panel opens and the contours of the ridge are drawn', async () => {
      await press('#b-relief');
      assert.ok(await page.isVisible('#relief-panel'));
      await page.waitForFunction(() => window.relief.levels && window.relief.levels.length > 0, null, { timeout: 15000 });
      const levels = await page.evaluate(() => window.relief.levels);
      assert.ok(levels.length >= 5 && levels[levels.length - 1] <= 400 && levels[0] >= 100, 'levels between 100 and 400 m: ' + levels.join(','));
      assert.ok(/Szintköz \d+ m/.test(await page.textContent('#rl-legend')), 'the interval is shown');
    });

    await t('the read-out: the height and slope under the pointer', async () => {
      await page.evaluate(() => window.at(window.RIDGE, window.C[1]));
      await page.waitForFunction(() => window.relief.last && window.relief.last.z > 300, null, { timeout: 10000 });
      const top = await page.evaluate(() => window.relief.last);
      assert.ok(Math.abs(top.z - 400) < 6, 'the ridge top, 400 m: ' + top.z);
      assert.ok(top.slope < 4, 'flat on the crest: ' + top.slope);
      await page.evaluate(() => window.at(window.RIDGE - 250 / 75000, window.C[1]));
      await page.waitForFunction(() => window.relief.last && window.relief.last.z < 330, null, { timeout: 10000 });
      const flank = await page.evaluate(() => window.relief.last);
      assert.ok(Math.abs(flank.z - window_h(250)) < 8, 'the west flank: ' + flank.z);
      assert.ok(flank.slope > 25 && flank.aspect > 225 && flank.aspect < 315, 'steep, facing west: ' + flank.slope.toFixed(1) + '° ' + flank.aspect.toFixed(0) + '°');
      assert.ok(/tszf/.test(await page.textContent('#rl-read')));
    });

    await t('two clicks: the profile over the ridge', async () => {
      await page.evaluate(() => { window.click(window.RIDGE - 0.012, window.C[1]); window.click(window.RIDGE + 0.012, window.C[1]); });
      await page.waitForFunction(() => window.relief.profile, null, { timeout: 10000 });
      const p = await page.evaluate(() => { const q = window.relief.profile; return { dist: q.dist, max: q.max, gain: q.gain, loss: q.loss }; });
      assert.ok(Math.abs(p.dist - 0.024 * 75300) < 60, 'about 1.8 km: ' + p.dist);
      assert.ok(Math.abs(p.max - 400) < 6 && Math.abs(p.gain - 300) < 10 && Math.abs(p.loss - 300) < 10, 'up 300 m and down 300 m: ' + JSON.stringify(p));
      assert.ok(/Metszet/.test(await page.textContent('#rl-prof')));
    });

    await t('the slope classes as an image on the map', async () => {
      await press('#rl-s');
      await page.waitForFunction(() => !!window.map.getLayer('vrg-slope'), null, { timeout: 10000 });
    });

    await t('S with the hills: a low south-east sun puts the land west of the ridge in shadow', async () => {
      await press('#b-sun');
      await page.evaluate(() => window.shadows.set(new Date(2026, 11, 21, 9, 0)));   // about 8° up, south-east
      await page.waitForFunction(() => window.shadows.terrain && window.shadows.terrain.share > 0, null, { timeout: 15000 });
      const low = await page.evaluate(() => window.shadows.terrain.share);
      assert.ok(low > 0.03, 'a band west of the ridge: ' + low);
      assert.ok(!!(await page.evaluate(() => window.map.getLayer('vrg-terrain-shadow'))));
      await page.evaluate(() => window.shadows.set(new Date(2026, 5, 21, 13, 0)));   // June noon, 66° up
      await page.waitForFunction(l => window.shadows.terrain && window.shadows.terrain.share < l / 4, low, { timeout: 15000 });
      await press('#sun-terrain');                                                // the ⛰ chip off
      await page.waitForFunction(() => !window.map.getLayer('vrg-terrain-shadow'), null, { timeout: 10000 });
    });

    await t('off clears its layers', async () => {
      await press('#rl-x');
      assert.ok(!(await page.evaluate(() => window.map.getLayer('vrg-contours') || window.map.getSource('vrg-contours'))));
    });

    await t('no page errors', async () => { assert.deepStrictEqual(errors, []); });
  } finally {
    await browser.close();
    srv.close();
  }
};
/** The test terrain's height at [d] metres from the ridge line. */
function window_h(d) { return 100 + 300 * Math.exp(-(d * d) / (2 * 250 * 250)); }
