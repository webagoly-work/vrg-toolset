#!/usr/bin/env node
// Mobile/tests/relay-screen.js — Képernyő (WP M13): the PC's screen on the phone. First relay-screen.js on
// its own, behind a small HTTP server in this process (tickets, the upgrade gate, frames in order, one
// viewer, the source stopping with the viewer and at the time limit, the pairing removed, the PC's
// Leállítás, a slow phone, nothing on disk), then the real relay with RELAY_FRAMES_DIR: off without
// --shots, refused for an untrusted phone, a paired phone watching, and the pairing removed on the PC.
//
//   node Mobile/tests/relay-screen.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Ports 47397 (the module) and 47398 /
// 47399 (the relay), a temporary paired-phones file and a temporary frames folder: no screen is captured,
// no window opens, and neither a running relay nor its pairings are touched.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const S = require(path.join(TOOLS, 'relay-screen.js'));

const PORT = 47397, RELAY_OFF = 47398, RELAY_ON = 47399;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-screen-'));
const FRAMES = path.join(TMP, 'frames');
const PAIRED = path.join(TMP, 'relay-paired.json');
fs.mkdirSync(FRAMES);

/** A tiny but well-formed JPEG head: SOI, an SOF0 with the size, some bytes, EOI. `tag` makes each one different. */
function fakeJpeg(w, h, tag, pad) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from(`frame:${tag};`), Buffer.alloc(pad || 0, tag), Buffer.from([0xff, 0xd9])]);
}
const FIX = [1, 2, 3, 4, 5].map(i => fakeJpeg(1280, 720, i));
FIX.forEach((b, i) => fs.writeFileSync(path.join(FRAMES, `${i + 1}.jpg`), b));
fs.writeFileSync(path.join(FRAMES, `10.jpg`), fakeJpeg(1280, 720, 10));        // numeric order: 1..5, 10
fs.writeFileSync(path.join(FRAMES, 'notes.txt'), 'not a frame');

/** Every file under a folder (names, recursively), to prove nothing new lands there. */
function listing(dir, depth) {
  const out = [];
  const walk = (d, n) => { let names = []; try { names = fs.readdirSync(d); } catch (e) { return; }
    for (const x of names) { const f = path.join(d, x); out.push(f); if (n > 0) { try { if (fs.statSync(f).isDirectory()) walk(f, n - 1); } catch (e) { } } } };
  walk(dir, depth || 0);
  return out.sort();
}

/** Connects to /screen. -> {ws, frames:[{seq, flags, w, h, len, body}], texts:[], closed:{code, reason}|null, status} */
function viewer(port, ticket, extra) {
  return new Promise(resolve => {
    const headers = Object.assign(ticket ? { 'X-VRG-Ticket': ticket } : {}, (extra && extra.headers) || {});
    const ws = new WS(`ws://127.0.0.1:${port}/screen${(extra && extra.query) || ''}`, { headers });
    const v = { ws, frames: [], texts: [], closed: null, status: 0, open: false };
    ws.on('unexpected-response', (req, res) => { v.status = res.statusCode; let b = ''; res.on('data', d => b += d); res.on('end', () => { v.body = b; resolve(v); }); });
    ws.on('open', () => { v.open = true; resolve(v); });
    ws.on('message', (d, bin) => {
      if (!bin) { try { v.texts.push(JSON.parse(d.toString())); } catch (e) { } return; }
      const b = Buffer.from(d);
      v.frames.push({ magic: b.subarray(0, 2).toString(), ver: b[2], flags: b[3], seq: b.readUInt32BE(4), w: b.readUInt16BE(8), h: b.readUInt16BE(10), len: b.readUInt32BE(12), body: b.subarray(16) });
    });
    ws.on('close', (code, reason) => { v.closed = { code, reason: reason.toString() }; });
    ws.on('error', () => { if (!v.open && !v.status) resolve(v); });
  });
}
const until = async (f, ms) => { for (let i = 0; i < (ms || 3000) / 25; i++) { if (f()) return true; await sleep(25); } return !!f(); };
const ended = v => v.texts.find(t => t.type === 'screen.end');

/** The module behind its own server; `opts` go to createScreen. */
function harness(opts) {
  const lines = [];
  const screen = S.createScreen(Object.assign({ enabled: true, log: l => lines.push(l), WebSocketServer: WS.WebSocketServer }, opts));
  const server = http.createServer((q, r) => { r.writeHead(404); r.end(); });
  server.on('upgrade', (req, socket, head) => {
    if ((req.url || '').split('?')[0] === '/screen') screen.upgrade(req, socket, head);
    else socket.destroy();
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r({ screen, server, lines, close: () => new Promise(c => { screen.close(); server.close(c); server.closeAllConnections && server.closeAllConnections(); }) })));
}

/** A stand-in source that records what the module asks of it. */
function spySource(log) {
  return (o, on) => {
    log.started = (log.started || 0) + 1; log.opts = o; log.on = on; log.sets = log.sets || [];
    let n = 0;
    const t = setInterval(() => on.frame(fakeJpeg(800, 600, ++n % 250), 800, 600, false), log.every || 30);
    setImmediate(() => on.status({ type: 'monitors', monitors: [{ i: 0, w: 800, h: 600, primary: true }, { i: 1, w: 1024, h: 768, primary: false }], mode: 'screen', monitor: 0, quality: 'high' }));
    return { set(s) { log.sets.push(s); }, stop() { log.stopped = (log.stopped || 0) + 1; clearInterval(t); } };
  };
}

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
  c.ready = new Promise(r => ws.on('open', r)).then(async () => { send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['state', 'cmd', 'screen'] }); c.welcome = await wait('welcome'); return c; });
  return c;
}

function get(port, p) {
  return new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method: p.startsWith('/pair/remove') ? 'POST' : 'GET', headers: { Host: `localhost:${port}` } }, x => {
      const c = []; x.on('data', d => c.push(d)); x.on('end', () => res({ status: x.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    r.on('error', () => res({ status: 0, body: '' }));
    r.end();
  });
}

function relay(port, args) {
  const p = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(port)].concat(args), {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: PAIRED, RELAY_FRAMES_DIR: FRAMES, RELAY_FRAMES_MS: '40', RELAY_BOARD_DIR: path.join(TMP, 'board'),
      RELAY_CLIP_FILE: path.join(TMP, 'clip.txt'), RELAY_OPEN_DRY: '1', RELAY_LAUNCH_DRY: '1', RELAY_PORTS: '', RELAY_SHOTS: '' }),
  });
  p.log = ''; p.stdout.on('data', d => p.log += d); p.stderr.on('data', d => p.log += d);
  return p;
}

async function pairPhone(port, device) {
  const ph = await phone(port).ready;
  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get(port, '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  ph.send('pair', { code, device, pub: key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }, 'relay');
  ph.paired = await ph.wait('paired');
  return ph;
}

(async () => {
  const tmpBefore = listing(os.tmpdir()).filter(f => !f.startsWith(TMP));
  const framesBefore = listing(FRAMES);

  // ---- the parts ------------------------------------------------------------------------------------------
  console.log('relay-screen.js: the parts');
  const h = S.frameHeader(7, 1280, 720, 1234, true);
  ok(h.length === 16 && h.toString('latin1', 0, 2) === 'VS' && h[2] === 1 && h[3] === 1 && h.readUInt32BE(4) === 7 && h.readUInt16BE(8) === 1280 && h.readUInt16BE(10) === 720 && h.readUInt32BE(12) === 1234,
    'the frame header: VS, version 1, flags, seq, width, height, length (16 bytes, big-endian)');
  ok(S.jpegSize(FIX[0]).w === 1280 && S.jpegSize(FIX[0]).h === 720 && S.jpegSize(Buffer.from('nope')).w === 0, 'jpegSize reads the SOF, and gives 0 for anything else');
  const mons = [{ i: 0 }, { i: 1 }];
  ok(JSON.stringify(S.checkSettings({ mode: 'window', monitor: 1, quality: 'low' }, mons)) === '{"mode":"window","monitor":1,"quality":"low"}', 'screen.set: a valid mode, monitor and quality pass');
  ok([{ mode: 'all', monitor: 0, quality: 'low' }, { mode: 'screen', monitor: 2, quality: 'low' }, { mode: 'screen', monitor: -1, quality: 'high' }, { mode: 'screen', monitor: '0; calc', quality: 'high' },
    { mode: 'screen', monitor: 0, quality: 'max' }, null, 'set'].every(p => S.checkSettings(p, mons) === null), 'screen.set: an unknown mode, monitor or quality is ignored, nothing is passed on');
  {
    const got = []; let err = null;
    const push = S.psParser(p => got.push(p), e => err = e);
    const pkt = (t, body) => { const b = Buffer.alloc(5); b[0] = t.charCodeAt(0); b.writeUInt32BE(body.length, 1); return Buffer.concat([b, body]); };
    const all = Buffer.concat([pkt('S', Buffer.from('{"type":"monitors"}')), pkt('F', Buffer.concat([Buffer.from([5, 0, 2, 208, 0]), FIX[0]])), pkt('F', Buffer.from([0, 1, 0, 1, 1, 9]))]);
    for (let i = 0; i < all.length; i += 7) push(all.subarray(i, i + 7));          // split anywhere
    ok(!err && got.length === 3 && got[0].type === 'S' && got[1].type === 'F' && got[1].payload.readUInt16BE(0) === 1280 && got[1].payload.subarray(5).equals(FIX[0]) && got[2].payload[4] === 1,
      'the capture process\'s stdout is split into packets wherever the chunks break');
    push(Buffer.from('X\0\0\0\1z')); push(pkt('S', Buffer.from('{}')));
    ok(err && got.length === 3, 'an unknown packet type stops the parser for good');
    let e2 = null; S.psParser(() => { }, e => e2 = e)(Buffer.from([0x46, 0x7f, 0xff, 0xff, 0xff]));
    ok(e2, 'an absurd length is a broken stream, not a 2 GB buffer');
  }
  ok(!/EncodedCommand/.test(S.captureSource.toString()) && /'-Command', PS/.test(S.captureSource.toString()), 'the capture runs with -Command (an -EncodedCommand child was killed after ~10 s here)');
  ok(!/process\.env\.|VRG_SCREEN_VIEWER\s*=/.test(S.PS.replace(/\$env:VRG_SCREEN_\w+/g, '')) && /\$env:VRG_SCREEN_VIEWER/.test(S.PS), 'the phone\'s name reaches the capture through the environment, never the command line');
  ok(/CopyFromScreen/.test(S.CS) && /DrawIconEx/.test(S.CS) && /TopMost = true/.test(S.CS) && /"Leállítás"/.test(S.CS) && /A telefon látja a képernyőt: /.test(S.CS) && !/\.Save\(\s*"|File\.|Path\.GetTemp/.test(S.CS),
    'the capture draws the cursor, shows the always-on-top window with Leállítás, and never names a file');

  // ---- the module behind a server ------------------------------------------------------------------------
  console.log('relay-screen.js: tickets, the upgrade, frames');
  {
    const off = S.createScreen({ enabled: false, WebSocketServer: WS.WebSocketServer, log: () => { } });
    const r = off.ticket('p1', 'Teszt');
    ok(!r.ok && /--shots/.test(r.reason) && !off.available, 'without --shots: no ticket, and the reason says how to turn it on');
    const lin = S.createScreen({ enabled: true, platform: 'linux', framesDir: null, WebSocketServer: WS.WebSocketServer, log: () => { } });
    ok(!lin.ticket('p1', 'Teszt').ok && /Windows/.test(lin.ticket('p1', 'Teszt').reason), 'not Windows and no frames folder: a clear refusal (📸 still works there)');
  }

  let clock = Date.now();
  const paired = new Set(['p1', 'p2']);
  const spy = {};
  let hx = await harness({ source: spySource(spy), now: () => clock, isPaired: id => paired.has(id) });
  {
    const t = hx.screen.ticket('p1', 'Pixel teszt');
    ok(t.ok && /^[0-9a-f]{32}$/.test(t.ticket) && t.ttl === 60000 && t.path === '/screen', 'a paired phone gets a 128-bit ticket for 60 s');
    ok((await viewer(PORT, null)).status === 403, 'no ticket: refused');
    ok((await viewer(PORT, 'f'.repeat(32))).status === 403 && (await viewer(PORT, 'not-a-ticket')).status === 403, 'a made-up or malformed ticket: refused');
    ok((await viewer(PORT, null, { query: '?ticket=' + t.ticket })).status === 403, 'the ticket in the URL does nothing');
    const late = hx.screen.ticket('p1', 'Pixel teszt').ticket;
    clock += 61000;
    ok((await viewer(PORT, late)).status === 403, 'a ticket older than 60 s: refused');
    const gone = hx.screen.ticket('p2', 'Masik').ticket;
    paired.delete('p2');
    ok((await viewer(PORT, gone)).status === 403, 'a ticket whose pairing was removed: refused');
    ok(spy.started === undefined, '… and no capture started for any of them');

    const t2 = hx.screen.ticket('p1', 'Pixel teszt').ticket;
    const pre = hx.screen.ticket('p1', 'Pixel teszt').ticket;              // issued before anyone watches
    const v = await viewer(PORT, t2);
    ok(v.open && spy.started === 1 && spy.opts.viewer === 'Pixel teszt', 'a valid ticket opens the stream; the capture starts with the viewer, with the phone\'s name for the PC window');
    ok((await viewer(PORT, t2)).status === 403, 'a used ticket: refused');
    await until(() => v.frames.length >= 8);
    const seqs = v.frames.map(f => f.seq);
    ok(v.frames.length >= 8 && seqs.every((s, i) => s === i + 1), `frames arrive in order (${v.frames.length}, seq 1..n with no gap)`);
    ok(v.frames.every(f => f.magic === 'VS' && f.ver === 1 && f.w === 800 && f.h === 600 && f.len === f.body.length && f.body[0] === 0xff && f.body[1] === 0xd8), 'each frame: the header, then exactly `length` bytes of JPEG');
    ok(v.texts.some(x => x.type === 'screen.monitors' && x.monitors.length === 2), 'the monitors are announced on the screen socket');

    const busy = hx.screen.ticket('p1', 'Masodik telefon');
    ok(!busy.ok && busy.busy && /Pixel teszt/.test(busy.reason), 'a second viewer gets no ticket, and the answer names the phone that is watching');
    const second = await viewer(PORT, pre);
    ok(second.status === 409 && /Pixel teszt/.test(second.body) && spy.started === 1, '… and a ticket issued earlier is refused (409) while someone watches');

    v.ws.send(JSON.stringify({ type: 'screen.set', mode: 'window', monitor: 1, quality: 'low' }));
    v.ws.send(JSON.stringify({ type: 'screen.set', mode: 'window', monitor: 7, quality: 'low' }));
    v.ws.send(JSON.stringify({ type: 'screen.set', mode: 'rm -rf', monitor: 0, quality: 'high' }));
    v.ws.send(Buffer.from('binary from the phone'));
    await until(() => spy.sets.length >= 1, 1000); await sleep(150);
    ok(spy.sets.length === 1 && spy.sets[0].mode === 'window' && spy.sets[0].monitor === 1 && spy.sets[0].quality === 'low', 'screen.set changes mode / monitor / quality on the same ticket; a bad one or a binary message is ignored');
    v.ws.send('x'.repeat(10000));
    await until(() => v.closed, 1500);
    ok(v.closed && v.closed.code === 1009 && spy.stopped === 1 && !hx.screen.live, 'an oversized message from the phone closes it, and the capture stops with it');

    // the viewer leaves: the source stops
    const v2 = await viewer(PORT, hx.screen.ticket('p1', 'Pixel teszt').ticket);
    await until(() => v2.frames.length >= 2);
    v2.ws.close();
    await until(() => spy.stopped === 2, 2000);
    ok(spy.stopped === 2 && spy.started === 2 && !hx.screen.live, 'the capture stops with the last viewer');
    ok(hx.lines.some(l => /\[kepernyo\] nezi: Pixel teszt/.test(l)) && hx.lines.some(l => /\[kepernyo\] vege \(left\)/.test(l)), 'every start and stop is logged on the relay console');

    // the PC's Leállítás
    const v3 = await viewer(PORT, hx.screen.ticket('p1', 'Pixel teszt').ticket);
    await until(() => v3.frames.length >= 1);
    spy.on.exit('pc');
    await until(() => v3.closed);
    ok(ended(v3) && ended(v3).reason === 'pc' && v3.closed.code === 4000 && !hx.screen.live, 'Leállítás on the PC ends the stream at once (screen.end pc, 4000)');

    // the capture becomes impossible, then recovers
    const v4 = await viewer(PORT, hx.screen.ticket('p1', 'Pixel teszt').ticket);
    await until(() => v4.frames.length >= 1);
    spy.on.status({ type: 'state', visible: false, reason: 'The handle is invalid' });
    spy.on.status({ type: 'state', visible: true });
    await until(() => v4.texts.filter(x => x.type === 'screen.state').length >= 2);
    const st = v4.texts.filter(x => x.type === 'screen.state');
    ok(st.length === 2 && st[0].visible === false && /nem látható/.test(st[0].reason) && !/handle/.test(st[0].reason) && st[1].visible === true && v4.open && !v4.closed,
      'a UAC prompt / lock screen: "nem látható", then visible again, and the stream stays up');
    // the pairing removed
    const tGone = Date.now();
    hx.screen.revoke('p1');
    await until(() => v4.closed, 1000);
    ok(ended(v4) && ended(v4).reason === 'unpaired' && v4.closed.code === 4410 && Date.now() - tGone < 500 && spy.stopped === 4, 'a removed pairing ends the stream at once (4410) and stops the capture');
    await hx.close();
  }

  // the time limit
  console.log('relay-screen.js: the 30-minute limit (shortened), a slow phone');
  {
    const spyL = {};
    const hl = await harness({ source: spySource(spyL), limitMs: 400 });
    const v = await viewer(PORT, hl.screen.ticket('p1', 'Pixel teszt').ticket);
    await until(() => v.closed, 2000);
    ok(ended(v) && ended(v).reason === 'limit' && /Folytatás/.test(ended(v).text) && v.closed.code === 4408 && spyL.stopped === 1, 'the stream and the capture stop at the limit (4408, the phone offers Folytatás)');
    const again = await viewer(PORT, hl.screen.ticket('p1', 'Pixel teszt').ticket);
    ok(again.open, '… and a new ticket starts it again');
    again.ws.close();
    await hl.close();
  }

  // a slow phone: frames are dropped, the relay's memory does not grow
  {
    // a fast, big source: 60 KB frames every 5 ms
    const big = Buffer.concat([fakeJpeg(1280, 720, 7), crypto.randomBytes(60 * 1024)]);
    const hb = await harness({ source: (o, on) => { const t = setInterval(() => on.frame(big, 1280, 720, false), 5); return { set() { }, stop() { clearInterval(t); } }; } });
    const v = await viewer(PORT, hb.screen.ticket('p1', 'Lassu telefon').ticket);
    v.ws._socket.pause();                                       // the phone stops reading
    const rss0 = process.memoryUsage().rss;
    let maxBuf = 0;
    for (let i = 0; i < 60; i++) { await sleep(50); const l = hb.screen.live; if (l) maxBuf = Math.max(maxBuf, l.buffered); }
    const l = hb.screen.live;
    const grew = process.memoryUsage().rss - rss0;
    ok(l && l.dropped > 100, `a phone that does not read: frames are dropped (${l && l.dropped} in 3 s), not queued`);
    ok(maxBuf <= S.MAX_BUFFERED + big.length + 16, `the relay never holds more than ~one frame over the limit (${Math.round(maxBuf / 1024)} KB at most)`);
    ok(grew < 40 * 1024 * 1024, `the relay's memory does not grow with the backlog (${Math.round(grew / 1048576)} MB in 3 s, ~${Math.round(600 * big.length / 1048576)} MB offered)`);
    const before = v.frames.length;
    v.ws._socket.resume();
    await until(() => v.frames.length > before + 5, 3000);
    const after = v.frames.slice(before);
    ok(after.length > 5 && after.every((f, i) => i === 0 || f.seq === after[i - 1].seq + 1), 'when it reads again, the newest frames come, still in order');
    v.ws.close();
    await hb.close();
  }

  // the frames folder
  {
    const got = []; const st = [];
    const src = S.framesSource(FRAMES, { frameMs: 20 }, { frame: (j, w, h) => got.push({ j, w, h }), status: o => st.push(o), exit() { } });
    await until(() => got.length >= 12);
    src.stop();
    const tags = got.map(g => /frame:(\d+);/.exec(g.j.toString('latin1'))[1]);
    ok(tags.slice(0, 12).join() === '1,2,3,4,5,10,1,2,3,4,5,10' && got.every(g => g.w === 1280 && g.h === 720) && st[0].type === 'monitors',
      'RELAY_FRAMES_DIR plays its *.jpg in numeric order, in a loop, and announces monitors');
  }

  // ---- the real relay ----------------------------------------------------------------------------------
  console.log('phone-relay-server.js: screen.ticket and /screen');
  {
    const r0 = relay(RELAY_OFF, []);
    await sleep(900);
    const ph = await pairPhone(RELAY_OFF, 'Teszt telefon');
    ok(ph.paired && ph.paired.payload.ok, 'a phone pairs with a relay started without --shots');
    ph.send('screen.ticket', {}, 'relay');
    const t = await ph.wait('screen.ticket');
    ok(t && !t.payload.ok && /--shots/.test(t.payload.reason), 'without --shots even a paired phone gets no ticket');
    ok((await viewer(RELAY_OFF, 'a'.repeat(32))).status === 404 && JSON.parse((await get(RELAY_OFF, '/whoami')).body).screen === false, '/screen is not there at all, and /whoami says screen:false');
    ok(/Képernyő élőben: ki \(indítás --shots/.test(r0.log), 'the banner says it is off');
    ph.ws.close();
    r0.kill();
  }
  {
    const r1 = relay(RELAY_ON, ['--shots']);
    await sleep(900);
    ok(JSON.parse((await get(RELAY_ON, '/whoami')).body).screen === true && /Képernyő élőben a telefonon: BEKAPCSOLVA/.test(r1.log), 'with --shots: /whoami says screen:true, the banner says it is on');
    const stranger = await phone(RELAY_ON).ready;
    stranger.send('screen.ticket', {}, 'relay');
    const st = await stranger.wait('screen.ticket');
    ok(st && !st.payload.ok && st.payload.trusted === false && !st.payload.ticket, 'an unpaired phone gets no ticket (trusted:false)');
    ok((await viewer(RELAY_ON, null)).status === 403, 'and /screen without a ticket is refused');
    stranger.ws.close();

    const ph = await pairPhone(RELAY_ON, 'Pixel 7');
    ph.send('screen.ticket', {}, 'relay');
    const t = await ph.wait('screen.ticket');
    ok(t && t.payload.ok && /^[0-9a-f]{32}$/.test(t.payload.ticket), 'a paired phone gets a ticket over the control link');
    const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'relay-screen-ticket.json'), 'utf8'));
    ok(Object.keys(t.payload).sort().join() === Object.keys(fx.payload).sort().join(), 'the live ticket answer has the fields of the Kotlin test fixture (relay-screen-ticket.json)');
    const v = await viewer(RELAY_ON, t.payload.ticket);
    await until(() => v.frames.length >= 8);
    const tags = v.frames.map(f => /frame:(\d+);/.exec(f.body.toString('latin1'))[1]);
    ok(v.frames.length >= 8 && tags.slice(0, 6).join() === '1,2,3,4,5,10' && v.frames.every((f, i) => f.seq === i + 1 && f.w === 1280), 'the paired phone watches: the frames folder\'s frames, in order');
    const mon = v.texts.find(x => x.type === 'screen.monitors');
    const fxm = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'relay-screen-monitors.json'), 'utf8'));
    ok(mon && Object.keys(mon).sort().join() === Object.keys(fxm).sort().join(), 'screen.monitors has the fields of the Kotlin test fixture (relay-screen-monitors.json)');
    ok(/\[kepernyo\] nezi: Pixel 7/.test(r1.log), 'the relay console logs who is watching');

    ph.send('screen.ticket', {}, 'relay');
    const busy = await ph.wait('screen.ticket', 2);
    ok(busy && !busy.payload.ok && /Pixel 7/.test(busy.payload.reason), 'a second ticket while it streams: refused, naming the phone');

    // removing the pairing on the PC ends it at once
    const list = JSON.parse((await get(RELAY_ON, '/pair/list.json')).body);
    await get(RELAY_ON, '/pair/remove?id=' + list.phones.find(p => p.device === 'Pixel 7').id);
    await until(() => v.closed, 1500);
    ok(ended(v) && ended(v).reason === 'unpaired' && v.closed.code === 4410, 'removing the pairing on the PC ends the stream at once');
    ok(/\[kepernyo\] vege \(unpaired\)/.test(r1.log), '… and the relay console logs the stop');
    ph.ws.close();
    r1.kill();
  }

  await sleep(300);
  const tmpAfter = listing(os.tmpdir()).filter(f => !f.startsWith(TMP));
  const newTmp = tmpAfter.filter(f => !tmpBefore.includes(f) && /vrg|screen|shot|\.jpe?g$/i.test(f));
  ok(!newTmp.length && JSON.stringify(listing(FRAMES)) === JSON.stringify(framesBefore), 'no frame reached the disk: nothing new in the temp folder, the frames folder unchanged' + (newTmp.length ? ' ' + newTmp.join(', ') : ''));

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
