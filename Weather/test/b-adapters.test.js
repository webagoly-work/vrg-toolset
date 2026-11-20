// each adapter parses its recorded answer (invented data in the documented shape) into canonical rows
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { REPLAY } = require('./env');
const { config } = require('../lib/common');

const cfg = config();
const src = id => cfg.sources.find(s => s.id === id);
const buf = f => fs.readFileSync(path.join(REPLAY, f));
const place = { id: 'budapest', lat: 47.4979, lon: 19.0402, elev: 110 };

module.exports = async t => {
  await t('MET Norway: instant + next_1_hours stored at the hour end; 6-hour amounts spread over 6 hours', () => {
    const ad = require('../lib/adapters/met-no');
    assert.ok(ad.url(src('met-no'), place).includes('lat=47.4979&lon=19.0402'));
    const { forecast } = ad.parse(buf('met-no.json'), src('met-no'), place);
    const vars = new Set(forecast.map(r => r.var));
    for (const v of ['t2m', 'rh2m', 'dew2m', 'pmsl', 'wind', 'gust', 'precip', 'pop', 'wmo', 'tapp']) assert.ok(vars.has(v), v);
    const first = forecast.find(r => r.var === 't2m');
    assert.strictEqual(first.valid, '2026-11-18T05:00Z');
    assert.strictEqual(first.issued, '2026-11-18T04:20Z');
    assert.ok(!forecast.find(r => r.var === 'precip' && r.valid === '2026-11-18T05:00Z'), 'amount of 05-06 is stored at 06');
    const late = forecast.filter(r => r.var === 'precip' && r.valid > '2026-11-20T18:00Z');
    assert.ok(late.length >= 6, 'the 6-hourly part is spread hourly');
  });
  await t('MOSMIX: KMZ unzipped, Kelvin to °C, Pa to hPa, rows written for every place of the station', () => {
    const ad = require('../lib/adapters/dwd-mosmix');
    const st = src('dwd-mosmix').stations[0];
    assert.ok(ad.url(src('dwd-mosmix'), st).endsWith('/12843/kml/MOSMIX_L_LATEST_12843.kmz'));
    const { forecast } = ad.parse(buf('dwd-mosmix.kmz'), src('dwd-mosmix'), st, [place, { id: 'erd' }]);
    const t2 = forecast.filter(r => r.var === 't2m' && r.place === 'budapest');
    assert.strictEqual(t2.length, 100);
    assert.ok(t2.every(r => r.value > -20 && r.value < 30), 'Kelvin converted');
    assert.ok(forecast.some(r => r.place === 'erd'));
    const p = forecast.find(r => r.var === 'pmsl');
    assert.ok(p.value > 950 && p.value < 1050, 'Pa converted');
    assert.strictEqual(forecast[0].model, 'mosmix:12843');
    assert.strictEqual(forecast[0].issued, '2026-11-18T03:00Z');
  });
  await t('Open-Meteo: one member per model from the suffixed keys; the URL never carries a key unless set', () => {
    const ad = require('../lib/adapters/open-meteo');
    const s = src('open-meteo');
    const u = ad.url(s, place, { keys: {} });
    assert.ok(u.startsWith('https://api.open-meteo.com/') && !u.includes('apikey') && u.includes('wind_speed_unit=ms') && u.includes('models=icon_d2'));
    const k = ad.url(s, place, { keys: { openMeteo: 'SECRET' } });
    assert.ok(k.startsWith('https://customer-api.open-meteo.com/') && k.includes('apikey=SECRET'));
    assert.ok(!require('../lib/http').redact(k).includes('SECRET'), 'the fetch log never stores the key');
    const { forecast } = ad.parse(buf('open-meteo.json'), s, place);
    assert.deepStrictEqual([...new Set(forecast.map(r => r.model))].sort(), ['ecmwf_ifs025', 'gfs_seamless', 'icon_d2', 'icon_eu']);
    assert.ok(forecast.every(r => r.valid.endsWith('Z')));
    assert.ok(forecast.some(r => r.var === 'lpi' && r.model === 'icon_d2'));
    assert.ok(!forecast.some(r => r.var === 'lpi' && r.model === 'gfs_seamless'), 'nulls are skipped');
  });
  await t('MeteoAlarm JSON: one row per area, Hungarian info preferred, awareness level parsed', () => {
    const ad = require('../lib/adapters/meteoalarm');
    const { warnings } = ad.parse(buf('meteoalarm.json'), src('meteoalarm'));
    const wind = warnings.filter(w => w.type === 'szél');
    assert.strictEqual(wind.length, 2);
    assert.deepStrictEqual(wind.map(w => w.area).sort(), ['Budapest', 'Pest']);
    assert.strictEqual(wind[0].level, 2);
    assert.strictEqual(wind[0].event, 'széllökés');
    assert.strictEqual(wind[0].areaCode, 'HU001');
  });
  await t('MeteoAlarm Atom: the legacy feed shape is read too; Cancel messages are dropped', () => {
    const ad = require('../lib/adapters/meteoalarm');
    const xml = `<feed><entry><id>a1</id><title>Yellow Thunderstorm Warning</title><cap:identifier>X1</cap:identifier><cap:areaDesc>Pest</cap:areaDesc>
      <cap:event>zivatar</cap:event><cap:awareness_level>2; yellow; Moderate</cap:awareness_level><cap:awareness_type>3; Thunderstorm</cap:awareness_type>
      <cap:onset>2026-11-18T12:00:00+01:00</cap:onset><cap:expires>2026-11-18T20:00:00+01:00</cap:expires><cap:message_type>Alert</cap:message_type></entry>
      <entry><cap:identifier>X2</cap:identifier><cap:areaDesc>Pest</cap:areaDesc><cap:message_type>Cancel</cap:message_type></entry></feed>`;
    const { warnings } = ad.parse(Buffer.from(xml), src('meteoalarm'));
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].type, 'zivatar');
    assert.strictEqual(warnings[0].onset, '2026-11-18T11:00Z');
  });
  await t('HungaroMet observations: zipped CSV by header, stations with coordinates, -999 skipped', () => {
    const ad = require('../lib/adapters/hungaromet-obs');
    const r = ad.parse(buf('hungaromet-obs.zip'), src('hungaromet-obs'));
    assert.ok(r.stations.length >= 30 && ['12843', '12839', '12882'].every(id => r.stations.some(s => s.id === id)));
    assert.ok(r.found.includes('t2m') && r.found.includes('gust') && r.found.includes('precip10'));
    assert.ok(!r.observation.some(o => o.var === 'swrad'), '-999 radiation is missing, not a value');
    assert.ok(r.observation.some(o => o.station === '12843' && o.at === '2026-11-18T05:00Z' && o.var === 't2m'));
  });
  await t('lightning CSV and PVGIS monthly yield', () => {
    const L = require('../lib/adapters/hungaromet-lightning').parse(buf('hungaromet-lightning.csv'), src('hungaromet-lightning'));
    assert.ok(L.strikes.length > 40 && L.strikes.some(x => x.lat === 47.54 && x.lon === 19.14));
    assert.strictEqual(require('../lib/adapters/hungaromet-lightning').pickFromListing('<a href="l_2026111804.csv">x</a><a href="l_2026111805.csv">y</a>', 'https://odp.met.hu/weather/lightning/'),
      'https://odp.met.hu/weather/lightning/l_2026111805.csv');
    const pv = require('../lib/adapters/pvgis');
    assert.ok(pv.url(src('pvgis'), place, {}, { kwp: 10 }).includes('peakpower=10'));
    const { climate } = pv.parse(buf('pvgis.json'), src('pvgis'), place, {}, {});
    assert.strictEqual(climate.filter(c => c.key === 'pv_E_m').length, 12);
    assert.ok(climate.find(c => c.key === 'pv_E_y').value > 1000);
  });
  await t('every source in the registry names its licence, attribution and commercial status', () => {
    for (const s of cfg.sources) {
      assert.ok(s.licence && s.attribution && s.licence_url, s.id);
      assert.ok(['yes', 'key', 'no'].includes(s.commercial), s.id);
      if (s.adapter) assert.ok(require('../lib/sources').adapter(s), 'adapter for ' + s.id);
    }
  });
};
