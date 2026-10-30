#!/usr/bin/env node
// Mobile/tests/relay-pair.js — QR pairing (WP M2) against a real relay process: one-time codes
// (expiry, single use, wrong code), the challenge signature with a P-256 key like the Android
// Keystore's, the trust gate on screenshots, a relay restart, removal on the PC and on the phone,
// and that an unpaired phone (phone-sender.html) still controls the Planner.
//
//   node Mobile/tests/relay-pair.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses port 47391 and a temporary
// paired-phones file, so a running START.cmd -> G relay is not disturbed.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const P = require(path.join(TOOLS, 'relay-pair.js'));

const PORT = 47391;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-pair-'));
const FILE = path.join(TMP, 'relay-paired.json');
const PNG = path.join(TMP, 'shot.png');
fs.writeFileSync(PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

function startRelay() {
  const r = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(PORT), '--shots'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: FILE, RELAY_SHOT_FILE: PNG }),
  });
  r.log = ''; r.stdout.on('data', d => r.log += d); r.stderr.on('data', d => r.log += d);
  return r;
}

function get(p, method, host) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method: method || 'GET', headers: host ? { Host: host } : {} }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b }));
    });
    req.on('error', rej); req.end();
  });
}

function client(role) {
  const ws = new WS(`ws://127.0.0.1:${PORT}`);
  const got = [];
  let seq = 0;
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) { } });
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: role, seq: ++seq, t: Date.now(), type, payload }, to ? { to } : {})));
  const wait = async (type, n) => {
    for (let i = 0; i < 40; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  return { ws, got, send, wait, open: new Promise(r => ws.on('open', r)) };
}

/** A phone as VRG Mobile is one: hello, then the welcome carries the challenge. */
async function phone() {
  const c = client('phone'); await c.open;
  c.send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['state', 'cmd'] });
  c.welcome = await c.wait('welcome');
  return c;
}

const sign = (key, challenge, id) => crypto.sign('sha256', Buffer.from(P.authText(challenge, id)), { key, dsaEncoding: 'der' }).toString('base64');

(async () => {
  // ---- the pure parts ------------------------------------------------------------------------------
  console.log('relay-pair.js');
  let t = 1000;
  const pp = P.createPairing({ file: path.join(TMP, 'unit.json'), now: () => t });
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const c1 = pp.newCode();
  ok(/^[0-9a-f]{32}$/.test(c1.code), 'the code is 128-bit hex');
  t += P.CODE_TTL + 1;
  ok(!pp.pair(c1.code, 'x', pub).ok, 'an expired code is refused');
  const c2 = pp.newCode();
  ok(!pp.pair('0'.repeat(32), 'x', pub).ok, 'a wrong code is refused');
  const r2 = pp.pair(c2.code, 'Teszt telefon', pub);
  ok(r2.ok && /^[0-9a-f]{16}$/.test(r2.id), 'the right code pairs');
  ok(!pp.pair(c2.code, 'x', pub).ok, 'a code works once only');
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  ok(!pp.pair(pp.newCode().code, 'x', rsa).ok, 'a key that is not P-256 is refused');
  const ch = pp.challenge();
  ok(pp.verify(r2.id, ch, sign(key.privateKey, ch, r2.id)), 'the challenge signature verifies');
  ok(!pp.verify(r2.id, pp.challenge(), sign(key.privateKey, ch, r2.id)), 'a signature of another challenge does not');
  ok(P.isLocal('127.0.0.1', []) && P.isLocal('::ffff:192.168.1.5', ['192.168.1.5']) && !P.isLocal('192.168.1.77', ['192.168.1.5']),
    '/pair answers only this PC (loopback or its own address)');
  ok(P.isLocalHost('localhost:47291', []) && !P.isLocalHost('rebind.example:47291', []), 'and only under its own host name (no DNS rebinding)');

  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/relay-auth.json'), 'utf8'));
  ok(P.verifySig(fx.spki, P.authText(fx.challenge, fx.id), fx.sigJvm), 'a JVM SHA256withECDSA signature (as Android makes it) verifies in Node');
  ok(P.verifySig(fx.spki, fx.text, fx.sigNode), 'the fixture text is authText()');

  // ---- the relay ------------------------------------------------------------------------------------
  console.log('phone-relay-server.js');
  let relay = startRelay();
  await sleep(800);

  const page = await get('/pair');
  ok(page.status === 200 && page.body.includes('/pair/code.json'), '/pair serves the page on this PC');
  ok((await get('/pair', 'GET', 'rebind.example:47391')).status === 403, '/pair refuses a foreign Host header');
  const code = JSON.parse((await get('/pair/code.json')).body);
  ok(code.ok && /^vrg:\/\/pair\?ws=ws%3A%2F%2F.+&c=[0-9a-f]{32}&n=/.test(code.link), 'the QR link is vrg://pair?ws=…&c=…&n=… (' + (code.link || '').slice(0, 40) + '…)');
  ok(code.svg && code.svg.startsWith('<svg'), 'the QR is drawn locally (the Planner\'s encoder)');
  ok(/parosito kod: [0-9a-f]{32}/.test(relay.log), 'the code is printed on the relay console');
  const theCode = /&c=([0-9a-f]{32})/.exec(code.link)[1];

  // an unpaired phone: controls the Planner as before, gets no screenshot
  const planner = client('planner'); await planner.open;
  planner.send('hello', { role: 'planner', app: 'test', caps: ['state', 'cmd'] });
  const a = await phone();
  ok(a.welcome && /^[0-9a-f]{32}$/.test(a.welcome.payload.challenge) && a.welcome.payload.pc.id, 'a phone hello is answered with the challenge and the PC');
  a.send('cmd', { id: 'tool.device' });
  await sleep(200);
  ok(planner.got.some(m => m.type === 'cmd' && m.payload.id === 'tool.device'), 'an unpaired phone still controls the Planner');
  a.send('screenshot.request', { mode: 'screen' }, 'relay');
  let shot = await a.wait('screenshot');
  ok(shot && shot.payload.ok === false && shot.payload.trusted === false, 'an untrusted phone asking for a screenshot is refused');
  ok(!planner.got.some(m => m.type === 'welcome'), 'the welcome goes to phones only');

  // pairing
  a.send('pair', { code: '1'.repeat(32), device: 'Teszt', pub }, 'relay');
  let paired = await a.wait('paired');
  ok(paired && paired.payload.ok === false, 'a wrong code is refused by the relay');
  a.send('pair', { code: theCode, device: 'Teszt telefon', pub }, 'relay');
  paired = await a.wait('paired', 2);
  ok(paired && paired.payload.ok === true && paired.payload.pc.id === a.welcome.payload.pc.id, 'the right code pairs: ' + (paired && paired.payload.id));
  const id = paired.payload.id;
  a.send('screenshot.request', { mode: 'screen' }, 'relay');
  shot = await a.wait('screenshot', 2);
  ok(shot && shot.payload.ok === true, 'the paired phone gets its screenshot');
  ok(JSON.parse(fs.readFileSync(FILE, 'utf8')).phones.some(p => p.id === id && p.pub === pub), 'the pairing is stored in the paired-phones file');
  const b0 = await phone();
  b0.send('pair', { code: theCode, device: 'Masik', pub }, 'relay');
  ok((await b0.wait('paired')).payload.ok === false, 'the used code does not pair a second phone');
  b0.ws.close();

  // a later connect proves the key
  const b = await phone();
  b.send('auth', { id, sig: sign(key.privateKey, b.welcome.payload.challenge, id) }, 'relay');
  let trust = await b.wait('trust');
  ok(trust && trust.payload.ok === true, 'a later connect is trusted after signing the challenge');
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const c = await phone();
  c.send('auth', { id, sig: sign(other.privateKey, c.welcome.payload.challenge, id) }, 'relay');
  trust = await c.wait('trust');
  ok(trust && trust.payload.ok === false, 'another key with the same id is not trusted');
  c.send('screenshot.request', { mode: 'screen' }, 'relay');
  ok((await c.wait('screenshot')).payload.ok === false, '… and gets no screenshot');
  c.send('auth', { id, sig: sign(key.privateKey, c.welcome.payload.challenge, id) }, 'relay');
  ok((await c.wait('trust', 2)).payload.ok === false, 'a challenge is good for one try only');
  [a, b, c, planner].forEach(x => x.ws.close());

  // a relay restart keeps the pairing
  relay.kill(); await sleep(400);
  relay = startRelay(); await sleep(800);
  const d = await phone();
  d.send('auth', { id, sig: sign(key.privateKey, d.welcome.payload.challenge, id) }, 'relay');
  ok((await d.wait('trust')).payload.ok === true, 'after a relay restart the phone is still trusted');
  ok(JSON.parse((await get('/pair/list.json')).body).phones.length === 1, 'the page lists the paired phone');

  // removal on the PC: the live connection loses its trust at once, and the next auth fails
  ok(JSON.parse((await get('/pair/remove?id=' + id, 'POST')).body).ok, 'the PC removes the pairing');
  ok((await d.wait('trust', 2)).payload.ok === false, 'the connected phone is told it is no longer trusted');
  const e = await phone();
  e.send('auth', { id, sig: sign(key.privateKey, e.welcome.payload.challenge, id) }, 'relay');
  ok((await e.wait('trust')).payload.ok === false, 'after removal on the PC the phone is not trusted');

  // removal on the phone
  const code2 = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get('/pair/code.json')).body).link)[1];
  e.send('pair', { code: code2, device: 'Teszt telefon', pub }, 'relay');
  const id2 = (await e.wait('paired')).payload.id;
  e.send('unpair', { id: id2 }, 'relay');
  await sleep(200);
  ok(JSON.parse((await get('/pair/list.json')).body).phones.length === 0, 'the phone removes its own pairing');
  const f = await phone();
  f.send('unpair', { id: 'nincs' }, 'relay');
  f.send('auth', { id: id2, sig: sign(key.privateKey, f.welcome.payload.challenge, id2) }, 'relay');
  ok((await f.wait('trust')).payload.ok === false, 'after removal on the phone it is not trusted');
  [d, e, f].forEach(x => x.ws.close());

  relay.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
