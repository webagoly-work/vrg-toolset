// Open-Meteo Air Quality API (CAMS Europe 11 km) — https://open-meteo.com/en/docs/air-quality-api
// hourly: pm10, pm2_5, nitrogen_dioxide, ozone, european_aqi, ragweed_pollen, grass_pollen, birch_pollen.
'use strict';
const { hourFloor, now } = require('../common');

const FIELDS = { pm2_5: 'pm25', pm10: 'pm10', ozone: 'o3', nitrogen_dioxide: 'no2', european_aqi: 'eaqi', ragweed_pollen: 'ragweed', grass_pollen: 'grass', birch_pollen: 'birch' };

module.exports = {
  scope: 'place',
  ext: 'json',
  url(src, place, settings) {
    const key = settings.keys && settings.keys.openMeteo;
    const q = new URLSearchParams({ latitude: place.lat.toFixed(4), longitude: place.lon.toFixed(4), hourly: Object.keys(FIELDS).join(','), domains: 'cams_europe', timezone: 'GMT', forecast_days: '4' });
    if (key) q.set('apikey', key);
    return (key ? src.url_key : src.url) + '?' + q.toString();
  },
  parse(buf, src, place) {
    const j = JSON.parse(buf.toString('utf8'));
    if (j.error) throw new Error('Open-Meteo AQ: ' + j.reason);
    const h = j.hourly || {}, issued = hourFloor(now()), out = [];
    const times = (h.time || []).map(t => (t.endsWith('Z') ? t : t + 'Z'));
    for (const [f, v] of Object.entries(FIELDS)) {
      const arr = h[f]; if (!arr) continue;
      for (let i = 0; i < times.length; i++) if (arr[i] != null) out.push({ source: src.id, model: 'cams', place: place.id, issued, valid: times[i], var: v, value: arr[i] });
    }
    return { forecast: out };
  },
};
