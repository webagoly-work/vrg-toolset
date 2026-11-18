// Open-Meteo forecast API, several models in one call — https://open-meteo.com/en/docs
// With models=a,b every hourly key gets the model as a suffix (temperature_2m_icon_d2); with one model
// it has none. wind_speed_unit=ms, timezone=GMT, times "2026-11-18T06:00" (UTC, no zone letter).
// The response does not say when the model ran, so `issued` is the fetch hour: lead times are counted
// from when we asked, which is what the crew experiences anyway.
// Commercial use: only through customer-api.open-meteo.com with an apikey (settings.local.json keys.openMeteo).
'use strict';
const { U } = require('../vars');
const { hourFloor, now } = require('../common');

const FIELDS = {
  temperature_2m: 't2m', relative_humidity_2m: 'rh2m', dew_point_2m: 'dew2m', apparent_temperature: 'tapp',
  precipitation: 'precip', precipitation_probability: 'pop', snowfall: 'snow', weather_code: 'wmo',
  cloud_cover: 'cloud', pressure_msl: 'pmsl', wind_speed_10m: 'wind', wind_direction_10m: 'wdir',
  wind_gusts_10m: 'gust', cape: 'cape', lightning_potential: 'lpi', shortwave_radiation: 'swrad',
  visibility: 'vis', uv_index: 'uv', soil_temperature_0cm: 'tsoil0', freezing_level_height: 'frzlvl',
};

module.exports = {
  scope: 'place',
  ext: 'json',
  FIELDS,
  url(src, place, settings) {
    const key = settings.keys && settings.keys.openMeteo;
    const base = key ? src.url_key : src.url;
    const q = new URLSearchParams({
      latitude: place.lat.toFixed(4), longitude: place.lon.toFixed(4), elevation: String(place.elev ?? 'nan'),
      hourly: Object.keys(FIELDS).join(','), models: (src.models || []).join(','),
      wind_speed_unit: 'ms', precipitation_unit: 'mm', timezone: 'GMT', forecast_days: '4', past_days: '1',
    });
    if (key) q.set('apikey', key);
    return base + '?' + q.toString();
  },
  parse(buf, src, place) {
    const j = JSON.parse(buf.toString('utf8'));
    if (j.error) throw new Error('Open-Meteo: ' + j.reason);
    const h = j.hourly || {};
    const times = (h.time || []).map(t => (t.endsWith('Z') ? t : t + 'Z'));
    const models = (src.models && src.models.length) ? src.models : [''];
    const issued = hourFloor(now());
    const out = [];
    for (const model of models) {
      const suffix = models.length > 1 ? '_' + model : '';
      const member = model || 'best_match';
      for (const [field, v] of Object.entries(FIELDS)) {
        const arr = h[field + suffix];
        if (!arr) continue;
        for (let i = 0; i < times.length; i++) {
          const value = arr[i];
          if (value == null) continue;
          out.push({ source: src.id, model: member, place: place.id, issued, valid: times[i], var: v, value: v === 'snow' ? value : value });
        }
      }
      // dew point / apparent temperature when a model lacks them
      if (!h['dew_point_2m' + suffix] && h['temperature_2m' + suffix] && h['relative_humidity_2m' + suffix]) {
        for (let i = 0; i < times.length; i++) {
          const d = U.dewpoint(h['temperature_2m' + suffix][i], h['relative_humidity_2m' + suffix][i]);
          if (d != null) out.push({ source: src.id, model: member, place: place.id, issued, valid: times[i], var: 'dew2m', value: d });
        }
      }
    }
    return { forecast: out };
  },
};
