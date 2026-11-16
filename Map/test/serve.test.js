// MJ-03: serve.js's job routes and their controls (no-store, log, kill switches, OTG), on a fixture.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const F = require('./fixtures.js');

function get(port, p, headers) {
  return new Promise((ok, fail) => http.get({ host: '127.0.0.1', port, path: p, headers: headers || {} }, r => {
    let b = ''; r.setEncoding('utf8'); r.on('data', c => { b += c; }); r.on('end', () => ok({ status: r.statusCode, headers: r.headers, body: b }));
  }).on('error', fail));
}

module.exports = async function (t) {
  const jobs = F.jobsDir();
  const hist = path.join(jobs, '_elozmenyek');
  const menuDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-menu-'));
  const menu = path.join(menuDir, 'vrg-menu.json');
  const writeMenu = on => fs.writeFileSync(menu, JSON.stringify({ start: { tools: [{ key: 'M', server: 'terkep', jobsLayer: on }] } }));
  writeMenu(true);
  const keep = { j: process.env.VRG_JOBS_DIR, m: process.env.VRG_MENU, o: process.env.VRG_OTG };
  process.env.VRG_JOBS_DIR = jobs; process.env.VRG_MENU = menu; delete process.env.VRG_OTG;
  delete require.cache[require.resolve('../serve.js')];
  const S = require('../serve.js');
  const srv = http.createServer(S.handle);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const log = () => fs.existsSync(path.join(hist, 'helyek-log.jsonl')) ? fs.readFileSync(path.join(hist, 'helyek-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
  try {
    await t('no helyek.json yet: off, with the build command', async () => {
      const r = JSON.parse((await get(port, '/jobs/status')).body);
      assert.equal(r.on, false); assert.ok(/build-jobs/.test(r.reason));
    });
    fs.writeFileSync(path.join(hist, 'helyek.json'), JSON.stringify({ jobs: [{ code: 'TA1', lon: 19.05, lat: 47.5 }] }));
    await t('status on; /jobs/status is not logged', async () => {
      const r = await get(port, '/jobs/status');
      assert.equal(JSON.parse(r.body).on, true); assert.equal(r.headers['cache-control'], 'no-store'); assert.equal(log().length, 0);
    });
    await t('helyek.json: no-store, nosniff, served', async () => {
      const r = await get(port, '/jobs/helyek.json', { 'User-Agent': 'teszt-pc' });
      assert.equal(r.status, 200); assert.equal(r.headers['cache-control'], 'no-store'); assert.equal(r.headers['x-content-type-options'], 'nosniff');
      assert.equal(JSON.parse(r.body).jobs[0].code, 'TA1');
    });
    await t('the access log: time, local, user agent, count', async () => {
      const l = log(); assert.equal(l.length, 1);
      assert.equal(l[0].via, 'local'); assert.equal(l[0].ua, 'teszt-pc'); assert.equal(l[0].ok, true); assert.equal(l[0].n, 1); assert.ok(Date.parse(l[0].t));
    });
    await t('through the relay: logged as relay', async () => {
      await get(port, '/jobs/helyek.json', { 'User-Agent': 'teszt-telefon', 'x-vrg-via': 'relay' });
      const l = log(); assert.equal(l[1].via, 'relay'); assert.equal(l[1].ua, 'teszt-telefon');
    });
    await t('flag file TERKEP-KI: off everywhere, 403, the refusal logged', async () => {
      fs.writeFileSync(path.join(hist, 'TERKEP-KI'), '');
      assert.equal(JSON.parse((await get(port, '/jobs/status')).body).on, false);
      const r = await get(port, '/jobs/helyek.json');
      assert.equal(r.status, 403); assert.ok(!/TA1/.test(r.body));
      assert.equal(log().pop().ok, false);
      fs.unlinkSync(path.join(hist, 'TERKEP-KI'));
    });
    await t('registry jobsLayer:false: off', async () => {
      writeMenu(false);
      const s = JSON.parse((await get(port, '/jobs/status')).body);
      assert.equal(s.on, false); assert.ok(/registry/.test(s.reason));
      assert.equal((await get(port, '/jobs/helyek.json')).status, 403);
      writeMenu(true);
      assert.equal(JSON.parse((await get(port, '/jobs/status')).body).on, true);
    });
    await t('OTG: off', async () => {
      process.env.VRG_OTG = '1';
      assert.equal((await get(port, '/jobs/helyek.json')).status, 403);
      assert.ok(/OTG/.test(JSON.parse((await get(port, '/jobs/status')).body).reason));
      delete process.env.VRG_OTG;
    });
    await t('other /jobs/ paths and traversal: nothing', async () => {
      assert.equal((await get(port, '/jobs/helyszinek.json')).status, 404);
      assert.equal((await get(port, '/jobs/../_elozmenyek/helyszinek.json')).status, 404);
      assert.equal((await get(port, '/lib/../../jobs/x')).status, 404);
    });
    await t('the page and the shared geocoder are served', async () => {
      assert.equal((await get(port, '/')).status, 200);
      const g = await get(port, '/lib/geocode.js');
      assert.equal(g.status, 200); assert.ok(/VRGGeocode/.test(g.body));
    });
  } finally {
    srv.close();
    if (keep.j === undefined) delete process.env.VRG_JOBS_DIR; else process.env.VRG_JOBS_DIR = keep.j;
    if (keep.m === undefined) delete process.env.VRG_MENU; else process.env.VRG_MENU = keep.m;
    if (keep.o !== undefined) process.env.VRG_OTG = keep.o;
    F.rmrf(jobs); F.rmrf(menuDir);
  }
};
