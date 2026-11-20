// VRG Időjárás — invented answers in each source's documented shape, for the tests and the offline demo.
// INVENTED DATA: one made-up November day over Budapest: frosty morning (cable-laying alert), a gusty
// afternoon (MEWP red, a yellow wind warning), rain in the evening, one model sees thunder, a lightning strike
// 8 km away. make(dir, now) writes one file per source, named the way lib/http.js replay looks for them.
'use strict';

const fs = require('fs');
const path = require('path');
const zip = require('../lib/zip');

const H = 3600e3;
const isoH = t => new Date(t).toISOString().slice(0, 13) + ':00';
const isoZ = t => new Date(t).toISOString().replace('.000', '');
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

// the "truth" at time t (ms): temperature °C, gust m/s, precip mm/h
function truth(t, now) {
  const h = (t - now) / H;                                     // hours from now (now = 05:00 UTC = 06:00 local)
  const hourLocal = (new Date(t).getUTCHours() + 1) % 24;
  const temp = -2 + 7 * Math.max(0, Math.sin((hourLocal - 8) / 24 * 2 * Math.PI)) + (h > 30 ? 3 : 0);
  const gust = 4 + (h >= 6 && h <= 11 ? 9.5 : 0) + (h >= 4 && h < 6 ? 4 : 0);
  const rain = h >= 13 && h <= 17 ? 1.6 : 0;
  return { temp, gust, wind: gust * 0.55, rain, rh: rain ? 95 : 70 - temp, cloud: rain ? 100 : h > 3 ? 70 : 20, p: 1012 - (h > 0 && h < 14 ? h * 0.6 : 8) };
}

function openMeteo(now) {
  const models = { icon_d2: { dt: -0.4, dg: 0.8 }, icon_eu: { dt: 0.2, dg: -0.5 }, ecmwf_ifs025: { dt: 0.5, dg: -1 }, gfs_seamless: { dt: 1.2, dg: -2 } };
  const start = Math.floor(now / H) * H - 24 * H;
  const time = [], hourly = { time };
  for (let i = 0; i < 24 * 5; i++) time.push(isoH(start + i * H));
  for (const [m, b] of Object.entries(models)) {
    const g = k => (hourly[k + '_' + m] = []);
    const cols = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'apparent_temperature', 'precipitation', 'precipitation_probability', 'snowfall', 'weather_code',
      'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'cape', 'lightning_potential', 'shortwave_radiation', 'visibility', 'uv_index', 'soil_temperature_0cm', 'freezing_level_height'];
    const A = Object.fromEntries(cols.map(c => [c, g(c)]));
    for (let i = 0; i < time.length; i++) {
      const t = start + i * H, x = truth(t, now), hl = (new Date(t).getUTCHours() + 1) % 24;
      const rain = x.rain * (m === 'gfs_seamless' ? 0.4 : 1);
      A.temperature_2m.push(+(x.temp + b.dt + rnd() * 0.6).toFixed(1));
      A.relative_humidity_2m.push(Math.round(x.rh));
      A.dew_point_2m.push(+(x.temp - 4).toFixed(1));
      A.apparent_temperature.push(+(x.temp - 3).toFixed(1));
      A.precipitation.push(+rain.toFixed(1));
      A.precipitation_probability.push(m.startsWith('icon') || m === 'gfs_seamless' ? (rain ? 85 : 5) : null);
      A.snowfall.push(0);
      // ICON-D2 alone calls one rain hour a thunderstorm: the "possible", not the "agreed" case
      const hh = (t - now) / H;
      A.weather_code.push(rain ? (m === 'icon_d2' && Math.round(hh) === 15 ? 95 : 63) : x.cloud > 60 ? 3 : 1);
      A.cloud_cover.push(x.cloud);
      A.pressure_msl.push(+x.p.toFixed(1));
      A.wind_speed_10m.push(+(x.wind + b.dg * 0.5).toFixed(1));
      A.wind_direction_10m.push(290);
      A.wind_gusts_10m.push(+(x.gust + b.dg + rnd() * 0.8).toFixed(1));
      A.cape.push(m === 'icon_d2' && rain ? 900 : 50);
      A.lightning_potential.push(m === 'icon_d2' ? (rain ? 2 : 0) : null);
      A.shortwave_radiation.push(hl >= 8 && hl <= 15 && !rain ? Math.round(650 * Math.sin((hl - 7) / 9 * Math.PI)) : 0);
      A.visibility.push(24000);
      A.uv_index.push(hl >= 9 && hl <= 14 ? 1 : 0);
      A.soil_temperature_0cm.push(+(x.temp + 1).toFixed(1));
      A.freezing_level_height.push(900);
    }
  }
  return { latitude: 47.5, longitude: 19.04, generationtime_ms: 1.2, utc_offset_seconds: 0, timezone: 'GMT', timezone_abbreviation: 'GMT', elevation: 110, hourly_units: { time: 'iso8601' }, hourly };
}

function metNo(now) {
  const ts = [];
  const start = Math.floor(now / H) * H;
  for (let i = 0; i < 90; i += i < 60 ? 1 : 6) {
    const t = start + i * H, x = truth(t, now), y = truth(t + H, now);
    const d = { air_pressure_at_sea_level: +x.p.toFixed(1), air_temperature: +(x.temp + 0.1).toFixed(1), cloud_area_fraction: x.cloud, dew_point_temperature: +(x.temp - 4).toFixed(1),
      relative_humidity: Math.round(x.rh), wind_from_direction: 285, wind_speed: +x.wind.toFixed(1), wind_speed_of_gust: +(x.gust + 0.3).toFixed(1), fog_area_fraction: 0, ultraviolet_index_clear_sky: 0 };
    const data = { instant: { details: d } };
    const sym = y.rain ? 'rain' : y.cloud > 60 ? 'cloudy' : 'fair_day';
    if (i < 60) data.next_1_hours = { summary: { symbol_code: sym }, details: { precipitation_amount: +y.rain.toFixed(1), probability_of_precipitation: y.rain ? 90 : 3, probability_of_thunder: y.rain ? 12 : 0 } };
    else data.next_6_hours = { summary: { symbol_code: sym }, details: { precipitation_amount: +(y.rain * 6).toFixed(1), probability_of_precipitation: y.rain ? 80 : 5 } };
    ts.push({ time: isoZ(t), data });
  }
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [19.0402, 47.4979, 110] },
    properties: { meta: { updated_at: isoZ(now - 40 * 60e3), units: { air_temperature: 'celsius', wind_speed: 'm/s', precipitation_amount: 'mm' } }, timeseries: ts } };
}

function mosmix(now) {
  const issue = Math.floor(now / (3 * H)) * 3 * H;
  const steps = []; for (let i = 1; i <= 100; i++) steps.push(issue + i * H);
  const row = f => steps.map(t => { const v = f(truth(t, now), t); return v == null ? '-' : (+v).toFixed(2); }).join('   ');
  const el = {
    TTT: x => x.temp + 273.15 - 0.2, Td: x => x.temp - 4 + 273.15, FF: x => x.wind, FX1: x => x.gust - 0.6, DD: () => 290, RR1c: x => x.rain * 0.9,
    R101: x => (x.rain ? 80 : 4), wwT: x => (x.rain ? 8 : 0), N: x => x.cloud, PPPP: x => x.p * 100, Rad1h: () => 0, VV: () => 20000, ww: x => (x.rain ? 61 : 2),
  };
  const kml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<kml:kml xmlns:dwd="https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd" xmlns:kml="http://www.opengis.net/kml/2.2">
<kml:Document><kml:ExtendedData><dwd:ProductDefinition><dwd:Issuer>Deutscher Wetterdienst</dwd:Issuer><dwd:ProductID>MOSMIX</dwd:ProductID>
<dwd:IssueTime>${new Date(issue).toISOString()}</dwd:IssueTime><dwd:ForecastTimeSteps>
${steps.map(t => `<dwd:TimeStep>${new Date(t).toISOString()}</dwd:TimeStep>`).join('\n')}
</dwd:ForecastTimeSteps></dwd:ProductDefinition></kml:ExtendedData>
<kml:Placemark><kml:name>12843</kml:name><kml:description>BUDAPEST/LORINC</kml:description><kml:ExtendedData>
${Object.entries(el).map(([k, f]) => `<dwd:Forecast dwd:elementName="${k}"><dwd:value>     ${row(f)}</dwd:value></dwd:Forecast>`).join('\n')}
</kml:ExtendedData><kml:Point><kml:coordinates>19.18,47.43,138.0</kml:coordinates></kml:Point></kml:Placemark></kml:Document></kml:kml>`;
  return zip.make('MOSMIX_L_2026111803_12843.kml', kml);
}

function meteoalarm(now) {
  const info = (lang, ev, head) => ({ language: lang, category: ['Met'], event: ev, urgency: 'Future', severity: 'Moderate', certainty: 'Likely',
    onset: isoZ(now + 5 * H), expires: isoZ(now + 12 * H), headline: head, description: lang === 'hu-HU' ? 'Délután a széllökések 70 km/h-t is elérhetnek.' : 'Gusts may exceed 70 km/h.',
    parameter: [{ valueName: 'awareness_level', value: '2; yellow; Moderate' }, { valueName: 'awareness_type', value: '1; Wind' }],
    area: [{ areaDesc: 'Budapest', geocode: [{ valueName: 'EMMA_ID', value: 'HU001' }] }, { areaDesc: 'Pest', geocode: [{ valueName: 'EMMA_ID', value: 'HU002' }] }] });
  return { warnings: [
    { alert: { identifier: 'urn:oid:2.49.0.0.348.0.HU.TEST.0001', sender: 'invented@example.invalid', sent: isoZ(now - H), status: 'Actual', msgType: 'Alert', scope: 'Public',
      info: [info('hu-HU', 'széllökés', 'Figyelmeztetés széllökés miatt'), info('en-GB', 'wind', 'Yellow wind warning')] }, uuid: 'x-1' },
    { alert: { identifier: 'urn:oid:TEST.0002', sent: isoZ(now - 2 * H), msgType: 'Alert',
      info: [{ language: 'hu-HU', event: 'hőség', onset: isoZ(now - 48 * H), expires: isoZ(now - 30 * H), severity: 'Moderate',
        parameter: [{ valueName: 'awareness_level', value: '2; yellow; Moderate' }, { valueName: 'awareness_type', value: '5; High-temperature' }], area: [{ areaDesc: 'Csongrád-Csanád' }] }] } },
  ] };
}

function hungarometObs(now) {
  const st = [['12843', 'Budapest-Pestszentlorinc', 47.429, 19.182, 138], ['12839', 'Budapest Liszt Ferenc repuloter', 47.433, 19.262, 151], ['12882', 'Debrecen', 47.489, 21.615, 108]];
  const lines = ['Time;StationNumber;StationName;Latitude;Longitude;Elevation;r;Q_r;ta;Q_ta;u;Q_u;sg;Q_sg;f;Q_f;fd;Q_fd;fx;Q_fx;p0;Q_p0;EOR'];
  const end = Math.floor(now / 600e3) * 600e3;
  for (let t = end - 24 * H; t <= end; t += 600e3) {
    const x = truth(t, now), d = new Date(t);
    const stamp = d.getUTCFullYear() + [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()].map(n => String(n).padStart(2, '0')).join('');
    for (const [id, name, lat, lon, el] of st)
      lines.push([stamp, id, name, lat, lon, el, (x.rain / 6).toFixed(2), ' ', x.temp.toFixed(1), ' ', Math.round(x.rh), ' ', -999, ' ', x.wind.toFixed(1), ' ', 290, ' ', x.gust.toFixed(1), ' ', x.p.toFixed(1), ' ', 'EOR'].join(';'));
  }
  lines.push(...require('./fixtures-map').stationLines(now).lines);   // ~40 invented stations for the map's field
  return zip.make('HABP_10M_SYNOP_LATEST.csv', lines.join('\r\n'));
}

function lightning(now) {
  return ['Time;Latitude;Longitude;Current', `${isoZ(now - 10 * 60e3)};47.540;19.140;-12.3`, `${isoZ(now - 3 * H)};46.10;18.20;8.1`,
    ...require('./fixtures-map').strikeLines(now)].join('\n');
}

function pvgis() {
  const E = [38, 55, 92, 118, 135, 140, 146, 135, 103, 75, 41, 31];
  return { inputs: { location: { latitude: 47.4979, longitude: 19.0402 }, mounting_system: { fixed: { slope: { value: 35 }, azimuth: { value: 0 } } } },
    outputs: { monthly: { fixed: E.map((e, i) => ({ month: i + 1, E_d: +(e / 30).toFixed(2), E_m: e, 'H(i)_d': +(e / 30 / 0.85).toFixed(2), 'H(i)_m': +(e / 0.85).toFixed(1), SD_m: 8 })) },
      totals: { fixed: { E_d: 3.2, E_m: 100.8, E_y: E.reduce((a, b) => a + b, 0), 'H(i)_y': 1430, SD_y: 50 } } }, meta: {} };
}

function make(dir, nowIso) {
  seed = 1;
  const now = new Date(nowIso).getTime();
  fs.mkdirSync(dir, { recursive: true });
  const w = (f, d) => fs.writeFileSync(path.join(dir, f), Buffer.isBuffer(d) ? d : typeof d === 'string' ? d : JSON.stringify(d));
  w('open-meteo.json', openMeteo(now));
  w('open-meteo-aq.json', { hourly: { time: openMeteo(now).hourly.time, pm2_5: openMeteo(now).hourly.time.map(() => 18), pm10: openMeteo(now).hourly.time.map(() => 25), european_aqi: openMeteo(now).hourly.time.map(() => 35), ragweed_pollen: openMeteo(now).hourly.time.map(() => 0) } });
  w('met-no.json', metNo(now));
  w('dwd-mosmix.kmz', mosmix(now));
  w('meteoalarm.json', meteoalarm(now));
  w('hungaromet-obs.zip', hungarometObs(now));
  w('hungaromet-lightning.csv', lightning(now));
  w('pvgis.json', pvgis());
  // the VRG Térkép fields: grid answers, radar frames (test/fixtures-map.js)
  const M = require('./fixtures-map');
  for (const files of [M.openMeteoGrid(now), M.metNoGrid(now), M.radarFrames(now)]) for (const [f, d] of Object.entries(files)) w(f, d);
  return dir;
}

module.exports = { make, truth };
if (require.main === module) {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'demo-replay'));
  console.log('Kitalalt valaszok: ' + make(dir, process.argv[3] || new Date().toISOString()));
}
