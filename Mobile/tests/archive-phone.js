#!/usr/bin/env node
// archive-phone.js — VRG Mobile M18: the Archívum as the phone shows it, in headless Chrome at 375 × 812 with touch.
//
//   node Mobile/tests/archive-phone.js
//   node Mobile/tests/archive-phone.js --serve [8160]   only the server, to look at it in a browser at phone width
//
// A local server answers exactly as the app's WebView does (feature-archive, kit-core Archive.kt): only
// /archive/vrg-archive.html, /archive/index.js and /archive/files/<name>.html from the repo's Archive/ folder, 403 for
// the rest; requests off that origin are stopped, the artifact CDNs (ArchiveWeb.CDN) counted apart. The page is
// the PC's own Archive/vrg-archive.html, unchanged. Checked:
//   - the list (VRG first, every entry), no sideways scrolling, every control at least 44 px tall;
//   - a tap on an entry → its detail; ▶ → the saved page in the full-screen viewer, served 200;
//   - Back as the app runs it (ArchiveWeb.BACK_JS, read from Archive.kt): viewer → entry → list → "leave";
//   - claude.ai links open outside (target=_blank: the WebView hands them to the phone's browser);
//   - #<id>/open (vrg://archive/<id>/open) opens straight into the viewer; every saved page loads with 200;
//   - archive.js and index.json are not served; the page throws nothing.
// Needs chrome-headless-shell (H:\VRG\Full\tools, or $CHROME).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ARCHIVE = path.join(REPO, 'Archive');
const KT = fs.readFileSync(path.join(REPO, 'Mobile', 'android', 'kit-core', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'core', 'Archive.kt'), 'utf8');
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
let common = REPO;
try { common = path.dirname(path.resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' }).trim())); } catch { /* not a repo */ }
const CHROME = [process.env.CHROME, path.join(REPO, rel), path.join(common, rel)].find(p => p && fs.existsSync(p));

// the phone's own strings, read from the Kotlin source so the test runs exactly what the app runs
const BACK_JS = (/const val BACK_JS = ([\s\S]*?)\n\n/.exec(KT) || [])[1]?.match(/"((?:[^"\\]|\\.)*)"/g)?.map(s => JSON.parse(s)).join('');
const CDN = new Set(((/val CDN = setOf\(([^)]*)\)/.exec(KT) || [])[1] || '').match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || []);
// ArchivePages.keeps
const keeps = r => r === 'vrg-archive.html' || r === 'index.js' || /^files\/[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(r);

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-archive-phone-'));

// ---- the WebView's file server ------------------------------------------------------------------------
const served = new Map();   // path -> status
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const m = /^\/archive\/(.+)$/.exec(p);
  const r = m && keeps(m[1]) ? m[1] : null;
  const f = r && path.join(ARCHIVE, ...r.split('/'));
  if (!f || !fs.existsSync(f)) { served.set(p, 403); res.writeHead(403, { 'Cache-Control': 'no-store' }); return res.end(); }
  served.set(p, 200);
  res.writeHead(200, { 'Content-Type': (r.endsWith('.js') ? 'application/javascript' : 'text/html') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

// ---- a minimal DevTools client (Node's own WebSocket) -------------------------------------------------
async function launch(origin) {
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--window-size=375,812',
    `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const t = setTimeout(() => reject(new Error('Chrome did not start: ' + err.slice(-300))), 30000);
    proc.stderr.on('data', d => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map(), errors = [], off = { cdn: [], refused: [] };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push({ text: d.exception?.description || d.text, url: d.url || d.stackTrace?.callFrames?.[0]?.url || '' });
    }
    if (m.method === 'Fetch.requestPaused') {
      const u = new URL(m.params.request.url);
      if (u.origin === origin) send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
      else {
        // no network in a test: a CDN request is what the phone would let through, anything else what it refuses
        (CDN.has(u.hostname) && u.protocol === 'https:' && m.params.request.method === 'GET' ? off.cdn : off.refused).push(u.href);
        send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      }
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const until = async (expr, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await evaluate(expr)) return true; await sleep(50); } return false; };
  // a finger tap on the centre of the first element matching [sel]
  const tap = async sel => {
    const c = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!c) throw new Error('nothing to tap: ' + sel);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
    await sleep(40);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
  };
  return { proc, ws, send, evaluate, until, tap, errors, off };
}

// the smallest visible control among [sel] (height in CSS px), and which one
const SMALLEST = sel => `(() => { let min = null;
  for (const e of document.querySelectorAll(${JSON.stringify(sel)})) { const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
    if (!min || r.height < min.h) min = { h: Math.round(r.height * 10) / 10, what: e.tagName + '.' + e.className + ' ' + (e.textContent || e.placeholder || '').trim().slice(0, 20) }; }
  return min; })()`;
const STATE = 'JSON.stringify({ reading: document.body.classList.contains("reading"), open: !document.querySelector("[data-role=viewer]").hidden, hash: location.hash })';

(async () => {
  // --serve [port]: only the WebView's file server, kept running, to look at the archive at phone width in a browser
  const at = process.argv.indexOf('--serve');
  if (at >= 0) {
    const port = +process.argv[at + 1] || 8160;
    server.listen(port, '127.0.0.1', () => console.log(`archive-phone: http://127.0.0.1:${port}/archive/vrg-archive.html (the phone's rules; Ctrl+C stops)`));
    return;
  }
  if (!CHROME) { console.log('archive-phone: SKIPPED, chrome-headless-shell not found (set CHROME)'); process.exit(0); }
  ok(BACK_JS && BACK_JS.includes('VRGArchive'), 'BACK_JS read from Archive.kt');
  ok(CDN.has('fonts.googleapis.com'), 'CDN list read from Archive.kt');
  const index = JSON.parse(fs.readFileSync(path.join(ARCHIVE, 'index.json'), 'utf8'));
  const items = index.items || [];
  const saved = items.filter(i => i.file);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const PAGE = `${origin}/archive/vrg-archive.html`;
  const c = await launch(origin);
  try {
    // ---- the list
    await c.send('Page.navigate', { url: PAGE });
    ok(await c.until('document.querySelectorAll(".card").length > 0'), 'the list draws');
    ok(await c.evaluate('document.querySelectorAll(".card").length') === items.length, `every entry is listed (${items.length})`);
    const heads = await c.evaluate('[...document.querySelectorAll(".list h2")].map(h => h.firstChild.textContent)');
    ok(heads[0] === 'VRG', `VRG first (${heads.join(', ')})`);
    ok(await c.evaluate('getComputedStyle(document.querySelector("[data-role=timeline]")).display') === 'none', 'no timeline at phone width');
    ok(await c.evaluate('getComputedStyle(document.querySelector("[data-role=detail]")).display') === 'none', 'the list alone at phone width');
    ok(await c.evaluate('document.documentElement.scrollWidth') <= 375, 'no sideways scrolling on the list');
    let small = await c.evaluate(SMALLEST('.seg button, header select, header input, .card'));
    ok(small && small.h >= 44, `list controls ≥ 44 px (smallest ${JSON.stringify(small)})`);

    // ---- an entry, with a saved page and a claude.ai link if there is one
    const first = saved.find(i => i.url) || saved[0];
    await c.tap(`.card[data-id="${first.id}"]`);
    let s = JSON.parse(await c.evaluate(STATE));
    ok(s.reading && !s.open && s.hash === '#' + first.id, `a tap opens the entry (${JSON.stringify(s)})`);
    ok(await c.evaluate('getComputedStyle(document.querySelector("[data-role=list]")).display') === 'none', 'the entry alone at phone width');
    ok(await c.evaluate('document.documentElement.scrollWidth') <= 375, 'no sideways scrolling on the entry');
    small = await c.evaluate(SMALLEST('.back, .detail .acts button, .detail .acts a'));
    ok(small && small.h >= 44, `entry controls ≥ 44 px (smallest ${JSON.stringify(small)})`);
    if (first.url) {
      const out = await c.evaluate('[...document.querySelectorAll(".detail a[href^=\'https://claude.ai\']")].map(a => a.target)');
      ok(out.length > 0 && out.every(t => t === '_blank'), 'claude.ai ↗ opens outside (target=_blank)');
    }

    // ---- ▶ the saved page
    await c.tap('.detail .acts .go');
    ok(await c.until('!document.querySelector("[data-role=viewer]").hidden'), '▶ opens the viewer');
    ok(await c.until('(() => { const d = document.querySelector("[data-role=frame]").contentDocument; return d && d.readyState === "complete" && d.body && d.body.innerHTML.length > 100; })()'),
      'the saved page loads in the viewer');
    ok(served.get('/archive/' + first.file) === 200, `the saved page is served (${first.file})`);
    small = await c.evaluate(SMALLEST('.viewer .bar button, .viewer .bar a'));
    ok(small && small.h >= 44, `viewer bar ≥ 44 px (smallest ${JSON.stringify(small)})`);
    const box = await c.evaluate('(() => { const r = document.querySelector("[data-role=frame]").getBoundingClientRect(); return [r.width, r.height]; })()');
    ok(box[0] === 375 && box[1] > 700, `the viewer fills the screen (${box})`);

    // ---- Back, as the app runs it
    ok(await c.evaluate(BACK_JS) === 'viewer', 'Back 1 closes the saved page');
    await sleep(150);
    s = JSON.parse(await c.evaluate(STATE));
    ok(!s.open && s.reading && s.hash === '#' + first.id, `… back on the entry (${JSON.stringify(s)})`);
    ok(await c.evaluate('document.querySelector("[data-role=frame]").getAttribute("src")') === 'about:blank', '… and the saved page is unloaded');
    ok(await c.evaluate(BACK_JS) === 'detail', 'Back 2 returns to the list');
    s = JSON.parse(await c.evaluate(STATE));
    ok(!s.open && !s.reading && s.hash === '', `… the list (${JSON.stringify(s)})`);
    ok(await c.evaluate(BACK_JS) === 'list', 'Back 3 leaves the archive (the app goes home)');

    // ---- a link straight into the viewer, then every saved page
    await c.evaluate(`location.hash = '#${first.id}/open'`);
    ok(await c.until('!document.querySelector("[data-role=viewer]").hidden'), '#<id>/open opens the viewer directly');
    ok(await c.evaluate(BACK_JS) === 'viewer', '… and Back closes it');
    const bad = [];
    for (const i of saved) {
      await c.evaluate(`location.hash = '#${i.id}/open'`);
      const loaded = await c.until(`(() => { const f = document.querySelector("[data-role=frame]"); const d = f.contentDocument;
        return !document.querySelector("[data-role=viewer]").hidden && d && d.URL.split("#")[0].endsWith("/archive/" + ${JSON.stringify(i.file)}) && d.readyState === "complete"; })()`, 8000);
      if (!loaded || served.get('/archive/' + i.file) !== 200) bad.push(i.id);
      await c.evaluate(BACK_JS); await c.evaluate(BACK_JS);
    }
    ok(bad.length === 0, `every saved page opens (${saved.length - bad.length}/${saved.length}${bad.length ? ': ' + bad.join(', ') : ''})`);

    // ---- what the phone does not serve
    for (const p of ['/archive/index.json', '/archive/archive.js', '/archive/files/../index.json', '/index.html']) {
      const r = await fetch(origin + p.replace('/../', '/%2E%2E/'));
      ok(r.status === 403, `${p} is not served (${r.status})`);
    }
    ok(c.off.refused.length === 0, `nothing else tries to leave the phone (${c.off.refused.slice(0, 3).join(', ')})`);
    if (c.off.cdn.length) console.log(`  note: ${c.off.cdn.length} artifact-CDN request(s) the phone lets through (stopped here: no network in a test)`);
    // the archive's own page and data; a saved page's errors are that page's (or its CDN library stopped here)
    const own = c.errors.filter(e => !/\/archive\/files\//.test(e.url + ' ' + e.text));
    ok(own.length === 0, `the archive throws nothing (${own.slice(0, 2).map(e => e.text).join(' | ')})`);
    const inPages = [...new Set(c.errors.filter(e => !own.includes(e)).map(e => (/files\/([^/:?#]+)\.html/.exec(e.url + ' ' + e.text) || [])[1]))];
    if (inPages.length) console.log(`  note: ${c.errors.length - own.length} error(s) inside saved pages (${inPages.join(', ')}), not the archive's`);
  } catch (e) {
    fail++; console.log('  FAIL ' + (e.stack || e));
  } finally {
    c.ws.close(); c.proc.kill(); server.close();
    await sleep(300);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Chrome still letting go of its profile */ }
  }
  console.log(`archive-phone: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
