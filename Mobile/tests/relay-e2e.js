#!/usr/bin/env node
// Mobile/tests/relay-e2e.js — the relay, the real Kódváros page (headless Chromium), a fake Planner and
// a fake phone that speaks exactly what the Légegér app sends (core/Protocol.kt). It checks the relay's
// routing rules (to, no app-to-app, hello replay, roster, focus) and Kódváros's 36-link.js end to end.
//
//   node Mobile/tests/relay-e2e.js
//
// Needs: `npm install` in Planner/projects/varler-planner (for ws), Playwright with Chromium, and port
// 47291 free (stop START.cmd -> G first). Builds a city page of this repo into the temp folder.
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const { chromium } = require('playwright');
const CITY = path.join(os.tmpdir(), 'legeger-e2e-city.html');
execFileSync(process.execPath, [path.join(REPO, 'CodeCity/scan.js'), REPO, '--out', path.join(os.tmpdir(), 'legeger-e2e.city.json'), '--html', CITY], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

function client(name) {
  const ws = new WS('ws://127.0.0.1:47291');
  const got = [];
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) {} });
  let seq = 0;
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: name, seq: ++seq, t: Date.now(), type, payload }, to ? { to } : {})));
  return { ws, got, send, open: new Promise(r => ws.on('open', r)) };
}

(async () => {
  // a 1x1 PNG stands in for the screen: RELAY_SHOT_FILE makes the relay answer with it
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const pngFile = path.join(os.tmpdir(), 'legeger-e2e-shot.png');
  require('fs').writeFileSync(pngFile, PNG);
  const relay = spawn(process.execPath, [path.join(REPO, 'Planner/projects/varler-planner/tools/phone-relay-server.js'), '--shots'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { RELAY_SHOT_FILE: pngFile }) });
  let log = ''; relay.stdout.on('data', d => log += d); relay.stderr.on('data', d => log += d);
  await sleep(700);

  const planner = client('planner'); await planner.open;
  planner.send('hello', { role: 'planner', app: 'test', caps: ['state', 'cmd'], tools: [{ mode: 'device', key: '1', hint: 'Eszköz' }] });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  pageerror', e.message));
  await page.goto(require('url').pathToFileURL(CITY).href);
  await sleep(2500);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(300);

  const phone = client('phone'); await phone.open;
  phone.send('hello', { role: 'phone', app: 'e2e', caps: ['state', 'cmd', 'keys', 'focus', 'roster'] });
  await sleep(800);

  const hellos = phone.got.filter(m => m.type === 'hello');
  ok(hellos.some(h => h.from === 'planner' && h.payload.tools.length === 1), 'phone got the Planner hello it missed (replay)');
  const ch = hellos.find(h => h.from === 'codecity');
  ok(ch && ch.payload.tools.length >= 6, 'phone got the Kódváros hello with the lenses as tools (' + (ch ? ch.payload.tools.length : 0) + ')');
  const roster = phone.got.filter(m => m.type === 'roster').pop();
  ok(roster && ['planner', 'codecity', 'phone'].every(r => roster.payload.peers.some(p => p.role === r)), 'roster lists planner, codecity, phone');
  ok(roster && roster.payload.focus && roster.payload.focus.role === 'codecity', 'roster carries focus = codecity');
  ok(!planner.got.some(m => m.from === 'codecity'), 'Planner never hears from Kódváros (no app-to-app)');

  const before = planner.got.length;
  phone.send('cmd', { id: 'tool.select', index: 2 }, 'codecity');
  await sleep(500);
  const ack = phone.got.filter(m => m.type === 'ack' && m.from === 'codecity').pop();
  ok(ack && ack.payload.ok === true, 'tool.select to codecity acked ok');
  const st = phone.got.filter(m => m.type === 'state' && m.from === 'codecity').pop();
  ok(st && st.payload.mode === ch.payload.tools[2].mode, 'state.mode = third lens (' + (st && st.payload.mode) + ')');
  ok(planner.got.slice(before).every(m => m.type !== 'cmd'), 'a cmd addressed to codecity did not reach the Planner');

  phone.send('cmd', { id: 'edit.undo' }, 'codecity'); await sleep(300);
  const nack = phone.got.filter(m => m.type === 'ack' && m.from === 'codecity').pop();
  ok(nack && nack.payload.ok === false && /unknown/.test(nack.payload.reason), 'unknown command is nacked');

  phone.send('keys', { key: 'u' }, 'codecity'); await sleep(500);
  const st2 = phone.got.filter(m => m.type === 'state' && m.from === 'codecity').pop();
  ok(st2 && st2.payload.roads === true, 'keys "u" toggled the roads (state.roads)');

  phone.send('cmd', { id: 'time.step', d: -1 }, 'codecity'); await sleep(500);
  const st3 = phone.got.filter(m => m.type === 'state' && m.from === 'codecity').pop();
  ok(st3 && st3.payload.T === st3.payload.last - 1, 'time.step -1 moved the timeline (' + (st3 && st3.payload.T) + '/' + (st3 && st3.payload.last) + ')');

  const hashBefore = await page.evaluate(() => location.hash);
  phone.send('gesture', { kind: 'zoompan', dx: 0, dy: 0, scale: 1.6 }, 'codecity');
  phone.send('gesture', { kind: 'orbit', dx: 80, dy: 0 }, 'codecity');
  await sleep(900);
  const hashAfter = await page.evaluate(() => location.hash);
  ok(hashAfter !== hashBefore, 'gestures moved the camera (share link changed)');

  planner.send('screenshot.request', { mode: 'screen' }, 'relay'); await sleep(300);
  ok(!planner.got.some(m => m.type === 'screenshot'), 'only a phone may ask for a screenshot');
  phone.send('screenshot.request', { mode: 'window' }, 'relay'); await sleep(700);
  const shot = phone.got.filter(m => m.type === 'screenshot').pop();
  ok(shot && shot.payload.ok && /^\/shot\/[0-9a-f]{32}\.png$/.test(shot.payload.url) && /^kepernyo-.*\.png$/.test(shot.payload.name),
    'screenshot answered with an unguessable /shot/ url and a dated name');
  const png = shot ? Buffer.from(await (await fetch('http://127.0.0.1:47291' + shot.payload.url)).arrayBuffer()) : Buffer.alloc(0);
  ok(png.equals(PNG), 'the PNG downloads byte for byte (' + png.length + ' B)');
  const guess = await fetch('http://127.0.0.1:47291/shot/' + '0'.repeat(32) + '.png');
  ok(guess.status === 404, 'a guessed shot name is a 404');
  ok(!planner.got.some(m => m.type === 'screenshot'), 'the answer went to the asking phone only');

  planner.send('focus', { app: 'planner' }); await sleep(300);
  const f = phone.got.filter(m => m.type === 'focus').pop();
  ok(f && f.from === 'planner', 'Planner focus reaches the phone');
  const who = await (await fetch('http://127.0.0.1:47291/whoami')).json();
  ok(who.v === 3 && who.focus && who.focus.role === 'planner' && who.shots === true, '/whoami v3 reports focus = planner and shots on');

  planner.ws.close(); await sleep(300);
  const r2 = phone.got.filter(m => m.type === 'roster').pop();
  ok(r2 && !r2.payload.peers.some(p => p.role === 'planner') && r2.payload.focus === null, 'Planner leaving updates the roster and clears its focus');

  await browser.close(); phone.ws.close(); relay.kill();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
