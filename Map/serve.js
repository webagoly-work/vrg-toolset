#!/usr/bin/env node
// VRG Térkép on http://localhost:8802 — bound to this PC only.
//
//   /                       the map page (vrg-terkep.html)
//   /lib/*                  Map/lib (the shared offline geocoder)
//   /style/*                Map/style
//   /data/*                 Map/data, with HTTP Range (the .pmtiles files are read in pieces)
//   /vendor/maplibre-gl/*   Vendor/maplibre-gl/dist
//   /vendor/pmtiles/*       Vendor/pmtiles/dist
//   /jobs/status            is the job layer on? { on, reason } — no client data, not logged
//   /weather/*              the W layer: weather fields, stations, strikes, warnings, radar from VRG Időjárás
//                           (Weather/data/weather.sqlite, read-only; Weather/lib/maplayers.js); /weather/jobs is client
//                           data and follows the job layer's switches; POST /weather/refresh runs Weather's 'terkep'
//                           pipeline (x-vrg: 1 and a localhost origin only). docs/map/WEATHER-MAP.md
//   /jobs/helyek.json       the job layer (client data, outside Git: jobs\_elozmenyek\helyek.json),
//                           no-store, every request logged to jobs\_elozmenyek\helyek-log.jsonl
//
// Offline by design: nothing here reaches the internet. Run node Map/tools/fetch-data.js once.
// --no-open  start without opening the browser (START opens it itself).
//
// The job layer's controls (docs/map/JOBS-MAP.md): it is off when
//   - launcher/vrg-menu.json's M tool entry says "jobsLayer": false            (the registry switch)
//   - the flag file jobs\_elozmenyek\TERKEP-KI exists                         (the quick switch)
//   - this is an OTG build (env VRG_OTG=1, a file .otg in the repo root, or a path under \OTG\)
//   - there is no jobs folder or no helyek.json
// Through the VRG Mobile relay (/p/8802/) the relay adds `x-vrg-via: relay`; the log records it.
//
// Env overrides (tests, worktrees): VRG_MAP_DATA (Map/data), VRG_VENDOR (Vendor), VRG_JOBS_DIR (jobs),
// VRG_MENU (launcher/vrg-menu.json). In a .claude\worktrees checkout without its own Map/data and
// Vendor, the main checkout's are used.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { spawn } = require('child_process');

const MAP = __dirname, REPO = path.resolve(MAP, '..');
const PORT = Number(process.env.VRG_MAP_PORT) || 8802;
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
// <main>\.claude\worktrees\<name> -> <main>
const MAIN = /[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/.test(REPO) ? path.resolve(REPO, '..', '..', '..') : null;
const pick = (env, own, fromMain) => process.env[env] ? path.resolve(process.env[env]) : (isDir(own) || !MAIN ? own : fromMain);
const DATA = pick('VRG_MAP_DATA', path.join(MAP, 'data'), MAIN && path.join(MAIN, 'Map', 'data'));
const VENDOR = pick('VRG_VENDOR', path.join(REPO, 'Vendor'), MAIN && path.join(MAIN, 'Vendor'));
const MENU = process.env.VRG_MENU ? path.resolve(process.env.VRG_MENU) : path.join(REPO, 'launcher', 'vrg-menu.json');
function jobsDir() {
  if (process.env.VRG_JOBS_DIR) return path.resolve(process.env.VRG_JOBS_DIR);
  // the work root's jobs folder: H:\VRG\Full\jobs next to the repo (or next to the main checkout)
  for (let d = REPO; path.dirname(d) !== d; d = path.dirname(d)) {
    const j = path.join(path.dirname(d), 'jobs');
    if (isDir(path.join(j, '_elozmenyek'))) return j;
  }
  return null;
}
const JOBS = jobsDir();
const HIST = JOBS && path.join(JOBS, '_elozmenyek');

const ROUTES = [
  ['/lib/', path.join(MAP, 'lib')],
  ['/style/', path.join(MAP, 'style')],
  ['/kocka/', path.join(MAP, 'kocka')],        // VRG Kocka, the holo cube (its own line of work until it merges, Map/kocka/README.md)
  ['/data/', DATA],
  ['/vendor/maplibre-gl/', path.join(VENDOR, 'maplibre-gl', 'dist')],
  ['/vendor/pmtiles/', path.join(VENDOR, 'pmtiles', 'dist')],
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.pbf': 'application/x-protobuf', '.pmtiles': 'application/octet-stream', '.map': 'application/json',
};
const gzCache = new Map();   // big JSON (the address index) is sent gzipped, compressed once

function resolve(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/' || p === '/index.html') return path.join(MAP, 'vrg-terkep.html');
  for (const [prefix, dir] of ROUTES) {
    if (!p.startsWith(prefix)) continue;
    const f = path.resolve(dir, '.' + p.slice(prefix.length - 1));
    return f.startsWith(dir + path.sep) ? f : null;
  }
  return null;
}

// ---------------------------------------------------------------- the job layer (client data)
function isOtg() {
  return process.env.VRG_OTG === '1' || isFile(path.join(REPO, '.otg')) || /[\\/]OTG[\\/]/i.test(REPO + path.sep);
}
function registrySwitch() {
  try {
    const m = JSON.parse(fs.readFileSync(MENU, 'utf8'));
    const t = ((m.start && m.start.tools) || []).find(x => x.server === 'terkep' || x.key === 'M');
    return !(t && t.jobsLayer === false);
  } catch { return true; }   // an unreadable registry does not hide the layer by itself; the flag file still can
}
/** -> { on, reason } (reason in Hungarian, shown by the page when off) */
function jobsState() {
  if (isOtg()) return { on: false, reason: 'OTG változat: a munkák rétege itt nem létezik.' };
  if (!JOBS) return { on: false, reason: 'Nincs munkamappa ezen a gépen.' };
  if (isFile(path.join(HIST, 'TERKEP-KI'))) return { on: false, reason: 'Kikapcsolva (jobs\\_elozmenyek\\TERKEP-KI).' };
  if (!registrySwitch()) return { on: false, reason: 'Kikapcsolva a START registryben (jobsLayer: false).' };
  if (!isFile(path.join(HIST, 'helyek.json'))) return { on: false, reason: 'Még nincs helyek.json: node Map/tools/build-jobs.js' };
  return { on: true, reason: '' };
}
function logAccess(req, entry) {
  if (!HIST) return;
  const via = String(req.headers['x-vrg-via'] || '') === 'relay' ? 'relay' : 'local';
  const line = JSON.stringify(Object.assign({ t: new Date().toISOString(), via, ua: String(req.headers['user-agent'] || '').slice(0, 200) }, entry));
  try { fs.appendFileSync(path.join(HIST, 'helyek-log.jsonl'), line + '\n'); } catch { /* the log must never break the map */ }
}
const NOSTORE = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function serveJobs(req, res) {
  const p = req.url.split('?')[0];
  const st = jobsState();
  if (p === '/jobs/status') { res.writeHead(200, NOSTORE).end(JSON.stringify(st)); return; }
  if (p !== '/jobs/helyek.json') { res.writeHead(404, NOSTORE).end('{}'); return; }
  if (!st.on) { logAccess(req, { ok: false, reason: 'off' }); res.writeHead(403, NOSTORE).end(JSON.stringify(st)); return; }
  let body;
  try { body = fs.readFileSync(path.join(HIST, 'helyek.json')); } catch (e) { res.writeHead(500, NOSTORE).end('{}'); return; }
  let n = null; try { n = (JSON.parse(body).jobs || []).length; } catch { /* counted only for the log */ }
  logAccess(req, { ok: true, n });
  res.writeHead(200, Object.assign({ 'Content-Length': body.length }, NOSTORE));
  res.end(req.method === 'HEAD' ? undefined : body);
}

// ---------------------------------------------------------------- the weather layer (W), from VRG Időjárás
// Off when launcher/vrg-menu.json's M entry says "weatherLayer": false. In a worktree without its own
// Weather/data the main checkout's database is read.
if (!process.env.VRG_WEATHER_DATA && MAIN && !isDir(path.join(REPO, 'Weather', 'data')) && isDir(path.join(MAIN, 'Weather', 'data')))
  process.env.VRG_WEATHER_DATA = path.join(MAIN, 'Weather', 'data');
let wxBusy = null;
function weatherSwitch() {
  try {
    const m = JSON.parse(fs.readFileSync(MENU, 'utf8'));
    const t = ((m.start && m.start.tools) || []).find(x => x.server === 'terkep' || x.key === 'M');
    return !(t && t.weatherLayer === false);
  } catch { return true; }
}
function wxLib() { return require(path.join(REPO, 'Weather', 'lib', 'maplayers.js')); }
async function serveWeather(req, res) {
  const u = new URL(req.url, 'http://localhost'), p = u.pathname;
  const json = (code, body) => res.writeHead(code, NOSTORE).end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  if (!weatherSwitch()) return json(p === '/weather/status' ? 200 : 403, { on: false, reason: 'Kikapcsolva a START registryben (weatherLayer: false).' });
  if (req.method === 'POST') {
    if (p !== '/weather/refresh') return json(404, {});
    const o = req.headers.origin;
    if (req.headers['x-vrg'] !== '1' || (o && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) return json(403, { error: 'csak a saját oldalról' });
    if (wxBusy) return json(409, { error: 'fut már' });
    wxBusy = Date.now();
    try {
      const C = require(path.join(REPO, 'Weather', 'lib', 'commands.js'));
      const ctx = C.context({});
      try { const r = await require(path.join(REPO, 'Weather', 'lib', 'pipeline.js')).runPipeline(ctx, 'terkep', C.dispatch); return json(200, { status: r.status, steps: r.steps }); }
      finally { ctx.db.close(); }
    } catch (e) { return json(500, { error: String(e.message || e) }); }
    finally { wxBusy = null; }
  }
  let M;
  try { M = wxLib().make(); } catch (e) { return json(500, { on: false, reason: 'VRG Időjárás nem tölthető be: ' + e.message }); }
  try {
    if (p === '/weather/status') return json(200, { ...M.status(), busy: !!wxBusy, jobs: jobsState().on });
    if (!M.available) return json(404, { error: 'nincs időjárás-adatbázis' });
    if (p === '/weather/fields') { const f = M.fields(u.searchParams.get('mode') === 'obs' ? 'obs' : 'forecast'); return f ? json(200, f) : json(404, { error: 'nincs mező' }); }
    if (p === '/weather/stations') return json(200, M.stations());
    if (p === '/weather/lightning') return json(200, M.lightning(Math.min(180, +u.searchParams.get('min') || 60)));
    if (p === '/weather/warnings') return json(200, M.warnings());
    if (p === '/weather/radar') return json(200, M.radar());
    const rf = /^\/weather\/radar\/([^/]+)\/([^/]+)$/.exec(p);
    if (rf) {
      const f = M.radarFile(decodeURIComponent(rf[1]), decodeURIComponent(rf[2]));
      if (!f || !isFile(f)) return json(404, {});
      const b = fs.readFileSync(f);
      return res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600', 'Content-Length': b.length }).end(req.method === 'HEAD' ? undefined : b);
    }
    if (p === '/weather/jobs') {
      // client data: the job codes. Same switches and the same access log as /jobs/helyek.json
      const st = jobsState();
      if (!st.on) { logAccess(req, { ok: false, reason: 'off', what: 'weather' }); return json(403, st); }
      const j = M.jobs();
      logAccess(req, { ok: true, n: Object.keys(j).length, what: 'weather' });
      return json(200, j);
    }
    return json(404, {});
  } catch (e) { return json(500, { error: String(e.message || e) }); }
  finally { M.close(); }
}

// --allow-remote (testing without the download): /remote/<host>/<path> forwards GET + Range to the
// two planet files' hosts. build.protomaps.com sends no CORS header, so the page cannot read it itself.
const REMOTE_HOSTS = new Set(['build.protomaps.com', 'download.mapterhorn.com', 'protomaps.github.io']);
const allowRemote = process.argv.includes('--allow-remote');
async function proxy(req, res) {
  const m = /^\/remote\/([^/]+)(\/.*)$/.exec(req.url);
  if (!allowRemote || !m || !REMOTE_HOSTS.has(m[1])) { res.writeHead(403).end('remote off'); return; }
  try {
    const up = await fetch('https://' + m[1] + m[2], { headers: req.headers.range ? { Range: req.headers.range } : {} });
    // fetch() has already un-gzipped the body: send its real length, not the upstream (compressed) one.
    const body = Buffer.from(await up.arrayBuffer());
    const head = { 'content-length': body.length };
    for (const h of ['content-type', 'content-range', 'accept-ranges', 'etag']) if (up.headers.get(h)) head[h] = up.headers.get(h);
    res.writeHead(up.status, head);
    res.end(body);
  } catch (e) { res.writeHead(502).end(String(e.message)); }
}

function handle(req, res) {
  if (req.url.startsWith('/weather/')) { serveWeather(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url.startsWith('/remote/')) { proxy(req, res); return; }
  if (req.url.startsWith('/jobs/')) { serveJobs(req, res); return; }
  const file = resolve(req.url);
  let st = null;
  try { st = file && fs.statSync(file); } catch { /* missing */ }
  if (!st || !st.isFile()) {
    // A glyph range we did not download: an empty range means "no glyphs here", not an error.
    if (/^\/data\/fonts\/.+\.pbf$/.test(req.url)) { res.writeHead(200, { 'Content-Type': TYPES['.pbf'] }).end(); return; }
    const missingData = req.url.startsWith('/data/') || req.url.startsWith('/vendor/');
    // no-store: a 404 is cacheable by default, and data that arrives later must not stay "missing"
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      .end(missingData ? 'Missing map data. Run: node Map/tools/fetch-data.js' : 'Not found');
    return;
  }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'no-cache' };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
    let end = range[1] === '' || range[2] === '' ? st.size - 1 : Math.min(Number(range[2]), st.size - 1);
    if (start > end || start < 0) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }).end(); return; }
    res.writeHead(206, Object.assign(head, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  if (type.startsWith('application/json') && st.size > 1e6 && /gzip/.test(req.headers['accept-encoding'] || '')) {
    const key = file + ':' + st.mtimeMs;
    if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 6 }));
    const gz = gzCache.get(key);
    res.writeHead(200, Object.assign(head, { 'Content-Encoding': 'gzip', 'Content-Length': gz.length }));
    res.end(req.method === 'HEAD' ? undefined : gz);
    return;
  }
  res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}

module.exports = { handle, jobsState, weatherSwitch, resolve, DATA, VENDOR, JOBS };

if (require.main === module) {
  http.createServer(handle).listen(PORT, '127.0.0.1', () => {
    const url = 'http://localhost:' + PORT + '/';
    console.log('VRG Terkep on ' + url + (JOBS ? '  (job layer: ' + (jobsState().on ? 'on' : 'off') + ')' : ''));
    if (!process.argv.includes('--no-open') && process.platform === 'win32') {
      spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
    }
  });
}
