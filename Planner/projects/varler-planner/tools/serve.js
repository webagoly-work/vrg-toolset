// Dev-only static server for browser checks of the built Planner.
//
// `file://` gives the page a null origin, where localStorage fails silently and fetch is
// blocked — so a real plan cannot be loaded and the save slots cannot be exercised. This
// serves the REPO ROOT (not the project folder) so that both the build and the test plans
// under Calculator/ are reachable from one origin:
//
//   http://localhost:8131/Planner/projects/varler-planner/dist/varler_planner.html
//   http://localhost:8131/Calculator/P33-teszt_v2.vplan.json
//
// Nothing here ships: the product is still the one offline HTML file.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');   // tools -> varler-planner -> projects -> Planner -> repo
const PORT = +process.env.PORT || 8131;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
    || 'Planner/projects/varler-planner/dist/varler_planner.html';
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('Planner on http://localhost:' + PORT + '/'));
