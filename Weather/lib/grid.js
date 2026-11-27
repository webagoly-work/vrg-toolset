// VRG Időjárás — gridded fields for the VRG Térkép weather layers.
//
// A grid is a regular lon/lat lattice over Hungary (settings.grid.bbox), row-major from the south-west corner:
// index = row * nx + col, row 0 = the southern edge. A frame is one variable at one valid time, a Float32Array
// (NaN = no value), stored in grid_frame. Field variables (not the point vars of lib/vars.js):
//
//   t2m °C · precip mm/h · cloud % · u, v m/s (wind towards east / north) · gust m/s · cape J/kg
//
// Sources: Open-Meteo on a fine grid (key or evaluation), MET Norway on a coarse grid (company use allowed),
// and 'obs-idw': the HungaroMet stations interpolated (inverse distance) every 10 minutes for the last hours.
'use strict';

const { iso, nowIso } = require('./db');
const { now, addH, km } = require('./common');

const FIELD = {
  t2m: { scale: 0.1, unit: '°C', hu: 'Hőmérséklet' },
  precip: { scale: 0.01, unit: 'mm/h', hu: 'Csapadék' },
  cloud: { scale: 1, unit: '%', hu: 'Felhőzet' },
  u: { scale: 0.1, unit: 'm/s', hu: 'Szél (K-i összetevő)' },
  v: { scale: 0.1, unit: 'm/s', hu: 'Szél (É-i összetevő)' },
  gust: { scale: 0.1, unit: 'm/s', hu: 'Széllökés' },
  cape: { scale: 10, unit: 'J/kg', hu: 'CAPE' },
};

function def(settings, step) {
  const g = (settings && settings.grid) || {};
  const [w, s, e, n] = g.bbox || [16.0, 45.6, 23.0, 48.7];
  const nx = Math.round((e - w) / step) + 1, ny = Math.round((n - s) / step) + 1;
  return { lon0: w, lat0: s, dlon: step, dlat: step, nx, ny };
}
function points(d) {
  const out = [];
  for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) out.push({ i, j, lon: +(d.lon0 + i * d.dlon).toFixed(4), lat: +(d.lat0 + j * d.dlat).toFixed(4) });
  return out;
}
const uv = (speed, dirFrom) => {
  if (speed == null || dirFrom == null) return [NaN, NaN];
  const r = dirFrom * Math.PI / 180;
  return [-speed * Math.sin(r), -speed * Math.cos(r)];
};

/* collect point values into frames: put(index, validIso, var, value) then frames() */
function builder(d) {
  const n = d.nx * d.ny, m = new Map();
  return {
    put(idx, valid, v, value) {
      if (value == null || !Number.isFinite(value)) return;
      const k = valid + '|' + v;
      let a = m.get(k);
      if (!a) { a = new Float32Array(n).fill(NaN); m.set(k, a); }
      a[idx] = value;
    },
    frames() { return [...m].map(([k, data]) => { const [valid, v] = k.split('|'); return { valid, var: v, data }; }); },
  };
}

// a few missing cells (a point the source skipped) are filled from their neighbours, so the map has no holes
function fillGaps(d, a) {
  for (let pass = 0; pass < 3; pass++) {
    let left = 0;
    for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) {
      const k = j * d.nx + i;
      if (!Number.isNaN(a[k])) continue;
      let s = 0, c = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= d.nx || y >= d.ny) continue;
        const v = a[y * d.nx + x]; if (!Number.isNaN(v)) { s += v; c++; }
      }
      if (c) a[k] = s / c; else left++;
    }
    if (!left) break;
  }
  return a;
}

function store(db, sourceId, issued, d, frames) {
  return db.tx(() => {
    // one issue per source is enough for the map: the newer replaces the older
    db.run('DELETE FROM grid_frame WHERE source_id = ?', sourceId);
    const st = 'INSERT OR REPLACE INTO grid_frame (source_id, issued_at, valid_at, var, lon0, lat0, dlon, dlat, nx, ny, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    for (const f of frames) db.run(st, sourceId, issued, f.valid, f.var, d.lon0, d.lat0, d.dlon, d.dlat, d.nx, d.ny, new Uint8Array(fillGaps(d, f.data).buffer));
    return frames.length;
  });
}

function read(db, sourceId) {
  const rows = db.all('SELECT * FROM grid_frame WHERE source_id = ? ORDER BY valid_at, var', sourceId);
  if (!rows.length) return null;
  const r0 = rows[0];
  const frames = rows.map(r => ({ valid: r.valid_at, var: r.var, data: new Float32Array(r.data.buffer.slice(r.data.byteOffset, r.data.byteOffset + r.data.byteLength)) }));
  return { source: sourceId, issued: r0.issued_at, grid: { lon0: r0.lon0, lat0: r0.lat0, dlon: r0.dlon, dlat: r0.dlat, nx: r0.nx, ny: r0.ny }, frames };
}

// Int16 quantised, base64: ~0.75 KB per frame on the 0.25° grid; -32768 = no value
function encode(f, v) {
  const sc = (FIELD[v] && FIELD[v].scale) || 0.1;
  const q = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) q[i] = Number.isNaN(f[i]) ? -32768 : Math.max(-32767, Math.min(32767, Math.round(f[i] / sc)));
  return Buffer.from(q.buffer).toString('base64');
}

// ---------------------------------------------------------------- the measured field (HungaroMet stations, IDW)
function idw(d, stations, power = 2, maxKm = 120) {
  const out = new Float32Array(d.nx * d.ny).fill(NaN);
  if (!stations.length) return out;
  for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) {
    const p = { lon: d.lon0 + i * d.dlon, lat: d.lat0 + j * d.dlat };
    let sw = 0, s = 0, hit = null;
    for (const st of stations) {
      const dist = km(p, st);
      if (dist < 0.5) { hit = st.value; break; }
      if (dist > maxKm) continue;
      const w = 1 / dist ** power; sw += w; s += w * st.value;
    }
    out[j * d.nx + i] = hit != null ? hit : sw ? s / sw : NaN;
  }
  return out;
}

function buildObs(ctx) {
  const { db, settings } = ctx;
  const g = settings.grid || {};
  const d = def(settings, g.obsStep || 0.1);
  const hours = g.obsHours || 3;
  const since = addH(iso(now()), -hours);
  const st = new Map(db.all("SELECT id, lat, lon FROM station WHERE source_id = 'hungaromet-obs'").map(s => [s.id, s]));
  const rows = db.all("SELECT station_id, observed_at, var, value FROM observation WHERE source_id = 'hungaromet-obs' AND observed_at >= ? AND var IN ('t2m', 'wind', 'wdir', 'gust', 'precip10')", since);
  // time -> station -> vars
  const byT = new Map();
  for (const r of rows) {
    if (!st.has(r.station_id)) continue;
    if (!byT.has(r.observed_at)) byT.set(r.observed_at, new Map());
    const m = byT.get(r.observed_at);
    if (!m.has(r.station_id)) m.set(r.station_id, {});
    m.get(r.station_id)[r.var] = r.value;
  }
  const times = [...byT.keys()].sort().filter(t => byT.get(t).size >= 2);
  const frames = [];
  for (const t of times) {
    const m = byT.get(t);
    const list = v => [...m].filter(([, x]) => x[v] != null).map(([id, x]) => ({ ...st.get(id), value: x[v] }));
    frames.push({ valid: t, var: 't2m', data: idw(d, list('t2m')) });
    frames.push({ valid: t, var: 'gust', data: idw(d, list('gust')) });
    frames.push({ valid: t, var: 'precip', data: idw(d, list('precip10').map(s => ({ ...s, value: s.value * 6 })), 2, 40) });
    const w = [...m].filter(([, x]) => x.wind != null && x.wdir != null).map(([id, x]) => ({ ...st.get(id), uv: uv(x.wind, x.wdir) }));
    frames.push({ valid: t, var: 'u', data: idw(d, w.map(s => ({ ...s, value: s.uv[0] }))) });
    frames.push({ valid: t, var: 'v', data: idw(d, w.map(s => ({ ...s, value: s.uv[1] }))) });
  }
  if (!frames.length) return { frames: 0 };
  return { frames: store(db, 'obs-idw', nowIso(), d, frames), times: times.length };
}

module.exports = { FIELD, def, points, uv, builder, fillGaps, store, read, encode, idw, buildObs };
