// WP-25: dev notes — `divergence.js jot` on a temp copy of Divergence/ (VRG_DIVERGENCE_DIR), lib/notes.js, and the note dialog's pure helpers.
// The real Divergence/data/ must stay untouched; push is never run.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const REAL = path.join(REPO, 'Divergence');
const CLI = path.join(REPO, 'tools', 'divergence.js');
const { createNotes } = require('../shell/lib/notes.js');
const N = require('../page/panes/note.js');

const snapshot = dir => {
  const out = {};
  const walk = d => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out[path.relative(dir, f)] = fs.statSync(f).size; } };
  walk(path.join(dir, 'data'));
  return out;
};

function tempDir() {
  fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
  for (const f of ['config.json', 'signals.json']) fs.copyFileSync(path.join(REAL, f), path.join(d, f));
  return d;
}
const jot = (dir, args, input) => spawnSync(process.execPath, [CLI, 'jot', ...args], { cwd: REPO, input, encoding: 'utf8', env: { ...process.env, VRG_DIVERGENCE_DIR: dir } });
const outbox = dir => { const f = path.join(dir, 'data', 'outbox.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []; };

test('jot appends one outbox line with every field and nothing else', () => {
  const dir = tempDir(), before = snapshot(REAL);
  try {
    const r = jot(dir, ['--topic', 'demo-topic', '--title', 'A demo title', '--source', 'url:http://127.0.0.1/x'], 'first line\nsecond line\n');
    assert.equal(r.status, 0, r.stderr);
    const lines = outbox(dir);
    assert.equal(lines.length, 1);
    const n = lines[0];
    assert.deepEqual(Object.keys(n).sort(), ['at', 'id', 'source', 'text', 'title', 'topic']);
    assert.match(n.id, /^jot-\d{14}-[0-9a-f]{4}$/);
    assert.equal(n.topic, 'demo-topic');
    assert.equal(n.title, 'A demo title');
    assert.equal(n.text, 'first line\nsecond line');
    assert.equal(n.source, 'url:http://127.0.0.1/x');
    assert.match(n.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(fs.existsSync(path.join(dir, 'data', 'log.jsonl')), false);          // a jot is not a signal
    assert.deepEqual(fs.readdirSync(path.join(dir, 'data')), ['outbox.jsonl']);          // no sent.jsonl: push never ran
    assert.deepEqual(snapshot(REAL), before);                                           // the real Divergence/data/ is untouched
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('jot refuses a bad topic, an empty text, a long title, a long source', () => {
  const dir = tempDir();
  try {
    assert.equal(jot(dir, ['--topic', 'Bad Topic', '--title', 't'], 'x').status, 1);
    assert.equal(jot(dir, ['--topic', '', '--title', 't'], 'x').status, 1);
    assert.equal(jot(dir, ['--topic', 'a'.repeat(41), '--title', 't'], 'x').status, 1);
    assert.equal(jot(dir, ['--title', 't'], 'x').status, 1);
    const empty = jot(dir, ['--topic', 'demo', '--title', 't'], '  \n');
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /needs a text/);
    assert.equal(jot(dir, ['--topic', 'demo', '--title', 'x'.repeat(121)], 'x').status, 1);
    assert.equal(jot(dir, ['--topic', 'demo', '--title', 't', '--source', 'x'.repeat(501)], 'x').status, 1);
    assert.equal(jot(dir, ['--topic', 'demo', '--title', 't'], 'x'.repeat(65537)).status, 1);
    assert.equal(outbox(dir).length, 0);
    assert.equal(jot(dir, ['--topic', 'demo', '--title', 't'], 'x'.repeat(65536)).status, 0);
    assert.equal(outbox(dir).length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('jot ids differ and the line is shaped like a signal note (push groups by topic)', () => {
  const dir = tempDir();
  try {
    jot(dir, ['--topic', 'demo', '--title', 'one'], 'a');
    jot(dir, ['--topic', 'demo', '--title', 'two'], 'b');
    const [a, b] = outbox(dir);
    assert.notEqual(a.id, b.id);
    for (const n of [a, b]) for (const k of ['id', 'topic', 'title', 'at', 'text']) assert.equal(typeof n[k], 'string');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('notes.topics: config kinds plus outbox topics, unique', () => {
  const dir = tempDir();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    const kinds = [...new Set(Object.values(cfg.kinds).map(k => k.topic))];
    jot(dir, ['--topic', 'zz-demo', '--title', 't'], 'x');
    jot(dir, ['--topic', kinds[0], '--title', 't'], 'x');
    const t = createNotes({ execFile: () => {}, node: 'node', repo: REPO, dir }).topics().topics;
    assert.deepEqual(t, [...kinds, 'zz-demo']);
    assert.equal(new Set(t).size, t.length);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('notes.save: runs divergence.js jot with an argument array and the text on stdin', async () => {
  const calls = [];
  const execFile = (exe, args, o, cb) => {
    const chunks = [];
    calls.push({ exe, args, o, chunks });
    setImmediate(() => cb(null, '', ''));
    return { stdin: { on() {}, end: s => chunks.push(s) } };
  };
  const notes = createNotes({ execFile, node: 'node-x', repo: REPO });
  const r = await notes.save({ topic: 'demo', title: 'T', text: 'body', source: { kind: 'node', ref: 'E:demo' } });
  assert.deepEqual(r, { ok: true, where: 'outbox' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].exe, 'node-x');
  assert.deepEqual(calls[0].args, [path.join(REPO, 'tools', 'divergence.js'), 'jot', '--topic', 'demo', '--title', 'T', '--source', 'node:E:demo']);
  assert.deepEqual(calls[0].chunks, ['body']);
  assert.equal(calls[0].args.includes('push'), false);
  const bad = await notes.save({ topic: 'Bad Topic', title: 'T', text: 'x' });
  assert.equal(bad.ok, false);
  assert.equal((await notes.save({ topic: 'demo', title: 'T', text: '   ' })).ok, false);
  assert.equal(calls.length, 1);                                                          // refused before anything ran
});

test('note dialog helpers: title prefill, source line, payload', () => {
  assert.equal(N.defaultTitle('\n  First   line \nsecond'), 'First line');
  assert.equal(N.defaultTitle('x'.repeat(100)), 'x'.repeat(80));
  assert.equal(N.defaultTitle(''), '');
  assert.equal(N.sourceLabel({ kind: 'term', ref: '' }), 'terminál');
  assert.equal(N.sourceLabel({ kind: 'chat', ref: 'c1' }), 'csevegés');
  assert.equal(N.sourceLabel({ kind: 'url', ref: 'http://127.0.0.1/a' }), 'http://127.0.0.1/a');
  assert.equal(N.sourceLabel(null), '');
  assert.equal(N.payload({ topic: 'Demo Topic', title: '', text: 'Hello\nworld' }).topic, 'demo-topic');
  assert.equal(N.payload({ topic: 'demo', title: '', text: 'Hello\nworld' }).title, 'Hello');
  assert.deepEqual(N.payload({ topic: 'demo', title: 'T', text: 'b', source: { kind: 'file', ref: 'D:\\demo\\a.txt' } }), { topic: 'demo', title: 'T', text: 'b', source: { kind: 'file', ref: 'D:\\demo\\a.txt' } });
  assert.ok(N.payload({ topic: '', text: 'x' }).err);
  assert.ok(N.payload({ topic: 'demo', text: ' ' }).err);
});
