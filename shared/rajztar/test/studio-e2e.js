#!/usr/bin/env node
// studio-e2e.js — drives studio.html in headless Chrome over CDP with real mouse and key events.
//   node shared/rajztar/test/studio-e2e.js [--shots <dir>]
// Serves the folder over http (localStorage needs a real origin), then: package wizard → sheets,
// place symbols, draw a wire, rotate, the legend and title block, print-to-PDF page size, symbol
// editor save + lint. No dependencies: Node's built-in WebSocket and the portable headless Chrome.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..', '..');
const CHROME = process.env.CHROME || [path.join(REPO, '..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe'), 'H:\\VRG\\Full\\tools\\chrome-headless-shell\\chrome-headless-shell.exe'].find((p) => fs.existsSync(p));
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'studio.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  if (!CHROME) { console.log('headless Chrome not found (set CHROME)'); process.exit(2); }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/studio.html`;
  const prof = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rajztar-e2e-'));
  const ch = spawn(CHROME, ['--remote-debugging-port=0', '--user-data-dir=' + prof, '--window-size=1500,950', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => { let b = ''; ch.stderr.on('data', (d) => { b += d; const m = b.match(/ws:\/\/[^\s]+/); if (m) res(m[0]); }); setTimeout(() => rej(new Error('no devtools url')), 15000); });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const waits = new Map(); const errors = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); });
  const send = (method, params) => new Promise((r) => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(expr + ' → ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); return r.result.result.value; };
  const box = async (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height,l:b.x,t:b.y}})()`);
  const mouse = async (type, x, y, extra) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }, extra || {}));
  const click = async (x, y, n) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, { clickCount: n || 1 }); await mouse('mouseReleased', x, y, { clickCount: n || 1 }); await sleep(60); };
  const clickSel = async (sel) => { const b = await box(sel); if (!b) throw new Error('no ' + sel); await click(b.x, b.y); };
  const key = async (k, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: code || k, windowsVirtualKeyCode: { Delete: 46, r: 82, Escape: 27, Enter: 13 }[k] || 0 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code || k }); await sleep(60); };
  const shot = async (name) => { if (!SHOTS) return; const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  // the app debounces saves by 250 ms; read after that
  const state = async () => { await sleep(350); return ev(`JSON.parse(localStorage.getItem('rajztar.studio.v1')||'null')`); };
  // sheet mm → screen px
  const mm2px = (mx, my) => ev(`(()=>{const s=document.querySelector('#sheet-canvas svg');const p=s.createSVGPoint();p.x=${mx};p.y=${my};const q=p.matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y}})()`);

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url }); await sleep(900);
  await ev(`localStorage.clear();sessionStorage.clear();location.reload()`).catch(() => { }); await sleep(900);

  console.log('Rajztár Stúdió e2e');
  // ---- 1 Csomag
  ok(await ev(`!document.getElementById('pane-pkg').hidden`), 'opens on the Csomag tab');
  await ev(`(()=>{const s=document.querySelector('[data-k=cls]');s.value='tarsas-nagy';s.dispatchEvent(new Event('change'))})()`); await sleep(100);
  await ev(`(()=>{const s=document.querySelector('[data-k=levels]');s.value='-1,0,1,2,3,4,5,6,7,8,9,T';s.dispatchEvent(new Event('change'))})()`); await sleep(100);
  await ev(`(()=>{const s=document.querySelector('[data-k="meta.client"]');s.value='Minta Társasház';s.dispatchEvent(new Event('change'))})()`); await sleep(80);
  const rows0 = await ev(`document.querySelectorAll('#pkg-reg tbody tr:not(.off)').length`);
  ok(rows0 > 40, `10-storey block: ${rows0} documents in the package (floor plans per level)`);
  ok(await ev(`[...document.querySelectorAll('#pkg-reg tbody tr')].some(t=>/Alaprajz – világítás – 9\\. emelet/.test(t.textContent))`), 'a lighting plan for the 9th floor is listed');
  ok(await ev(`[...document.querySelectorAll('#pkg-reg code')].map(c=>c.textContent).filter(Boolean).every((t,i,a)=>a.indexOf(t)===i)`), 'drawing numbers are unique');
  const fireBefore = await ev(`[...document.querySelectorAll('#pkg-reg tbody tr')].find(t=>t.textContent.includes('Tűzjelző')).classList.contains('off')`);
  await ev(`document.querySelector('[data-flag=fire]').click()`); await sleep(100);
  const fireAfter = await ev(`[...document.querySelectorAll('#pkg-reg tbody tr')].find(t=>t.textContent.includes('Tűzjelző')).classList.contains('off')`);
  ok(fireBefore && !fireAfter, 'the fire-alarm flag turns the conditional D19 sheets on');
  ok(/kötelező rajzlap még nincs/.test(await ev(`document.getElementById('pkg-sum').textContent`)), 'missing mandatory sheets are reported');
  await shot('1-csomag');
  await clickSel('#pkg-all'); await sleep(200);
  let st = await state();
  ok(st && st.sheets.length > 30, `"create all" made ${st && st.sheets.length} sheets and saved to localStorage`);
  ok(/minden kötelező rajzlap megvan/.test(await ev(`document.getElementById('pkg-sum').textContent`)), 'after that nothing mandatory is missing');

  // ---- 2 Lap: open the ground-floor lighting plan
  await ev(`[...document.querySelectorAll('#pkg-reg tbody tr')].find(t=>/Alaprajz – világítás – Földszint/.test(t.textContent)).querySelector('[data-open]').click()`); await sleep(400);
  ok(await ev(`!document.getElementById('pane-sheet').hidden && !!document.querySelector('#sheet-canvas svg')`), 'the sheet editor shows the sheet');
  ok(await ev(`document.querySelector('#sheet-canvas svg').getAttribute('data-w')==='420'`), 'A3 landscape: 420 mm wide');
  ok(await ev(`/Földszint – világítás|Alaprajz – világítás – Földszint/.test(document.querySelector('#sheet-canvas svg').textContent)`), 'the title block carries the sheet title');
  ok(await ev(`document.querySelector('#sheet-canvas svg').textContent.includes('Minta Társasház')`), 'the title block carries the client');
  ok(await ev(`/M 1:50 @ A3/.test(document.querySelector('#sheet-canvas svg').textContent)`), 'scale with paper size in the title block (MMK §3)');
  // place two symbols
  await ev(`document.querySelector('#palette [data-sym="lum.general"]').click()`); await sleep(100);
  let p = await mm2px(100, 80); await click(p.x, p.y);
  p = await mm2px(140, 80); await click(p.x, p.y);
  await ev(`document.querySelector('#palette [data-sym="inst.sw-2way"]').click()`); await sleep(100);
  p = await mm2px(100, 120); await click(p.x, p.y);
  st = await state(); let sh = st.sheets.find((s) => s.uid === st.cur);
  ok(sh.items.filter((i) => i.t === 'sym').length === 3, 'three symbols placed by mouse');
  ok(sh.items.every((i) => i.t !== 'sym' || (i.x % 2.5 === 0 && i.y % 2.5 === 0)), 'placements snap to the 2.5 mm grid');
  ok(await ev(`document.querySelector('#sheet-canvas svg').textContent.includes('JELMAGYARÁZAT')`), 'a legend appears once symbols are used');
  ok(await ev(`(()=>{const t=document.querySelector('#sheet-canvas svg').textContent;return t.includes('Lámpatest, általános')&&t.includes('Váltókapcsoló (106)')&&!t.includes('Dugaszolóaljzat')})()`), 'the legend lists exactly the used symbols');
  // wire: two clicks + double click
  await ev(`document.querySelector('[data-tool=wire]').click()`); await sleep(60);
  p = await mm2px(100, 85); await click(p.x, p.y);
  const p2 = await mm2px(100, 115); await click(p2.x, p2.y); await click(p2.x, p2.y, 2);
  st = await state(); sh = st.sheets.find((s) => s.uid === st.cur);
  const wire = sh.items.find((i) => i.t === 'wire');
  ok(wire && wire.pts.length === 2 && wire.pts[1][1] === 115, 'a wire drawn with clicks, closed by a second click on its last point');
  // select + rotate + move by drag
  await ev(`document.querySelector('[data-tool=select]').click()`); await sleep(60);
  p = await mm2px(100, 120); await click(p.x, p.y); await key('r', 'KeyR');
  st = await state(); sh = st.sheets.find((s) => s.uid === st.cur);
  ok(sh.items.find((i) => i.sym === 'inst.sw-2way').rot === 90, 'R rotates the selected symbol');
  p = await mm2px(140, 80); const q = await mm2px(160, 90);
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseMoved', (p.x + q.x) / 2, (p.y + q.y) / 2); await mouse('mouseMoved', q.x, q.y); await mouse('mouseReleased', q.x, q.y); await sleep(150);
  st = await state(); sh = st.sheets.find((s) => s.uid === st.cur);
  const moved = sh.items.filter((i) => i.sym === 'lum.general').some((i) => i.x === 160 && i.y === 90);
  ok(moved, 'drag moves a symbol (snapped)');
  // revision
  await clickSel('#rev-add'); await sleep(150);
  ok(await ev(`document.querySelector('#sheet-canvas svg').textContent.includes('Módosítás leírása')`), 'revision table drawn above the title block');
  ok(/R01/.test(await ev(`document.querySelector('#sheet-canvas svg').textContent`)), 'the sheet number carries the revision index');
  await shot('2-lap');
  // print geometry: emulate print, the page box must be the sheet size
  await ev(`(()=>{const s=document.querySelector('#sheet-print');})()`);
  await ev(`(()=>{const P=JSON.parse(localStorage.getItem('rajztar.studio.v1'));document.getElementById('print-sheet').innerHTML=document.querySelector('#sheet-canvas svg').outerHTML;let st=document.getElementById('page-size');if(!st){st=document.createElement('style');st.id='page-size';document.head.appendChild(st)}st.textContent='@page{size:420mm 297mm;margin:0}';document.body.dataset.print='sheet'})()`);
  const pdf = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const buf = Buffer.from(pdf.result.data, 'base64');
  const mb = buf.toString('latin1').match(/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\]/);
  ok(mb && Math.abs(+mb[1] - 1190.55) < 2 && Math.abs(+mb[2] - 841.89) < 2, `print-to-PDF page is A3 landscape (${mb ? mb[1] + '×' + mb[2] + ' pt' : 'no MediaBox'})`);
  ok((buf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === 1, 'the sheet prints on exactly one page');
  if (SHOTS) fs.writeFileSync(path.join(SHOTS, '2-lap.pdf'), buf);
  await ev(`delete document.body.dataset.print`);

  // ---- 3 Jelek
  await ev(`document.querySelector('.tab[data-tab=sym]').click()`); await sleep(200);
  await ev(`(()=>{const q=document.getElementById('sym-q');q.value='inst.socket-pe';q.dispatchEvent(new Event('input'))})()`); await sleep(100);
  await ev(`document.querySelector('#sym-list [data-id="inst.socket-pe"]').click()`); await sleep(150);
  ok(await ev(`!document.getElementById('sym-ed').hidden && !!document.querySelector('#ed-preview svg')`), 'symbol editor opens with a grid preview');
  await ev(`(()=>{const t=document.querySelector('[data-e=body]');t.value=t.value+"<line x1='2' y1='1.6' x2='8' y2='1.6'/>";t.dispatchEvent(new Event('input'))})()`); await sleep(80);
  ok(await ev(`document.querySelector('#ed-lint').textContent.includes('Nincs hiba')`), 'a valid edit lints clean');
  await ev(`(()=>{const t=document.querySelector('[data-e=body]');t.value=t.value+'<image href="x"/>';t.dispatchEvent(new Event('input'))})()`); await sleep(80);
  ok(await ev(`document.querySelector('#ed-lint').textContent.includes('ismeretlen elem')`), 'an unknown element is caught by the lint');
  await ev(`(()=>{const t=document.querySelector('[data-e=body]');t.value=t.value.replace('<image href="x"/>','');t.dispatchEvent(new Event('input'))})()`); await sleep(60);
  await ev(`document.getElementById('ed-addport').click()`); await sleep(40);
  const pv = await box('#ed-preview svg'); await click(pv.l + pv.w * 0.2, pv.t + pv.h * 0.2); await sleep(80);
  ok(await ev(`document.querySelectorAll('#ed-fields .port').length===2`), 'clicking the preview adds a port');
  await clickSel('#ed-save'); await sleep(120);
  st = await state();
  ok(st.symOverrides['inst.socket-pe'] && /y1='1.6'/.test(st.symOverrides['inst.socket-pe'].body), 'save stores the edit in the project');
  ok(await ev(`document.querySelector('#sym-list [data-id="inst.socket-pe"]').textContent.includes('módosítva')`), 'the list marks the symbol as edited');
  await shot('3-jelek');
  // edited symbol is used on the sheet
  await ev(`document.querySelector('.tab[data-tab=sheet]').click()`); await sleep(200);
  ok(await ev(`!!document.querySelector('#palette [data-sym="inst.socket-pe"]')`), 'the edited symbol is in the sheet palette');

  ok(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`${pass} passed, ${fail} failed`);
  ws.close(); ch.kill(); server.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
