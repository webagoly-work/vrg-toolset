#!/usr/bin/env node
// Mobile/tests/relay-ports.js — Localhost (WP M8, D-10 = C) against a real relay process: the netstat /
// tasklist / ss parsers on fixtures, URL construction refusing anything but ports 1–65535 and clean
// paths, the proxy path and Location rewrite, the token gate, the catalogue being current, and then
// the relay itself: an untrusted phone refused, a paired phone listing a real local server with its
// title, "A PC-n" (dry run: no window opens), and the /p/<port>/ proxy on and off.
//
//   node Mobile/tests/relay-ports.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses ports 47393 and 47394 and a
// temporary paired-phones file, so a running relay is not disturbed.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const R = require(path.join(TOOLS, 'relay-ports.js'));
const GEN = require(path.join(REPO, 'Mobile/catalogue/ports-gen.js'));

const PORT = 47393;          // with --ports
const PORT_OFF = 47394;      // without
const FX = path.join(__dirname, 'fixtures');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-ports-'));
const FILE = path.join(TMP, 'relay-paired.json');

function startRelay(port, flags) {
  const r = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(port)].concat(flags), {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: FILE, RELAY_OPEN_DRY: '1', RELAY_PORTS: '' }),
  });
  r.log = ''; r.stdout.on('data', d => r.log += d); r.stderr.on('data', d => r.log += d);
  return r;
}

function get(port, p, opts) {
  opts = opts || {};
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: opts.method || 'GET', headers: opts.headers || {} }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b }));
    });
    req.on('error', rej); req.end();
  });
}

function phone(port) {
  const ws = new WS(`ws://127.0.0.1:${port}`);
  const got = [];
  let seq = 0;
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) { } });
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: 'phone', seq: ++seq, t: Date.now(), type, payload }, to ? { to } : {})));
  const wait = async (type, n, ms) => {
    for (let i = 0; i < (ms || 2000) / 50; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  const c = { ws, got, send, wait };
  c.ready = new Promise(r => ws.on('open', r)).then(async () => {
    send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['state', 'cmd', 'ports'] });
    c.welcome = await wait('welcome');
    return c;
  });
  return c;
}

/** A local server like MindMap: a title, a redirect to its own absolute URL, and a page using root paths. */
function fakeServer() {
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      if (req.url === '/go') { rs.writeHead(302, { Location: `http://localhost:${s.address().port}/there?a=1` }); rs.end(); return; }
      if (req.url === '/rel') { rs.writeHead(302, { Location: '/abs' }); rs.end(); return; }
      if (req.url === '/echo') { rs.writeHead(200, { 'Content-Type': 'application/json' }); rs.end(JSON.stringify({ host: req.headers.host, cookie: req.headers.cookie || null, url: req.url })); return; }
      rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      rs.end(`<!doctype html><html><head><title>Próba &amp; teszt</title></head><body>path=${req.url}</body></html>`);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  // ---- parsers on fixtures -----------------------------------------------------------------------
  console.log('relay-ports.js: parsers');
  const net = R.parseNetstat(fs.readFileSync(path.join(FX, 'netstat-win.txt'), 'utf8'));
  ok(net.map(e => e.port).join(',') === '135,5037,8124,8797', 'netstat: listening TCP on loopback / all addresses only: ' + net.map(e => e.port).join(','));
  ok(net.find(e => e.port === 5037), 'netstat: a localised state word ("FIGYELÉS") still counts as listening');
  ok(!net.find(e => e.port === 139), 'netstat: a port bound to one LAN address is left out (not reachable as localhost)');
  ok(!net.find(e => e.port === 5939), 'netstat: an established connection is not a listening port');
  ok(net.find(e => e.port === 8124).host === '127.0.0.1' && net.find(e => e.port === 8797).host === '::1', 'netstat: v4 + v6 rows merge, IPv6-only stays ::1');
  const names = R.parseTasklist(fs.readFileSync(path.join(FX, 'tasklist.csv'), 'utf8'));
  ok(names.get(7311) === 'node' && names.get(1252) === 'svchost' && names.size === 5, 'tasklist: pid -> process name without .exe');
  const ss = R.parseSs(fs.readFileSync(path.join(FX, 'ss.txt'), 'utf8'));
  ok(ss.map(e => e.port).join(',') === '8123,8124,8797', 'ss: listening on loopback / all, not on a LAN address: ' + ss.map(e => e.port).join(','));
  ok(ss.find(e => e.port === 8124).process === 'node' && ss.find(e => e.port === 8124).pid === 4242, 'ss: process name and pid from users:((…))');
  ok(R.pickTitle('<html><head><TITLE>\n  VRG &amp; MindMap \n</TITLE>') === 'VRG & MindMap', 'title: entities decoded, whitespace folded');
  ok(R.pickTitle('<html>no title</html>') === null, 'title: none -> null');

  // ---- URL rules ---------------------------------------------------------------------------------
  console.log('relay-ports.js: URL rules');
  ok(R.portUrl(8124, '/').url === 'http://localhost:8124/', 'portUrl(8124, "/") = http://localhost:8124/');
  ok(R.portUrl(8131, '/Planner/x.html?a=1#b').url === 'http://localhost:8131/Planner/x.html?a=1#b', 'a path with query and hash is kept');
  ok(R.portUrl(1).ok && R.portUrl(65535).ok, 'ports 1 and 65535 are allowed');
  const badPorts = [0, 65536, -1, 1.5, NaN, '8124', null, undefined, Infinity, [8124]];
  ok(badPorts.every(p => !R.portUrl(p, '/').ok), 'refused ports: 0, 65536, -1, 1.5, NaN, "8124", null, undefined, Infinity, [8124]');
  const badPaths = ['//evil.example/', 'evil', 'http://evil.example/', '/a b', '/x\\y', '/@evil', '/\u0000', '/\n', 5];
  ok(badPaths.every(p => !R.portUrl(8124, p).ok), 'refused paths: //host, no slash, a full URL, space, backslash, @, control characters, not a string');
  ok(new URL(R.portUrl(8124, '/%2e%2e/x').url).hostname === 'localhost', 'whatever the path, the host stays localhost');

  ok(JSON.stringify(R.parseProxyPath('/p/8124/a/b?x=1')) === '{"port":8124,"rest":"/a/b?x=1"}', 'proxy path /p/8124/a/b?x=1 -> 8124 + /a/b?x=1');
  ok(R.parseProxyPath('/p/8124').rest === null, '/p/8124 without the slash is recognised (and redirected by the relay)');
  ok([ '/p/0/', '/p/65536/', '/p/08124/', '/p/abc/', '/q/8124/', '/p/123456/' ].every(u => R.parseProxyPath(u) === null), 'refused proxy paths: 0, 65536, leading zero, letters, other prefixes, six digits');
  ok(R.rewriteLocation('http://localhost:8124/x?y=1', 8124) === '/p/8124/x?y=1', 'Location http://localhost:8124/x -> /p/8124/x');
  ok(R.rewriteLocation('http://127.0.0.1:8124', 8124) === '/p/8124/', 'Location http://127.0.0.1:8124 -> /p/8124/');
  ok(R.rewriteLocation('/login', 8124) === '/p/8124/login', 'Location /login -> /p/8124/login');
  ok(R.rewriteLocation('http://localhost:8797/', 8124) === '/p/8797/', 'Location to another local port -> that port\'s /p/');
  ok(R.rewriteLocation('next.html', 8124) === 'next.html' && R.rewriteLocation('https://github.com/', 8124) === 'https://github.com/' &&
     R.rewriteLocation('//cdn.example/x', 8124) === '//cdn.example/x', 'relative paths and other sites are left alone');
  const st = R.stripToken('/x?a=1&vrg_t=abc&b=2');
  ok(st.path === '/x?a=1&b=2' && st.token === 'abc', 'the token is taken out of the query');
  ok(R.cookiesWithout('a=1; vrg_ports=t; b=2', 'vrg_ports') === 'a=1; b=2' && R.cookiesWithout('vrg_ports=t', 'vrg_ports') === undefined,
    'the proxy cookie never reaches the proxied server');

  let t = 1000;
  const g = R.createGate({ now: () => t, ttl: 5000 });
  const tok = g.issue('p1');
  ok(/^[0-9a-f]{32}$/.test(tok) && g.check(tok, () => true), 'gate: an issued token checks out');
  ok(g.issue('p1') === tok, 'gate: one token per pairing');
  ok(!g.check(tok, id => id !== 'p1'), 'gate: a token whose pairing is gone is refused');
  const tok2 = g.issue('p2');
  t += 6000;
  ok(!g.check(tok2, () => true), 'gate: an expired token is refused');
  const tok3 = g.issue('p3'); g.revoke('p3');
  ok(!g.check(tok3, () => true) && !g.check('nope', () => true) && !g.check(undefined, () => true), 'gate: revoked, malformed and missing tokens are refused');

  const oc = R.openCommand('http://localhost:8124/', 'win32', 'C:\\chrome\\chrome.exe');
  ok(oc[1][0] === '--app=http://localhost:8124/', 'desktop: the portable Chrome gets --app=<url>');
  const sys = R.openCommand('http://localhost:8124/a&b=%PATH%', 'win32', null);
  ok(sys[0] === 'rundll32.exe' && sys[1][1] === 'http://localhost:8124/a&b=%PATH%', 'desktop: without it the system browser, with no cmd.exe to read & or %');

  ok(GEN.build() === fs.readFileSync(GEN.OUT, 'utf8').replace(/\r\n/g, '\n'), 'Mobile/catalogue/ports.json is current with launcher/vrg-menu.json (ports-gen.js)');
  const cat = R.loadCatalogue();
  ok(cat.get(8124) && /MindMap/.test(cat.get(8124).name) && cat.get(47291), 'the catalogue names 8124 (MindMap) and 47291 (the relay)');

  // listPorts with injected rows: no system probing, catalogue names, self marked
  const listed = await R.listPorts({ rows: net.map(e => Object.assign(e, { process: names.get(e.pid) })), catalogue: cat, self: 8797,
    probe: async (h, p) => ({ http: p === 8124, status: p === 8124 ? 200 : null, title: p === 8124 ? 'MindMap' : null }) });
  ok(listed.find(e => e.port === 8124).known === 'VRG MindMap' && listed.find(e => e.port === 8124).title === 'MindMap', 'list: known name and probed title together');
  ok(listed.find(e => e.port === 135).system === true && listed.find(e => e.port === 8797).self === true, 'list: svchost is flagged system, the relay\'s port self');

  // ---- the relay ---------------------------------------------------------------------------------
  console.log('phone-relay-server.js --ports');
  const site = await fakeServer();
  const SITE = site.address().port;
  const relay = startRelay(PORT, ['--ports']);
  const off = startRelay(PORT_OFF, []);
  await sleep(900);
  ok(/Localhost a telefonon \(\/p\/<port>\/\): BEKAPCSOLVA/.test(relay.log), 'the banner says the proxy is on');
  ok(JSON.parse((await get(PORT, '/whoami')).body).ports === true && JSON.parse((await get(PORT_OFF, '/whoami')).body).ports === false, '/whoami tells whether --ports is on');

  // an untrusted phone
  const a = await phone(PORT).ready;
  a.send('ports.list', {}, 'relay');
  const l0 = await a.wait('ports');
  ok(l0 && l0.payload.ok === false && l0.payload.trusted === false && !l0.payload.ports, 'an untrusted phone asking for the list is refused');
  a.send('ports.open', { port: SITE, path: '/', where: 'desktop' }, 'relay');
  const o0 = await a.wait('ports.opened');
  ok(o0 && o0.payload.ok === false && o0.payload.trusted === false, 'an untrusted phone cannot open anything on the PC');
  ok(!/megnyitas a PC-n/.test(relay.log), '… and nothing was opened');
  ok((await get(PORT, `/p/${SITE}/`)).status === 403, 'the proxy refuses a request with no token');
  ok((await get(PORT, `/p/${SITE}/?vrg_t=${'0'.repeat(32)}`)).status === 403, 'the proxy refuses a made-up token');

  // pair it (the code from this PC's own /pair page)
  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get(PORT, '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  a.send('pair', { code, device: 'Teszt telefon', pub }, 'relay');
  const paired = await a.wait('paired');
  ok(paired && paired.payload.ok, 'the phone pairs');
  const pairId = paired.payload.id;

  a.send('ports.list', {}, 'relay');
  const l1 = await a.wait('ports', 2, 15000);
  const mine = l1 && l1.payload.ports && l1.payload.ports.find(e => e.port === SITE);
  ok(l1 && l1.payload.ok === true && Array.isArray(l1.payload.ports), `the paired phone gets the list (${l1 && l1.payload.ports ? l1.payload.ports.length : 0} ports, ${l1 && l1.payload.took} ms)`);
  ok(mine && mine.http === true && mine.title === 'Próba & teszt' && mine.process === 'node', 'a local server is listed with process "node" and its <title>');
  ok(l1.payload.ports.find(e => e.port === PORT && e.self), 'the relay\'s own port is marked self');
  ok(l1.payload.proxy && l1.payload.proxy.on === true && /^[0-9a-f]{32}$/.test(l1.payload.proxy.token), 'with --ports the answer carries the proxy token');
  const token = l1.payload.proxy.token;
  const fxKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(FX, 'relay-ports-answer.json'), 'utf8')).payload.ports[0]).sort().join(',');
  ok(mine && Object.keys(mine).sort().join(',') === fxKeys, 'the live entry has the same fields as the Kotlin test fixture (relay-ports-answer.json)');

  a.send('ports.open', { port: SITE, path: '/x?y=1', where: 'desktop' }, 'relay');
  const o1 = await a.wait('ports.opened', 2);
  ok(o1 && o1.payload.ok === true && o1.payload.url === `http://localhost:${SITE}/x?y=1` && o1.payload.dry, '"A PC-n" opens http://localhost:<port><path> (dry run): ' + (o1 && o1.payload.how));
  for (const bad of [{ port: 0 }, { port: 70000 }, { port: String(SITE) }, { port: SITE, path: '//evil.example/' }, { port: SITE, path: 'http://evil.example/' }]) {
    a.send('ports.open', Object.assign({ path: '/', where: 'desktop' }, bad), 'relay');
  }
  await sleep(300);
  const refused = a.got.filter(m => m.type === 'ports.opened').slice(-5);
  ok(refused.length === 5 && refused.every(m => m.payload.ok === false), 'ports.open refuses port 0, 70000, a string port, //host and a full URL');
  a.send('ports.open', { port: SITE, path: '/', where: 'phone' }, 'relay');
  ok((await a.wait('ports.opened', 8)).payload.ok === false, 'ports.open only knows where:"desktop"');

  // the proxy
  const first = await get(PORT, `/p/${SITE}/page?x=1&vrg_t=${token}`);
  const cookie = (first.headers['set-cookie'] || [''])[0].split(';')[0];
  ok(first.status === 302 && first.headers.location === `/p/${SITE}/page?x=1` && cookie === `vrg_ports=${token}`, 'the token becomes an HttpOnly cookie and leaves the URL');
  ok(/HttpOnly/.test(first.headers['set-cookie'][0]), '… the cookie is HttpOnly');
  const page = await get(PORT, `/p/${SITE}/page?x=1`, { headers: { cookie } });
  ok(page.status === 200 && page.body.includes('path=/page?x=1'), 'with the cookie the page comes through the proxy');
  const echo = JSON.parse((await get(PORT, `/p/${SITE}/echo`, { headers: { cookie: cookie + '; theirs=1' } })).body);
  ok(echo.host === `localhost:${SITE}` && echo.cookie === 'theirs=1', 'the server sees Host localhost:<port>, its own cookies and never the token');
  ok((await get(PORT, `/p/${SITE}/go`, { headers: { cookie } })).headers.location === `/p/${SITE}/there?a=1`, 'a redirect to its own absolute URL is rewritten into /p/<port>/');
  ok((await get(PORT, `/p/${SITE}/rel`, { headers: { cookie } })).headers.location === `/p/${SITE}/abs`, 'a root-relative redirect is rewritten too');
  ok((await get(PORT, `/p/${SITE}`, { headers: { cookie } })).headers.location === `/p/${SITE}/`, '/p/<port> gets its slash');
  const root = await get(PORT, '/app.js', { headers: { cookie, referer: `http://192.168.1.24:${PORT}/p/${SITE}/page` } });
  ok(root.status === 307 && root.headers.location === `/p/${SITE}/app.js`, 'a root path asked by a proxied page goes back under its /p/<port>/');
  ok((await get(PORT, '/app.js', { headers: { referer: `http://192.168.1.24:${PORT}/p/${SITE}/page` } })).status === 404, '… but not without the cookie');
  ok((await get(PORT, `/p/${PORT}/`, { headers: { cookie } })).status === 403, 'the relay does not proxy itself');
  ok((await get(PORT, '/p/1/', { headers: { cookie } })).status === 502, 'a port nobody listens on answers 502, not a hang');

  // the relay without --ports
  const b = await phone(PORT_OFF).ready;
  const code2 = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get(PORT_OFF, '/pair/code.json')).body).link)[1];
  b.send('pair', { code: code2, device: 'Teszt telefon', pub }, 'relay');
  await b.wait('paired');
  b.send('ports.list', {}, 'relay');
  const l2 = await b.wait('ports', 1, 15000);
  ok(l2 && l2.payload.ok === true && l2.payload.proxy.on === false && !l2.payload.proxy.token, 'without --ports: the list still works, the proxy is off and no token is given');
  ok((await get(PORT_OFF, `/p/${SITE}/?vrg_t=${token}`)).status === 404, 'without --ports /p/ does not exist');

  // removal on the PC ends the proxy at once
  ok(JSON.parse((await get(PORT, '/pair/remove?id=' + pairId, { method: 'POST' })).body).ok, 'the PC removes the pairing');
  ok((await get(PORT, `/p/${SITE}/page`, { headers: { cookie } })).status === 403, 'after removal the proxy cookie no longer works');
  a.send('ports.list', {}, 'relay');
  const l3 = await a.wait('ports', 3);
  ok(l3 && l3.payload.ok === false && l3.payload.trusted === false, 'and the phone is refused the list');

  [a, b].forEach(x => x.ws.close());
  relay.kill(); off.kill(); site.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
