#!/usr/bin/env node
// VRG Böngésző on http://127.0.0.1:8812 — bound to this PC only. The page works without it (bookmarks, history, search
// engines, Gyorsválasz); the server adds what a page cannot do on its own:
//
//   /                      the page (dist/vrg-bongeszo.html; `node Browser/build.js` makes it)
//   /api/health            { ok, version, docs, reader, suggest }
//   /api/reader?url=       Olvasó nézet: the page's readable text as plain blocks (lib/reader.js), fetched through
//                          lib/netguard.js (public addresses only, every redirect checked, 3 MB, 12 s)
//   /api/docs?q=&limit=    Helyi dokumentumok: the repo's Markdown in the search engine (lib/docs.js)
//   /api/doc?path=         one indexed document as reader blocks (only paths in the index)
//   /api/suggest?src=&q=   web suggestions (lib/suggest.js), only when the page has them turned on
//
// Every request must name this server in its Host header (a DNS-rebinding page cannot); an Origin, when sent, must be
// this server or the VRG Asztal's app origin (vrg-app://browser). Nothing is written to disk; the reader keeps no copy.
//
//   --port N       (default 8812, or VRG_BROWSER_PORT)
//   --no-open      do not open the browser (START opens it itself)
//   --allow-lan    let the reader fetch pages on the local network (never this PC itself)
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createGuard, explain } = require('./lib/netguard');
const { createDocs } = require('./lib/docs');
const { createSuggest } = require('./lib/suggest');
const reader = require('./lib/reader');

const VERSION = '1.0.0';
const DIST = path.join(__dirname, 'dist', 'vrg-bongeszo.html');
const REPO = path.resolve(__dirname, '..');

function createServer(opts) {
  const o = opts || {};
  const port = o.port || 8812;
  const guard = o.guard || createGuard({ allowLan: !!o.allowLan });
  const docs = o.docs || createDocs({ repo: o.repo || REPO });
  const suggest = o.suggest || createSuggest({ guard });
  const page = o.page || DIST;
  const HOSTS = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
  const ORIGINS = new Set(['http://127.0.0.1:' + port, 'http://localhost:' + port, 'vrg-app://browser'].concat(o.origins || []));
  let busy = 0;

  const send = (res, code, body, type, origin) => {
    const h = { 'content-type': type || 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-site' };
    if (origin && ORIGINS.has(origin)) { h['access-control-allow-origin'] = origin; h.vary = 'Origin'; }
    res.writeHead(code, h);
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };

  async function readerFor(url) {
    const r = await guard.get(url);
    if (r.status >= 400) return { ok: false, code: 'status', status: r.status, hu: 'Az oldal hibát adott (' + r.status + ').' };
    if (r.type === 'application/pdf') return { ok: false, code: 'pdf', url: r.url, hu: 'Ez PDF: nyisd meg a böngészőben; a felolvasó HTML oldalakat olvas.' };
    if (/^text\/plain/.test(r.type)) {
      const text = reader.decode(r.body, r.charset);
      const blocks = text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean).slice(0, 1500).map(t => ({ t: 'p', text: t.slice(0, 6000) }));
      return { ok: true, url: r.url, title: path.basename(new URL(r.url).pathname) || r.url, site: '', byline: '', lang: '', excerpt: (blocks[0] || {}).text || '', blocks, links: [], words: text.split(/\s+/).length };
    }
    if (!/html|xml/.test(r.type) && r.type) return { ok: false, code: 'type', url: r.url, hu: 'Ezt a tartalmat (' + r.type + ') a felolvasó nem olvassa.' };
    const x = reader.extract(reader.decode(r.body, r.charset), r.url);
    if (!x.blocks.length) return { ok: false, code: 'empty', url: r.url, title: x.title, hu: 'Az oldalon nincs kiolvasható szöveg (lehet, hogy csak JavaScripttel jelenik meg).' };
    return Object.assign({ ok: true, url: r.url }, x);
  }

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return send(res, 421, { ok: false, hu: 'Ismeretlen Host.' });
    if (origin && !ORIGINS.has(origin)) return send(res, 403, { ok: false, hu: 'Idegen oldalnak nem válaszolok.' });
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', origin);
    if (req.method !== 'GET') return send(res, 405, { ok: false, hu: 'Csak olvasás.' }, null, origin);
    const u = new URL(req.url, 'http://127.0.0.1');
    const q = k => String(u.searchParams.get(k) || '');
    try {
      if (u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/vrg-bongeszo.html') {
        if (!fs.existsSync(page)) return send(res, 503, 'Az oldal még nincs megépítve: node Browser/build.js', 'text/plain; charset=utf-8');
        return send(res, 200, fs.readFileSync(page), 'text/html; charset=utf-8');
      }
      if (u.pathname === '/api/health') return send(res, 200, { ok: true, version: VERSION, docs: docs.size(), reader: true, suggest: suggest.sources() }, null, origin);
      if (u.pathname === '/api/reader') {
        const url = q('url');
        const c = guard.check(url);
        if (!c.ok) return send(res, 400, { ok: false, code: c.code, hu: c.hu }, null, origin);
        if (busy >= 3) return send(res, 429, { ok: false, code: 'busy', hu: 'Egyszerre legfeljebb három oldalt olvasok; próbáld újra.' }, null, origin);
        busy++;
        try { return send(res, 200, await readerFor(url), null, origin); }
        catch (e) { return send(res, 200, { ok: false, code: e.code || 'fetch', hu: explain(e) }, null, origin); }
        finally { busy--; }
      }
      if (u.pathname === '/api/docs') {
        const lim = Math.min(30, Math.max(1, parseInt(q('limit'), 10) || 10));
        return send(res, 200, { ok: true, hits: q('q').trim() ? docs.search(q('q').slice(0, 200), lim) : [], total: docs.size() }, null, origin);
      }
      if (u.pathname === '/api/doc') {
        const d = docs.doc(q('path'));
        return d ? send(res, 200, Object.assign({ ok: true }, d), null, origin) : send(res, 404, { ok: false, hu: 'Nincs ilyen dokumentum az indexben.' }, null, origin);
      }
      if (u.pathname === '/api/suggest') {
        try { return send(res, 200, { ok: true, list: await suggest.get(q('src'), q('q')) }, null, origin); }
        catch (e) { return send(res, 200, { ok: false, list: [], hu: explain(e) }, null, origin); }
      }
      return send(res, 404, { ok: false, hu: 'Nincs ilyen.' }, null, origin);
    } catch (e) {
      return send(res, 500, { ok: false, hu: 'Belső hiba: ' + e.message }, null, origin);
    }
  });
  return { server, docs, port };
}

module.exports = { createServer, VERSION };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const val = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const port = Number(process.env.VRG_BROWSER_PORT || val('--port')) || 8812;
  const { server, docs } = createServer({ port, allowLan: argv.includes('--allow-lan') });
  server.listen(port, '127.0.0.1', () => {
    const t = Date.now();
    const n = docs.build();
    const url = 'http://127.0.0.1:' + port + '/';
    console.log('VRG Bongeszo: ' + url + '  (' + n + ' dokumentum indexelve, ' + (Date.now() - t) + ' ms)');
    if (!argv.includes('--no-open') && process.platform === 'win32') spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
  });
}
