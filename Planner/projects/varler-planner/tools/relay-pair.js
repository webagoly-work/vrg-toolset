// ==========================================================================
// relay-pair.js — QR pairing for phone-relay-server.js (VRG Mobile, WP M2)
//
// Makes a phone TRUSTED. Until now any device on the WiFi could say hello as a phone; the abilities
// that act on this PC (screenshots now, and later ports / launch / drop) are served only to a phone
// that has paired, and that proves it on every connect.
//
//   1. The PC opens http://localhost:<port>/pair. The page shows a QR:
//        vrg://pair?ws=ws://<lan-ip>:<port>&c=<code>&n=<pc name>
//      The code is 128-bit random, valid for 2 minutes, single use, printed on the relay console.
//      /pair answers only requests from this PC itself (loopback or one of its own addresses), so
//      the code is only ever on the PC's own screen.
//   2. The phone connects, says hello, and gets {from:'relay', type:'welcome', payload:{challenge, pc}}.
//      It sends {type:'pair', to:'relay', payload:{code, device, pub}}: pub is a P-256 public key it
//      made in the Android Keystore (X.509 SubjectPublicKeyInfo, base64).
//   3. The relay checks the code, stores {id, device, pub, added} in a file OUTSIDE the repo
//      (%LOCALAPPDATA%\VRG\relay-paired.json; RELAY_PAIRED_FILE overrides) and answers
//      {type:'paired', payload:{ok, id, pc}}.
//   4. On later connects the phone answers the welcome's challenge with
//      {type:'auth', to:'relay', payload:{id, sig}}: an ECDSA P-256 / SHA-256 signature (DER, base64)
//      of authText(challenge, id). The relay answers {type:'trust', payload:{ok, id, pc}}.
//      A key that is not on the list stays an ordinary, untrusted phone.
//
// The functions below that take no server state are exported for Mobile/tests/relay-pair.js.
// ==========================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CODE_TTL = 2 * 60 * 1000;

/** What the phone signs. The prefix keeps a signature from meaning anything anywhere else. */
function authText(challenge, id) { return `vrg-relay-auth:1:${challenge}:${id}`; }

function defaultFile() {
  if (process.env.RELAY_PAIRED_FILE) return process.env.RELAY_PAIRED_FILE;
  const base = process.platform === 'win32'
    ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
    : (process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'));
  return path.join(base, 'VRG', 'relay-paired.json');
}

/** True when the request comes from this PC: loopback, or one of the PC's own addresses. */
function isLocal(ip, ownAddresses) {
  const a = String(ip || '').replace(/^::ffff:/, '');
  if (a === '127.0.0.1' || a === '::1' || a.startsWith('127.')) return true;
  return (ownAddresses || []).includes(a);
}

/**
 * The Host header must name this PC too. Without it a web page on a domain that resolves to
 * 127.0.0.1 (DNS rebinding) would be same-origin with /pair and could read a code.
 */
function isLocalHost(hostHeader, ownAddresses) {
  const h = String(hostHeader || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '::1' || isLocal(h, ownAddresses);
}

/** A base64 SPKI public key, or null when it is not a P-256 EC key. */
function parsePub(b64) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(String(b64), 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') return null;
    return key;
  } catch (e) { return null; }
}

function verifySig(pubB64, text, sigB64) {
  const key = parsePub(pubB64);
  if (!key || typeof sigB64 !== 'string') return false;
  try {
    return crypto.verify('sha256', Buffer.from(text, 'utf8'), { key, dsaEncoding: 'der' }, Buffer.from(sigB64, 'base64'));
  } catch (e) { return false; }
}

function cleanName(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 60); }

/**
 * The pairing state: one-time codes in memory, paired phones in the file.
 * `now` is injectable so the tests can step over the 2 minutes.
 */
function createPairing(opts) {
  opts = opts || {};
  const file = opts.file || defaultFile();
  const now = opts.now || Date.now;
  const ttl = opts.ttl || CODE_TTL;
  const codes = new Map();                 // code -> expires

  let db = { pc: null, phones: [] };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
  if (!db.pc || !db.pc.id) db.pc = { id: crypto.randomBytes(8).toString('hex'), name: os.hostname() };
  if (!Array.isArray(db.phones)) db.phones = [];

  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, file);
  }
  if (!fs.existsSync(file)) save();

  function sweep() { const t = now(); for (const [c, exp] of codes) if (exp <= t) codes.delete(c); }

  return {
    file,
    pc() { return { id: db.pc.id, name: db.pc.name }; },

    newCode() {
      sweep();
      const code = crypto.randomBytes(16).toString('hex');
      codes.set(code, now() + ttl);
      return { code, expires: now() + ttl, ttl };
    },

    /** Single use: a code that checks out is gone afterwards; so is one that has expired. */
    consume(code) {
      sweep();
      if (typeof code !== 'string' || !codes.has(code)) return false;
      codes.delete(code);
      return true;
    },

    /** -> {ok, id} | {ok:false, reason}. The code is spent even when the key is refused. */
    pair(code, device, pubB64) {
      if (!this.consume(code)) return { ok: false, reason: 'A kód hibás vagy lejárt. Olvasd be újra a PC képernyőjéről.' };
      if (!parsePub(pubB64)) return { ok: false, reason: 'A telefon kulcsa nem P-256.' };
      const existing = db.phones.find(p => p.pub === pubB64);
      if (existing) { existing.device = cleanName(device) || existing.device; save(); return { ok: true, id: existing.id }; }
      const id = crypto.randomBytes(8).toString('hex');
      db.phones.push({ id, device: cleanName(device) || 'telefon', pub: pubB64, added: new Date(now()).toISOString() });
      save();
      return { ok: true, id };
    },

    challenge() { return crypto.randomBytes(16).toString('hex'); },

    /** True when `id` is paired and `sig` signs authText(challenge, id) with its key. */
    verify(id, challenge, sig) {
      const p = db.phones.find(x => x.id === id);
      return !!p && !!challenge && verifySig(p.pub, authText(challenge, id), sig);
    },

    list() { return db.phones.map(p => ({ id: p.id, device: p.device, added: p.added })); },

    remove(id) {
      const n = db.phones.length;
      db.phones = db.phones.filter(p => p.id !== id);
      if (db.phones.length !== n) { save(); return true; }
      return false;
    },
  };
}

/* ---- the QR encoder ------------------------------------------------------
   The Planner already carries Project Nayuki's QR Code generator (MIT, notice kept in that file) in
   src/05f-qr.js. The relay lives in the same project, so it takes the encoder from there rather than
   keeping a second copy. null when the file is not where it should be: the page then shows the link
   as text. */

let QR = undefined;
function qrEncoder() {
  if (QR !== undefined) return QR;
  QR = null;
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', '05f-qr.js'), 'utf8');
    const start = src.indexOf('const QRGEN=(function(){');
    const endMark = 'return qrcodegen;})();';
    const end = src.indexOf(endMark, start);
    if (start >= 0 && end > start) {
      // eslint-disable-next-line no-new-func
      QR = new Function(src.slice(start, end + endMark.length) + '\nreturn QRGEN;')();
    }
  } catch (e) { QR = null; }
  return QR;
}

/** An SVG of `text`, crisp edges so a phone camera reads it off a monitor. null without an encoder. */
function qrSvg(text) {
  const Q = qrEncoder();
  if (!Q) return null;
  const qr = Q.QrCode.encodeText(text, Q.QrCode.Ecc.MEDIUM);
  const n = qr.size, b = 3, w = n + 2 * b, d = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.getModule(x, y)) d.push(`M${x + b},${y + b}h1v1h-1z`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${d.join('')}" fill="#000"/></svg>`;
}

function pairLink(ws, code, pcName) {
  return `vrg://pair?ws=${encodeURIComponent(ws)}&c=${code}&n=${encodeURIComponent(pcName)}`;
}

/** The /pair page. It fetches a fresh code from /pair/code.json and renews it before it runs out. */
function pairPage() {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VRG Mobile párosítás</title>
<style>
:root{--abyss:#041019;--deep:#071A26;--surface:#0B2533;--line:#1D4C63;--ink:#DCEFF4;--muted:#86A9B8;--glow:#3FE0D0;--sand:#F2B33D;--coral:#FF5C7A}
body{margin:0;min-height:100vh;background:linear-gradient(#0A2A3A,var(--deep),var(--abyss));color:var(--ink);font:15px system-ui,sans-serif;display:flex;justify-content:center}
main{max-width:720px;width:100%;padding:24px 16px}h1{font-size:18px;letter-spacing:2.4px;margin:0 0 4px}
.muted{color:var(--muted);font-size:13px}.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin-top:16px}
#qr{width:300px;max-width:100%;margin:8px auto;display:block;background:#fff;border-radius:8px}#qr svg{display:block;width:100%;height:auto}
#left{color:var(--glow);font-family:monospace}code{font-family:monospace;font-size:12px;color:var(--muted);word-break:break-all}
select,button{background:var(--deep);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:inherit}
button:hover{border-color:var(--glow)}li{margin:6px 0;display:flex;gap:8px;align-items:center}li span{flex:1}ul{padding:0;list-style:none}
.warn{color:var(--sand)}
</style></head><body><main>
<h1>VRG MOBILE · PÁROSÍTÁS</h1>
<div class="muted">Olvasd be a telefonnal: VRG Mobile → QR párosítás (vagy a telefon kamerája). A kód 2 percig él, egyszer használható, és csak ezen a képernyőn látszik.</div>
<div class="card" style="text-align:center">
  <div id="qr"></div>
  <div>még <span id="left">–</span> mp</div>
  <div style="margin-top:8px"><label class="muted">Hálózat: <select id="ip"></select></label> <button id="again">Új kód</button></div>
  <div style="margin-top:8px"><code id="link"></code></div>
</div>
<div class="card"><b>Párosított telefonok</b><ul id="phones"></ul><div class="muted">A törölt telefon újra csak QR-rel párosulhat.</div></div>
</main><script>
let exp=0,loading=false;
const $=id=>document.getElementById(id);
async function fresh(){
  if(loading)return;loading=true;
  try{await load();}catch(e){$('qr').innerHTML='<p class="warn">A relé nem válaszol.</p>';exp=Date.now()+10000;}
  loading=false;
}
async function load(){
  const ip=$('ip').value;
  const r=await fetch('/pair/code.json'+(ip?'?ip='+encodeURIComponent(ip):''),{cache:'no-store'});
  const j=await r.json();
  if(!j.ok){$('qr').innerHTML='<p class="warn">'+(j.reason||'hiba')+'</p>';exp=Date.now()+10000;return;}
  $('qr').innerHTML=j.svg||'<p class="warn">Nincs QR kódoló, a linket kell átvinni.</p>';
  $('link').textContent=j.link;exp=Date.now()+j.ttl;
  if(!$('ip').options.length){j.addresses.forEach(a=>{const o=document.createElement('option');o.value=a.address;o.textContent=a.address+'  ('+a.name+')';$('ip').appendChild(o);});$('ip').value=j.address||'';}
  phones();
}
async function phones(){
  const j=await (await fetch('/pair/list.json',{cache:'no-store'})).json();
  $('phones').innerHTML='';
  if(!j.phones.length){$('phones').innerHTML='<li class="muted">Még nincs.</li>';return;}
  j.phones.forEach(p=>{const li=document.createElement('li');
    li.innerHTML='<span></span><button>Törlés</button>';li.querySelector('span').textContent=p.device+'  ·  '+p.added.slice(0,16).replace('T',' ');
    li.querySelector('button').onclick=async()=>{await fetch('/pair/remove?id='+encodeURIComponent(p.id),{method:'POST'});phones();};
    $('phones').appendChild(li);});
}
function tick(){const s=Math.max(0,Math.round((exp-Date.now())/1000));$('left').textContent=s;if(s<=5)fresh();}
$('again').onclick=fresh;$('ip').onchange=fresh;
fresh();setInterval(tick,1000);setInterval(phones,5000);
</script></body></html>`;
}

module.exports = { createPairing, authText, isLocal, isLocalHost, parsePub, verifySig, qrSvg, pairLink, pairPage, defaultFile, CODE_TTL };
