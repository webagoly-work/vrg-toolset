// WP M36: the iPhone web app in a browser (Playwright, iPhone 15 emulation, GitHub stubbed). Checks the dashboard and
// its faint Varler mark in the palette's glow, the palette switch (also the home-screen icon iOS would take), the
// device request QR, a grant made the way the owner's Android phone makes it (WebCrypto here, proven equal to the
// Kotlin side by DeviceTrustTest) opened from the #grant= link, a grant for another device refused, the release lock
// in Frissítés, Haladás from (stubbed) GitHub, and no console errors.
//   node Mobile/tests/web-app.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webcrypto: C } = require('crypto');
const { chromium, devices } = require('playwright');

const WEB = path.resolve(__dirname, '..', 'web');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let fails = 0;
function check(cond, msg) { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; }

const server = http.createServer((q, res) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(WEB, p);
  if (!file.startsWith(WEB) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/** What kit-core DeviceTrust.grant does on the owner's phone, in WebCrypto. */
async function grantFor(req, payload) {
  const b64u = b => Buffer.from(b).toString('base64url');
  const eph = await C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const pub = await C.subtle.importKey('jwk', req.pub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const key = await C.subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = C.getRandomValues(new Uint8Array(12));
  const ct = await C.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  const j = await C.subtle.exportKey('jwk', eph.publicKey);
  const g = { t: 'vrg-grant', v: 1, to: req.id, epub: { kty: 'EC', crv: 'P-256', x: j.x, y: j.y }, iv: b64u(iv), ct: b64u(new Uint8Array(ct)), by: payload.by };
  return b64u(Buffer.from(JSON.stringify(g)));
}

async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  // the service worker is blocked: Playwright's stubs cannot see requests that pass through one (the cache path is a phone check)
  const ctx = await browser.newContext({ ...devices['iPhone 15'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  let trust = { gated: true, devices: [{ id: '6CDB-FB09-6833', name: 'Redmi', owner: true }] };
  await ctx.route('https://raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(trust) }));
  await ctx.route('https://api.github.com/**', r => {
    const u = r.request().url();
    let body;
    if (u.includes('/commits')) body = [{ sha: 'abcdef1234567', html_url: '#', commit: { message: 'M35 Eszközök', author: { date: '2026-11-18T19:00:00Z' } } }];
    else if (u.includes('/pulls')) body = [];
    else body = { workflow_runs: [{ name: 'VRG Mobile (Android)', head_branch: 'main', conclusion: 'success', updated_at: '2026-11-18T19:07:00Z' }] };
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });

  // the dashboard and its watermark
  await page.goto(base);
  await page.waitForSelector('.tile');
  check((await page.$$('.tile')).length === 4, 'dashboard: four tiles');
  const wm = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.watermark .mark'));
    return { color: s.color, opacity: s.opacity, glow: getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() };
  });
  check(wm.opacity === '0.06' && wm.color === 'rgb(63, 224, 208)' && wm.glow === '#3FE0D0', `watermark: Mélyvíz glow at 6 % (${wm.color}, ${wm.opacity})`);

  // the palette switch
  await page.goto(base + '#/megjelenes');
  await page.waitForSelector('.pal');
  await page.click('.pal[data-id="korall"]');
  const kor = await page.evaluate(() => ({
    glow: getComputedStyle(document.documentElement).getPropertyValue('--glow').trim(),
    icon: document.querySelector('link[rel=apple-touch-icon]').getAttribute('href'),
  }));
  const korall = JSON.parse(fs.readFileSync(path.join(WEB, 'palettes.json'), 'utf8')).palettes.find(p => p.id === 'korall').colors.glow;
  check(kor.glow === korall && kor.icon === 'icons/touch-korall.png', `palette Korallzátony: glow ${kor.glow}, home-screen icon ${kor.icon}`);
  check(fs.existsSync(path.join(WEB, kor.icon)), 'that icon exists');

  // the device request
  await page.goto(base + '#/eszkoz');
  await page.waitForSelector('#req');
  check(/Nincs a megbízható/.test(await page.textContent('#view')), 'not on the list yet');
  await page.click('#req');
  await page.waitForSelector('.qr svg');
  const code = (await page.textContent('.code.big')).trim();
  check(/^[0-9A-F]{6}$/.test(code), 'request QR and its 6-character code ' + code);
  const req = await page.evaluate(async () => (await import('./js/device.js')).makeRequest('teszt'));
  check(req.code === code && req.link.startsWith('vrg://devices?req=') && req.req.back === base, 'the same request (stable key), back to this page');

  // the owner's phone approves (with the token); the list now holds this device
  trust = { gated: true, devices: [...trust.devices, { id: req.req.id, name: 'iPhone' }] };
  const capsule = await grantFor(req.req, { by: 'Redmi · 6CDBFB096833', at: '2026-11-18T19:10:00Z', token: 'teszt-token' });
  await page.goto(base + '#grant=' + capsule);
  await page.waitForSelector('#accmsg .ok, #accmsg .bad');
  const accepted = (await page.textContent('#accmsg')).trim();
  check(/Engedély elfogadva: Redmi/.test(accepted), 'grant from the owner opened: ' + accepted);
  check(await page.evaluate(() => localStorage.getItem('vrg.gh.token')) === 'teszt-token', 'the token is kept (it was handed over)');

  // a grant for another device is refused
  const other = await grantFor({ ...req.req, id: 'MASIKESZKOZ1' }, { by: 'x', at: '' });
  await page.fill('#paste', 'Itt az engedély: https://x.invalid/#grant=' + other);
  await page.click('#acc');
  await page.waitForSelector('#accmsg .bad');
  check(/másik eszköznek/.test(await page.textContent('#accmsg')), 'a grant for another device is refused');

  // Frissítés: a newer version; listed → offered; removed from the list → the lock says so
  await ctx.route(base + 'version.json', r => r.fulfill({ contentType: 'application/json', body: '{"v":"m36-2","at":"2026-11-19"}' }));
  await page.goto(base + '#/frissites');
  await page.waitForSelector('#go, #u .warn, #u .ok');
  check(!!(await page.$('#go')), 'listed device: the update is offered (' + (await page.textContent('#u')).trim().slice(0, 120) + ')');
  trust = { gated: true, devices: [trust.devices[0]] };
  await page.goto(base + '#/');
  await page.goto(base + '#/frissites');
  await page.waitForSelector('#go, #u .warn');
  check(/zárolva/.test(await page.textContent('#u')), 'not listed + release lock: no update, points to Eszköz');

  // Haladás
  await page.goto(base + '#/haladas');
  await page.waitForSelector('#h .row');
  check(/M35 Eszközök/.test(await page.textContent('#h')), 'Haladás lists the commits and the CI run');

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(fails ? `web-app: ${fails} failed` : 'web-app: all passed');
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
