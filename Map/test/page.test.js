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
          pressed: document.querySelector('#b-jobs').getAttribute('aria-pressed'), layers: ['jobs-pin','jobs-ring','jobs-cluster','jobs-hit','jobs-heat'].every(id => !!m.getLayer(id)),
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
    await t('ring and pin colour by status, read from the layer paint and the pin images', async () => {
      const c = await E(`JSON.stringify(vrgMap.map.getPaintProperty('jobs-ring', 'circle-color'))`);
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
    // ---- the refinement pass (docs/map/REFINE.md)
    await t('R2/R3: status, year and area filters narrow the pins', async () => {
      assert.ok(await C.go(base + '#10.4/47.5/19.08/0/0', `!!(window.vrgJobs && vrgJobs.toggle && vrgMap.map.loaded())`, 45000));
      const o = await E(`(async () => { await vrgJobs.toggle(true); const f = () => vrgJobs.features().features.length, o = { all: f() };
        const st = document.querySelector('[data-status="meghiúsult"]'); st.click(); o.noFailed = f(); o.pressed = st.getAttribute('aria-pressed'); st.click();
        const y = document.querySelector('[data-year="2026"]'); y.click(); o.y = f(); y.click();
        const a = document.querySelector('[data-role="area"]'); a.value = 'Mintaváros'; a.dispatchEvent(new Event('change')); o.area = f(); a.value = ''; a.dispatchEvent(new Event('change'));
        o.expect = { failed: vrgJobs.list.filter(j => j.lon != null && j.status === 'meghiúsult').length, y: vrgJobs.list.filter(j => j.lon != null && j.year === '2026').length,
          area: vrgJobs.list.filter(j => j.lon != null && j.area === 'Mintaváros').length };
        return o; })()`);
      assert.equal(o.all, 30); assert.equal(o.noFailed, 30 - o.expect.failed); assert.equal(o.pressed, 'false');
      assert.equal(o.y, o.expect.y); assert.equal(o.area, o.expect.area); assert.ok(o.expect.area > 0);
    });
    await t('R4: the timeline shows only what had started, and fades what had ended', async () => {
      const o = await E(`(() => { const t = Math.floor(Date.parse('2025-06-01') / 864e5); vrgJobs.setTime(t);
        const fs = vrgJobs.features().features, started = vrgJobs.list.filter(j => j.lon != null && j.fromN <= t).length;
        const r = { n: fs.length, started, faded: fs.filter(f => f.properties.faded).length, row: !document.querySelector('.lg-time').hidden, date: document.querySelector('[data-role="date"]').textContent };
        vrgJobs.setTime(null); r.after = vrgJobs.features().features.length; return r; })()`);
      assert.equal(o.n, o.started); assert.ok(o.faded > 0 && o.faded <= o.n); assert.equal(o.row, true); assert.equal(o.date, '2025.06.01.'); assert.equal(o.after, 30);
    });
    await t('R8: the density layer follows D', async () => {
      const o = await E(`(() => { const k = key => dispatchEvent(new KeyboardEvent('keydown', { key })); k('d'); const a = vrgMap.map.getLayoutProperty('jobs-heat', 'visibility'); k('d');
        return [a, vrgMap.map.getLayoutProperty('jobs-heat', 'visibility')]; })()`);
      assert.deepEqual(o, ['visible', 'none']);
    });
    await t('R5: a job code in the search box lists the job first; choosing it flies there', async () => {
      const o = await E(`(async () => { const q = document.querySelector('#q'); q.focus(); q.value = 't1'; q.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400)); const li = [...document.querySelectorAll('#results li')];
        const first = li[0] && li[0].textContent; li[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        for (let i = 0; i < 100 && !document.querySelector('.jpop .jcard'); i++) await new Promise(r => setTimeout(r, 100));
        return { first, kind: li[0].querySelector('.k').className, card: document.querySelector('.jpop .jcard b')?.textContent }; })()`);
      assert.ok(/^munkaT1/.test(o.first), o.first); assert.ok(/munka/.test(o.kind)); assert.equal(o.card, 'T10');
    });
    await t('R9: , and . step through the jobs by date; Esc closes the card', async () => {
      const o = await E(`(async () => { const k = key => dispatchEvent(new KeyboardEvent('keydown', { key })); document.querySelector('#q').blur();
        const card = async () => { for (let i = 0; i < 100 && !document.querySelector('.jpop .jcard'); i++) await new Promise(r => setTimeout(r, 100)); return document.querySelector('.jpop .jcard b')?.textContent; };
        vrgMap.map.stop(); k('.'); await new Promise(r => setTimeout(r, 200)); const a = await card(); vrgMap.map.stop(); k('.'); await new Promise(r => setTimeout(r, 200)); const b = await card();
        k('Escape'); return { a, b, closed: !document.querySelector('.jpop') }; })()`);
      assert.ok(o.a && o.b && o.a !== o.b, JSON.stringify(o)); assert.equal(o.closed, true);
    });
    await t('R6/R1: the card has the period bar, actions, and co-located jobs share one pin', async () => {
      const o = await E(`(() => { const j = vrgJobs.find('T02'); const f = vrgJobs.features().features.find(x => x.properties.codes.includes('T02'));
        return { bar: true, codes: f.properties.codes, imgs: ['folyamatban', 'befejezett', 'meghiúsult'].every(s => vrgMap.map.hasImage('jpin-' + s) && vrgMap.map.hasImage('jpin-' + s + '-d')) }; })()`);
      assert.equal(o.codes, 'T02'); assert.ok(o.imgs);
      await E(`vrgJobs.fly('T02')`);
      const c = await E(`(async () => { for (let i = 0; i < 100 && !document.querySelector('.jpop .jbar'); i++) await new Promise(r => setTimeout(r, 100));
        return { bar: !!document.querySelector('.jpop .jbar i'), near: !!document.querySelector('.jpop [data-near]'), link: !!document.querySelector('.jpop [data-link]'), rel: document.querySelector('.jpop [data-job]')?.dataset.job }; })()`);
      assert.deepEqual(c, { bar: true, near: true, link: true, rel: 'T03' });
    });
    await t('R11: the UI follows the colour scheme (computed colours), the pins do not', async () => {
      const light = await E(`getComputedStyle(document.querySelector('#jobs-legend')).backgroundColor`);
      await C.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
      const dark = await E(`({ bg: getComputedStyle(document.querySelector('#jobs-legend')).backgroundColor, card: getComputedStyle(document.querySelector('.jpop .maplibregl-popup-content')).backgroundColor,
        pin: JSON.stringify(vrgMap.map.getPaintProperty('jobs-ring', 'circle-color')) })`);
      await C.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      assert.equal(light, 'rgb(251, 249, 244)'); assert.equal(dark.bg, 'rgb(35, 33, 29)'); assert.equal(dark.card, 'rgb(35, 33, 29)');
      assert.ok(/#d4570f/.test(dark.pin), dark.pin);
    });
    await t('R10: on a phone the card is a bottom sheet, the badge a strip, no sideways scroll', async () => {
      await C.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
      assert.ok(await C.go(base + '?job=T08', `!!(window.vrgJobs && vrgJobs.ready && !document.querySelector('#jobs-sheet').hidden)`, 45000));
      const o = await E(`({ popup: !!document.querySelector('.jpop'), code: document.querySelector('#jobs-sheet .jcard b').textContent, badge: Math.round(document.querySelector('#jobs-badge').getBoundingClientRect().width),
        sw: document.documentElement.scrollWidth, collapsed: document.querySelector('#jobs-legend').classList.contains('collapsed') })`);
      await C.send('Emulation.clearDeviceMetricsOverride');
      assert.deepEqual(o, { popup: false, code: 'T08', badge: 390, sw: 390, collapsed: true });
    });
    await t('R10: every request the page makes is root-relative (the relay keeps it under /p/8802/)', async () => {
      const urls = await E(`performance.getEntriesByType('resource').map(e => e.name)`);
      const foreign = urls.filter(u => !u.startsWith(base.replace(/\/$/, '')));
      assert.deepEqual(foreign, []);
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
