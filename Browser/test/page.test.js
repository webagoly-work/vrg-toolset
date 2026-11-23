// page.test.js — the built page in headless Chromium (Playwright), the two ways a test can reach:
//   VRG Mobile: served on https://browser.appassets.androidplatform.net/ as the M21 WebView serves it (the app's folder only,
//               every request off the origin refused), at 375 × 812 with touch: no errors, nothing leaves the origin, a URL
//               and a bang become a main-frame navigation (which the phone hands to its browser), bookmarks survive a reload.
//   served:     serve.js on 127.0.0.1 with the real repo documents: the omnibox finds them, the reader opens one, a URL
//               opens a new tab (noopener).
// The VRG Asztal's vrg-app:// cannot be reproduced here; its rules are unit-tested (core.test.js host) and its main
// process already routes an app's navigation to the Böngésző pane (Dashboard/shell/lib/views.js createApp).
// Skipped when Playwright is not installed (it is pre-installed in the cloud sessions).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* not on this PC */ }
const DIST = path.join(__dirname, '..', 'dist', 'vrg-bongeszo.html');
const ORIGIN = 'https://browser.appassets.androidplatform.net';
const PAGE = ORIGIN + '/Browser/dist/vrg-bongeszo.html';
const skip = chromium ? false : 'Playwright is not installed';

test('page on VRG Mobile (M21 rules, 375 px, touch)', { skip, timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: 'hu-HU' });
    const errors = [], offOrigin = [], navigations = [];
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(ORIGIN + '/')) {
        const p = new URL(u).pathname;
        if (p === '/Browser/dist/vrg-bongeszo.html' || p === '/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(DIST) });
        return route.fulfill({ status: 403, body: '' });
      }
      // the phone: a main-frame navigation goes to the phone's browser and the app stays (shouldOverrideUrlLoading → true);
      // a 204 is the same here (the document stays). Anything else off the origin is refused.
      if (route.request().isNavigationRequest()) { navigations.push(u); return route.fulfill({ status: 204, body: '' }); }
      offOrigin.push(u);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push(m.text()); });
    await page.goto(PAGE);
    await page.waitForSelector('.vb-hero');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.vbHost), 'mobile');
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-vk-density')), 'touch');
    assert.ok(await page.locator('.vb--narrow').count(), 'the phone layout');
    assert.equal(await page.locator('text=Helyi VRG szerverek').count(), 0, 'no PC servers on the phone');

    // Gyorsválasz
    await page.fill('#vb-q', '230V 16A');
    assert.equal((await page.textContent('.vb-answer__value')).trim(), '3,68 kW');
    // a URL: a main-frame navigation the phone hands to its browser, remembered in the history
    await page.fill('#vb-q', 'index.hu/?utm_source=x&id=1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert.ok(navigations.includes('https://index.hu/?id=1'), 'Tiszta link, then the host: ' + navigations.join(' '));
    // a bang
    await page.fill('#vb-q', '!w Ohm-törvény');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert.ok(navigations.some(u => u.startsWith('https://hu.wikipedia.org/w/index.php?search=Ohm-t%C3%B6rv%C3%A9ny')), navigations.join(' '));

    // a bookmark through the ☆ dialog, with a job code; found accent-free; kept after a reload
    await page.click('button[aria-label="Könyvjelző a legutóbb megnyitott oldalra"]');
    const dlg = page.locator('.vb-dialog');
    await dlg.locator('input').nth(0).fill('https://www.tme.eu/hu/katalog/kotoelemek/');
    await dlg.locator('input').nth(1).fill('Kötőelemek – TME');
    await dlg.locator('input').nth(3).fill('VRG-2611-03');
    await dlg.locator('button', { hasText: 'Könyvjelző' }).click();
    await page.goto(PAGE + '#/konyvjelzok');
    await page.reload();
    await page.waitForSelector('.vb-row');
    assert.match(await page.textContent('.vb-list'), /Kötőelemek – TME[\s\S]*VRG-2611-03/);
    await page.fill('#vb-q', 'kotoelem');
    await page.waitForSelector('.vb-opt');
    assert.ok((await page.locator('.vb-opt', { hasText: 'Kötőelemek – TME' }).count()) === 1, 'the own search engine, accent-free');

    // every view draws, nothing overflows sideways
    for (const r of ['', 'kereses?q=k%C3%A1bel', 'konyvjelzok', 'elozmenyek', 'olvaso', 'beallitasok', 'sugo']) {
      await page.goto(PAGE + '#/' + r);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, 'overflow on #/' + r);
    }
    assert.deepEqual(offOrigin, [], 'nothing but navigations leaves the app origin on the phone');
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

test('page served by serve.js (documents, reader, new tab)', { skip, timeout: 60000 }, async () => {
  const { createServer } = require('../serve.js');
  const PORT = 18814;
  const guard = { check: () => ({ ok: false, code: 'address', hu: 'teszt' }), get: async () => { throw new Error('no network in the test'); } };
  // T1: a stand-in for the Asztal's <userDir>/web.json, the master of the links
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vb-page-links-'));
  const linksFile = path.join(dir, 'web.json');
  fs.writeFileSync(linksFile, JSON.stringify({ bookmarks: [{ url: 'https://github.com/webagoly-work/vrg-toolset', title: 'A pane bookmark', at: 1 }], history: [] }));
  const { server, docs } = createServer({ port: PORT, guard, linksFile });
  docs.build();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.route('https://hu.wikipedia.org/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));   // no network here
    const page = await ctx.newPage();
    const errors = [], popups = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('popup', p => popups.push(p.url()));
    await page.route(/^http:\/\/127\.0\.0\.1:(?!18814)\d+\//, r => r.abort());   // the start page's server lamps: nothing runs here
    await page.goto('http://127.0.0.1:' + PORT + '/');
    await page.waitForSelector('.vb-hero');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.vbHost), 'served');
    await page.waitForFunction(() => /helyi szerver fut/.test(document.querySelector('.vb-status').textContent));
    await page.fill('#vb-q', 'munkaablak riasztás');
    await page.waitForSelector('.vb-drop__group:has-text("Dokumentumok")');
    await page.locator('.vb-opt', { hasText: 'VRG Időjárás' }).first().click();
    await page.waitForSelector('.vb-reader h1');
    assert.match(await page.textContent('.vb-reader h1'), /VRG Időjárás/);
    await page.fill('#vb-q', 'hu.wikipedia.org');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    assert.ok(popups.some(u => u.startsWith('https://hu.wikipedia.org/')), 'a new tab: ' + popups.join(' '));
    // T1: the Asztal's bookmark is here, and one made here goes to the master's inbox
    await page.goto('http://127.0.0.1:' + PORT + '/#/konyvjelzok');
    await page.waitForSelector('text=A pane bookmark');
    await page.click('button[aria-label="Könyvjelző a legutóbb megnyitott oldalra"]');
    await page.locator('.vb-dialog input').nth(0).fill('https://www.tme.eu/hu/');
    await page.locator('.vb-dialog input').nth(1).fill('TME');
    await page.locator('.vb-dialog button', { hasText: 'Könyvjelző' }).click();
    await page.waitForFunction(() => /könyvjelzők: Asztal(?! ·)/.test(document.querySelector('.vb-status').textContent), null, { timeout: 5000 });
    const inbox = JSON.parse(fs.readFileSync(linksFile + '.inbox', 'utf8')).ops;
    assert.ok(inbox.some(o => o.op === 'bookmark' && o.url === 'https://www.tme.eu/hu/'), JSON.stringify(inbox));
    assert.ok(inbox.some(o => o.op === 'visit' && o.url === 'https://hu.wikipedia.org/'), 'the visit before goes up too');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});
