// VRG Időjárás — the canonical variables. Every adapter maps its own field names onto these ids and
// units, so the database, the fusion, the rules and the page only ever see one vocabulary.
//
//   id        short, stable, used as the `var` column everywhere (never rename one: old rows keep it)
//   unit      the one unit stored; adapters convert on the way in
//   kind      'cont'  continuous, fused by weighted mean, spread = weighted standard deviation
//             'sum'   per-hour amount (precipitation), fused by weighted median (one wet model must not
//                     make every hour wet), spread = interquartile range
//             'prob'  0-100 %, fused by weighted mean
//             'dir'   degrees, fused as a vector mean
//             'code'  WMO weather code, fused by the most severe code that at least two sources (or the
//                     only source) agree on — see fuseCode() in fuse.js
//   hu        Hungarian label for the page and the brief
'use strict';

const VARS = {
  t2m:     { unit: '°C',    kind: 'cont', hu: 'Hőmérséklet' },
  tapp:    { unit: '°C',    kind: 'cont', hu: 'Hőérzet' },
  dew2m:   { unit: '°C',    kind: 'cont', hu: 'Harmatpont' },
  rh2m:    { unit: '%',     kind: 'cont', hu: 'Relatív páratartalom' },
  precip:  { unit: 'mm/h',  kind: 'sum',  hu: 'Csapadék' },
  pop:     { unit: '%',     kind: 'prob', hu: 'Csapadék valószínűsége' },
  pthunder:{ unit: '%',     kind: 'prob', hu: 'Zivatar valószínűsége' },
  snow:    { unit: 'cm/h',  kind: 'sum',  hu: 'Hó' },
  wind:    { unit: 'm/s',   kind: 'cont', hu: 'Szél (10 m)' },
  gust:    { unit: 'm/s',   kind: 'cont', hu: 'Széllökés' },
  wdir:    { unit: '°',     kind: 'dir',  hu: 'Szélirány' },
  cloud:   { unit: '%',     kind: 'cont', hu: 'Felhőzet' },
  pmsl:    { unit: 'hPa',   kind: 'cont', hu: 'Légnyomás (tszf.)' },
  cape:    { unit: 'J/kg',  kind: 'cont', hu: 'CAPE (labilitás)' },
  lpi:     { unit: 'J/kg',  kind: 'cont', hu: 'Villámpotenciál' },
  wmo:     { unit: 'kód',   kind: 'code', hu: 'Időkép' },
  swrad:   { unit: 'W/m²',  kind: 'cont', hu: 'Napsugárzás (GHI)' },
  uv:      { unit: '',      kind: 'cont', hu: 'UV-index' },
  vis:     { unit: 'm',     kind: 'cont', hu: 'Látótávolság' },
  tsoil0:  { unit: '°C',    kind: 'cont', hu: 'Talajfelszín hőm.' },
  frzlvl:  { unit: 'm',     kind: 'cont', hu: 'Fagyszint' },
  // air quality and pollen (CAMS through Open-Meteo); ragweed is the Hungarian summer one
  pm25:    { unit: 'µg/m³', kind: 'cont', hu: 'PM2,5' },
  pm10:    { unit: 'µg/m³', kind: 'cont', hu: 'PM10' },
  o3:      { unit: 'µg/m³', kind: 'cont', hu: 'Ózon' },
  no2:     { unit: 'µg/m³', kind: 'cont', hu: 'NO₂' },
  eaqi:    { unit: '',      kind: 'cont', hu: 'Európai légminőség-index' },
  ragweed: { unit: 'db/m³', kind: 'cont', hu: 'Parlagfű pollen' },
  grass:   { unit: 'db/m³', kind: 'cont', hu: 'Fűpollen' },
  birch:   { unit: 'db/m³', kind: 'cont', hu: 'Nyírpollen' },
};

// WMO 4677-derived code table as used by Open-Meteo (WW 0-99 subset). `sev` orders codes by how much
// they disturb outdoor work, so the fusion can pick "the worst agreed" and the rules can test ranges.
const WMO = {
  0: { hu: 'derült', sev: 0, icon: 'sun' },
  1: { hu: 'túlnyomóan derült', sev: 1, icon: 'sun' },
  2: { hu: 'részben felhős', sev: 2, icon: 'part' },
  3: { hu: 'borult', sev: 3, icon: 'cloud' },
  45: { hu: 'köd', sev: 10, icon: 'fog' },
  48: { hu: 'zúzmarás köd', sev: 12, icon: 'fog' },
  51: { hu: 'gyenge szitálás', sev: 20, icon: 'drizzle' },
  53: { hu: 'szitálás', sev: 21, icon: 'drizzle' },
  55: { hu: 'erős szitálás', sev: 22, icon: 'drizzle' },
  56: { hu: 'ónos szitálás', sev: 40, icon: 'ice' },
  57: { hu: 'erős ónos szitálás', sev: 42, icon: 'ice' },
  61: { hu: 'gyenge eső', sev: 24, icon: 'rain' },
  63: { hu: 'eső', sev: 26, icon: 'rain' },
  65: { hu: 'erős eső', sev: 30, icon: 'rain' },
  66: { hu: 'ónos eső', sev: 44, icon: 'ice' },
  67: { hu: 'erős ónos eső', sev: 46, icon: 'ice' },
  71: { hu: 'gyenge havazás', sev: 32, icon: 'snow' },
  73: { hu: 'havazás', sev: 34, icon: 'snow' },
  75: { hu: 'erős havazás', sev: 38, icon: 'snow' },
  77: { hu: 'hószemcse', sev: 31, icon: 'snow' },
  80: { hu: 'gyenge zápor', sev: 25, icon: 'shower' },
  81: { hu: 'zápor', sev: 28, icon: 'shower' },
  82: { hu: 'heves zápor', sev: 36, icon: 'shower' },
  85: { hu: 'hózápor', sev: 33, icon: 'snow' },
  86: { hu: 'erős hózápor', sev: 37, icon: 'snow' },
  95: { hu: 'zivatar', sev: 50, icon: 'thunder' },
  96: { hu: 'zivatar jégesővel', sev: 55, icon: 'thunder' },
  99: { hu: 'heves zivatar jégesővel', sev: 60, icon: 'thunder' },
};
const wmoSev = c => (WMO[c] ? WMO[c].sev : -1);
const isThunder = c => c >= 95 && c <= 99;

// MET Norway symbol_code (without the _day/_night/_polartwilight suffix) -> nearest WMO code
const MET_SYMBOL = {
  clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
  lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
  lightsleet: 66, sleet: 66, heavysleet: 67, lightsleetshowers: 66, sleetshowers: 66, heavysleetshowers: 67,
  lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86,
};
function metSymbolToWmo(sym) {
  if (!sym) return null;
  const base = String(sym).replace(/_(day|night|polartwilight)$/, '');
  if (/thunder/.test(base)) return /heavy/.test(base) ? 99 : /snow|sleet/.test(base) ? 96 : 95;
  return base in MET_SYMBOL ? MET_SYMBOL[base] : null;
}

// conversions adapters need
const U = {
  kmh2ms: v => v / 3.6,
  kt2ms: v => v * 0.514444,
  k2c: v => v - 273.15,
  pa2hpa: v => v / 100,
  // Magnus formula, good to ~0.1 °C in field conditions
  dewpoint(t, rh) {
    if (t == null || rh == null || rh <= 0) return null;
    const a = 17.62, b = 243.12, g = Math.log(rh / 100) + a * t / (b + t);
    return b * g / (a - g);
  },
  // Australian BoM apparent temperature (no radiation term), wind in m/s
  apparent(t, rh, wind) {
    if (t == null || rh == null) return null;
    const e = rh / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
    return t + 0.33 * e - 0.7 * (wind || 0) - 4;
  },
};

module.exports = { VARS, WMO, wmoSev, isThunder, metSymbolToWmo, U };
