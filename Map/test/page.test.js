// MJ-05: the page in headless Chrome against invented jobs (a copy of Map/test/fixtures/jobs): pins, card,
// ?job=, the J toggle, guest / embed guards, the kill switch, the access log, no exceptions.
// Needs chrome-headless-shell (H:\VRG\Full\tools, or $CHROME) and the map data (Map/data or the main
// checkout's); without them it says so and skips.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const MAIN = /[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/.test(REPO) ? path.resolve(REPO, '..', '..', '..') : REPO;
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
const CHROME = [process.env.CHROME, path.join(REPO, rel), path.join(MAIN, rel)].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    if (e.name === 'helyek-log.jsonl') continue;
    e.isDirectory() ? copyDir(path.join(a, e.name), path.join(b, e.name)) : fs.copyFileSync(path.join(a, e.name), path.join(b, e.name));
  }
}

async function chrome(tmp) {
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1000,720', `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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
  const go = async (u, ready, ms = 30000) => {
    await send('Page.navigate', { url: u });
    for (let i = 0; i < ms / 100; i++) { await sleep(100); try { if (await evaluate(ready)) return true; } catch { /* loading */ } }
    return false;
  };
  return { proc, ws, send, evaluate, go, errors };
}

module.exports = async function (t) {
  const dataDir = [path.join(MAP, 'data'), path.join(MAIN, 'Map', 'data')].find(d => fs.existsSync(path.join(d, 'hungary.pmtiles')));
  if (!CHROME || !dataDir) { console.log('  skip page test: ' + (!CHROME ? 'no chrome-headless-shell' : 'no map data (node Map/tools/fetch-data.js)')); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-page-'));
  const jobs = path.join(tmp, 'jobs');
  copyDir(path.join(__dirname, 'fixtures', 'jobs'), jobs);
  const hist = path.join(jobs, '_elozmenyek');
  const keep = { j: process.env.VRG_JOBS_DIR, d: process.env.VRG_MAP_DATA };
  process.env.VRG_JOBS_DIR = jobs; process.env.VRG_MAP_DATA = dataDir;
  delete require.cache[require.resolve('../serve.js')];
  const S = require('../serve.js');
  const srv = http.createServer(S.handle);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const C = await chrome(tmp);
  const E = C.evaluate;
  try {
    await t('?job=T04: the layer on, flown there, the card open', async () => {
      assert.ok(await C.go(base + '?job=T04', `!!document.querySelector('.jpop .jcard')`, 45000), 'no card after ?job=T04');
      const s = await E(`(() => { const m = vrgMap.map, c = m.getCenter(), j = vrgJobs.find('T04');
        return { code: document.querySelector('.jcard b').textContent, d: Math.hypot(c.lng - j.lon, c.lat - j.lat), badge: document.querySelector('#jobs-badge').hidden,
          pressed: document.querySelector('#b-jobs').getAttribute('aria-pressed'), layers: ['jobs-pin','jobs-ring','jobs-cluster','jobs-label'].every(id => !!m.getLayer(id)),
          legend: document.querySelector('#jobs-legend').textContent }; })()`);
      assert.equal(s.code, 'T04'); assert.ok(s.d < 0.001, 'centre ' + s.d); assert.equal(s.badge, false); assert.equal(s.pressed, 'true'); assert.ok(s.layers);
      assert.ok(/1 munkának nincs helye/.test(s.legend), s.legend);
    });
    await t('the pins are rendered (queryRenderedFeatures finds T04)', async () => {
      const n = await E(`(async () => { const m = vrgMap.map; for (let i = 0; i < 100 && !m.loaded(); i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => { m.once('idle', r); m.triggerRepaint(); setTimeout(r, 4000); });
        return m.queryRenderedFeatures({ layers: ['jobs-pin'] }).map(f => f.properties.code); })()`);
      assert.ok(n.includes('T04'), JSON.stringify(n));
    });
    await t('the card shows status, period, total, precision', async () => {
      const txt = await E(`document.querySelector('.jcard').textContent`);
      for (const w of ['meghiúsult', 'Idősáv', 'Ft', 'csak az utca']) assert.ok(txt.includes(w), w + ' in ' + txt);
    });
    await t('pin colour by status, read from the layer (computed paint)', async () => {
      const c = await E(`JSON.stringify(vrgMap.map.getPaintProperty('jobs-pin', 'circle-color'))`);
      assert.ok(/meghiúsult/.test(c) && /befejezett/.test(c), c);
    });
    await t('J toggles the layer off and on', async () => {
      const v = await E(`(async () => { document.querySelector('#b-jobs').click(); await new Promise(r => setTimeout(r, 200));
        const off = vrgMap.map.getLayoutProperty('jobs-pin', 'visibility'), badge = document.querySelector('#jobs-badge').hidden;
        document.querySelector('#b-jobs').click(); await new Promise(r => setTimeout(r, 200));
        return { off, badge, on: vrgMap.map.getLayoutProperty('jobs-pin', 'visibility') }; })()`);
      assert.deepEqual(v, { off: 'none', badge: true, on: 'visible' });
    });
    await t('the access log: a local line per load', async () => {
      const l = fs.readFileSync(path.join(hist, 'helyek-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.ok(l.length >= 1 && l.every(x => x.via === 'local' && x.ok && x.n === 31), JSON.stringify(l));
    });
    await t('?vendeg=1: no J button, no data fetched', async () => {
      const before = fs.readFileSync(path.join(hist, 'helyek-log.jsonl'), 'utf8').length;
      assert.ok(await C.go(base + '?vendeg=1&job=T04', `!!window.vrgJobs && !!window.vrgMap`));
      await sleep(800);
      assert.equal(await E(`!!document.querySelector('#b-jobs') || !!vrgMap.map.getSource('vrg-jobs')`), false);
      assert.equal(fs.readFileSync(path.join(hist, 'helyek-log.jsonl'), 'utf8').length, before);
    });
    await t('?embed=1: off unless &jobs=1', async () => {
      assert.ok(await C.go(base + '?embed=1', `!!window.vrgJobs && !!window.vrgMap`));
      assert.equal(await E(`!!document.querySelector('#b-jobs')`), false);
      assert.ok(await C.go(base + '?embed=1&jobs=1&job=T02', `!!document.querySelector('.jpop .jcard')`, 45000));
    });
    await t('kill switch (TERKEP-KI): the button greyed with the reason, nothing loaded', async () => {
      fs.writeFileSync(path.join(hist, 'TERKEP-KI'), '');
      assert.ok(await C.go(base + '?job=T04', `!!window.vrgJobs && document.querySelector('#b-jobs').disabled`));
      const s = await E(`({ src: !!vrgMap.map.getSource('vrg-jobs'), title: document.querySelector('#b-jobs').title })`);
      assert.equal(s.src, false); assert.ok(/TERKEP-KI/.test(s.title), s.title);
      fs.unlinkSync(path.join(hist, 'TERKEP-KI'));
    });
    await t('the page threw nothing', async () => assert.deepEqual(C.errors, []));
  } finally {
    try { C.ws.close(); } catch { /* closed */ }
    C.proc.kill();
    srv.close();
    if (keep.j === undefined) delete process.env.VRG_JOBS_DIR; else process.env.VRG_JOBS_DIR = keep.j;
    if (keep.d === undefined) delete process.env.VRG_MAP_DATA; else process.env.VRG_MAP_DATA = keep.d;
    await sleep(300);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* chrome may still hold its profile */ }
  }
};
