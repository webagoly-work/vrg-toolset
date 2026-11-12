#!/usr/bin/env node
// ==========================================================================
// phone-relay-server.js
//
// Local relay for the Varler Planner phone-camera link. Serves
// phone-sender.html over HTTP and rebroadcasts every WebSocket message to
// all OTHER connected clients — phone -> planner tab, and back if needed.
// No internet: works over home WiFi or a phone/PC hotspot.
//
// Run:
//   node phone-relay-server.js            (port 47291)
//   node phone-relay-server.js 50123      (explicit port)
//   set GYRO_PORT=50123 && node phone-relay-server.js
//
// The port comes from, in order: the command line, GYRO_PORT, then 47291.
// 47291 sits above the registered-service range and below 49152, where
// Windows starts handing out ephemeral ports on its own — so nothing else
// should ever be sitting on it.
//
// CHANGED 25 Aug: was 8080, which collided with something already running.
// It also now prints its own LAN addresses AFTER binding, and steps to the
// next free port if the chosen one is taken, so the address on screen is
// always the address that actually works.
//
// CHANGED 30 Aug — two features merged from two separate work threads:
//   * /whoami  (QR subsystem) — a file:// page cannot discover its own LAN
//     address. The Planner asks the relay instead, so it can render a
//     phone-connect QR code. CORS is wide open because file:// sends a null
//     Origin; this server is LAN-only and holds nothing secret.
//   * role-aware routing (2.0-a) — every envelope carries `from`. A message
//     is delivered only to clients of a DIFFERENT role, so two phones, or a
//     stale planner tab, cannot feed each other. Clients that never send a
//     hello have no known role and receive everything, which keeps legacy
//     one-way senders working unchanged.
//
// CHANGED 27 Oct — VRG Légegér (Mobile/): one phone, several apps.
//   * `to` — an envelope may name the role it is for ({to:'codecity'}). It
//     then reaches only clients of that role. Without `to`, routing is as
//     before, except that two APP roles (anything but 'phone') no longer
//     feed each other: a Kódváros hello must not become the Planner's peer.
//   * focus — an app sends {type:'focus'} when its window gains focus. The
//     relay remembers the last one and tells every phone, so the phone can
//     switch to that app's layout.
//   * roster — on every hello and close, phones get {from:'relay',
//     type:'roster', payload:{peers, focus}}: which apps are on the line.
//   * hello replay — each app's last hello is kept and replayed to a phone
//     that says hello later. Before this, a phone that connected AFTER the
//     Planner never learnt its tool table.
//
// CHANGED 28 Oct — screenshots for the phone (Légegér 📸).
//   A phone sends {type:'screenshot.request', to:'relay', payload:{mode:'screen'|'window'}}. The relay
//   captures this PC (Windows: PowerShell + System.Drawing; macOS: screencapture; Linux: grim / import),
//   keeps the PNG under an unguessable name for 10 minutes and answers the asking phone only with
//   {from:'relay', type:'screenshot', payload:{ok, url:'/shot/<hex>.png', name, bytes}}; the phone
//   fetches it over HTTP and offers it for saving / sharing.
//   OFF unless started with --shots (or RELAY_SHOTS=1): anyone on the WiFi who can reach this port
//   could otherwise look at the screen. AirDeck\legeger.cmd starts the relay with it; START.cmd G
//   does not. Every capture is logged on the console with the asking address.
//   RELAY_SHOT_FILE=<png> answers with that file instead of capturing — tests and headless boxes.
//
// CHANGED 29 Oct — QR pairing (VRG Mobile, WP M2; the handshake is described in relay-pair.js).
//   * GET /pair (only from this PC itself) shows a QR with a one-time code; a phone that scans it and
//     sends {type:'pair'} with the code becomes TRUSTED, and proves it on every later connect by
//     signing the challenge of the relay's {type:'welcome'} with its Keystore key.
//   * Everything that acts on this PC needs a trusted phone: screenshots now (--shots still has to be
//     on as well), the later ports / launch / drop too. Plain control (keys, cmd, gestures, state)
//     is unchanged, so an unpaired phone-sender.html still drives the Planner.
//   * /pair/code.json, /pair/list.json and POST /pair/remove?id= serve the page; same local-only rule.
//
// CHANGED 5 Nov — Localhost (VRG Mobile, WP M8, D-10 = C; the rules are in relay-ports.js).
//   * {type:'ports.list', to:'relay'} from a trusted phone -> {type:'ports', payload:{ok, ports:[{port,
//     process, http, title, known, path, system, self}], proxy:{on, token}}}: this PC's listening ports.
//   * {type:'ports.open', to:'relay', payload:{port, path, where:'desktop'}} -> opens
//     http://localhost:<port><path> in its own window here (portable Chrome --app=, else the system
//     browser) and answers {type:'ports.opened', payload:{ok, port, url, how}}. The URL is built from
//     the number; nothing else is ever opened.
//   * /p/<port>/… reverse-proxies to localhost:<port> for a paired phone's token, Location rewritten.
//     OFF unless started with --ports (or RELAY_PORTS=1), like --shots. Mobile\mobile.cmd relay
//     starts it with both; START.cmd G with neither. An untrusted phone gets {ok:false, trusted:false}.
//
// CHANGED 6 Nov — Indítópult (VRG Mobile, WP M11; the rules are in relay-launch.js).
//   * {type:'launch.list', to:'relay'} from a trusted phone -> {type:'launch', payload:{ok, entries:[{id,
//     kind, key, name, hint, group, exists, server, port, path}], running:[id], mine:[id], proxy:{on, token}}}:
//     START's tools (launcher/vrg-menu.json) plus the servers and extras Mobile/catalogue/launch.json allows.
//   * launch.run {id} -> launch.ran {ok, id, how, started, note | reason}: the tool's page opens on the PC
//     (portable Chrome first), a server is started detached first when it is not running.
//   * launch.status -> launch.status {ok, running, mine}; launch.log {id} -> launch.log {ok, id, lines};
//     launch.stop {id} -> launch.stopped {ok, id | reason}, only for a server this relay started.
//   * The id is a key into the list, nothing else: no string from the phone reaches a command.
//
// CHANGED 6 Nov — Átadás, the file board (VRG Mobile, WP M12; the rules are in relay-board.js).
//   * GET /board (this PC's own browser only, the /pair rule) is the board page; /board/list.json,
//     /board/file/<id>, POST /board/upload?name=&sha256=&target= and POST /board/remove?id= serve it.
//     Every POST from the page must carry this relay's own Origin as well.
//   * A trusted phone: board.list -> board.listed {ok, entries}; board.ticket {op:'upload'|'download',
//     id} -> board.ticket {ok, ticket, ttl}: one transfer within 60 s, sent as the X-VRG-Ticket header
//     on /board/upload or /board/file/<id>; board.remove {id} -> board.removed {ok, id}.
//   * clip.set {text} / clip.get -> clip {ok, text?}: the PC's clipboard, text only.
//   * {type:'board', payload:{event:'added'|'removed', id, name, bytes, from, target, ...}} goes to the
//     trusted phones and to the apps on this PC (the board page, the Planner), so lists refresh by themselves.
//
// CHANGED 6 Nov — Képernyő, the PC's screen live on the phone (VRG Mobile, WP M13; rules in relay-screen.js).
//   * screen.ticket from a trusted phone -> screen.ticket {ok, ticket, ttl, path:'/screen'} | {ok:false, reason,
//     busy?}: one /screen connection within 60 s, the ticket in the X-VRG-Ticket header of the upgrade.
//   * /screen is its own WebSocket (binary JPEG frames + a few JSON notes), so frames never hold up this
//     link. OFF unless --shots, like 📸; one viewer at a time; the PC shows a notice window with Leállítás
//     while it streams; removing the pairing ends it at once. Windows only (RELAY_FRAMES_DIR for tests).
//
// CHANGED 6 Nov — Értesítések, a tool on this PC tells the phone (VRG Mobile, WP M10; rules in relay-notify.js).
//   * POST /notify {title, text?, level?, link?, from?} from this PC only (the /pair rule; a browser's POST
//     must carry this relay's own Origin, a script sends none) -> {ok, entry, delivered}. An app connected
//     from this PC may send {type:'notify', to:'relay', payload} instead -> notify.added {ok, id | reason}.
//   * Each notice goes to the trusted phones as {type:'notify', payload:{id, title, text, level, link, from, at}};
//     the relay keeps the last 30 for a day, and notify.list {after} -> notify.listed {ok, entries} from a
//     trusted phone brings the ones it missed. `node tools/relay-notify.js "Cím" "szöveg"` posts one.
//
// CHANGED 12 Nov — Claude, Remote Control sessions on this PC from the phone (VRG Mobile, WP M22; rules in relay-claude.js).
//   * claude.list -> claude {ok, on, folders:[{key,name,hint}], accounts, sessions:[{id,name,folder,account,started,url,alive}]};
//     claude.start {folder, account?} -> claude.started {ok, session, waiting} | {ok:false, reason}; claude.stop {id} ->
//     claude.stopped. Trusted phones only, and OFF unless --claude (RELAY_CLAUDE=1). Folders are START → C's items named in
//     Mobile/catalogue/claude.json; the name is made by the relay; the phone opens the session link in the Claude app.
// ==========================================================================

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const pairing = require('./relay-pair');
const ports = require('./relay-ports');
const launch = require('./relay-launch');
const board = require('./relay-board');
const screen = require('./relay-screen');
const notify = require('./relay-notify');
const claude = require('./relay-claude');

const DEFAULT_PORT = 47291;
const MAX_TRIES = 8;                       // 47291..47298

const ARGS = process.argv.slice(2);
const wanted = Number(ARGS.find(a => /^\d+$/.test(a))) || Number(process.env.GYRO_PORT) || DEFAULT_PORT;
const SHOTS = ARGS.includes('--shots') || process.env.RELAY_SHOTS === '1';
const PORTS = ARGS.includes('--ports') || process.env.RELAY_PORTS === '1';
// --claude: a paired phone may list, start and stop Claude Remote Control sessions on this PC (WP M22, relay-claude.js)
const CLAUDE = ARGS.includes('--claude') || process.env.RELAY_CLAUDE === '1';
// --pair: on start, pop the pairing QR (/pair) up in its own app window (portable Chrome --app=,
// else the system browser), so the phone can scan it without typing an address (2026-11-06).
const PAIR_WINDOW = ARGS.includes('--pair') || process.env.RELAY_PAIR === '1';
const PAIRS = pairing.createPairing();
const GATE = ports.createGate();
const isPaired = id => PAIRS.list().some(p => p.id === id);
const SENDER_PAGE = path.join(__dirname, '..', 'mobile', 'phone-sender.html');
const SENDER_FALLBACK = path.join(__dirname, 'phone-sender.html');

function senderPath() {
  if (fs.existsSync(SENDER_PAGE)) return SENDER_PAGE;
  if (fs.existsSync(SENDER_FALLBACK)) return SENDER_FALLBACK;
  return null;
}

/* ---- interface preference ----------------------------------------------
   The dev machine is dual-homed on purpose: Ethernet for the house LAN and
   a WiFi dongle for testing the phone link. os.networkInterfaces() lists
   Ethernet first, which made the banner and the /whoami fallback advertise
   an address the phone cannot reach.

   Order is deliberate, not incidental: wireless first, then everything
   else, then virtual adapters (VirtualBox / VMware / Hyper-V / WSL) dead
   last — those have LAN-looking addresses and reach nothing.

   Override with RELAY_IFACE=<substring>, e.g. RELAY_IFACE="WiFi 2". */

const IFACE_PREFER = process.env.RELAY_IFACE || null;
const WIRELESS_RE = /wi[-\s]?fi|wlan|wireless|wl\d/i;
const VIRTUAL_RE  = /virtualbox|vmware|hyper-v|vethernet|loopback|tailscale|zerotier|wsl|docker|bluetooth/i;

function ifaceRank(name) {
  if (IFACE_PREFER && name.toLowerCase().includes(IFACE_PREFER.toLowerCase())) return 0;
  if (VIRTUAL_RE.test(name)) return 3;
  if (WIRELESS_RE.test(name)) return 1;
  return 2;
}

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) {
        out.push({ name, address: i.address, netmask: i.netmask || null, rank: ifaceRank(name) });
      }
    }
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

/* ---- which of our addresses can a given client actually reach? ----------
   A dual-homed PC (Ethernet 192.168.0.x + WiFi 192.168.1.x) has more than
   one answer, and handing back the wrong one produces a QR code that scans
   perfectly and connects to nothing. The request itself carries the client's
   IP, so match it against each interface's netmask and answer with the
   address on THAT subnet. Falls back to the first address when nothing
   matches — better a guess than a null. */

function ipToInt(ip) {
  const p = String(ip).split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const o of p) {
    const v = Number(o);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n * 256) + v;
  }
  return n;
}

function sameSubnet(a, b, mask) {
  const A = ipToInt(a), B = ipToInt(b), M = ipToInt(mask);
  if (A == null || B == null || M == null) return false;
  // >>> 0 keeps the result unsigned; bitwise ops in JS are signed 32-bit
  return ((A & M) >>> 0) === ((B & M) >>> 0);
}

function clientIp(req) {
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function bestAddressFor(req, addrs) {
  const you = clientIp(req);
  if (you) {
    const hit = addrs.find(a => a.netmask && sameSubnet(you, a.address, a.netmask));
    if (hit) return { address: hit.address, matched: true, iface: hit.name };
  }
  // No subnet match: fall back to the highest-ranked interface. lanAddresses()
  // already sorted, so addrs[0] is the preferred one.
  return addrs.length
    ? { address: addrs[0].address, matched: false, iface: addrs[0].name }
    : { address: null, matched: false, iface: null };
}

/* ---- http + websocket --------------------------------------------------- */

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (url === '/' || url === '/phone-sender.html') {
    const p = senderPath();
    if (!p) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('phone-sender.html not found in mobile/ or next to this script');
      return;
    }
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('could not read phone-sender.html: ' + err.message);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'          // always serve the current file
      });
      res.end(data);
    });
    return;
  }
  // ---- /whoami -----------------------------------------------------------
  // Answers: which addresses am I reachable on, and on what port. The
  // Planner runs from file:// and has no way to learn this by itself.
  if (url === '/whoami') {
    const port = (server.address() && server.address().port) || wanted;
    const addrs = lanAddresses();
    const best = bestAddressFor(req, addrs);
    const body = JSON.stringify({
      ok: true,
      port: port,
      addresses: addrs.map(a => a.address),
      interfaces: addrs,
      you: clientIp(req),              // the asking device, as we see it
      primary: best.address,           // the address THAT device can reach
      primaryIface: best.iface,
      subnetMatched: best.matched,     // false = we guessed; treat with suspicion
      url: best.address ? `http://${best.address}:${port}` : null,
      ws: best.address ? `ws://${best.address}:${port}` : null,
      clients: clients.size,
      roster: roster(),
      focus: lastFocus,
      shots: SHOTS,
      ports: PORTS,
      board: true,
      screen: SCREEN.available,
      notify: true,
      app: 'varler-phone-relay',
      v: 3
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',        // file:// sends Origin: null
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }

  // ---- /pair — the pairing QR, for this PC's own screen only (see the 29 Oct note) ----------
  if (url === '/pair' || url.startsWith('/pair/')) { servePair(req, res, url); return; }

  // ---- /shot/<hex>.png — a capture made for a phone (see the 28 Oct note) --
  const sm = /^\/shot\/([0-9a-f]{32})\.png$/.exec(url);
  if (sm && SHOTS) {
    const file = path.join(SHOT_DIR, sm[1] + '.png');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('expired'); return; }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  // ---- /board — Átadás, the file board (see the 6 Nov note) ------------------------------------
  if (url === '/board' || url.startsWith('/board/')) { serveBoard(req, res, url); return; }

  // ---- /notify — a tool on this PC tells the phone (see the 6 Nov Értesítések note) -------------
  if (url === '/notify') { serveNotify(req, res); return; }

  // ---- /p/<port>/… — the phone's view of a local server (see the 5 Nov note) --------------------
  if (url === '/p' || url.startsWith('/p/')) { serveProxy(req, res); return; }

  // A proxied page asking for a root-relative path ("/app.js") lands here: send it back under the
  // /p/<port>/ it came from, but only for a phone that already holds a valid proxy cookie.
  if (PORTS && req.method === 'GET') {
    const ref = /^https?:\/\/[^/]+\/p\/(\d{1,5})\//.exec(req.headers.referer || '');
    if (ref && GATE.check(ports.cookieValue(req.headers.cookie, ports.PROXY_COOKIE), isPaired)) {
      res.writeHead(307, { Location: `/p/${Number(ref[1])}${req.url}`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

function serveProxy(req, res) {
  const text = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(msg); };
  if (!PORTS) { text(404, 'A telefonos megnyitás ki van kapcsolva: a relét --ports kapcsolóval kell indítani (Mobile\\mobile.cmd relay).'); return; }
  const bare = /^\/p\/(\d{1,5})(\?.*)?$/.exec(req.url || '');
  if (bare) { res.writeHead(301, { Location: `/p/${bare[1]}/${bare[2] || ''}` }); res.end(); return; }
  const m = ports.parseProxyPath(req.url);
  if (!m || m.rest == null) { text(404, 'Not found'); return; }
  if (m.port === server.address().port) { text(403, 'A relé önmagát nem közvetíti.'); return; }
  const { path: rest, token } = ports.stripToken(m.rest);
  if (token) {
    // the first visit from the phone: the token becomes a cookie, and the URL loses it
    if (!GATE.check(token, isPaired)) { console.log(`  ! proxy token elutasitva: ${clientIp(req)} -> :${m.port}`); text(403, 'Lejárt vagy hibás belépő: nyisd meg újra a VRG Mobile Localhost listájából.'); return; }
    res.writeHead(302, {
      Location: `/p/${m.port}${rest}`,
      'Set-Cookie': `${ports.PROXY_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(ports.TOKEN_TTL / 1000)}`,
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }
  if (!GATE.check(ports.cookieValue(req.headers.cookie, ports.PROXY_COOKIE), isPaired)) {
    text(403, 'Csak párosított telefonról: nyisd meg a VRG Mobile Localhost listájából ("Itt").');
    return;
  }
  ports.proxy(req, res, m.port, rest, 'localhost');
}

/* ---- Átadás: the file board (relay-board.js has the rules) ------------------------------------ */

const BOARD = board.createBoard();
const CLIP = board.createClipboard();

function serveBoard(req, res, url) {
  const own = lanAddresses().map(a => a.address);
  const json = (code, o, extra) => {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {}));
    res.end(JSON.stringify(o));
  };
  // A refused POST: a body within the limit is read and dropped first, so the sender gets the answer
  // rather than a reset connection; anything bigger (or unannounced) is answered at once and closed.
  const answerPost = (code, o) => {
    const len = Number(req.headers['content-length']);
    if (req.complete || req.destroyed) { json(code, o); return; }
    if (!Number.isInteger(len) || len > BOARD.max) { json(code, o, { Connection: 'close' }); return; }
    req.on('end', () => json(code, o));
    req.on('close', () => json(code, o));
    req.resume();
  };
  const q = new URL(req.url, 'http://x').searchParams;
  const ticket = req.headers[board.TICKET_HEADER];
  const local = pairing.isLocal(clientIp(req), own) && pairing.isLocalHost(req.headers.host, own);
  const ownPost = local && board.originOk(req.headers.origin, req.headers.host);
  const refuse = why => {
    console.log(`  ! tabla elutasitva: ${clientIp(req)} ${req.method} ${url} (${why})`);
    const o = { ok: false, reason: 'Csak ezen a PC-n (http://localhost:' + server.address().port + '/board) vagy párosított telefonról.' };
    if (req.method === 'POST') answerPost(403, o); else json(403, o);
  };

  const fm = /^\/board\/file\/([0-9a-f]{16})$/.exec(url);
  if (fm && req.method === 'GET') {
    // the phone's way: a download ticket for exactly this id; the PC's: its own browser
    if (ticket != null ? !BOARD.useTicket(ticket, 'download', fm[1], isPaired) : !local) { refuse(ticket != null ? 'jegy' : 'nem helyi'); return; }
    const e = BOARD.get(fm[1]);
    const file = e && BOARD.pathOf(e);
    if (!file || !fs.existsSync(file)) { json(404, { ok: false, reason: 'Ez már nincs a táblán.' }); return; }
    res.writeHead(200, board.fileHeaders(e));
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    return;
  }
  if (url === '/board/upload' && req.method === 'POST') {
    const viaTicket = ticket != null;
    if (viaTicket ? !BOARD.useTicket(ticket, 'upload', null, isPaired) : !ownPost) { refuse(viaTicket ? 'jegy' : local ? 'Origin' : 'nem helyi'); return; }
    BOARD.receive(req, { name: q.get('name'), sha256: q.get('sha256'), target: q.get('target'), length: req.headers['content-length'], from: viaTicket ? 'phone' : 'pc' })
      .then(r => {
        if (!r.ok) {
          console.log(`  ! feltoltes sikertelen (${clientIp(req)}): ${r.reason}`);
          answerPost(r.status || 400, { ok: false, reason: r.reason });
          return;
        }
        const e = r.entry;
        const delivered = e.target === 'inbox' ? 0 : [...clients].filter(c => c.readyState === c.OPEN && roleOf(c) === e.target).length;
        console.log(`  [tabla] ${e.from === 'phone' ? 'telefonrol' : 'PC-rol'}: ${e.file}  ${Math.round(e.bytes / 1024)} KB` + (e.target !== 'inbox' ? `  -> ${e.target} (${delivered})` : ''));
        json(200, { ok: true, entry: board.pub(e), delivered });
      });
    return;
  }
  if (!local) { refuse('nem helyi'); return; }
  if (url === '/board' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
    res.end(board.boardPage());
    return;
  }
  if (url === '/board/list.json' && req.method === 'GET') { json(200, { ok: true, entries: BOARD.list(), dir: BOARD.dir }); return; }
  if (url === '/board/remove' && req.method === 'POST') {
    if (!ownPost) { refuse('Origin'); return; }
    const r = BOARD.remove(q.get('id'));
    if (r.ok) console.log(`  [tabla] levetel a PC-n: ${r.entry.name} -> ${r.moved || '(a fajl mar nem volt meg)'}`);
    json(r.ok ? 200 : 404, r.ok ? { ok: true, id: r.entry.id, moved: r.moved } : r);
    return;
  }
  json(404, { ok: false, reason: 'Not found' });
}

// every change, to the trusted phones and to the apps on this PC (the board page, the Planner)
BOARD.on(ev => {
  const raw = fromRelay('board', Object.assign({}, ev, ev.event === 'added' ? { url: '/board/file/' + ev.id } : {}));
  for (const c of clients) {
    if (c.readyState !== c.OPEN) continue;
    if (roleOf(c) === PHONE ? isTrusted(c) : c.__local) c.send(raw);
  }
});

const BOARD_TYPES = new Set(['board.list', 'board.ticket', 'board.remove', 'clip.get', 'clip.set']);
const BOARD_ANSWER = { 'board.list': 'board.listed', 'board.ticket': 'board.ticket', 'board.remove': 'board.removed', 'clip.get': 'clip', 'clip.set': 'clip' };

function onBoardMessage(ws, ip, type, p) {
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay(BOARD_ANSWER[type], Object.assign({ op: type }, payload))); };
  if (!isTrusted(ws)) {
    answer({ ok: false, trusted: false,
      reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' });
    return;
  }
  if (type === 'board.list') { answer({ ok: true, entries: BOARD.list() }); return; }
  if (type === 'board.ticket') { answer(BOARD.ticket(p.op, p.id, ws.__pairId)); return; }
  if (type === 'board.remove') {
    const r = BOARD.remove(p.id);
    if (r.ok) console.log(`  [tabla] levetel a telefonrol (${ip}): ${r.entry.name} -> ${r.moved || '(a fajl mar nem volt meg)'}`);
    answer(r.ok ? { ok: true, id: r.entry.id, moved: r.moved } : { ok: false, id: typeof p.id === 'string' ? p.id.slice(0, 16) : null, reason: r.reason });
    return;
  }
  if (type === 'clip.set') {
    CLIP.set(p.text).then(r => {
      console.log(`  [vagolap] telefon -> PC (${ip}): ${r.ok ? r.chars + ' karakter' : r.reason}`);
      answer(r);
    });
    return;
  }
  CLIP.get().then(r => {
    console.log(`  [vagolap] PC -> telefon (${ip}): ${r.ok ? r.text.length + ' karakter' : r.reason}`);
    answer(r);
  });
}

/* ---- Értesítések: notices from this PC to the phones (relay-notify.js has the rules) ---------- */

const NOTICES = notify.createNotices();
const NOTIFY_BODY_MAX = 8192;

// every notice, to the trusted phones only
NOTICES.on(entry => {
  const raw = fromRelay('notify', entry);
  let n = 0;
  for (const c of clients) if (c.readyState === c.OPEN && roleOf(c) === PHONE && isTrusted(c)) { c.send(raw); n++; }
  NOTICES.lastDelivered = n;
  console.log(`  [ertesites] ${entry.from || '?'}: ${entry.title}  -> ${n} telefon`);
});

function serveNotify(req, res) {
  const own = lanAddresses().map(a => a.address);
  const json = (code, o) => {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'close' });
    res.end(JSON.stringify(o));
  };
  const local = pairing.isLocal(clientIp(req), own) && pairing.isLocalHost(req.headers.host, own);
  // a script sends no Origin; a browser always does on a POST, and then it must be this relay's own page
  const originOk = req.headers.origin == null || board.originOk(req.headers.origin, req.headers.host);
  if (req.method !== 'POST') { json(405, { ok: false, reason: 'POST kell.' }); return; }
  if (!local || !originOk) {
    console.log(`  ! ertesites elutasitva: ${clientIp(req)} (${local ? 'Origin' : 'nem helyi'})`);
    req.resume();
    json(403, { ok: false, reason: 'Értesítést csak ezen a PC-n futó eszköz küldhet.' });
    return;
  }
  const len = Number(req.headers['content-length']);
  if (Number.isFinite(len) && len > NOTIFY_BODY_MAX) { req.resume(); json(413, { ok: false, reason: 'Túl hosszú.' }); return; }
  let body = '';
  let over = false;
  req.setEncoding('utf8');
  req.on('data', d => { if (over) return; body += d; if (body.length > NOTIFY_BODY_MAX) { over = true; json(413, { ok: false, reason: 'Túl hosszú.' }); } });
  req.on('end', () => {
    if (over) return;
    let p;
    try { p = JSON.parse(body); } catch (e) { json(400, { ok: false, reason: 'JSON kell: {"title": "…"}' }); return; }
    NOTICES.lastDelivered = 0;
    const r = NOTICES.add(p, 'pc');
    if (!r.ok) { json(400, r); return; }
    json(200, { ok: true, entry: r.entry, delivered: NOTICES.lastDelivered });
  });
}

function onNotifyMessage(ws, ip, type, p) {
  if (type === 'notify.list') {
    if (roleOf(ws) !== PHONE) return;
    if (!isTrusted(ws)) { ws.send(fromRelay('notify.listed', { ok: false, trusted: false, reason: 'Párosítás kell.' })); return; }
    ws.send(fromRelay('notify.listed', { ok: true, entries: NOTICES.since(p.after) }));
    return;
  }
  // type === 'notify': an app on this PC only; a phone never announces to the phones
  const answer = o => { if (ws.readyState === ws.OPEN) ws.send(fromRelay('notify.added', o)); };
  if (!ws.__local || !isApp(roleOf(ws))) {
    console.log(`  ! ertesites elutasitva (${ip}): ${ws.__local ? 'nem alkalmazas' : 'nem helyi'}`);
    answer({ ok: false, reason: 'Értesítést csak ezen a PC-n futó eszköz küldhet.' });
    return;
  }
  const r = NOTICES.add(p, ws.__app || roleOf(ws));
  answer(r.ok ? { ok: true, id: r.entry.id } : r);
}

function servePair(req, res, url) {
  const own = lanAddresses().map(a => a.address);
  const json = (code, o) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(o));
  };
  if (!pairing.isLocal(clientIp(req), own) || !pairing.isLocalHost(req.headers.host, own)) {
    console.log(`  ! parositas elutasitva: ${clientIp(req)} (csak a PC sajat kepernyojen)`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('A párosító oldal csak ezen a PC-n nyitható meg: http://localhost:' + server.address().port + '/pair');
    return;
  }
  if (url === '/pair') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(pairing.pairPage());
    return;
  }
  if (url === '/pair/code.json') {
    const port = server.address().port;
    const addrs = lanAddresses();
    const want = new URL(req.url, 'http://x').searchParams.get('ip');
    const pick = addrs.find(a => a.address === want) || addrs[0];
    if (!pick) { json(200, { ok: false, reason: 'Nincs WiFi / LAN cím: csatlakozz hálózatra.' }); return; }
    const c = PAIRS.newCode();
    const link = pairing.pairLink(`ws://${pick.address}:${port}`, c.code, PAIRS.pc().name);
    console.log(`  [par] parosito kod: ${c.code}  (2 percig, egyszer)  ${pick.address}`);
    json(200, { ok: true, link, svg: pairing.qrSvg(link), ttl: c.ttl, address: pick.address,
      addresses: addrs.map(a => ({ address: a.address, name: a.name })) });
    return;
  }
  if (url === '/pair/list.json') { json(200, { ok: true, pc: PAIRS.pc(), phones: PAIRS.list() }); return; }
  if (url === '/pair/remove' && req.method === 'POST') {
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    const ok = PAIRS.remove(id);
    if (ok) { untrust(id); console.log(`  [par] parositas torolve a PC-n: ${id}`); }
    json(200, { ok });
    return;
  }
  json(404, { ok: false });
}

// Two WebSocket endpoints on one port: /screen (Képernyő's frames, relay-screen.js) and everything else.
const wss = new WebSocketServer({ noServer: true });
const SCREEN = screen.createScreen({ enabled: SHOTS, isPaired });
server.on('upgrade', (req, socket, head) => {
  if ((req.url || '').split('?')[0] === '/screen') { SCREEN.upgrade(req, socket, head); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
const clients = new Set();

const PHONE = 'phone';
let relaySeq = 0;
let lastFocus = null;                      // { role, app, title, t } of the app last focused

function roleOf(ws) { return ws.__role || null; }
function isApp(role) { return !!role && role !== PHONE; }

function fromRelay(type, payload) {
  return JSON.stringify({ v: 1, from: 'relay', seq: ++relaySeq, t: Date.now(), type: type, payload: payload });
}

function roster() {
  const out = [];
  for (const c of clients) {
    if (c.readyState === c.OPEN && roleOf(c)) out.push({ role: roleOf(c), app: c.__app || null });
  }
  return out;
}

/** A phone that paired, or proved its key this connection. The gate for everything that acts on the PC. */
function isTrusted(ws) { return !!ws.__trusted; }

/** A pairing removed (on the PC or by the phone): its live connections stop being trusted at once. */
function untrust(id) {
  GATE.revoke(id);
  BOARD.revoke(id);
  SCREEN.revoke(id);
  for (const c of clients) {
    if (c.__pairId === id) {
      c.__trusted = false; c.__pairId = null;
      if (c.readyState === c.OPEN) c.send(fromRelay('trust', { ok: false, id, pc: PAIRS.pc(), reason: 'A párosítást törölték.' }));
    }
  }
}

function toPhones(raw) {
  for (const c of clients) if (c.readyState === c.OPEN && roleOf(c) === PHONE) c.send(raw);
}

function sendRoster() { toPhones(fromRelay('roster', { peers: roster(), focus: lastFocus })); }

// Who gets a message from `ws`. Kept as one function so the rule is readable
// in one place: explicit target first, then no echo, then no app-to-app.
function deliverTo(ws, other, from, to) {
  if (other === ws || other.readyState !== other.OPEN) return false;
  const r = roleOf(other);
  if (to) return r === to;
  if (from && r && r === from) return false;          // same role: don't echo sideways
  if (isApp(from) && isApp(r)) return false;          // Planner and Kódváros don't talk to each other
  return true;
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  ws.__challenge = PAIRS.challenge();
  ws.__trusted = false;
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  ws.__local = pairing.isLocal(ip, lanAddresses().map(a => a.address));   // an app on this PC: hears board events
  console.log(`  + csatlakozott: ${ip}   (${clients.size} kliens)`);

  ws.on('message', raw => {
    const payload = raw.toString();

    // learn this client's role from its hello, and log it once
    let from = null, to = null, m = null;
    try {
      m = JSON.parse(payload);
      from = (m && m.from) || null;
      to = (m && typeof m.to === 'string' && m.to) || null;
    } catch (e) { m = null; /* not JSON: pass it through untouched */ }

    if (m && m.type === 'hello') {
      const first = !ws.__role;
      ws.__role = ws.__role || (m.payload && m.payload.role) || from || null;
      ws.__app = (m.payload && m.payload.app) || ws.__app || null;
      if (isApp(ws.__role)) ws.__hello = payload;     // replayed to phones that arrive later
      if (first) console.log(`    ${ip} = ${ws.__role} ${ws.__app || ''}`);
      if (ws.__role === PHONE) {
        // the hello answer: the challenge a paired phone signs, and which PC this is
        ws.send(fromRelay('welcome', { challenge: ws.__challenge, pc: PAIRS.pc(), pairing: true }));
        for (const c of clients) {
          if (c !== ws && c.readyState === c.OPEN && c.__hello && isApp(roleOf(c))) ws.send(c.__hello);
        }
      }
    }

    if (m && to === 'relay' && (m.type === 'pair' || m.type === 'auth' || m.type === 'unpair')) {
      if (roleOf(ws) === PHONE) onPairMessage(ws, ip, m.type, m.payload || {});
      return;
    }

    if (m && m.type === 'screenshot.request' && to === 'relay') {
      if (roleOf(ws) !== PHONE) return;
      if (!isTrusted(ws)) {
        ws.send(fromRelay('screenshot', { ok: false, trusted: false,
          reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' }));
        return;
      }
      takeShot(ws, ip, (m.payload && m.payload.mode) === 'window' ? 'window' : 'screen');
      return;
    }

    if (m && to === 'relay' && m.type === 'screen.ticket') {
      if (roleOf(ws) !== PHONE) return;
      const answer = p => { if (ws.readyState === ws.OPEN) ws.send(fromRelay('screen.ticket', p)); };
      if (!isTrusted(ws)) {
        answer({ ok: false, trusted: false,
          reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' });
        return;
      }
      const me = PAIRS.list().find(p => p.id === ws.__pairId);
      const r = SCREEN.ticket(ws.__pairId, (me && me.device) || 'telefon');
      if (!r.ok) console.log(`  [kepernyo] jegy elutasitva (${ip}): ${r.reason}`);
      answer(r);
      return;
    }

    if (m && to === 'relay' && (m.type === 'ports.list' || m.type === 'ports.open')) {
      if (roleOf(ws) !== PHONE) return;
      onPortsMessage(ws, ip, m.type, m.payload || {});
      return;
    }

    if (m && to === 'relay' && LAUNCH_TYPES.has(m.type)) {
      if (roleOf(ws) !== PHONE) return;
      onLaunchMessage(ws, ip, m.type, m.payload || {});
      return;
    }

    if (m && to === 'relay' && CLAUDE_TYPES.has(m.type)) {
      if (roleOf(ws) !== PHONE) return;
      onClaudeMessage(ws, ip, m.type, (m.payload && typeof m.payload === 'object') ? m.payload : {});
      return;
    }

    if (m && to === 'relay' && (m.type === 'notify' || m.type === 'notify.list')) {
      onNotifyMessage(ws, ip, m.type, (m.payload && typeof m.payload === 'object') ? m.payload : {});
      return;
    }

    if (m && to === 'relay' && BOARD_TYPES.has(m.type)) {
      if (roleOf(ws) !== PHONE) return;
      onBoardMessage(ws, ip, m.type, m.payload || {});
      return;
    }

    if (m && m.type === 'focus' && isApp(from)) {
      lastFocus = {
        role: from,
        app: (m.payload && m.payload.app) || ws.__app || null,
        title: (m.payload && m.payload.title) || null,
        t: Date.now()
      };
    }

    for (const other of clients) {
      if (deliverTo(ws, other, from, to)) other.send(payload);
    }

    if (m && m.type === 'hello') sendRoster();
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`  - lecsatlakozott: ${ip}   (${clients.size} kliens)`);
    if (lastFocus && ws.__role === lastFocus.role &&
        ![...clients].some(c => roleOf(c) === lastFocus.role)) lastFocus = null;
    if (ws.__role) sendRoster();
  });

  ws.on('error', err => console.log(`  ! socket hiba: ${err.message}`));
});

/* ---- pairing messages (relay-pair.js has the handshake) ------------------ */

function onPairMessage(ws, ip, type, p) {
  const pc = PAIRS.pc();
  if (type === 'pair') {
    const r = PAIRS.pair(p.code, p.device, p.pub);
    if (r.ok) {
      ws.__trusted = true; ws.__pairId = r.id;
      console.log(`  [par] parositva: ${ip} = ${String(p.device || 'telefon').slice(0, 40)}  (${r.id})`);
    } else {
      console.log(`  ! parositas sikertelen (${ip}): ${r.reason}`);
    }
    ws.send(fromRelay('paired', Object.assign({ pc }, r)));
    return;
  }
  if (type === 'auth') {
    const ok = PAIRS.verify(p.id, ws.__challenge, p.sig);
    ws.__challenge = PAIRS.challenge();      // one try per challenge
    ws.__trusted = ok; ws.__pairId = ok ? p.id : null;
    if (ok) console.log(`  [par] megbizhato telefon: ${ip} (${p.id})`);
    ws.send(fromRelay('trust', { ok, id: p.id || null, pc, challenge: ws.__challenge,
      reason: ok ? null : 'Ez a telefon nincs párosítva ezzel a PC-vel.' }));
    return;
  }
  if (type === 'unpair') {
    // only the phone itself, proven this connection, can remove its own pairing
    if (isTrusted(ws) && ws.__pairId && ws.__pairId === p.id) {
      PAIRS.remove(p.id);
      console.log(`  [par] parositas torolve a telefonon: ${ip} (${p.id})`);
      untrust(p.id);
    }
  }
}

/* ---- localhost: the PC's local servers (relay-ports.js has the rules) ------ */

let portsBusy = null;                      // one scan at a time; a second asker shares its answer

function onPortsMessage(ws, ip, type, p) {
  const answerType = type === 'ports.list' ? 'ports' : 'ports.opened';
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay(answerType, payload)); };
  if (!isTrusted(ws)) {
    answer({ ok: false, trusted: false,
      reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' });
    return;
  }
  if (type === 'ports.list') {
    const started = Date.now();
    portsBusy = portsBusy || ports.listPorts({ self: server.address().port }).finally(() => { portsBusy = null; });
    portsBusy.then(list => {
      console.log(`  [port] lista -> ${ip}: ${list.length} port, ${Date.now() - started} ms`);
      answer({ ok: true, ports: list, took: Date.now() - started,
        proxy: PORTS ? { on: true, token: GATE.issue(ws.__pairId) } : { on: false } });
    }, err => answer({ ok: false, reason: 'A portok nem olvashatók: ' + err.message }));
    return;
  }
  // ports.open: only where:'desktop' is the relay's job; "Itt" on the phone goes through /p/<port>/
  if (p.where !== 'desktop') { answer({ ok: false, reason: 'Ismeretlen hely: ' + String(p.where).slice(0, 20) }); return; }
  const u = ports.portUrl(p.port, p.path);
  if (!u.ok) { answer({ ok: false, port: p.port, reason: u.reason }); return; }
  const r = ports.openDesktop(u.url);
  console.log(`  [port] megnyitas a PC-n (${ip}): ${u.url}  ${r.ok ? r.how : r.reason}`);
  answer(Object.assign({ port: p.port, url: u.url }, r));
}

/* ---- Indítópult: START from the phone (relay-launch.js has the rules) ---------- */

const LAUNCH_TYPES = new Set(['launch.list', 'launch.run', 'launch.status', 'launch.log', 'launch.stop']);
const LAUNCH_ANSWER = { 'launch.list': 'launch', 'launch.run': 'launch.ran', 'launch.status': 'launch.status',
  'launch.log': 'launch.log', 'launch.stop': 'launch.stopped' };
const LAUNCHER = launch.createLauncher();

function onLaunchMessage(ws, ip, type, p) {
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay(LAUNCH_ANSWER[type], payload)); };
  if (!isTrusted(ws)) {
    answer({ ok: false, trusted: false,
      reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' });
    return;
  }
  let list;
  try { list = launch.buildList(); } catch (e) { answer({ ok: false, reason: 'A START lista nem olvasható: ' + e.message }); return; }
  const fail = err => answer({ ok: false, reason: 'Hiba: ' + err.message });
  if (type === 'launch.list') {
    LAUNCHER.status(list).then(st => {
      console.log(`  [start] lista -> ${ip}: ${list.size} elem`);
      answer({ ok: true, entries: [...list.values()].map(e => e.pub), running: st.running, mine: st.mine,
        proxy: PORTS ? { on: true, token: GATE.issue(ws.__pairId) } : { on: false } });
    }, fail);
    return;
  }
  if (type === 'launch.status') { LAUNCHER.status(list).then(answer, fail); return; }
  if (type === 'launch.log') { answer(LAUNCHER.tail(list, p.id)); return; }
  if (type === 'launch.stop') {
    const r = LAUNCHER.stop(list, p.id);
    console.log(`  [start] leallitas (${ip}): ${String(p.id).slice(0, 40)}  ${r.ok ? 'ok' : r.reason}`);
    answer(r);
    return;
  }
  LAUNCHER.run(list, p.id).then(r => {
    console.log(`  [start] inditas (${ip}): ${String(p.id).slice(0, 40)}  ${r.ok ? (r.how || 'ok') : r.reason}`);
    answer(r);
  }, fail);
}

/* ---- Claude: Remote Control sessions on this PC (relay-claude.js has the rules) ---------- */

const CLAUDE_TYPES = new Set(['claude.list', 'claude.start', 'claude.stop']);
const CLAUDE_ANSWER = { 'claude.list': 'claude', 'claude.start': 'claude.started', 'claude.stop': 'claude.stopped' };
const CLAUDE_RC = claude.createClaude();

function onClaudeMessage(ws, ip, type, p) {
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay(CLAUDE_ANSWER[type], payload)); };
  if (!isTrusted(ws)) {
    answer({ ok: false, trusted: false,
      reason: 'Párosítás kell: a PC-n nyisd meg a http://localhost:' + server.address().port + '/pair oldalt, és olvasd be a QR-t.' });
    return;
  }
  if (!CLAUDE) { answer({ ok: false, on: false, reason: 'A Claude munkamenetek ki vannak kapcsolva: a relét --claude kapcsolóval kell indítani (Mobile\\mobile.cmd relay).' }); return; }
  let folders;
  try { folders = claude.buildFolders(); } catch (e) { answer({ ok: false, on: true, reason: 'A mappák nem olvashatók: ' + e.message }); return; }
  const fail = err => answer({ ok: false, on: true, reason: 'Hiba: ' + err.message });
  if (type === 'claude.list') {
    const sessions = CLAUDE_RC.sessions();
    console.log(`  [claude] lista -> ${ip}: ${folders.size} mappa, ${sessions.filter(s => s.alive).length} futó munkamenet`);
    answer({ ok: true, on: true, folders: [...folders.values()].map(f => ({ key: f.key, name: f.name, hint: f.hint })),
      accounts: [...claude.loadAllow().accounts], sessions });
    return;
  }
  if (type === 'claude.stop') {
    CLAUDE_RC.stop(p.id).then(r => { console.log(`  [claude] leallitas (${ip}): ${String(p.id).slice(0, 12)}  ${r.ok ? 'ok' : r.reason}`); answer(r); }, fail);
    return;
  }
  CLAUDE_RC.start(folders, p).then(r => {
    console.log(`  [claude] inditas (${ip}): ${String(p.folder).slice(0, 4)}  ${r.ok ? (r.session.url ? 'link kesz' : 'link meg nincs') : r.reason}`);
    answer(r);
  }, fail);
}

/* ---- screenshots -------------------------------------------------------- */

const SHOT_DIR = path.join(os.tmpdir(), 'vrg-relay-shots');
const SHOT_TTL = 10 * 60 * 1000;
let shotBusy = false;

// Windows: one PowerShell run. DPI-aware first, so a 150 % display is captured at its real pixels;
// 'window' is the foreground window's rectangle, 'screen' the whole virtual desktop (all monitors).
const PS_SHOT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class VrgShot {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[VrgShot]::SetProcessDPIAware() | Out-Null
if ($env:VRG_SHOT_MODE -eq 'window') {
  $r = New-Object VrgShot+RECT
  [VrgShot]::GetWindowRect([VrgShot]::GetForegroundWindow(), [ref]$r) | Out-Null
  $x = $r.Left; $y = $r.Top; $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
} else {
  $v = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $x = $v.X; $y = $v.Y; $w = $v.Width; $h = $v.Height
}
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
$bmp.Save($env:VRG_SHOT_OUT, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;

function captureTo(file, mode, done) {
  const env = Object.assign({}, process.env, { VRG_SHOT_OUT: file, VRG_SHOT_MODE: mode });
  const opts = { env, timeout: 20000, windowsHide: true };
  if (process.env.RELAY_SHOT_FILE) {
    fs.copyFile(process.env.RELAY_SHOT_FILE, file, done);
    return;
  }
  if (process.platform === 'win32') {
    const enc = Buffer.from(PS_SHOT, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], opts, err => done(err));
    return;
  }
  if (process.platform === 'darwin') {
    execFile('screencapture', ['-x', file], opts, err => done(err));   // -W would wait for a click on the Mac
    return;
  }
  // Linux: Wayland's grim first, then ImageMagick's import on X11
  execFile('grim', [file], opts, err => {
    if (!err) return done(null);
    execFile('import', ['-window', 'root', file], opts, err2 => done(err2));
  });
}

function sweepShots() {
  fs.readdir(SHOT_DIR, (err, names) => {
    if (err) return;
    const now = Date.now();
    for (const n of names) {
      const f = path.join(SHOT_DIR, n);
      fs.stat(f, (e, st) => { if (!e && now - st.mtimeMs > SHOT_TTL) fs.unlink(f, () => {}); });
    }
  });
}

function stamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function takeShot(ws, ip, mode) {
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay('screenshot', payload)); };
  if (!SHOTS) {
    answer({ ok: false, reason: 'A képernyőkép ki van kapcsolva: a relét --shots kapcsolóval kell indítani (legeger.cmd → 1).' });
    return;
  }
  if (shotBusy) { answer({ ok: false, reason: 'Már készül egy kép.' }); return; }
  shotBusy = true;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  sweepShots();
  const id = crypto.randomBytes(16).toString('hex');
  const file = path.join(SHOT_DIR, id + '.png');
  captureTo(file, mode, err => {
    shotBusy = false;
    if (err) {
      console.log(`  ! kepernyokep hiba (${ip}): ${err.message.split('\n')[0]}`);
      answer({ ok: false, reason: 'A kép nem készült el: ' + err.message.split('\n')[0] });
      return;
    }
    fs.stat(file, (e, st) => {
      if (e) { answer({ ok: false, reason: 'A kép nem készült el.' }); return; }
      console.log(`  [kep] kepernyokep (${mode}) -> ${ip}   ${Math.round(st.size / 1024)} KB`);
      answer({ ok: true, url: `/shot/${id}.png`, name: `kepernyo-${stamp(new Date())}.png`, bytes: st.size, mode });
    });
  });
}

process.on('exit', () => { try { fs.rmSync(SHOT_DIR, { recursive: true, force: true }); } catch (e) { } });
process.on('SIGINT', () => { SCREEN.close(); process.exit(0); });

/* ---- binding, with a walk to the next free port ------------------------- */

let attempt = 0;

server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;

  const busy = wanted + attempt;
  attempt++;

  if (attempt >= MAX_TRIES) {
    console.error('');
    console.error(`  A ${wanted}..${busy} portok mind foglaltak.`);
    console.error('  Ki tartja? Parancssorban:');
    console.error(`     netstat -ano | findstr :${wanted}`);
    console.error('  Vagy adj meg egy másik portot a scripts\\_env.cmd fájlban');
    console.error('  (GYRO_PORT=...), vagy itt: node phone-relay-server.js 50123');
    console.error('');
    process.exit(1);
  }

  console.log(`  A ${busy} port foglalt — próbálom a ${wanted + attempt}-t...`);
  setTimeout(() => server.listen(wanted + attempt), 120);
});

server.on('listening', () => {
  const port = server.address().port;
  const addrs = lanAddresses();

  console.log('');
  console.log('  ===========================================');
  console.log('   A TELEFONON EZT NYISD MEG:');
  console.log('');
  if (addrs.length) {
    addrs.forEach((a, i) => console.log(
      `       http://${a.address}:${port}` + (i === 0 ? `   <-- ${a.name}` : `   (${a.name})`)
    ));
  } else {
    console.log('       (nincs WiFi/LAN cím — csatlakozz hálózatra,');
    console.log('        vagy kapcsold be a telefon hotspotot)');
  }
  console.log('');
  console.log('   Telefon és PC UGYANAZON a WiFi-n legyen.');
  console.log(SHOTS ? '   Képernyőkép a telefonra: BEKAPCSOLVA (--shots, párosított telefonnak)' : '   Képernyőkép a telefonra: ki (indítás --shots kapcsolóval)');
  console.log(SCREEN.available ? '   Képernyő élőben a telefonon: BEKAPCSOLVA (--shots, párosított telefonnak, a PC-n értesítő ablakkal)' : '   Képernyő élőben: ki' + (SHOTS ? ' (csak Windowson)' : ' (indítás --shots kapcsolóval)'));
  console.log(PORTS ? '   Localhost a telefonon (/p/<port>/): BEKAPCSOLVA (--ports, párosított telefonnak)' : '   Localhost a telefonon: ki (indítás --ports kapcsolóval)');
  console.log(CLAUDE ? '   Claude Remote Control a telefonról: BEKAPCSOLVA (--claude, párosított telefonnak)' : '   Claude Remote Control a telefonról: ki (indítás --claude kapcsolóval)');
  console.log(`   VRG Mobile párosítás (ezen a PC-n): http://localhost:${port}/pair`);
  console.log(`   Átadás, fájltábla (ezen a PC-n): http://localhost:${port}/board`);
  console.log('   Mobiladat nem jó.');
  console.log('  ===========================================');
  console.log('');
  if (!senderPath()) {
    console.log('  FIGYELEM: phone-sender.html nincs meg a mobile/ mappában —');
    console.log('  a telefon üres oldalt fog kapni.');
    console.log('');
  }
  console.log('  Leállítás: Ctrl+C');
  console.log('');
  if (PAIR_WINDOW) {
    const r = ports.openDesktop(`http://localhost:${port}/pair`);
    console.log(r && r.ok === false
      ? `  A QR ablak nem nyílt meg: nyisd meg kézzel: http://localhost:${port}/pair`
      : '  A párosító QR külön ablakban megnyílt.');
    console.log('');
  }
});

server.listen(wanted);
