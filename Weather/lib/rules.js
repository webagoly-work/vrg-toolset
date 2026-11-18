// VRG Időjárás — `alerts`: config/rules.json evaluated over the consensus, the warnings and the strikes.
//
// Findings become alerts. An alert is identified by its fingerprint (rule | place | activity | local start day), so
// re-running the same evaluation updates it instead of repeating it. An open alert that is no longer found is
// cleared; an acknowledged one stays acknowledged unless its level rises. A new or escalated alert is queued in
// the outbox for every channel in settings.outbox.channels.
'use strict';

const fs = require('fs');
const path = require('path');
const { VARS, isThunder } = require('./vars');
const { now, local, addH, hourFloor, km, DATA } = require('./common');
const { iso, nowIso } = require('./db');
const FUSE = require('./fuse');
const P = require('./places');
const { LEVEL_HU } = require('./adapters/meteoalarm');

const RANK = { info: 1, amber: 2, red: 3 };

// ---------------------------------------------------------------- conditions
function values(h, v, stat) {
  if (h[v] == null) return [];
  if (stat === 'any' || stat === 'all') { const m = h._members[v] || {}; const vals = Object.values(m); return vals.length ? vals : [h[v]]; }
  const s = h._spread[v] || 0;
  if (stat === 'upper') return [h[v] + s];
  if (stat === 'lower') return [h[v] - s];
  return [h[v]];
}
function test(op, x, value) {
  switch (op) {
    case '>=': return x >= value; case '>': return x > value;
    case '<=': return x <= value; case '<': return x < value;
    case 'thunder': return isThunder(x);
    case 'in': return (value || []).includes(x);
    default: throw new Error('ismeretlen művelet: ' + op);
  }
}
function cond(h, c) {
  const vals = values(h, c.var, c.stat);
  if (!vals.length) return false;
  const hit = c.stat === 'all' ? vals.every(x => test(c.op, x, c.value)) : vals.some(x => test(c.op, x, c.value));
  return hit && (!c.and || cond(h, c.and));
}
const matches = (h, r) => (r.all ? r.all.every(c => cond(h, c)) : true) && (r.any ? r.any.some(c => cond(h, c)) : true) && !!(r.all || r.any);

const inWorkday = (valid, wd, tz) => { const l = local(valid, tz); return l.hour >= wd.from && l.hour < wd.to && wd.days.includes(l.wd); };

const fmt = (v, x) => (x == null ? '–' : VARS[v] && ['precip', 'snow', 'gust', 'wind'].includes(v) ? x.toFixed(1).replace('.', ',') : String(Math.round(x)));
function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)); }
function hourVars(h) {
  const o = {};
  for (const v of Object.keys(VARS)) if (h[v] != null) { o[v] = fmt(v, h[v]); o[v + '_upper'] = fmt(v, h[v] + (h._spread[v] || 0)); }
  return o;
}

// ---------------------------------------------------------------- the rule kinds
function hourly(rule, place, hours, ctx) {
  const wd = ctx.settings.workday, tz = ctx.settings.timezone;
  const out = []; let span = null;
  const close = () => {
    if (span && span.n >= (rule.persist || 1)) out.push(span);
    span = null;
  };
  for (const h of hours) {
    const ok = matches(h, rule) && (!rule.workday || inWorkday(h.valid, wd, tz));
    if (!ok) { close(); continue; }
    if (!span) span = { starts: addH(h.valid, -1), ends: h.valid, n: 0, worst: h };
    span.ends = h.valid; span.n++;
    // the worst hour names the numbers in the title: the most extreme value of the first condition's var
    const c = (rule.all || rule.any)[0];
    if (c && h[c.var] != null && span.worst[c.var] != null && (['<=', '<'].includes(c.op) ? h[c.var] < span.worst[c.var] : h[c.var] > span.worst[c.var])) span.worst = h;
  }
  close();
  return out.map(s => {
    const vars = hourVars(s.worst);
    const conf = s.worst._conf[(rule.all || rule.any)[0].var];
    return { level: rule.level, starts: s.starts, ends: s.ends, title: fill(rule.hu, vars),
      detail: `${s.n} óra; biztonság: ${conf || '–'}; források: ${Object.keys(s.worst._members[(rule.all || rule.any)[0].var] || {}).join(', ') || '–'}` };
  });
}

function warning(rule, place, ctx) {
  const t = iso(now()), until = addH(t, ctx.settings.horizonHours || 72);
  const rows = ctx.db.all(`SELECT w.* FROM warning w JOIN warning_place wp ON wp.warning_id = w.id WHERE wp.place_id = ? AND w.expires >= ? AND w.onset <= ?`, place.id, t, until);
  return rows.filter(w => rule.levels[String(w.level)]).map(w => ({
    level: rule.levels[String(w.level)], starts: w.onset, ends: w.expires, key: w.event,
    title: fill(rule.hu, { event: w.event || w.type || 'figyelmeztetés', levelHu: LEVEL_HU[w.level] || w.severity || '' }),
    detail: [w.area, w.headline, w.description].filter(Boolean).join(' — ').slice(0, 600),
  }));
}

function strike(rule, place, ctx) {
  const since = iso(new Date(now().getTime() - rule.minutes * 60e3));
  let best = null;
  for (const s of ctx.db.all('SELECT at, lat, lon FROM strike WHERE at >= ?', since)) {
    const d = km(place, s);
    if (d <= rule.radiusKm && (!best || s.at > best.at || (s.at === best.at && d < best.km))) best = { ...s, km: d };
  }
  if (!best) return [];
  const ago = Math.round((now() - new Date(best.at)) / 60e3);
  return [{ level: rule.level, starts: best.at, ends: iso(new Date(new Date(best.at).getTime() + rule.minutes * 60e3)),
    title: fill(rule.hu, { km: Math.round(best.km), ago }), detail: `legutóbbi villám ${best.lat.toFixed(3)}, ${best.lon.toFixed(3)}` }];
}

function heatwave(rule, place, hours, ctx) {
  const tz = ctx.settings.timezone, days = new Map();
  for (const h of hours) if (h.t2m != null) { const d = local(h.valid, tz).date; const a = days.get(d) || []; a.push(h.t2m); days.set(d, a); }
  const means = [...days].filter(([, a]) => a.length >= 20).map(([d, a]) => ({ d, mean: a.reduce((x, y) => x + y, 0) / a.length }));
  for (const step of rule.steps) {
    let run = [];
    for (const m of [...means, { d: null, mean: -99 }]) {
      if (m.mean >= step.mean) { run.push(m); continue; }
      if (run.length >= step.days) {
        return [{ level: step.level, starts: run[0].d + 'T00:00Z', ends: run[run.length - 1].d + 'T23:59Z',
          title: fill(step.hu, { from: run[0].d, to: run[run.length - 1].d }), detail: 'napi átlag: ' + run.map(r => `${r.d} ${r.mean.toFixed(1)} °C`).join(', ') }];
      }
      run = [];
    }
  }
  return [];
}

// ---------------------------------------------------------------- evaluate + sync
function evaluate(ctx, places) {
  const rules = ctx.cfg.rules.rules;
  const from = hourFloor(now()), to = addH(from, ctx.settings.horizonHours || 72);
  const findings = [];
  for (const place of places) {
    const hours = FUSE.table(ctx.db, place.id, addH(from, 1), to);
    const acts = place.activities && place.activities.length ? place.activities : ['kulteri'];
    for (const rule of rules) {
      const targets = rule.activities.includes('*') ? ['*'] : rule.activities.filter(a => acts.includes(a));
      if (!targets.length) continue;
      let found;
      if (rule.kind === 'hourly') found = hourly(rule, place, hours, ctx);
      else if (rule.kind === 'warning') found = warning(rule, place, ctx);
      else if (rule.kind === 'strike') found = strike(rule, place, ctx);
      else if (rule.kind === 'heatwave') found = heatwave(rule, place, hours, ctx);
      else throw new Error('ismeretlen szabályfajta: ' + rule.kind);
      for (const f of found) for (const activity of targets)
        findings.push({ ...f, rule: rule.id, place: place.id, activity, basis: rule.basis, source: rule.source });
    }
  }
  return findings;
}

function sync(ctx, places, findings) {
  const { db, settings } = ctx;
  const t = nowIso(), tz = settings.timezone;
  const fp = f => [f.rule, f.place, f.activity, f.key || '', local(f.starts, tz).date].join('|');
  // two spans of one rule on one day are one alert, from the first start to the last end
  const merged = new Map();
  for (const f of findings) {
    const k = fp(f), m = merged.get(k);
    if (!m) merged.set(k, { ...f });
    else { m.starts = f.starts < m.starts ? f.starts : m.starts; m.ends = f.ends > m.ends ? f.ends : m.ends; if (RANK[f.level] > RANK[m.level]) Object.assign(m, { level: f.level, title: f.title }); }
  }
  const stats = { new: 0, updated: 0, escalated: 0, cleared: 0 };
  const queued = [];
  db.tx(() => {
    for (const [k, f] of merged) {
      const old = db.get('SELECT id, level, status FROM alert WHERE fingerprint = ?', k);
      if (!old) {
        const r = db.run(`INSERT INTO alert (fingerprint, rule_id, place_id, activity, level, starts, ends, title, detail, basis, status, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`, k, f.rule, f.place, f.activity, f.level, f.starts, f.ends, f.title, f.detail || null, `${f.basis}: ${f.source}`, t, t);
        stats.new++; queued.push(Number(r.lastInsertRowid));
      } else {
        const up = RANK[f.level] > RANK[old.level];
        const status = old.status === 'ack' && !up ? 'ack' : 'open';
        db.run('UPDATE alert SET level = ?, starts = ?, ends = ?, title = ?, detail = ?, status = ?, last_seen = ? WHERE id = ?',
          f.level, f.starts, f.ends, f.title, f.detail || null, status, t, old.id);
        if (up || old.status === 'cleared') { stats.escalated += up ? 1 : 0; queued.push(old.id); } else stats.updated++;
      }
    }
    const ids = places.map(p => p.id);
    for (const a of db.all(`SELECT id, fingerprint FROM alert WHERE status IN ('open', 'ack') AND place_id IN (${ids.map(() => '?').join(',') || "''"})`, ...ids)) {
      if (!merged.has(a.fingerprint)) { db.run("UPDATE alert SET status = 'cleared', last_seen = ? WHERE id = ?", t, a.id); stats.cleared++; }
    }
    const channels = (settings.outbox && settings.outbox.channels) || ['file'];
    for (const id of queued) {
      const a = db.get('SELECT a.*, p.name AS place_name FROM alert a JOIN place p ON p.id = a.place_id WHERE a.id = ?', id);
      if (a.level === 'info') continue;   // info (e.g. a PV window) is shown, not sent
      for (const ch of channels) db.run('INSERT INTO outbox (alert_id, channel, created, payload) VALUES (?, ?, ?, ?)', id, ch, t, JSON.stringify(a));
    }
  });
  return stats;
}

// ---------------------------------------------------------------- delivery
async function deliver(ctx) {
  const { db, settings } = ctx;
  const pending = db.all('SELECT * FROM outbox WHERE delivered IS NULL ORDER BY id LIMIT 500');
  let ok = 0, failed = 0;
  for (const o of pending) {
    try {
      if (o.channel === 'file') {
        const dir = path.join(DATA, 'outbox'); fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, `alerts-${o.created.slice(0, 10)}.jsonl`), o.payload + '\n');
      } else if (o.channel === 'webhook') {
        const url = settings.outbox && settings.outbox.webhook;
        if (!url) throw new Error('nincs webhook cím (settings.local.json outbox.webhook)');
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: o.payload, signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } else if (o.channel !== 'console') throw new Error('ismeretlen csatorna: ' + o.channel);
      db.run('UPDATE outbox SET delivered = ?, error = NULL WHERE id = ?', nowIso(), o.id); ok++;
    } catch (e) { db.run('UPDATE outbox SET error = ? WHERE id = ?', String(e.message || e), o.id); failed++; }
  }
  return { ok, failed, pending: pending.length };
}

// ---------------------------------------------------------------- work windows (the page's strip and the brief)
// per activity, per hour: ok | info | amber | red, from the open/ack alerts covering that hour
function windows(ctx, place, hours = 48) {
  const from = hourFloor(now()), acts = place.activities && place.activities.length ? place.activities : ['kulteri'];
  const alerts = ctx.db.all("SELECT rule_id, activity, level, starts, ends, title FROM alert WHERE place_id = ? AND status IN ('open', 'ack') AND ends > ?", place.id, from);
  const out = {};
  for (const act of acts) {
    out[act] = [];
    for (let i = 1; i <= hours; i++) {
      const h = addH(from, i);   // the hour ending at h
      let level = 'ok', why = [];
      for (const a of alerts) if ((a.activity === act || a.activity === '*') && a.starts < h && a.ends >= h) {
        if (RANK[a.level] > (RANK[level] || 0)) level = a.level;
        why.push(a.title);
      }
      out[act].push({ valid: h, level, why });
    }
  }
  return out;
}

async function run(ctx, places) {
  const list = places || P.list(ctx.db);
  const findings = evaluate(ctx, list);
  const stats = sync(ctx, list, findings);
  const d = await deliver(ctx);
  return { ...stats, findings: findings.length, delivered: d.ok, failed: d.failed };
}

module.exports = { run, evaluate, sync, deliver, windows, matches, cond, RANK };
