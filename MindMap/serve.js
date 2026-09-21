// Dev-only static server. localStorage needs a real origin: file:// and data:
// both give the app a null origin, where saving silently fails.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.woff2':'font/woff2' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'vrg_mindmap.html';
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(8124, () => console.log('MindMap on http://localhost:8124'));
