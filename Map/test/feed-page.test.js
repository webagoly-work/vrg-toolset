// The Térkép-feed (lib/feed-layer.js) in headless Chromium with the real MapLibre: a faked GPS position
// and invented places (a pois.json written here). Checks: six cards in the user's order with distance and
// ETA, Otthon missing until set, one icon and one dashed ghost line per place; holding a card selects it
// (the others hide, a solid "spider" line), Vissza restores; a right click on an icon selects too; a
// seventh category is refused; moving the position updates the list; no page errors.
// Needs Playwright and Vendor/maplibre-gl (node tools/fetch-vendor.js maplibre-gl); else it skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), http = require('http');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const ML = path.join(REPO, 'Vendor', 'maplibre-gl', 'dist');
const HERE = [19.0402, 47.4979];

// invented places around HERE (lon/lat in 1e-5 degrees)
const P = (dx, dy, name, kind) => [Math.round((HERE[0] + dx) * 1e5), Math.round((HERE[1] + dy) * 1e5), name, kind];
const rows = {
  daniella: [P(0.020, 0.010, 1, 2), P(0.200, 0.100, 3, 2)],
  szereles: [P(-0.004, 0.003, 4, 5)],
  bolt: [P(0.002, -0.001, 6, 7), P(0.009, 0.004, 8, 7)],
  etkezes: [P(-0.001, -0.002, 9, 10)],
  orvos: [P(0.010, -0.012, 11, 12)],
  wc: [P(0.0005, 0.0005, 13, 14)],
};
const POIS = { v: 1, built: '2026-11-21', s: ['', 'Daniella Teszt', 'electrical', 'Daniella Messze', 'Próba Vasbolt', 'hardware',
  'Közeli Aldi', 'supermarket', 'Messzi Spar', 'Próba Büfé', 'fast_food', 'Próba Kórház', 'hospital', 'WC', 'toilets'], cats: rows };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body{margin:0;height:100%} #map{position:absolute;inset:0} #feed-panel{position:absolute;left:8px;top:8px;width:340px;background:#fff;font:12px sans-serif;z-index:5}
.fd-mk{width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid var(--c);display:grid;place-items:center}</style>
</head><body><div id="map"></div><button id="b-feed"></button><section id="feed-panel" hidden></section><div id="toast"></div>
<script src="/lib/feed.js"></script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
import { initFeed } from '/lib/feed-layer.js';
const map = new maplibregl.Map({ container: 'map', style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eee' } }] },
  center: [${HERE[0]}, ${HERE[1]}], zoom: 14 });
const mem = {};
const store = { get: (k, v) => (k in mem ? mem[k] : v), set: (k, v) => { mem[k] = v; } };
window.toasts = [];
map.once('load', () => { window.feed = initFeed({ map, maplibregl, params: new URLSearchParams('feed=1'), store, toast: t => window.toasts.push(t) }); window.ready = true; });
window.map = map;
window.lines = () => (window.feed ? window.feed.lines() : []);
</script></body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/h.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(HARNESS); }
    if (u === '/data/pois.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(POIS)); }
    const f = u.startsWith('/vendor/maplibre-gl/') ? path.join(ML, path.basename(u)) : u.startsWith('/lib/') ? path.join(MAP, 'lib', path.basename(u)) : null;
    if (!f || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

module.exports = async t => {
  let pw = null;
  try { pw = require('playwright'); } catch { /* not installed */ }
  if (!pw || !fs.existsSync(path.join(ML, 'maplibre-gl.mjs'))) { console.log('  skip (needs Playwright and Vendor/maplibre-gl)'); return; }
  const srv = await serve();
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, geolocation: { longitude: HERE[0], latitude: HERE[1], accuracy: 8 },
      permissions: ['geolocation'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${srv.address().port}/h.html`);
    await page.waitForFunction(() => window.ready && window.feed && window.feed.isOn() && window.feed.items().length === 6, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const cards = () => page.$$eval('#fd-list .fd-card', els => els.map(e => e.dataset.cat));
    const markers = () => page.$$eval('.fd-mk', els => els.map(e => e.dataset.cat));

    await t('six cards in the user\'s order; Otthon missing; icons and ghost lines for the five found', async () => {
      assert.deepStrictEqual(await cards(), ['otthon', 'daniella', 'szereles', 'bolt', 'etkezes', 'orvos']);
      assert.ok(/Nincs beállítva/.test(await page.textContent('.fd-card[data-cat=otthon]')));
      const bolt = await page.textContent('.fd-card[data-cat=bolt]');
      assert.ok(/Közeli Aldi/.test(bolt) && /perc/.test(bolt) && / m/.test(bolt), 'the nearer Aldi with ETA and distance: ' + bolt);
      assert.ok(/Daniella Teszt/.test(await page.textContent('.fd-card[data-cat=daniella]')), 'the nearer Daniella');
      assert.strictEqual((await markers()).length, 5);
      const l = await page.evaluate(() => window.lines());
      assert.strictEqual(l.filter(k => k === 'ghost').length, 5); assert.ok(l.includes('you'));
      assert.ok(/a helyedtől/.test(await page.textContent('#fd-src')), 'the GPS position is used');
    });

    await t('Otthon set to the map centre; it is kept only in this browser\'s storage', async () => {
      await page.evaluate(() => window.map.jumpTo({ center: [19.06, 47.51] }));
      await page.click('#fd-gear');
      await page.click('[data-home=center]');
      await page.waitForTimeout(200);
      assert.ok(!/Nincs beállítva/.test(await page.textContent('.fd-card[data-cat=otthon]')));
      const pins = await page.evaluate(() => window.feed.pins());
      assert.strictEqual(pins.length, 1); assert.strictEqual(pins[0].cat, 'otthon');
      assert.strictEqual((await markers()).length, 6);
    });

    await t('a seventh category is refused with a message; switching one off frees a slot', async () => {
      await page.click('.fd-cat[data-cat=wc]');
      assert.ok((await page.evaluate(() => window.toasts)).some(x => /Legfeljebb 6/.test(x)));
      await page.click('.fd-cat[data-cat=etkezes]');
      await page.click('.fd-cat[data-cat=wc]');
      await page.waitForTimeout(200);
      assert.deepStrictEqual(await cards(), ['otthon', 'daniella', 'szereles', 'bolt', 'orvos', 'wc']);
      await page.click('#fd-gear');
    });

    await t('holding a card selects it: the others hide, a solid spider line, Navigáció and Vissza', async () => {
      const box = await (await page.$('.fd-card[data-cat=bolt]')).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
      await page.waitForTimeout(300);
      assert.strictEqual(await page.evaluate(() => window.feed.selected()), 'bolt');
      assert.deepStrictEqual(await cards(), ['bolt']);
      assert.deepStrictEqual(await markers(), ['bolt']);
      assert.deepStrictEqual((await page.evaluate(() => window.lines())).filter(k => k !== 'you'), ['spider']);
      assert.ok(await page.$('[data-nav]') && await page.$('[data-back]'));
      await page.click('[data-back]');
      await page.waitForTimeout(200);
      assert.strictEqual(await page.evaluate(() => window.feed.selected()), null);
      assert.strictEqual((await cards()).length, 6);
    });

    await t('a right click on an icon selects that place', async () => {
      await page.click('.fd-mk[data-cat=orvos]', { button: 'right' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.evaluate(() => window.feed.selected()), 'orvos');
      await page.click('[data-back]');
    });

    await t('a short tap only shows it (no selection)', async () => {
      await page.click('.fd-card[data-cat=szereles]');
      await page.waitForTimeout(200);
      assert.strictEqual(await page.evaluate(() => window.feed.selected()), null);
    });

    await t('moving: the list follows the position', async () => {
      await page.evaluate(() => window.feed.setPosition(19.0602, 47.5079));   // next to the far-ish Daniella
      await page.waitForTimeout(200);
      const d = await page.textContent('.fd-card[data-cat=daniella]');
      assert.ok(/Daniella Teszt/.test(d) && /\d+ m/.test(d), 'now metres away: ' + d);
    });

    await t('closing clears the icons and lines; no page errors', async () => {
      await page.click('#fd-x');
      await page.waitForTimeout(200);
      assert.strictEqual((await markers()).length, 0);
      assert.deepStrictEqual(await page.evaluate(() => window.lines()), []);
      assert.deepStrictEqual(errors, []);
    });
  } finally {
    await browser.close();
    srv.close();
  }
};
