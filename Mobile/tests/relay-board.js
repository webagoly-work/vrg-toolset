#!/usr/bin/env node
// Mobile/tests/relay-board.js — Átadás (WP M12): the file board and the clipboard. First the rules in
// relay-board.js on their own (names, paths, tickets, the clock), then a real relay with a temporary
// board folder: the PC page's Host and Origin rule, the size limit, broken and wrong-checksum uploads,
// two files of one name, tickets for the phone (once, not in the URL, not for another id), removal
// into _removed, the download headers, the board event, and the clipboard (text only).
//
//   node Mobile/tests/relay-board.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses port 47396, a temporary
// paired-phones file, board folder and clipboard file, so neither a running relay nor the real
// inbox\board is touched.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const B = require(path.join(TOOLS, 'relay-board.js'));

const PORT = 47396;
const HOST = `localhost:${PORT}`;
const ORIGIN = `http://${HOST}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-board-'));
const FILE = path.join(TMP, 'relay-paired.json');
const DIR = path.join(TMP, 'board');
const CLIP = path.join(TMP, 'clip.txt');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

/** One HTTP request with full control of the headers. -> {status, headers, body:Buffer} */
function req(method, p, opts) {
  opts = opts || {};
  return new Promise((res, rej) => {
    const headers = Object.assign({ Host: HOST }, opts.headers || {});
    for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];
    if (opts.body != null && headers['Content-Length'] == null) headers['Content-Length'] = Buffer.byteLength(opts.body);
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, x => {
      const chunks = []; x.on('data', d => chunks.push(d)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', e => (opts.tolerate ? res({ status: 0, error: e.code }) : rej(e)));
    if (opts.body != null) r.write(opts.body);
    r.end();
  });
}
const jsonOf = r => { try { return JSON.parse(r.body.toString('utf8')); } catch (e) { return {}; } };
const upload = (name, body, extra) => req('POST', `/board/upload?name=${encodeURIComponent(name)}&sha256=${(extra && extra.sha) || sha(body)}&target=${(extra && extra.target) || ''}`,
  { body, headers: Object.assign({ Origin: ORIGIN }, (extra && extra.headers) || {}) });

function boardFiles() {
  const out = [];
  const walk = d => { for (const n of fs.existsSync(d) ? fs.readdirSync(d) : []) { const f = path.join(d, n); fs.statSync(f).isDirectory() ? walk(f) : out.push(path.relative(DIR, f).replace(/\\/g, '/')); } };
  walk(DIR);
  return out;
}
const parts = () => boardFiles().filter(f => f.endsWith('.part'));

function phone(port) {
  const ws = new WS(`ws://127.0.0.1:${port}`);
  const got = [];
  let seq = 0;
  ws.on('message', d => { try { got.push(JSON.parse(d.toString())); } catch (e) { } });
  const send = (type, payload, to) => ws.send(JSON.stringify(Object.assign({ v: 1, from: 'phone', seq: ++seq, t: Date.now(), type, payload }, to ? { to } : {})));
  const wait = async (type, n, ms) => {
    for (let i = 0; i < (ms || 3000) / 50; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  const c = { ws, got, send, wait, n: type => got.filter(x => x.type === type).length };
  c.ready = new Promise(r => ws.on('open', r)).then(async () => {
    send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['state', 'cmd', 'drop'] });
    c.welcome = await wait('welcome');
    return c;
  });
  return c;
}

(async () => {
  // ---- names and paths ------------------------------------------------------------------------------
  console.log('relay-board.js: names and paths');
  const cases = [
    ['../../evil.txt', 'evil.txt'], ['..\\..\\Windows\\x.bat', 'x.bat'], ['C:\\Windows\\System32\\cmd.exe', 'cmd.exe'],
    ['/etc/passwd', 'passwd'], ['..', 'fajl'], ['', 'fajl'], [null, 'fajl'], ['   ', 'fajl'], ['CON', '_CON'], ['nul.txt', '_nul.txt'],
    ['com1.pdf', '_com1.pdf'], ['LPT9', '_LPT9'], ['a<b>c:d"e|f?g*h.txt', 'a_b_c_d_e_f_g_h.txt'], ['.env', 'env'], ['név. ', 'név'],
    ['line\nbreak\u0000.txt', 'linebreak.txt'], ['invoice\u202Etxt.exe', 'invoicetxt.exe'], ['árajánlat 2026.pdf', 'árajánlat 2026.pdf'],
  ];
  const wrong = cases.filter(([i, o]) => B.cleanName(i) !== o);
  ok(!wrong.length, `cleanName: ${cases.length} names, last segment only, no reserved or control characters` + (wrong.length ? ': ' + wrong.map(([i]) => JSON.stringify(i) + ' -> ' + JSON.stringify(B.cleanName(i))).join(', ') : ''));
  const long = B.cleanName('x'.repeat(300) + '.pdf');
  ok(Array.from(long).length === 120 && long.endsWith('.pdf'), 'a 300-character name is cut to 120 with its extension kept');
  ok(B.uniqueName('a.pdf', n => ['a.pdf', 'a (2).pdf'].includes(n)) === 'a (3).pdf' && B.uniqueName('README', n => n === 'README') === 'README (2)', 'a taken name gets " (2)", " (3)", before the extension');
  ok(B.inside('/b', '2026-11-06/a.pdf') && B.inside('/b', '../x') === null && B.inside('/b', '/etc/passwd') === null && B.inside('/b', '') === null, 'inside(): a path outside the board folder is refused');
  ok(B.originOk(ORIGIN, HOST) && B.originOk('HTTP://LOCALHOST:47396', HOST) && !B.originOk('http://evil.example', HOST) && !B.originOk(undefined, HOST) &&
     !B.originOk('null', HOST) && !B.originOk('https://' + HOST, HOST), 'originOk: only this relay\'s own Origin');
  ok(B.disposition('árajánlat "x".pdf') === 'attachment; filename="_raj_nlat _x_.pdf"; filename*=UTF-8\'\'%C3%A1raj%C3%A1nlat%20%22x%22.pdf', 'Content-Disposition: attachment, an ASCII fallback and the UTF-8 name');

  // ---- tickets and the clock --------------------------------------------------------------------------
  console.log('relay-board.js: tickets');
  let clock = Date.parse('2026-11-06T10:00:00Z');
  const bd = B.createBoard({ dir: path.join(TMP, 'unit'), now: () => clock });
  const t1 = bd.ticket('upload', null, 'p1');
  ok(t1.ok && /^[0-9a-f]{32}$/.test(t1.ticket) && t1.ttl === 60000, 'an upload ticket: 128-bit hex, 60 s');
  ok(bd.useTicket(t1.ticket, 'upload') && !bd.useTicket(t1.ticket, 'upload'), 'a ticket works once');
  const t2 = bd.ticket('upload', null, 'p1');
  clock += 60001;
  ok(!bd.useTicket(t2.ticket, 'upload'), 'and not after 60 s');
  const t3 = bd.ticket('upload', null, 'p1');
  ok(!bd.useTicket(t3.ticket, 'download', 'aaaaaaaaaaaaaaaa'), 'an upload ticket is not a download ticket (and is spent by trying)');
  const t4 = bd.ticket('upload', null, 'p1');
  bd.revoke('p1');
  ok(!bd.useTicket(t4.ticket, 'upload'), 'a removed pairing\'s tickets stop working');
  const t5 = bd.ticket('upload', null, 'p2');
  ok(!bd.useTicket(t5.ticket, 'upload', null, id => id !== 'p2'), 'a ticket of a pairing that no longer exists is refused');
  ok(!bd.ticket('download', 'ffffffffffffffff', 'p1').ok && !bd.ticket('delete', null, 'p1').ok && !bd.ticket('download', '../x', 'p1').ok, 'no ticket for an id that is not on the board, or an unknown op');

  ok(!B.checkText(5).ok && !B.checkText({}).ok && !B.checkText(['a']).ok && !B.checkText(null).ok && !B.checkText('').ok && !B.checkText('x'.repeat(B.CLIP_MAX + 1)).ok && B.checkText('szöveg').ok,
    'clipboard text: a string of 1..100000 characters, nothing else');

  // ---- the relay --------------------------------------------------------------------------------------
  console.log('phone-relay-server.js: /board');
  const relay = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: FILE, RELAY_BOARD_DIR: DIR, RELAY_CLIP_FILE: CLIP, RELAY_OPEN_DRY: '1', RELAY_LAUNCH_DRY: '1', RELAY_PORTS: '' }),
  });
  relay.log = ''; relay.stdout.on('data', d => relay.log += d); relay.stderr.on('data', d => relay.log += d);
  await sleep(900);

  const page = await req('GET', '/board');
  ok(page.status === 200 && /VRG ÁTADÁS/.test(page.body.toString('utf8')) && page.headers['x-frame-options'] === 'DENY', 'GET /board on this PC: the page');
  ok(!/innerHTML/.test(B.boardPage()), 'the page puts names in as text, never as HTML');
  ok((await req('GET', '/board', { headers: { Host: 'evil.example' } })).status === 403 &&
     (await req('GET', '/board/list.json', { headers: { Host: `rebind.example:${PORT}` } })).status === 403, 'a foreign Host (DNS rebinding) is refused, the page and the list');
  ok(jsonOf(await req('GET', '/board/list.json')).entries.length === 0, 'the board starts empty');

  const pdf = Buffer.from('%PDF-1.4 árajánlat ' + 'x'.repeat(5000));
  const u1 = await upload('árajánlat.pdf', pdf);
  const e1 = jsonOf(u1).entry;
  ok(u1.status === 200 && e1 && e1.name === 'árajánlat.pdf' && e1.from === 'pc' && e1.target === 'inbox' && e1.bytes === pdf.length && e1.sha256 === sha(pdf), 'an upload from the PC page lands, from: pc, target: inbox');
  const today = B.day(Date.now());
  ok(fs.readFileSync(path.join(DIR, today, 'árajánlat.pdf')).equals(pdf), `the file is in board\\${today}\\, unchanged`);
  ok(JSON.parse(fs.readFileSync(path.join(DIR, 'board.json'), 'utf8')).entries.some(e => e.id === e1.id && e.file === today + '/árajánlat.pdf'), 'board.json lists it');

  const before = boardFiles().length;
  ok((await upload('a.txt', Buffer.from('a'), { headers: { Origin: undefined } })).status === 403, 'a POST with no Origin is refused');
  ok((await upload('a.txt', Buffer.from('a'), { headers: { Origin: 'http://evil.example' } })).status === 403, 'a POST with a foreign Origin is refused');
  ok((await upload('a.txt', Buffer.from('a'), { headers: { Origin: 'null' } })).status === 403, 'a POST with Origin: null (a file:// page) is refused');
  ok((await req('POST', '/board/remove?id=' + e1.id, { headers: { Origin: 'http://evil.example' } })).status === 403 && fs.existsSync(path.join(DIR, today, 'árajánlat.pdf')), 'a remove with a foreign Origin is refused, the file stays');
  ok((await upload('a.txt', Buffer.from('a'), { headers: { Host: 'evil.example', Origin: 'http://evil.example' } })).status === 403, 'a foreign Host with its own matching Origin is refused');
  ok(boardFiles().length === before, 'refused uploads leave nothing behind');

  // the size limit: refused from the announced length, before a byte is stored
  const big = await new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: `/board/upload?name=big.bin&sha256=${'0'.repeat(64)}`, method: 'POST',
      headers: { Host: HOST, Origin: ORIGIN, 'Content-Length': B.MAX_BYTES + 1 } }, x => { let b = ''; x.on('data', d => b += d); x.on('end', () => res({ status: x.statusCode, body: b })); });
    r.on('error', () => res({ status: 0 }));
    r.write(Buffer.alloc(65536));
    setTimeout(() => r.destroy(), 1500);
  });
  await sleep(200);
  ok(big.status === 413 && /50 MB/.test(big.body), 'over 50 MB: 413, "legfeljebb 50 MB"');
  ok((await req('POST', `/board/upload?name=x.bin&sha256=${'0'.repeat(64)}`, { headers: { Origin: ORIGIN, 'Transfer-Encoding': 'chunked' }, body: null })).status === 411, 'no Content-Length: 411');

  // a wrong checksum
  const w = Buffer.from('this is not what was announced');
  const u2 = await upload('rossz.txt', w, { sha: sha(Buffer.from('something else')) });
  await sleep(100);
  ok(u2.status === 400 && /ellenőrzőösszeg/i.test(jsonOf(u2).reason) && !boardFiles().some(f => f.endsWith('rossz.txt')) && !parts().length, 'a wrong SHA-256: 400, no entry, no file, no .part');
  ok((await upload('x.txt', w, { sha: 'abc' })).status === 400 && (await upload('x.txt', w, { target: 'C:\\x' })).status === 400, 'a malformed SHA-256 or an unknown target: 400');

  // a broken upload: the connection drops half way
  await new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: `/board/upload?name=felig.bin&sha256=${'1'.repeat(64)}`, method: 'POST',
      headers: { Host: HOST, Origin: ORIGIN, 'Content-Length': 200000 } });
    r.on('error', () => res());
    r.write(Buffer.alloc(100000, 7));
    setTimeout(() => { r.destroy(); res(); }, 400);
  });
  await sleep(500);
  ok(!boardFiles().some(f => /felig/.test(f)) && !parts().length && !jsonOf(await req('GET', '/board/list.json')).entries.some(e => /felig/.test(e.name)), 'an interrupted upload: no entry, no .part');

  // names: the path stays in the board folder
  const evil = await upload('..\\..\\..\\evil.html', Buffer.from('<script>alert(1)</script>'));
  const ee = jsonOf(evil).entry;
  ok(evil.status === 200 && ee.name === 'evil.html' && fs.existsSync(path.join(DIR, today, 'evil.html')) && !fs.existsSync(path.join(TMP, 'evil.html')) && !fs.existsSync(path.join(path.dirname(TMP), 'evil.html')),
    'a name with ..\\ lands as board\\<today>\\evil.html, nowhere else');
  const con = jsonOf(await upload('CON.txt', Buffer.from('c'))).entry;
  ok(con && con.name === '_CON.txt' && fs.existsSync(path.join(DIR, today, '_CON.txt')), 'a reserved name is stored as _CON.txt');

  // the same name twice
  const a1 = Buffer.from('first'), a2 = Buffer.from('second');
  const d1 = jsonOf(await upload('foto.jpg', a1)).entry, d2 = jsonOf(await upload('foto.jpg', a2)).entry;
  ok(d1 && d2 && d1.id !== d2.id && d1.name === 'foto.jpg' && d2.name === 'foto (2).jpg', 'the same name twice: two entries, foto.jpg and foto (2).jpg');
  ok(fs.readFileSync(path.join(DIR, today, 'foto.jpg')).equals(a1) && fs.readFileSync(path.join(DIR, today, 'foto (2).jpg')).equals(a2), 'neither is overwritten');

  // the download headers, for an HTML file above all
  const dl = await req('GET', '/board/file/' + ee.id);
  ok(dl.status === 200 && dl.body.toString() === '<script>alert(1)</script>', 'the PC page downloads a file');
  ok(dl.headers['content-type'] === 'application/octet-stream' && /^attachment;/.test(dl.headers['content-disposition']) && dl.headers['x-content-type-options'] === 'nosniff' &&
     dl.headers['cache-control'] === 'no-store' && /sandbox/.test(dl.headers['content-security-policy'] || '') && dl.headers['x-vrg-sha256'] === ee.sha256,
  'served as octet-stream, attachment, nosniff, no-store, sandboxed: an uploaded HTML never runs');
  ok((await req('GET', '/board/file/' + ee.id, { headers: { Host: 'evil.example' } })).status === 403, 'a download with a foreign Host is refused');
  ok((await req('GET', '/board/file/..%2f..%2fboard.json')).status === 404 && (await req('GET', '/board/file/' + 'f'.repeat(16))).status === 404, 'a path or an unknown id is not a file');

  // ---- the phone ----------------------------------------------------------------------------------------
  console.log('phone-relay-server.js: board.* and clip.* for the phone');
  const ph = await phone(PORT).ready;
  for (const t of ['board.list', 'board.ticket', 'board.remove', 'clip.get']) ph.send(t, { op: 'upload', id: d1.id }, 'relay');
  ph.send('clip.set', { text: 'nem kellene' }, 'relay');
  await sleep(500);
  const refused = ph.got.filter(m => ['board.listed', 'board.ticket', 'board.removed', 'clip'].includes(m.type));
  ok(refused.length === 5 && refused.every(m => m.payload.ok === false && m.payload.trusted === false), 'an untrusted phone: list, ticket, remove and both clipboard ways refused');
  ok(!fs.existsSync(CLIP) && jsonOf(await req('GET', '/board/list.json')).entries.some(e => e.id === d1.id), '… the clipboard untouched, nothing removed');
  ok((await upload('x.txt', Buffer.from('x'), { headers: { 'X-VRG-Ticket': 'f'.repeat(32), Origin: undefined } })).status === 403, 'an upload with a made-up ticket is refused');

  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await req('GET', '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  ph.send('pair', { code, device: 'Teszt telefon', pub: key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }, 'relay');
  ok((await ph.wait('paired')).payload.ok, 'the phone pairs');

  ph.send('board.list', {}, 'relay');
  const l1 = await ph.wait('board.listed', 2);
  ok(l1.payload.ok && l1.payload.entries.length === 5 && l1.payload.entries.every(e => e.id && e.name && e.bytes >= 0 && e.sha256 && e.from && e.at && e.target && !('file' in e)),
    'the paired phone lists the board (5 entries), without the stored path');
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'relay-board-list.json'), 'utf8')).payload;
  ok(Object.keys(l1.payload.entries[0]).sort().join() === Object.keys(fx.entries[0]).sort().join() && Object.keys(l1.payload).sort().join() === Object.keys(fx).sort().join(),
    'the live answer has the fields of the Kotlin test fixture (relay-board-list.json)');

  // upload with a ticket
  const ev0 = ph.n('board');
  ph.send('board.ticket', { op: 'upload' }, 'relay');
  const tk = await ph.wait('board.ticket', 2);
  ok(tk.payload.ok && /^[0-9a-f]{32}$/.test(tk.payload.ticket) && tk.payload.ttl === 60000, 'a paired phone gets an upload ticket');
  const photo = crypto.randomBytes(30000);
  ok((await upload('IMG_1.jpg', photo, { headers: { Origin: undefined }, target: 'planner' }).then(r => r.status)) === 403, 'without the ticket header the phone\'s upload is refused');
  ok((await req('POST', `/board/upload?name=IMG_1.jpg&sha256=${sha(photo)}&ticket=${tk.payload.ticket}`, { body: photo, headers: { Host: '192.0.2.1:' + PORT } })).status === 403, 'the ticket in the URL does nothing');
  const up = await upload('IMG_1.jpg', photo, { headers: { 'X-VRG-Ticket': tk.payload.ticket, Origin: undefined }, target: 'planner' });
  const pe = jsonOf(up).entry;
  ok(up.status === 200 && pe.from === 'phone' && pe.target === 'planner' && jsonOf(up).delivered === 0, 'with it the photo lands, from: phone, target: planner (no Planner on the line: delivered 0)');
  ok((await upload('IMG_2.jpg', photo, { headers: { 'X-VRG-Ticket': tk.payload.ticket, Origin: undefined } })).status === 403, 'the same ticket a second time is refused');
  const evAdd = await ph.wait('board', ev0 + 1);
  ok(evAdd && evAdd.payload.event === 'added' && evAdd.payload.id === pe.id && evAdd.payload.url === '/board/file/' + pe.id, 'the board event tells the phone, with the file\'s address');

  // download with a ticket
  ph.send('board.ticket', { op: 'download', id: d1.id }, 'relay');
  const dt = await ph.wait('board.ticket', 3);
  ok((await req('GET', '/board/file/' + d2.id, { headers: { 'X-VRG-Ticket': dt.payload.ticket } })).status === 403, 'a download ticket for one id does not open another (and is spent)');
  ph.send('board.ticket', { op: 'download', id: d1.id }, 'relay');
  const dt2 = await ph.wait('board.ticket', 4);
  const pd = await req('GET', '/board/file/' + d1.id, { headers: { 'X-VRG-Ticket': dt2.payload.ticket } });
  ok(pd.status === 200 && pd.body.equals(a1) && pd.headers['content-type'] === 'application/octet-stream', 'the phone downloads with its ticket');
  ok((await req('GET', '/board/file/' + d1.id, { headers: { 'X-VRG-Ticket': dt2.payload.ticket } })).status === 403, 'and only once');
  ph.send('board.ticket', { op: 'download', id: '../board.json' }, 'relay');
  ok(!(await ph.wait('board.ticket', 5)).payload.ok, 'no ticket for a path');

  // removal: from the phone, then from the PC page
  ph.send('board.ticket', { op: 'download', id: d2.id }, 'relay');
  const pending = (await ph.wait('board.ticket', 6)).payload.ticket;
  ph.send('board.remove', { id: d2.id }, 'relay');
  const rm = await ph.wait('board.removed', 2);
  const evRm = await ph.wait('board', ev0 + 2);
  ok(rm.payload.ok && rm.payload.id === d2.id && evRm && evRm.payload.event === 'removed' && evRm.payload.id === d2.id, 'the phone removes an entry; the board event says so');
  ok((await req('GET', '/board/file/' + d2.id)).status === 404 && (await req('GET', '/board/file/' + d2.id, { headers: { 'X-VRG-Ticket': pending } })).status !== 200, 'a removed id: 404 at once, an outstanding ticket for it dead');
  ok(fs.readFileSync(path.join(DIR, '_removed', today, 'foto (2).jpg')).equals(a2) && !fs.existsSync(path.join(DIR, today, 'foto (2).jpg')), 'the file is in board\\_removed\\<today>\\, moved, not deleted');
  const rp = await req('POST', '/board/remove?id=' + ee.id, { headers: { Origin: ORIGIN } });
  ok(rp.status === 200 && fs.existsSync(path.join(DIR, '_removed', today, 'evil.html')) && (await req('GET', '/board/file/' + ee.id)).status === 404, 'the PC page removes one too, into _removed');
  ok(JSON.parse(fs.readFileSync(path.join(DIR, 'board.json'), 'utf8')).removed.length === 2, 'board.json keeps a record of what was removed');

  // the clipboard
  const nc = ph.n('clip');
  ph.send('clip.set', { text: 'Árvíztűrő tükörfúrógép — 42' }, 'relay');
  const c1 = await ph.wait('clip', nc + 1);
  ok(c1.payload.ok && fs.readFileSync(CLIP, 'utf8') === 'Árvíztűrő tükörfúrógép — 42', 'clip.set puts the text on the PC\'s clipboard, accents intact');
  fs.writeFileSync(CLIP, 'a PC vágólapja', 'utf8');
  ph.send('clip.get', {}, 'relay');
  const c2 = await ph.wait('clip', nc + 2);
  ok(c2.payload.ok && c2.payload.text === 'a PC vágólapja' && c2.payload.op === 'clip.get', 'clip.get brings the PC\'s clipboard to the phone');
  for (const t of [5, { a: 1 }, ['x'], null, '', 'x'.repeat(B.CLIP_MAX + 1)]) ph.send('clip.set', { text: t }, 'relay');
  ph.send('clip.set', { file: 'C:\\x.png' }, 'relay');
  await sleep(500);
  const bad = ph.got.filter(m => m.type === 'clip').slice(-7);
  ok(bad.length === 7 && bad.every(m => m.payload.ok === false) && fs.readFileSync(CLIP, 'utf8') === 'a PC vágólapja', 'the clipboard is text only: numbers, objects, empty, too long and no text refused, the clipboard unchanged');

  // a pairing removed on the PC: its tickets die with it
  ph.send('board.ticket', { op: 'upload' }, 'relay');
  const late = (await ph.wait('board.ticket', 7)).payload.ticket;
  const list = JSON.parse((await req('GET', '/pair/list.json')).body);
  await req('POST', '/pair/remove?id=' + list.phones[0].id);
  ok((await upload('late.txt', Buffer.from('l'), { headers: { 'X-VRG-Ticket': late, Origin: undefined } })).status === 403, 'after the pairing is removed its ticket is refused');

  ok(!parts().length, 'no .part left anywhere');
  ph.ws.close();
  relay.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
