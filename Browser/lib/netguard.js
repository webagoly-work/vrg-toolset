// netguard.js — the only way serve.js reaches the internet. A page the reader fetches must not become a way into this PC
// or the local network (SSRF): only http / https, only public addresses, checked inside the socket's DNS lookup (so a
// name that resolves to 127.0.0.1 or 192.168.x, even on a second lookup, is refused), every redirect hop checked again,
// a size cap, a timeout, no cookies, no credentials. --allow-lan lifts the address rule for the LAN only (never loopback).
//   const g = createGuard({ allowLan }); await g.get(url, { maxBytes, timeout, accept }) → { status, url, type, charset, body: Buffer }
//   (opts.lookup and opts.transport replace DNS and the socket in tests; agent: false keeps any global proxy agent out)
'use strict';
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

// is this address one a fetch from here must never reach?  kind: 'loopback' | 'private' | 'reserved' | ''
function addressKind(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 0) return 'loopback';
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)) return 'private';
    if (a >= 224 || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))) return 'reserved';
    return '';
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (m) return addressKind(m[1]);
    if (s === '::1' || s === '::') return 'loopback';
    if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s)) return 'private';
    if (/^ff/.test(s) || /^2001:db8/.test(s) || /^64:ff9b/.test(s)) return 'reserved';
    return '';
  }
  return 'reserved';
}

function createGuard(opts) {
  const o = opts || {};
  const allow = kind => !kind || (o.allowLan && kind === 'private');
  const resolver = o.lookup || dns.lookup;
  const UA = o.userAgent || 'VRG-Bongeszo/1.0 (olvaso; helyi)';

  // dns.lookup with every answer checked; Node calls this for each connection the request makes
  function safeLookup(host, options, cb) {
    if (typeof options === 'function') { cb = options; options = {}; }
    resolver(host, Object.assign({}, options, { all: true }), (err, addrs) => {
      if (err) return cb(err);
      const list = Array.isArray(addrs) ? addrs : [{ address: addrs, family: net.isIPv6(addrs) ? 6 : 4 }];
      const bad = list.find(a => !allow(addressKind(a.address)));
      if (bad) { const e = new Error('blocked address ' + bad.address); e.code = 'VRG_BLOCKED'; e.kind = addressKind(bad.address); return cb(e); }
      if (options.all) return cb(null, list);
      cb(null, list[0].address, list[0].family);
    });
  }

  function check(url) {
    let u;
    try { u = new URL(url); } catch (e) { return { ok: false, code: 'invalid', hu: 'Érvénytelen cím.' }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, code: 'scheme', hu: 'Csak http és https címet olvasok.' };
    if (u.username || u.password) return { ok: false, code: 'credentials', hu: 'Felhasználónevet vagy jelszót tartalmazó címet nem olvasok.' };
    const h = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(h) && !allow(addressKind(h))) return { ok: false, code: 'address', hu: 'Helyi vagy belső hálózati címet a felolvasó nem ér el.' };
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home\.arpa)$/i.test(h) && !(o.allowLan && !/localhost$/i.test(h))) return { ok: false, code: 'address', hu: 'Helyi nevet a felolvasó nem ér el.' };
    return { ok: true, url: u };
  }

  function once(u, lim) {
    return new Promise((resolve, reject) => {
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, {
        method: 'GET', lookup: safeLookup, timeout: lim.timeout, agent: false,
        headers: { 'user-agent': UA, accept: lim.accept || 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'hu,en;q=0.7', 'accept-encoding': 'identity' },
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, u).href, status: res.statusCode }); }
        const chunks = []; let n = 0;
        res.on('data', c => { n += c.length; if (n > lim.maxBytes) { req.destroy(Object.assign(new Error('too large'), { code: 'VRG_TOO_LARGE' })); return; } chunks.push(c); });
        res.on('end', () => {
          const ct = String(res.headers['content-type'] || '');
          const cs = /charset=["']?([\w-]+)/i.exec(ct);
          resolve({ status: res.statusCode, url: u.href, type: ct.split(';')[0].trim().toLowerCase(), charset: cs ? cs[1].toLowerCase() : '', body: Buffer.concat(chunks), headers: res.headers });
        });
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'VRG_TIMEOUT' })));
      req.on('error', reject);
      req.end();
    });
  }

  async function get(url, lim0) {
    const lim = Object.assign({ maxBytes: 3 * 1024 * 1024, timeout: 12000, redirects: 5 }, lim0 || {});
    let cur = url;
    for (let hop = 0; hop <= lim.redirects; hop++) {
      const c = check(cur);
      if (!c.ok) { const e = new Error(c.hu); e.code = 'VRG_' + c.code.toUpperCase(); e.hu = c.hu; throw e; }
      const r = await (o.transport || once)(c.url, lim);             // transport: tests only (a fake network)
      if (!r.redirect) return r;
      cur = r.redirect;
    }
    const e = new Error('too many redirects'); e.code = 'VRG_REDIRECTS'; e.hu = 'Túl sok átirányítás.'; throw e;
  }

  return { check, get, safeLookup };
}

// a fetch error → a Hungarian sentence for the page
function explain(e) {
  const c = e && e.code;
  if (e && e.hu) return e.hu;
  if (c === 'VRG_BLOCKED') return 'A cím helyi vagy belső hálózati gépre mutat; a felolvasó oda nem megy.';
  if (c === 'VRG_TOO_LARGE') return 'Az oldal túl nagy a felolvasónak (3 MB fölött).';
  if (c === 'VRG_TIMEOUT') return 'Az oldal nem válaszolt időben.';
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'Nincs ilyen név, vagy nincs internetkapcsolat.';
  if (c === 'ECONNREFUSED' || c === 'ECONNRESET') return 'A kiszolgáló elutasította a kapcsolatot.';
  if (c && /CERT|SSL|TLS/.test(c)) return 'A kiszolgáló tanúsítványa nem megbízható.';
  return 'Az oldal nem tölthető le (' + (c || (e && e.message) || 'hiba') + ').';
}

module.exports = { createGuard, addressKind, explain };
