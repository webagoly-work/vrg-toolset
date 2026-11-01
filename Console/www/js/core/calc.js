/* Trade calculators. Pure functions on plain numbers; the pages add the warnings about what each
   one leaves out. Conductivity in m/(Ω·mm²). */
export const CONDUCTIVITY = { cu: 56, al: 35 };
export const SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
export const SQRT3 = Math.sqrt(3);

const factor = (phases) => (phases === 3 ? SQRT3 : 2);

/* resistive drop only, reactance ignored */
export function voltageDrop({ phases, length, current, area, cosPhi = 1, material = 'cu', voltage }) {
  const volts = factor(phases) * length * current * cosPhi / (CONDUCTIVITY[material] * area);
  return { volts, percent: volts / voltage * 100 };
}

/* smallest standard size that keeps the drop within the limit; null if none does */
export function sizeForDrop({ maxPercent, ...load }) {
  return SIZES.find((area) => voltageDrop({ ...load, area }).percent <= maxPercent) ?? null;
}

export const ampsFromKw = ({ kw, voltage, phases, cosPhi = 1 }) =>
  kw * 1000 / ((phases === 3 ? SQRT3 : 1) * voltage * cosPhi);

export const kwFromAmps = ({ amps, voltage, phases, cosPhi = 1 }) =>
  amps * voltage * (phases === 3 ? SQRT3 : 1) * cosPhi / 1000;

/* give any two of U, I, R, P */
export function ohm({ u, i, r, p }) {
  const has = (v) => v != null;
  if (has(u) && has(i)) return { u, i, r: u / i, p: u * i };
  if (has(u) && has(r)) return { u, r, i: u / r, p: u * u / r };
  if (has(u) && has(p)) return { u, p, i: p / u, r: u * u / p };
  if (has(i) && has(r)) return { i, r, u: i * r, p: i * i * r };
  if (has(i) && has(p)) return { i, p, u: p / i, r: p / (i * i) };
  if (has(r) && has(p)) { const c = Math.sqrt(p / r); return { r, p, i: c, u: c * r }; }
  return null;
}

/* lumen method */
export function luminaires({ lux, area, lumens, utilisation, maintenance }) {
  const exact = lux * area / (lumens * utilisation * maintenance);
  return { exact, count: Math.ceil(exact - 1e-9) };
}

export function phaseBalance({ l1, l2, l3 }) {
  const all = [l1, l2, l3];
  const mean = (l1 + l2 + l3) / 3;
  const max = Math.max(...all);
  const imbalance = mean === 0 ? 0 : Math.max(...all.map((v) => Math.abs(v - mean))) / mean * 100;
  return { mean, max, imbalance, heaviest: all.indexOf(max) + 1 };
}

export function ledSizing({ wattsPerMetre, metres, voltage, reservePct }) {
  const watts = wattsPerMetre * metres;
  const sized = watts * (1 + reservePct / 100);
  return { watts, amps: watts / voltage, supplyWatts: sized };
}
