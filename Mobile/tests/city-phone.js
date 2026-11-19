#!/usr/bin/env node
// city-phone.js — VRG Mobile M5: the phone layout for Kódváros (feature-city/src/main/assets/city-phone.js),
// checked by element boxes in headless Chromium (Playwright), on a real Kódváros page loaded the way the app
// loads it: from https://appassets.androidplatform.net/city/main/city.html, every other request refused, then
// city-phone.js + city-touch.js injected in that order, each in its own try (as CityFeature.onPageFinished does).
//
//   node Mobile/tests/city-phone.js [city.html] [--shot <png>]
//
// At 412x915 (upright) and 915x412 (landscape), deviceScaleFactor 1, a mobile touch browser:
//   closed: the page is not zoomed out, nothing reaches past the right edge (clipped by its own boxes, the page's
//   overflow:hidden does not count), the PC toolbars are out of sight, the row's parts do not overlap, every
//   control is >= 44x44 px, the canvas has >= 60 % of the height, one finger still orbits;
//   open (☰): the sheet sits under the row inside the screen, its sections and controls do not overlap, every
//   control is >= 44x44 px, nothing past the right edge (scrolled to the end too); upright the city still shows
//   below it, a lens tap closes it; in landscape it is a side sheet that stays open on a lens tap, and a tap on
//   the city closes it without moving the camera; the row's ▶ drives the timeline's ▶.
// Then on a PC-sized window: the script changes nothing, and a window narrowed to phone width and widened again
// gets every element back to its exact place.
// Needs Playwright (require('playwright')) and, without an argument, Vendor/three (node tools/fetch-vendor.js three).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(REPO, 'Mobile', 'android', 'feature-city', 'src', 'main', 'assets');
const INJECT = ['city-phone.js', 'city-touch.js'].map(f => `try {\n${fs.readFileSync(path.join(ASSETS, f), 'utf8')}\n} catch (e) { console.error(e) }`).join('\n');
const PAGE_URL = 'https://appassets.androidplatform.net/city/main/city.html';

let playwright;
try { playwright = require('playwright'); } catch { console.log('city-phone: SKIPPED, Playwright not found'); process.exit(0); }

const args = process.argv.slice(2);
const shotAt = args.indexOf('--shot');
const SHOT = shotAt >= 0 ? path.resolve(args.splice(shotAt, 2)[1]) : null;

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-city-phone-'));

// ---- in the page: boxes ---------------------------------------------------------------------------------
// every visible element's box, clipped by its scrolling / clipping ancestors (not by <html>/<body>, whose
// overflow:hidden is exactly what hid the PC layout running off the screen)
const BOXES = `(() => {
  const out = [];
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || e.closest('[hidden]') || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
    let r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const q = a.getBoundingClientRect();
        x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom);
      }
    }
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    out.push({ n: name(e), x0, y0, x1, y1 });
  }
  return out;
})()`;
const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
// the controls a finger uses inside a container: visible buttons, selects, inputs and breadcrumb steps
const CONTROLS = root => `(() => {
  const out = [];
  for (const e of document.querySelectorAll('${root} button, ${root} select, ${root} input:not([type=range]):not([type=file]), ${root} #crumb span, ${root} #tl-track')) {
    if (e.closest('[hidden]') || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ n: (e.id || e.dataset.lens || e.textContent.trim().slice(0, 14) || e.tagName), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width, h: r.height });
  }
  return out;
})()`;
const pairsOverlap = list => {
  const bad = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (overlap(list[i], list[j])) bad.push(list[i].n + ' / ' + list[j].n);
  return bad;
};

async function open(browser, opts) {
  const ctx = await browser.newContext(opts);
  const html = fs.readFileSync(CITY);
  // the app's shouldInterceptRequest: that one page, every other request an empty 403
  await ctx.route('**/*', r => r.request().url().split('#')[0] === PAGE_URL
    ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
    : r.fulfill({ status: 403, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // refused requests and Kódváros's 36-link looking for the PC's ws://127.0.0.1 port are expected on the phone
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|403|WebSocket connection to 'ws:\/\/127\.0\.0\.1/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.CITY && document.getElementById('gl') && document.getElementById('gl').width > 0, null, { timeout: 60000 });
  await sleep(2000);
  return { ctx, page, errors };
}
const inject = page => page.evaluate(INJECT);
const cam = async page => { await sleep(500); const q = new URLSearchParams((await page.evaluate('location.hash')).slice(1)); return (q.get('cam') || '').split(',').map(Number); };
// a real touch drag through DevTools (Playwright's touchscreen only taps)
async function drag(page, x0, y0, dx, dy, n = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x0, y: y0 }] });
  for (let i = 1; i <= n; i++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x0 + dx * i / n, y: y0 + dy * i / n }] }); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(50);
}
const tap = async (page, sel) => { const b = await box(page, sel); await page.touchscreen.tap(b.x0 + b.w / 2, b.y0 + b.h / 2); await sleep(250); };

let CITY = args[0] && path.resolve(args[0]);

async function phone(browser, W, H) {
  const upright = H > W, tag = `${W}x${H}`;
  const { ctx, page, errors } = await open(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await inject(page);
  await inject(page);   // onPageFinished can come twice: still one row
  await sleep(600);
  const cls = await page.evaluate('document.documentElement.className');
  ok(/\bvrg-phone\b/.test(cls) && /\bvrg-land\b/.test(cls) === !upright, `${tag}: phone layout on (${cls})`);
  ok(await page.evaluate('document.querySelectorAll("#vp-top").length === 1 && document.querySelectorAll("#vp-sheet").length === 1'), `${tag}: injecting twice keeps one row and one sheet`);
  const vw = await page.evaluate('[innerWidth, document.documentElement.scrollWidth, document.body.scrollWidth]');
  ok(vw[0] === W && vw[1] <= W && vw[2] <= W, `${tag}: the page is not zoomed out and nothing widens it (innerWidth ${vw[0]}, scrollWidth ${vw[1]}/${vw[2]})`);

  // ---- closed
  let all = await page.evaluate(BOXES);
  const off = all.filter(b => b.x1 > W + 0.5 || b.x0 < -0.5);
  ok(!off.length, `${tag}: nothing past the screen's edges: ${off.slice(0, 5).map(b => `${b.n} ${Math.round(b.x0)}..${Math.round(b.x1)}`).join(', ')}`);
  const pc = all.filter(b => /#(lenses|timeline|legend|board|crumb|inset|help|qwrap|bar)\b/.test(b.n) && !/#(lenses|timeline|legend|board|crumb|inset|help|qwrap|bar) /.test(b.n));
  ok(!pc.length, `${tag}: the PC toolbars are out of sight while the sheet is closed: ${pc.map(b => b.n).join(', ')}`);
  const row = await page.evaluate(CONTROLS('#vp-top'));
  ok(row.length >= (upright ? 3 : 5), `${tag}: the row has ☰, the status and the timeline buttons (${row.map(b => b.n).join(', ')})`);
  ok(!pairsOverlap(row).length, `${tag}: the row's parts do not overlap: ${pairsOverlap(row).join(', ')}`);
  const small = row.filter(b => b.w < 44 || b.h < 44);
  ok(!small.length, `${tag}: every control in the row is at least 44x44: ${small.map(b => `${b.n} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', ')}`);
  const top = await box(page, '#vp-top'), gl = await box(page, '#gl'), hud = await box(page, '#hud');
  ok(top.y0 >= 0 && top.h <= 49 && top.x1 <= W, `${tag}: the row is one 48 px line at the top (${Math.round(top.y0)}, ${Math.round(top.h)} px)`);
  ok(gl.h / H >= 0.6 && gl.y0 >= top.y1 - 0.5 && gl.w >= W - 0.5, `${tag}: the city has ${Math.round(100 * gl.h / H)} % of the height, under the row, full width`);
  const floating = all.filter(b => /^(div|nav|aside|canvas)#(hud|panel|tours|landinfo|now|caption|sess-now|inset|legend|lenses|board|crumb|timeline)$/.test(b.n));
  ok(!pairsOverlap([top, ...floating].map((b, i) => i ? b : { ...b, n: '#vp-top' })).length, `${tag}: nothing floats over the row or over another overlay: ${pairsOverlap([{ ...top, n: '#vp-top' }, ...floating]).join(', ')}`);
  const status = await page.evaluate('[document.getElementById("vp-l1").textContent, document.getElementById("vp-l2").textContent]');
  ok(/^MOST · [0-9A-F]{7}/.test(status[0]) && /commit/.test(status[0]), `${tag}: the status's first line is the board: ${status[0]}`);
  ok(/Kódváros/.test(status[1]), `${tag}: the second line is where you are: ${status[1]}`);
  ok(!hud || (hud.x1 <= W && hud.h <= 20), `${tag}: the hud is one line inside the screen`);
  if (upright && SHOT) { await page.screenshot({ path: SHOT }); console.log(`  screenshot: ${SHOT}`); }

  // one finger still orbits under the phone layout
  const a = await cam(page);
  await drag(page, Math.round(gl.x0 + gl.w / 2), Math.round(gl.y0 + gl.h / 2), 120, 0);
  const b = await cam(page);
  ok(a.length === 5 && b.length === 5 && Math.abs(b[2] - a[2]) > 0.3 && b[4] === a[4], `${tag}: one finger on the city still orbits (theta ${a[2]} -> ${b[2]})`);

  // ---- the row's ▶ is the timeline's ▶
  const p0 = await page.evaluate('document.getElementById("tl-play").textContent');
  await tap(page, '#vp-play');
  const p1 = await page.evaluate('[document.getElementById("tl-play").textContent, document.getElementById("vp-play").textContent]');
  ok(p1[0] !== p0 && p1[1] === p1[0], `${tag}: the row's ▶ starts the replay and shows its state (${p0} -> ${p1.join(' / ')})`);
  await tap(page, '#vp-play');
  ok(await page.evaluate('document.getElementById("tl-play").textContent') === p0, `${tag}: and stops it`);
  await page.evaluate('document.getElementById("tl-latest").click()');
  await sleep(300);

  // ---- open
  await tap(page, '#vp-menu');
  ok(await page.evaluate('document.documentElement.classList.contains("vrg-open") && document.getElementById("vp-menu").getAttribute("aria-expanded") === "true"'), `${tag}: ☰ opens the sheet`);
  const sh = await box(page, '#vp-sheet');
  ok(sh.y0 >= top.y1 - 0.5 && sh.x0 >= 0 && sh.x1 <= W + 0.5 && sh.y1 <= H + 0.5, `${tag}: the sheet is under the row, inside the screen (${Math.round(sh.x0)},${Math.round(sh.y0)} ${Math.round(sh.w)}x${Math.round(sh.h)})`);
  if (upright) ok(sh.y1 <= H * 0.8, `${tag}: upright the city still shows below the sheet (sheet ends at ${Math.round(sh.y1)} of ${H})`);
  else ok(sh.w <= W * 0.56 && sh.y1 >= H - 1, `${tag}: in landscape it is a side sheet (${Math.round(sh.w)} px wide, to the bottom)`);
  const sections = await page.evaluate(`[...document.getElementById('vp-sheet').children].filter(e => e.getBoundingClientRect().height > 0).map(e => { const r = e.getBoundingClientRect(); return { n: e.id || e.tagName + ':' + (e.dataset.for || ''), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; })`);
  const want = ['crumb', 'qwrap', 'lenses', 'timeline', 'legend', 'bar'];
  ok(want.every(id => sections.some(s => s.n === id)), `${tag}: the sheet holds the breadcrumb, search, lenses, timeline, legend and tools: ${sections.map(s => s.n).join(', ')}`);
  ok(!pairsOverlap(sections).length, `${tag}: the sheet's sections do not overlap: ${pairsOverlap(sections).join(', ')}`);
  for (const end of ['top', 'bottom']) {
    await page.evaluate(e => { const s = document.getElementById('vp-sheet'); s.scrollTop = e === 'top' ? 0 : s.scrollHeight; }, end);
    await sleep(100);
    const ctl = await page.evaluate(CONTROLS('#vp-sheet'));
    const tiny = ctl.filter(c => c.w < 44 || c.h < 44);
    ok(ctl.length > 10 && !tiny.length, `${tag}: every control in the sheet (${end}, ${ctl.length}) is at least 44x44: ${tiny.map(c => `${c.n} ${Math.round(c.w)}x${Math.round(c.h)}`).join(', ')}`);
    ok(!pairsOverlap(ctl).length, `${tag}: no two controls in the sheet overlap (${end}): ${pairsOverlap(ctl).slice(0, 4).join(', ')}`);
    all = await page.evaluate(BOXES);
    const out = all.filter(x => x.x1 > W + 0.5 || x.x0 < -0.5);
    ok(!out.length, `${tag}: nothing past the right edge with the sheet open (${end}): ${out.slice(0, 5).map(x => `${x.n} ${Math.round(x.x0)}..${Math.round(x.x1)}`).join(', ')}`);
  }
  await page.evaluate(`document.getElementById('vp-sheet').scrollTop = 0`);
  ok(await page.evaluate('document.documentElement.scrollWidth') <= W, `${tag}: the open sheet does not widen the page`);

  // a lens from the sheet
  await page.evaluate(`document.querySelector('#lenses [data-lens]:not(.on)').scrollIntoView({ block: 'center' })`);
  await sleep(100);
  const lens = await page.evaluate(`document.querySelector('#lenses [data-lens]:not(.on)').dataset.lens`);
  await tap(page, `#lenses [data-lens="${lens}"]`);
  ok(await page.evaluate(l => document.querySelector(`#lenses [data-lens="${l}"]`).classList.contains('on'), lens), `${tag}: a lens tapped in the sheet switches (${lens})`);
  const stillOpen = await page.evaluate('document.documentElement.classList.contains("vrg-open")');
  ok(upright ? !stillOpen : stillOpen, `${tag}: ${upright ? 'upright the lens tap closes the sheet' : 'the side sheet stays open on a lens tap'}`);
  if (upright) await tap(page, '#vp-menu');

  // a tap on the city while open: closes the sheet and nothing else
  const c0 = await cam(page);
  const gx = upright ? Math.round(W / 2) : Math.round(W * 0.8), gy = upright ? Math.round(H * 0.9) : Math.round(H * 0.6);
  await page.touchscreen.tap(gx, gy);
  await sleep(200);
  ok(!(await page.evaluate('document.documentElement.classList.contains("vrg-open")')), `${tag}: a tap on the city closes the sheet`);
  const c1 = await cam(page);
  ok(JSON.stringify(c0) === JSON.stringify(c1) && await page.evaluate('document.getElementById("panel").hidden'), `${tag}: that tap does not move the camera or pick a building`);

  ok(!errors.length, `${tag}: the page threw nothing: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

async function desktop(browser) {
  const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const SEL = ['#bar', '#qwrap', '#lenses', '#timeline', '#legend', '#board', '#crumb', '#stage', '#gl'];
  const where = () => page.evaluate(sels => sels.map(s => { const e = document.querySelector(s); if (!e) return s + ':none'; const r = e.getBoundingClientRect(); return `${s}:${e.parentElement.id || e.parentElement.tagName}:${[r.left, r.top, r.width, r.height].map(Math.round)}`; }), SEL);
  const before = await where();
  await inject(page);
  await sleep(400);
  ok(!(await page.evaluate('document.documentElement.classList.contains("vrg-phone")')), '1280x800: no phone layout on a PC-sized window');
  ok(JSON.stringify(await where()) === JSON.stringify(before), '1280x800: every toolbar stays exactly where it was');
  await page.setViewportSize({ width: 500, height: 800 });
  await sleep(500);
  ok(await page.evaluate('document.documentElement.classList.contains("vrg-phone") && document.getElementById("lenses").parentElement.id === "vp-sheet"'), 'narrowed to 500 px: the phone layout takes over');
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(500);
  const after = await where();
  ok(JSON.stringify(after) === JSON.stringify(before), `widened again: everything is back in place${JSON.stringify(after) === JSON.stringify(before) ? '' : ': ' + after.filter((x, i) => x !== before[i]).join(' ')}`);
  ok(await page.evaluate('!document.documentElement.classList.contains("vrg-phone") && getComputedStyle(document.getElementById("vp-top")).display === "none" && document.getElementById("bar").previousElementSibling.id === "vp-top"'), 'widened again: the row is out of sight, the header bar back at the top');
  ok(!errors.length, `1280x800: the page threw nothing: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

(async () => {
  if (!CITY) {
    if (!fs.existsSync(path.join(REPO, 'Vendor', 'three', 'package.json'))) {
      console.log('city-phone: SKIPPED, no Vendor/three (node tools/fetch-vendor.js three) and no city.html given'); process.exit(0);
    }
    CITY = path.join(tmp, 'city.html');
    execFileSync(process.execPath, [path.join(REPO, 'CodeCity', 'scan.js'), REPO, '--out', path.join(tmp, 'city.json'), '--html', CITY], { stdio: 'ignore' });
  }
  const browser = await playwright.chromium.launch();
  try {
    await phone(browser, 412, 915);
    await phone(browser, 915, 412);
    await desktop(browser);
  } catch (e) {
    fail++; console.log('  FAIL ' + (e.stack || e));
  } finally {
    await browser.close();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* nothing to keep */ }
  }
  console.log(`city-phone: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
