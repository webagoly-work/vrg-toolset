// The Gömb on http://localhost:8799, where the ruling buttons save. Bound to this PC only.
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn, spawnSync } = require('child_process');
const PAGE = path.join(__dirname, 'dist', 'vrg-solomon.html');
const TOOL = path.join(__dirname, '..', 'tools', 'solomon.js');
const PORT = 8799;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rule') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      let r;
      try { r = JSON.parse(body); } catch { res.writeHead(400).end('bad json'); return; }
      if (!/^[0-9a-f]{8}$/.test(r.id || '') || !['first', 'second', 'coexist'].includes(r.how) || !String(r.why || '').trim()) {
        res.writeHead(400).end('bad ruling');
        return;
      }
      const out = spawnSync(process.execPath, [TOOL, 'rule', r.id, r.how, String(r.why).trim()], { encoding: 'utf8' });
      if (out.status === 0) res.writeHead(200).end('ok');
      else res.writeHead(500).end(out.stderr || 'failed');
    });
    return;
  }
  fs.readFile(PAGE, (err, buf) => {
    if (err) { res.writeHead(404).end('Run: node tools/solomon.js scan'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('Solomon on http://localhost:' + PORT);
  spawn(process.execPath, [TOOL, 'pull'], { stdio: 'inherit' });   // rulings made on the phone since the last run
});
