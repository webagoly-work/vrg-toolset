// VRG Időjárás — `brief`: the work-day briefing per place, in Hungarian, for a crew lead to read in a minute.
// Markdown (UTF-8) in data/briefs/<day>/<place>.md with --save; the console gets the ASCII form.
'use strict';

const fs = require('fs');
const path = require('path');
const { WMO, wmoSev, isThunder } = require('./vars');
const { now, local, addH, DATA } = require('./common');
const FUSE = require('./fuse');
const R = require('./rules');

const n1 = x => (x == null ? '–' : x.toFixed(1).replace('.', ','));
const n0 = x => (x == null ? '–' : String(Math.round(x)));

function dayHours(db, place, day, tz) {
  // the local day as UTC hours (the hour ending at valid): wide window, then filter by local date
  const start = addH(day + 'T00:00Z', -3), end = addH(day + 'T00:00Z', 27);
  return FUSE.table(db, place.id, start, end).filter(h => local(addH(h.valid, -1), tz).date === day);
}

function workWindows(ctx, place, day, tz) {
  const wd = ctx.settings.workday;
  const w = R.windows(ctx, place, 72);
  const acts = Object.fromEntries((ctx.cfg.rules.activities || []).map(a => [a.id, a.hu]));
  const out = [];
  for (const [act, hours] of Object.entries(w)) {
    const mine = hours.filter(h => { const l = local(addH(h.valid, -1), tz); return l.date === day && l.hour >= wd.from && l.hour < wd.to; });
    if (!mine.length) continue;
    const ok = mine.filter(h => h.level === 'ok' || h.level === 'info');
    // longest run of usable hours
    let best = [], cur = [];
    for (const h of mine) { if (h.level === 'ok' || h.level === 'info') { cur.push(h); if (cur.length > best.length) best = cur.slice(); } else cur = []; }
    const red = mine.filter(h => h.level === 'red').length;
    const range = best.length ? `${String(local(addH(best[0].valid, -1), tz).hour).padStart(2, '0')}–${String(local(best[best.length - 1].valid, tz).hour).padStart(2, '0')}` : null;
    out.push({ act, hu: acts[act] || act, ok: ok.length, of: mine.length, red, best: range });
  }
  return out;
}

function make(ctx, place, which = 'today') {
  const { db, settings, cfg } = ctx;
  const tz = settings.timezone;
  const base = which === 'tomorrow' ? addH(now().toISOString(), 24) : now().toISOString();
  const day = local(base, tz).date;
  const hours = dayHours(db, place, day, tz);
  const L = [];
  L.push(`# ${place.name} — ${day} (${which === 'tomorrow' ? 'holnap' : 'ma'})`);
  if (!hours.length) {
    L.push('', 'Nincs konszenzus-előrejelzés erre a napra. Futtasd: `node Weather/vrg-weather.js run modell`.');
    return { day, place: place.id, text: L.join('\n') };
  }
  const t = hours.map(h => h.t2m).filter(x => x != null);
  const precip = hours.reduce((a, h) => a + (h.precip || 0), 0);
  const gust = Math.max(...hours.map(h => h.gust ?? -1));
  const pop = Math.max(...hours.map(h => h.pop ?? -1));
  const worst = hours.filter(h => h.wmo != null).sort((a, b) => wmoSev(b.wmo) - wmoSev(a.wmo))[0];
  const thunderH = hours.filter(h => h.wmo != null && isThunder(h.wmo)).length;
  const low = hours.filter(h => ['t2m', 'gust', 'precip'].some(v => h._conf[v] === 'alacsony')).length;
  const members = new Set(hours.flatMap(h => Object.keys(h._members.t2m || {})));

  L.push('');
  L.push(`**${n0(Math.min(...t))} … ${n0(Math.max(...t))} °C**, csapadék ${n1(precip)} mm (legfeljebb ${n0(pop)} %), széllökés legfeljebb ${n1(gust < 0 ? null : gust)} m/s` +
    (worst ? `, legrosszabb: ${WMO[worst.wmo] ? WMO[worst.wmo].hu : worst.wmo}` : '') + (thunderH ? `, **zivatar ${thunderH} órában**` : '') + '.');
  L.push(`Biztonság: ${low ? `${low} órában bizonytalan (a források eltérnek)` : 'a források egyetértenek'}; ${members.size} előrejelzés-forrás.`);

  const ws = workWindows(ctx, place, day, tz);
  if (ws.length) {
    L.push('', '## Munkaablak (munkaidőben)');
    for (const w of ws) L.push(`- ${w.hu}: ${w.ok}/${w.of} óra jó` + (w.best ? `, a leghosszabb: ${w.best}` : '') + (w.red ? ` — ${w.red} óra TILOS` : ''));
  }
  const dayStart = addH(day + 'T00:00Z', -2), dayEnd = addH(day + 'T00:00Z', 26);
  const alerts = db.all(`SELECT level, activity, title, starts, ends, basis FROM alert WHERE place_id = ? AND status IN ('open', 'ack') AND starts < ? AND ends > ?
    ORDER BY CASE level WHEN 'red' THEN 0 WHEN 'amber' THEN 1 ELSE 2 END, starts`, place.id, dayEnd, dayStart);
  if (alerts.length) {
    L.push('', '## Riasztások');
    const seen = new Set();
    for (const a of alerts) {
      const k = a.title; if (seen.has(k)) continue; seen.add(k);
      const hh = x => String(local(x, tz).hour).padStart(2, '0') + ':00';
      L.push(`- ${a.level === 'red' ? '🔴' : a.level === 'amber' ? '🟠' : 'ℹ️'} ${hh(a.starts)}–${hh(a.ends)} ${a.title}  \n  _${a.basis}_`);
    }
  }
  const pv = db.get("SELECT value FROM climate WHERE source_id = 'pvgis' AND place_id = ? AND key = 'pv_E_d' AND month = ?", place.id, +day.slice(5, 7));
  if (pv) {
    const sw = hours.reduce((a, h) => a + (h.swrad || 0), 0) / 1000;   // kWh/m² over the day (hourly means)
    L.push('', `PV: ma kb. ${n1(sw)} kWh/m² besugárzás; a hónap jellemző napi hozama ${n1(pv.value)} kWh/kWp (PVGIS).`);
  }
  const used = cfg.sources.filter(s => [...members].some(m => m.startsWith(s.id + '/')) || (s.kind === 'warning' && alerts.length));
  L.push('', '---', '_' + (settings.use === 'evaluation' ? 'KIÉRTÉKELÉS (nem üzleti) · ' : '') + used.map(s => s.attribution).join(' · ') + '_');
  return { day, place: place.id, text: L.join('\n') };
}

function save(b) {
  const dir = path.join(DATA, 'briefs', b.day);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${b.place}.md`);
  fs.writeFileSync(f, b.text + '\n');
  return f;
}

module.exports = { make, save, workWindows };
