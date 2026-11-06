// ==========================================================================
// relay-ports.js — the PC's local servers for VRG Mobile (WP M8 · Localhost, D-10 = C).
//
// What phone-relay-server.js needs to answer `ports.list` and `ports.open`, and to run the
// `/p/<port>/…` reverse proxy. The parsing and the URL rules are plain functions, so
// Mobile/tests/relay-ports.js checks them on fixtures without a relay.
//
//   ports.list  -> every TCP port listening on this PC's loopback or all addresses, with the owning
//                  process, the HTTP <title> from a 1-second probe, and a known name from
//                  Mobile/catalogue/ports.json (generated from launcher/vrg-menu.json's servers).
//   ports.open  -> http://localhost:<port><path> in its own window on the PC: the portable Chrome's
//                  --app= when it is there, else the system browser. The URL is BUILT here from a port
//                  number and a checked path; a URL string from the phone is never opened.
//   /p/<port>/  -> a reverse proxy to localhost:<port>, for paired phones only, and only when the
//                  relay was started with --ports. A paired phone gets a token with its ports.list
//                  answer; the first request carries it as ?vrg_t=…, which becomes an HttpOnly cookie.
//
// Windows reads `netstat -ano` + `tasklist /fo csv /nh` rather than Get-NetTCPConnection: two plain
// executables answer in ~100 ms where a PowerShell start takes a second or more, and the listening
// rows are recognised by their foreign address (0.0.0.0:0 / [::]:0), not by the state word, which
// Windows translates ("FIGYELÉS" on a Hungarian install).
// ==========================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const PROBE_MS = 1000;
const PROXY_COOKIE = 'vrg_ports';
const TOKEN_TTL = 12 * 60 * 60 * 1000;     // a token outlives a phone's dropped socket, not a day
const CATALOGUE = path.join(__dirname, '..', '..', '..', '..', 'Mobile', 'catalogue', 'ports.json');

// Ports the phone never needs to see: Windows' own services. They are still listed, flagged `system`,
// so the phone can show them under "Egyéb" instead of hiding them silently.
const SYSTEM_PROCS = /^(system|svchost|lsass|wininit|services|spoolsv|searchindexer|mdnsresponder|jhi_service|ibtsiva|sqlwriter|vmms|vmcompute|wslservice|systemd.*|sshd|cupsd|avahi-daemon|rpcbind|dnsmasq|chronyd|smbd|nmbd)$/i;

/* ---- addresses ------------------------------------------------------------ */

/** Only loopback and "all addresses" are reachable as localhost; a port bound to one LAN address is not. */
function hostOf(addr) {
  if (addr === '0.0.0.0' || addr === '127.0.0.1' || addr === '*') return '127.0.0.1';
  if (addr === '::' || addr === '::1' || addr === '[::]' || addr === '[::1]') return '::1';
  return null;
}

/** "0.0.0.0:8124", "[::1]:8124", "*:8124", "[::ffff:127.0.0.1]:80" -> {addr, port} */
function splitEndpoint(s) {
  const m = /^\[?(.*?)\]?:(\d+|\*)$/.exec(String(s || '').trim());
  if (!m) return null;
  let addr = m[1];
  if (addr.startsWith('::ffff:')) addr = addr.slice(7);
  return { addr, port: m[2] === '*' ? 0 : Number(m[2]) };
}

/** Several rows of one port (v4 + v6, 0.0.0.0 + 127.0.0.1) become one entry; IPv4 is preferred for the probe. */
function merge(rows) {
  const by = new Map();
  for (const r of rows) {
    const host = hostOf(r.addr);
    if (!host || !validPort(r.port)) continue;
    const e = by.get(r.port) || { port: r.port, host, pid: r.pid || null, process: r.process || null };
    if (host === '127.0.0.1') e.host = host;
    if (!e.pid && r.pid) e.pid = r.pid;
    if (!e.process && r.process) e.process = r.process;
    by.set(r.port, e);
  }
  return [...by.values()].sort((a, b) => a.port - b.port);
}

/* ---- parsers ---------------------------------------------------------------- */

/** `netstat -ano` (Windows): the listening TCP rows -> [{port, host, pid}]. */
function parseNetstat(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 4 || f[0].toUpperCase() !== 'TCP') continue;
    const local = splitEndpoint(f[1]);
    const foreign = splitEndpoint(f[2]);
    if (!local || !foreign) continue;
    // listening = no remote end; the state word is localised, the zero foreign port is not
    if (foreign.port !== 0) continue;
    const pid = Number(f[f.length - 1]);
    rows.push({ addr: local.addr, port: local.port, pid: Number.isInteger(pid) ? pid : null });
  }
  return merge(rows);
}

/** `tasklist /fo csv /nh` -> Map(pid -> "node"), without ".exe". */
function parseTasklist(text) {
  const out = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^"([^"]*)","(\d+)"/.exec(line.trim());
    if (m) out.set(Number(m[2]), m[1].replace(/\.exe$/i, ''));
  }
  return out;
}

/** `ss -ltnpH` (Linux; the header line is skipped too if present) -> [{port, host, pid, process}]. */
function parseSs(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 4 || f[0] !== 'LISTEN') continue;
    const local = splitEndpoint(f[3].replace(/%[^\]:]+/, ''));     // "127.0.0.53%lo:53"
    if (!local) continue;
    const u = /users:\(\("([^"]+)",pid=(\d+)/.exec(line);
    rows.push({ addr: local.addr, port: local.port, pid: u ? Number(u[2]) : null, process: u ? u[1] : null });
  }
  return merge(rows);
}

/** The <title> of a page, entities decoded, whitespace folded, at most 80 characters. */
function pickTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  if (!m) return null;
  const t = m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 80) : null;
}

/* ---- URL rules -------------------------------------------------------------- */

function validPort(p) { return Number.isInteger(p) && p >= 1 && p <= 65535; }

/**
 * The only way a URL to open is made: from a port NUMBER and a path that must start with one "/".
 * -> {ok:true, url} | {ok:false, reason}. Strings like "8124", "//evil.example", "/x\\y", "@host",
 * spaces or control characters are refused; the result is checked again after URL parsing.
 */
function portUrl(port, p) {
  if (typeof port !== 'number' || !validPort(port)) return { ok: false, reason: 'A port 1 és 65535 közötti egész szám legyen.' };
  const pathPart = p == null || p === '' ? '/' : p;
  if (typeof pathPart !== 'string' || pathPart.length > 1024 || !pathPart.startsWith('/') || pathPart.startsWith('//') ||
      /[\\\s@\u0000-\u001f\u007f]/.test(pathPart)) {
    return { ok: false, reason: 'Hibás útvonal: "/"-rel kezdődjön, szóköz és "\\" nélkül.' };
  }
  const url = `http://localhost:${port}${pathPart}`;
  let u;
  try { u = new URL(url); } catch (e) { return { ok: false, reason: 'Hibás cím.' }; }
  if (u.protocol !== 'http:' || u.hostname !== 'localhost' || Number(u.port || 80) !== port || u.username || u.password) {
    return { ok: false, reason: 'Csak localhost cím nyitható meg.' };
  }
  return { ok: true, url: u.href };
}

/** "/p/8124/a/b?x=1" -> {port:8124, rest:"/a/b?x=1"}; "/p/8124" -> {port, rest:null} (needs the slash). */
function parseProxyPath(url) {
  const m = /^\/p\/(\d{1,5})(\/.*)?$/.exec(String(url || ''));
  if (!m) return null;
  const port = Number(m[1]);
  if (!validPort(port) || String(port) !== m[1]) return null;
  return { port, rest: m[2] == null ? null : m[2] };
}

/**
 * A proxied server's Location header, as the phone must follow it: its own absolute localhost URLs and
 * root-relative paths stay inside /p/<port>/; relative paths and other sites are left as they are.
 */
function rewriteLocation(loc, port) {
  if (typeof loc !== 'string' || !loc) return loc;
  const abs = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::(\d+))?(\/[^]*)?$/i.exec(loc);
  if (abs) {
    const p = Number(abs[2] || 80);
    return p === port ? `/p/${port}${abs[3] || '/'}` : (validPort(p) ? `/p/${p}${abs[3] || '/'}` : loc);
  }
  if (loc.startsWith('/') && !loc.startsWith('//')) return `/p/${port}${loc}`;
  return loc;
}

/** The query without ?vrg_t= (the token is moved into a cookie and never reaches the proxied server). */
function stripToken(rest) {
  const q = rest.indexOf('?');
  if (q < 0) return { path: rest, token: null };
  const params = new URLSearchParams(rest.slice(q + 1));
  const token = params.get('vrg_t');
  params.delete('vrg_t');
  const s = params.toString();
  return { path: rest.slice(0, q) + (s ? '?' + s : ''), token };
}

function cookieValue(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** The request's Cookie header without our own cookie, so the proxied server never sees the token. */
function cookiesWithout(header, name) {
  if (!header) return header;
  const keep = String(header).split(';').map(s => s.trim()).filter(s => s && !s.startsWith(name + '='));
  return keep.length ? keep.join('; ') : undefined;
}

/* ---- the proxy gate: which tokens belong to a paired phone ----------------- */

function createGate(opts) {
  opts = opts || {};
  const now = opts.now || Date.now;
  const ttl = opts.ttl || TOKEN_TTL;
  const tokens = new Map();                   // token -> {pairId, expires}
  return {
    /** One token per pairing, renewed on every ports.list. */
    issue(pairId) {
      for (const [t, v] of tokens) if (v.pairId === pairId && v.expires > now()) { v.expires = now() + ttl; return t; }
      const t = crypto.randomBytes(16).toString('hex');
      tokens.set(t, { pairId, expires: now() + ttl });
      return t;
    },
    /** The pairing still exists (`isPaired`) and the token has not expired. */
    check(token, isPaired) {
      if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) return false;
      const v = tokens.get(token);
      if (!v) return false;
      if (v.expires <= now() || (isPaired && !isPaired(v.pairId))) { tokens.delete(token); return false; }
      return true;
    },
    revoke(pairId) { for (const [t, v] of tokens) if (v.pairId === pairId) tokens.delete(t); },
    size() { return tokens.size; },
  };
}

/* ---- the catalogue: port -> tool ------------------------------------------ */

function loadCatalogue(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file || CATALOGUE, 'utf8'));
    const out = new Map();
    for (const e of j.ports || []) if (validPort(e.port)) out.set(e.port, { id: e.id, name: e.name, path: e.path || '/' });
    return out;
  } catch (e) { return new Map(); }
}

/* ---- live: the listening ports with their titles --------------------------- */

function run(cmd, args) {
  return new Promise(res => execFile(cmd, args, { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 },
    (err, out) => res(err && !out ? '' : String(out || ''))));
}

/** GET / with a 1-second budget: does it speak HTTP, and what is its title? Reads at most 64 KB. */
function probe(host, port, ms) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (!done) { done = true; res(v); } };
    const req = http.get({ host, port, path: '/', timeout: ms || PROBE_MS, headers: { 'User-Agent': 'vrg-relay-ports', Accept: 'text/html' } }, r => {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', d => { body += d; if (body.length > 65536 || /<\/title>/i.test(body)) { finish({ http: true, status: r.statusCode, title: pickTitle(body) }); r.destroy(); } });
      r.on('end', () => finish({ http: true, status: r.statusCode, title: pickTitle(body) }));
      r.on('error', () => finish({ http: true, status: r.statusCode, title: pickTitle(body) }));
    });
    req.on('timeout', () => { req.destroy(); finish({ http: false, status: null, title: null }); });
    req.on('error', () => finish({ http: false, status: null, title: null }));
    setTimeout(() => { req.destroy(); finish({ http: false, status: null, title: null }); }, (ms || PROBE_MS) + 200);
  });
}

async function readListening(platform) {
  if ((platform || process.platform) === 'win32') {
    const [net, tasks] = await Promise.all([run('netstat', ['-ano']), run('tasklist', ['/fo', 'csv', '/nh'])]);
    const names = parseTasklist(tasks);
    return parseNetstat(net).map(e => Object.assign(e, { process: names.get(e.pid) || null }));
  }
  return parseSs(await run('ss', ['-ltnpH']));
}

/**
 * The answer to ports.list. `self` is the relay's own port (marked, not hidden). Probes run 24 at a
 * time, so even 80 listening ports answer in about four seconds at worst.
 */
async function listPorts(opts) {
  opts = opts || {};
  const known = opts.catalogue || loadCatalogue();
  const found = opts.rows || await readListening(opts.platform);
  const out = [];
  let i = 0;
  const worker = async () => {
    while (i < found.length) {
      const e = found[i++];
      const k = known.get(e.port) || null;
      const system = !k && !!e.process && SYSTEM_PROCS.test(e.process);
      const pr = system ? { http: false, status: null, title: null } : await (opts.probe || probe)(e.host, e.port, PROBE_MS);
      out.push({
        port: e.port, process: e.process, pid: e.pid,
        http: pr.http, status: pr.status, title: pr.title,
        known: k ? k.name : null, id: k ? k.id : null, path: k ? k.path : '/',
        system, self: e.port === opts.self,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(24, found.length) }, worker));
  return out.sort((a, b) => a.port - b.port);
}

/* ---- opening on the desktop ------------------------------------------------- */

/** Full\tools\chrome\chrome.exe beside the repo (CLAUDE.md, Drive layout), when it is there. */
function portableChrome() {
  const repo = path.resolve(__dirname, '..', '..', '..', '..');
  const exe = path.join(path.dirname(repo), 'tools', 'chrome', 'chrome.exe');
  return fs.existsSync(exe) ? exe : null;
}

/** How a URL is opened here: [command, args]. A pure function, so the test can see it without a window. */
function openCommand(url, platform, chrome) {
  if (chrome) return [chrome, ['--app=' + url, '--new-window']];
  const p = platform || process.platform;
  // no cmd.exe: it would read "&" and "%" in the path; the URL handler gets it as one argument
  if (p === 'win32') return ['rundll32.exe', ['url.dll,FileProtocolHandler', url]];
  if (p === 'darwin') return ['open', ['-n', url]];
  return ['xdg-open', [url]];
}

/** Opens `url` (already checked by portUrl) on this PC. RELAY_OPEN_DRY=1 only reports the command. */
function openDesktop(url) {
  const [cmd, args] = openCommand(url, process.platform, portableChrome());
  if (process.env.RELAY_OPEN_DRY === '1') return { ok: true, how: path.basename(cmd), dry: true, cmd, args };
  try {
    const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
    c.on('error', () => {});
    c.unref();
    return { ok: true, how: path.basename(cmd) };
  } catch (e) {
    return { ok: false, reason: 'Nem sikerült megnyitni: ' + e.message };
  }
}

/* ---- the reverse proxy ------------------------------------------------------ */

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
  'transfer-encoding', 'upgrade']);

/** Forwards req to localhost:<port><rest> and streams the answer back, Location rewritten. */
function proxy(req, res, port, rest, host) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) headers[k] = v;
  headers.host = `localhost:${port}`;
  const ck = cookiesWithout(req.headers.cookie, PROXY_COOKIE);
  if (ck) headers.cookie = ck; else delete headers.cookie;
  if (headers.referer) headers.referer = String(headers.referer).replace(/^https?:\/\/[^/]+\/p\/\d+/, `http://localhost:${port}`);
  if (headers.origin) headers.origin = `http://localhost:${port}`;
  const up = http.request({ host: host || '127.0.0.1', port, path: rest, method: req.method, headers, timeout: 30000 }, r => {
    const out = {};
    for (const [k, v] of Object.entries(r.headers)) if (!HOP.has(k)) out[k] = v;
    if (out.location) out.location = rewriteLocation(out.location, port);
    res.writeHead(r.statusCode || 502, out);
    r.pipe(res);
  });
  up.on('timeout', () => up.destroy(new Error('timeout')));
  up.on('error', err => {
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`A localhost:${port} nem válaszol (${err.code || err.message}).`);
  });
  req.pipe(up);
}

module.exports = {
  parseNetstat, parseTasklist, parseSs, pickTitle, portUrl, parseProxyPath, rewriteLocation, stripToken,
  cookieValue, cookiesWithout, createGate, loadCatalogue, listPorts, readListening, probe, openCommand, openDesktop,
  portableChrome, proxy, validPort, PROXY_COOKIE, TOKEN_TTL, CATALOGUE,
};
