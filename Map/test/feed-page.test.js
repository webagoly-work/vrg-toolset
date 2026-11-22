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

// a tiny road network (tools/build-roads.js on a .pbf from pbf-writer.js): from HERE east to a corner, then south to the
// Aldi, and south-west to the büfé. The vasbolt (450 m away, no road near it) stays a straight-line estimate.
function roads() {
  const os = require('os');
  const { writePbf } = require('./pbf-writer.js');
  const { buildRoads } = require('../tools/build-roads.js');
  const at = (dx, dy) => ({ lon: HERE[0] + dx, lat: HERE[1] + dy });
  const nodes = [{ id: 1, ...at(0, 0) }, { id: 2, ...at(0.002, 0) }, { id: 3, ...at(0.002, -0.001) }, { id: 4, ...at(-0.001, -0.002) }, { id: 5, ...at(0.004, 0) }];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-feed-roads-')), file = path.join(dir, 'r.osm.pbf');
  // the corner is a junction (Fő utca goes on east), so the guidance announces the right turn into Bolt utca
  writePbf(file, { nodes, ways: [{ id: 10, refs: [1, 2, 5], tags: { highway: 'residential', name: 'Fő utca' } },
    { id: 12, refs: [2, 3], tags: { highway: 'residential', name: 'Bolt utca' } }, { id: 11, refs: [1, 4], tags: { highway: 'residential' } }] });
  const bin = buildRoads(file);
  fs.rmSync(dir, { recursive: true, force: true });
  return bin;
}
const ROADS = roads();
const CORNER = [HERE[0] + 0.002, HERE[1]];

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<style>html,body{margin:0;height:100%} #map{position:absolute;inset:0} #feed-panel{position:absolute;left:8px;top:8px;width:340px;background:#fff;font:12px sans-serif;z-index:5}
.fd-mk{width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid var(--c);display:grid;place-items:center}</style>
</head><body><div id="map"></div><button id="b-feed"></button><section id="feed-panel" hidden></section><div id="toast"></div>
<script src="/lib/feed.js"></script>
<script src="/lib/route.js"></script>
<script src="/lib/guide.js"></script>
<script src="/lib/traffic.js"></script>
<script>window.spoken = []; Object.defineProperty(window, 'speechSynthesis', { value: { cancel() {}, speak(u) { window.spoken.push(u.text); } } });</script>
<script type="module">
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
import { initFeed } from '/lib/feed-layer.js';
import { initRoute } from '/lib/route-layer.js';
import { initNav } from '/lib/nav-layer.js';
const map = new maplibregl.Map({ container: 'map', style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eee' } }] },
  center: [${HERE[0]}, ${HERE[1]}], zoom: 14 });
const mem = {};
const store = { get: (k, v) => (k in mem ? mem[k] : v), set: (k, v) => { mem[k] = v; } };
window.toasts = [];
map.once('load', () => { const router = initRoute({ map }), toast = t => window.toasts.push(t);
  window.nav = initNav({ map, store, toast });
  window.feed = initFeed({ map, maplibregl, params: new URLSearchParams('feed=1'), store, toast, router, nav: window.nav }); window.ready = true; });
window.mem = mem;
window.map = map;
window.lines = () => (window.feed ? window.feed.lines() : []);
</script></body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/h.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(HARNESS); }
    if (u === '/data/pois.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(POIS)); }
    if (u === '/data/roads.bin') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end(ROADS); }
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

    await t('N2: the cards get road distances where a road leads there; else the straight line', async () => {
      await page.waitForFunction(() => /úton/.test(document.querySelector('.fd-card[data-cat=bolt]').textContent), null, { timeout: 15000 });
      const bolt = await page.textContent('.fd-card[data-cat=bolt]');
      assert.ok(/2[5-7]0 m úton/.test(bolt), 'along the corner: 150 m east + 111 m south, not the 220 m straight line: ' + bolt);
      assert.ok(/légvonal/.test(await page.textContent('.fd-card[data-cat=szereles]')), 'no road near the vasbolt');
      assert.ok(/úton/.test(await page.textContent('.fd-card[data-cat=etkezes]')));
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

    await t('holding a card selects it: the others hide, the route drawn, Navigáció and Vissza', async () => {
      const box = await (await page.$('.fd-card[data-cat=bolt]')).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
      await page.waitForTimeout(300);
      assert.strictEqual(await page.evaluate(() => window.feed.selected()), 'bolt');
      assert.deepStrictEqual(await cards(), ['bolt']);
      assert.deepStrictEqual(await markers(), ['bolt']);
      assert.ok(await page.$('[data-nav]') && await page.$('[data-back]'));
      // N2: the route on our road network replaces the straight spider line
      await page.waitForFunction(() => window.feed.route(), null, { timeout: 10000 });
      const rt = await page.evaluate(() => window.feed.route());
      assert.ok(rt.coords.some(c => Math.abs(c[0] - CORNER[0]) < 1e-5 && Math.abs(c[1] - CORNER[1]) < 1e-5), 'round the corner');
      assert.deepStrictEqual((await page.evaluate(() => window.lines())).filter(k => k !== 'you'), [], 'no straight line under the route');
      assert.ok(/saját úthálózaton/.test(await page.textContent('.fd-sel')));
      // walking along it: the card counts down
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), CORNER);
      await page.waitForTimeout(150);
      const left = await page.textContent('.fd-sel .fd-d');
      assert.ok(/1\d0 m úton/.test(left), 'from the corner about 110 m are left: ' + left);
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), HERE);

      // N3: ▶ Indulás starts the guidance: the first words, the banner, a prompt before the corner, the arrival, the end
      await page.click('[data-go]');
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => window.nav.on()));
      assert.ok(!(await page.isHidden('#nav-banner')) && await page.evaluate(() => document.body.classList.contains('nav-on')), 'the banner is up; the page CSS hides the panels under body.nav-on');
      const steps = await page.evaluate(() => window.nav.steps().map(s => s.text));
      assert.deepStrictEqual(steps, ['Induljon el kelet felé – Fő utca', 'Forduljon jobbra – Bolt utca', 'Megérkezett: Közeli Aldi']);
      assert.ok(/Forduljon jobbra – Bolt utca/.test(await page.textContent('#nav-banner')));
      assert.ok(/érkezés/.test(await page.textContent('#nav-foot')));
      const first = await page.evaluate(() => window.spoken.slice());
      assert.ok(/^Induljon el kelet felé – Fő utca\. 150 méter múlva forduljon jobbra – Bolt utca$/.test(first[0]), 'the first words: ' + first[0]);
      assert.strictEqual(first.length, 1, 'the 250 m prompt is in the first words, not said twice: ' + JSON.stringify(first));
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), [HERE[0] + 0.0012, HERE[1]]);   // 60 m before: the 250 m cue is done
      await page.waitForTimeout(120);
      assert.strictEqual(await page.evaluate(() => window.spoken.length), 1);
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), [HERE[0] + 0.00145, HERE[1]]);  // 41 m before: the 50 m cue
      await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => window.spoken.slice(-1)[0]);
      assert.strictEqual(s2, '40 méter múlva forduljon jobbra – Bolt utca');
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), [HERE[0] + 0.0016, HERE[1]]);   // 10 m on: nothing new to say
      await page.waitForTimeout(100);
      assert.strictEqual(await page.evaluate(() => window.spoken.length), 2, 'no repeat inside the same cue');
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), [HERE[0] + 0.002, HERE[1] - 0.00095]);   // at the shop
      await page.waitForTimeout(150);
      assert.ok((await page.evaluate(() => window.spoken.slice(-1)[0])).startsWith('Megérkezett: Közeli Aldi'));
      await page.evaluate(() => document.querySelector('#nav-stop').click());   // the bare test page has no CSS: the bar sits under the map
      await page.waitForTimeout(150);
      assert.ok(!(await page.evaluate(() => window.nav.on())) && await page.isHidden('#nav-banner') && !(await page.evaluate(() => document.body.classList.contains('nav-on'))));
      await page.evaluate(([x, y]) => window.feed.setPosition(x, y), HERE);

      // N3: the optional traffic check, with a key, answered by a stand-in TomTom
      await page.evaluate(() => { window.mem.tomtomKey = 'testKEY0123456789abcd'; });
      await page.route('https://api.tomtom.com/**', r => r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ routes: [{ summary: { lengthInMeters: 300, travelTimeInSeconds: 420, trafficDelayInSeconds: 240, noTrafficTravelTimeInSeconds: 180 } }] }) }));
      await page.evaluate(() => window.feed.select('bolt'));
      await page.waitForFunction(() => document.querySelector('[data-traffic]'), null, { timeout: 5000 });
      await page.click('[data-traffic]');
      await page.waitForFunction(() => window.feed.traffic(), null, { timeout: 5000 });
      assert.ok(/^Forgalommal ~7 perc \(\+4 perc dugó\)/.test(await page.evaluate(() => window.feed.traffic())));
      assert.ok(/Forgalommal/.test(await page.textContent('.fd-sel')));
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
