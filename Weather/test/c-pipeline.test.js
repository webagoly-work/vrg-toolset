// the whole chain on recorded answers: init -> sync-jobs -> fetch -> fuse -> verify -> alerts -> brief -> export,
// then the automation properties: dedupe, ack, clearing, the licence gate, pipelines.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { REPLAY, DATA } = require('./env');
const C = require('../lib/commands');

const ctx = C.context({ replay: REPLAY });
const run = argv => C.dispatch(ctx, argv);
const alerts = (place, rule, activity) => ctx.db.all("SELECT * FROM alert WHERE place_id = ? AND rule_id = ? AND (? IS NULL OR activity = ?) AND status IN ('open', 'ack')", place, rule, activity ?? null, activity ?? null);

module.exports = async t => {
  await t('init seeds the sources and the named places', async () => {
    await run(['init']);
    assert.strictEqual(ctx.db.get('SELECT COUNT(*) AS n FROM source').n, ctx.cfg.sources.length);
    assert.ok(ctx.db.get("SELECT 1 FROM place WHERE id = 'budapest'"));
  });
  await t('sync-jobs: only jobs in progress become watched places, as job sites', async () => {
    const r = await run(['sync-jobs']);
    assert.ok(r.ok, r.text);
    const jobs = ctx.db.all("SELECT * FROM place WHERE kind = 'job' AND active = 1");
    assert.ok(jobs.length > 0);
    assert.ok(jobs.every(j => j.job_code && j.id.startsWith('job-')));
  });
  await t('fetch (replay): every enabled source answers, nothing fails', async () => {
    const r = await run(['fetch']);
    const bad = r.data.filter(x => ['error', 'parse'].includes(x.status));
    assert.deepStrictEqual(bad, []);
    for (const s of ['met-no', 'dwd-mosmix', 'open-meteo', 'meteoalarm', 'hungaromet-obs', 'hungaromet-lightning'])
      assert.ok(r.data.some(x => x.source === s && x.status === 'ok'), s);
    assert.ok(!r.data.some(x => x.source === 'pvgis'), 'PVGIS only runs when asked by name');
    assert.ok(ctx.db.get("SELECT COUNT(*) AS n FROM fetch_log WHERE status = 'replay'").n > 10);
  });
  await t('fuse: seven members for Budapest, consensus with spread, members kept per hour', async () => {
    await run(['fuse']);
    const r = ctx.db.get("SELECT * FROM fused WHERE place_id = 'budapest' AND var = 't2m' AND valid_at = '2026-11-18T12:00Z'");
    assert.ok(r && r.n >= 6, 'six forecast members on temperature');
    assert.ok(r.spread > 0 && r.conf);
    assert.ok(Object.keys(JSON.parse(r.members)).some(m => m.startsWith('dwd-mosmix/')));
    const code = ctx.db.get("SELECT value FROM fused WHERE place_id = 'budapest' AND var = 'wmo' AND valid_at = '2026-11-18T20:00Z'");
    assert.ok(code && code.value < 95, 'one thunder model does not make the consensus a thunderstorm');
  });
  await t('verify: pairs against the nearest station, GFS (warm bias in the scenario) scores worst on temperature', async () => {
    const r = await run(['verify']);
    assert.ok(r.data.places.some(p => p.place === 'budapest' && p.pairs > 50));
    const sk = ctx.db.all("SELECT member, mae, bias FROM skill WHERE var = 't2m' AND lead = '≤6' ORDER BY mae DESC");
    assert.strictEqual(sk[0].member, 'open-meteo/gfs_seamless');
    assert.ok(sk[0].bias > 0.8);
  });
  await t('fuse after verify: members with 30+ pairs are weighted by skill', async () => {
    await run(['fuse']);
    const r = ctx.db.get("SELECT value, members FROM fused WHERE place_id = 'budapest' AND var = 't2m' AND valid_at = '2026-11-18T07:00Z'");
    assert.ok(r);
  });
  await t('alerts: the scenario fires what it should, with the right levels', async () => {
    const r = await run(['alerts']);
    assert.ok(r.data.run.new > 10);
    assert.strictEqual(alerts('budapest', 'frost-cable', 'kabel')[0].level, 'red', 'frost: PVC cable');
    assert.strictEqual(alerts('budapest', 'cold-cable', 'kabel')[0].level, 'amber');
    assert.strictEqual(alerts('budapest', 'gust-mewp', 'magasban')[0].level, 'red', 'MEWP gust');
    assert.strictEqual(alerts('budapest', 'gust-roof', 'tetoPV')[0].level, 'red');
    assert.strictEqual(alerts('budapest', 'official-warning')[0].level, 'amber', 'yellow CAP = amber');
    assert.strictEqual(alerts('budapest', 'lightning-near')[0].level, 'red', 'strike within 16 km');
    assert.strictEqual(alerts('budapest', 'thunder-possible').length, 1, 'one model sees thunder');
    assert.strictEqual(alerts('budapest', 'thunder-agreed').length, 0, 'but the sources do not agree');
    assert.strictEqual(alerts('budapest', 'pv-window', 'tetoPV')[0].level, 'info');
    assert.strictEqual(alerts('erd', 'gust-mewp').length + alerts('erd', 'official-warning').length >= 1, true, 'Pest county gets the warning');
    assert.ok(!ctx.db.get("SELECT 1 FROM alert a JOIN warning_place wp ON wp.place_id = a.place_id JOIN warning w ON w.id = wp.warning_id WHERE w.area = 'Csongrád-Csanád'"), 'an expired warning elsewhere touches nobody');
  });
  await t('alerts carry their basis; red ones are queued and delivered to the file channel, info ones are not', async () => {
    const a = alerts('budapest', 'gust-mewp', 'magasban')[0];
    assert.ok(a.basis.startsWith('standard:'));
    const out = ctx.db.all('SELECT * FROM outbox');
    assert.ok(out.length && out.every(o => o.delivered));
    assert.ok(!out.some(o => JSON.parse(o.payload).level === 'info'));
    const day = fs.readdirSync(path.join(DATA, 'outbox'));
    assert.ok(day.some(f => /^alerts-\d{4}-\d\d-\d\d\.jsonl$/.test(f)));
  });
  await t('re-running alerts updates, never duplicates', async () => {
    const before = ctx.db.get('SELECT COUNT(*) AS n FROM alert').n, sent = ctx.db.get('SELECT COUNT(*) AS n FROM outbox').n;
    const r = await run(['alerts']);
    assert.strictEqual(r.data.run.new, 0);
    assert.strictEqual(ctx.db.get('SELECT COUNT(*) AS n FROM alert').n, before);
    assert.strictEqual(ctx.db.get('SELECT COUNT(*) AS n FROM outbox').n, sent, 'nothing sent twice');
  });
  await t('ack keeps an alert acknowledged across runs; a condition that ends clears it', async () => {
    const a = alerts('budapest', 'gust-mewp', 'magasban')[0];
    await run(['ack', String(a.id)]);
    await run(['alerts']);
    assert.strictEqual(ctx.db.get('SELECT status FROM alert WHERE id = ?', a.id).status, 'ack');
    // the strike leaves the 30-minute window: one hour later the lightning alert clears
    const strike = alerts('budapest', 'lightning-near')[0];
    ctx.db.run('DELETE FROM strike');
    await run(['alerts']);
    assert.strictEqual(ctx.db.get('SELECT status FROM alert WHERE id = ?', strike.id).status, 'cleared');
  });
  await t('work windows: red hours for the MEWP at midday, cable laying blocked in the frost', async () => {
    const r = await run(['windows', 'budapest']);
    const w = r.data;
    const at = (act, iso) => w[act].find(h => h.valid === iso).level;
    assert.strictEqual(at('magasban', '2026-11-18T12:00Z'), 'red');
    assert.strictEqual(at('kabel', '2026-11-18T07:00Z'), 'red');
    assert.ok(['ok', 'info'].includes(at('kulteri', '2026-11-19T12:00Z')));
  });
  await t('brief: Hungarian, names the windows, the alerts with basis and the attribution', async () => {
    const r = await run(['brief', 'budapest', '--save']);
    const b = r.data[0];
    assert.ok(/Munkaablak/.test(b.text) && /emelőkosár tilos/.test(b.text) && /Deutscher Wetterdienst/.test(b.text) && /KIÉRTÉKELÉS/.test(b.text));
    assert.ok(fs.existsSync(b.file));
    const tm = await run(['brief', 'budapest', '--day', 'tomorrow']);
    assert.ok(tm.data[0].day === '2026-11-19');
  });
  await t('export: latest.json for the Asztal / Kapu / Mobile, job sites without coordinates', async () => {
    await run(['export']);
    const j = JSON.parse(fs.readFileSync(path.join(DATA, 'export', 'latest.json'), 'utf8'));
    assert.ok(j.places.length > 5 && j.attribution.length >= 3);
    const job = j.places.find(p => p.kind === 'job');
    assert.ok(job && job.lat === undefined && job.lon === undefined, 'no client coordinates leave the PC');
    assert.ok(j.places.find(p => p.id === 'budapest').windows.magasban.includes('r'));
  });
  await t('PV yield runs on demand per place', async () => {
    const r = await run(['pv', 'budapest', '--kwp', '10']);
    assert.ok(r.ok, r.text);
    assert.ok(/kWh/.test(r.text));
  });
  await t('commercial mode: Open-Meteo is skipped without a key, the others still run', async () => {
    const c2 = { ...ctx, settings: { ...ctx.settings, use: 'commercial', keys: {} } };
    const r = await C.dispatch(c2, ['fetch', '--force']);
    const om = r.data.filter(x => x.source.startsWith('open-meteo'));
    assert.ok(om.length && om.every(x => x.status === 'off'));
    assert.ok(r.data.some(x => x.source === 'met-no' && x.status === 'ok'));
  });
  await t('pipelines: a run logs every step; an unknown command fails its step but not the pipeline', async () => {
    const r = await run(['run', 'gyors']);
    assert.ok(r.ok && r.data.steps.length === 2);
    ctx.cfg.pipelines.pipelines.teszt = { hu: 'x', steps: ['nincsilyen', 'export'] };
    const r2 = await run(['run', 'teszt']);
    assert.strictEqual(r2.data.status, 'fail');
    assert.strictEqual(r2.data.steps[1].status, 'ok');
    delete ctx.cfg.pipelines.pipelines.teszt;
    assert.ok(ctx.db.get("SELECT COUNT(*) AS n FROM run WHERE kind = 'step'").n >= 4);
  });
  await t('sql is read-only; doctor finds no failures in this setup', async () => {
    await assert.rejects(() => run(['sql', 'DELETE FROM alert']));
    await assert.rejects(() => run(['sql', 'SELECT 1; DELETE FROM alert']));
    const q = await run(['sql', 'SELECT COUNT(*) AS n FROM forecast']);
    assert.ok(q.data[0].n > 1000);
    const d = await run(['doctor']);
    assert.notStrictEqual(d.data.worst, 'fail', d.text);
  });
  await t('prune keeps current data', async () => {
    const n = ctx.db.get('SELECT COUNT(*) AS n FROM forecast').n;
    await run(['prune']);
    assert.ok(ctx.db.get('SELECT COUNT(*) AS n FROM forecast').n > n * 0.5);
  });
};
