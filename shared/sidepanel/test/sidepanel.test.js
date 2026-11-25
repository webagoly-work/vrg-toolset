// sidepanel.test.js — node --test shared/sidepanel/test/sidepanel.test.js
// The pure parts (module checks, ordering, mode filtering, control values, saved state, keys), then the demo in Chromium through
// Playwright when it is installed (skipped otherwise): no console errors, collapse / expand, the mode switch hides the detailed
// modules, links run, a throwing link reports an error event, computed colours come from the Mélyvíz tokens, state survives a reload.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const SP = require('../sidepanel.js');

const mod = (id, extra) => ({ id, title: id, render() {}, ...extra });

test('normalizeModule: defaults, limits, refusals', () => {
  const m = SP.normalizeModule(mod('a'));
  assert.deepStrictEqual([m.title, m.icon, m.order, m.level, m.open, m.controls], ['a', '', 100, 'simple', true, []]);
  const d = SP.normalizeModule(mod('b', { level: 'detailed', order: 5, open: false, icon: 'ABCDEFG', title: 'x'.repeat(200) }));
  assert.deepStrictEqual([d.level, d.order, d.open, d.icon.length, d.title.length], ['detailed', 5, false, 4, 80]);
  assert.strictEqual(SP.normalizeModule(mod('c', { level: 'weird' })).level, 'simple');
  for (const bad of [null, 'x', { id: 'a' }, mod('../x'), mod(''), mod('a b'), mod('c', { controls: [{ id: 'k', kind: 'nope' }] }), mod('c', { controls: [{ kind: 'button' }] })])
    assert.throws(() => SP.normalizeModule(bad), /sidepanel/);
});

test('visibleModules: order then id; simple hides detailed; unknown mode = simple', () => {
  const list = [mod('z', { order: 1 }), mod('b', { order: 2, level: 'detailed' }), mod('a', { order: 2 }), mod('m')].map(SP.normalizeModule);
  assert.deepStrictEqual(SP.visibleModules(list, 'detailed').map(m => m.id), ['z', 'a', 'b', 'm']);
  assert.deepStrictEqual(SP.visibleModules(list, 'simple').map(m => m.id), ['z', 'a', 'm']);
  assert.deepStrictEqual(SP.visibleModules(list, 'other').map(m => m.id), ['z', 'a', 'm']);
  assert.deepStrictEqual(SP.visibleModules(null, 'simple'), []);
});

test('controlState: saved values that fit the kind win, else the default, else a safe fallback', () => {
  const m = SP.normalizeModule(mod('v', { controls: [
    { id: 't', kind: 'toggle', label: 'T', value: true },
    { id: 's', kind: 'select', label: 'S', options: ['a', { value: 'b', label: 'Bé' }] },
    { id: 'r', kind: 'slider', label: 'R', min: 1, max: 4, value: 9 },
    { id: 'go', kind: 'button', label: 'Go' },
  ] }));
  assert.deepStrictEqual(m.controls[1].options, [{ value: 'a', label: 'a' }, { value: 'b', label: 'Bé' }]);
  assert.deepStrictEqual(SP.controlState(m.controls, {}), { t: true, s: 'a', r: 1 });
  assert.deepStrictEqual(SP.controlState(m.controls, { t: false, s: 'b', r: 3 }), { t: false, s: 'b', r: 3 });
  assert.deepStrictEqual(SP.controlState(m.controls, { t: 'yes', s: 'zzz', r: 99 }), { t: true, s: 'a', r: 1 });
});

test('saved state: the key, cleaning, load / save through a storage that may throw', () => {
  assert.strictEqual(SP.storageKey('sessions'), 'vrg.sidepanel.sessions');
  for (const bad of ['', null, 'a b', '../x', 'x'.repeat(65), 5]) assert.strictEqual(SP.storageKey(bad), '');
  const clean = SP.cleanState({ collapsed: true, mode: 'detailed', width: 9999, closed: { a: true, b: false, 'bad id': true },
    values: { links: { x: 1, y: 'ok', z: { no: 1 } }, 'bad id': { a: 1 }, arr: [1] }, extra: 1 });
  assert.deepStrictEqual(clean, { collapsed: true, mode: 'detailed', width: SP.MAX_W, closed: { a: true }, values: { links: { x: 1, y: 'ok' } } });
  assert.strictEqual(SP.cleanState({ mode: 'detailed' }, ['simple']).mode, '');
  const mem = new Map(), storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.strictEqual(SP.saveState(storage, 'vrg.sidepanel.t', { collapsed: true, mode: 'simple', width: 300, closed: {}, values: {} }), true);
  assert.strictEqual(SP.loadState(storage, 'vrg.sidepanel.t').width, 300);
  mem.set('vrg.sidepanel.bad', '{not json');
  assert.deepStrictEqual(SP.loadState(storage, 'vrg.sidepanel.bad'), SP.cleanState(null));
  const throwing = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.deepStrictEqual(SP.loadState(throwing, 'vrg.sidepanel.t'), SP.cleanState(null));
  assert.strictEqual(SP.saveState(throwing, 'vrg.sidepanel.t', {}), false);
  assert.strictEqual(SP.saveState(storage, '', {}), false);
});

test('keyMatches and clampWidth', () => {
  const k = (key, m) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...m });
  assert.ok(SP.keyMatches('Alt+\\', k('\\', { altKey: true })));
  assert.ok(!SP.keyMatches('Alt+\\', k('\\')));
  assert.ok(SP.keyMatches('Ctrl+Shift+S', k('S', { ctrlKey: true, shiftKey: true })));
  assert.ok(!SP.keyMatches('Ctrl+Shift+S', k('S', { ctrlKey: true, shiftKey: true, altKey: true })));
  assert.ok(SP.keyMatches('F6', k('F6')));
  assert.ok(!SP.keyMatches('', k('a')) && !SP.keyMatches('Alt+a', null));
  assert.deepStrictEqual([SP.clampWidth(10), SP.clampWidth(300.4), SP.clampWidth(1e6), SP.clampWidth(NaN)], [SP.MIN_W, 300, SP.MAX_W, 280]);
});

test('create() needs a DOM element; the factories build valid modules', () => {
  assert.throws(() => SP.create(null), /DOM element/);
  for (const m of [SP.modules.links([]), SP.modules.toggles([]), SP.modules.notes(), SP.modules.status([])]) assert.ok(SP.normalizeModule(m).id);
  assert.strictEqual(SP.modules.links([], { id: 'gyors' }).id, 'gyors');
});

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* not installed: the browser test is skipped */ }

test('the demo in Chromium', { skip: !playwright && 'playwright is not installed' }, async () => {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: process.env.SP_SHOT ? 2 : 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // served over http, so localStorage has a real origin (file:// gives a null origin, CLAUDE.md)
    const http = require('http'), fs = require('fs');
    const ROOT = path.resolve(__dirname, '..', '..');
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404).end(); return; }
      r.writeHead(200, { 'Content-Type': p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }).end(fs.readFileSync(p));
    });
    await new Promise(res => srv.listen(0, '127.0.0.1', res));
    const url = 'http://127.0.0.1:' + srv.address().port + '/sidepanel/demo.html';
    try {
      await page.goto(url);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForSelector('.vrg-sp-mod');
      const ids = () => page.$$eval('.vrg-sp-body > .vrg-sp-mod', s => s.map(x => x.dataset.mod));
      assert.deepStrictEqual(await ids(), ['links', 'toggles', 'notes']);
      assert.deepStrictEqual(await page.$$eval('.vrg-sp-link', b => b.map(x => x.dataset.link)), ['canvas', 'trace', 'devlog']);
      // colours from the tokens (resolved through a probe element)
      const colours = await page.evaluate(() => {
        const p = document.createElement('i'); document.body.append(p);
        const tok = n => { p.style.color = 'var(--mv-' + n + ')'; return getComputedStyle(p).color; };
        const out = { warm: tok('warm'), solid: tok('panel-solid'), accent: tok('accent'),
          title: getComputedStyle(document.querySelector('.vrg-sp-title')).color,
          bg: getComputedStyle(document.querySelector('.vrg-sp')).backgroundColor,
          icon: getComputedStyle(document.querySelector('.vrg-sp-link .vrg-sp-icon')).color };
        p.remove(); return out;
      });
      assert.strictEqual(colours.title, colours.warm);
      assert.strictEqual(colours.bg, colours.solid);
      assert.strictEqual(colours.icon, colours.accent);
      // detailed mode shows the detailed modules and links
      await page.click('.vrg-sp-mode');
      assert.deepStrictEqual(await ids(), ['links', 'toggles', 'status', 'notes', 'view']);
      assert.strictEqual(await page.locator('.vrg-sp-link').count(), 6);
      if (process.env.SP_SHOT) await page.screenshot({ path: process.env.SP_SHOT });
      // a link runs; a throwing link gives an error event, not a page error
      await page.click('[data-link="trace"]');
      await page.click('[data-link="broken"]');
      const log = await page.textContent('#log');
      assert.match(log, /open trace/); assert.match(log, /error .*demo error/);
      // a toggle control and a switch keep their value
      await page.click('[data-toggle="notes"]');
      assert.strictEqual(await page.getAttribute('[data-toggle="notes"]', 'aria-checked'), 'true');
      // collapse: the rail shows, the body hides, the width is the rail's
      await page.click('.vrg-sp-collapse');
      assert.strictEqual(await page.getAttribute('.vrg-sp', 'data-collapsed'), '1');
      assert.strictEqual(await page.isVisible('.vrg-sp-body'), false);
      assert.strictEqual(await page.isVisible('.vrg-sp-rail'), true);
      assert.strictEqual(await page.$eval('.vrg-sp', e => e.getBoundingClientRect().width), SP.RAIL_W);
      // a rail icon expands and opens its section
      await page.click('.vrg-sp-railbtn[data-mod="notes"]');
      assert.strictEqual(await page.getAttribute('.vrg-sp', 'data-collapsed'), '');
      // the hotkey (globalHotkey in the demo), then back
      await page.keyboard.press('Alt+\\');
      assert.strictEqual(await page.getAttribute('.vrg-sp', 'data-collapsed'), '1');
      await page.keyboard.press('Alt+\\');
      assert.strictEqual(await page.getAttribute('.vrg-sp', 'data-collapsed'), '');
      // a note and the section state survive a reload
      await page.fill('.vrg-sp-notes', 'teszt jegyzet');
      await page.click('.vrg-sp-mod[data-mod="toggles"] .vrg-sp-modhead');
      await page.click('.vrg-sp-title');   // blur the textarea → saved
      await page.reload();
      await page.waitForSelector('.vrg-sp-mod');
      assert.strictEqual(await page.inputValue('.vrg-sp-notes'), 'teszt jegyzet');
      assert.strictEqual(await page.getAttribute('.vrg-sp', 'data-mode'), 'detailed');
      assert.strictEqual(await page.isVisible('.vrg-sp-mod[data-mod="toggles"] .vrg-sp-inner'), false);
      assert.strictEqual(await page.getAttribute('[data-toggle="notes"]', 'aria-checked'), 'true');
      // resize by dragging the grip
      const box = await page.$eval('.vrg-sp-grip', g => { const r = g.getBoundingClientRect(); return { x: r.x + 2, y: r.y + 100 }; });
      const w0 = await page.$eval('.vrg-sp', e => e.getBoundingClientRect().width);
      await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x - 60, box.y, { steps: 4 }); await page.mouse.up();
      assert.strictEqual(await page.$eval('.vrg-sp', e => e.getBoundingClientRect().width), w0 + 60);
      assert.deepStrictEqual(errors, []);
    } finally { srv.close(); }
  } finally { await browser.close(); }
});
