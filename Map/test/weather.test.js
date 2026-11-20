// The W layer's server routes (serve.js /weather/*) on invented weather (test/wx-env.js): payloads, the job weather
// behind the job layer's switches and log, the registry switch, the POST guard, no path escape. No network.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const E = require('./wx-env.js');

function req(port, p, opt = {}) {
  return new Promise((ok, fail) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method: opt.method || 'GET', headers: opt.headers || {} }, res => {
      const b = []; res.on('data', c => b.push(c)); res.on('end', () => ok({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(b), json: () => JSON.parse(Buffer.concat(b).toString('utf8')) }));
    });
    r.on('error', fail); r.end(opt.body);
  });
}
const decode = (b64, sc) => { const b = Buffer.from(b64, 'base64'); return [...new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))].map(x => (x === -32768 ? NaN : x * sc)); };

module.exports = async function (t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-wxs-'));
  const jobs = path.join(tmp, 'jobs');
  fs.cpSync(path.join(__dirname, 'fixtures', 'jobs'), jobs, { recursive: true });
  try { fs.unlinkSync(path.join(jobs, '_elozmenyek', 'helyek-log.jsonl')); } catch {}
  await E.build(jobs);
  const menu = path.join(tmp, 'vrg-menu.json');
  const writeMenu = wx => fs.writeFileSync(menu, JSON.stringify({ start: { tools: [{ key: 'M', server: 'terkep', jobsLayer: true, weatherLayer: wx }] } }));
  writeMenu(true);
  const keep = { j: process.env.VRG_JOBS_DIR, m: process.env.VRG_MENU, d: process.env.VRG_MAP_DATA };
  Object.assign(process.env, { VRG_JOBS_DIR: jobs, VRG_MENU: menu, VRG_MAP_DATA: E.BASE });
  delete require.cache[require.resolve('../serve.js')];
  const S = require('../serve.js');
  const srv = http.createServer(S.handle);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const log = () => { const f = path.join(jobs, '_elozmenyek', 'helyek-log.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse) : []; };
  try {
    await t('W status: on, forecast field, measured field, stations, strikes, radar, attribution; no-store', async () => {
      const r = await req(port, '/weather/status');
      assert.strictEqual(r.headers['cache-control'], 'no-store');
      const s = r.json();
      assert.ok(s.on && s.forecast && s.obs && s.stations.n > 30 && s.lightning.n > 40 && s.radar.n === 12 && s.jobs === true, JSON.stringify(s).slice(0, 300));
      assert.ok(s.attribution.length >= 3);
    });
    await t('W fields: the forecast grid decodes to sane values, the measured grid too', async () => {
      const f = (await req(port, '/weather/fields?mode=forecast')).json();
      assert.ok(f.times.length > 40 && ['t2m', 'precip', 'cloud', 'gust', 'u', 'v'].every(v => f.vars[v] && f.vars[v].length === f.times.length));
      const t2 = decode(f.vars.t2m[0], f.scale.t2m);
      assert.strictEqual(t2.length, f.grid.nx * f.grid.ny);
      assert.ok(t2.every(x => x > -30 && x < 40));
      const o = (await req(port, '/weather/fields?mode=obs')).json();
      assert.strictEqual(o.source, 'obs-idw');
    });
    await t('W stations, lightning, warnings (Budapest is not "Pest"), radar frames and files', async () => {
      const st = (await req(port, '/weather/stations')).json();
      assert.ok(st.features.length > 30 && st.features.every(f => typeof f.properties.t2m === 'number'));
      const L = (await req(port, '/weather/lightning?min=60')).json();
      assert.ok(L.features.every(f => f.properties.age <= 60));
      const W = (await req(port, '/weather/warnings')).json();
      const bp = W.find(w => w.area === 'Budapest'), pest = W.find(w => w.area === 'Pest');
      assert.ok(bp && pest && bp.items.length === 1 && pest.items.length === 1, JSON.stringify(W));
      const R = (await req(port, '/weather/radar')).json();
      assert.strictEqual(R.length, 12);
      const img = await req(port, R[0].url);
      assert.strictEqual(img.status, 200); assert.strictEqual(img.headers['content-type'], 'image/png');
      assert.strictEqual(img.buf.slice(1, 4).toString(), 'PNG');
      assert.strictEqual((await req(port, '/weather/radar/hungaromet-radar/..%2F..%2Fweather.sqlite')).status, 404);
    });
    await t('W job weather: client data, behind the job layer, logged like helyek.json', async () => {
      const before = log().length;
      const j = (await req(port, '/weather/jobs')).json();
      assert.ok(Object.keys(j).length > 0 && Object.values(j).every(x => ['amber', 'red'].includes(x.level)));
      const l = log();
      assert.strictEqual(l.length, before + 1); assert.strictEqual(l[l.length - 1].what, 'weather'); assert.strictEqual(l[l.length - 1].ok, true);
      fs.writeFileSync(path.join(jobs, '_elozmenyek', 'TERKEP-KI'), '');
      const off = await req(port, '/weather/jobs');
      assert.strictEqual(off.status, 403);
      assert.strictEqual((await req(port, '/weather/status')).json().jobs, false);
      fs.unlinkSync(path.join(jobs, '_elozmenyek', 'TERKEP-KI'));
    });
    await t('W refresh: POST only with x-vrg and a localhost origin', async () => {
      assert.strictEqual((await req(port, '/weather/refresh', { method: 'POST' })).status, 403);
      assert.strictEqual((await req(port, '/weather/refresh', { method: 'POST', headers: { 'x-vrg': '1', origin: 'https://evil.example' } })).status, 403);
      assert.strictEqual((await req(port, '/weather/nothing')).status, 404);
    });
    await t('W registry switch: weatherLayer:false turns the layer off, status says why', async () => {
      writeMenu(false);
      const s = (await req(port, '/weather/status')).json();
      assert.strictEqual(s.on, false); assert.ok(/weatherLayer/.test(s.reason));
      assert.strictEqual((await req(port, '/weather/fields')).status, 403);
      writeMenu(true);
      assert.strictEqual((await req(port, '/weather/status')).json().on, true);
    });
  } finally {
    srv.close();
    for (const [k, v] of [['VRG_JOBS_DIR', keep.j], ['VRG_MENU', keep.m], ['VRG_MAP_DATA', keep.d]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete require.cache[require.resolve('../serve.js')];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};
