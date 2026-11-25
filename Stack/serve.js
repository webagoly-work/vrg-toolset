#!/usr/bin/env node
// VRG Stack — tiny static server for the pages (they also work from file://).
//   node serve.js [port]   → http://localhost:8806/stack-search.html · /connectome.html
// Two live endpoints for connectome.html (local only, 127.0.0.1):
//   POST /api/connectome   rewrite out/connectome-data.js from out/ (≈ 2 s)
//   POST /api/build        run the full stack build first (≈ 6–30 s), then the connectome
// Two for the Stack Viewer (viewer.html, S10; read-only):
//   GET /api/bytes?path=<C folder>   that folder's tracked files, ≤ 4 MB (lib/bytes.js says what is never served)
//   GET /api/events                  server-sent events: `changed` {generated, layers, build: {kind, layers, ids}} whenever
//                                    a build finishes (any: START R → B, POST /api/build, a session's stack.js build, the
//                                    live build below); `live` {state, …} while the live build works or fails
// The live build (S5, research/STRINGS-PLAN.md §3.2): the hand-kept sources are watched (lib/sourcemap.js says which
// file feeds which layer); 1 s after the last change only those layers are rebuilt (pipeline.runLayers, target
// under 1.5 s), or the whole stack when an incremental build cannot be exact. `--no-live` turns it off.
//   GET /api/live                    { on, state, pending, last, error }
// The write gateway (S6, lib/edit.js; decisions only): nothing is written without the shown diff being approved
//   POST /api/edit/preview {op}         → { diff, hash, answer, line }   writes nothing
//   POST /api/edit/apply   {op, hash}   → writes the one answer line, refused if the file changed since; logs an edit
//   Only from this server's own pages: JSON body, Host and Origin must be localhost / 127.0.0.1 on this port, so another
//   site open in the browser cannot post here (CSRF, DNS rebinding). Never commits.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = +process.argv[2] || 8806;
const TYPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
let busy = null;
const BYTES = require('./lib/bytes');
const EDIT = require('./lib/edit');
const SM = require('./lib/sourcemap');
const LIVE_ON = !process.argv.includes('--no-live');
const LIVE_WAIT = 1000;   // ms after the last change of a source: an editor's save (often two writes) is over by then
const LOCAL = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
function ownPage(req) {
  if (!LOCAL.has(String(req.headers.host || ''))) return false;
  const o = req.headers.origin; if (o && !LOCAL.has(o.replace(/^https?:\/\//, ''))) return false;
  return /^application\/json\b/i.test(String(req.headers['content-type'] || ''));
}
function body(req, max = 16384) {
  return new Promise((ok, no) => { let n = 0; const parts = [];
    req.on('data', c => { n += c.length; if (n > max) { no(Object.assign(new Error('body too large'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { no(Object.assign(new Error('bad JSON'), { code: 400 })); } }); });
}

/* ---- the live channel: out/layertext/index.js is written last by every build */
const LT_DIR = path.join(ROOT, 'out', 'layertext'), clients = new Set();
let watcher = null, debounce = null, selfAt = 0;   // selfAt: the live build announced its own write already
function changedEvent() {
  let ix = null;
  try { const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(LT_DIR, 'index.js'), 'utf8'), box); ix = box.window.LAYERTEXT_INDEX; } catch { return; }
  if (!ix) return;
  const b = ix.build || { kind: 'full' };
  const layers = b.kind === 'incremental' ? b.layers : Object.keys(ix.layers || {}).filter(L => { const d = (ix.diff || {})[L]; return !d || d.changed.length || d.added.length || d.removed.length; });
  send('changed', { generated: ix.generated, layers, build: b });
}
function send(event, data) { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const res of clients) res.write(msg); }

/* ---- the live build: watch the sources, rebuild the layers they feed */
const live = { on: LIVE_ON, state: LIVE_ON ? 'idle' : 'off', pending: [], last: null, error: null };
const pend = new Set(); let liveT = null;
function onSource(file) {
  const ls = SM.layersFor(file); if (!ls.length) return;
  for (const l of ls) pend.add(l);
  live.pending = [...pend]; clearTimeout(liveT); liveT = setTimeout(liveBuild, LIVE_WAIT);
}
async function liveBuild() {
  liveT = null;
  if (busy) { liveT = setTimeout(liveBuild, 1000); return; }
  const codes = [...pend]; pend.clear(); live.pending = [];
  if (!codes.length) return;
  busy = 'live ' + codes.join(' '); live.state = 'building'; live.error = null; send('live', { state: 'building', layers: codes });
  const t0 = Date.now();
  try {
    const P = require('./lib/pipeline');
    let r = await P.runLayers(codes);
    if (r.fallback) { send('live', { state: 'building', layers: codes, full: true, why: r.fallback }); await P.run({ quiet: true, noArchive: true, noEmbed: true }); r = { kind: 'full', layers: codes, why: r.fallback }; }
    live.last = { ...r, ids: (r.ids || []).slice(0, 50), at: new Date().toISOString(), wallMs: Date.now() - t0 }; live.state = 'idle';
    clearTimeout(debounce); selfAt = Date.now(); changedEvent();   // announce now, not after the file watcher's own wait
    console.log(`live: ${r.kind} ${codes.join(' ')} · ${Date.now() - t0} ms${r.why ? ' (' + r.why + ')' : ''}`);
  } catch (e) {
    const msg = String(e && e.message || e).split('\n')[0];
    if (/another build is running/.test(msg)) { for (const c of codes) pend.add(c); live.pending = [...pend]; liveT = setTimeout(liveBuild, 5000); live.state = 'waiting'; }
    else { live.state = 'error'; live.error = { layers: codes, msg, at: new Date().toISOString() }; send('live', { state: 'error', layers: codes, msg }); console.log('live: ' + codes.join(' ') + ' failed: ' + msg); }
  } finally { busy = null; if (pend.size && !liveT) liveT = setTimeout(liveBuild, 300); }
}
const sourceWatchers = [];
if (LIVE_ON) for (const r of SM.roots()) {
  try { sourceWatchers.push(fs.watch(r.dir, { recursive: r.recursive }, (ev, f) => { if (f) onSource(path.join(r.dir, String(f))); })); }
  catch (e) { console.log(`live: cannot watch ${r.dir} (${e.code || e.message}); its layers follow the next full build`); }
}
function watch() {
  if (watcher) return;
  try {
    watcher = fs.watch(LT_DIR, (ev, f) => { if (String(f || '') !== 'index.js' || Date.now() - selfAt < 1500) return; clearTimeout(debounce); debounce = setTimeout(changedEvent, 700); });
    watcher.on('error', () => { try { watcher.close(); } catch {} watcher = null; });
  } catch { watcher = null; }
}
setInterval(() => { watch(); for (const res of clients) res.write(': keep-alive\n\n'); }, 20000).unref();
watch();
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function api(kind) {
  const t0 = Date.now();
  if (kind === 'build') { const r = await require('./lib/pipeline').run({ quiet: true }); if (r.worst === 'fail') throw new Error('build failed — see out/HEALTH.md'); }
  delete require.cache[require.resolve('./lib/connectome')];
  const c = require('./lib/connectome').write();
  return { ok: true, kind, ms: Date.now() - t0, msg: c.msg };
}
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/stack-search.html';
  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 5000\n\n'); clients.add(res); watch();
    req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/live') return json(res, 200, { ok: true, ...live });
  if (p === '/api/bytes') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, msg: 'GET only' });
    try {
      const q = new URL(req.url, 'http://x').searchParams, r = BYTES.folderBytes(path.join(ROOT, '..'), q.get('path'));
      return json(res, 200, { ok: true, path: r.path, files: r.files, total: r.total, truncated: r.truncated, b64: r.buf.toString('base64') });
    } catch (e) { return json(res, e.code >= 400 ? e.code : 500, { ok: false, msg: String(e.message || e) }); }
  }
  if (p === '/api/edit/preview' || p === '/api/edit/apply') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, msg: 'POST only' });
    if (!ownPage(req)) return json(res, 403, { ok: false, msg: 'only from this server\'s own pages (JSON, localhost)' });
    if (busy) return json(res, 409, { ok: false, msg: 'busy: ' + busy + ', try again when it is done' });
    return body(req).then(b => {
      const ctx = { repo: path.join(ROOT, '..'), log: path.join(ROOT, 'data', 'events.jsonl') };
      return json(res, 200, p.endsWith('preview') ? EDIT.preview(b.op, ctx) : EDIT.apply(b.op, b.hash, ctx));
    }).catch(e => json(res, e.code >= 400 && e.code < 600 ? e.code : 500, { ok: false, msg: String(e.message || e) }));
  }
  if (p === '/api/connectome' || p === '/api/build') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, msg: 'POST only' });
    if (busy) return json(res, 409, { ok: false, msg: 'busy: ' + busy });
    busy = p.slice(5);
    return api(busy).then(r => json(res, 200, r), e => json(res, 500, { ok: false, msg: String(e && e.message || e) })).finally(() => { busy = null; });
  }
  // the page links the Mélyvíz stylesheet from the repo
  // pages link the repo's shared/ either as ../../Planner_VRG_U100/shared/ or as ../shared/ (which the browser asks for as /shared/)
  const file = p.startsWith('/Planner_VRG_U100/shared/') ? path.join(ROOT, '../..', p) : p.startsWith('/shared/') ? path.join(ROOT, '..', p) : path.join(ROOT, p);
  if (!file.startsWith(path.join(ROOT, '../..'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPE[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(buf); });
}).listen(PORT, '127.0.0.1', () => console.log(`VRG Stack: http://localhost:${PORT}/stack-search.html · http://localhost:${PORT}/connectome.html`));
