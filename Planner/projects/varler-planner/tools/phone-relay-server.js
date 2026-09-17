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
// ==========================================================================

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const DEFAULT_PORT = 47291;
const MAX_TRIES = 8;                       // 47291..47298

const wanted = Number(process.argv[2]) || Number(process.env.GYRO_PORT) || DEFAULT_PORT;
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
      app: 'varler-phone-relay',
      v: 2
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',        // file:// sends Origin: null
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server });
const clients = new Set();

function roleOf(ws) { return ws.__role || null; }

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  console.log(`  + csatlakozott: ${ip}   (${clients.size} kliens)`);

  ws.on('message', raw => {
    const payload = raw.toString();

    // learn this client's role from its hello, and log it once
    let from = null;
    try {
      const m = JSON.parse(payload);
      from = (m && m.from) || null;
      if (m && m.type === 'hello' && !ws.__role) {
        ws.__role = (m.payload && m.payload.role) || from || null;
        console.log(`    ${ip} = ${ws.__role} ${(m.payload && m.payload.app) || ''}`);
      }
    } catch (e) { /* not JSON: pass it through untouched */ }

    for (const other of clients) {
      if (other === ws || other.readyState !== other.OPEN) continue;
      const r = roleOf(other);
      if (from && r && r === from) continue;      // same role: don't echo sideways
      other.send(payload);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`  - lecsatlakozott: ${ip}   (${clients.size} kliens)`);
  });

  ws.on('error', err => console.log(`  ! socket hiba: ${err.message}`));
});

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
});

server.listen(wanted);
