#!/usr/bin/env node
// Mobile/tests/relay-phone-link.js — the PC side of the phone relay (VRG Mobile WP M7, D-9 = A).
//
// The phone's relay (relay-core PhoneRelay.kt) lets only paired PCs in. Kódváros (CodeCity/src/36-link.js) and the
// Planner (src/07a-link.js) carry the same pairing block, vrgPhoneRelayAuth. This test:
//   * checks the two copies are the same code;
//   * runs the block with Node's WebCrypto against a fake phone relay speaking PhoneRelay's messages: the code with a
//     P-256 key, the key kept, the challenge signed in P1363 form (verified here with Node; relay-core's
//     PhoneRelayTest verifies the same form on the JVM), a forgotten pairing cleared, the PC relay's welcome ignored;
//   * drives the Planner's whole 07a-link.js with a stub socket: connectPhone(), the welcome, pair to:'relay'.
//
//   node Mobile/tests/relay-phone-link.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..');
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (c) passes++; else fails++; };

const block = file => {
  const s = fs.readFileSync(path.join(REPO, file), 'utf8').replace(/\r/g, '');
  const m = /\/\* phone-relay auth: begin \*\/\n([\s\S]*?)\n\s*\/\* phone-relay auth: end \*\//.exec(s);
  return m ? m[1].split('\n').map(l => l.trim()).join('\n') : null;
};
const city = block('CodeCity/src/36-link.js');
const planner = block('Planner/projects/varler-planner/src/07a-link.js');
ok(city && city.length > 500, 'Kódváros carries the block');
ok(planner === city, 'the Planner carries the same block');

// a browser-like global: localStorage and no prompt (the code comes from ?pair= / connectPhone)
const store = new Map();
global.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
global.navigator = { platform: 'Win32' };
// eslint-disable-next-line no-new-func
const vrgPhoneRelayAuth = new Function(city + '\nreturn vrgPhoneRelayAuth;')();

const authText = (ch, id) => `vrg-relay-auth:1:${ch}:${id}`;
const welcome = (challenge, extra) => ({ from: 'relay', type: 'welcome', payload: Object.assign({ challenge, pc: { id: 'phone1', name: 'Redmi' }, relay: 'phone' }, extra || {}) });

(async () => {
  const sent = [];
  const a = vrgPhoneRelayAuth((type, payload) => sent.push({ type, payload }), 'Kódváros', 'ABCDE-FGHJK');

  ok(a.onRelay({ from: 'relay', type: 'welcome', payload: { challenge: 'x', pc: { id: 'pc' }, pairing: true } }) === false,
    'the PC relay\'s welcome (no relay:"phone") is left alone');
  ok(await a.onRelay(welcome('c1')) === 'pair' && sent.length === 1 && sent[0].type === 'pair', 'first welcome -> pair');
  const p = sent[0].payload;
  ok(p.code === 'ABCDE-FGHJK' && /^Kódváros · Win32$/.test(p.device), 'the code and the device name');
  const pub = crypto.createPublicKey({ key: Buffer.from(p.pub, 'base64'), format: 'der', type: 'spki' });
  ok(pub.asymmetricKeyType === 'ec' && pub.asymmetricKeyDetails.namedCurve === 'prime256v1', 'the key is P-256 SPKI, as PhoneRelay requires');
  ok(a.onRelay({ from: 'relay', type: 'paired', payload: { ok: true, id: 'dev7', pc: { id: 'phone1' } } }) === true, 'paired handled');
  const kept = JSON.parse(store.get('vrg.phoneRelay.phone1'));
  ok(kept.id === 'dev7' && kept.jwk && kept.jwk.d, 'the private key is kept per phone');

  ok(await a.onRelay(welcome('c2')) === 'auth', 'next welcome -> auth, no code needed');
  const auth = sent[1].payload;
  const sig = Buffer.from(auth.sig, 'base64');
  ok(auth.id === 'dev7' && sig.length === 64, 'auth carries the id and a 64-byte P1363 signature');
  ok(crypto.verify('sha256', Buffer.from(authText('c2', 'dev7')), { key: pub, dsaEncoding: 'ieee-p1363' }, sig), 'the signature verifies over authText(challenge, id)');
  ok(!crypto.verify('sha256', Buffer.from(authText('c1', 'dev7')), { key: pub, dsaEncoding: 'ieee-p1363' }, sig), 'and only for that challenge');

  // a second tab (a new instance) finds the key in localStorage
  const sent2 = [];
  const b = vrgPhoneRelayAuth((type, payload) => sent2.push({ type, payload }), 'Planner', null);
  ok(await b.onRelay(welcome('c3')) === 'auth' && sent2[0].payload.id === 'dev7', 'another tab reuses the pairing');

  // the phone forgot this PC: trust ok:false with our id clears it; a bare refusal (no id) does not
  b.onRelay({ from: 'relay', type: 'trust', payload: { ok: false, pc: { id: 'phone1' }, reason: 'Párosítás kell' } });
  ok(store.has('vrg.phoneRelay.phone1'), 'a refusal without an id keeps the key');
  b.onRelay({ from: 'relay', type: 'trust', payload: { ok: false, id: 'dev7', pc: { id: 'phone1' } } });
  ok(!store.has('vrg.phoneRelay.phone1'), 'a refusal of our id clears the key');
  ok(await b.onRelay(welcome('c4')) === 'no-code', 'without a key and a code it waits (no prompt here)');
  b.setCode('KLMNP-QRSTU');
  ok(await b.onRelay(welcome('c5')) === 'pair' && sent2.pop().payload.code === 'KLMNP-QRSTU', 'setCode() feeds the next pairing');
  b.onRelay({ from: 'relay', type: 'paired', payload: { ok: false, reason: 'A kód hibás' } });
  ok(!store.has('vrg.phoneRelay.phone1'), 'a refused pairing stores nothing');

  // ---- the Planner's 07a-link.js, whole, with a stub socket (the link-smoke.js way) ----
  global.window = {}; global.VERSION = '2.0.0';
  global.document = { dispatchEvent() {}, addEventListener() {}, hasFocus: () => false };
  global.KeyboardEvent = function () {};
  global.state = { mode: 'select' }; global.TOOLKEYS = ['select']; global.HINTS = { select: 'Select' };
  const wsSent = [];
  global.WebSocket = function (u) {
    this.url = u; this.readyState = 1; global.__ws = this;
    this.send = s => wsSent.push(JSON.parse(s)); this.close = () => {};
    setTimeout(() => this.onopen && this.onopen(), 0);
  };
  store.clear();
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(REPO, 'Planner/projects/varler-planner/src/07a-link.js'), 'utf8'));
  const L = global.window.PLANNER_LINK;
  ok(typeof L.connectPhone === 'function', 'PLANNER_LINK.connectPhone exists');
  L.connectPhone('192.168.43.1', 'VWXYZ-23456');
  ok(global.__ws.url === 'ws://192.168.43.1:47291', 'the default port is added');
  await new Promise(r => setTimeout(r, 10));
  ok(wsSent.some(m => m.type === 'hello' && m.payload.role === 'planner'), 'the hello goes out first');
  global.__ws.onmessage({ data: JSON.stringify(Object.assign({ v: 1, seq: 1, t: 0 }, welcome('c9'))) });
  await new Promise(r => setTimeout(r, 200));
  const pair = wsSent.find(m => m.type === 'pair');
  ok(pair && pair.to === 'relay' && pair.from === 'planner' && pair.payload.code === 'VWXYZ-23456', 'pair is sent to:"relay" in the Planner\'s envelope');
  ok(L.status().peer === null, 'the welcome is not taken for a phone peer');
  L.connectPhone('ws://10.0.0.5:47295/x');
  ok(global.__ws.url === 'ws://10.0.0.5:47295', 'an address with a port and a path is cleaned');
  L.disconnect();

  console.log(fails ? `\n${fails} FAILED, ${passes} ok` : `\nall ok (${passes})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
