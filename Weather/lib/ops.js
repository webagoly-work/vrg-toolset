// VRG Időjárás — housekeeping and read-outs: status, now, export, prune, doctor.
'use strict';

const fs = require('fs');
const path = require('path');
const { VARS, WMO } = require('./vars');
const { now, addH, hourFloor, nearest, DATA, CONFIG, dbFile, local } = require('./common');
const { iso, nowIso, SCHEMA_VERSION } = require('./db');
const S = require('./sources');
const P = require('./places');
const FUSE = require('./fuse');
const R = require('./rules');

function sourceStatus(ctx) {
  return ctx.cfg.sources.map(s => {
    const g = S.gate(s, ctx.settings);
    const last = ctx.db.get(`SELECT started, status, error, rows FROM fetch_log WHERE source_id = ? AND status NOT IN ('cached', 'fresh') ORDER BY id DESC LIMIT 1`, s.id);
    const lastOk = ctx.db.get(`SELECT started FROM fetch_log WHERE source_id = ? AND status IN ('ok', 'replay') ORDER BY id DESC LIMIT 1`, s.id);
    const ageMin = lastOk ? Math.round((now() - new Date(lastOk.started)) / 60e3) : null;
    const stale = g.ok && s.cadence_min && s.kind !== 'climate' && (ageMin == null || ageMin > 3 * s.cadence_min);
    return { id: s.id, name: s.name, kind: s.kind, run: g.ok, why: g.why, commercial: s.commercial, licence: s.licence, attribution: s.attribution,
      verified: s.verified, cadence_min: s.cadence_min, last: last || null, lastOk: lastOk ? lastOk.started : null, ageMin, stale: !!stale, url: s.kind === 'link' ? s.url : undefined };
  });
}

// "Most": the consensus for this hour plus the latest observation of the nearest HungaroMet station
function current(ctx, place) {
  const h = hourFloor(now());
  const fused = FUSE.table(ctx.db, place.id, h, addH(h, 1))[0] || null;
  const stations = ctx.db.all("SELECT id, name, lat, lon FROM station WHERE source_id = 'hungaromet-obs'");
  const st = nearest(place, stations, 25);
  let obs = null;
  if (st) {
    const t = ctx.db.get("SELECT MAX(observed_at) AS t FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND observed_at >= ?", st.id, addH(iso(now()), -3));
    if (t && t.t) {
      obs = { station: st.name || st.id, km: Math.round(st.km * 10) / 10, at: t.t };
      for (const r of ctx.db.all("SELECT var, value FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND observed_at = ?", st.id, t.t)) obs[r.var] = r.value;
    }
  }
  return { place: place.id, name: place.name, fused, obs };
}

// data/export/latest.json — one file for the VRG Asztal, Kapu and VRG Mobile to read: per place the next 24 h,
// the open alerts and the work windows. No job addresses: job places carry only their code and area.
function exportLatest(ctx) {
  const places = P.list(ctx.db);
  const h = hourFloor(now());
  const out = { built: nowIso(), use: ctx.settings.use, attribution: [], places: [] };
  const used = new Set();
  for (const p of places) {
    const hours = FUSE.table(ctx.db, p.id, addH(h, 1), addH(h, 24));
    for (const x of hours) for (const m of Object.keys(x._members.t2m || {})) used.add(m.split('/')[0]);
    const alerts = ctx.db.all("SELECT id, level, activity, title, starts, ends, status FROM alert WHERE place_id = ? AND status IN ('open', 'ack') ORDER BY starts", p.id);
    const w = R.windows(ctx, p, 24);
    out.places.push({
      id: p.id, name: p.kind === 'job' ? (p.job_code + (p.area ? ' · ' + p.area : '')) : p.name, kind: p.kind,
      ...(p.kind === 'job' ? {} : { lat: p.lat, lon: p.lon }),
      next24: hours.map(x => ({ t: x.valid, t2m: x.t2m, precip: x.precip, pop: x.pop, gust: x.gust, wmo: x.wmo, conf: x._conf.t2m })),
      alerts, windows: Object.fromEntries(Object.entries(w).map(([a, hs]) => [a, hs.map(x => x.level[0]).join('')])),
    });
  }
  if (ctx.db.get("SELECT 1 FROM warning WHERE expires >= ? LIMIT 1", iso(now()))) used.add('meteoalarm');
  out.attribution = ctx.cfg.sources.filter(s => used.has(s.id)).map(s => s.attribution);
  const dir = path.join(DATA, 'export'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'latest.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  return { file: f, places: out.places.length };
}

function prune(ctx) {
  const r = ctx.settings.retention || {};
  const t = iso(now()), cut = d => addH(t, -24 * d);
  const del = {};
  ctx.db.tx(() => {
    del.forecast = ctx.db.run('DELETE FROM forecast WHERE valid_at < ?', cut(r.forecastDays || 45)).changes;
    del.observation = ctx.db.run('DELETE FROM observation WHERE observed_at < ?', cut(r.observationDays || 400)).changes;
    del.fetch_log = ctx.db.run('DELETE FROM fetch_log WHERE started < ?', cut(r.fetchLogDays || 60)).changes;
    del.strike = ctx.db.run('DELETE FROM strike WHERE at < ?', cut(30)).changes;
    del.warning = ctx.db.run('DELETE FROM warning WHERE expires < ?', cut(r.forecastDays || 45)).changes;
    ctx.db.run('DELETE FROM warning_place WHERE warning_id NOT IN (SELECT id FROM warning)');
    del.fused = ctx.db.run('DELETE FROM fused WHERE valid_at < ?', cut(3)).changes;
    del.alert = ctx.db.run("DELETE FROM alert WHERE status = 'cleared' AND last_seen < ?", cut(r.forecastDays || 45)).changes;
    del.run = ctx.db.run('DELETE FROM run WHERE started < ?', cut(r.fetchLogDays || 60)).changes;
  });
  // raw answers: day folders older than rawDays
  const rawDir = path.join(DATA, 'raw'); let rawGone = 0;
  const limit = new Date(now().getTime() - (r.rawDays || 14) * 864e5).toISOString().slice(0, 10);
  if (fs.existsSync(rawDir)) for (const src of fs.readdirSync(rawDir)) for (const day of fs.readdirSync(path.join(rawDir, src)))
    if (day < limit) { fs.rmSync(path.join(rawDir, src, day), { recursive: true, force: true }); rawGone++; }
  del.rawDays = rawGone;
  try { ctx.db.exec('PRAGMA optimize'); } catch {}
  return del;
}

function doctor(ctx) {
  const checks = [];
  const add = (level, what, detail = '') => checks.push({ level, what, detail });
  const [maj, min] = process.versions.node.split('.').map(Number);
  add(maj > 22 || (maj === 22 && min >= 5) ? 'ok' : 'fail', 'Node ' + process.versions.node, 'node:sqlite kell (22.5+)');
  add(ctx.db.meta('schema') === String(SCHEMA_VERSION) ? 'ok' : 'warn', 'adatbázis séma ' + ctx.db.meta('schema'), dbFile());
  // config sanity: rules use known vars, activities and kinds
  const acts = new Set((ctx.cfg.rules.activities || []).map(a => a.id).concat('*'));
  const walk = c => [c, ...(c.and ? walk(c.and) : [])];
  for (const r of ctx.cfg.rules.rules) {
    for (const a of r.activities || []) if (!acts.has(a)) add('fail', `szabály ${r.id}`, 'ismeretlen tevékenység: ' + a);
    for (const c of [...(r.all || []), ...(r.any || [])].flatMap(walk)) if (!VARS[c.var]) add('fail', `szabály ${r.id}`, 'ismeretlen változó: ' + c.var);
    if (!r.basis) add('warn', `szabály ${r.id}`, 'nincs basis (legal | standard | datasheet | practice ...)');
  }
  for (const p of P.list(ctx.db)) for (const a of p.activities) if (!acts.has(a)) add('fail', `hely ${p.id}`, 'ismeretlen tevékenység: ' + a);
  // sources
  for (const s of sourceStatus(ctx)) {
    if (!s.run) { add(s.kind === 'link' ? 'ok' : 'info', `forrás ${s.id}`, s.why); continue; }
    if (s.stale) add('warn', `forrás ${s.id}`, s.lastOk ? `utolsó jó letöltés ${s.ageMin} perce (ütem ${s.cadence_min} perc)` : 'még nem volt jó letöltés');
    else add('ok', `forrás ${s.id}`, s.lastOk ? `${s.ageMin} perce` : '');
    if (s.verified !== 'yes') add('info', `forrás ${s.id}`, 'az értelmező nincs élő válaszon ellenőrizve: doctor --live');
    if (s.last && s.last.status === 'parse') add('fail', `forrás ${s.id}`, 'értelmezési hiba: ' + s.last.error);
  }
  if (!ctx.settings.contact) add('warn', 'settings.local.json contact', 'MET Norway kéri: egy elérhetőség a User-Agentben (pl. a cég honlapja)');
  if (ctx.settings.use === 'commercial' && !(ctx.settings.keys && ctx.settings.keys.openMeteo)) add('info', 'Open-Meteo', 'üzleti használatban kulcs nélkül ki van kapcsolva (a legtöbb modell innen jönne)');
  const failed = ctx.db.get('SELECT COUNT(*) AS n FROM outbox WHERE delivered IS NULL AND error IS NOT NULL').n;
  if (failed) add('warn', 'kézbesítés', failed + ' riasztás nem ment ki (outbox.error)');
  const tick = ctx.db.meta('daemon_tick');
  add('info', 'ütemező', tick ? 'utolsó ütés ' + tick : 'még nem futott (daemon vagy serve.js --daemon)');
  const worst = checks.some(c => c.level === 'fail') ? 'fail' : checks.some(c => c.level === 'warn') ? 'warn' : 'ok';
  return { worst, checks };
}

function status(ctx) {
  const c = t => ctx.db.get(`SELECT COUNT(*) AS n FROM ${t}`).n;
  return {
    db: dbFile(), use: ctx.settings.use, places: P.list(ctx.db).length,
    rows: { forecast: c('forecast'), observation: c('observation'), warning: c('warning'), fused: c('fused'), skill: c('skill'), alert: c('alert'), fetch_log: c('fetch_log') },
    openAlerts: ctx.db.all("SELECT a.level, COUNT(*) AS n FROM alert a WHERE status = 'open' GROUP BY level"),
    lastRun: ctx.db.get("SELECT name, started, status FROM run WHERE kind = 'pipeline' ORDER BY id DESC LIMIT 1") || null,
  };
}

module.exports = { sourceStatus, current, exportLatest, prune, doctor, status, WMO, local, CONFIG };
