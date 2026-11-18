// the server (child process on a free port, replay data) and the page in headless Chromium (when Playwright is
// installed): API, POST guard, no console errors, the work-window colours read from COMPUTED styles.
'use strict';
const assert = require('assert');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { REPLAY } = require('./env');

const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

module.exports = async t => {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), '--replay', REPLAY, '--no-open'], { env: { ...process.env, VRG_WEATHER_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => (log += d)); child.stderr.on('data', d => (log += d));
  await new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { if (log.includes('localhost:')) { clearInterval(iv); res(); } else if (Date.now() - t0 > 8000) { clearInterval(iv); rej(new Error('server did not start: ' + log)); } }, 50); });
  const base = `http://127.0.0.1:${port}`;
  try {
    await t('GET /api/overview: places, sources with licence and gate, activities', async () => {
      const j = await (await fetch(base + '/api/overview')).json();
      assert.ok(j.places.some(p => p.id === 'budapest'));
      assert.ok(j.sources.every(s => s.licence && 'run' in s));
      assert.strictEqual(j.activities.length, 4);
    });
    await t('POST needs x-vrg and a local origin', async () => {
      assert.strictEqual((await fetch(base + '/api/run/gyors', { method: 'POST' })).status, 403);
      assert.strictEqual((await fetch(base + '/api/run/gyors', { method: 'POST', headers: { 'x-vrg': '1', origin: 'https://evil.example' } })).status, 403);
      assert.strictEqual((await fetch(base + '/api/cmd', { method: 'POST', headers: { 'x-vrg': '1' }, body: JSON.stringify({ argv: ['sql', 'select 1'] }) })).status, 400);
    });
    await t('POST /api/run/modell runs the pipeline; /api/place returns hours, windows, alerts, brief', async () => {
      const r = await (await fetch(base + '/api/run/reggel', { method: 'POST', headers: { 'x-vrg': '1' } })).json();
      assert.ok(['ok', 'warn'].includes(r.status), JSON.stringify(r));
      const p = await (await fetch(base + '/api/place/budapest')).json();
      assert.ok(p.hours.length > 48 && p.windows.magasban.length === 72 && p.alerts.length && /Munkaablak/.test(p.brief));
      assert.strictEqual((await fetch(base + '/api/place/nincs')).status, 404);
      assert.strictEqual((await fetch(base + '/latest.json')).status, 200);
    });
    let pw = null;
    try { pw = require('playwright'); } catch { console.log('       (Playwright not installed: page test skipped)'); }
    if (pw) await t('page: renders without errors; red cells are computed in the Mélyvíz crit colour', async () => {
      const b = await pw.chromium.launch();
      try {
        const page = await b.newPage({ viewport: { width: 1300, height: 1000 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
        await page.goto(base + '/#budapest');
        await page.waitForSelector('.strip i.red', { timeout: 8000 });
        assert.deepStrictEqual(errs, []);
        const c = await page.evaluate(() => ({
          red: getComputedStyle(document.querySelector('.strip i.red')).backgroundColor,
          crit: getComputedStyle(document.documentElement).getPropertyValue('--mv-crit').trim(),
          mg: !!document.querySelector('svg.mg path.fused'), members: document.querySelectorAll('svg.mg path.member').length,
          alerts: document.querySelectorAll('#alerts li.red').length, use: document.getElementById('use').textContent,
        }));
        assert.strictEqual(c.red, 'rgb(228, 135, 125)');
        assert.strictEqual(c.crit, '#e4877d');
        assert.ok(c.mg && c.members >= 6 && c.alerts >= 2);
        assert.strictEqual(c.use, 'kiértékelés');
        await page.keyboard.press('2');
        await page.waitForFunction(() => location.hash === '#budaors');
      } finally { await b.close(); }
    });
  } finally { child.kill(); }
};
