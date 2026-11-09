#!/usr/bin/env node
// VRG Stack — tiny static server for the pages (they also work from file://).
//   node serve.js [port]   → http://localhost:8806/stack-search.html · /connectome.html
// Two live endpoints for connectome.html (local only, 127.0.0.1):
//   POST /api/connectome   rewrite out/connectome-data.js from out/ (≈ 2 s)
//   POST /api/build        run the full stack build first (≈ 6–30 s), then the connectome
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = +process.argv[2] || 8806;
const TYPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
let busy = null;
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
