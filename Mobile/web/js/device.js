// Eszköz (WP M36): the iPhone's side of VRG Mobile's device approval (WP M35, kit-core DeviceTrust.kt). The browser
// makes the same request and opens the same grant as the Android app: a P-256 key (WebCrypto, kept in IndexedDB as a
// non-extractable key), a vrg-req with a 6-character code (SHA-256 over id + key), a vrg-grant opened with ECDH +
// AES-GCM (the raw ECDH secret is the AES key, a 12-byte IV, a 128-bit tag). Mobile/tests/device-trust-fixture.js and
// DeviceTrustTest prove the two sides agree; Mobile/tests/web-app.js drives this file in a browser.

const C = globalThis.crypto;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = u8 => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const packJson = o => b64u(enc.encode(JSON.stringify(o)));
const unpackJson = s => JSON.parse(dec.decode(unb64u(s)));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

// ---- storage: IndexedDB for the key (a CryptoKey clones there), localStorage for the small things ------------------
function idb() {
  return new Promise((ok, bad) => {
    const r = indexedDB.open('vrg-mobile-web', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  });
}
async function kvGet(k) { const db = await idb(); return new Promise(ok => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); }); }
async function kvSet(k, v) { const db = await idb(); return new Promise((ok, bad) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = () => bad(t.error); }); }

const LS = {
  get: k => { try { return localStorage.getItem('vrg.' + k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem('vrg.' + k) : localStorage.setItem('vrg.' + k, v); } catch (e) { /* private mode */ } },
};
export { LS };

/** This browser's device id: 12 letters and digits, made once. */
export function deviceId() {
  let id = LS.get('device.id');
  if (!id) { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = C.getRandomValues(new Uint8Array(12)); id = [...r].map(x => a[x % a.length]).join(''); LS.set('device.id', id); }
  return id;
}
export const deviceName = () => LS.get('device.name') || (/iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : 'Böngésző');
export const setDeviceName = n => LS.set('device.name', String(n || '').trim().slice(0, 40));
export function model() {
  const ua = navigator.userAgent, ios = ua.match(/OS (\d+)[_.](\d+)/);
  if (/iPhone/.test(ua)) return { model: 'iPhone', os: ios ? `iOS ${ios[1]}.${ios[2]}` : 'iOS' };
  if (/iPad/.test(ua)) return { model: 'iPad', os: ios ? `iPadOS ${ios[1]}.${ios[2]}` : 'iPadOS' };
  return { model: (navigator.platform || 'web').slice(0, 30), os: 'web' };
}

async function keyPair() {
  const saved = await kvGet('device.key').catch(() => undefined);
  if (saved && saved.priv && saved.pub) return saved;
  const kp = await C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const j = await C.subtle.exportKey('jwk', kp.publicKey);
  const rec = { priv: kp.privateKey, pub: { kty: 'EC', crv: 'P-256', x: j.x, y: j.y } };
  await kvSet('device.key', rec);
  return rec;
}

export async function codeOf(id, pub) { return hex(await C.subtle.digest('SHA-256', enc.encode(`${id}.${pub.x}.${pub.y}`))).slice(0, 6).toUpperCase(); }

/** The request: the object, its 6-character code, and the link the owner's phone scans (vrg://devices?req=…). */
export async function makeRequest(appVersion) {
  const { pub } = await keyPair(), id = deviceId(), m = model();
  const back = location.origin + location.pathname;
  const req = { t: 'vrg-req', v: 1, id, name: deviceName(), model: m.model, os: m.os, app: 'web ' + appVersion, pub, code: await codeOf(id, pub), at: new Date().toISOString(), back };
  return { req, code: req.code, link: 'vrg://devices?req=' + packJson(req) };
}

/** A grant out of a link (…#grant=…, vrg://devices?grant=…) or a whole pasted message. */
export function readGrant(text) {
  const s = String(text || '').trim(), m = s.match(/grant=([A-Za-z0-9_-]{40,})/) || s.match(/([A-Za-z0-9_-]{80,})/);
  if (!m) throw new Error('Nem találok engedélyt a szövegben.');
  const g = unpackJson(m[1]);
  if (g.t !== 'vrg-grant') throw new Error('Ez nem VRG eszköz-engedély.');
  return g;
}

/** Opens a grant made for this browser; keeps a token in it (only if the owner chose to hand it over). */
export async function acceptGrant(g) {
  if (String(g.to).replace(/[^A-Za-z0-9]/g, '').toUpperCase() !== deviceId().toUpperCase()) throw new Error('Ez az engedély egy másik eszköznek szól (vagy a kezdőképernyőre tett appnak: ott illeszd be).');
  const { priv } = await keyPair();
  const epub = await C.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: g.epub.x, y: g.epub.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const key = await C.subtle.deriveKey({ name: 'ECDH', public: epub }, priv, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = JSON.parse(dec.decode(await C.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(g.iv) }, key, unb64u(g.ct))));
  if (plain.token) LS.set('gh.token', plain.token);
  LS.set('device.granted', `${plain.by || g.by}, ${String(plain.at || '').slice(0, 10)}` + (plain.token ? ' (írási joggal)' : ''));
  return plain;
}

export const sameId = (a, b) => String(a).replace(/[^A-Za-z0-9]/g, '').toUpperCase() === String(b).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
