// WP M35 / M36: proves the browser (WebCrypto, what the iPhone web app runs) and the app (kit-core DeviceTrust, JVM)
// speak the same device request / grant. Writes tests/fixtures/device-trust-web.json:
//   - a vrg-req made in WebCrypto by a "web device", with its private key (PKCS#8) so the JVM can open a grant to it;
//   - a vrg-grant made in WebCrypto for an "app device" whose private key is also given.
// kit-core DeviceTrustTest reads it. Run: node Mobile/tests/device-trust-fixture.js   (--check: compare shapes only)
'use strict';
const { webcrypto: C } = require('crypto'), fs = require('fs'), path = require('path');
const b64u = b => Buffer.from(b).toString('base64url');
const sha = async s => Buffer.from(await C.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
const pack = o => b64u(Buffer.from(JSON.stringify(o)));

(async () => {
  const gen = () => C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const jwkPub = async k => { const j = await C.subtle.exportKey('jwk', k); return { kty: 'EC', crv: 'P-256', x: j.x, y: j.y }; };
  const pkcs8 = async k => b64u(await C.subtle.exportKey('pkcs8', k));

  // a web device asks
  const web = await gen(), webPub = await jwkPub(web.publicKey), webId = 'iphonetest01';
  const code = (await sha(`${webId}.${webPub.x}.${webPub.y}`)).slice(0, 6).toUpperCase();
  const req = { t: 'vrg-req', v: 1, id: webId, name: 'Teszt iPhone', model: 'iPhone 15', os: 'iOS 18', app: 'web 1', pub: webPub, code,
    at: '2026-11-18T19:00:00.000Z', back: 'https://example.invalid/vrg-mobile/' };

  // the browser grants to an app device (as the web owner page would)
  const app = await gen(), appPub = await jwkPub(app.publicKey);
  const eph = await gen();
  const pubKey = await C.subtle.importKey('jwk', appPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const aes = await C.subtle.deriveKey({ name: 'ECDH', public: pubKey }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = C.getRandomValues(new Uint8Array(12));
  const payload = { by: 'Teszt böngésző', at: '2026-11-18T19:01:00.000Z', token: 'teszt-token-nem-valodi' };
  const ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(payload))));
  const grant = { t: 'vrg-grant', v: 1, to: 'APPTEST00001', epub: await jwkPub(eph.publicKey), iv: b64u(iv), ct: b64u(ct), by: payload.by };

  const out = {
    about: 'Written by Mobile/tests/device-trust-fixture.js (WebCrypto). Test keys only.',
    webRequestLink: 'vrg://devices?req=' + pack(req), webPrivatePkcs8: await pkcs8(web.privateKey), webCode: code,
    appId: 'APPTEST00001', appPrivatePkcs8: await pkcs8(app.privateKey), grantLink: 'vrg://devices?grant=' + pack(grant), grantPayload: payload,
  };
  const file = path.join(__dirname, 'fixtures', 'device-trust-web.json');
  if (process.argv.includes('--check')) {
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ok = Object.keys(out).every(k => k in cur);
    console.log(ok ? 'device-trust fixture: present' : 'device-trust fixture: out of date'); process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote ' + path.relative(process.cwd(), file));
})();
