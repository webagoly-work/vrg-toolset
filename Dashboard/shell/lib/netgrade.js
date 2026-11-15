// netgrade.js — the network / machine metrics of the title bar's corner row (WP-49b), as pure functions shared by main (CommonJS) and
// the frame page (window.VRGNetGrade). Each metric: an id, its labels, how to show a value and which colour it earns.
//   METRICS                    [{ id, hu, en, unit }] in the order they are drawn
//   grade(id, v)               'ok' | 'warn' | 'crit' | 'info' (no judgement: traffic) | 'none' (no value)
//   fmt(id, v)                 the text of the value: '78%', '23 ms', '1.4 Mb/s' …
//   validList(v)               a settings value for net.metrics: known ids, no repeats
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGNetGrade = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const METRICS = [
    { id: 'wifi', hu: 'Wi-Fi jel', en: 'Wi-Fi signal', unit: '%', short: 'WiFi' },
    { id: 'ping', hu: 'Ping (internet)', en: 'Latency', unit: 'ms', short: 'Ping' },
    { id: 'jitter', hu: 'Ingadozás', en: 'Jitter', unit: 'ms', short: 'Jit' },
    { id: 'loss', hu: 'Csomagvesztés', en: 'Packet loss', unit: '%', short: 'Vesz' },
    { id: 'dns', hu: 'DNS válaszidő', en: 'DNS lookup', unit: 'ms', short: 'DNS' },
    { id: 'link', hu: 'Wi-Fi sebesség (link)', en: 'Wi-Fi link rate', unit: 'Mb/s', short: 'Link' },
    { id: 'down', hu: 'Letöltés most', en: 'Download now', unit: 'b/s', short: '↓' },
    { id: 'up', hu: 'Feltöltés most', en: 'Upload now', unit: 'b/s', short: '↑' },
    { id: 'cpu', hu: 'Processzor', en: 'CPU', unit: '%', short: 'CPU' },
    { id: 'ram', hu: 'Memória', en: 'RAM', unit: '%', short: 'RAM' },
  ];
  const IDS = METRICS.map(m => m.id);
  const DEFAULT = ['wifi', 'ping', 'loss', 'down', 'up'];
  // [ok when <= / >=, warn when <= / >=]; higher-is-better metrics carry hi: true
  const T = {
    wifi: { hi: true, ok: 60, warn: 35 },
    link: { hi: true, ok: 100, warn: 20 },
    ping: { ok: 60, warn: 150 },
    jitter: { ok: 15, warn: 40 },
    loss: { ok: 0, warn: 5 },
    dns: { ok: 80, warn: 250 },
    cpu: { ok: 60, warn: 85 },
    ram: { ok: 75, warn: 90 },
  };
  const num = v => typeof v === 'number' && isFinite(v);
  function grade(id, v) {
    if (!num(v)) return 'none';
    const t = T[id];
    if (!t) return 'info';
    if (t.hi) return v >= t.ok ? 'ok' : v >= t.warn ? 'warn' : 'crit';
    return v <= t.ok ? 'ok' : v <= t.warn ? 'warn' : 'crit';
  }
  function rate(bps) {
    const u = [['Gb/s', 1e9], ['Mb/s', 1e6], ['kb/s', 1e3]];
    for (const [n, d] of u) if (bps >= d) return (bps / d >= 100 ? Math.round(bps / d) : (Math.round(bps / d * 10) / 10)) + ' ' + n;
    return Math.round(bps) + ' b/s';
  }
  function fmt(id, v) {
    if (!num(v)) return '—';
    const m = METRICS.find(x => x.id === id);
    if (!m) return String(v);
    if (id === 'down' || id === 'up') return rate(v);
    if (m.unit === '%') return Math.round(v) + '%';
    if (id === 'link') return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + ' Mb/s';
    return Math.round(v) + ' ' + m.unit;
  }
  const validList = v => Array.isArray(v) && v.length <= IDS.length && v.every((x, i) => IDS.includes(x) && v.indexOf(x) === i);
  return { METRICS, IDS, DEFAULT, grade, fmt, rate, validList };
});
