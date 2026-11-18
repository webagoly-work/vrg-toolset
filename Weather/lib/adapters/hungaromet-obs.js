// HungaroMet 10-minute SYNOP observations (odp.met.hu) — a zipped, semicolon CSV, one row per station.
// Read by header through sources.json "columns" (lib/csv.js). Units as published: °C, %, mm per 10 min,
// m/s, degrees, hPa, W/m². The parser is unverified against a live file (research 01): `doctor --live`
// reports which configured columns were found.
'use strict';
const zip = require('../zip');
const CSV = require('../csv');
const { iso } = require('../db');

const VARS = ['t2m', 'rh2m', 'precip10', 'wind', 'wdir', 'gust', 'pmsl', 'swrad'];

module.exports = {
  scope: 'global',
  ext: 'zip',
  VARS,
  url: src => src.url,
  parse(buf, src) {
    const text = (buf[0] === 0x50 && buf[1] === 0x4b ? zip.first(buf, /\.(csv|txt)$/i) : buf).toString('utf8');
    const { rows, idx } = CSV.table(text, src.columns, ['time', 'station']);
    const miss = src.missing || [];
    const observation = [], stations = new Map();
    for (const r of rows) {
      const at = iso(CSV.time(r.time)); if (!at) continue;
      const st = String(r.station).trim(); if (!st) continue;
      const lat = CSV.num(r.lat, miss), lon = CSV.num(r.lon, miss);
      if (lat != null && lon != null) stations.set(st, { source: src.id, id: st, name: r.name || null, lat, lon, elev: CSV.num(r.elev, miss), seen: at });
      for (const v of VARS) {
        if (!(v in idx)) continue;
        const value = CSV.num(r[v], miss);
        if (value != null) observation.push({ source: src.id, station: st, at, var: v, value });
      }
    }
    return { observation, stations: [...stations.values()], found: VARS.filter(v => v in idx) };
  },
};
