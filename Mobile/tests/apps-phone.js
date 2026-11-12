#!/usr/bin/env node
// apps-phone.js — VRG Mobile M21: every Alkalmazások app as the phone shows it, in headless Chrome at 375 × 812 with touch.
//
//   node Mobile/tests/apps-phone.js                 the check (exit 1 on a failure)
//   node Mobile/tests/apps-phone.js --shots <dir>   also a screenshot per app (for the WP's "usable at 375 px" notes)
//   node Mobile/tests/apps-phone.js --serve [8170]  only the servers, one port per app, to look at them in a browser
//
// The app list is read from kit-core's generated DeskApps.kt and the CDN rule from Archive.kt, so the test runs what the phone runs.
// Every app gets its own origin (its own port here; https://<id>.appassets.androidplatform.net on the phone) and a server that answers
// as the app's WebView does (AppScheme.decide): the app's allowed folders only, never dot-files or secret names, 403 for the rest.
// Requests off the origin are stopped: the artifact CDNs counted apart (the phone lets those through), the rest as refused.
// Checked per app: the page is served 200 and draws something; no uncaught exception and no console.error while it starts.
// Reported, not failed (fixing the apps is a later WP): sideways overflow, the smallest tap target, controls under 32 px, refusals.
// Needs chrome-headless-shell (H:\VRG\Full\tools, or $CHROME).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO, 'Mobile', 'android', 'kit-core', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'core');
const APPS_KT = fs.readFileSync(path.join(CORE, 'DeskApps.kt'), 'utf8');
const ARCHIVE_KT = fs.readFileSync(path.join(CORE, 'Archive.kt'), 'utf8');
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
let common = REPO;
try { common = path.dirname(path.resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' }).trim())); } catch { /* not a repo */ }
const CHROME = [process.env.CHROME, path.join(REPO, rel), path.join(common, rel)].find(p => p && fs.existsSync(p));

// DeskApp("id", "hu", "page", listOf("a/", "shared/"))
const APPS = [...APPS_KT.matchAll(/DeskApp\("([^"]+)", "([^"]+)", "([^"]+)", listOf\(([^)]*)\)\)/g)]
  .map(m => ({ id: m[1], hu: m[2], page: m[3], allow: [...m[4].matchAll(/"([^"]*)"/g)].map(x => x[1]) }));
const CDN = new Set(((/val CDN = setOf\(([^)]*)\)/.exec(ARCHIVE_KT) || [])[1] || '').match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || []);
const SECRET = /(^|\/)(\.[^/]*|anonymise\.map\.json|[^/]*credentials[^/]*\.json|secrets\.bin|oauth-clients\.json|[^/]*\.pem|[^/]*\.key)$/i;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-apps-phone-'));

// ---- the app's WebView, as a file server: AppScheme.decide ------------------------------------------------------------
function serverFor(app) {
  const served = new Map();
  const srv = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/+/, ''); } catch { res.writeHead(400); return res.end(); }
    if (!p) p = app.page;
    const parts = [];
    let bad = p.includes('\0') || p.includes(':') || p.split(/[\\/]/).some(s => s !== '.' && s !== '..' && /[. ]$/.test(s));
    for (const s of p.split(/[\\/]/)) { if (s === '' || s === '.') continue; if (s === '..') { if (!parts.length) bad = true; else parts.pop(); } else parts.push(s); }
    const back = parts.join('/');
    if (!bad && (!back || !app.allow.some(a => a === '' || (a.endsWith('/') ? back.startsWith(a) : back === a)) || SECRET.test(back))) bad = true;
    const f = path.join(REPO, ...parts);
    if (bad || !fs.existsSync(f) || !fs.statSync(f).isFile()) { served.set(back, bad ? 403 : 404); res.writeHead(bad ? 403 : 404, { 'Cache-Control': 'no-store' }); return res.end(); }
    served.set(back, 200);
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return { srv, served };
}

// ---- a minimal DevTools client (Node's own WebSocket) --------------------------------------------------------------------
async function launch() {
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--window-size=375,812', `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
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
  const waiting = new Map();
  const st = { origin: '', errors: [], console: [], off: { cdn: [], refused: [] } };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; st.errors.push(d.exception?.description?.split('\n')[0] || d.text); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') st.console.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (m.method === 'Fetch.requestPaused') {
      const u = new URL(m.params.request.url);
      if (u.origin === st.origin || u.protocol === 'data:' || u.protocol === 'blob:') send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
      else {
        (CDN.has(u.hostname) && u.protocol === 'https:' && m.params.request.method === 'GET' ? st.off.cdn : st.off.refused).push(u.href.slice(0, 120));
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
  return { proc, ws, send, evaluate, st };
}

const MEASURE = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' ? r : null; };
  let min = null, small = 0, controls = 0;
  for (const e of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [onclick]')) {
    const r = vis(e); if (!r) continue; controls++;
    if (r.height < 32) small++;
    if (!min || r.height < min.h) min = { h: Math.round(r.height), what: (e.tagName + ' ' + (e.textContent || e.value || e.placeholder || e.title || '').trim()).slice(0, 30) };
  }
  const text = (document.body && document.body.innerText || '').trim().length;
  return { w: document.documentElement.scrollWidth, vw: innerWidth, h: document.documentElement.scrollHeight, controls, small, min, text, title: document.title,
    viewport: !!document.querySelector('meta[name=viewport]') };
})()`;

(async () => {
  const at = process.argv.indexOf('--serve');
  if (at >= 0) {
    let port = +process.argv[at + 1] || 8170;
    for (const a of APPS) { const { srv } = serverFor(a); const p = port++; srv.listen(p, '127.0.0.1', () => console.log(`  ${a.id.padEnd(13)} http://127.0.0.1:${p}/${a.page}`)); }
    console.log('apps-phone: the phone\'s rules, one origin per app (Ctrl+C stops)');
    return;
  }
  if (!CHROME) { console.log('apps-phone: SKIPPED, chrome-headless-shell not found (set CHROME)'); process.exit(0); }
  const si = process.argv.indexOf('--shots');
  const shots = si >= 0 ? path.resolve(process.argv[si + 1] || path.join(tmp, 'shots')) : null;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  ok(APPS.length >= 8, `the app list is read from DeskApps.kt (${APPS.length})`);
  ok(CDN.has('fonts.googleapis.com'), 'the CDN list is read from Archive.kt');

  const c = await launch();
  const report = [];
  try {
    for (const a of APPS) {
      const { srv, served } = serverFor(a);
      await new Promise(r => srv.listen(0, '127.0.0.1', r));
      c.st.origin = `http://127.0.0.1:${srv.address().port}`;
      c.st.errors = []; c.st.console = []; c.st.off = { cdn: [], refused: [] };
      await c.send('Page.navigate', { url: `${c.st.origin}/${a.page.split('/').map(encodeURIComponent).join('/')}` });
      // let it start: the load event, then a quiet second for timers and first renders
      const end = Date.now() + 15000;
      while (Date.now() < end && (await c.evaluate('document.readyState').catch(() => '')) !== 'complete') await sleep(100);
      await sleep(1500);
      const m = await c.evaluate(MEASURE);
      ok(served.get(a.page) === 200, `${a.id}: the page is served (${served.get(a.page)})`);
      ok(m.text > 0 || m.controls > 0, `${a.id}: something is drawn`);
      ok(c.st.errors.length === 0, `${a.id}: no uncaught exception (${c.st.errors.join(' | ')})`);
      ok(c.st.console.length === 0, `${a.id}: no console.error (${c.st.console.join(' | ')})`);
      const refusedLocal = [...served].filter(([, s]) => s !== 200).map(([p, s]) => `${s} ${p}`);
      if (shots) {
        const shot = await c.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(shots, `${a.id}.png`), Buffer.from(shot.data, 'base64'));
      }
      report.push({ id: a.id, ...m, cdn: c.st.off.cdn.length, refused: c.st.off.refused, local: refusedLocal });
      srv.close();
    }
  } finally {
    try { c.ws.close(); } catch { /* gone */ }
    c.proc.kill();
  }
  console.log('\n  app            width   page h  controls  <32px  smallest            refused off-origin');
  for (const r of report) {
    console.log(`  ${r.id.padEnd(13)} ${String(r.w).padStart(4)}${r.w > r.vw ? '!' : ' '}  ${String(r.h).padStart(6)}  ${String(r.controls).padStart(8)}  ${String(r.small).padStart(5)}  ${(r.min ? r.min.h + ' ' + r.min.what : '-').slice(0, 18).padEnd(18)}  ${r.refused.length}${r.cdn ? ' (+' + r.cdn + ' CDN)' : ''}${r.viewport ? '' : '  no viewport meta'}`);
    for (const u of r.refused.slice(0, 3)) console.log(`        refused: ${u}`);
    for (const u of r.local.slice(0, 3)) console.log(`        own origin: ${u}`);
  }
  if (shots) console.log(`\n  screenshots: ${shots}`);
  console.log(`\napps-phone: ${pass} ok, ${fail} failed`);
  try { fs.rmSync(path.join(tmp, 'profile'), { recursive: true, force: true }); } catch { /* still locked */ }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
