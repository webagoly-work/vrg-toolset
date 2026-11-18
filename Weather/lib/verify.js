// VRG Időjárás — `verify`: how good was each member? The answer becomes the fusion weights.
//
// For every place with a HungaroMet station within settings.verify.maxStationKm, every forecast of the last
// settings.verify.days days whose valid hour has an observation is paired with it:
//   t2m, rh2m, wind, gust, pmsl   the observation at the full hour (10-minute row at :00)
//   precip                         the six 10-minute amounts of the hour ending at valid_at (all six needed)
//   pop                            Brier score against "it rained ≥ 0.1 mm in that hour" (stored as mae)
// Pairs are grouped per member, var and lead bucket into skill (n, MAE, bias, RMSE). Recomputed from scratch
// each run, so a source that improves is noticed within the window.
'use strict';

const { now, nearest, addH } = require('./common');
const { iso, nowIso } = require('./db');
const { leadBucket } = require('./fuse');
const P = require('./places');

const DIRECT = ['t2m', 'rh2m', 'wind', 'gust', 'pmsl'];

function run(ctx) {
  const { db, settings } = ctx;
  const V = settings.verify || {}, buckets = (settings.fusion && settings.fusion.leadBuckets) || [6, 12, 24, 48, 72];
  const stations = db.all("SELECT id, name, lat, lon FROM station WHERE source_id = 'hungaromet-obs'");
  const since = addH(iso(now()), -24 * (V.days || 30));
  const acc = new Map();   // member|var|lead -> { n, sum, sumAbs, sumSq }
  const add = (member, v, lead, err) => {
    const k = `${member}|${v}|${lead}`;
    const a = acc.get(k) || { n: 0, sum: 0, abs: 0, sq: 0 };
    a.n++; a.sum += err; a.abs += Math.abs(err); a.sq += err * err; acc.set(k, a);
  };
  const report = [];
  for (const place of P.list(db, { all: true })) {
    const st = nearest(place, stations, V.maxStationKm || 15);
    if (!st) continue;
    // observations of that station by time and var
    const obs = new Map();
    for (const o of db.all("SELECT observed_at, var, value FROM observation WHERE source_id = 'hungaromet-obs' AND station_id = ? AND observed_at >= ?", st.id, since))
      obs.set(o.observed_at + '|' + o.var, o.value);
    if (!obs.size) continue;
    const hourRain = valid => {
      let s = 0;
      for (let k = 0; k < 6; k++) { const t = new Date(new Date(valid).getTime() - k * 600e3); const v = obs.get(iso(t) + '|precip10'); if (v == null) return null; s += v; }
      return s;
    };
    let pairs = 0;
    for (const f of db.all(`SELECT source_id, model, issued_at, valid_at, var, value FROM forecast WHERE place_id = ? AND valid_at >= ? AND valid_at <= ?
      AND var IN ('t2m', 'rh2m', 'wind', 'gust', 'pmsl', 'precip', 'pop')`, place.id, since, iso(now()))) {
      const member = `${f.source_id}/${f.model}`, lead = leadBucket(f.issued_at, f.valid_at, buckets);
      if (DIRECT.includes(f.var)) {
        const o = obs.get(f.valid_at + '|' + f.var);
        if (o != null) { add(member, f.var, lead, f.value - o); pairs++; }
      } else if (f.var === 'precip') {
        const o = hourRain(f.valid_at);
        if (o != null) { add(member, 'precip', lead, f.value - o); pairs++; }
      } else if (f.var === 'pop') {
        const o = hourRain(f.valid_at);
        if (o != null) { add(member, 'pop', lead, (f.value / 100 - (o >= 0.1 ? 1 : 0)) ** 2 * 100); pairs++; }   // Brier ×100
      }
    }
    report.push({ place: place.id, station: st.id, km: Math.round(st.km * 10) / 10, pairs });
  }
  const t = nowIso();
  db.tx(() => {
    db.run('DELETE FROM skill');
    for (const [k, a] of acc) {
      const [member, v, lead] = k.split('|');
      // for pop the per-pair value is already a squared error: mae = Brier, bias/rmse not meaningful
      db.run('INSERT INTO skill (member, var, lead, n, mae, bias, rmse, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', member, v, lead, a.n,
        a.abs / a.n, v === 'pop' ? null : a.sum / a.n, v === 'pop' ? null : Math.sqrt(a.sq / a.n), t);
    }
  });
  return { places: report, groups: acc.size };
}

module.exports = { run };
