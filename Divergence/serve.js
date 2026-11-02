// The Divergence board on http://localhost:8801, where its buttons act. Bound to this PC only.
const http = require('http'), fs = require('fs'), path = require('path');
const D = require('../tools/divergence.js');
const PORT = D.state().config.board.port || 8801;
const FILES = {
  '/': [path.join(__dirname, 'index.html'), 'text/html; charset=utf-8'],
  '/divergence.js': [path.join(D.REPO, 'shared', 'varler-logo', 'divergence.js'), 'text/javascript; charset=utf-8']
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function body(req, cb) {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 16384) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(b || '{}')); } catch { cb(null); } });
}
function run(res, fn) {
  try { send(res, 200, fn()); }
  catch (e) { send(res, e instanceof D.Refusal ? 400 : 500, { error: e instanceof D.Refusal ? e.message : String(e.message || e) }); }
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && url === '/api/state') return run(res, () => D.state());
  if (req.method === 'GET' && url.startsWith('/api/handoff/')) return run(res, () => D.handoff(decodeURIComponent(url.slice(13))));
  if (req.method === 'POST' && url === '/api/act') return body(req, b => b ? run(res, () => D.act(String(b.id || ''), String(b.action || ''), b.text)) : send(res, 400, { error: 'bad json' }));
  if (req.method === 'POST' && url === '/api/push') return run(res, () => D.push());
  const f = FILES[url];
  if (req.method !== 'GET' || !f) return send(res, 404, 'not found', 'text/plain');
  fs.readFile(f[0], (err, buf) => err ? send(res, 404, 'missing ' + path.basename(f[0]), 'text/plain') : send(res, 200, buf, f[1]));
}).listen(PORT, '127.0.0.1', () => console.log('Divergence board on http://localhost:' + PORT));
