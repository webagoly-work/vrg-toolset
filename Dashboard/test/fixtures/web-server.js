// web-server.js — a 127.0.0.1 HTTP fixture for the web view tests (WP-17). Never a real site (CONTRACT §4.9).
//   const srv = await start();  srv.url  → 'http://127.0.0.1:<port>'   await srv.close();
// /      title "VRG teszt", a target=_blank link (#blank → /second), a file: link (#file)
// /second  title "Masodik"      /dl  a 10-byte attachment data.bin      /perm  asks for geolocation, puts the outcome in the title
'use strict';
const http = require('http');

const PAGES = {
  '/': '<!doctype html><meta charset="utf-8"><title>VRG teszt</title><body>'
    + '<a id="blank" target="_blank" href="/second">uj lap</a> '
    + '<a id="file" href="file:///C:/Windows/win.ini">file</a></body>',
  '/second': '<!doctype html><meta charset="utf-8"><title>Masodik</title><body>second</body>',
  '/perm': '<!doctype html><meta charset="utf-8"><title>varakozas</title><body><script>'
    + 'navigator.geolocation.getCurrentPosition(function () { document.title = "granted"; }, function (e) { document.title = "denied:" + e.code; });'
    + '</script></body>',
};

function start() {
  const server = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/dl') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': 10, 'Content-Disposition': 'attachment; filename="data.bin"' });
      res.end('0123456789');
    } else if (PAGES[p]) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGES[p]);
    } else { res.writeHead(404); res.end('no'); }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ port, url: 'http://127.0.0.1:' + port, close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); }) });
    });
  });
}

module.exports = { start };
