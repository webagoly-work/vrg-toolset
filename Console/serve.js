/* Dev server for www/ (not used by the APK). node serve.js -> http://127.0.0.1:8133
   /tests/ is served too, for the ring gallery. localStorage needs a real origin. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { precacheSource } from './tools/build-precache.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(HERE, 'www');
const TESTS = path.join(HERE, 'tests');
const PORT = process.env.PORT || 8133;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/precache.js') {   // always current, so an edit reaches an installed copy without a rebuild
    res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
    return res.end(precacheSource());
  }
  const root = url.startsWith('/tests/') ? TESTS : WWW;
  const rel = url.startsWith('/tests/') ? url.slice('/tests'.length) : url;
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log('Varler Console on http://127.0.0.1:' + PORT));
