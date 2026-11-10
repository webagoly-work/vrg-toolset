// WP-14: pty manager and terminal profiles, against fixtures/fake-pty.js (no real shell is started here).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createPty, resolveAt, readProfiles } = require('../shell/lib/pty.js');
const { createFakePty } = require('./fixtures/fake-pty.js');
const { serve } = require('../shell/pty-host.js');

const PROFILES = readProfiles(path.join(__dirname, '..', 'config', 'profiles.json'));
const FULL = 'C:\\demo\\full';
const expand = s => String(s).replace(/\{full\}/g, FULL).replace(/\{node\}/g, 'C:\\demo\\node.exe').replace(/\{claude\}/g, 'C:\\demo\\claude.cmd');
const mk = (extra = {}) => {
  const fake = createFakePty();
  const pty = createPty({ profiles: PROFILES, expand, spawn: fake.spawn, env: { SystemRoot: 'C:\\Windows', PATH: 'x' }, exists: () => true, flushMs: 5, ...extra });
  return { fake, pty };
};
const wait = ms => new Promise(r => setTimeout(r, ms));

test('profiles.json lists the six profiles, each exe expands to an absolute path', () => {
  assert.deepStrictEqual(PROFILES.map(p => p.id), ['pwsh', 'cmd', 'bash', 'node', 'claude-a', 'claude-b']);
  const { pty } = mk();
  const list = pty.profiles();
  assert.strictEqual(list.length, 6);
  assert.ok(list.every(p => p.available === true));
});

test('a missing exe is listed as unavailable with the reason, and open refuses it', () => {
  const { pty } = mk({ exists: f => !/bash\.exe$/.test(f) });
  const bash = pty.profiles().find(p => p.id === 'bash');
  assert.deepStrictEqual(bash, { id: 'bash', hu: 'Git Bash', available: false, reason: 'missing' });
  const r = pty.open('bash', 'C:\\demo');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'unavailable');
});

test('pwsh and cmd use absolute System32 paths, never PATH', () => {
  const { fake, pty } = mk();
  pty.open('pwsh', 'C:\\demo'); pty.open('cmd', 'C:\\demo');
  assert.strictEqual(fake.calls[0].exe, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepStrictEqual(fake.calls[0].args, ['-NoLogo']);
  assert.strictEqual(fake.calls[1].exe, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepStrictEqual(fake.calls[1].args, ['/k', 'chcp 65001>nul']);
});

test('limit: the 13th terminal is refused with err limit', () => {
  const { pty } = mk();
  for (let i = 0; i < 12; i++) assert.ok(pty.open('cmd', 'C:\\demo').term);
  const r = pty.open('cmd', 'C:\\demo');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'limit');
});

test("open('nope') is refused", () => {
  const { fake, pty } = mk();
  const r = pty.open('nope', 'C:\\demo');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'not-found');
  assert.strictEqual(fake.calls.length, 0);
});

test('claude-b env has CLAUDE_CONFIG_DIR = home\\claude-account-b', () => {
  const { fake, pty } = mk();
  pty.open('claude-b', 'C:\\demo');
  assert.strictEqual(fake.calls[0].opts.env.CLAUDE_CONFIG_DIR, FULL + '\\home\\claude-account-b');
});

test('claude-a env has no CLAUDE_CONFIG_DIR even when the parent env had one', () => {
  const { fake, pty } = mk({ env: { SystemRoot: 'C:\\Windows', CLAUDE_CONFIG_DIR: 'C:\\other', PATH: 'x' } });
  pty.open('claude-a', 'C:\\demo');
  assert.ok(!('CLAUDE_CONFIG_DIR' in fake.calls[0].opts.env));
});

test('env drops ELECTRON_* and NODE_OPTIONS and keeps the rest', () => {
  const { fake, pty } = mk({ env: { SystemRoot: 'C:\\Windows', ELECTRON_RUN_AS_NODE: '1', electron_x: '1', NODE_OPTIONS: '--x', KEEP: 'yes' } });
  pty.open('node', 'C:\\demo');
  assert.deepStrictEqual(fake.calls[0].opts.env, { SystemRoot: 'C:\\Windows', KEEP: 'yes' });
});

test('a .cmd exe is wrapped in cmd.exe /c', () => {
  const { fake, pty } = mk();
  pty.open('claude-a', 'C:\\demo', { args: ['--version'] });
  assert.strictEqual(fake.calls[0].exe, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepStrictEqual(fake.calls[0].args, ['/c', 'C:\\demo\\claude.cmd', '--version']);
});

test('100 small chunks are merged into at most 7 data events, in order', async () => {
  const { fake, pty } = mk();
  const ev = [];
  pty.on('data', e => ev.push(e));
  const { term } = pty.open('cmd', 'C:\\demo');
  for (let i = 0; i < 100; i++) fake.procs[0].emit('x' + i + ';');
  await wait(60);
  assert.ok(ev.length >= 1 && ev.length <= 7, 'events: ' + ev.length);
  assert.ok(ev.every(e => e.term === term && e.data.length <= 64 * 1024));
  assert.strictEqual(ev.map(e => e.data).join(''), Array.from({ length: 100 }, (_, i) => 'x' + i + ';').join(''));
});

test('a 150 KB burst is cut into events of at most 64 KB', async () => {
  const { fake, pty } = mk();
  const ev = [];
  pty.on('data', e => ev.push(e));
  pty.open('cmd', 'C:\\demo');
  fake.procs[0].emit('a'.repeat(150 * 1024));
  await wait(40);
  assert.ok(ev.every(e => e.data.length <= 64 * 1024));
  assert.strictEqual(ev.reduce((n, e) => n + e.data.length, 0), 150 * 1024);
});

test('write echoes through the fake, resize and kill work, exit comes after the last data', async () => {
  const { fake, pty } = mk();
  const seen = [];
  pty.on('data', e => seen.push('d:' + e.data)); pty.on('exit', e => seen.push('x:' + e.code));
  const { term } = pty.open('cmd', 'C:\\demo');
  assert.strictEqual(pty.write(term, 'hi\r'), true);
  assert.strictEqual(pty.write('t999', 'hi'), false);
  assert.strictEqual(pty.resize(term, 120, 40), true);
  assert.deepStrictEqual([fake.procs[0].cols, fake.procs[0].rows], [120, 40]);
  pty.kill(term);
  await wait(30);
  assert.deepStrictEqual(seen, ['d:hi\r', 'x:0']);
  assert.strictEqual(pty.count(), 0);
});

test('OSC 0 and 2 titles are parsed, also across two chunks', () => {
  const { fake, pty } = mk();
  const titles = [];
  pty.on('title', e => titles.push(e.title));
  pty.open('cmd', 'C:\\demo');
  fake.procs[0].emit('\x1b]0;first\x07rest');
  fake.procs[0].emit('\x1b]2;sec');
  fake.procs[0].emit('ond\x1b\\');
  assert.deepStrictEqual(titles, ['first', 'second']);
});

test('killAll kills every terminal and returns their pids', () => {
  const { fake, pty } = mk();
  pty.open('cmd', 'C:\\demo'); pty.open('node', 'C:\\demo');
  const pids = pty.killAll();
  assert.strictEqual(pids.length, 2);
  assert.ok(fake.procs.every(p => p.killed));
  assert.strictEqual(pty.count(), 0);
});

test('resolveAt: forged handle refused, real handle, repo and line:demo resolve', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-test-pty-'));
  try {
    const handles = { resolve: h => (h === 'h:AAAAAAAAAAAAAAAAAAAAAA' ? { abs: tmp, root: 'x' } : null) };
    const ctx = { handles, repo: 'C:\\demo\\repo', lines: [{ id: 'demo', sessionPath: tmp }, { id: 'none', sessionPath: '' }] };
    assert.strictEqual(resolveAt('h:BBBBBBBBBBBBBBBBBBBBBB', ctx), null);
    assert.strictEqual(resolveAt('h:AAAAAAAAAAAAAAAAAAAAAA', ctx), tmp);
    assert.strictEqual(resolveAt('repo', ctx), 'C:\\demo\\repo');
    assert.strictEqual(resolveAt(undefined, ctx), 'C:\\demo\\repo');
    assert.strictEqual(resolveAt('line:demo', ctx), tmp);
    assert.strictEqual(resolveAt('line:none', ctx), null);
    assert.strictEqual(resolveAt('line:nope', ctx), null);
    assert.strictEqual(resolveAt('C:\\Windows', ctx), null);
    assert.strictEqual(resolveAt({}, ctx), null);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('pty-host speaks JSON lines: open, write echo, kill → exit', async () => {
  const { PassThrough } = require('stream');
  const fake = createFakePty();
  const input = new PassThrough(), output = new PassThrough();
  serve(fake.spawn, input, output);
  const lines = [];
  output.on('data', d => lines.push(...String(d).split('\n').filter(Boolean).map(JSON.parse)));
  const send = o => input.write(JSON.stringify(o) + '\n');
  send({ op: 'open', id: 't1', exe: 'C:\\demo\\x.exe', args: [], cwd: 'C:\\demo', env: {} });
  send({ op: 'write', id: 't1', data: 'hi' });
  send({ op: 'kill', id: 't1' });
  await wait(50);
  assert.deepStrictEqual(lines, [{ ev: 'data', id: 't1', data: 'hi' }, { ev: 'exit', id: 't1', code: 0 }]);
});
