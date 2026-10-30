/* Dev server for the www/ PWA (not used by the APK). node serve.js -> http://127.0.0.1:8130 */
var http = require('http'), fs = require('fs'), p = require('path');
var ROOT = p.join(__dirname, 'www'), PORT = process.env.PORT || 8130;
var T = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.zip':'application/zip' };
http.createServer(function (q, r) {
  var f = decodeURIComponent(q.url.split('?')[0]); if (f === '/') f = '/index.html';
  f = p.normalize(p.join(ROOT, f)); if (f.indexOf(ROOT) !== 0) { r.writeHead(403); return r.end(); }
  fs.readFile(f, function (e, d) { if (e) { r.writeHead(404); return r.end('404'); } r.writeHead(200, { 'content-type': T[p.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(PORT, function () { console.log('ServiceKit Phone www on http://127.0.0.1:' + PORT); });
