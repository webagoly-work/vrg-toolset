// VRG Időjárás — `fetch`: run the adapters and write what they return.
//
//   scope 'place'   one request per active place (MET Norway, Open-Meteo, PVGIS)
//   scope 'station' one request per station, the rows written for every place that station serves (MOSMIX)
//   scope 'global'  one request for the whole country (MeteoAlarm, HungaroMet observations, lightning)
//
// A source is skipped when the licence gate says no, or when its last good fetch is younger than its
// cadence (unless --force). One failing source never stops the others: the error is in fetch_log and in
// the returned summary.
'use strict';

const HTTP = require('./http');
const S = require('./sources');
const P = require('./places');
const { now, nearest, fold } = require('./common');
const { iso } = require('./db');

function fresh(db, src, placeId) {
  if (!src.cadence_min) return false;
  const since = iso(new Date(now().getTime() - src.cadence_min * 60e3));
  return !!db.get(`SELECT 1 FROM fetch_log WHERE source_id = ? AND place_id IS ? AND status IN ('ok', 'cached') AND started >= ? LIMIT 1`, src.id, placeId, since);
}

function write(db, out) {
  let n = 0;
  if (out.forecast) n += db.putForecast(out.forecast);
  if (out.stations) db.putStations(out.stations);
  if (out.observation) n += db.putObservation(out.observation);
  if (out.strikes) n += db.putStrikes(out.strikes);
  if (out.warnings) n += db.putWarnings(out.warnings);
  if (out.climate) n += db.putClimate(out.climate);
  return n;
}

// which places does a warning row touch? accent-free "contains" in either direction
function linkWarnings(db, places) {
  const ws = db.all('SELECT id, area FROM warning WHERE expires >= ?', iso(now()));
  db.tx(() => {
    for (const w of ws) for (const p of places) {
      const a = fold(w.area);
      if ((p.warn_areas || []).some(x => { const f = fold(x); return f && (a.includes(f) || f.includes(a)); }))
        db.run('INSERT OR IGNORE INTO warning_place (warning_id, place_id) VALUES (?, ?)', w.id, p.id);
    }
  });
}

async function one(ctx, src, ad, target, places, opts) {
  const placeId = target ? target.id : null;
  const key = target && ad.scope === 'station' ? 'st:' + target.id : placeId;
  if (!opts.force && !ctx.replay && fresh(ctx.db, src, key)) return { source: src.id, place: key, status: 'fresh', rows: 0 };
  let url = ad.url(src, target, ctx.settings, opts);
  if (ad.pickFromListing && /\/$/.test(url) && !ctx.replay) {
    const l = await HTTP.get(ctx, { source: src, place: key, url, ext: 'html', force: true });
    if (!l.ok) return { source: src.id, place: key, status: l.cached ? 'cached' : 'error', error: l.error };
    url = ad.pickFromListing(l.body.toString('utf8'), url);
    if (!url) return { source: src.id, place: key, status: 'error', error: 'no data file in the listing' };
  }
  const r = await HTTP.get(ctx, { source: src, place: key, url, ext: ad.ext, force: opts.force });
  if (!r.ok) return { source: src.id, place: key, status: r.cached ? 'cached' : r.skipped ? 'skipped' : 'error', error: r.error };
  try {
    const out = ad.scope === 'station' ? ad.parse(r.body, src, target, places) : ad.parse(r.body, src, target, ctx.settings, opts);
    const rows = write(ctx.db, out);
    HTTP.setRows(ctx.db, r.logId, rows);
    return { source: src.id, place: key, status: 'ok', rows, found: out.found };
  } catch (e) {
    HTTP.setError(ctx.db, r.logId, e.message);
    return { source: src.id, place: key, status: 'parse', error: e.message };
  }
}

/**
 * run(ctx, { ids: [source ids] | [], place: id | null, force, opts }) -> [{ source, place, status, rows, error }]
 */
async function run(ctx, { ids = [], place = null, force = false, opts = {} } = {}) {
  const { db, cfg } = ctx;
  const places = place ? [P.find(db, place)].filter(Boolean) : P.list(db);
  if (place && !places.length) throw new Error('nincs ilyen hely: ' + place);
  const wanted = ids.length ? cfg.sources.filter(s => ids.includes(s.id)) : cfg.sources;
  for (const id of ids) if (!cfg.sources.some(s => s.id === id)) throw new Error('nincs ilyen forrás: ' + id);
  const results = [];
  for (const src of wanted) {
    const g = S.gate(src, ctx.settings);
    if (!g.ok) { if (ids.length || src.adapter) results.push({ source: src.id, status: 'off', error: g.why }); continue; }
    // PVGIS is slow data: it runs only when asked by name (pipeline "pv"), never in a plain `fetch`
    if (src.kind === 'climate' && !ids.includes(src.id)) continue;
    const ad = S.adapter(src);
    const o = { force, ...opts };
    if (ad.scope === 'global') results.push(await one(ctx, src, ad, null, places, o));
    else if (ad.scope === 'place') for (const p of places) results.push(await one(ctx, src, ad, p, places, o));
    else if (ad.scope === 'station') {
      // each place to its nearest station; each station fetched once for all its places
      const by = new Map();
      for (const p of places) {
        const st = nearest(p, src.stations || [], src.max_station_km || 45);
        if (!st) { results.push({ source: src.id, place: p.id, status: 'off', error: `nincs állomás ${src.max_station_km || 45} km-en belül` }); continue; }
        if (!by.has(st.id)) by.set(st.id, { st, places: [] });
        by.get(st.id).places.push(p);
      }
      for (const { st, places: ps } of by.values()) results.push(await one(ctx, src, ad, st, ps, o));
    }
  }
  linkWarnings(db, P.list(db));
  return results;
}

module.exports = { run, linkWarnings };
