// The signed allowed list: verify with the embedded public key, find "me", gate layer 1.
// Honest scope: this decides what the Kapu opens. The real locks are GitHub and OneDrive.

const KP_ACCESS_SCHEMA = 'vrg-hub-access/1';
const KP_GATE_NO = 'Nem szerepelsz az engedélyezett listán — kérd a tulajdonost.';
const KP_GATE_BADSIG = 'A hozzáférési lista aláírása érvénytelen — a programok zárva maradnak.';
const KP_ACCESS_NOTE = 'A valódi zár a GitHub és a OneDrive jogosultság; ez a lista azt mutatja, kinek nyit a Kapu.';

// Canonical JSON: keys sorted at every level, no whitespace. The one form that gets signed
// (tools/hub-sign.js) and verified (the page) — both use this function.
function kpCanon(v) {
  if (Array.isArray(v)) return '[' + v.map(kpCanon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kpCanon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

const kpAccess = { state: 'none', valid: false, me: null, role: null, people: 0 };

function kpB64Bytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// -> { state: 'none'|'unsigned'|'invalid'|'nocrypto'|'valid', valid, me, role, people }
async function kpAccessCheck(access, pubkey, login) {
  const r = { state: 'none', valid: false, me: null, role: null, people: 0 };
  if (!access || access.schema !== KP_ACCESS_SCHEMA || !access.body) return r;
  if (!access.sig || !pubkey) return Object.assign(r, { state: 'unsigned' });
  const subtle = typeof crypto !== 'undefined' && crypto.subtle;
  if (!subtle) return Object.assign(r, { state: 'nocrypto' });
  let ok = false;
  try {
    const key = await subtle.importKey('jwk', { kty: pubkey.kty, crv: pubkey.crv, x: pubkey.x, y: pubkey.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, kpB64Bytes(access.sig), new TextEncoder().encode(kpCanon(access.body)));
  } catch (e) { ok = false; }
  if (!ok) return Object.assign(r, { state: 'invalid' });
  const people = access.body.people || [];
  const me = login ? people.find(p => String(p.github || '').toLowerCase() === String(login).toLowerCase()) || null : null;
  return { state: 'valid', valid: true, me, role: me ? me.role : null, people: people.length };
}

// may this browser's user open layer-1 things?
const kpL1Open = () => !!(kpAccess.valid && kpAccess.me && (kpAccess.me.layers || []).includes('L1'));
function kpL1Why() {
  if (kpAccess.state === 'invalid') return KP_GATE_BADSIG;
  if (kpAccess.state !== 'valid') return 'Még nincs aláírt engedélyezett lista — a programok zárva maradnak.';
  if (!kpGh.login) return 'Előbb lépj be: GitHub';
  return KP_GATE_NO;
}

async function kpAccessRefresh() {
  Object.assign(kpAccess, await kpAccessCheck(kpData.access, kpData.pubkey, kpGh.login));
}

if (typeof module !== 'undefined') module.exports = { kpCanon, kpAccessCheck, kpB64Bytes, KP_GATE_NO, KP_GATE_BADSIG };
