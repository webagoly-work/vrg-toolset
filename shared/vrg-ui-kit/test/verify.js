#!/usr/bin/env node
/* VRG UI Kit — test/verify.js — the adversarial checks, headless (Playwright + Chromium).
   NODE_PATH=$(npm root -g) node test/verify.js [--only contrast,offline,keyboard,cyd,bundle] [--shots DIR]
   1 contrast  WCAG AA for every token pair the kit relies on, in every theme (text 4.5:1, UI marks 3:1)
   2 offline   gallery.html from file:// with every network request blocked: no request, no console error
   3 keyboard  Tab walk through the whole gallery: every stop visibly focused (outline or ring), no traps
   4 cyd       the 320×240 frame: every target ≥ 36 px, no horizontal overflow, text ≥ 11 px
   5 bundle    inline.js builds a single-file page with a few components; it boots and they work
   Exit code 1 when any check fails. Prints one line per finding. */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const KIT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',').filter(Boolean) : [];
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const want = (k) => !only.length || only.includes(k);
const THEMES = ['dark', 'light', 'contrast', 'melyviz'];
let fails = 0;
const fail = (m) => { fails++; console.log('✗ ' + m); };
const ok = (m) => console.log('✓ ' + m);

async function page(browser, file, q, vp) {
  const p = await browser.newPage({ viewport: vp || { width: 1280, height: 900 } });
  p._errs = []; p._net = [];
  p.on('console', m => { if (m.type() === 'error') p._errs.push(m.text()); });
  p.on('pageerror', e => p._errs.push(String(e)));
  await p.route(/^(https?|wss?|ftp):/i, r => { p._net.push(r.request().url()); r.abort(); });
  await p.goto('file://' + path.resolve(file) + (q || ''));
  await p.waitForTimeout(300);
  return p;
}

// ---------- 1 contrast ----------
const TEXT = ['text', 'text-muted'];
const SURF = ['bg', 'surface-1', 'surface-2', 'surface-3'];
const STATUS = ['accent', 'activity', 'ok', 'warn', 'crit', 'info', 'idea'];
function pairs() {
  const P = [];
  TEXT.forEach(t => SURF.forEach(s => P.push([t, s, 4.5, 'text'])));
  STATUS.forEach(t => ['bg', 'surface-1', 'surface-2'].forEach(s => P.push([t, s, 4.5, 'status text'])));
  STATUS.forEach(t => P.push(['text-on-solid', t, 4.5, 'solid badge']));
  P.push(['text-on-accent', 'accent', 4.5, 'primary button']);
  P.push(['text-on-accent', 'accent-hover', 4.5, 'primary hover']);
  ['bg', 'surface-1', 'surface-2', 'surface-3'].forEach(s => { P.push(['border-control', s, 3, 'control boundary']); P.push(['focus', s, 3, 'focus ring']); });
  for (let i = 1; i <= 8; i++) { P.push(['layer-' + i, 'bg', 3, 'wire']); P.push(['layer-' + i, 'surface-1', 3, 'wire']); }
  P.push(['heat-4', 'heat-0', 3, 'heat max']);
  P.push(['term-text', 'term-bg', 4.5, 'terminal']);
  P.push(['text', 'select-bg@surface-1', 4.5, 'selected row']);
  P.push(['accent', 'accent-soft@surface-1', 4.5, 'pressed control']);
  P.push(['text', 'overlay@bg', 4.5, 'glass']);
  return P;
}
async function contrast(browser) {
  const p = await page(browser, path.join(KIT, 'gallery.html'));
  for (const t of THEMES) {
    const res = await p.evaluate(({ theme, pairs }) => {
      document.documentElement.dataset.vkTheme = theme;
      const probe = document.createElement('div'); document.body.appendChild(probe);
      const parse = (s) => {
        let m = s.match(/rgba?\(([^)]+)\)/);
        if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]]; }
        m = s.match(/color\(srgb ([^)]+)\)/);
        if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] === undefined ? 1 : v[3]]; }
        return null;
      };
      const col = (tok) => { probe.style.backgroundColor = 'var(--vk-' + tok + ')'; return parse(getComputedStyle(probe).backgroundColor); };
      const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat([1]);
      const resolve = (spec) => {
        const [tok, under] = spec.split('@');
        let c = col(tok); if (!c) return null;
        const base = under ? resolve(under) : col('bg');
        if (c[3] < 1) c = over(c, base && base[3] === 1 ? base : over(base, [0, 0, 0, 1]));
        return c;
      };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const out = pairs.map(([fg, bg, min, what]) => {
        const b = resolve(bg); let f = resolve(fg + (fg.includes('@') ? '' : '@' + bg));
        if (!f || !b) return { fg, bg, min, what, ratio: 0, err: 'unresolved' };
        const L1 = lum(f), L2 = lum(b); const r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        return { fg, bg, min, what, ratio: Math.round(r * 100) / 100 };
      });
      probe.remove(); return out;
    }, { theme: t, pairs: pairs() });
    const bad = res.filter(r => r.ratio < r.min);
    bad.forEach(r => fail(`contrast [${t}] ${r.what}: --vk-${r.fg} on --vk-${r.bg} = ${r.ratio}:1 (needs ${r.min})${r.err ? ' ' + r.err : ''}`));
    if (!bad.length) ok(`contrast [${t}] ${res.length} pairs ≥ AA (min ${Math.min(...res.map(r => r.ratio / r.min * r.min)).toFixed(2)}:1)`);
  }
  await p.close();
}

// ---------- 2 offline ----------
async function offline(browser) {
  for (const t of THEMES) {
    const p = await page(browser, path.join(KIT, 'gallery.html'), '?theme=' + t);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(500);
    if (p._net.length) fail(`offline [${t}] network requests: ${[...new Set(p._net)].slice(0, 5).join(', ')}`);
    if (p._errs.length) fail(`offline [${t}] console errors: ${p._errs.slice(0, 5).join(' | ')}`);
    const fonts = await p.evaluate(async () => { await document.fonts.ready; return ['VK Inter', 'VK Barlow Condensed', 'VK JetBrains Mono'].map(f => [f, document.fonts.check('16px "' + f + '"', 'őűŐŰ')]); });
    fonts.forEach(([f, okk]) => { if (!okk) fail(`offline [${t}] font ${f} not loaded for ő ű`); });
    if (!p._net.length && !p._errs.length) ok(`offline [${t}] file:// with network blocked: 0 requests, 0 console errors, fonts ${fonts.every(f => f[1]) ? 'loaded (ő ű ok)' : 'MISSING'}`);
    if (shots) await p.screenshot({ path: path.join(shots, 'gallery-' + t + '.png'), fullPage: false });
    await p.close();
  }
}

// ---------- 3 keyboard ----------
async function keyboard(browser) {
  const p = await page(browser, path.join(KIT, 'gallery.html'));
  const seen = new Set(); let invisible = [], stuck = 0, last = null, n = 0;
  await p.keyboard.press('Tab');
  for (let i = 0; i < 1500; i++) {
    const info = await p.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const cs = getComputedStyle(a);
      // a ring counts on the element, on a wrapper up to two levels up (field boxes ring with :focus-within), or —
      // for SVG parts, which must not get a rotated outline box — on a descendant stroked in the focus colour
      const hasRing = (n) => { if (!n || n.nodeType !== 1) return false; const c = getComputedStyle(n);
        return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (/rgb|color\(/.test(c.boxShadow) && c.boxShadow !== 'none'); };
      const probe = document.createElement('i'); probe.style.color = 'var(--vk-focus)'; document.body.appendChild(probe);
      const focusCol = getComputedStyle(probe).color; probe.remove();
      const svgRing = a instanceof SVGElement && [...a.querySelectorAll('*')].some(n => getComputedStyle(n).stroke === focusCol);
      const ring = hasRing(a) || hasRing(a.parentElement) || (a.parentElement && hasRing(a.parentElement.parentElement)) || svgRing;
      const id = a.id || (a.className && String(a.className.baseVal !== undefined ? a.className.baseVal : a.className).split(' ')[0]) || a.tagName;
      const sec = a.closest('.g-sec'); const r = a.getBoundingClientRect();
      // identity, not description: unlabeled siblings (a list of checkboxes) must not read as "stuck"
      if (!a.__vkWalk) a.__vkWalk = (window.__vkWalkN = (window.__vkWalkN || 0) + 1);
      return { key: (sec ? sec.id : 'top') + ' ' + a.tagName + '.' + id + ' ' + (a.getAttribute('aria-label') || a.textContent || a.value || '').trim().slice(0, 30) + ' #' + a.__vkWalk, ring, w: r.width, h: r.height, path: sec ? sec.id : 'top' };
    });
    if (!info) break;
    n++;
    if (!info.ring && info.w > 0) invisible.push(info.key);
    if (info.key === last) { stuck++; if (stuck > 3) { fail('keyboard: focus stuck at ' + info.key); break; } } else stuck = 0;
    if (seen.has(info.key) && info.path === 'top' && n > 20) break;      // wrapped round to the header
    seen.add(info.key); last = info.key;
    await p.keyboard.press('Tab');
  }
  if (invisible.length) fail(`keyboard: ${invisible.length} focus stop(s) without a visible ring: ${invisible.slice(0, 8).join(' · ')}`);
  const secs = [...new Set([...seen].map(k => k.split(' ')[0]))];
  ok(`keyboard: ${n} Tab stops walked, ${seen.size} distinct, ${invisible.length} without a ring; regions reached: ${secs.join(' ')}`);
  const missing = ['f00', 'f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f10'].filter(x => !secs.includes(x));
  if (missing.length) fail('keyboard: Tab never reached ' + missing.join(' '));
  // Shift+Arrow hop between regions
  await p.focus('#g-theme [aria-checked="true"]');
  const before = await p.evaluate(() => document.activeElement.closest('[data-vk-hop]') && document.activeElement.closest('[data-vk-hop]').className);
  await p.keyboard.press('Shift+ArrowDown');
  const after = await p.evaluate(() => { const r = document.activeElement.closest('[data-vk-hop]'); return r && (r.id || r.className); });
  if (after && after !== before) ok('keyboard: Shift+ArrowDown hops from the header to ' + after); else fail('keyboard: Shift+Arrow hop did not move region');
  // palette opens with Ctrl+K if the command family registered it
  const hasPal = await p.evaluate(() => !!(window.VK && VK.actions && VK.actions.get('palette.open')));
  if (hasPal) {
    await p.keyboard.press('Control+k'); await p.waitForTimeout(150);
    const open = await p.evaluate(() => { const a = document.activeElement; return a && a.getAttribute('role') === 'combobox'; });
    if (open) { ok('keyboard: Ctrl+K opens the palette with focus in its input'); await p.keyboard.press('Escape'); }
    else fail('keyboard: Ctrl+K did not focus the palette input');
  }
  if (p._errs.length) fail('keyboard: console errors during walk: ' + p._errs.slice(0, 3).join(' | '));
  await p.close();
}

// ---------- 4 cyd ----------
async function cyd(browser) {
  const p = await page(browser, path.join(KIT, 'gallery.html'), '?density=touch', { width: 1280, height: 900 });
  const frames = await p.$$('.vk-cyd');
  if (!frames.length) { fail('cyd: no .vk-cyd frame in the gallery'); await p.close(); return; }
  for (let i = 0; i < frames.length; i++) {
    const r = await frames[i].evaluate((f) => {
      const z = f.getBoundingClientRect().width / 320;   // zoomed frames scale everything
      const res = { w: Math.round(f.offsetWidth), h: Math.round(f.offsetHeight), small: [], tinyText: [], overflow: f.scrollWidth > f.clientWidth + 1 };
      f.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="slider"], input, [tabindex="0"]').forEach(b => {
        const rr = b.getBoundingClientRect(); if (!rr.width) return;
        const w = rr.width / z, h = rr.height / z;
        if (w < 36 || h < 36) res.small.push((b.getAttribute('aria-label') || b.textContent || b.tagName).trim().slice(0, 20) + ' ' + Math.round(w) + '×' + Math.round(h));
      });
      f.querySelectorAll('*').forEach(e => { if (e.children.length || !e.textContent.trim()) return; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11) res.tinyText.push(e.textContent.trim().slice(0, 16) + ' ' + fs + 'px'); });
      return res;
    });
    if (r.w !== 320 || r.h !== 240) fail(`cyd #${i}: frame is ${r.w}×${r.h}, not 320×240`);
    if (r.overflow) fail(`cyd #${i}: horizontal overflow inside the frame`);
    if (r.small.length) fail(`cyd #${i}: ${r.small.length} target(s) under 36 px: ${r.small.slice(0, 6).join(' · ')}`);
    if (r.tinyText.length) fail(`cyd #${i}: text under 11 px: ${r.tinyText.slice(0, 6).join(' · ')}`);
    if (r.w === 320 && r.h === 240 && !r.overflow && !r.small.length && !r.tinyText.length) ok(`cyd #${i}: 320×240, all targets ≥ 36 px, text ≥ 11 px, no overflow`);
  }
  if (shots && frames[0]) await frames[0].screenshot({ path: path.join(shots, 'cyd.png') });
  await p.close();
}

// ---------- 5 bundle ----------
async function bundle(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-bundle-'));
  const man = JSON.parse(fs.readFileSync(path.join(KIT, 'manifest.json'), 'utf8'));
  const pick = ['table', 'palette', 'badge', 'toggle', 'mini'].filter(n => man.components.some(c => c.name === n));
  const snippet = execFileSync('node', [path.join(KIT, 'inline.js'), ...pick, '--fonts'], { encoding: 'utf8' });
  const html = '<!doctype html><html lang="hu" class="vk" data-vk-theme="dark"><head><meta charset="utf-8"><title>bundle test</title>\n' + snippet +
    '</head><body><div id="t"></div><span class="vk-badge" data-state="inuse">Használatban</span><button id="m">x</button><script>\n' +
    'window.__ok = [];\n' +
    'if (VK.mini) { var m = VK.mini.create({icon:"refresh", label:"Szinkron"}); document.body.appendChild(m); VK.mini.set(m,{state:"running",progress:.5}); __ok.push(m.getAttribute("aria-label")); }\n' +
    'if (VK.table && VK.table.mount) { try { VK.table.mount(document.getElementById("t"), {columns:[{key:"n",label:"Név"}], rows:[{n:"Kötőelem"},{n:"Hűtő"}]}); __ok.push("table:" + document.querySelectorAll("#t [role=row]").length); } catch(e) { __ok.push("table error " + e.message); } }\n' +
    'if (VK.palette && VK.palette.attach) { try { VK.palette.attach({}); VK.actions.bindKeys(document); VK.actions.register({id:"x.hello", label:"Őrszem indítása", run:function(){ __ok.push("ran"); }}); __ok.push("palette"); } catch(e) { __ok.push("palette error " + e.message); } }\n' +
    '</script></body></html>';
  const f = path.join(dir, 'bundle-test.html'); fs.writeFileSync(f, html);
  const p = await page(browser, f);
  const r = await p.evaluate(() => ({ ok: window.__ok, sprite: !!document.querySelector('svg[data-vk-sprite] symbol'), font: document.fonts.check('16px "VK Inter"', 'ő') }));
  if (p._errs.length) fail('bundle: console errors: ' + p._errs.join(' | '));
  if (p._net.length) fail('bundle: network requests: ' + p._net.join(', '));
  if (!r.sprite) fail('bundle: sprite missing');
  if (r.ok.some(s => /error/.test(s))) fail('bundle: ' + r.ok.join(' · '));
  else ok(`bundle: ${pick.join(', ')} → one file ${Math.round(html.length / 1024)} kB, boots offline; ${r.ok.join(' · ')}; sprite ${r.sprite}, fonts ${r.font}`);
  if (pick.includes('palette')) {
    await p.keyboard.press('Control+k'); await p.waitForTimeout(150); await p.keyboard.type('orsz'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    const ran = await p.evaluate(() => window.__ok.includes('ran'));
    if (ran) ok('bundle: Ctrl+K → "orsz" → Enter ran "Őrszem indítása" (Hungarian-folded search)'); else fail('bundle: palette did not run the action from the keyboard');
  }
  await p.close();
}

(async () => {
  if (!fs.existsSync(path.join(KIT, 'gallery.html'))) execFileSync('node', [path.join(KIT, 'gallery/build.js')]);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (want('contrast')) await contrast(browser);
    if (want('offline')) await offline(browser);
    if (want('keyboard')) await keyboard(browser);
    if (want('cyd')) await cyd(browser);
    if (want('bundle')) await bundle(browser);
  } finally { await browser.close(); }
  console.log(fails ? `✗ ${fails} finding(s)` : '✓ all checks passed');
  process.exit(fails ? 1 : 0);
})();
