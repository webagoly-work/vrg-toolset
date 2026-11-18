#!/usr/bin/env node
// VRG Időjárás on http://localhost:8808 — bound to this PC only.
//
//   /                         the page (vrg-idojaras.html)
//   /api/overview             places, sources (licence, gate, freshness), activities, open alerts, last runs
//   /api/place/<id>           one place: fused hours with spread and members, work windows, alerts, now, brief
//   /api/runs                 the run log
//   /latest.json              data/export/latest.json (for the VRG Asztal, Kapu, VRG Mobile relay)
//   POST /api/run/<pipeline>  run a pipeline from config/pipelines.json (one at a time)
//   POST /api/cmd             { argv: [...] } one command from a short allow-list
//   POST /api/ack/<id>        acknowledge an alert
// POSTs need the header x-vrg: 1 and a localhost Origin, so another web page cannot trigger them.
//
//   --daemon     also run the scheduler (config/pipelines.json schedule) while the server is up
//   --replay d   serve and run from recorded answers (offline demo: node Weather/test/fixtures.js first)
//   --no-open    do not open the browser (START opens it itself)
// Port: settings.port (8808) or VRG_WEATHER_PORT.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const C = require('./lib/commands');
const PIPE = require('./lib/pipeline');
const OPS = require('./lib/ops');
const P = require('./lib/places');
const FUSE = require('./lib/fuse');
const R = require('./lib/rules');
const BRIEF = require('./lib/brief');
const { parseArgs, now, addH, hourFloor, DATA, ascii } = require('./lib/common');

const args = parseArgs(process.argv.slice(2));
const ctx = C.context({ replay: args.replay ? path.resolve(args.replay) : null });
const PORT = Number(process.env.VRG_WEATHER_PORT || args.port) || ctx.settings.port || 8808;
const PAGE = path.join(__dirname, 'vrg-idojaras.html');
const ALLOWED = new Set(['fetch', 'fuse', 'verify', 'alerts', 'export', 'sync-jobs', 'doctor', 'brief', 'prune']);
let busy = null;

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const body = req => new Promise(r => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => r(s)); });
const localOrigin = req => { const o = req.headers.origin; return !o || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o); };

function overview() {
  const places = P.list(ctx.db).map(p => ({ id: p.id, name: p.name, kind: p.kind, code: p.job_code, area: p.area, activities: p.activities,
    open: ctx.db.get("SELECT COUNT(*) AS n, MAX(CASE level WHEN 'red' THEN 3 WHEN 'amber' THEN 2 ELSE 1 END) AS worst FROM alert WHERE place_id = ? AND status = 'open'", p.id) }));
  return {
    now: now().toISOString(), use: ctx.settings.use, replay: !!ctx.replay, timezone: ctx.settings.timezone, workday: ctx.settings.workday,
    places, sources: OPS.sourceStatus(ctx), activities: ctx.cfg.rules.activities, pipelines: Object.entries(ctx.cfg.pipelines.pipelines).map(([id, p]) => ({ id, hu: p.hu })),
    runs: ctx.db.all("SELECT id, kind, name, started, finished, status, summary FROM run WHERE kind = 'pipeline' ORDER BY id DESC LIMIT 12"),
    warnings: ctx.db.all('SELECT id, area, event, type, level, onset, expires, headline FROM warning WHERE expires >= ? ORDER BY level DESC, onset', now().toISOString().slice(0, 16) + 'Z'),
    tick: ctx.db.meta('daemon_tick'), busy,
  };
}

function place(id, hours) {
  const p = P.find(ctx.db, id);
  if (!p) return null;
  const h = hourFloor(now());
  return {
    place: p, hours: FUSE.table(ctx.db, p.id, addH(h, -6), addH(h, hours)), windows: R.windows(ctx, p, Math.min(hours, 72)),
    alerts: ctx.db.all("SELECT id, rule_id, activity, level, starts, ends, title, detail, basis, status FROM alert WHERE place_id = ? AND status IN ('open', 'ack') ORDER BY CASE level WHEN 'red' THEN 0 WHEN 'amber' THEN 1 ELSE 2 END, starts", p.id),
    current: OPS.current(ctx, p), brief: BRIEF.make(ctx, p, 'today').text, briefTomorrow: BRIEF.make(ctx, p, 'tomorrow').text,
    pv: ctx.db.all("SELECT key, month, value, unit FROM climate WHERE source_id = 'pvgis' AND place_id = ? ORDER BY key, month", p.id),
    rules: Object.fromEntries(ctx.cfg.rules.rules.map(r => [r.id, { basis: r.basis, source: r.source }])),
  };
}

async function guarded(name, fn) {
  if (busy) return { ok: false, error: 'fut már: ' + busy };
  busy = name;
  try { return await fn(); } finally { busy = null; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET') {
      if (p === '/' || p === '/index.html') return send(res, 200, fs.readFileSync(PAGE), 'text/html; charset=utf-8');
      if (p === '/api/overview') return send(res, 200, overview());
      if (p.startsWith('/api/place/')) { const r = place(decodeURIComponent(p.slice(11)), Math.min(+url.searchParams.get('hours') || 72, 120)); return r ? send(res, 200, r) : send(res, 404, { error: 'nincs ilyen hely' }); }
      if (p === '/api/runs') return send(res, 200, ctx.db.all('SELECT * FROM run ORDER BY id DESC LIMIT 100'));
      if (p === '/latest.json') { const f = path.join(DATA, 'export', 'latest.json'); return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f)) : send(res, 404, { error: 'még nincs export' }); }
      return send(res, 404, { error: 'nincs ilyen' });
    }
    if (req.method === 'POST') {
      if (req.headers['x-vrg'] !== '1' || !localOrigin(req)) return send(res, 403, { error: 'csak a saját oldalról' });
      if (p.startsWith('/api/run/')) {
        const name = decodeURIComponent(p.slice(9));
        if (!ctx.cfg.pipelines.pipelines[name]) return send(res, 404, { error: 'nincs ilyen folyamat' });
        return send(res, 200, await guarded(name, () => PIPE.runPipeline(ctx, name, C.dispatch)));
      }
      if (p === '/api/cmd') {
        const argv = (JSON.parse((await body(req)) || '{}').argv || []).map(String);
        if (!ALLOWED.has(argv[0])) return send(res, 400, { error: 'nem engedett parancs' });
        return send(res, 200, await guarded(argv[0], async () => { const r = await C.dispatch(ctx, argv); return { ok: r.ok, summary: r.summary, text: r.text }; }));
      }
      if (p.startsWith('/api/ack/')) { const n = ctx.db.run("UPDATE alert SET status = 'ack' WHERE id = ? AND status = 'open'", +p.slice(9)).changes; return send(res, 200, { ok: !!n }); }
    }
    send(res, 405, { error: 'nem engedett' });
  } catch (e) { send(res, 500, { error: String(e && e.message || e) }); }
});

server.listen(PORT, '127.0.0.1', () => {
  const u = `http://localhost:${PORT}/`;
  console.log(ascii(`VRG Idojaras: ${u}${ctx.replay ? '  (visszajatszas: ' + ctx.replay + ')' : ''}${args.daemon ? '  + utemezo' : ''}`));
  if (args.daemon) PIPE.daemon(ctx, C.dispatch, l => console.log(ascii(l)));
  if (!args['no-open'] && process.platform === 'win32') spawn('rundll32.exe', ['url.dll,FileProtocolHandler', u], { detached: true, stdio: 'ignore' }).unref();
});
server.on('error', e => { console.error(ascii('VRG Idojaras: ' + (e.code === 'EADDRINUSE' ? `a ${PORT} port foglalt (fut mar?)` : e.message))); process.exit(1); });

module.exports = server;
