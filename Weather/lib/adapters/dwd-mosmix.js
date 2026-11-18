// DWD MOSMIX_L single-station KMZ — https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_parameteruebersicht.pdf
// A zipped KML: ProductDefinition/IssueTime, ForecastTimeSteps/TimeStep[], and per Placemark a list of
// <dwd:Forecast dwd:elementName="TTT"><dwd:value> v v v …</dwd:value>, one value per time step, "-" = none.
// Units: TTT/Td K, FF/FX1 m/s, DD °, RR1c kg/m² (= mm) last hour, N %, PPPP Pa, Rad1h kJ/m² last hour,
// ww present-weather code (WMO 4677), R101 % P(precip > 0.1 mm) last hour, wwT % P(thunderstorm) last hour,
// VV m visibility.
'use strict';
const zip = require('../zip');
const { U } = require('../vars');
const { iso } = require('../db');

// WMO 4677 ww -> the WMO 4680-like subset of lib/vars.js
function mapWw(ww) {
  if (ww == null || !Number.isFinite(ww)) return null;
  ww = Math.round(ww);
  if (ww >= 95) return ww === 95 ? 95 : ww === 97 ? 99 : 96;
  if (ww >= 91 && ww <= 94) return 95;                 // thunder in the last hour
  if (ww >= 85) return ww === 85 ? 85 : 86;
  if (ww >= 80) return ww === 80 ? 80 : ww === 81 ? 81 : ww <= 84 ? 82 : 81;
  if (ww >= 70) return ww <= 71 ? 71 : ww <= 73 ? 73 : ww <= 75 ? 75 : 77;
  if (ww >= 66) return ww === 66 ? 66 : ww === 67 ? 67 : 66;  // 68/69 rain and snow: treat as sleet
  if (ww >= 60) return ww <= 61 ? 61 : ww <= 63 ? 63 : 65;
  if (ww >= 56) return ww === 56 ? 56 : 57;
  if (ww >= 50) return ww <= 51 ? 51 : ww <= 53 ? 53 : 55;
  if (ww >= 40) return ww >= 48 ? 48 : 45;
  if (ww >= 17 && ww <= 19) return 95;                 // thunder heard, no precipitation
  if (ww <= 3) return ww;
  return null;
}

const tag = (xml, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml); return m ? m[1].trim() : null; };

module.exports = {
  scope: 'station',
  ext: 'kmz',
  url: (src, station) => src.url.split('{station}').join(station.id),
  mapWw,
  parse(buf, src, station, places) {
    const kml = (buf[0] === 0x50 && buf[1] === 0x4b ? zip.first(buf, /\.kml$/i) : buf).toString('utf8');
    const issued = iso(tag(kml, 'dwd:IssueTime')) || iso(new Date());
    const steps = [...kml.matchAll(/<dwd:TimeStep>([^<]+)<\/dwd:TimeStep>/g)].map(m => iso(m[1]));
    const el = {};
    for (const m of kml.matchAll(/<dwd:Forecast\s+dwd:elementName="([^"]+)">\s*<dwd:value>([\s\S]*?)<\/dwd:value>/g)) {
      el[m[1]] = m[2].trim().split(/\s+/).map(v => (v === '-' || v === '' ? null : Number(v)));
    }
    if (!steps.length || !el.TTT) throw new Error('MOSMIX: no time steps or no TTT');
    const out = [];
    for (const place of places) {
      const put = (i, v, value) => { if (value != null && Number.isFinite(value)) out.push({ source: src.id, model: 'mosmix:' + station.id, place: place.id, issued, valid: steps[i], var: v, value }); };
      for (let i = 0; i < steps.length; i++) {
        const g = k => (el[k] ? el[k][i] : null);
        const t = g('TTT') != null ? U.k2c(g('TTT')) : null, td = g('Td') != null ? U.k2c(g('Td')) : null;
        const rh = t != null && td != null ? 100 * Math.exp(17.625 * td / (243.04 + td)) / Math.exp(17.625 * t / (243.04 + t)) : null;
        put(i, 't2m', t); put(i, 'dew2m', td); put(i, 'rh2m', rh);
        put(i, 'wind', g('FF')); put(i, 'gust', g('FX1')); put(i, 'wdir', g('DD'));
        put(i, 'precip', g('RR1c')); put(i, 'pop', g('R101')); put(i, 'pthunder', g('wwT'));
        put(i, 'cloud', g('N')); put(i, 'pmsl', g('PPPP') != null ? U.pa2hpa(g('PPPP')) : null);
        put(i, 'swrad', g('Rad1h') != null ? g('Rad1h') / 3.6 : null);        // kJ/m² in an hour -> mean W/m²
        put(i, 'vis', g('VV')); put(i, 'wmo', mapWw(g('ww')));
        put(i, 'tapp', U.apparent(t, rh, g('FF')));
      }
    }
    return { forecast: out };
  },
};
