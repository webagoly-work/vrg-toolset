#!/usr/bin/env node
// node Map/test/shot.js <url> <out.png> [--w=1100] [--h=760] [--dark] [--mobile] [--wait=<js expr>] [--run=<js>] [--eval=<js>]
// A headless screenshot of the VRG Térkép for visual checks (REFINE.md): waits for the expression
// (default: the map has loaded), runs --run, waits for the map to settle, writes the PNG, prints --eval's JSON.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const MAIN = /[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/.test(REPO) ? path.resolve(REPO, '..', '..', '..') : REPO;
const rel = path.join('..', 'tools', 'chrome-headless-shell', 'chrome-headless-shell.exe');
const CHROME = [process.env.CHROME, path.join(REPO, rel), path.join(MAIN, rel)].find(p => p && fs.existsSync(p));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const [url, out] = args.filter(a => !a.startsWith('--'));
if (!url || !out || !CHROME) { console.error('usage: shot.js <url> <out.png> [...]' + (CHROME ? '' : ' (no chrome-headless-shell)')); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const mobile = args.includes('--mobile');
  const W = Number(opt('w', mobile ? 390 : 1100)), H = Number(opt('h', mobile ? 800 : 760));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-shot-'));
  const proc = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--window-size=${W},${H}`, `--user-data-dir=${path.join(tmp, 'p')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => { let e = ''; const t = setTimeout(() => rej(new Error('no chrome')), 30000);
    proc.stderr.on('data', d => { e += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(e); if (m) { clearTimeout(t); res(m[1]); } }); });
  const list = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/list`)).json();
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { const w = wait.get(m.id); wait.delete(m.id); m.error ? w.j(new Error(m.error.message)) : w.r(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; wait.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: args.includes('--dark') ? 'dark' : 'light' }] });
    await send('Page.navigate', { url });
    const ready = opt('wait', `!!(window.vrgMap && vrgMap.map.loaded())`);
    let ok = false; for (let i = 0; i < 600 && !ok; i++) { await sleep(100); try { ok = await ev(ready); } catch { /* loading */ } }
    if (!ok) console.error('wait expression never true: ' + ready);
    if (opt('run')) await ev(`(async () => { ${opt('run')} })()`);
    await ev(`new Promise(r => { const m = vrgMap.map; let done = false; const fin = () => { if (!done) { done = true; setTimeout(r, 400); } }; m.once('idle', fin); m.triggerRepaint(); setTimeout(fin, 15000); })`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    if (opt('eval')) console.log(JSON.stringify(await ev(opt('eval')), null, 1));
    if (errors.length) console.log('PAGE ERRORS: ' + JSON.stringify(errors));
    console.log('wrote ' + out);
  } finally { try { ws.close(); } catch { /* */ } proc.kill(); await sleep(200); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } }
})().catch(e => { console.error(e.message); process.exit(1); });
