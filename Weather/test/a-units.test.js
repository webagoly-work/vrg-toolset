// pure helpers: variables, zip, CSV, code mappings, fusion maths, the licence gate, the schedule
'use strict';
const assert = require('assert');
const { VARS, WMO, metSymbolToWmo, U, wmoSev } = require('../lib/vars');
const zip = require('../lib/zip');
const CSV = require('../lib/csv');
const { mapWw } = require('../lib/adapters/dwd-mosmix');
const F = require('../lib/fuse');
const S = require('../lib/sources');
const { due } = require('../lib/pipeline');
const { ascii, km, local, parseArgs, splitCmd } = require('../lib/common');

module.exports = async t => {
  await t('every variable has a unit, a kind and a Hungarian label', () => {
    for (const [k, v] of Object.entries(VARS)) assert.ok(v.unit !== undefined && ['cont', 'sum', 'prob', 'dir', 'code'].includes(v.kind) && v.hu, k);
  });
  await t('thunder codes are the most severe', () => {
    assert.ok(wmoSev(95) > wmoSev(65) && wmoSev(99) > wmoSev(95) && wmoSev(66) > wmoSev(63));
    for (const c of Object.keys(WMO)) assert.ok(WMO[c].hu);
  });
  await t('MET Norway symbols map to WMO codes', () => {
    assert.strictEqual(metSymbolToWmo('clearsky_day'), 0);
    assert.strictEqual(metSymbolToWmo('heavyrainandthunder'), 99);
    assert.strictEqual(metSymbolToWmo('lightsnowshowers_night'), 85);
    assert.strictEqual(metSymbolToWmo('rain'), 63);
    assert.strictEqual(metSymbolToWmo(undefined), null);
  });
  await t('MOSMIX ww codes map onto the subset', () => {
    assert.strictEqual(mapWw(95), 95); assert.strictEqual(mapWw(17), 95); assert.strictEqual(mapWw(61), 61);
    assert.strictEqual(mapWw(66), 66); assert.strictEqual(mapWw(45), 45); assert.strictEqual(mapWw(2), 2); assert.strictEqual(mapWw(null), null);
  });
  await t('dew point and apparent temperature are sane', () => {
    assert.ok(Math.abs(U.dewpoint(20, 50) - 9.3) < 0.2);
    assert.ok(U.apparent(30, 70, 1) > 30 && U.apparent(0, 70, 8) < -4);
  });
  await t('zip: make -> read round trip (deflate)', () => {
    const z = zip.make('a.kml', 'hello ' + 'x'.repeat(5000));
    assert.strictEqual(zip.entries(z)[0].name, 'a.kml');
    assert.strictEqual(zip.first(z, /\.kml$/).toString(), 'hello ' + 'x'.repeat(5000));
  });
  await t('CSV: header found after metadata lines, -999 is missing, times parsed as UTC', () => {
    const text = '# station file\nmeta;x\nTime;StationNumber;ta;u\n202611180600;12843;-1.5;-999\n';
    const tb = CSV.table(text, { time: ['Time'], station: ['StationNumber'], t2m: ['ta'], rh2m: ['u'] }, ['time', 'station']);
    assert.strictEqual(tb.rows.length, 1);
    assert.strictEqual(CSV.num(tb.rows[0].t2m), -1.5);
    assert.strictEqual(CSV.num(tb.rows[0].rh2m), null);
    assert.strictEqual(CSV.time('202611180600').toISOString(), '2026-11-18T06:00:00.000Z');
    assert.strictEqual(CSV.time('2026-11-18 06:00').toISOString(), '2026-11-18T06:00:00.000Z');
    assert.throws(() => CSV.table('a;b\n1;2', { time: ['Time'] }, ['time']));
  });
  await t('weighted median ignores one outlier; the mean does not', () => {
    const p = [{ v: 1, w: 1 }, { v: 1.2, w: 1 }, { v: 9, w: 1 }];
    assert.strictEqual(F.wmedian(p), 1.2);
    assert.ok(F.wmean(p) > 3);
    assert.strictEqual(F.wmedian([{ v: 1, w: 1 }, { v: 3, w: 1 }]), 2);
  });
  await t('weather code fusion: the worst code two members reach; a lone thunder model does not win', () => {
    assert.strictEqual(F.fuseCode([{ v: 95 }, { v: 63 }, { v: 61 }]).v, 63);
    assert.strictEqual(F.fuseCode([{ v: 95 }, { v: 96 }, { v: 3 }]).v, 95);
    assert.strictEqual(F.fuseCode([{ v: 95 }]).v, 95);
  });
  await t('confidence from spread and tolerance', () => {
    assert.strictEqual(F.confidence('t2m', 0.3, 4, { t2m: 1.5 }), 'magas');
    assert.strictEqual(F.confidence('t2m', 1.0, 4, { t2m: 1.5 }), 'közepes');
    assert.strictEqual(F.confidence('t2m', 2.0, 4, { t2m: 1.5 }), 'alacsony');
    assert.strictEqual(F.confidence('t2m', null, 1, { t2m: 1.5 }), 'egy');
  });
  await t('lead buckets', () => {
    assert.strictEqual(F.leadBucket('2026-11-18T00:00Z', '2026-11-18T05:00Z', [6, 12, 24]), '≤6');
    assert.strictEqual(F.leadBucket('2026-11-18T00:00Z', '2026-11-19T06:00Z', [6, 12, 24]), '>24');
  });
  await t('licence gate: commercial use needs the key for Open-Meteo, never runs a "no" source', () => {
    const om = { id: 'open-meteo', adapter: 'open-meteo', enabled: true, commercial: 'key' };
    assert.strictEqual(S.gate(om, { use: 'commercial', keys: {} }).ok, false);
    assert.strictEqual(S.gate(om, { use: 'commercial', keys: { openMeteo: 'k' } }).ok, true);
    assert.strictEqual(S.gate(om, { use: 'evaluation', keys: {} }).ok, true);
    assert.strictEqual(S.gate({ ...om, commercial: 'no' }, { use: 'commercial' }).ok, false);
    assert.strictEqual(S.gate({ ...om, enabled: false }, { use: 'evaluation' }).ok, false);
    assert.strictEqual(S.gate({ id: 'r', adapter: null, enabled: true, commercial: 'yes' }, { use: 'commercial' }).ok, false);
  });
  await t('schedule: every / at / day-of-month in Budapest time', () => {
    const s = [{ every: 15, run: 'g' }, { every: 60, run: 'm', offset: 7 }, { at: '05:40', run: 'r' }, { at: '03:20', run: 'pv', day: 1 }];
    assert.deepStrictEqual(due(s, new Date('2026-11-18T04:40:00Z'), 'Europe/Budapest'), ['r']);   // 05:40 CET
    assert.deepStrictEqual(due(s, new Date('2026-11-18T05:15:00Z'), 'Europe/Budapest'), ['g']);
    assert.deepStrictEqual(due(s, new Date('2026-11-18T05:07:00Z'), 'Europe/Budapest'), ['m']);
    assert.deepStrictEqual(due(s, new Date('2026-07-01T01:20:00Z'), 'Europe/Budapest'), ['pv']);  // 03:20 CEST
    assert.deepStrictEqual(due(s, new Date('2026-11-18T02:20:00Z'), 'Europe/Budapest'), []);
  });
  await t('helpers: distance, local time, arguments, ASCII console text', () => {
    assert.ok(Math.abs(km({ lat: 47.4979, lon: 19.0402 }, { lat: 47.429, lon: 19.182 }) - 13.1) < 0.3);
    assert.strictEqual(local('2026-11-18T23:30:00Z').date, '2026-11-19');
    const { areaMatch } = require('../lib/common');
    assert.ok(areaMatch('Pest vármegye', 'Pest') && areaMatch('Budapest', 'Budapest') && areaMatch('Érd', 'Érd'));
    assert.ok(!areaMatch('Pest', 'Budapest') && !areaMatch('Budapest', 'Pest'), '"Pest" is not inside "Budapest"');
    assert.deepStrictEqual(parseArgs(['fetch', 'met-no', '--place', 'erd', '--force', '--day=tomorrow']), { _: ['fetch', 'met-no'], place: 'erd', force: true, day: 'tomorrow' });
    assert.deepStrictEqual(splitCmd('brief "Budapest belváros" --save'), ['brief', 'Budapest belváros', '--save']);
    assert.strictEqual(ascii('Széllökés −2 °C, ő ű ≥ · 🔴'), 'Szellokes -2 C, o u >= - [X]');
  });
};
