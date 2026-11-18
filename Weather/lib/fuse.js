// VRG Időjárás — `fuse`: one consensus forecast per place, with how sure it is.
//
// A member is one forecast stream: source/model ("open-meteo/icon_d2", "dwd-mosmix/mosmix:12843", "met-no/met-no").
// For each place, valid hour and variable the latest issue of every member is taken, then:
//
//   weights   the source's prior_weight, until the member has settings.fusion.minPairsForSkill verified pairs
//             for this var and lead bucket; then prior / MAE (inverse-error weighting). Research 03 A6/B: the
//             median of sources first, skill weights only once there is enough evidence.
//   value     cont: weighted median while any member has no skill yet, weighted mean once all have
//             sum (precip): always the weighted median, so one wet model does not make every hour wet
//             prob: weighted mean; members without a probability vote 100/0 from their own precipitation
//             dir: vector mean
//             code: the most severe weather code that at least two members reach (or the only member's)
//   spread    weighted standard deviation (code: share of members that disagree); empty with one member
//   conf      magas / közepes / alacsony from spread against settings.fusion.tolerance, or "egy" (one source)
//
// Inputs are never changed: fused rows are rebuilt for the window each run, the forecasts stay as they came.
'use strict';

const { VARS, wmoSev } = require('./vars');
const { now, addH, hourFloor } = require('./common');
const { iso, nowIso } = require('./db');
const S = require('./sources');

function leadBucket(issued, valid, buckets) {
  const h = (new Date(valid) - new Date(issued)) / 3600e3;
  for (const b of buckets) if (h <= b) return '≤' + b;
  return '>' + buckets[buckets.length - 1];
}

function wmedian(pairs) {
  const s = pairs.filter(p => p.w > 0).sort((a, b) => a.v - b.v);
  const tot = s.reduce((a, p) => a + p.w, 0);
  let c = 0;
  for (let i = 0; i < s.length; i++) {
    c += s[i].w;
    if (c > tot / 2 + 1e-9) return s[i].v;
    if (Math.abs(c - tot / 2) < 1e-9) return (s[i].v + s[i + 1].v) / 2;   // exactly half: middle of the two
  }
  return s.length ? s[s.length - 1].v : null;
}
const wmean = pairs => { const t = pairs.reduce((a, p) => a + p.w, 0); return t ? pairs.reduce((a, p) => a + p.w * p.v, 0) / t : null; };
function wstd(pairs, m) {
  if (pairs.length < 2) return null;
  const t = pairs.reduce((a, p) => a + p.w, 0);
  return Math.sqrt(pairs.reduce((a, p) => a + p.w * (p.v - m) ** 2, 0) / t);
}
function vecmean(pairs) {
  let x = 0, y = 0;
  for (const p of pairs) { x += p.w * Math.sin(p.v * Math.PI / 180); y += p.w * Math.cos(p.v * Math.PI / 180); }
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}
function fuseCode(pairs) {
  if (pairs.length === 1) return { v: pairs[0].v, spread: null };
  const sorted = [...pairs].sort((a, b) => wmoSev(b.v) - wmoSev(a.v));
  for (const p of sorted) {
    const reach = pairs.filter(q => wmoSev(q.v) >= wmoSev(p.v)).length;
    if (reach >= 2) return { v: p.v, spread: 1 - pairs.filter(q => q.v === p.v).length / pairs.length };
  }
  return { v: sorted[sorted.length - 1].v, spread: 1 };
}

function confidence(v, spread, n, tol) {
  if (n <= 1) return 'egy';
  if (spread == null) return 'magas';
  if (VARS[v] && VARS[v].kind === 'code') return spread <= 0.34 ? 'magas' : spread <= 0.67 ? 'közepes' : 'alacsony';
  const t = tol[v];
  if (!t) return null;
  const r = spread / t;
  return r < 0.5 ? 'magas' : r < 1 ? 'közepes' : 'alacsony';
}

/* the latest issue of each member for a place, inside the window */
function memberRows(db, placeId, from, to, allowed) {
  const t = iso(now());
  const latest = db.all(`SELECT source_id, model, MAX(issued_at) AS issued FROM forecast WHERE place_id = ? AND issued_at <= ? GROUP BY source_id, model`, placeId, t);
  const stale = addH(t, -36);
  const rows = [];
  for (const m of latest) {
    if (!allowed.has(m.source_id) || m.issued < stale) continue;
    for (const r of db.all(`SELECT valid_at, var, value FROM forecast WHERE place_id = ? AND source_id = ? AND model = ? AND issued_at = ? AND valid_at BETWEEN ? AND ?`,
      placeId, m.source_id, m.model, m.issued, from, to)) rows.push({ member: `${m.source_id}/${m.model}`, source: m.source_id, issued: m.issued, ...r });
  }
  return rows;
}

function fusePlace(ctx, place) {
  const { db, cfg, settings } = ctx;
  const F = settings.fusion || {};
  const minPairs = F.minPairsForSkill ?? 30, buckets = F.leadBuckets || [6, 12, 24, 48, 72], tol = F.tolerance || {};
  const allowed = new Set(cfg.sources.filter(s => S.gate(s, settings).ok).map(s => s.id));
  const prior = Object.fromEntries(cfg.sources.map(s => [s.id, s.prior_weight ?? 1]));
  const from = addH(hourFloor(now()), -6), to = addH(hourFloor(now()), settings.horizonHours || 72);
  const rows = memberRows(db, place.id, from, to, allowed);
  const skill = new Map(db.all('SELECT member, var, lead, n, mae FROM skill').map(s => [`${s.member}|${s.var}|${s.lead}`, s]));

  // group: valid -> var -> [{ member, v, w, skilled }]
  const g = new Map();
  for (const r of rows) {
    if (!VARS[r.var]) continue;
    const sk = skill.get(`${r.member}|${r.var}|${leadBucket(r.issued, r.valid_at, buckets)}`);
    const skilled = !!(sk && sk.n >= minPairs && sk.mae > 0);
    const w = (prior[r.source] ?? 1) * (skilled ? 1 / Math.max(sk.mae, 0.05) : 1);
    if (!g.has(r.valid_at)) g.set(r.valid_at, new Map());
    const byVar = g.get(r.valid_at);
    if (!byVar.has(r.var)) byVar.set(r.var, []);
    byVar.get(r.var).push({ member: r.member, v: r.value, w, skilled });
  }

  const out = [];
  for (const [valid, byVar] of g) {
    // precipitation probability: members with only an amount vote 100 / 0
    const pops = byVar.get('pop') || [];
    const havePop = new Set(pops.map(p => p.member));
    for (const p of byVar.get('precip') || []) if (!havePop.has(p.member)) pops.push({ member: p.member, v: p.v >= 0.1 ? 100 : 0, w: p.w, derived: true });
    if (pops.length) byVar.set('pop', pops);

    for (const [v, pairs] of byVar) {
      const kind = VARS[v].kind;
      let value, spread;
      if (kind === 'code') ({ v: value, spread } = fuseCode(pairs));
      else if (kind === 'dir') { value = vecmean(pairs); spread = null; }
      else if (kind === 'sum') { value = wmedian(pairs); spread = wstd(pairs, wmean(pairs)); }
      else if (kind === 'prob') { value = wmean(pairs); spread = wstd(pairs, value); }
      else { value = pairs.every(p => p.skilled) ? wmean(pairs) : wmedian(pairs); spread = wstd(pairs, wmean(pairs)); }
      if (value == null) continue;
      const members = Object.fromEntries(pairs.filter(p => !p.derived).map(p => [p.member, Math.round(p.v * 100) / 100]));
      out.push({ valid, v, value, spread, n: pairs.filter(p => !p.derived).length || pairs.length, conf: confidence(v, spread, pairs.length, tol), members });
    }
  }
  const runAt = nowIso();
  db.tx(() => {
    db.run('DELETE FROM fused WHERE place_id = ? AND valid_at BETWEEN ? AND ?', place.id, from, to);
    for (const r of out) db.run('INSERT OR REPLACE INTO fused (place_id, valid_at, var, value, spread, n, conf, members, run_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      place.id, r.valid, r.v, r.value, r.spread, r.n, r.conf, JSON.stringify(r.members), runAt);
  });
  return { place: place.id, hours: g.size, values: out.length, members: [...new Set(rows.map(r => r.member))] };
}

function run(ctx, places) { return places.map(p => fusePlace(ctx, p)); }

/* the fused hours of a place as rows { valid, t2m, t2m_spread, ..., _conf: {var: conf}, _members: {var: {...}} } */
function table(db, placeId, from, to) {
  const m = new Map();
  for (const r of db.all('SELECT valid_at, var, value, spread, n, conf, members FROM fused WHERE place_id = ? AND valid_at BETWEEN ? AND ? ORDER BY valid_at', placeId, from, to)) {
    if (!m.has(r.valid_at)) m.set(r.valid_at, { valid: r.valid_at, _conf: {}, _spread: {}, _members: {}, _n: {} });
    const h = m.get(r.valid_at);
    h[r.var] = r.value; h._spread[r.var] = r.spread; h._conf[r.var] = r.conf; h._n[r.var] = r.n;
    h._members[r.var] = JSON.parse(r.members || '{}');
  }
  return [...m.values()];
}

module.exports = { run, fusePlace, table, leadBucket, wmedian, wmean, wstd, fuseCode, confidence };
