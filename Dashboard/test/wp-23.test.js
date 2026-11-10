// WP-23: chat engine. Runs lib/chat.js against test/fixtures/fake-claude.js; temp folders only, no real Claude (CONTRACT §4.9).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFile } = require('child_process');
const { createChat } = require('../shell/lib/chat.js');

const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
test.after(async () => {                                      // a killed child may still hold its cwd for a moment (Windows)
  await new Promise(r => setTimeout(r, 500));
  try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) {}
});

function setup(extraEnv = {}, extra = {}) {
  const dir = fs.mkdtempSync(path.join(tmp, 'c-'));
  const logFile = path.join(dir, 'run.json');
  const events = [];
  const waiters = [];
  const chat = createChat({
    spawn, execFile, repo: dir, claudeDirB: 'C:\\demo\\account-b', paths: { userDir: () => dir },
    env: { ...process.env, CLAUDE_CONFIG_DIR: 'C:\\demo\\inherited', ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--no-warnings', VRG_CLAUDE_BIN: FAKE, FAKE_CLAUDE_LOG: logFile, ...extraEnv },
    emit: (type, data) => { events.push({ type, ...data }); waiters.splice(0).forEach(w => w()); },
    ...extra,
  });
  const until = async (pred, ms = 5000) => {
    const end = Date.now() + ms;
    while (!pred()) { if (Date.now() > end) throw new Error('timeout; events=' + JSON.stringify(events)); await new Promise(r => { waiters.push(r); setTimeout(r, 50); }); }
  };
  const ended = () => events.some(e => e.type === 'chat.done' || e.type === 'chat.error');
  return { chat, events, until, ended, dir, run: () => JSON.parse(fs.readFileSync(logFile, 'utf8')), dir };
}
test('argv has no prompt text; stdin has the <selection> wrapper then the prompt', async () => {
  const s = setup();
  const r = await s.chat.start({ account: 'A', prompt: 'SECRET-PROMPT-DEMO', attach: { text: 'picked words' }, tools: 'read' });
  assert.ok(r.chat);
  await s.until(s.ended);
  const run = s.run();
  assert.ok(!run.argv.join(' ').includes('SECRET-PROMPT-DEMO'));
  assert.ok(!run.argv.join(' ').includes('picked words'));
  assert.strictEqual(run.stdin, '<selection>picked words</selection>\n\nSECRET-PROMPT-DEMO');
  assert.deepStrictEqual(run.argv.filter(a => !a.endsWith('.js')), ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--tools', 'Read,Grep,Glob', '--name', 'VRG oldalchat']);
});

test('3 deltas, 1 tool, then done, in order; the first delta echoes stdin', async () => {
  const s = setup();
  const { chat } = await s.chat.start({ account: 'A', prompt: 'hello demo', tools: 'read' });
  await s.until(s.ended);
  assert.deepStrictEqual(s.events.map(e => e.type), ['chat.delta', 'chat.tool', 'chat.delta', 'chat.delta', 'chat.done']);
  assert.strictEqual(s.events[0].text, 'hello demo');
  assert.strictEqual(s.events[1].name, 'Read');
  assert.ok(s.events.every(e => e.chat === chat));
  const done = s.events[4];
  assert.strictEqual(done.session, 'sess-demo-1');
  assert.strictEqual(done.cost, 0.0123);
  assert.strictEqual(done.turns, 2);
});

test('tools none passes an empty --tools item', async () => {
  const s = setup();
  await s.chat.start({ account: 'A', prompt: 'x', tools: 'none' });
  await s.until(s.ended);
  const a = s.run().argv;
  assert.strictEqual(a[a.indexOf('--tools') + 1], '');
});

test('follow-up passes --resume with the same session', async () => {
  const s = setup();
  const { chat } = await s.chat.start({ account: 'A', prompt: 'first', tools: 'read' });
  await s.until(s.ended);
  s.events.length = 0;
  assert.deepStrictEqual(await s.chat.follow(chat, 'second'), {});
  await s.until(s.ended);
  const run = s.run();
  assert.strictEqual(run.argv[run.argv.indexOf('--resume') + 1], 'sess-demo-1');
  assert.strictEqual(run.stdin, 'second');
  assert.strictEqual(s.events[s.events.length - 1].session, 'sess-demo-1');
  assert.strictEqual(s.events[s.events.length - 1].type, 'chat.done');
});

test('stop kills the process and reports Megállítva. within 1 s', async () => {
  const s = setup({ FAKE_CLAUDE_SLEEP: '5000' });
  const { chat } = await s.chat.start({ account: 'A', prompt: 'slow', tools: 'read' });
  await new Promise(r => setTimeout(r, 300));
  const t0 = Date.now();
  s.chat.stop(chat);
  await s.until(s.ended, 1000);
  assert.ok(Date.now() - t0 < 1000);
  assert.deepStrictEqual(s.events, [{ type: 'chat.error', chat, hu: 'Megállítva.' }]);
  await new Promise(r => setTimeout(r, 300));
  assert.strictEqual(s.events.length, 1);
});

test('auth failure gives the Hungarian sign-in message, for A and for B', async () => {
  for (const acc of ['A', 'B']) {
    const s = setup({ FAKE_CLAUDE_FAIL: 'auth' });
    const { chat } = await s.chat.start({ account: acc, prompt: 'x', tools: 'read' });
    await s.until(s.ended);
    assert.deepStrictEqual(s.events, [{ type: 'chat.error', chat, hu: `A(z) ${acc} fiók nincs bejelentkezve. Jelentkezz be egy Claude terminálban.` }]);
  }
});

test('account A env has no CLAUDE_CONFIG_DIR, B gets its own; ELECTRON_* and NODE_OPTIONS are gone', async () => {
  const a = setup();
  await a.chat.start({ account: 'A', prompt: 'x', tools: 'read' });
  await a.until(a.ended);
  assert.strictEqual(a.run().hasConfigDir, false);
  const b = setup();
  await b.chat.start({ account: 'B', prompt: 'x', tools: 'read' });
  await b.until(b.ended);
  assert.strictEqual(b.run().configDir, 'C:\\demo\\account-b');
});

test('a 300 KB prompt is refused and nothing is started', async () => {
  const s = setup();
  const r = await s.chat.start({ account: 'A', prompt: 'x'.repeat(300 * 1024), tools: 'read' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'bad-request');
  assert.strictEqual(fs.existsSync(path.join(s.dir, 'run.json')), false);
  assert.strictEqual(s.chat.list().chats.length, 0);
});

test('attachments: pack and file are wrapped; a file is cut at 64 KB', async () => {
  const s = setup({}, { packText: id => (id === 'pdemo' ? 'PACK TEXT' : null), readFile: h => (h === 'h:' + 'A'.repeat(22) ? { name: 'demo.md', text: 'F'.repeat(70000) } : null) });
  await s.chat.start({ account: 'A', prompt: 'q', attach: { packId: 'pdemo', file: 'h:' + 'A'.repeat(22) }, tools: 'read' });
  await s.until(s.ended);
  const stdin = s.run().stdin;
  assert.ok(stdin.startsWith('<context-pack>PACK TEXT</context-pack>\n\n<file name="demo.md">' + 'F'.repeat(65536) + '</file>\n\nq'));
  const bad = await s.chat.start({ account: 'A', prompt: 'q', attach: { packId: 'nope' }, tools: 'read' });
  assert.strictEqual(bad.err, 'bad-request');
});

test('list keeps no message text on disk unless keepText is on', async () => {
  const off = setup();
  await off.chat.start({ account: 'A', prompt: 'private words here', tools: 'read' });
  await off.until(off.ended);
  assert.ok(!fs.readFileSync(path.join(off.dir, 'chats.json'), 'utf8').includes('private words'));
  assert.strictEqual(off.chat.list().chats.length, 1);
  assert.strictEqual(off.chat.list().chats[0].session, 'sess-demo-1');
  const on = setup({}, { keepText: () => true });
  await on.chat.start({ account: 'A', prompt: 'private words here', tools: 'read' });
  await on.until(on.ended);
  assert.ok(fs.readFileSync(path.join(on.dir, 'chats.json'), 'utf8').includes('private words here'));
});

// WP-25a: DESK-Q64 B (tool target), Q63 B (saved text, earlier threads continue), Q60 A (off by default)
const { toolTarget } = require('../shell/lib/chat.js');

test('chat.tool carries the target; a path inside the repo is repo-relative', async () => {
  const s = setup();
  await s.chat.start({ account: 'A', prompt: 'hello demo', tools: 'read' });
  await s.until(s.ended);
  assert.strictEqual(s.events.find(e => e.type === 'chat.tool').target, 'demo.txt');
  assert.strictEqual(toolTarget({ file_path: path.join('C:\\demo\\repo', 'a', 'b.js') }, 'C:\\demo\\repo'), path.join('a', 'b.js'));
  assert.strictEqual(toolTarget({ file_path: 'C:\\other\\x.js' }, 'C:\\demo\\repo'), 'C:\\other\\x.js');
  assert.strictEqual(toolTarget({ pattern: 'TODO\nx' }, 'C:\\demo\\repo'), 'TODO x');
  assert.strictEqual(toolTarget({}, 'C:\\demo\\repo'), '');
});

test('keepText on: the thread text is saved in chats\\<id>.json and history() reads it; off: nothing on disk, history from memory only', async () => {
  const off = setup();
  const r0 = await off.chat.start({ account: 'A', prompt: 'private words here', tools: 'read' });
  await off.until(off.ended);
  assert.strictEqual(fs.existsSync(path.join(off.dir, 'chats')), false);
  assert.strictEqual(off.chat.history(r0.chat).msgs.length, 2);              // the running app still has it in memory
  const on = setup({}, { keepText: () => true });
  const r = await on.chat.start({ account: 'A', prompt: 'private words here', tools: 'read' });
  await on.until(on.ended);
  const saved = JSON.parse(fs.readFileSync(path.join(on.dir, 'chats', r.chat + '.json'), 'utf8')).msgs;
  assert.strictEqual(saved[0].who, 'user');
  assert.strictEqual(saved[0].text, 'private words here');
  assert.strictEqual(saved[1].who, 'assistant');
  assert.ok(saved[1].parts.some(p => p.tool === 'Read' && p.target === 'demo.txt'));
  assert.ok(saved[1].parts.some(p => typeof p.text === 'string' && p.text.includes('private words here'.slice(0, 20))));
  assert.strictEqual(on.chat.history('../x').err, 'bad-request');
});

test('a thread of an earlier run continues: follow() revives it from chats.json with --resume, its saved text comes back', async () => {
  const first = setup({}, { keepText: () => true });
  const r = await first.chat.start({ account: 'B', prompt: 'first question', tools: 'read' });
  await first.until(first.ended);
  // a new app run: same userDir, empty memory
  const events = [];
  const again = createChat({
    spawn, execFile, repo: first.dir, claudeDirB: 'C:\\demo\\account-b', paths: { userDir: () => first.dir }, keepText: () => true,
    env: { ...process.env, VRG_CLAUDE_BIN: FAKE, FAKE_CLAUDE_LOG: path.join(first.dir, 'run2.json') },
    emit: (type, data) => events.push({ type, ...data }),
  });
  assert.strictEqual(again.history(r.chat).msgs[0].text, 'first question');
  const f = await again.follow(r.chat, 'second question');
  assert.deepStrictEqual(f, {});
  const end = Date.now() + 5000;
  while (!events.some(e => e.type === 'chat.done' || e.type === 'chat.error') && Date.now() < end) await new Promise(res => setTimeout(res, 50));
  assert.ok(events.some(e => e.type === 'chat.done'), JSON.stringify(events));
  const run2 = JSON.parse(fs.readFileSync(path.join(first.dir, 'run2.json'), 'utf8'));
  assert.strictEqual(run2.argv[run2.argv.indexOf('--resume') + 1], 'sess-demo-1');
  assert.strictEqual(run2.configDir, 'C:\\demo\\account-b');
  const msgs = again.history(r.chat).msgs;
  assert.deepStrictEqual(msgs.filter(m => m.who === 'user').map(m => m.text), ['first question', 'second question']);
  assert.strictEqual((await again.follow('c0000000000', 'x')).err, 'not-found');
});
