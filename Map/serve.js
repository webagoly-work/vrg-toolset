#!/usr/bin/env node
// VRG Térkép on http://localhost:8802 — bound to this PC only.
//
//   /                       the map page (vrg-terkep.html)
//   /style/*                Map/style
//   /data/*                 Map/data, with HTTP Range (the .pmtiles files are read in pieces)
//   /vendor/maplibre-gl/*   Vendor/maplibre-gl/dist
//   /vendor/pmtiles/*       Vendor/pmtiles/dist
//
// Offline by design: nothing here reaches the internet. Run node Map/tools/fetch-data.js once.
// --no-open  start without opening the browser (START opens it itself).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { spawn } = require('child_process');

const MAP = __dirname, REPO = path.resolve(MAP, '..');
const PORT = Number(process.env.VRG_MAP_PORT) || 8802;
const ROUTES = [
  ['/style/', path.join(MAP, 'style')],
  ['/data/', path.join(MAP, 'data')],
  ['/vendor/maplibre-gl/', path.join(REPO, 'Vendor', 'maplibre-gl', 'dist')],
  ['/vendor/pmtiles/', path.join(REPO, 'Vendor', 'pmtiles', 'dist')],
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

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url.startsWith('/remote/')) { proxy(req, res); return; }
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
}).listen(PORT, '127.0.0.1', () => {
  const url = 'http://localhost:' + PORT + '/';
  console.log('VRG Terkep on ' + url);
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
  }
});
