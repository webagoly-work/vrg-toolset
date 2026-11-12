#!/usr/bin/env node
// Mobile/tests/relay-claude.js — Claude (WP M22): Remote Control sessions on the PC from a paired phone.
// The folder list from START's own Claude Code menu (launcher/vrg-menu.json, start.dev C) narrowed by Mobile/catalogue/claude.json;
// keys, accounts and ids outside the lists refused; the command made of registry / profile values and the relay's own name only;
// the session link read from the output (ANSI stripped); then a real relay: off without --claude, an untrusted phone refused, a
// paired phone listing, starting, stopping.
//
// NEVER the real `claude`: VRG_CLAUDE_BIN points at fixtures/claude-stub.js, which prints a fake link and waits to be killed.
//
//   node Mobile/tests/relay-claude.js
//
// Needs `npm install` in Planner/projects/varler-planner (for ws). Uses ports 47396 / 47397 and temporary files.
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
const C = require(path.join(TOOLS, 'relay-claude.js'));
const menu = require(path.join(REPO, 'launcher/menu.js'));

const STUB = path.join(__dirname, 'fixtures', 'claude-stub.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-claude-'));

function get(port, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); });
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
  c.ready = new Promise(r => ws.on('open', r)).then(async () => { send('hello', { role: 'phone', app: 'vrg-mobile', caps: ['claude'] }); c.welcome = await wait('welcome'); return c; });
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
    env: Object.assign({}, process.env, { RELAY_PAIRED_FILE: path.join(TMP, `paired-${port}.json`), RELAY_OPEN_DRY: '1', RELAY_PORTS: '', RELAY_CLAUDE: '' }, env),
  });
  r.log = ''; r.stdout.on('data', d => r.log += d); r.stderr.on('data', d => r.log += d);
  return r;
}

(async () => {
  // ---- the folders ------------------------------------------------------------------------------------
  console.log('relay-claude.js: folders from START → C');
  const reg = menu.reload();
  const items = reg.start.dev.find(x => x.key === 'C').menu.items;
  const allow = C.loadAllow();
  const folders = C.buildFolders();
  ok([...allow.folders].every(k => items.some(i => i.key === k)), 'every allowed key is a START → C item');
  ok([...folders.keys()].join(',') === [...allow.folders].filter(k => fs.existsSync(menu.resolve(items.find(i => i.key === k).cwd))).join(','), `the folders are the allowed items whose folder exists (${[...folders.keys()].join(' ')})`);
  ok(folders.get('1').cwd === REPO && folders.get('1').name === items.find(i => i.key === '1').name, '1 = the repo root, with its START name');
  ok(!folders.has('B'), 'not B (Bernard, an agent with its own arguments)');
  ok(C.buildFolders({ exists: () => false }).size === 0, 'a folder that does not exist is not offered');

  // ---- the exe, the account, the name, the command, the link -----------------------------------------------
  console.log('relay-claude.js: the command');
  ok(JSON.stringify(C.claudeExe({ VRG_CLAUDE_BIN: STUB }, { node: 'N:\\node.exe' })) === JSON.stringify({ exe: 'N:\\node.exe', lead: [STUB], test: true }), 'VRG_CLAUDE_BIN = a .js runs through node');
  ok(C.claudeExe({ VRG_CLAUDE_BIN: 'stub.js' }, { resolve: () => '{claude}' }) === null, 'a relative VRG_CLAUDE_BIN is ignored');
  const real = C.claudeExe({}, { resolve: () => 'H:\\VRG\\Full\\tools\\node\\claude.cmd', exists: p => /claude\.exe$/.test(p) });
  ok(real && real.exe === path.join('H:\\VRG\\Full\\tools\\node', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe') && real.lead.length === 0, 'START\'s {claude} (claude.cmd) → the claude.exe it calls: no cmd.exe, no shell');
  ok(C.claudeExe({}, { resolve: () => 'X:\\claude.cmd', exists: () => false }) === null, 'not installed → null (the phone is told)');
  ok(Object.keys(C.accountEnv('A')).length === 0, 'account A: the profile has no env of its own');
  ok(/claude-account-b$/.test(C.accountEnv('B').CLAUDE_CONFIG_DIR || ''), 'account B: CLAUDE_CONFIG_DIR from the Desktop profile, resolved');
  const name = C.sessionName({ name: 'A repo gyökere & "x" | calc' }, new Date(2026, 10, 12, 9, 5));
  ok(name === 'VRG A repo gyokere x calc 09:05', 'the name is made here, ASCII letters, digits and spaces: ' + name);
  const [cmd, args] = C.command({ exe: 'E:\\claude.exe', lead: [] }, name);
  ok(cmd === 'E:\\claude.exe' && JSON.stringify(args) === JSON.stringify(['remote-control', '--name', name]), 'claude.exe remote-control --name <name>, the name one argument');
  ok(C.linkIn('\x1b[36mhttps://claude.ai/code/session_01X?name=VRG%20a\x1b[0m\n') === 'https://claude.ai/code/session_01X?name=VRG%20a', 'the link, ANSI stripped');
  ok(C.linkIn('see https://evil.example/claude.ai/code') === null && C.linkIn('http://claude.ai/code/x') === null, 'only https://claude.ai links');
  ok(C.linkIn('(https://claude.ai/code/s1).') === 'https://claude.ai/code/s1', 'trailing punctuation dropped');

  // ---- the sessions, with the stub ----------------------------------------------------------------------
  console.log('relay-claude.js: start / list / stop with the stub (never the real claude)');
  const rc = C.createClaude({ file: path.join(TMP, 'sessions.json'), logDir: path.join(TMP, 'logs'), env: Object.assign({}, process.env, { VRG_CLAUDE_BIN: STUB }), wait: 8000 });
  const bad = [{}, { folder: 'B' }, { folder: 'Z' }, { folder: '../..' }, { folder: 'C:\\Windows' }, { folder: '1 & calc' }, { folder: 1 }, { folder: ['1'] },
    { folder: '__proto__' }, { folder: '1', account: 'C' }, { folder: '1', account: 'a' }, null];
  let refused = 0;
  for (const p of bad) if (!(await rc.start(folders, p)).ok) refused++;
  ok(refused === bad.length && rc.sessions().length === 0, 'refused: unknown keys, Bernard, paths, metacharacters, non-strings, prototype names, unknown accounts');
  const s1 = await rc.start(folders, { folder: '1', name: 'evil" & calc', cmd: 'calc.exe' });
  ok(s1.ok && s1.session && /^https:\/\/claude\.ai\/code\/session_01STUB\d+\?name=VRG%20/.test(s1.session.url || ''), 'folder 1 starts; the stub\'s link comes back: ' + (s1.session && s1.session.url));
  ok(s1.session.name.startsWith('VRG ') && !/evil|calc/.test(s1.session.name), 'the phone\'s name and cmd are ignored; the relay names it');
  const log1 = fs.readFileSync(path.join(TMP, 'logs', s1.session.id + '.log'), 'utf8');
  ok(log1.includes('cwd=' + REPO) && log1.includes('config=-') && log1.includes('"remote-control","--name"'), 'it ran in the repo root, account A, as remote-control --name');
  const s2 = await rc.start(folders, { folder: '2', account: 'B' });
  const log2 = fs.readFileSync(path.join(TMP, 'logs', s2.session.id + '.log'), 'utf8');
  ok(s2.ok && /config=.*claude-account-b/.test(log2) && log2.includes('cwd=' + folders.get('2').cwd), 'folder 2 with account B: its own CLAUDE_CONFIG_DIR');
  const list = rc.sessions();
  ok(list.length === 2 && list.every(s => s.alive && s.url) && list[0].id === s2.session.id, 'list: both running, with links, newest first');
  ok(!(await rc.stop('c99')).ok && !(await rc.stop('../x')).ok && !(await rc.stop(5)).ok, 'stop refuses an id it did not start');
  const pid1 = JSON.parse(fs.readFileSync(path.join(TMP, 'sessions.json'), 'utf8')).sessions.find(s => s.id === s1.session.id).pid;
  ok(C.alive(pid1), 'the first session\'s process runs');
  ok((await rc.stop(s1.session.id)).ok, 'stop: the first session');
  await sleep(500);
  ok(!C.alive(pid1), 'its process is gone');
  ok(rc.sessions().length === 1 && rc.sessions()[0].id === s2.session.id, 'it is gone from the list');
  const failing = C.createClaude({ file: path.join(TMP, 'f.json'), logDir: path.join(TMP, 'logs'), env: Object.assign({}, process.env, { VRG_CLAUDE_BIN: STUB, STUB_FAIL: '1' }), wait: 5000 });
  const f1 = await failing.start(folders, { folder: '1' });
  ok(!f1.ok && /Remote Control is not enabled/.test(f1.reason), 'a Remote Control that stops at once: its last line comes back as the reason');
  const none = C.createClaude({ file: path.join(TMP, 'n.json'), logDir: path.join(TMP, 'logs'), bin: null });
  ok(/nincs telepítve/.test((await none.start(folders, { folder: '1' })).reason), 'no claude on the PC: said so');
  await rc.stop(s2.session.id);

  // ---- the relay ------------------------------------------------------------------------------------------
  console.log('phone-relay-server.js: claude.* without --claude');
  const off = relay(47396, {});
  await sleep(900);
  const o = await pairPhone(47396);
  o.a.send('claude.list', {}, 'relay');
  const ol = await o.a.wait('claude');
  ok(o.paired && o.paired.payload.ok && ol && ol.payload.ok === false && ol.payload.on === false && /--claude/.test(ol.payload.reason), 'off without --claude, and says how to turn it on');
  o.a.ws.close(); off.kill();

  console.log('phone-relay-server.js: claude.* with --claude');
  const file = path.join(TMP, 'relay-sessions.json');
  const on = relay(47397, { RELAY_CLAUDE: '1', VRG_CLAUDE_BIN: STUB, RELAY_CLAUDE_FILE: file });
  await sleep(900);
  const u = await phone(47397).ready;
  u.send('claude.list', {}, 'relay');
  const ul = await u.wait('claude');
  ok(ul && ul.payload.ok === false && ul.payload.trusted === false && !ul.payload.folders, 'an untrusted phone asking for the list is refused');
  u.send('claude.start', { folder: '1' }, 'relay');
  const us = await u.wait('claude.started');
  ok(us && us.payload.ok === false && us.payload.trusted === false && !/\[claude\] inditas/.test(on.log), 'an untrusted phone cannot start anything');
  u.ws.close();

  const { a, paired } = await pairPhone(47397);
  ok(paired && paired.payload.ok, 'the phone pairs');
  a.send('claude.list', {}, 'relay');
  const l1 = await a.wait('claude');
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'relay-claude-answer.json'), 'utf8')).payload;
  ok(l1 && l1.payload.ok && l1.payload.on && l1.payload.folders.map(f => f.key).join(',') === [...folders.keys()].join(',') && l1.payload.sessions.length === 0,
    'the paired phone gets the folders and no sessions yet');
  ok(Object.keys(l1.payload).sort().join(',') === Object.keys(fx).sort().join(',') && Object.keys(l1.payload.folders[0]).sort().join(',') === Object.keys(fx.folders[0]).sort().join(','),
    'the live answer has the fields of the Kotlin test fixture (relay-claude-answer.json)');
  a.send('claude.start', { folder: '1' }, 'relay');
  const st = await a.wait('claude.started', 1, 15000);
  ok(st && st.payload.ok && /^https:\/\/claude\.ai\/code\/session_01STUB/.test(st.payload.session.url), 'claude.start: a session with its link');
  for (const p of [{ folder: 'B' }, { folder: '..' }, { folder: '1', account: 'Z' }, { cmd: 'calc.exe' }]) a.send('claude.start', p, 'relay');
  await sleep(600);
  ok(a.got.filter(m => m.type === 'claude.started').slice(-4).every(m => m.payload.ok === false), 'claude.start refuses keys outside the list, an unknown account, a payload with no folder');
  a.send('claude.list', {}, 'relay');
  const l2 = await a.wait('claude', 2);
  const sess = l2 && l2.payload.sessions[0];
  ok(sess && sess.alive && sess.url === st.payload.session.url && Object.keys(sess).sort().join(',') === Object.keys(fx.sessions[0]).sort().join(','), 'the list shows it running, with its link, in the fixture\'s shape');
  a.send('claude.stop', { id: sess.id }, 'relay');
  const sp = await a.wait('claude.stopped', 1, 8000);
  ok(sp && sp.payload.ok, 'claude.stop stops it');
  a.send('claude.stop', { id: sess.id }, 'relay');
  ok((await a.wait('claude.stopped', 2)).payload.ok === false, 'and only once');
  ok(/Claude Remote Control a telefonról: BEKAPCSOLVA/.test(on.log), 'the relay\'s banner says it is on');

  a.ws.close();
  on.kill();
  await sleep(300);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a log still open */ }
  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
