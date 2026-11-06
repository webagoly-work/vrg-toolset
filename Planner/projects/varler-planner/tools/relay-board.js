// ==========================================================================
// relay-board.js — Átadás, the file board between the phone and the PC (VRG Mobile, WP M12).
//
// One folder outside the repo (client PDFs must never land in it): <Full>\inbox\board\, found next to
// the repo as the toolchain is (CLAUDE.md), RELAY_BOARD_DIR overrides it for tests. Files go in
// <YYYY-MM-DD>\ under it and board.json lists them: {id, name, file, bytes, sha256, from, at, target}.
//
//   * Taking a file gives a copy; it stays on the board for the other side and for a second device.
//   * Removing an entry MOVES the file to _removed\<YYYY-MM-DD>\. Nothing is deleted automatically;
//     the user empties that folder. A removed id stops being served at once.
//   * An upload streams into _part\<random>.part and is renamed and listed only when it is complete,
//     with the size the request announced and the SHA-256 the sender named. Anything else leaves
//     neither an entry nor a .part behind.
//   * The stored name is sanitised (cleanName) and only ever names a file inside a day folder; the
//     path is checked again after joining. Files are served as application/octet-stream with
//     Content-Disposition: attachment, nosniff, no-store and a sandbox CSP, so an uploaded HTML or
//     SVG file never runs on the relay's address.
//
// Who may use it (phone-relay-server.js enforces it; the rules are here so the test sees them):
//   * the PC's own browser: the /pair rule (isLocal + isLocalHost), and every POST must carry this
//     relay's own Origin (originOk): the /pair rule alone does not stop a website open in the same
//     browser from posting to localhost.
//   * VRG Mobile: a trusted WebSocket asks for a ticket (board.ticket): random 128-bit, one
//     transfer, 60 s, bound to the pairing; it travels in the X-VRG-Ticket header, never in the URL.
//   * anyone else: nothing.
//
// The clipboard (clip.set / clip.get, text only) is here too: PowerShell Set-Clipboard /
// Get-Clipboard on Windows, the text passed as base64 so no string from the phone reaches a command
// line. RELAY_CLIP_FILE=<file> stands in for the clipboard in tests.
// ==========================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const MAX_BYTES = 50 * 1024 * 1024;
const TICKET_TTL = 60 * 1000;
const CLIP_MAX = 100000;
const TARGETS = ['inbox', 'planner', 'inventory'];
const ID = /^[0-9a-f]{16}$/;
const TICKET = /^[0-9a-f]{32}$/;
const SHA = /^[0-9a-f]{64}$/;
const TICKET_HEADER = 'x-vrg-ticket';

function defaultDir() {
  return process.env.RELAY_BOARD_DIR || path.join(path.dirname(REPO), 'inbox', 'board');
}

/* ---- names and paths ------------------------------------------------------- */

// Windows' reserved device names, with or without an extension ("CON", "nul.txt", "COM1.pdf").
const RESERVED = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$|clock\$)$/i;

/**
 * The name a file is stored and listed under. Only the last segment of whatever the sender called
 * it; no control or bidi-override characters, none of < > : " | ? *, no leading or trailing dots and
 * spaces, at most 120 characters with the extension kept, a reserved device name prefixed with "_".
 */
function cleanName(raw) {
  let s = String(raw == null ? '' : raw);
  try { s = s.normalize('NFC'); } catch (e) { /* keep as is */ }
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
  s = s.split(/[\\/]/).pop();
  s = s.replace(/[<>:"|?*]/g, '_').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const cps = Array.from(s);
  if (cps.length > 120) {
    const ext = (/\.[A-Za-z0-9]{1,10}$/.exec(s) || [''])[0];
    s = cps.slice(0, 120 - ext.length).join('').replace(/[.\s]+$/, '') + ext;
  }
  if (RESERVED.test(s.split('.')[0].trim())) s = '_' + s;
  return s || 'fajl';
}

/** "foto.jpg" taken -> "foto (2).jpg", then "(3)"…; `taken(name)` says whether one is in use. */
function uniqueName(name, taken) {
  if (!taken(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; i < 10000; i++) {
    const n = `${stem} (${i})${ext}`;
    if (!taken(n)) return n;
  }
  return `${stem} (${crypto.randomBytes(4).toString('hex')})${ext}`;
}

/** `rel` joined to `root`, or null when the result would be outside it. */
function inside(root, rel) {
  const r = path.resolve(root);
  const p = path.resolve(r, rel);
  return p.startsWith(r + path.sep) ? p : null;
}

function day(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The POST came from this relay's own page: Origin is http://<the Host it was sent to>. */
function originOk(origin, host) {
  if (typeof origin !== 'string' || typeof host !== 'string' || !host) return false;
  return origin.toLowerCase() === ('http://' + host).toLowerCase();
}

/** Content-Disposition: attachment with an ASCII fallback and the UTF-8 name (RFC 6266 / 5987). */
function disposition(name) {
  const ascii = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf = encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf}`;
}

/** The headers every board file is served with: never rendered, never sniffed, never cached. */
function fileHeaders(e) {
  return {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': disposition(e.name),
    'Content-Length': e.bytes,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-VRG-Sha256': e.sha256,
  };
}

/* ---- the board ------------------------------------------------------------- */

/** The public face of an entry: what list.json, board.listed and the board event carry. */
function pub(e) {
  return { id: e.id, name: e.name, bytes: e.bytes, sha256: e.sha256, from: e.from, at: e.at, target: e.target };
}

/**
 * opts (all optional): dir, max (bytes), now (ms clock), ttl (ticket ms). The state is board.json
 * plus the tickets in memory; `on(fn)` hears {event:'added'|'removed', ...pub(entry)}.
 */
function createBoard(opts) {
  opts = opts || {};
  const dir = path.resolve(opts.dir || defaultDir());
  const max = opts.max || MAX_BYTES;
  const now = opts.now || Date.now;
  const ttl = opts.ttl || TICKET_TTL;
  const file = path.join(dir, 'board.json');
  const tickets = new Map();               // ticket -> {op, id, pairId, expires}
  const listeners = [];
  let db = null;

  function load() {
    if (db) return db;
    try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.entries)) db = { v: 1, entries: [], removed: [] };
    if (!Array.isArray(db.removed)) db.removed = [];
    return db;
  }

  function save() {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, file);
  }

  function emit(event, e) { for (const fn of listeners) { try { fn(Object.assign({ event }, pub(e))); } catch (x) { /* a listener's problem */ } } }

  function sweep() { const t = now(); for (const [k, v] of tickets) if (v.expires <= t) tickets.delete(k); }

  function get(id) { return typeof id === 'string' && ID.test(id) ? load().entries.find(e => e.id === id) || null : null; }

  function pathOf(e) { return e ? inside(dir, e.file) : null; }

  return {
    dir, max,
    on(fn) { listeners.push(fn); },
    list() { return load().entries.map(pub).sort((a, b) => b.at.localeCompare(a.at)); },
    get,
    pathOf,

    /** A one-transfer ticket for a trusted phone: op 'upload', or 'download' of an id on the board. */
    ticket(op, id, pairId) {
      sweep();
      if (op !== 'upload' && op !== 'download') return { ok: false, reason: 'Ismeretlen művelet.' };
      if (op === 'download' && !get(id)) return { ok: false, reason: 'Ez már nincs a táblán.' };
      const t = crypto.randomBytes(16).toString('hex');
      tickets.set(t, { op, id: op === 'download' ? id : null, pairId: pairId || null, expires: now() + ttl });
      return { ok: true, ticket: t, op, id: op === 'download' ? id : null, ttl };
    },

    /** Spends a ticket: true once, for its op (and id), before it expires, while its pairing exists. */
    useTicket(t, op, id, isPaired) {
      sweep();
      if (typeof t !== 'string' || !TICKET.test(t)) return false;
      const v = tickets.get(t);
      if (!v) return false;
      tickets.delete(t);
      if (v.op !== op || (op === 'download' && v.id !== id)) return false;
      if (isPaired && v.pairId && !isPaired(v.pairId)) return false;
      return true;
    },

    /** Every ticket of a pairing that was removed. */
    revoke(pairId) { for (const [k, v] of tickets) if (v.pairId === pairId) tickets.delete(k); },

    /**
     * Streams `req` into the board. meta: {name, sha256, target, from, length}. Resolves to
     * {ok:true, entry} or {ok:false, status, reason}; never leaves a .part behind.
     */
    receive(req, meta) {
      return new Promise(resolve => {
        const fail = (status, reason) => resolve({ ok: false, status, reason });
        const sha = String(meta.sha256 || '').toLowerCase();
        const target = meta.target == null || meta.target === '' ? 'inbox' : meta.target;
        const length = Number(meta.length);
        if (!SHA.test(sha)) return fail(400, 'Hiányzó vagy hibás SHA-256.');
        if (!TARGETS.includes(target)) return fail(400, 'Ismeretlen cél: ' + String(target).slice(0, 20));
        if (meta.name == null || String(meta.name).trim() === '') return fail(400, 'Hiányzó fájlnév.');
        if (meta.length == null || meta.length === '' || !Number.isInteger(length) || length < 0) return fail(411, 'Hiányzó méret (Content-Length).');
        if (length > max) return fail(413, `Túl nagy: legfeljebb ${Math.round(max / 1024 / 1024)} MB.`);

        const partDir = path.join(dir, '_part');
        fs.mkdirSync(partDir, { recursive: true });
        const part = path.join(partDir, crypto.randomBytes(12).toString('hex') + '.part');
        const out = fs.createWriteStream(part, { flags: 'wx' });
        const hash = crypto.createHash('sha256');
        let bytes = 0, done = false, ended = false;
        const drop = (status, reason) => {
          if (done) return;
          done = true;
          req.unpipe && req.unpipe(out);
          out.destroy();
          fs.rm(part, { force: true }, () => fail(status, reason));
        };
        req.on('data', d => {
          bytes += d.length;
          if (bytes > max || bytes > length) { drop(413, 'A feltöltés nagyobb a bejelentettnél.'); req.destroy(); return; }
          hash.update(d);
        });
        req.on('end', () => { ended = true; });
        req.on('aborted', () => drop(400, 'A feltöltés megszakadt.'));
        req.on('close', () => { if (!ended) drop(400, 'A feltöltés megszakadt.'); });
        req.on('error', () => drop(400, 'A feltöltés megszakadt.'));
        out.on('error', err => drop(500, 'Nem írható: ' + err.message));
        out.on('finish', () => {
          if (done) return;
          if (!ended || bytes !== length) return drop(400, `Hiányos feltöltés (${bytes} / ${length} bájt).`);
          const digest = hash.digest('hex');
          if (digest !== sha) return drop(400, 'Az ellenőrzőösszeg nem egyezik: a fájl sérülten érkezett.');
          try {
            const t = now();
            const d = day(t);
            const dayDir = path.join(dir, d);
            fs.mkdirSync(dayDir, { recursive: true });
            const listed = new Set(load().entries.filter(e => e.file.startsWith(d + '/')).map(e => e.file.slice(d.length + 1).toLowerCase()));
            const name = uniqueName(cleanName(meta.name), n => listed.has(n.toLowerCase()) || fs.existsSync(path.join(dayDir, n)));
            const rel = d + '/' + name;
            const final = inside(dir, rel);
            if (!final || path.dirname(final) !== path.resolve(dayDir)) return drop(400, 'Hibás fájlnév.');
            fs.renameSync(part, final);
            done = true;
            let id;
            do { id = crypto.randomBytes(8).toString('hex'); } while (get(id));
            const e = { id, name, file: rel, bytes, sha256: digest, from: meta.from === 'phone' ? 'phone' : 'pc', at: new Date(t).toISOString(), target };
            load().entries.push(e);
            save();
            emit('added', e);
            resolve({ ok: true, entry: e });
          } catch (err) {
            if (done) fail(500, 'Nem sikerült a táblára tenni: ' + err.message);   // renamed but not listed: the file stays, nothing is lost
            else drop(500, 'Nem sikerült a táblára tenni: ' + err.message);
          }
        });
        req.pipe(out);
      });
    },

    /** Moves the file to _removed\<day>\ and drops the entry. -> {ok, entry, moved} | {ok:false, reason}. */
    remove(id) {
      const e = get(id);
      if (!e) return { ok: false, reason: 'Ez már nincs a táblán.' };
      const d = day(now());
      const to = path.join(dir, '_removed', d);
      let moved = null;
      const src = pathOf(e);
      try {
        if (src && fs.existsSync(src)) {
          fs.mkdirSync(to, { recursive: true });
          const name = uniqueName(e.name, n => fs.existsSync(path.join(to, n)));
          fs.renameSync(src, path.join(to, name));
          moved = '_removed/' + d + '/' + name;
        }
      } catch (err) { return { ok: false, reason: 'Nem sikerült áthelyezni: ' + err.message }; }
      db.entries = db.entries.filter(x => x.id !== id);
      db.removed.push({ id: e.id, name: e.name, from: e.from, at: e.at, removed: new Date(now()).toISOString(), to: moved });
      save();
      for (const [k, v] of tickets) if (v.id === id) tickets.delete(k);
      emit('removed', e);
      return { ok: true, entry: e, moved };
    },
  };
}

/* ---- the clipboard ----------------------------------------------------------- */

const PS_SET = `$t = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:VRG_CLIP_B64)); Set-Clipboard -Value $t`;
const PS_GET = `$t = Get-Clipboard -Format Text -Raw; if ($t -eq $null) { $t = '' }; [Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$t)))`;

function ps(script, env) {
  const enc = Buffer.from(script, 'utf16le').toString('base64');
  return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], env];
}

/** Text only: a string of 1..100000 characters. -> {ok:true, text} | {ok:false, reason}. */
function checkText(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'A vágólapra csak szöveg kerülhet.' };
  if (!text.length) return { ok: false, reason: 'Üres szöveg.' };
  if (text.length > CLIP_MAX) return { ok: false, reason: `Túl hosszú szöveg (legfeljebb ${CLIP_MAX} karakter).` };
  return { ok: true, text };
}

function createClipboard(opts) {
  opts = opts || {};
  const fake = opts.file !== undefined ? opts.file : process.env.RELAY_CLIP_FILE || null;
  const platform = opts.platform || process.platform;
  const run = (cmd, args, env, input) => new Promise(res => {
    const c = execFile(cmd, args, { env: Object.assign({}, process.env, env || {}), windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024 },
      (err, out) => res(err ? { ok: false, reason: 'A vágólap nem érhető el: ' + String(err.message).split('\n')[0] } : { ok: true, out: String(out || '') }));
    if (input != null) { c.stdin.end(input); }
  });
  return {
    async set(text) {
      const c = checkText(text);
      if (!c.ok) return c;
      if (fake) { fs.writeFileSync(fake, text, 'utf8'); return { ok: true, chars: text.length }; }
      let r;
      if (platform === 'win32') { const [cmd, args, env] = ps(PS_SET, { VRG_CLIP_B64: Buffer.from(text, 'utf8').toString('base64') }); r = await run(cmd, args, env); }
      else if (platform === 'darwin') r = await run('pbcopy', [], null, text);
      else { r = await run('wl-copy', [], null, text); if (!r.ok) r = await run('xclip', ['-selection', 'clipboard'], null, text); }
      return r.ok ? { ok: true, chars: text.length } : r;
    },
    async get() {
      let text;
      if (fake) { try { text = fs.readFileSync(fake, 'utf8'); } catch (e) { text = ''; } }
      else {
        let r;
        if (platform === 'win32') { const [cmd, args, env] = ps(PS_GET); r = await run(cmd, args, env); if (r.ok) r.out = Buffer.from(r.out.trim(), 'base64').toString('utf8'); }
        else if (platform === 'darwin') r = await run('pbpaste', []);
        else { r = await run('wl-paste', ['--no-newline', '--type', 'text']); if (!r.ok) r = await run('xclip', ['-selection', 'clipboard', '-o']); }
        if (!r.ok) return r;
        text = r.out;
      }
      const truncated = text.length > CLIP_MAX;
      return { ok: true, text: truncated ? text.slice(0, CLIP_MAX) : text, truncated };
    },
  };
}

/* ---- the PC's page ----------------------------------------------------------- */

/** http://localhost:<port>/board: drag in, list, download, remove. Names go in as text, never as HTML. */
function boardPage() {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VRG Átadás</title>
<style>
:root{--abyss:#041019;--deep:#071A26;--surface:#0B2533;--raised:#103041;--line:#1D4C63;--ink:#DCEFF4;--muted:#86A9B8;--glow:#3FE0D0;--sand:#F2B33D;--coral:#FF5C7A}
body{margin:0;min-height:100vh;background:linear-gradient(#0A2A3A,var(--deep),var(--abyss));color:var(--ink);font:15px system-ui,sans-serif;display:flex;justify-content:center}
main{max-width:860px;width:100%;padding:24px 16px}h1{font-size:18px;letter-spacing:2.4px;margin:0 0 4px}
.muted{color:var(--muted);font-size:13px}.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin-top:16px}
#drop{border:2px dashed var(--line);border-radius:14px;padding:28px 16px;text-align:center;cursor:pointer}
#drop.over{border-color:var(--glow);background:var(--raised)}
select,button{background:var(--deep);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:inherit;cursor:pointer}
button:hover,a.btn:hover{border-color:var(--glow)}a.btn{color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:6px 10px}
ul{padding:0;list-style:none;margin:0}li{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}li:first-child{border-top:0}
li .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}li .m{color:var(--muted);font-size:12px;font-family:monospace;white-space:nowrap}
.tag{font-size:11px;border:1px solid var(--line);border-radius:8px;padding:1px 6px;color:var(--muted)}.tag.phone{color:var(--glow);border-color:var(--glow)}
#bar{height:4px;background:var(--glow);width:0;border-radius:2px;transition:width .2s}.warn{color:var(--sand)}
</style></head><body><main>
<h1>VRG ÁTADÁS · FÁJLTÁBLA</h1>
<div class="muted">Húzz ide fájlt: a párosított telefon (VRG Mobile → Átadás) látja és letöltheti. A telefonról küldött fájlok is ide érkeznek.
A levétel nem töröl: a fájl a tábla <code>_removed</code> mappájába kerül.</div>
<div class="card">
  <div id="drop"><b>Fájlok ide</b><div class="muted">vagy kattints a tallózáshoz · legfeljebb 50 MB fájlonként</div></div>
  <input id="pick" type="file" multiple hidden>
  <div style="margin-top:10px;display:flex;gap:10px;align-items:center"><label class="muted">Cél: <select id="target">
    <option value="inbox">Tábla (csak ide)</option><option value="planner">Planner</option><option value="inventory">Inventory</option></select></label>
    <span id="status" class="muted"></span></div>
  <div style="margin-top:8px"><div id="bar"></div></div>
</div>
<div class="card"><b>A táblán</b> <span id="count" class="muted"></span><ul id="list"></ul></div>
</main><script>
const $=id=>document.getElementById(id);
const when=s=>{const d=new Date(s),p=n=>String(n).padStart(2,'0');return isNaN(d)?'':d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());};
const kb=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
async function sha(buf){const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function say(t,warn){$('status').textContent=t;$('status').className=warn?'warn':'muted';}
function send(file,i,n){return new Promise(async res=>{
  if(file.size>52428800){say(file.name+': túl nagy (50 MB a határ).',true);return res(false);}
  say('Ellenőrzőösszeg: '+file.name+'…');
  const buf=await file.arrayBuffer();const h=await sha(buf);
  const q='?name='+encodeURIComponent(file.name)+'&sha256='+h+'&target='+encodeURIComponent($('target').value);
  const x=new XMLHttpRequest();x.open('POST','/board/upload'+q);
  x.upload.onprogress=e=>{if(e.lengthComputable)$('bar').style.width=(100*(i+e.loaded/e.total)/n)+'%';};
  x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch(e){}
    if(x.status===200&&j.ok){say('Feltöltve: '+j.entry.name);res(true);}else{say(file.name+': '+(j.reason||('hiba '+x.status)),true);res(false);}};
  x.onerror=()=>{say(file.name+': a relé nem válaszol.',true);res(false);};
  x.send(new Blob([buf]));});}
async function upload(files){files=[...files];for(let i=0;i<files.length;i++)await send(files[i],i,files.length);$('bar').style.width='0';load();}
async function load(){
  let j;try{j=await (await fetch('/board/list.json',{cache:'no-store'})).json();}catch(e){say('A relé nem válaszol.',true);return;}
  const ul=$('list');ul.textContent='';$('count').textContent='('+j.entries.length+')';
  if(!j.entries.length){const li=document.createElement('li');li.className='muted';li.textContent='Üres.';ul.appendChild(li);return;}
  for(const e of j.entries){const li=document.createElement('li');
    const n=document.createElement('span');n.className='n';n.textContent=e.name;n.title=e.name;
    const t=document.createElement('span');t.className='tag'+(e.from==='phone'?' phone':'');t.textContent=e.from==='phone'?'telefon':'PC';
    const g=document.createElement('span');g.className='tag';g.textContent=e.target;
    const m=document.createElement('span');m.className='m';m.textContent=kb(e.bytes)+' · '+when(e.at);
    const a=document.createElement('a');a.className='btn';a.href='/board/file/'+e.id;a.textContent='Letöltés';a.setAttribute('download',e.name);
    const b=document.createElement('button');b.textContent='Levétel';
    b.onclick=async()=>{const r=await fetch('/board/remove?id='+encodeURIComponent(e.id),{method:'POST'});const k=await r.json().catch(()=>({}));if(!k.ok)say(k.reason||'Nem sikerült.',true);load();};
    li.append(n,t);if(e.target!=='inbox')li.append(g);li.append(m,a,b);ul.appendChild(li);}
}
const d=$('drop');d.onclick=()=>$('pick').click();$('pick').onchange=e=>{upload(e.target.files);e.target.value='';};
d.ondragover=e=>{e.preventDefault();d.classList.add('over');};d.ondragleave=()=>d.classList.remove('over');
d.ondrop=e=>{e.preventDefault();d.classList.remove('over');upload(e.dataTransfer.files);};
function live(){try{const w=new WebSocket('ws://'+location.host);
  w.onopen=()=>w.send(JSON.stringify({v:1,from:'board',seq:1,t:Date.now(),type:'hello',payload:{role:'board',app:'vrg-board'}}));
  w.onmessage=m=>{try{const j=JSON.parse(m.data);if(j.from==='relay'&&j.type==='board')load();}catch(e){}};
  w.onclose=()=>setTimeout(live,3000);}catch(e){setTimeout(live,3000);}}
load();live();setInterval(load,15000);
</script></body></html>`;
}

module.exports = {
  createBoard, createClipboard, cleanName, uniqueName, inside, originOk, disposition, fileHeaders, boardPage, checkText, pub, day,
  defaultDir, MAX_BYTES, TICKET_TTL, CLIP_MAX, TARGETS, TICKET_HEADER, ID,
};
