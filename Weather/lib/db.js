// VRG Időjárás — the database (Weather/data/weather.sqlite, outside Git).
//
// node:sqlite (built in from Node 22.5), so the tool stays dependency-free like Stack and CoreRef.
// One file holds everything with its provenance:
//
//   source        the registry rows (copied from config/sources.json at every open: config is the truth)
//   place         where we want weather: named places, job sites (from the Map's helyek.json), stations
//   station       observation stations of a source (HungaroMet, DWD MOSMIX points)
//   fetch_log     every request: when, what, HTTP status, bytes, rows, cache headers, error
//   forecast      one value per (source, model, place, issued, valid, var)   — the raw forecasts, never overwritten
//   observation   one value per (source, station, observed, var)              — what really happened
//   strike        lightning strikes (lat, lon, time) when a source gives them
//   warning       official warnings (CAP), with the places they touch in warning_place
//   fused         the consensus per (place, valid, var) of the latest fusion run, with spread and confidence
//   skill         verification: error of each source/model per var and lead-time bucket; feeds the weights
//   climate       slow data: PV yield per month (PVGIS), climatology
//   alert         what the rules found, deduplicated by fingerprint; open -> cleared, or acknowledged
//   outbox        alert deliveries per channel
//   run           every command and pipeline run, for the run log and `doctor`
//
// Times are UTC ISO strings cut to the minute ("2026-11-18T06:00Z"): they sort as text and compare
// as text, and every source is converted on the way in. The page shows Europe/Budapest.
'use strict';

const fs = require('fs');
const path = require('path');

let DatabaseSync;
function sqlite() {
  if (DatabaseSync) return DatabaseSync;
  // node:sqlite prints an ExperimentalWarning on Node 22/23; it is expected here, keep the console clean
  const emit = process.emitWarning;
  process.emitWarning = (w, ...a) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...a));
  try { ({ DatabaseSync } = require('node:sqlite')); } finally { process.emitWarning = emit; }
  return DatabaseSync;
}

const SCHEMA_VERSION = 1;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY, name TEXT, provider TEXT, kind TEXT, licence TEXT, licence_url TEXT,
  attribution TEXT, commercial TEXT, auth TEXT, cadence_min INTEGER, enabled INTEGER,
  prior_weight REAL, verified TEXT, notes TEXT);

CREATE TABLE IF NOT EXISTS place (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, elev REAL,
  kind TEXT NOT NULL DEFAULT 'place',        -- place | job
  job_code TEXT, area TEXT, warn_areas TEXT,  -- warn_areas: JSON array of names matched against CAP areaDesc
  activities TEXT,                            -- JSON array of activity ids the rules check here
  active INTEGER NOT NULL DEFAULT 1, created TEXT, updated TEXT);

CREATE TABLE IF NOT EXISTS station (
  source_id TEXT, id TEXT, name TEXT, lat REAL, lon REAL, elev REAL, last_seen TEXT,
  PRIMARY KEY (source_id, id)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS fetch_log (
  id INTEGER PRIMARY KEY, source_id TEXT, place_id TEXT, started TEXT, finished TEXT,
  status TEXT,          -- ok | cached | http | net | parse | skipped | replay
  http_status INTEGER, bytes INTEGER, rows INTEGER, url TEXT, error TEXT,
  etag TEXT, last_modified TEXT, expires TEXT, raw_path TEXT);
CREATE INDEX IF NOT EXISTS fetch_src ON fetch_log (source_id, place_id, started);

CREATE TABLE IF NOT EXISTS forecast (
  source_id TEXT, model TEXT, place_id TEXT, issued_at TEXT, valid_at TEXT, var TEXT, value REAL,
  PRIMARY KEY (source_id, model, place_id, issued_at, valid_at, var)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS forecast_valid ON forecast (place_id, valid_at, var);

CREATE TABLE IF NOT EXISTS observation (
  source_id TEXT, station_id TEXT, observed_at TEXT, var TEXT, value REAL,
  PRIMARY KEY (source_id, station_id, observed_at, var)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS obs_time ON observation (observed_at);

CREATE TABLE IF NOT EXISTS strike (
  source_id TEXT, at TEXT, lat REAL, lon REAL, amp REAL,
  PRIMARY KEY (source_id, at, lat, lon)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS warning (
  id TEXT PRIMARY KEY, source_id TEXT, area TEXT, area_code TEXT, event TEXT, type TEXT,
  level INTEGER,        -- 1 green, 2 yellow, 3 orange, 4 red (MeteoAlarm awareness level)
  severity TEXT, certainty TEXT, urgency TEXT, onset TEXT, expires TEXT, sent TEXT,
  headline TEXT, description TEXT, lang TEXT, seen TEXT);
CREATE TABLE IF NOT EXISTS warning_place (warning_id TEXT, place_id TEXT, PRIMARY KEY (warning_id, place_id)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS fused (
  place_id TEXT, valid_at TEXT, var TEXT, value REAL, spread REAL, n INTEGER, conf TEXT, members TEXT, run_at TEXT,
  PRIMARY KEY (place_id, valid_at, var)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS skill (
  member TEXT, var TEXT, lead TEXT, n INTEGER, mae REAL, bias REAL, rmse REAL, updated TEXT,
  PRIMARY KEY (member, var, lead)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS climate (
  source_id TEXT, place_id TEXT, key TEXT, month INTEGER, value REAL, unit TEXT, params TEXT, fetched TEXT,
  PRIMARY KEY (source_id, place_id, key, month)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS alert (
  id INTEGER PRIMARY KEY, fingerprint TEXT UNIQUE, rule_id TEXT, place_id TEXT, activity TEXT,
  level TEXT,           -- info | amber | red
  starts TEXT, ends TEXT, title TEXT, detail TEXT, basis TEXT,
  status TEXT,          -- open | cleared | ack
  first_seen TEXT, last_seen TEXT);
CREATE INDEX IF NOT EXISTS alert_open ON alert (status, place_id);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY, alert_id INTEGER, channel TEXT, created TEXT, delivered TEXT, payload TEXT, error TEXT);

CREATE TABLE IF NOT EXISTS run (
  id INTEGER PRIMARY KEY, kind TEXT, name TEXT, started TEXT, finished TEXT, status TEXT, summary TEXT);
`;

const nowIso = () => iso(new Date());
// "2026-11-18T06:00Z": minute precision, UTC
function iso(d) {
  const t = d instanceof Date ? d : new Date(d);
  if (isNaN(t)) return null;
  return t.toISOString().slice(0, 16) + 'Z';
}

function open(file, opts = {}) {
  const DB = sqlite();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = opts.readOnly ? new DB(file, { readOnly: true }) : new DB(file);
  if (!opts.readOnly) {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;');
    db.exec(SCHEMA);
    const v = db.prepare("SELECT v FROM meta WHERE k = 'schema'").get();
    if (!v) db.prepare("INSERT INTO meta (k, v) VALUES ('schema', ?), ('created', ?)").run(String(SCHEMA_VERSION), nowIso());
  }
  return wrap(db);
}

// a thin layer: prepared statements cached by SQL text, a transaction helper, bulk insert
function wrap(db) {
  const cache = new Map();
  const st = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const api = {
    raw: db,
    all: (sql, ...p) => st(sql).all(...p),
    get: (sql, ...p) => st(sql).get(...p),
    run: (sql, ...p) => st(sql).run(...p),
    exec: sql => db.exec(sql),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    meta(k, v) {
      if (v === undefined) { const r = st('SELECT v FROM meta WHERE k = ?').get(k); return r ? r.v : null; }
      st('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v));
    },
    close: () => db.close(),
  };

  // ---- writers used by the adapters (rows already normalised) ----
  api.putForecast = rows => api.tx(() => {
    const s = st('INSERT OR REPLACE INTO forecast (source_id, model, place_id, issued_at, valid_at, var, value) VALUES (?, ?, ?, ?, ?, ?, ?)');
    let n = 0;
    for (const r of rows) if (r.value != null && Number.isFinite(r.value)) { s.run(r.source, r.model || '', r.place, r.issued, r.valid, r.var, r.value); n++; }
    return n;
  });
  api.putObservation = rows => api.tx(() => {
    const s = st('INSERT OR REPLACE INTO observation (source_id, station_id, observed_at, var, value) VALUES (?, ?, ?, ?, ?)');
    let n = 0;
    for (const r of rows) if (r.value != null && Number.isFinite(r.value)) { s.run(r.source, r.station, r.at, r.var, r.value); n++; }
    return n;
  });
  api.putStations = rows => api.tx(() => {
    const s = st(`INSERT INTO station (source_id, id, name, lat, lon, elev, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon,
      elev = COALESCE(excluded.elev, station.elev), last_seen = excluded.last_seen`);
    for (const r of rows) s.run(r.source, String(r.id), r.name || null, r.lat, r.lon, r.elev ?? null, r.seen || nowIso());
    return rows.length;
  });
  api.putStrikes = rows => api.tx(() => {
    const s = st('INSERT OR IGNORE INTO strike (source_id, at, lat, lon, amp) VALUES (?, ?, ?, ?, ?)');
    let n = 0; for (const r of rows) { s.run(r.source, r.at, r.lat, r.lon, r.amp ?? null); n++; } return n;
  });
  api.putWarnings = rows => api.tx(() => {
    const s = st(`INSERT INTO warning (id, source_id, area, area_code, event, type, level, severity, certainty, urgency,
      onset, expires, sent, headline, description, lang, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET expires = excluded.expires, level = excluded.level, headline = excluded.headline,
      description = excluded.description, seen = excluded.seen`);
    for (const w of rows) s.run(w.id, w.source, w.area, w.areaCode || null, w.event, w.type || null, w.level ?? null,
      w.severity || null, w.certainty || null, w.urgency || null, w.onset, w.expires, w.sent || null,
      w.headline || null, w.description || null, w.lang || null, nowIso());
    return rows.length;
  });
  api.putClimate = rows => api.tx(() => {
    const s = st('INSERT OR REPLACE INTO climate (source_id, place_id, key, month, value, unit, params, fetched) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const r of rows) s.run(r.source, r.place, r.key, r.month ?? 0, r.value, r.unit || null, r.params || null, nowIso());
    return rows.length;
  });
  return api;
}

module.exports = { open, iso, nowIso, SCHEMA_VERSION };
