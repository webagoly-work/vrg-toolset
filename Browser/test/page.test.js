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

test('page: Phase 2 — a part, its datasheet read and saved for a job, the job exported, a label sheet', { skip, timeout: 90000 }, async () => {
  const { createServer } = require('../serve.js');
  const os = require('os');
  const { makePdf } = require('./make-pdf.js');
  const PORT = 18818;
  const jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-page-jobs-'));
  fs.mkdirSync(path.join(jobsDir, 'T07_Kitalalt'), { recursive: true });
  fs.mkdirSync(path.join(jobsDir, '_elozmenyek'), { recursive: true });
  const pdf = makePdf([['KITALALT adatlap a teszthez', 'Nevleges aram 63 A'], ['Masodik oldal']], { title: 'Kitalalt adatlap' });
  const guard = { check: u => ({ ok: /^https:\/\//.test(u) }), get: async u => ({ status: 200, url: u, type: 'application/pdf', charset: '', body: pdf }) };
  const { server } = createServer({ port: PORT, guard, jobsDir, linksFile: '' });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/^http:\/\/127\.0\.0\.1:(?!18818)\d+\//, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + PORT + '/#/alkatreszek');
    await page.fill('input[aria-label="Alkatrész keresése"]', 'mistral');
    await page.locator('.vb-row__title', { hasText: 'Mistral41W' }).first().click();
    await page.waitForSelector('text=ALKATRÉSZ · VRG-0001');
    await page.fill('input[aria-label="Munkaszám"]', 't07');
    await page.click('button:has-text("Olvasás és mentés")');
    await page.waitForSelector('.vb-reader h1');
    assert.match(await page.textContent('.vb-reader__meta'), /PDF · 2 oldal/);
    await page.click('button:has-text("Mentés offline")');
    const saved = await page.evaluate(() => VB.app.ctx.st.reading()[0]);
    assert.equal(saved.part, 'VRG-0001'); assert.equal(saved.job, 'T07'); assert.equal(saved.kind, 'pdf');
    assert.match(saved.text, /KITALALT adatlap/);
    await page.goto('http://127.0.0.1:' + PORT + '/#/munkak');
    await page.waitForSelector('.vb-row__title:has-text("T07")');
    await page.goto('http://127.0.0.1:' + PORT + '/#/munkak/T07');
    await page.waitForSelector('text=Adatlapok');
    assert.equal(await page.locator('.vb-row__title', { hasText: 'Kitalalt adatlap' }).count(), 1);
    await page.click('button:has-text("Exportálás")');
    await page.waitForFunction(() => /Kiírva/.test(document.body.textContent), null, { timeout: 10000 });
    const web = path.join(jobsDir, 'T07_Kitalalt', 'web');
    assert.ok(fs.existsSync(path.join(web, 'INDEX.md')));
    assert.equal(fs.readdirSync(path.join(web, 'adatlapok')).length, 1, 'the datasheet PDF itself');
    await page.goto('http://127.0.0.1:' + PORT + '/#/munkak/T07/cimkek');
    await page.waitForSelector('.vb-label');
    assert.equal(await page.locator('.vb-label svg path').count(), 1, 'one label, with its QR');
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});

test('page: Phase 3 — a quote from the reader into a notebook, the note into the repo, a page watch', { skip, timeout: 90000 }, async () => {
  const { createServer } = require('../serve.js');
  const { createDocs } = require('../lib/docs.js');
  const os = require('os');
  const PORT = 18821;
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-p3-repo-'));
  fs.mkdirSync(path.join(repo, 'docs'));
  const deskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-p3-desk-'));
  const html = '<html><head><title>Túlfeszültség-védelem</title></head><body><article><h1>Túlfeszültség-védelem</h1><p>Külső villámvédelem esetén a főelosztóba T1+T2 kombinált levezető kerül, egyébként a T2 elegendő.</p><p>Második bekezdés, szintén elég hosszú szöveggel a teszthez.</p></article></body></html>';
  const guard = { check: u => ({ ok: /^https:\/\//.test(u) }), get: async u => ({ status: 200, url: u, type: 'text/html', charset: 'utf-8', body: Buffer.from(html) }) };
  const { server } = createServer({ port: PORT, guard, repo, docs: createDocs({ repo }), deskDir, linksFile: '', jobsDir: '' });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/^http:\/\/127\.0\.0\.1:(?!18821)\d+\//, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + PORT + '/#/olvaso?url=' + encodeURIComponent('https://cikk.example/tulfesz'));
    await page.waitForSelector('.vb-reader p');
    // select the first paragraph as a user would, then let go of the mouse
    await page.evaluate(() => { const p = document.querySelector('.vb-reader p'); const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
    await page.waitForSelector('.vb-quote-btn:not([hidden])');
    await page.click('.vb-quote-btn');
    await page.fill('.vb-dialog input[aria-label="Új kutatás címe"]', 'Túlfeszültség-védelem');
    await page.click('.vb-dialog button:has-text("Hozzáadás")');
    const nb = await page.evaluate(() => VB.app.ctx.st.notebooks()[0]);
    assert.equal(nb.items[0].kind, 'quote');
    assert.match(nb.items[0].text, /^Külső villámvédelem esetén/);
    assert.equal(nb.items[0].url, 'https://cikk.example/tulfesz');
    await page.goto('http://127.0.0.1:' + PORT + '/#/kutatas/' + nb.id);
    await page.waitForSelector('pre.vb-md');
    assert.match(await page.textContent('pre.vb-md'), /\[1\]\(https:\/\/cikk\.example\/tulfesz\)|cikk\.example\/tulfesz/);
    await page.click('button:has-text("Mentés a repóba")');
    await page.click('.vb-dialog button:has-text("Mentés a repóba")');
    await page.waitForFunction(() => /Mentve/.test(document.body.textContent), null, { timeout: 10000 });
    const notes = fs.readdirSync(path.join(repo, 'docs', 'research', 'web'));
    assert.equal(notes.length, 1);
    assert.match(fs.readFileSync(path.join(repo, 'docs', 'research', 'web', notes[0]), 'utf8'), /^# Túlfeszültség-védelem[\s\S]*> Külső villámvédelem[\s\S]*## Források\n\n1\. \[Túlfeszültség-védelem\]\(https:\/\/cikk\.example\/tulfesz\)/);
    // outside the Asztal, Claude gets the text by the clipboard and a dialog says so
    await page.click('button:has-text("Küldés Claude-nak")');
    await page.waitForSelector('.vb-dialog h2:has-text("Küldés Claude-nak")');
    await page.click('.vb-dialog button:has-text("Bezárás")');
    // a watch, added from Figyelés, lands in the Asztal's registry
    await page.goto('http://127.0.0.1:' + PORT + '/#/figyeles');
    await page.fill('input[aria-label="Figyelendő oldal"]', 'https://njt.example/jogszabaly');
    await page.click('button:has-text("Figyelés…")');
    await page.click('.vb-dialog button:has-text("Figyelés")');
    await page.waitForSelector('.vb-row__title:has-text("njt.example")');
    const reg = JSON.parse(fs.readFileSync(path.join(deskDir, 'presets.json'), 'utf8'));
    assert.equal(reg.presets[0].kind, 'page-watch');
    assert.deepEqual(reg.allowHosts, ['njt.example']);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});

// T8: a build without its four plugins boots, its rail and settings show what is left, and nothing errs
test('page: a build without the plugins (build.js --without) still works', { skip, timeout: 60000 }, async () => {
  const B = require('../build.js');
  const html = B.build({ without: ['answers', 'qr', 'work', 'knowledge'] });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'hu-HU' });
    const errors = [];
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(ORIGIN + '/')) return new URL(u).pathname === '/v.html' ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }) : route.fulfill({ status: 403, body: '' });
      return route.request().isNavigationRequest() ? route.fulfill({ status: 204, body: '' }) : route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(ORIGIN + '/v.html');
    await page.waitForSelector('.vb-hero');
    const rail = await page.$$eval('.vb-nav a', a => a.map(x => x.getAttribute('href')));
    assert.ok(rail.includes('#/konyvjelzok') && !rail.includes('#/munkak') && !rail.includes('#/kutatas'), rail.join(' '));
    await page.fill('#vb-q', '230V 16A');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.vb-answer__value').count(), 0, 'no Gyorsválasz without its part');
    await page.goto(ORIGIN + '/v.html#/beallitasok');
    await page.waitForSelector('text=Részek');
    assert.ok(await page.locator('text=Kihagyva ebből a változatból').count());
    assert.equal(await page.locator('.vb-set span:text-is("Munkák")').count(), 0, 'no switch of a part that is not built');
    await page.goto(ORIGIN + '/v.html#/munkak');
    await page.waitForSelector('.vb-hero');                // an unknown route falls back to the home
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

// T9: the Megosztás page — a list into a temp "60_Linkek", seen in Közös listák, a guest page into a temp "00_START"
test('page: T9 — a list shared, seen and loaded back, the guest page written with what stays out', { skip, timeout: 90000 }, async () => {
  const { createServer } = require('../serve.js');
  const os = require('os');
  const PORT = 18823;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-t9-'));
  fs.mkdirSync(path.join(root, '00_START'));
  const guard = { check: u => ({ ok: /^https:\/\//.test(u) }) };
  const { server } = createServer({ port: PORT, guard, sharedDir: root, linksFile: '', jobsDir: '', deskDir: '' });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await ctx.route(/^http:\/\/127\.0\.0\.1:(?!18823)\d+\//, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + PORT + '/');
    await page.waitForSelector('.vb-hero');
    await page.evaluate(() => {
      const st = VB.app.ctx.st;
      st.addBookmark({ url: 'https://www.tme.eu/hu/?utm_source=x', title: 'TME', tags: 'napelem', note: 'jó ár' });
      st.addBookmark({ url: 'http://192.168.1.1/', title: 'Router', tags: 'napelem' });
      st.addReading({ url: 'https://njt.hu/x', title: 'OTSZ', tags: 'napelem', text: 'Mentett.' });
    });
    await page.goto('http://127.0.0.1:' + PORT + '/#/megosztas');
    await page.waitForSelector('text=Lista megosztása');
    await page.fill('input[aria-label="A lista neve"]', 'Napelem');
    await page.click('button:has-text("Megosztás a közös mappába")');
    await page.waitForSelector('.vb-row__title:has-text("Napelem")');
    const file = JSON.parse(fs.readFileSync(path.join(root, '60_Linkek', 'napelem.links.json'), 'utf8'));
    assert.equal(file.bookmarks.length, 2);
    assert.equal(file['x-bongeszo'].reading[0].text, 'Mentett.');
    // the guest preview names what stays out; the page written has only the public https link(s)
    assert.ok(await page.locator('.vb-warn:has-text("Router")').count(), 'the router link is shown as left out');
    await page.click('button:has-text("Vendégoldal mentése")');
    await page.click('.vb-dialog button:has-text("Mentés")');
    await page.waitForFunction(() => /Most: 00_START/.test(document.body.textContent), null, { timeout: 10000 });
    const html = fs.readFileSync(path.join(root, '00_START', 'linkek.html'), 'utf8');
    assert.ok(html.includes('https://www.tme.eu/hu/') && !html.includes('utm_source') && !html.includes('192.168') && !html.includes('jó ár'));
    // a list of the other person's, loaded into this device
    fs.writeFileSync(path.join(root, '60_Linkek', 'tars.links.json'), JSON.stringify({ format: 'vrg.web-links', v: 1, bookmarks: [{ url: 'https://tars.example/', title: 'Társ linkje', at: 1 }], history: [], 'x-bongeszo': { share: { name: 'Társ', by: 'Kolléga' } } }));
    await page.click('button[aria-label="Frissítés"]');
    await page.waitForSelector('.vb-row__title:has-text("Társ")');
    await page.locator('.vb-row', { hasText: 'Társ' }).locator('button:has-text("Betöltés ide")').click();
    await page.waitForFunction(() => VB.app.ctx.st.bookmarks().some(b => b.url === 'https://tars.example/'));
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});
