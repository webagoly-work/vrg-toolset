// VRG Időjárás — pipelines (named command lists) and the scheduler that runs them.
//
// A pipeline step is a plain vrg-weather command line ("fetch met-no --force"), run in-process through the same
// dispatcher the CLI uses, so anything you can type you can automate. Each pipeline and each step gets a row in
// `run`. A failed step is recorded and the pipeline continues: a dead source must not stop the warnings.
//
// Schedule entries (config/pipelines.json), in settings.timezone:
//   { "every": 15, "run": "gyors" }                 every 15 minutes (minute-of-day % 15 == offset)
//   { "at": "05:40", "run": "reggel" }              every day at 05:40
//   { "at": "03:20", "run": "pv", "day": 1 }        on the 1st of the month
'use strict';

const { splitCmd, local, now } = require('./common');
const { nowIso } = require('./db');

async function runPipeline(ctx, name, dispatch, log = () => {}) {
  const p = ctx.cfg.pipelines.pipelines[name];
  if (!p) throw new Error('nincs ilyen folyamat: ' + name + ' (' + Object.keys(ctx.cfg.pipelines.pipelines).join(', ') + ')');
  const started = nowIso();
  const id = Number(ctx.db.run("INSERT INTO run (kind, name, started, status) VALUES ('pipeline', ?, ?, 'running')", name, started).lastInsertRowid);
  const steps = [];
  for (const line of p.steps) {
    const argv = splitCmd(line);
    const t0 = Date.now();
    const sid = Number(ctx.db.run("INSERT INTO run (kind, name, started, status) VALUES ('step', ?, ?, 'running')", `${name}: ${line}`, nowIso()).lastInsertRowid);
    try {
      const r = await dispatch(ctx, argv);
      const status = r && r.ok === false ? 'warn' : 'ok';
      ctx.db.run('UPDATE run SET finished = ?, status = ?, summary = ? WHERE id = ?', nowIso(), status, String((r && r.summary) || '').slice(0, 500), sid);
      steps.push({ line, status, ms: Date.now() - t0, summary: r && r.summary });
      log(`  ${status === 'ok' ? 'ok  ' : 'WARN'} ${line}  ${(r && r.summary) || ''}`);
    } catch (e) {
      ctx.db.run("UPDATE run SET finished = ?, status = 'fail', summary = ? WHERE id = ?", nowIso(), String(e.message || e).slice(0, 500), sid);
      steps.push({ line, status: 'fail', ms: Date.now() - t0, summary: e.message });
      log(`  FAIL ${line}  ${e.message}`);
    }
  }
  const worst = steps.some(s => s.status === 'fail') ? 'fail' : steps.some(s => s.status === 'warn') ? 'warn' : 'ok';
  ctx.db.run('UPDATE run SET finished = ?, status = ?, summary = ? WHERE id = ?', nowIso(), worst, steps.map(s => `${s.status}:${s.line.split(' ')[0]}`).join(' '), id);
  return { name, status: worst, steps };
}

/* which schedule entries are due at this local minute? (pure, for the tests) */
function due(schedule, d, tz) {
  const l = local(d, tz);
  const mod = l.hour * 60 + l.minute;
  return schedule.filter(e => {
    if (e.day && +l.date.slice(8, 10) !== e.day) return false;
    if (e.at) return e.at === l.hm;
    if (e.every) return (mod - (e.offset || 0)) % e.every === 0;
    return false;
  }).map(e => e.run);
}

/* the daemon: a tick every 20 s; each local minute fires at most once; pipelines run one after the other */
function daemon(ctx, dispatch, log = console.log) {
  const tz = ctx.settings.timezone;
  const queue = []; let busy = false, lastKey = null, stopped = false;
  const pump = async () => {
    if (busy || !queue.length) return;
    busy = true;
    const name = queue.shift();
    try { log(`[${local(now(), tz).hm}] ${name}`); const r = await runPipeline(ctx, name, dispatch, log); log(`  -> ${r.status}`); }
    catch (e) { log('  -> FAIL ' + e.message); }
    busy = false; pump();
  };
  const tick = () => {
    if (stopped) return;
    const l = local(now(), tz), key = l.date + ' ' + l.hm;
    if (key === lastKey) return;
    lastKey = key;
    for (const name of due(ctx.cfg.pipelines.schedule || [], now(), tz)) if (!queue.includes(name)) queue.push(name);
    ctx.db.meta('daemon_tick', nowIso());
    pump();
  };
  tick();
  const timer = setInterval(tick, 20000);
  return { stop() { stopped = true; clearInterval(timer); }, queue, get busy() { return busy; } };
}

module.exports = { runPipeline, due, daemon };
