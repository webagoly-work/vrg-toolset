#!/usr/bin/env node
// VRG Böngésző on http://127.0.0.1:8812 — bound to this PC only. The page works without it (bookmarks, history, search
// engines, Gyorsválasz); the server adds what a page cannot do on its own:
//
//   /                      the page (dist/vrg-bongeszo.html; `node Browser/build.js` makes it)
//   /api/health            { ok, version, docs, reader, suggest }
//   /api/reader?url=       Olvasó nézet: the page's readable text as plain blocks (lib/reader.js), fetched through
//                          lib/netguard.js (public addresses only, every redirect checked, 20 MB, 20 s); a PDF datasheet
//                          through lib/pdftext.js (pdf.js from Vendor/, text only)
//   /api/docs?q=&limit=    Helyi dokumentumok: the repo's Markdown in the search engine (lib/docs.js)
//   /api/doc?path=         one indexed document as reader blocks (only paths in the index)
//   /api/suggest?src=&q=   web suggestions (lib/suggest.js), only when the page has them turned on
//   /api/jobs              T3: the job codes with status and period (lib/jobs.js; never a folder name or an address)
//   /api/jobs/<CODE>/export  POST { bookmarks, reading, pdfs } → <the job's folder>\web: links.json, INDEX.md, olvaso\*.md,
//                          adatlapok\*.pdf (own page or the Asztal's app origin, JSON only)
//   /api/watch             T6: GET the page watches (with their last result); POST { url, hu, every } adds one, { remove: id }
//                          drops one — in the Asztal's <userDir>/presets.json (lib/watch.js); the Asztal runs them
//   /api/research          T5: POST { title, md, job? } → docs/research/web/<date>_<title>.md (or the job's web\kutatas\)
//   /api/links             T1 (BRW-Q01): GET the master bookmarks and history (the Asztal's web.json + the waiting inbox) as
//                          vrg.web-links v1; POST { ops } adds them to web.json.inbox, which the Asztal absorbs (it holds
//                          web.json in memory, so this server never writes the master itself). POST: own page, JSON only.
//
// Every request must name this server in its Host header (a DNS-rebinding page cannot); an Origin, when sent, must be
// this server or the VRG Asztal's app origin (vrg-app://browser). The only write is the links inbox; the reader keeps no copy.
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
const { pdfText } = require('./lib/pdftext');
const links = require('./src/core/links');
const { createJobs, slug: jobSlug } = require('./lib/jobs');
const { createWatch } = require('./lib/watch');

const VERSION = '1.0.0';
const DIST = path.join(__dirname, 'dist', 'vrg-bongeszo.html');
const REPO = path.resolve(__dirname, '..');
// the master links (T1, BRW-Q01): the VRG Asztal's <userDir>/web.json (Dashboard/shell/lib/paths.js, never created from here)
function deskUserDir() {
  try { const p = require('../Dashboard/shell/lib/paths.js'); return path.join(p.home(), p.user()); } catch (e) { return ''; }
}
function deskLinksFile() { const d = deskUserDir(); return d ? path.join(d, 'web.json') : ''; }

function createServer(opts) {
  const o = opts || {};
  const port = o.port || 8812;
  const guard = o.guard || createGuard({ allowLan: !!o.allowLan });
  const docs = o.docs || createDocs({ repo: o.repo || REPO });
  const suggest = o.suggest || createSuggest({ guard });
  const page = o.page || DIST;
  const linksFile = o.linksFile === undefined ? deskLinksFile() : o.linksFile;
  const jobs = o.jobs || createJobs({ dir: o.jobsDir, guard });
  const watch = o.watch || createWatch({ dir: o.deskDir === undefined ? deskUserDir() : o.deskDir, check: u => guard.check(u) });
  const repo = o.repo || REPO;
  // T5: a research note (Kutatás) — a general one into the repo's docs/research/web/ (it becomes searchable here at once and
  // part of the VRG Stack once committed), a job's one into that job's folder (web\kutatas\), never into git
  function writeResearch(j) {
    const title = String((j && j.title) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
    const md = String((j && j.md) || '');
    if (!title || !md.trim() || md.length > 400000) return { ok: false, code: 'bad', hu: 'Üres vagy túl hosszú jegyzet.' };
    const day = new Date().toISOString().slice(0, 10);
    const base = day + '_' + jobSlug(title, title).replace(/-[0-9a-f]{6}$/, '');
    let dir, shown;
    if (j.job) {
      const home = jobs.folderOf(String(j.job));
      if (!home) return { ok: false, code: 'no-folder', hu: 'A ' + String(j.job).slice(0, 8) + ' munkának nincs mappája.' };
      dir = path.join(home, 'web', 'kutatas'); shown = String(j.job) + '\\web\\kutatas\\';
    } else {
      // the repo goes to GitHub: a note that names one of this PC's jobs belongs in that job's folder (job codes are client data)
      const known = (() => { const l = jobs.list(); return l.ok ? l.jobs.map(x => x.code) : []; })();
      const hit = known.find(c => new RegExp('(^|[^A-Za-z0-9])' + c + '(?![0-9])').test(md + ' ' + title));
      if (hit) return { ok: false, code: 'job-code', job: hit, hu: 'A jegyzetben munkaszám szerepel (' + hit + '): munkához kötött jegyzet a munka mappájába kerül, nem a repóba. Add meg a munkaszámot a kutatásnál.' };
      dir = path.join(repo, 'docs', 'research', 'web'); shown = 'docs/research/web/';
    }
    fs.mkdirSync(dir, { recursive: true });
    let name = base + '.md';
    for (let n = 2; fs.existsSync(path.join(dir, name)) && fs.readFileSync(path.join(dir, name), 'utf8') !== md && n < 50; n++) name = base + '-' + n + '.md';
    const t = path.join(dir, name + '.tmp');
    fs.writeFileSync(t, md); fs.renameSync(t, path.join(dir, name));
    if (!j.job) { try { docs.build(); } catch (e) {} }
    return { ok: true, where: shown + name, hu: 'Mentve: ' + shown + name + (j.job ? '' : ' — a repóban; commit után a Rétegverem része.') };
  }
  // the master as the Asztal will see it: web.json plus the ops still waiting in the inbox (the Asztal absorbs it, lib/bookmarks.js)
  function masterLinks() {
    if (!linksFile || !fs.existsSync(path.dirname(linksFile))) return null;
    let base = links.empty(), pending = [];
    try { base = links.read(fs.readFileSync(linksFile, 'utf8')); } catch (e) { /* no web.json yet: the Asztal has not browsed */ }
    try { pending = JSON.parse(fs.readFileSync(linksFile + '.inbox', 'utf8')).ops || []; } catch (e) {}
    return links.apply(base, pending);
  }
  function toInbox(ops) {
    const clean = links.cleanOps(ops);
    if (!clean.length) return 0;
    let cur = [];
    try { cur = JSON.parse(fs.readFileSync(linksFile + '.inbox', 'utf8')).ops || []; } catch (e) {}
    const all = cur.concat(clean).slice(-5000);
    const tmpf = linksFile + '.inbox.tmp';
    fs.writeFileSync(tmpf, JSON.stringify({ ops: all }));
    fs.renameSync(tmpf, linksFile + '.inbox');
    return clean.length;
  }
  const body = (req, max = 1024 * 1024) => new Promise((res, rej) => { let b = ''; req.on('data', c => { b += c; if (b.length > max) { rej(new Error('too large')); req.destroy(); } }); req.on('end', () => res(b)); req.on('error', rej); });
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
    const r = await guard.get(url, { maxBytes: 20 * 1024 * 1024, timeout: 20000 });
    if (r.status >= 400) return { ok: false, code: 'status', status: r.status, hu: 'Az oldal hibát adott (' + r.status + ').' };
    // T4: a datasheet PDF is read too (pdf.js, text only); a PDF sent as octet-stream is recognised by its first bytes
    if (r.type === 'application/pdf' || r.body.slice(0, 5).toString('latin1') === '%PDF-') {
      const p = await pdfText(r.body);
      if (!p.ok) return Object.assign({ url: r.url }, p);
      return { ok: true, kind: 'pdf', url: r.url, title: p.title || path.basename(new URL(r.url).pathname), site: '', byline: '', lang: '', pages: p.pages,
        excerpt: ((p.blocks.find(b => b.t === 'p') || {}).text || '').slice(0, 300), blocks: p.blocks, links: [], words: p.words };
    }
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
    if (req.method === 'OPTIONS') {                                   // the Asztal's app origin asks before a JSON POST
      res.writeHead(204, origin && ORIGINS.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST',
        'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' } : {});
      return res.end();
    }
    const u = new URL(req.url, 'http://127.0.0.1');
    // T3: the jobs (codes only) and a job's web material written into its folder
    const jm = /^\/api\/jobs(?:\/([A-Z]{1,3}\d{1,3})\/export)?$/.exec(u.pathname);
    if (jm) {
      if (!jm[1]) return req.method === 'GET' ? send(res, 200, jobs.list(), null, origin) : send(res, 405, { ok: false, hu: 'GET.' }, null, origin);
      if (req.method !== 'POST') return send(res, 405, { ok: false, hu: 'POST.' }, null, origin);
      if (!origin || !/^application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 403, { ok: false, hu: 'Írni csak a VRG Böngésző írhat.' }, null, origin);
      let j;
      try { j = JSON.parse(await body(req, 24 * 1024 * 1024)); } catch (e) { return send(res, 400, { ok: false, hu: 'Nem JSON, vagy túl nagy.' }, null, origin); }
      return send(res, 200, await jobs.exportTo(jm[1], j), null, origin);
    }
    // T6: page watches in the Asztal's feed registry; T5: research notes
    if (u.pathname === '/api/watch' || u.pathname === '/api/research') {
      if (u.pathname === '/api/watch' && req.method === 'GET') return send(res, 200, watch.list(), null, origin);
      if (req.method !== 'POST') return send(res, 405, { ok: false, hu: 'GET vagy POST.' }, null, origin);
      if (!origin || !/^application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 403, { ok: false, hu: 'Írni csak a VRG Böngésző írhat.' }, null, origin);
      let j;
      try { j = JSON.parse(await body(req)); } catch (e) { return send(res, 400, { ok: false, hu: 'Nem JSON, vagy túl nagy.' }, null, origin); }
      if (u.pathname === '/api/research') return send(res, 200, writeResearch(j || {}), null, origin);
      return send(res, 200, j && j.remove ? watch.remove(String(j.remove)) : watch.add(j || {}), null, origin);
    }
    if (u.pathname === '/api/links') {
      const m = masterLinks();
      if (!m) return send(res, 200, { ok: false, code: 'no-master', hu: 'Ezen a gépen nincs VRG Asztal adatmappa (web.json).' }, null, origin);
      if (req.method === 'GET') return send(res, 200, Object.assign({ ok: true, format: links.FORMAT, v: links.VERSION }, m), null, origin);
      if (req.method !== 'POST') return send(res, 405, { ok: false, hu: 'GET vagy POST.' }, null, origin);
      // a write needs this server's own page: a named origin and a JSON body (a form from another page cannot send either)
      if (!origin || !/^application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 403, { ok: false, hu: 'Írni csak a VRG Böngésző írhat.' }, null, origin);
      let j;
      try { j = JSON.parse(await body(req)); } catch (e) { return send(res, 400, { ok: false, hu: 'Nem JSON, vagy túl nagy.' }, null, origin); }
      const applied = toInbox(j && j.ops);
      return send(res, 200, Object.assign({ ok: true, format: links.FORMAT, v: links.VERSION, applied }, masterLinks()), null, origin);
    }
    if (req.method !== 'GET') return send(res, 405, { ok: false, hu: 'Csak olvasás.' }, null, origin);
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
