// MET Norway Locationforecast 2.0 /complete — https://api.met.no/weatherapi/locationforecast/2.0/documentation
// Shape: properties.meta.updated_at, properties.timeseries[] { time, data: { instant.details, next_1_hours,
// next_6_hours } }. Hourly steps for ~2.5 days, then 6-hourly; a 6-hour amount is spread evenly over its hours.
// Terms: identify with a User-Agent, max 4 decimals in coordinates, honour Expires / If-Modified-Since.
'use strict';
const { U, metSymbolToWmo } = require('../vars');
const { iso } = require('../db');
const { addH } = require('../common');

module.exports = {
  scope: 'place',
  ext: 'json',
  url(src, place) {
    return src.url.replace('{lat}', place.lat.toFixed(4)).replace('{lon}', place.lon.toFixed(4))
      .replace('{elev}', Math.round(place.elev ?? 100));
  },
  parse(buf, src, place) {
    const j = JSON.parse(buf.toString('utf8'));
    const p = j.properties || {};
    const issued = iso(p.meta && p.meta.updated_at) || iso(new Date());
    const out = [];
    const put = (valid, v, value) => { if (value != null && Number.isFinite(value)) out.push({ source: src.id, model: 'met-no', place: place.id, issued, valid, var: v, value }); };
    for (const ts of p.timeseries || []) {
      const valid = iso(ts.time), d = (ts.data && ts.data.instant && ts.data.instant.details) || {};
      put(valid, 't2m', d.air_temperature);
      put(valid, 'rh2m', d.relative_humidity);
      put(valid, 'dew2m', d.dew_point_temperature ?? U.dewpoint(d.air_temperature, d.relative_humidity));
      put(valid, 'pmsl', d.air_pressure_at_sea_level);
      put(valid, 'cloud', d.cloud_area_fraction);
      put(valid, 'wind', d.wind_speed);
      put(valid, 'wdir', d.wind_from_direction);
      put(valid, 'gust', d.wind_speed_of_gust);
      put(valid, 'uv', d.ultraviolet_index_clear_sky);
      put(valid, 'tapp', U.apparent(d.air_temperature, d.relative_humidity, d.wind_speed));
      if (d.fog_area_fraction != null && d.fog_area_fraction >= 50) put(valid, 'vis', 500);   // MET gives fog fraction, not visibility
      const n1 = ts.data && ts.data.next_1_hours, n6 = ts.data && ts.data.next_6_hours;
      // amounts are for the hour that STARTS at `time`; we store them at the hour's end, like Open-Meteo and MOSMIX
      if (n1) {
        const at = addH(valid, 1), det = n1.details || {};
        put(at, 'precip', det.precipitation_amount);
        put(at, 'pop', det.probability_of_precipitation);
        put(at, 'pthunder', det.probability_of_thunder);
        put(at, 'wmo', metSymbolToWmo(n1.summary && n1.summary.symbol_code));
      } else if (n6) {
        const det = n6.details || {}, code = metSymbolToWmo(n6.summary && n6.summary.symbol_code);
        for (let h = 1; h <= 6; h++) {
          const at = addH(valid, h);
          if (det.precipitation_amount != null) put(at, 'precip', det.precipitation_amount / 6);
          put(at, 'pop', det.probability_of_precipitation);
          put(at, 'pthunder', det.probability_of_thunder);
          put(at, 'wmo', code);
        }
      }
    }
    return { forecast: out };
  },
};
