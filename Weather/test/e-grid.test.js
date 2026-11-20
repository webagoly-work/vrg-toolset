// the VRG Térkép fields: grid sources on recorded answers, the measured field, radar frames, the map payloads
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { REPLAY, DATA } = require('./env');
const C = require('../lib/commands');
const G = require('../lib/grid');
const ML = require('../lib/maplayers');

const ctx = C.context({ replay: REPLAY });
const run = argv => C.dispatch(ctx, argv);
const decode = (b64, scale) => { const b = Buffer.from(b64, 'base64'); const q = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); return [...q].map(x => (x === -32768 ? NaN : x * scale)); };

module.exports = async t => {
  await t('grid helpers: definition, points, u/v, gap filling, encode round trip', () => {
    const d = G.def({ grid: { bbox: [16, 45.6, 23, 48.7] } }, 0.25);
    assert.deepStrictEqual([d.nx, d.ny], [29, 13]);
    assert.strictEqual(G.points(d).length, 377);
    const [u, v] = G.uv(10, 270);                       // wind FROM the west blows TOWARDS the east
    assert.ok(Math.abs(u - 10) < 1e-9 && Math.abs(v) < 1e-9);
    const a = new Float32Array([1, NaN, 3, NaN]);
    G.fillGaps({ nx: 2, ny: 2 }, a);
    assert.ok(a.every(x => !Number.isNaN(x)));
    const back = decode(G.encode(new Float32Array([-2.34, NaN, 12.5]), 't2m'), 0.1);
    assert.ok(Math.abs(back[0] + 2.3) < 1e-6 && Number.isNaN(back[1]) && Math.abs(back[2] - 12.5) < 1e-6);
  });
  await t('fetch the field sources: Open-Meteo multi-point chunks and MET Norway per point', async () => {
    await run(['init']);
    const r = await run(['fetch', 'open-meteo-grid', 'met-no-grid']);
    const om = r.data.find(x => x.source === 'open-meteo-grid'), mn = r.data.find(x => x.source === 'met-no-grid');
    assert.strictEqual(om.status, 'ok', JSON.stringify(om)); assert.strictEqual(om.points, 377);
    assert.strictEqual(mn.status, 'ok', JSON.stringify(mn)); assert.strictEqual(mn.points, 105);
    const g = G.read(ctx.db, 'open-meteo-grid');
    assert.deepStrictEqual([...new Set(g.frames.map(f => f.var))].sort(), ['cape', 'cloud', 'gust', 't2m', 'u', 'v', 'precip'].sort());
    assert.strictEqual(new Set(g.frames.map(f => f.valid)).size, 52);
  });
  await t('the front is in the field: colder, north-westerly and wet behind it, mild ahead', () => {
    const g = G.read(ctx.db, 'open-meteo-grid');
    const at = g.frames.find(f => f.var === 't2m').valid;
    const get = (v, lon, lat) => { const f = g.frames.find(x => x.var === v && x.valid === at); return f.data[Math.round((lat - 45.6) / 0.25) * 29 + Math.round((lon - 16) / 0.25)]; };
    assert.ok(get('t2m', 22, 47) - get('t2m', 16, 47) > 3, 'warmer ahead (east) than behind (west)');
    assert.ok(get('u', 16, 47) > 0 && get('v', 16, 47) < 0, 'NW wind behind the front blows to the SE');
  });
  await t('station fetch builds the measured field (IDW, 10-minute frames over the last hours)', async () => {
    const r = await run(['fetch', 'hungaromet-obs']);
    const o = r.data.find(x => x.source === 'obs-idw');
    assert.ok(o && o.status === 'ok' && o.rows > 50, JSON.stringify(o));
    const g = G.read(ctx.db, 'obs-idw');
    assert.deepStrictEqual([g.grid.nx, g.grid.ny], [71, 32]);
    assert.ok(g.frames.every(f => f.data.every(x => !Number.isNaN(x))), 'no holes');
  });
  await t('radar: listing read, frames downloaded with their box, newest 12 kept', async () => {
    const r = await run(['fetch', 'hungaromet-radar']);
    assert.strictEqual(r.data[0].status, 'ok', JSON.stringify(r.data[0]));
    const rows = ctx.db.all('SELECT * FROM radar_frame ORDER BY at');
    assert.strictEqual(rows.length, 12);
    assert.ok(fs.existsSync(path.join(DATA, 'radar', 'hungaromet-radar', rows[0].file)));
    assert.deepStrictEqual([rows[0].west, rows[0].north], [13.5, 50.5]);
  });
  await t('map payloads: status, forecast and measured fields, stations, strikes, warnings, radar', async () => {
    await run(['fetch', 'meteoalarm', 'hungaromet-lightning']);
    const M = ML.make();
    try {
      const s = M.status();
      assert.ok(s.on && s.forecast.id === 'open-meteo-grid' && s.obs && s.stations.n > 30 && s.lightning.n > 40 && s.radar.n === 12);
      assert.ok(s.attribution.some(a => /Open-Meteo/.test(a)) && s.attribution.some(a => /HungaroMet/.test(a)));
      const f = M.fields('forecast');
      assert.strictEqual(f.source, 'open-meteo-grid');
      assert.strictEqual(f.times.length, f.vars.t2m.length);
      const t2 = decode(f.vars.t2m[0], f.scale.t2m);
      assert.strictEqual(t2.length, f.grid.nx * f.grid.ny);
      assert.ok(t2.every(x => x > -30 && x < 40));
      assert.strictEqual(M.fields('obs').source, 'obs-idw');
      const st = M.stations();
      assert.ok(st.features.length > 30 && st.features.every(x => x.properties.t2m != null));
      const L = M.lightning(60);
      assert.ok(L.features.length > 40 && L.features.every(x => x.properties.age >= 0 && x.properties.age <= 60));
      const W = M.warnings();
      const bp = W.find(w => w.area === 'Budapest');
      assert.ok(bp && bp.level === 2 && bp.lon && bp.items[0].event === 'széllökés');
      assert.ok(M.radar()[0].url.startsWith('/weather/radar/hungaromet-radar/'));
      assert.ok(M.radarFile('hungaromet-radar', '../../secret') === null, 'no path escape');
    } finally { M.close(); }
  });
  await t('job weather for the map: worst open alert per job code (needs the alerts run)', async () => {
    await run(['sync-jobs']); await run(['fetch', 'met-no']); await run(['fuse']); await run(['alerts']);
    const M = ML.make();
    try {
      const j = M.jobs();
      const codes = Object.keys(j);
      assert.ok(codes.length > 0 && codes.every(c => /^T\d+$/.test(c)));
      assert.ok(Object.values(j).every(x => ['amber', 'red'].includes(x.level) && x.alerts.length));
    } finally { M.close(); }
  });
  await t('commercial mode without a key: the map falls back to the MET Norway field', async () => {
    const S = require('../lib/sources');
    const om = ctx.cfg.sources.find(s => s.id === 'open-meteo-grid');
    assert.strictEqual(S.gate(om, { ...ctx.settings, use: 'commercial', keys: {} }).ok, false);
    const cfgFile = path.join(process.env.VRG_WEATHER_CONFIG, 'settings.local.json');
    const keep = fs.readFileSync(cfgFile, 'utf8');
    fs.writeFileSync(cfgFile, JSON.stringify({ use: 'commercial', contact: 'test@example.invalid' }));
    const M = ML.make();
    try { assert.strictEqual(M.status().forecast.id, 'met-no-grid'); assert.strictEqual(M.fields('forecast').source, 'met-no-grid'); }
    finally { M.close(); fs.writeFileSync(cfgFile, keep); }
  });
};
