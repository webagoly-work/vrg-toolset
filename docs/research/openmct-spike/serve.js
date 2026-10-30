#!/usr/bin/env node
// Open MCT spike — dev-only static server (2026-10-20).
//
// Open MCT cannot run from file://: its workers (search, historical telemetry, comps) need an
// origin, and LocalStorage persistence needs one too. So this serves three things from ONE origin:
//
//   /            -> index.html next to this file (+ the plugin beside it)
//   /mct/...     -> <repo>/Vendor/openmct/dist/...   (node tools/fetch-vendor.js openmct)
//   /plan/<name> -> <repo>/Calculator/<name>.vplan.json   (only that folder, only .vplan.json)
//
// Run:  node docs/research/openmct-spike/serve.js            (port 8150)
//       node docs/research/openmct-spike/serve.js 8151 --repo H:/VRG/Full/Planner_VRG_U100
// Open: http://localhost:8150/?plan=CLA-teszt_v2
//
// Loopback only. Nothing here ships.
const http = require('http'), fs = require('fs'), path = require('path');
const HERE = __dirname;
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const REPO = path.resolve(opt('--repo') || path.join(HERE, '..', '..', '..'));
const MCT = path.join(REPO, 'Vendor', 'openmct', 'dist');
const PLANS = path.join(REPO, 'Calculator');
const PORT = +argv.find(a => /^\d+$/.test(a)) || +process.env.PORT || 8150;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json' };

function inside(root, rel) { const f = path.resolve(root, rel); return f.startsWith(root + path.sep) ? f : null; }

function resolve(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/' || p === '/index.html') return path.join(HERE, 'index.html');
  if (p.startsWith('/mct/')) return inside(MCT, p.slice(5));
  if (p.startsWith('/plan/')) {
    const name = p.slice(6).replace(/\.vplan\.json$/, '');
    if (!/^[\w.\- ]+$/.test(name)) return null;
    return inside(PLANS, name + '.vplan.json');
  }
  if (/^\/[\w.\-]+\.(js|css|svg)$/.test(p)) return inside(HERE, p.slice(1));
  return null;
}

if (!fs.existsSync(path.join(MCT, 'openmct.js'))) {
  console.log('Open MCT is not fetched. Run: node tools/fetch-vendor.js openmct');
  process.exit(1);
}
http.createServer((req, res) => {
  const full = resolve(req.url);
  if (!full) { res.writeHead(404).end('not found'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('Open MCT spike on http://localhost:' + PORT + '/?plan=CLA-teszt_v2'));
