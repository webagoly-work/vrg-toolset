#!/usr/bin/env node
// Mobile/tests/relay-notify.js — Értesítések (WP M10): a tool on the PC tells the phone. First the rules in
// relay-notify.js on their own (the notice's shape, controls, links, the rate, the buffer and its clock),
// then a real relay: POST /notify only from this PC (Host, Origin), the notice reaching a trusted phone and
// not an untrusted one, notify.list for the missed ones, an app's notify over the socket, and the command line.
//
//   node Mobile/tests/relay-notify.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses port 47392 and a temporary
// paired-phones file, so neither a running relay nor the real pairings are touched.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const N = require(path.join(TOOLS, 'relay-notify.js'));

const PORT = 47392;
const HOST = `localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-notify-'));
const FILE = path.join(TMP, 'relay-paired.json');

function req(method, p, opts) {
  opts = opts || {};
  return new Promise((res, rej) => {
    const headers = Object.assign({ Host: HOST }, opts.headers || {});
    for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];
    if (opts.body != null) headers['Content-Length'] = Buffer.byteLength(opts.body);
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, x => {
      const chunks = []; x.on('data', d => chunks.push(d)); x.on('end', () => res({ status: x.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', rej);
    if (opts.body != null) r.write(opts.body);
    r.end();
  });
}
const jsonOf = r => { try { return JSON.parse(r.body); } catch (e) { return {}; } };
const post = (o, headers) => req('POST', '/notify', { body: typeof o === 'string' ? o : JSON.stringify(o), headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });

function client(role, app) {
  const ws = new WS(`ws://127.0.0.1:${PORT}`);
  const got = [];
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) { } });
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: role, t: Date.now(), type, payload }, to ? { to } : {})));
  const wait = async (type, n, ms) => {
    for (let i = 0; i < (ms || 3000) / 50; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  const c = { ws, got, send, wait, n: type => got.filter(x => x.type === type).length };
  c.ready = new Promise(r => ws.on('open', r)).then(async () => {
    send('hello', { role, app });
    if (role === 'phone') c.welcome = await wait('welcome');
    return c;
  });
  return c;
}

(async () => {
  // ---- the rules ----------------------------------------------------------------------------------------
  console.log('relay-notify.js: the rules');
  ok(N.checkNotice({ title: 'Build kész' }).ok && N.checkNotice({ title: 'x', text: 'y', level: 'bad', link: 'https://github.com/a' }).ok, 'a title alone, or with text, level and an https link');
  for (const [p, why] of [[null, 'null'], [[], 'an array'], [{}, 'no title'], [{ title: '  ' }, 'a blank title'], [{ title: 5 }, 'a number'],
    [{ title: 'x'.repeat(121) }, 'a 121-character title'], [{ title: 'x', text: 'y'.repeat(501) }, 'a 501-character text'], [{ title: 'x', text: {} }, 'an object as text'],
    [{ title: 'x', level: 'loud' }, 'an unknown level'], [{ title: 'x', link: 'javascript:alert(1)' }, 'a javascript: link'],
    [{ title: 'x', link: 'file:///C:/x' }, 'a file: link'], [{ title: 'x', link: 'https://a b' }, 'a link with a space']]) {
    ok(!N.checkNotice(p).ok, `refused: ${why}`);
  }
  const c1 = N.checkNotice({ title: 'Kész\u202e\u0007 a\n\nKapu', text: 'sor1\r\nsor2', from: 'x'.repeat(80) });
  ok(c1.notice.title === 'Kész a Kapu' && c1.notice.text === 'sor1 sor2' && c1.notice.from.length === N.LIMITS.from, 'controls and bidi overrides become spaces, from is cut to 40');

  let t = 1000;
  const b = N.createNotices({ max: 3, ttl: 100000, rate: 4, now: () => t });
  const seen = [];
  b.on(e => seen.push(e.id));
  const a1 = b.add({ title: 'egy' }, 'kapu').entry, a2 = b.add({ title: 'kettő' }).entry;
  ok(a1.at === 1000 && a2.at === 1001 && /^[0-9a-f]{12}$/.test(a1.id) && a1.id !== a2.id, 'ids are random 12 hex; two notices in one millisecond still get increasing times');
  ok(a1.from === 'kapu' && a2.from === null, 'the source fills `from` when the notice gives none');
  ok(seen.join() === [a1.id, a2.id].join(), 'every notice reaches the listeners');
  b.add({ title: 'három' }); b.add({ title: 'négy' });
  const r5 = b.add({ title: 'öt' });
  ok(!r5.ok && /percenként/.test(r5.reason), `at most ${4} a minute (the test's rate): the 5th is refused`);
  t += 60001;
  ok(b.add({ title: 'öt' }).ok, 'a minute later it goes');
  ok(b.since(0).length === 3 && b.since(0)[0].title === 'három', 'only the last MAX are kept, oldest first');
  ok(b.since(1002).map(e => e.title).join() === 'négy,öt' && b.since('x').length === 3, 'since(after) gives the newer ones; a bad `after` gives all');
  t = 1003 + 100000;
  ok(b.since(0).length === 1, 'a notice older than the TTL is gone');

  // ---- the relay ------------------------------------------------------------------------------------------
  console.log('phone-relay-server.js: /notify, notify, notify.list');
  const relay = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: FILE, RELAY_BOARD_DIR: path.join(TMP, 'board'), RELAY_OPEN_DRY: '1', RELAY_LAUNCH_DRY: '1', RELAY_PORTS: '', RELAY_PAIR: '' }),
  });
  relay.log = ''; relay.stdout.on('data', d => relay.log += d); relay.stderr.on('data', d => relay.log += d);
  await sleep(900);

  ok(jsonOf(await req('GET', '/whoami')).notify === true, '/whoami says the relay takes notices');
  ok((await req('GET', '/notify')).status === 405, 'GET /notify: 405');
  ok((await post({ title: 'x' }, { Host: 'evil.example' })).status === 403, 'a foreign Host (DNS rebinding) is refused');
  ok((await post({ title: 'x' }, { Origin: 'http://evil.example' })).status === 403 && (await post({ title: 'x' }, { Origin: 'null' })).status === 403,
    'a POST from a web page (foreign Origin, or null) is refused');
  ok((await post('{not json')).status === 400 && (await post({ title: '' })).status === 400 && (await post({ title: 'x', link: 'javascript:1' })).status === 400, 'broken JSON, no title, a bad link: 400');
  ok((await post('x'.repeat(9000))).status === 413, 'over 8 KB: 413');

  // phones: one trusted, one not
  const untrusted = await client('phone', 'vrg-mobile').ready;
  const ph = await client('phone', 'vrg-mobile').ready;
  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await req('GET', '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  ph.send('pair', { code, device: 'Teszt telefon', pub: key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }, 'relay');
  ok((await ph.wait('paired')).payload.ok, 'one phone pairs, the other stays untrusted');

  const before = Date.now();
  const p1 = await post({ title: 'Build kész', text: 'A Kapu újraépült.', level: 'good', link: 'https://github.com/webagoly-work/vrg-toolset/actions', from: 'build-hub' }, { Origin: `http://${HOST}` });
  const e1 = jsonOf(p1).entry;
  ok(p1.status === 200 && jsonOf(p1).delivered === 1 && e1.title === 'Build kész' && e1.at >= before, 'POST /notify from this PC (its own page\'s Origin): 200, delivered to 1 phone');
  const got = await ph.wait('notify');
  ok(got && got.from === 'relay' && got.payload.id === e1.id && got.payload.level === 'good' && got.payload.link.startsWith('https://') && got.payload.from === 'build-hub',
    'the trusted phone gets {from:relay, type:notify, payload:{id, title, text, level, link, from, at}}');
  ok(Object.keys(got.payload).sort().join() === 'at,from,id,level,link,text,title', 'the payload has exactly the fields the Kotlin side reads (InboxRelay.entry)');
  await sleep(200);
  ok(untrusted.n('notify') === 0, 'the untrusted phone gets nothing');

  // missed ones
  untrusted.send('notify.list', { after: 0 }, 'relay');
  ok((await untrusted.wait('notify.listed')).payload.trusted === false, 'notify.list from an untrusted phone: refused');
  const p2 = jsonOf(await post({ title: 'Második' })).entry;
  ph.send('notify.list', { after: e1.at }, 'relay');
  const l1 = await ph.wait('notify.listed');
  ok(l1.payload.ok && l1.payload.entries.length === 1 && l1.payload.entries[0].id === p2.id, 'notify.list {after} brings only the newer ones');
  ph.send('notify.list', {}, 'relay');
  ok((await ph.wait('notify.listed', 2)).payload.entries.length === 2, 'notify.list without `after`: all kept');

  // an app on this PC over the socket; a phone may not announce
  const app = await client('planner', 'varler-planner').ready;
  app.send('notify', { title: 'Terv mentve' }, 'relay');
  const added = await app.wait('notify.added');
  ok(added && added.payload.ok && /^[0-9a-f]{12}$/.test(added.payload.id), 'an app on this PC sends notify over the socket: notify.added {ok, id}');
  const viaApp = await ph.wait('notify', 2);
  ok(viaApp && viaApp.payload.title === 'Terv mentve' && viaApp.payload.from === 'varler-planner', '… and the phone gets it, from: the app');
  app.send('notify', { title: '' }, 'relay');
  ok((await app.wait('notify.added', 2)).payload.ok === false, 'a bad notice from the app: notify.added {ok:false}');
  const n0 = ph.n('notify');
  ph.send('notify', { title: 'telefonról' }, 'relay');
  const refused = await ph.wait('notify.added');
  await sleep(200);
  ok(refused && refused.payload.ok === false && ph.n('notify') === n0, 'a phone cannot announce to the phones');

  // the command line
  const cli = await new Promise(res => execFile(process.execPath, [path.join(TOOLS, 'relay-notify.js'), 'Parancssorból', 'szöveg', '--level', 'bad', '--port', String(PORT)],
    { timeout: 10000 }, (err, out) => res({ code: err ? err.code : 0, out })));
  const viaCli = await ph.wait('notify', n0 + 1);
  ok(cli.code === 0 && /1 telefon/.test(cli.out) && viaCli.payload.title === 'Parancssorból' && viaCli.payload.level === 'bad' && viaCli.payload.from === 'parancssor',
    'node relay-notify.js "Cím" "szöveg" --level bad: the phone gets it');
  const noRelay = await new Promise(res => execFile(process.execPath, [path.join(TOOLS, 'relay-notify.js'), 'x', '--port', '47390'], { timeout: 10000 }, err => res(err ? err.code : 0)));
  ok(noRelay === 1, 'the command line with no relay on that port: exit 1');

  // a removed pairing: no more notices
  const list = JSON.parse((await req('GET', '/pair/list.json')).body);
  await req('POST', '/pair/remove?id=' + list.phones[0].id);
  await sleep(200);
  const n1 = ph.n('notify');
  ok(jsonOf(await post({ title: 'Senkinek' })).delivered === 0, 'after the pairing is removed: delivered 0');
  await sleep(200);
  ok(ph.n('notify') === n1, '… and the phone gets nothing');

  [ph, untrusted, app].forEach(c => c.ws.close());
  relay.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
