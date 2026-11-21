// VRG Időjárás → VRG Térkép: the payloads of the map's weather layers (Map/serve.js /weather/*).
// Read-only on the database; every payload says where it comes from and how old it is.
//
//   status()          what is there: field sources, measured field, stations, strikes, warnings, radar, attribution
//   fields(mode)      'forecast' (Open-Meteo grid if allowed and present, else MET Norway grid) | 'obs' (stations, IDW)
//                     -> { source, name, attribution, issued, grid, times[], vars{ var: [base64 Int16 per time] }, scale }
//   stations()        the latest measurement of every HungaroMet station (GeoJSON)
//   lightning(min)    strikes of the last `min` minutes (GeoJSON, with age)
//   warnings()        active warnings per area, placed on config/areas.json
//   radar()           radar frames (time, file, box)
//   jobs()            per job code the worst open weather alert of the next 24 h (client data: the map asks only
//                     when its job layer is allowed)
'use strict';

const path = require('path');
const { config, now, addH, fold, areaMatch, readJson, CONFIG } = require('./common');
const { open, iso } = require('./db');
const { dbFile, isFile } = require('./common');
const G = require('./grid');
const S = require('./sources');

const RANK = { info: 1, amber: 2, red: 3 };

function make(file) {
  const cfg = config();
  const f = file || dbFile();
  const has = isFile(f);
  const db = has ? open(f, { readOnly: true }) : null;
  const src = id => cfg.sources.find(s => s.id === id);
  const allowed = id => { const s = src(id); return !!s && S.gate(s, cfg.settings).ok; };
  const areas = (() => { try { return readJson(path.join(CONFIG, 'areas.json')).areas; } catch { return []; } })();
  const tnow = () => iso(now());

  function gridInfo(id) {
    if (!db) return null;
    const r = db.get('SELECT issued_at, COUNT(DISTINCT valid_at) AS n, MIN(valid_at) AS t0, MAX(valid_at) AS t1 FROM grid_frame WHERE source_id = ?', id);
    return r && r.n ? { id, issued: r.issued_at, frames: r.n, from: r.t0, to: r.t1 } : null;
  }
  // the forecast field source: Open-Meteo when the licence gate lets it run and it has frames, else MET Norway
  function forecastSource() {
    for (const id of ['open-meteo-grid', 'met-no-grid']) if (allowed(id) && gridInfo(id)) return id;
    return null;
  }

  return {
    available: has,
    close() { if (db) db.close(); },

    status() {
      if (!db) return { on: false, reason: 'Még nincs időjárás-adatbázis: node Weather/vrg-weather.js run terkep' };
      const fc = forecastSource();
      const used = new Set([fc, 'hungaromet-obs'].filter(Boolean));
      const strikes = db.get('SELECT COUNT(*) AS n, MAX(at) AS last FROM strike WHERE at >= ?', addH(tnow(), -1));
      const warn = db.get('SELECT COUNT(*) AS n FROM warning WHERE expires >= ?', tnow()).n;
      const radar = db.get('SELECT COUNT(*) AS n, MAX(at) AS last FROM radar_frame').n ? db.get('SELECT COUNT(*) AS n, MAX(at) AS last, source_id FROM radar_frame') : null;
      if (strikes.n) used.add('hungaromet-lightning');
      if (warn) used.add('meteoalarm');
      if (radar) used.add(radar.source_id);
      const lastObs = db.get("SELECT MAX(observed_at) AS t, COUNT(DISTINCT station_id) AS n FROM observation WHERE source_id = 'hungaromet-obs' AND observed_at >= ?", addH(tnow(), -3));
      return {
        on: true, now: tnow(), use: cfg.settings.use,
        forecast: fc ? { ...gridInfo(fc), name: src(fc).name } : null,
        forecastWhy: fc ? '' : (['open-meteo-grid', 'met-no-grid'].map(id => `${id}: ${allowed(id) ? 'nincs még adat' : S.gate(src(id), cfg.settings).why}`).join('; ')),
        obs: gridInfo('obs-idw'), stations: lastObs.n ? { n: lastObs.n, last: lastObs.t } : null,
        lightning: { n: strikes.n, last: strikes.last }, warnings: warn, radar: radar ? { n: radar.n, last: radar.last } : null,
        attribution: cfg.sources.filter(s => used.has(s.id)).map(s => s.attribution),
      };
    },

    fields(mode = 'forecast') {
      if (!db) return null;
      const id = mode === 'obs' ? 'obs-idw' : forecastSource();
      if (!id) return null;
      const g = G.read(db, id);
      if (!g) return null;
      const times = [...new Set(g.frames.map(f => f.valid))].sort();
      const vars = {};
      for (const f of g.frames) {
        if (!vars[f.var]) vars[f.var] = new Array(times.length).fill(null);
        vars[f.var][times.indexOf(f.valid)] = G.encode(f.data, f.var);
      }
      const s = id === 'obs-idw' ? src('hungaromet-obs') : src(id);
      return { source: id, name: id === 'obs-idw' ? 'HungaroMet mérések (állomásokból interpolálva)' : s.name, attribution: s.attribution,
        issued: g.issued, grid: g.grid, times, vars, scale: Object.fromEntries(Object.keys(vars).map(v => [v, (G.FIELD[v] || {}).scale || 0.1])) };
    },

    stations() {
      const fc = { type: 'FeatureCollection', features: [] };
      if (!db) return fc;
      const since = addH(tnow(), -1.5);
      const st = db.all("SELECT id, name, lat, lon, elev FROM station WHERE source_id = 'hungaromet-obs'");
      for (const s of st) {
        const t = db.get("SELECT MAX(observed_at) AS t FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND observed_at >= ?", s.id, since).t;
        if (!t) continue;
        const p = { id: s.id, name: s.name, at: t };
        for (const r of db.all("SELECT var, value FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND observed_at = ?", s.id, t)) p[r.var] = r.value;
        const rain = db.get("SELECT SUM(value) AS s, COUNT(*) AS n FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND var = 'precip10' AND observed_at > ? AND observed_at <= ?", s.id, addH(t, -1), t);
        if (rain && rain.n) p.rain1h = Math.round(rain.s * 10) / 10;
        fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: p });
      }
      return fc;
    },

    lightning(minutes = 60) {
      const fc = { type: 'FeatureCollection', features: [] };
      if (!db) return fc;
      const t = now().getTime();
      for (const s of db.all('SELECT at, lat, lon, amp FROM strike WHERE at >= ? ORDER BY at', iso(new Date(t - minutes * 60e3))))
        fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { at: s.at, age: Math.min(minutes, Math.max(0, Math.floor((t - new Date(s.at)) / 60e3))), amp: s.amp } });
      return fc;
    },

    warnings() {
      if (!db) return [];
      const rows = db.all('SELECT area, event, type, level, onset, expires, headline, description FROM warning WHERE expires >= ? ORDER BY level DESC, onset', tnow());
      const by = new Map();
      for (const w of rows) {
        const a = areas.find(x => fold(x.name) === fold(w.area)) || areas.find(x => areaMatch(w.area, x.name));
        const k = a ? a.name : w.area;
        if (!by.has(k)) by.set(k, { area: k, lon: a ? a.lon : null, lat: a ? a.lat : null, km: a ? a.km : null, level: 0, items: [] });
        const g = by.get(k);
        g.level = Math.max(g.level, w.level || 0);
        g.items.push({ event: w.event || w.type, type: w.type, level: w.level, onset: w.onset, expires: w.expires, headline: w.headline });
      }
      return [...by.values()];
    },

    radar() {
      if (!db) return [];
      return db.all('SELECT source_id, at, file, west, south, east, north FROM radar_frame ORDER BY at').map(r => ({
        at: r.at, url: `/weather/radar/${encodeURIComponent(r.source_id)}/${encodeURIComponent(r.file)}`, bounds: [r.west, r.south, r.east, r.north] }));
    },
    radarFile(sourceId, file) {
      if (!db || !/^[\w.-]+$/.test(file) || !/^[\w-]+$/.test(sourceId)) return null;
      const r = db.get('SELECT file FROM radar_frame WHERE source_id = ? AND file = ?', sourceId, file);
      return r ? path.join(path.dirname(dbFile()), 'radar', sourceId, r.file) : null;
    },

    jobs() {
      const out = {};
      if (!db) return out;
      const t = tnow(), until = addH(t, 24);
      for (const a of db.all(`SELECT p.job_code, a.level, a.title, a.starts, a.ends, a.activity FROM alert a JOIN place p ON p.id = a.place_id
        WHERE p.kind = 'job' AND p.job_code IS NOT NULL AND a.status IN ('open', 'ack') AND a.ends > ? AND a.starts < ? AND a.level != 'info' ORDER BY a.starts`, t, until)) {
        const o = out[a.job_code] || (out[a.job_code] = { level: 'ok', alerts: [] });
        if ((RANK[a.level] || 0) > (RANK[o.level] || 0)) o.level = a.level;
        if (o.alerts.length < 6) o.alerts.push({ level: a.level, title: a.title, starts: a.starts, ends: a.ends, activity: a.activity });
      }
      return out;
    },
  };
}

module.exports = { make };
