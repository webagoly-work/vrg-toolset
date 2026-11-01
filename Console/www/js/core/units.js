/* Unit conversion tables: factor to the base unit of each group. */
export const UNITS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048 },
  area: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, ha: 1e4 },
  power: { W: 1, kW: 1000, MW: 1e6, LE: 735.49875 },
  energy: { J: 1, kJ: 1000, Wh: 3600, kWh: 3.6e6 },
  pressure: { Pa: 1, kPa: 1000, bar: 1e5 },
  temperature: { '°C': null, '°F': null, K: null },
};

function toCelsius(v, unit) {
  if (unit === '°F') return (v - 32) * 5 / 9;
  if (unit === 'K') return v - 273.15;
  return v;
}
function fromCelsius(c, unit) {
  if (unit === '°F') return c * 9 / 5 + 32;
  if (unit === 'K') return c + 273.15;
  return c;
}

export function convert(value, group, from, to) {
  if (group === 'temperature') return fromCelsius(toCelsius(value, from), to);
  return value * UNITS[group][from] / UNITS[group][to];
}
