#!/usr/bin/env node
// Mobile/tests/relay-files.js — PC ablakok (WP M23): the PC's work folders, read-only, on a paired phone.
// The roots from a roots.json narrowed by a files.json (D-17: only the allowed ids); dot-files, secret names, the deny list and a
// junction out of the root never listed nor reachable; only handles travel; text / image / binary looks; a copy onto the Átadás
// board; then a real relay: off without --files, an untrusted phone refused, a paired phone browsing, reading, copying.
//
// Everything runs in a throwaway folder under %TEMP%: the real roots are never read by this test.
//
//   node Mobile/tests/relay-files.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses ports 47398 / 47399.
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const F = require(path.join(TOOLS, 'relay-files.js'));
const B = require(path.join(TOOLS, 'relay-board.js'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-files-'));

// ---- the throwaway tree --------------------------------------------------------------------------------
const W = path.join(TMP, 'work'), S = path.join(TMP, 'shared'), D = path.join(TMP, 'desk'), OUT = path.join(TMP, 'outside');
for (const d of [W, S, D, OUT, path.join(W, 'Sub', 'deep'), path.join(W, 'home'), path.join(W, '.git'), path.join(W, 'Ügyfél mappa')]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(W, 'a.txt'), 'árvíztűrő tükörfúrógép\n');
fs.writeFileSync(path.join(W, 'b.txt'), Buffer.from([0xe1, 0x72, 0x76, 0xed, 0x7a, 0xfb]));          // windows-1250 "árvízű"
fs.writeFileSync(path.join(W, 'big.txt'), 'x'.repeat(100 * 1024));
fs.writeFileSync(path.join(W, 'pic.png'), Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
fs.writeFileSync(path.join(W, 'blob.bin.txt'), Buffer.from([1, 2, 0, 3]));
for (const n of ['.env', 'credentials-google.json', 'server.pem', 'id_rsa', 'anonymise.map.json', 'secrets.bin']) fs.writeFileSync(path.join(W, n), 'SECRET');
fs.writeFileSync(path.join(W, 'home', 'x.txt'), 'denied');
fs.writeFileSync(path.join(W, 'Sub', 'deep', 'job.txt'), 'munka');
fs.writeFileSync(path.join(OUT, 'private.txt'), 'outside the root');
fs.writeFileSync(path.join(D, 'desk.txt'), 'the desktop is not a work root');
let junction = false;
try { fs.symlinkSync(OUT, path.join(W, 'kiut'), 'junction'); junction = true; } catch (e) { /* no junctions here */ }
const ROOTS = path.join(TMP, 'roots.json'), CONF = path.join(TMP, 'files.json');
fs.writeFileSync(ROOTS, JSON.stringify([
  { id: 'repo', hu: 'Repó', path: W }, { id: 'shared', hu: 'Közös', path: S }, { id: 'desktop', hu: 'Asztal', path: D },
  { id: 'onedrive', hu: 'OneDrive', env: ['OneDrive'] },
]));
fs.writeFileSync(CONF, JSON.stringify({ roots: { allow: ['repo', 'shared', 'onedrive'] }, places: { jobs: 'repo:Sub/deep', bad: 'repo:../outside', gone: 'repo:nincs' }, deny: ['repo:home'] }));

function get(port, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); });
    req.on('error', rej); req.end();
  });
}

function phone(port) {
  const ws = new WS(`ws://127.0.0.1:${port}`, { maxPayload: 8 * 1024 * 1024 });
  const got = [];
  let seq = 0;
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) { } });
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: 'phone', seq: ++seq, t: Date.now(), type, payload }, to ? { to } : {})));
  const wait = async (type, n, ms) => {
    for (let i = 0; i < (ms || 3000) / 50; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  const c = { ws, got, send, wait };
  c.ready = new Promise(r => ws.on('open', r)).then(async () => { send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['files'] }); c.welcome = await wait('welcome'); return c; });
  return c;
}

async function pairPhone(port) {
  const a = await phone(port).ready;
  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get(port, '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  a.send('pair', { code, device: 'Teszt telefon', pub: key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }, 'relay');
  return { a, paired: await a.wait('paired') };
}

function relay(port, env) {
  const r = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, {
      RELAY_PAIRED_FILE: path.join(TMP, `paired-${port}.json`), RELAY_OPEN_DRY: '1', RELAY_PORTS: '', RELAY_CLAUDE: '', RELAY_FILES: '',
      RELAY_BOARD_DIR: path.join(TMP, `board-${port}`), RELAY_FILES_ROOTS: ROOTS, RELAY_FILES_CONF: CONF,
    }, env),
  });
  r.log = ''; r.stdout.on('data', d => r.log += d); r.stderr.on('data', d => r.log += d);
  return r;
}

const names = l => l.entries.map(e => e.name);

(async () => {
  // ---- the module ------------------------------------------------------------------------------------------
  console.log('relay-files.js: roots, listing, hiding');
  const conf = F.loadConf(CONF);
  ok(conf.places.has('jobs') && !conf.places.has('bad') && conf.deny.length === 1, 'files.json: a place with .. is dropped');
  const roots = F.buildRoots({ conf, rootsFile: ROOTS });
  ok(roots.map(r => r.id).join(',') === 'repo,shared', 'only the allowed roots that exist (not Asztal, not an env root)');
  const real = F.buildRoots({});
  ok(real.every(r => ['repo', 'full', 'shared'].includes(r.id)) && real.some(r => r.id === 'repo'), 'the real config: work roots only (D-17): ' + real.map(r => r.id).join(','));
  const board = B.createBoard({ dir: path.join(TMP, 'board') });
  const fsx = F.createFiles({ roots, conf, board });

  const top = fsx.list();
  ok(top.ok && top.h === null && names(top).join(',') === 'Repó,Közös' && top.entries.every(e => e.dir && /^[0-9a-f]{16}$/.test(e.h)), 'no handle: the roots, each with a handle');
  const w = fsx.list({ h: top.entries[0].h });
  const wn = names(w);
  ok(w.ok && w.root === 'repo' && w.crumbs.length === 1 && w.crumbs[0].name === 'Repó', 'a root: its listing and its crumb');
  ok(wn[0] === 'Sub' && wn[1] === 'Ügyfél mappa' && wn.indexOf('a.txt') > 1, 'folders first, then files, by name');
  ok(!wn.some(n => /^\.|credentials|\.pem$|id_rsa|anonymise|secrets\.bin/.test(n)), 'dot-files and secret names are never listed: ' + wn.join(' '));
  ok(!wn.includes('home'), 'a denied folder is not listed');
  if (junction) ok(!wn.includes('kiut'), 'a junction out of the root is not listed');
  else console.log('  (skip) no junction could be made here');
  const a = w.entries.find(e => e.name === 'a.txt');
  ok(a && a.bytes > 0 && a.mtime > 0 && !a.dir, 'a file row: size and time');
  ok(fsx.list({ h: top.entries[0].h }).entries.find(e => e.name === 'a.txt').h === a.h, 'the same row keeps its handle');

  const sub = fsx.list({ h: w.entries.find(e => e.name === 'Sub').h });
  const deep = fsx.list({ h: sub.entries[0].h });
  ok(deep.ok && deep.crumbs.map(c => c.name).join('/') === 'Repó/Sub/deep' && deep.crumbs[0].h === top.entries[0].h, 'crumbs from the root, each a handle');
  const pl = fsx.list({ place: 'jobs' });
  ok(pl.ok && names(pl).join() === 'job.txt' && pl.h === deep.h, 'a place opens at its folder');
  for (const p of [{ place: 'bad' }, { place: 'gone' }, { place: '../x' }, { place: 'constructor' }])
    ok(!fsx.list(p).ok, 'refused place ' + JSON.stringify(p));
  for (const p of [{ h: 'ffffffffffffffff' }, { h: '../..' }, { h: 'C:\\Windows' }, { h: 12 }, { path: 'C:\\' }])
    ok(p.path ? fsx.list(p).h === null : !fsx.list(p).ok, 'not a handle we made: ' + JSON.stringify(p) + (p.path ? ' (a path is ignored: the roots)' : ''));

  console.log('relay-files.js: looking at a file');
  const ra = fsx.read({ h: a.h });
  ok(ra.ok && ra.kind === 'text' && ra.text === 'árvíztűrő tükörfúrógép\n' && ra.encoding === 'utf-8' && !ra.truncated, 'UTF-8 text');
  const rb = fsx.read({ h: w.entries.find(e => e.name === 'b.txt').h });
  ok(rb.ok && rb.encoding === 'windows-1250' && rb.text === 'árvízű', 'Windows-1250 text');
  const rg = fsx.read({ h: w.entries.find(e => e.name === 'big.txt').h });
  ok(rg.ok && rg.truncated && rg.text.length === F.TEXT_MAX && rg.size === 100 * 1024, 'a long text: the first 64 KB');
  const rp = fsx.read({ h: w.entries.find(e => e.name === 'pic.png').h });
  ok(rp.ok && rp.kind === 'image' && rp.mime === 'image/png' && Buffer.from(rp.data, 'base64').length === 16, 'an image as base64');
  const rx = fsx.read({ h: w.entries.find(e => e.name === 'blob.bin.txt').h });
  ok(rx.ok && rx.kind === 'binary' && rx.text === undefined, 'a NUL: binary, nothing sent');
  ok(!fsx.read({ h: sub.h }).ok, 'a folder is not read');
  ok(!fsx.read({}).ok && !fsx.read({ h: 'x' }).ok, 'no handle, no read');

  console.log('relay-files.js: a copy onto the board');
  const cp = await fsx.copy({ h: a.h });
  const listed = board.list();
  ok(cp.ok && cp.entry.name === 'a.txt' && listed.length === 1 && listed[0].from === 'pc' && listed[0].target === 'inbox', 'onto the board as a PC entry');
  ok(fs.readFileSync(board.pathOf(board.get(cp.entry.id)), 'utf8') === 'árvíztűrő tükörfúrógép\n' && fs.existsSync(path.join(W, 'a.txt')), 'the board has a copy; the original stays');
  ok(!(await fsx.copy({ h: sub.h })).ok, 'a folder is not copied');
  const tiny = F.createFiles({ roots, conf, board: B.createBoard({ dir: path.join(TMP, 'board2'), max: 10 }) });
  const tw = tiny.list({ h: tiny.list().entries[0].h });
  ok(/Túl nagy/.test((await tiny.copy({ h: tw.entries.find(e => e.name === 'big.txt').h })).reason), 'over the board\'s limit: refused before reading');

  // the file is renamed into a junction afterwards: the old handle stops working
  fs.renameSync(path.join(W, 'Ügyfél mappa'), path.join(TMP, 'moved'));
  ok(!fsx.list({ h: w.entries.find(e => e.name === 'Ügyfél mappa').h }).ok, 'a handle to a folder that is gone: refused');

  // ---- the relay ------------------------------------------------------------------------------------------
  console.log('phone-relay-server.js: files.* without --files');
  const off = relay(47398, {});
  await sleep(900);
  const o = await pairPhone(47398);
  o.a.send('files.list', {}, 'relay');
  const ol = await o.a.wait('files');
  ok(o.paired && o.paired.payload.ok && ol && ol.payload.ok === false && ol.payload.on === false && /--files/.test(ol.payload.reason), 'off without --files, and says how to turn it on');
  o.a.ws.close(); off.kill();

  console.log('phone-relay-server.js: files.* with --files');
  const on = relay(47399, { RELAY_FILES: '1' });
  await sleep(900);
  const u = await phone(47399).ready;
  u.send('files.list', {}, 'relay');
  const ul = await u.wait('files');
  ok(ul && ul.payload.ok === false && ul.payload.trusted === false && !ul.payload.entries, 'an untrusted phone is refused');
  u.ws.close();
  const { a: ph, paired } = await pairPhone(47399);
  ok(paired && paired.payload.ok, 'the phone pairs');
  ph.send('files.list', {}, 'relay');
  const l1 = await ph.wait('files');
  ok(l1 && l1.payload.ok && l1.payload.on && names(l1.payload).join(',') === 'Repó,Közös', 'the roots');
  ph.send('files.list', { h: l1.payload.entries[0].h }, 'relay');
  const l2 = await ph.wait('files', 2);
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'relay-files-answer.json'), 'utf8')).payload;
  ok(l2 && l2.payload.ok && Object.keys(l2.payload).sort().join(',') === Object.keys(fx).sort().join(',') &&
    Object.keys(l2.payload.entries[0]).sort().join(',') === Object.keys(fx.entries[0]).sort().join(','), 'a folder, in the shape of the Kotlin fixture (relay-files-answer.json)');
  const ta = l2.payload.entries.find(e => e.name === 'a.txt');
  ph.send('files.read', { h: ta.h }, 'relay');
  const rd = await ph.wait('files.read');
  ok(rd && rd.payload.ok && rd.payload.kind === 'text' && /tükörfúrógép/.test(rd.payload.text), 'files.read: the text');
  ph.send('files.copy', { h: ta.h }, 'relay');
  const cpd = await ph.wait('files.copied', 1, 5000);
  const bev = await ph.wait('board', 1, 2000);
  ok(cpd && cpd.payload.ok && bev && bev.payload.event === 'added' && bev.payload.from === 'pc', 'files.copy: on the board, and the phone hears the board event');
  ph.send('files.list', { path: 'C:\\Windows' }, 'relay');
  ph.send('files.read', { h: '0000000000000000' }, 'relay');
  await sleep(400);
  ok(names((await ph.wait('files', 3)).payload).join(',') === 'Repó,Közös' && (await ph.wait('files.read', 2)).payload.ok === false, 'a path from the phone is never read; an unknown handle refused');
  ok(/munkamappái a telefonon: BEKAPCSOLVA/.test(on.log), 'the relay\'s banner says it is on');
  const st = JSON.parse((await get(47399, '/whoami')).body);
  ok(st.files === true, '/whoami says files: true');

  ph.ws.close();
  on.kill();
  await sleep(300);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a file still open */ }
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
