// The W layer in headless Chrome, on the stub basemap and invented weather (test/wx-env.js): the panel, the toggles
// and the map layers they drive, the timeline, the particles and station readings drawn, the job weather ring and
// card line, ?wx=0, guest mode, no exceptions. Needs chrome-headless-shell (H:\VRG\Full\tools, or $CHROME) and
// Vendor/maplibre-gl + Vendor/pmtiles (node tools/fetch-vendor.js maplibre-gl pmtiles); without them it skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process');
const E = require('./wx-env.js');

const MAP = path.resolve(__dirname, '..'), REPO = path.resolve(MAP, '..');
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
const CHROME = [process.env.CHROME, path.join(REPO, rel)].find(p => p && fs.existsSync(p));
const VENDOR = [process.env.VRG_VENDOR, path.join(REPO, 'Vendor')].find(p => p && fs.existsSync(path.join(p, 'maplibre-gl', 'dist', 'maplibre-gl.mjs')));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function chrome(tmp) {
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--window-size=1200,800', `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const t = setTimeout(() => reject(new Error('Chrome did not start: ' + err.slice(-300))), 30000);
    proc.stderr.on('data', d => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const list = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/list`)).json();
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map(), errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const go = async (u, ready, ms = 40000) => {
    await send('Page.navigate', { url: u });
    for (let i = 0; i < ms / 100; i++) { await sleep(100); try { if (await evaluate(ready)) return true; } catch { /* loading */ } }
    return false;
  };
  return { proc, ws, send, evaluate, go, errors };
}

module.exports = async function (t) {
  if (!CHROME || !VENDOR) { console.log('  skip weather page test: ' + (!CHROME ? 'no chrome-headless-shell ($CHROME)' : 'no Vendor/maplibre-gl (node tools/fetch-vendor.js maplibre-gl pmtiles)')); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-wxp-'));
  const jobs = path.join(tmp, 'jobs');
  fs.cpSync(path.join(__dirname, 'fixtures', 'jobs'), jobs, { recursive: true });
  try { fs.unlinkSync(path.join(jobs, '_elozmenyek', 'helyek-log.jsonl')); } catch {}
  await E.build(jobs);
  const keep = { j: process.env.VRG_JOBS_DIR, d: process.env.VRG_MAP_DATA, v: process.env.VRG_VENDOR };
  Object.assign(process.env, { VRG_JOBS_DIR: jobs, VRG_MAP_DATA: E.BASE, VRG_VENDOR: VENDOR });
  delete require.cache[require.resolve('../serve.js')];
  const S = require('../serve.js');
  const srv = http.createServer(S.handle);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const C = await chrome(tmp);
  const X = C.evaluate;
  try {
    await t('?wx=1: the layer on, the panel drawn, the map layers added, defaults visible', async () => {
      assert.ok(await C.go(base + '?wx=1#8/47.2/19.2/0/0', 'window.vrgWeather && vrgWeather.ready'), 'weather not ready');
      const s = await X(`(() => { const m = vrgMap.map, vis = id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility');
        return { pressed: document.querySelector('#b-wx').getAttribute('aria-pressed'), panel: !document.querySelector('#wx-panel').hidden,
          chips: [...document.querySelectorAll('#wx-panel [data-layer]')].map(b => b.dataset.layer),
          precip: vis('wx-precip'), temp: vis('wx-temp'), strikes: vis('wx-strike-core'), warn: vis('wx-warn-fill'),
          evalBadge: !!document.querySelector('.wx-eval'), legend: document.querySelector('.wx-legend').textContent }; })()`);
      assert.strictEqual(s.pressed, 'true'); assert.ok(s.panel);
      for (const id of ['temp', 'cloud', 'gust', 'precip', 'radar', 'warnings', 'lightning', 'wind', 'stations']) assert.ok(s.chips.includes(id), id);
      assert.strictEqual(s.precip, 'visible'); assert.strictEqual(s.temp, 'none'); assert.strictEqual(s.strikes, 'visible'); assert.strictEqual(s.warn, 'visible');
      assert.ok(s.evalBadge, 'evaluation mode is said'); assert.ok(/Csapadék/.test(s.legend));
    });
    await t('toggles overlay independently: temperature on, precipitation off, both persisted', async () => {
      await X(`document.querySelector('#wx-panel [data-layer="temp"]').click()`);
      await X(`document.querySelector('#wx-panel [data-layer="precip"]').click()`);
      await sleep(300);
      const s = await X(`(() => { const m = vrgMap.map; return { temp: m.getLayoutProperty('wx-temp', 'visibility'), precip: m.getLayoutProperty('wx-precip', 'visibility'),
        op: m.getPaintProperty('wx-temp', 'raster-opacity'), saved: JSON.parse(localStorage.getItem('vrg.terkep.wx.layers')) }; })()`);
      assert.strictEqual(s.temp, 'visible'); assert.strictEqual(s.precip, 'none'); assert.ok(s.op > 0.2);
      assert.ok(s.saved.includes('temp') && !s.saved.includes('precip'));
    });
    await t('the fields and the overlays draw something: field canvas, particles, station readings', async () => {
      await sleep(1500);
      const s = await X(`(() => { const nz = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
        const ov = [...document.querySelectorAll('.wx-overlay')];
        return { temp: nz(vrgMap.map.getSource('wx-temp').canvas), overlays: ov.map(nz), stations: vrgWeather.state().stations.features.length }; })()`);
      assert.ok(s.temp > 1000, 'temperature canvas painted');
      assert.ok(s.overlays.every(n => n > 100), 'particles and station readings painted: ' + s.overlays);
      assert.ok(s.stations > 30);
    });
    await t('the timeline: setTime moves the slider and the label; play advances; mode switch to measured', async () => {
      const s = await X(`(async () => { vrgWeather.setTime(Date.now() + 24 * 3600e3); const out1 = document.querySelector('[data-role="when"]').textContent;
        const v1 = +document.querySelector('[data-role="time"]').value; vrgWeather.play(true); await new Promise(r => setTimeout(r, 1200)); vrgWeather.play(false);
        const v2 = vrgWeather.state().t; await vrgWeather.setMode('obs'); return { out1, v1, v2, mode: vrgWeather.state().mode, n: vrgWeather.state().F.times.length }; })()`);
      assert.ok(/\+24 ó/.test(s.out1), s.out1);
      assert.ok(s.v2 > s.v1, 'playing moves time forward');
      assert.strictEqual(s.mode, 'obs'); assert.ok(s.n >= 12, 'ten-minute measured frames');
    });
    await t('the job layer on: weather rings on job sites, the job card carries the weather line', async () => {
      await X(`vrgWeather.setMode('forecast')`);
      await X(`vrgJobs.toggle(true)`);
      for (let i = 0; i < 50 && !(await X(`!!(vrgMap.map.getSource('wx-jobs') && vrgMap.map.getSource('wx-jobs')._data && vrgMap.map.getSource('wx-jobs')._data.features && vrgMap.map.getSource('wx-jobs')._data.features.length)`)); i++) await sleep(100);
      const s = await X(`(() => { const m = vrgMap.map, code = Object.keys(vrgWeather.state().jobs)[0];
        return { code, vis: m.getLayoutProperty('wx-jobs', 'visibility'), chip: !!document.querySelector('#wx-panel [data-layer="jobs"]'), line: vrgWeather.jobCard(code) }; })()`);
      assert.ok(s.code, 'some job has weather'); assert.strictEqual(s.vis, 'visible'); assert.ok(s.chip);
      assert.ok(/wx-jobline/.test(s.line) && /Időjárás/.test(s.line));
    });
    await t('W toggles off cleanly: layers hidden, overlays cleared, panel hidden; no exceptions', async () => {
      await X(`vrgWeather.toggle(false)`);
      const s = await X(`(() => ({ panel: document.querySelector('#wx-panel').hidden, temp: vrgMap.map.getLayoutProperty('wx-temp', 'visibility'),
        sym: document.querySelectorAll('.wx-overlay')[0].hidden || (() => { const c = document.querySelectorAll('.wx-overlay')[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; })() }))()`);
      assert.ok(s.panel); assert.strictEqual(s.temp, 'none'); assert.ok(s.sym);
      assert.deepStrictEqual(C.errors, []);
    });
    await t('?wx=0 hides the button; guest mode shows the layer without the refresh button', async () => {
      assert.ok(await C.go(base + '?wx=0', `!!window.vrgWeather && !!window.vrgMap`));
      assert.strictEqual(await X(`!!document.querySelector('#b-wx')`), false);
      assert.ok(await C.go(base + '?vendeg=1&wx=1', 'window.vrgWeather && vrgWeather.ready'));
      assert.strictEqual(await X(`!!document.querySelector('#wx-panel [data-role="refresh"]')`), false);
      assert.strictEqual(await X(`!!document.querySelector('#wx-panel [data-layer="jobs"]')`), false, 'no job weather for a guest');
      assert.deepStrictEqual(C.errors, []);
    });
  } finally {
    try { C.ws.close(); } catch {}
    C.proc.kill();
    srv.close();
    for (const [k, v] of [['VRG_JOBS_DIR', keep.j], ['VRG_MAP_DATA', keep.d], ['VRG_VENDOR', keep.v]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete require.cache[require.resolve('../serve.js')];
    await sleep(300);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};
