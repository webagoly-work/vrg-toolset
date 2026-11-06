#!/usr/bin/env node
// Mobile/tests/relay-launch.js — Indítópult (WP M11): the list built from START's registry
// (launcher/vrg-menu.json through launcher/menu.js) and Mobile/catalogue/launch.json, ids outside it
// refused, every command made from registry values only (never from the phone's string), and then a
// real relay: an untrusted phone refused, a paired phone listing, running (dry: nothing starts or
// opens), status, log and stop.
//
//   node Mobile/tests/relay-launch.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses port 47395 and a temporary
// paired-phones file, so a running relay is not disturbed.
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'Planner/projects/varler-planner/tools');
const WS = require(path.join(REPO, 'Planner/projects/varler-planner/node_modules/ws'));
const L = require(path.join(TOOLS, 'relay-launch.js'));
const menu = require(path.join(REPO, 'launcher/menu.js'));

const PORT = 47395;
const FX = path.join(__dirname, 'fixtures');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-launch-'));
const FILE = path.join(TMP, 'relay-paired.json');

function get(port, p, opts) {
  opts = opts || {};
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: opts.method || 'GET' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b }));
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
    for (let i = 0; i < (ms || 3000) / 50; i++) { const m = got.filter(x => x.type === type); if (m.length >= (n || 1)) return m[m.length - 1]; await sleep(50); }
    return null;
  };
  const c = { ws, got, send, wait };
  c.ready = new Promise(r => ws.on('open', r)).then(async () => {
    send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['state', 'cmd', 'launch'] });
    c.welcome = await wait('welcome');
    return c;
  });
  return c;
}

(async () => {
  // ---- the list ---------------------------------------------------------------------------------
  console.log('relay-launch.js: the list from launcher/vrg-menu.json');
  const reg = menu.reload();
  const list = L.buildList();
  const regTools = reg.start.tools.filter(t => t.path || (t.server && t.page));
  const tools = [...list.values()].filter(e => e.pub.kind === 'tool');
  ok(tools.length === regTools.length && regTools.every(t => list.has('tool:' + t.key)), `every START tool is listed (${tools.length}): ${tools.map(e => e.pub.key).join(' ')}`);
  ok(regTools.every(t => list.get('tool:' + t.key).pub.name === t.name && list.get('tool:' + t.key).pub.key === t.key), 'with its registry name and its START key, unchanged');
  ok(list.get('tool:K').plan.before && /scan\.js$/.test(list.get('tool:K').plan.before.args[0]), 'Kódváros keeps its "before" step (the repo scan)');
  ok(list.get('tool:1').pub.server === 'planner' && list.get('tool:1').pub.port === 8131, 'the Planner tool is served by the planner dev server (:8131): its running dot');

  const allow = L.loadAllow();
  const ids = new Set((reg.servers || []).map(s => s.id));
  ok([...allow.servers].every(id => ids.has(id)) && [...allow.servers].every(id => list.has('server:' + id)), 'every allowed server is a registry server and is listed');
  ok(Object.entries(allow.serves).every(([k, id]) => ids.has(id) && reg.start.tools.some(t => t.key === k)), 'every "serves" line names a registry tool and server');
  const extraIds = reg.start.tools.flatMap(t => (t.extras || []).map(x => t.key + '.' + x.key));
  ok([...allow.extras].every(id => extraIds.includes(id) && list.has('extra:' + id)), 'every allowed extra is a registry extra and is listed');
  ok(!list.has('server:gyro') && !list.has('server:hub-admin') && !list.has('server:board') && !list.has('extra:K.F'), 'not listed: the relay itself, the allow-list admin, USB hardware, the Electron download');
  ok([...list.keys()].every(id => L.ID.test(id)), 'every id has the id shape');

  // ---- refusals ---------------------------------------------------------------------------------
  console.log('relay-launch.js: ids outside the list');
  const bad = ['tool:Z', 'server:gyro', 'server:hub-admin', 'extra:K.F', '__proto__', 'constructor', 'toString', 'tool:1 & calc', 'tool:1;calc',
    'tool:1\n', 'tool:../../x', 'server:city/../x', 'C:\\Windows\\System32\\calc.exe', 'calc', '', 'x'.repeat(500), 5, null, undefined, {}, ['tool:1'], { id: 'tool:1' }];
  ok(bad.every(id => !L.pick(list, id).ok), 'refused: unknown keys, servers not allowed, prototype names, shell metacharacters, paths, non-strings');

  // ---- commands ---------------------------------------------------------------------------------
  console.log('relay-launch.js: commands');
  const pc = L.pageCommand('H:\\a&b %PATH%\\x.html', 'win32', 'C:\\c\\chrome.exe');
  ok(pc[0] === 'C:\\c\\chrome.exe' && pc[1][0] === '--new-window' && pc[1][1] === 'H:\\a&b %PATH%\\x.html', 'a page opens in the portable Chrome, as one argument');
  const ps = L.pageCommand('http://localhost:8124/a&b=%PATH%', 'win32', null);
  ok(ps[0] === 'rundll32.exe' && ps[1][1] === 'http://localhost:8124/a&b=%PATH%', 'without it the system handler, with no cmd.exe to read & or %');
  const mm = reg.servers.find(s => s.id === 'mindmap');
  const sc = L.serverCommand(mm, 'N:\\node.exe');
  ok(sc[0] === 'N:\\node.exe' && sc[1][0] === menu.resolve(mm.js) && sc[2] === REPO, 'a server: node + its registry script, in the repo');
  ok(L.serverCommand({ id: 'x', bat: 'x.bat' }, 'node') === null, 'a bat server is not started from the phone');
  ok(L.urlOfExtra({ exe: 'C:\\Windows\\System32\\rundll32.exe', args: ['url.dll,FileProtocolHandler', 'http://localhost:8797/homeland'] }) === 'http://localhost:8797/homeland' &&
     L.urlOfExtra({ exe: 'rundll32.exe', args: ['shell32.dll,Control_RunDLL'] }) === null, 'Gépország\'s rundll32 url.dll becomes a page to open (with the Chrome fallback); other rundll32 calls do not');

  // every id run with fakes: what was run is made of registry strings only
  const up = new Set();
  const spawned = [];
  const fake = L.createLauncher({ dry: false, chrome: 'C:\\c\\chrome.exe', node: 'N:\\node.exe', wait: 1, logDir: TMP,
    listening: async () => up,
    spawn: (cmd, args, o) => { spawned.push({ cmd, args, o }); const s = reg.servers.find(x => args[0] && x.js && menu.resolve(x.js) === args[0]); if (s) up.add(s.port); return { pid: 0 }; },
    runBefore: async () => 0 });
  const known = new Set(['C:\\c\\chrome.exe', 'N:\\node.exe', '--new-window']);
  const addAll = o => { for (const v of Object.values(o)) { if (typeof v === 'string') { known.add(v); known.add(menu.resolve(v)); } else if (v && typeof v === 'object') addAll(v); } };
  addAll(reg);
  for (const s of reg.servers) known.add(L.serverUrl(s));
  const results = {};
  for (const id of list.keys()) results[id] = await fake.run(list, id);
  const strays = fake.log.flatMap(r => [r.cmd, ...r.args]).filter(a => !known.has(a));
  ok(fake.log.length > 0 && strays.length === 0, `every command and argument of ${fake.log.length} runs comes from the registry` + (strays.length ? ': ' + strays.join(' | ') : ''));
  const p1 = fake.log.find(r => r.args[1] === menu.resolve(reg.start.tools.find(t => t.key === '1').path));
  ok(p1 && p1.cmd === 'C:\\c\\chrome.exe', 'tool:1 opens the Planner page in the portable Chrome');
  const kIdx = fake.log.findIndex(r => /scan\.js$/.test(r.args[0] || ''));
  ok(kIdx >= 0 && fake.log[kIdx + 1] && /vrg-codecity\.html$/.test(fake.log[kIdx + 1].args[1]), 'tool:K runs the repo scan first, then opens Kódváros');
  ok(results['server:mindmap'].ok && results['server:mindmap'].started === true && spawned.some(s => s.args[0] === menu.resolve(mm.js) && s.o.detached === true && s.o.windowsHide === true),
    'server:mindmap not running: started detached, no window, then opened');
  ok(spawned.some(s => s.args[1] === 'http://localhost:8124/'), '… and its page opened at http://localhost:8124/');
  const before = fake.log.length;
  for (const id of bad) await fake.run(list, id);
  ok(fake.log.length === before, 'a refused id runs nothing');
  ok((await fake.status(list)).running.includes('server:mindmap') && (await fake.status(list)).mine.includes('server:mindmap'), 'status: the started server is running and marked as started here');
  ok(fake.stop(list, 'server:mindmap').ok && !fake.stop(list, 'server:mindmap').ok && !fake.stop(list, 'tool:2').ok && !fake.stop(list, 'server:gyro').ok,
    'stop: only a server this relay started, once; not a page, not an id outside the list');
  const ghost = L.createLauncher({ dry: false, chrome: null, platform: 'win32', listening: async () => new Set(), spawn: () => { throw new Error('nothing should start'); } });
  ok((await ghost.run(L.buildList({ exists: () => false }), 'tool:1')).ok === false, 'a tool whose page is missing is refused before anything runs');

  // ---- the relay --------------------------------------------------------------------------------
  console.log('phone-relay-server.js: launch.*');
  const relay = spawn(process.execPath, [path.join(TOOLS, 'phone-relay-server.js'), String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: FILE, RELAY_OPEN_DRY: '1', RELAY_LAUNCH_DRY: '1', RELAY_PORTS: '' }),
  });
  relay.log = ''; relay.stdout.on('data', d => relay.log += d); relay.stderr.on('data', d => relay.log += d);
  await sleep(900);

  const a = await phone(PORT).ready;
  a.send('launch.list', {}, 'relay');
  const l0 = await a.wait('launch');
  ok(l0 && l0.payload.ok === false && l0.payload.trusted === false && !l0.payload.entries, 'an untrusted phone asking for the list is refused');
  a.send('launch.run', { id: 'tool:1' }, 'relay');
  const r0 = await a.wait('launch.ran');
  ok(r0 && r0.payload.ok === false && r0.payload.trusted === false && !/\[start\] inditas/.test(relay.log), 'an untrusted phone cannot start anything');

  const code = /&c=([0-9a-f]{32})/.exec(JSON.parse((await get(PORT, '/pair/code.json')).body).link)[1];
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = key.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  a.send('pair', { code, device: 'Teszt telefon', pub }, 'relay');
  const paired = await a.wait('paired');
  ok(paired && paired.payload.ok, 'the phone pairs');

  a.send('launch.list', {}, 'relay');
  const l1 = await a.wait('launch', 2, 15000);
  const e1 = l1 && l1.payload.entries;
  ok(l1 && l1.payload.ok === true && Array.isArray(e1) && regTools.every(t => e1.some(e => e.id === 'tool:' + t.key && e.key === t.key)), `the paired phone gets every START tool (${e1 ? e1.length : 0} entries)`);
  ok(Array.isArray(l1.payload.running) && Array.isArray(l1.payload.mine) && l1.payload.proxy && l1.payload.proxy.on === false, 'with running / mine, and the proxy off (no --ports)');
  const fx = JSON.parse(fs.readFileSync(path.join(FX, 'relay-launch-answer.json'), 'utf8')).payload;
  const fxKeys = Object.keys(fx.entries[0]).sort().join(',');
  const live1 = e1.find(e => e.id === 'tool:1');
  ok(live1 && Object.keys(live1).sort().join(',') === fxKeys && Object.keys(l1.payload).sort().join(',') === Object.keys(fx).sort().join(','),
    'the live answer has the fields of the Kotlin test fixture (relay-launch-answer.json)');

  a.send('launch.run', { id: 'tool:4' }, 'relay');
  const r1 = await a.wait('launch.ran', 2, 15000);
  ok(r1 && r1.payload.ok === true && r1.payload.id === 'tool:4' && r1.payload.dry === true, 'launch.run tool:4 (MindMap) opens it (dry run): ' + (r1 && r1.payload.how));
  for (const id of ['server:gyro', 'tool:1 & calc', '__proto__', 'C:\\Windows\\System32\\calc.exe']) a.send('launch.run', { id }, 'relay');
  a.send('launch.run', { id: 5 }, 'relay');
  a.send('launch.run', { cmd: 'calc.exe' }, 'relay');
  await sleep(400);
  const refused = a.got.filter(m => m.type === 'launch.ran').slice(-6);
  ok(refused.length === 6 && refused.every(m => m.payload.ok === false), 'launch.run refuses ids outside the list, a number, and a payload with no id');
  a.send('launch.status', {}, 'relay');
  const s1 = await a.wait('launch.status', 1, 15000);
  ok(s1 && s1.payload.ok === true && Array.isArray(s1.payload.running), 'launch.status answers');
  a.send('launch.log', { id: 'server:mindmap' }, 'relay');
  const g1 = await a.wait('launch.log');
  ok(g1 && g1.payload.ok === true && Array.isArray(g1.payload.lines), 'launch.log answers with lines (or a note)');
  a.send('launch.stop', { id: 'server:planner' }, 'relay');
  const t1 = await a.wait('launch.stopped');
  ok(t1 && t1.payload.ok === false, 'launch.stop refuses a server the relay did not start');

  a.ws.close();
  relay.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
