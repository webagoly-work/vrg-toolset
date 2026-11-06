#!/usr/bin/env node
// city-touch.js — VRG Mobile M5: the WebView's touch adapter (feature-city/src/main/assets/city-touch.js) in
// headless Chrome with real touch input (DevTools Input.dispatchTouchEvent, touch emulation on).
//
//   node Mobile/tests/city-touch.js [city.html]
//
// Part 1, a stand-in page: exactly which mouse gestures the adapter makes of each touch gesture (tap -> one
// click, drag -> left drag, a few px of wobble -> still a tap, two fingers -> right drag + wheel, a third
// finger, a finger starting on a button -> left alone, pointercancel -> no click).
// Part 2, a real Kódváros page (the given city.html, or one built from this repo with CodeCity/scan.js
// --html): one finger orbits, a pinch zooms, two fingers pan, read back from the page's own #cam= share link,
// and the page throws nothing.
// Needs chrome-headless-shell (H:\VRG\Full\tools, or $CHROME) and, for part 2 without an argument, Vendor/three.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ADAPTER = fs.readFileSync(path.join(REPO, 'Mobile', 'android', 'feature-city', 'src', 'main', 'assets', 'city-touch.js'), 'utf8');
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
let common = REPO;
try { common = path.dirname(path.resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' }).trim())); } catch { /* not a repo */ }
const CHROME = [process.env.CHROME, path.join(REPO, rel), path.join(common, rel)].find(p => p && fs.existsSync(p));

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-city-touch-'));
const url = f => 'file:///' + f.replace(/\\/g, '/');

// ---- a minimal DevTools client (Node's own WebSocket) -------------------------------------------------
async function launch() {
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', '--window-size=900,700', `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const t = setTimeout(() => reject(new Error('Chrome did not start: ' + err.slice(-300))), 30000);
    proc.stderr.on('data', d => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map(), errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const go = async (u, ready) => {
    await send('Page.navigate', { url: u });
    for (let i = 0; i < 300; i++) { await sleep(100); try { if (await evaluate(ready)) return true; } catch { /* still loading */ } }
    return false;
  };
  // touch: each step is the list of fingers down after it, [[id, x, y], ...]
  const touch = async steps => {
    let prev = [];
    for (const now of steps) {
      const ids = new Set(now.map(p => p[0])), before = new Set(prev.map(p => p[0]));
      const pts = now.map(([id, x, y]) => ({ id, x, y }));
      let type = 'touchMove';
      if (now.some(p => !before.has(p[0]))) type = 'touchStart';
      else if (prev.some(p => !ids.has(p[0]))) type = 'touchEnd';
      await send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      prev = now;
      await sleep(16);
    }
    if (prev.length) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(30);
  };
  return { proc, ws, send, evaluate, go, touch, errors };
}

// a drag from (x0,y0) by (dx,dy) in n steps, with the given extra fingers held still
const path1 = (id, x0, y0, dx, dy, n = 8) => Array.from({ length: n + 1 }, (_, i) => [[id, x0 + dx * i / n, y0 + dy * i / n]]);

(async () => {
  if (!CHROME) { console.log('city-touch: SKIPPED, chrome-headless-shell not found (set CHROME)'); process.exit(0); }
  const c = await launch();
  try {
    // ---- part 1: the stand-in page ------------------------------------------------------------------
    const stub = path.join(tmp, 'stub.html');
    fs.writeFileSync(stub, `<!doctype html><meta name=viewport content="width=device-width">
<style>html,body{margin:0;height:100%}#gl{position:fixed;inset:0;width:100%;height:100%;touch-action:none}#btn{position:fixed;left:10px;top:10px;width:80px;height:40px}</style>
<canvas id=gl></canvas><button id=btn>gomb</button>
<script>
window.log = [];
const cv = document.getElementById('gl');
for (const t of ['pointerdown', 'pointermove', 'pointerup'])
  cv.addEventListener(t, e => { log.push([t.slice(7), e.pointerType, e.button, Math.round(e.clientX), Math.round(e.clientY)]); if (t === 'pointerdown') cv.setPointerCapture(e.pointerId); });
cv.addEventListener('wheel', e => log.push(['wheel', Math.round(e.deltaY)]));
document.getElementById('btn').addEventListener('pointerdown', e => log.push(['button', e.pointerType]));
</script>`);
    ok(await c.go(url(stub), `!!window.log`), 'the stand-in page loads');
    await c.evaluate(ADAPTER);
    ok(await c.evaluate('!!window.__vrgTouch'), 'the adapter is in');
    await c.evaluate(ADAPTER);
    const reset = () => c.evaluate('log.length = 0');
    const log = () => c.evaluate('log');
    const kinds = l => l.map(e => e[0] === 'wheel' ? 'wheel' : `${e[0]}:${e[1]}:${e[2]}`);

    await reset(); await c.touch([[[1, 400, 300]], []]);
    let l = await log();
    ok(JSON.stringify(kinds(l)) === JSON.stringify(['down:mouse:0', 'up:mouse:0']) && l[0][3] === 400 && l[1][4] === 300, `a tap is one click at its place: ${JSON.stringify(l)}`);
    ok((await c.evaluate('window.__vrgTouch.version')) === 1, 'injecting twice keeps one adapter');

    await reset(); await c.touch([[[1, 400, 300]], [[1, 403, 302]], [[1, 404, 303]], []]);
    l = await log();
    ok(JSON.stringify(kinds(l)) === JSON.stringify(['down:mouse:0', 'up:mouse:0']) && l[0][3] === 400, `a 5 px wobble is still a tap at the first place: ${JSON.stringify(l)}`);

    await reset(); await c.touch([...path1(1, 400, 300, 120, 0), []]);
    l = await log();
    ok(l[0][0] === 'down' && l[0][2] === 0 && l[0][3] === 400, 'a drag starts at the finger\'s first place');
    ok(kinds(l).filter(k => k === 'move:mouse:0').length >= 6 && l.at(-1)[0] === 'up' && l.at(-1)[3] === 520, `a drag is a left drag to its end: ${JSON.stringify(l.at(-1))}`);
    ok(!l.some(e => e[1] === 'touch'), 'no raw touch pointer reaches the canvas');

    // pinch out: two fingers 100 -> 300 px apart around (450, 350)
    await reset();
    const pinch = [[[1, 400, 350]], [[1, 400, 350], [2, 500, 350]]];
    for (let i = 1; i <= 10; i++) pinch.push([[1, 400 - 10 * i, 350], [2, 500 + 10 * i, 350]]);
    pinch.push([[2, 600, 350]], []);
    await c.touch(pinch);
    l = await log();
    const wheelSum = l.filter(e => e[0] === 'wheel').reduce((s, e) => s + e[1], 0);
    ok(kinds(l)[0] === 'down:mouse:2' && l[0][3] === 450, `two fingers start a right drag at their midpoint: ${JSON.stringify(l[0])}`);
    ok(Math.abs(wheelSum - (-Math.log(3) / 0.001)) < 60, `the pinch's wheel steps add up to the distance ratio (3x -> ${wheelSum}, want ~${Math.round(-Math.log(3) / 0.001)})`);
    ok(l.filter(e => e[0] === 'up').length === 1 && l.at(-1)[0] === 'up' && l.at(-1)[2] === 2, 'one right-button up at the end, nothing after the first finger lifts');
    ok(l.filter(e => e[0] === 'move').reduce((s, e, i, a) => s + (i ? Math.abs(e[3] - a[i - 1][3]) : 0), 0) >= 4, 'a still pinch still moves 4 px (no context menu)');

    // two-finger pan: both fingers down by 100 px
    await reset();
    const pan = [[[1, 400, 300]], [[1, 400, 300], [2, 500, 300]]];
    for (let i = 1; i <= 10; i++) pan.push([[1, 400, 300 + 10 * i], [2, 500, 300 + 10 * i]]);
    pan.push([]);
    await c.touch(pan);
    l = await log();
    ok(l.filter(e => e[0] === 'wheel').length === 0, 'a parallel two-finger drag does not zoom');
    const downs = l.filter(e => e[0] === 'down'), lastMove = l.filter(e => e[0] === 'move').at(-1);
    ok(downs.length === 1 && downs[0][2] === 2 && lastMove[4] === 400 && lastMove[3] === 450, `it is a right drag by 100 px: ${JSON.stringify(lastMove)}`);

    // drag first, then a second finger: the left drag ends (no click), the right drag takes over
    await reset();
    const late = path1(1, 300, 300, 60, 0);
    late.push([[1, 360, 300], [2, 460, 300]], [[1, 360, 320], [2, 460, 320]], []);
    await c.touch(late);
    l = await log();
    ok(JSON.stringify(kinds(l).filter(k => !k.startsWith('move'))) === JSON.stringify(['down:mouse:0', 'up:mouse:0', 'down:mouse:2', 'up:mouse:2']), `orbit, then pan: ${JSON.stringify(kinds(l).filter(k => !k.startsWith('move')))}`);

    // a third finger is ignored; a finger on the button is left alone
    await reset();
    await c.touch([[[1, 400, 300]], [[1, 400, 300], [2, 500, 300]], [[1, 400, 300], [2, 500, 300], [3, 450, 400]], [[1, 400, 310], [2, 500, 310], [3, 450, 420]], []]);
    l = await log();
    ok(l.filter(e => e[0] === 'down').length === 1 && !l.some(e => e[1] === 'touch'), 'a third finger adds nothing');
    await reset(); await c.touch([[[1, 40, 25]], []]);
    l = await log();
    ok(l.length >= 1 && l.every(e => e[0] === 'button') && l[0][1] === 'touch', `a finger on a button stays a touch on the button: ${JSON.stringify(l)}`);

    // pointercancel (Android takes the gesture away): no click
    await reset();
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 400, y: 300 }] });
    await sleep(20);
    await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await sleep(30);
    l = await log();
    ok(!l.some(e => e[0] === 'up' || e[0] === 'down'), `a cancelled touch clicks nothing: ${JSON.stringify(l)}`);
    ok(c.errors.length === 0, `the stand-in page threw nothing: ${c.errors.join(' | ')}`);

    // ---- part 2: a real Kódváros page ---------------------------------------------------------------
    let page = process.argv[2] && path.resolve(process.argv[2]);
    if (!page) {
      if (!fs.existsSync(path.join(REPO, 'Vendor', 'three', 'package.json'))) {
        console.log('  part 2 SKIPPED: no Vendor/three (node tools/fetch-vendor.js three) and no city.html given');
      } else {
        page = path.join(tmp, 'city.html');
        execFileSync(process.execPath, [path.join(REPO, 'CodeCity', 'scan.js'), REPO, '--out', path.join(tmp, 'city.json'), '--html', page], { stdio: 'ignore' });
      }
    }
    if (page) {
      c.errors.length = 0;
      ok(await c.go(url(page), `!!(window.CITY && document.getElementById('gl') && document.getElementById('gl').width > 0)`), 'the city page loads');
      await sleep(2500);
      const pageErrors = c.errors.splice(0);
      await c.evaluate(ADAPTER);
      const box = await c.evaluate(`(() => { const r = document.getElementById('gl').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
      const cx = Math.round(box[0] + box[2] / 2), cy = Math.round(box[1] + box[3] / 2);
      const cam = async () => { await sleep(500); const q = new URLSearchParams((await c.evaluate('location.hash')).slice(1)); return (q.get('cam') || '').split(',').map(Number); };

      await c.touch([...path1(1, cx, cy, 120, 0), []]);
      const a = await cam();
      ok(a.length === 5, `one finger moves the camera and the share link has it: ${a}`);
      await c.touch([...path1(1, cx, cy, 120, 0), []]);
      const a2 = await cam();
      ok(Math.abs((a[2] - a2[2]) - 0.6) < 0.05 && a2[4] === a[4], `one finger orbits (theta ${a[2]} -> ${a2[2]}, r stays ${a2[4]})`);

      const pinch2 = [[[1, cx - 50, cy]], [[1, cx - 50, cy], [2, cx + 50, cy]]];
      for (let i = 1; i <= 10; i++) pinch2.push([[1, cx - 50 - 10 * i, cy], [2, cx + 50 + 10 * i, cy]]);
      pinch2.push([]);
      await c.touch(pinch2);
      const b = await cam();
      ok(b[4] / a2[4] > 0.25 && b[4] / a2[4] < 0.45 && Math.abs(b[2] - a2[2]) < 1e-6, `a 3x pinch zooms in about 3x (r ${a2[4]} -> ${b[4]}), no orbit`);

      const pan2 = [[[1, cx - 50, cy]], [[1, cx - 50, cy], [2, cx + 50, cy]]];
      for (let i = 1; i <= 10; i++) pan2.push([[1, cx - 50, cy + 10 * i], [2, cx + 50, cy + 10 * i]]);
      pan2.push([]);
      await c.touch(pan2);
      const p = await cam();
      ok(Math.hypot(p[0] - b[0], p[1] - b[1]) > 1 && Math.abs(p[4] / b[4] - 1) < 0.02 && Math.abs(p[2] - b[2]) < 1e-6, `two fingers pan (target ${b[0]},${b[1]} -> ${p[0]},${p[1]}), r and theta stay`);

      await c.touch([[[1, cx, cy]], []]);
      await sleep(300);
      const t = await cam();
      ok(Math.abs(t[2] - p[2]) < 1e-6 && t[4] === p[4], 'a tap does not move the camera');
      ok(c.errors.length === 0, `the city threw nothing under touch: ${c.errors.join(' | ')}`);
      if (pageErrors.length) console.log(`  note: the page threw ${pageErrors.length} error(s) before the adapter was in: ${pageErrors[0].split('\n')[0]}`);
    }
  } catch (e) {
    fail++; console.log('  FAIL ' + (e.stack || e));
  } finally {
    c.ws.close(); c.proc.kill();
    await sleep(300);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Chrome still letting go of its profile */ }
  }
  console.log(`city-touch: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
