// WP-24: chat pane — pure helpers (thread title cut, Enter / Shift+Enter routing, attachment chips, sanitizer config shape) and
// claudeterm.resume. The real sanitizing (DOMPurify needs a DOM) is checked by the selftest probe wp-24.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path');

const H = require('../page/panes/chat.js');
const { createClaudeTerm } = require('../shell/lib/claudeterm.js');

test('threadTitle: whitespace collapsed, at most 60 characters', () => {
  assert.equal(H.threadTitle('  Szia   \n világ  '), 'Szia világ');
  assert.equal(H.threadTitle('x'.repeat(60)), 'x'.repeat(60));
  assert.equal(H.threadTitle('x'.repeat(61)), 'x'.repeat(60));
  assert.equal(H.threadTitle(''), '');
  assert.equal(H.threadTitle(null), '');
});

test('threadTitle: never splits a surrogate pair at the cut', () => {
  const s = 'a'.repeat(59) + '😀' + 'tail';                        // the emoji is code point 60: kept whole (2 UTF-16 units)
  const t = H.threadTitle(s);
  assert.equal(t, 'a'.repeat(59) + '😀');
  assert.equal(t.length, 61);
  const u = H.threadTitle('a'.repeat(60) + '😀');                  // the emoji is code point 61: dropped whole
  assert.equal(u, 'a'.repeat(60));
  assert.doesNotMatch(H.threadTitle('😀'.repeat(70)), /[\ud800-\udbff](?![\udc00-\udfff])/);
  assert.equal(Array.from(H.threadTitle('😀'.repeat(70))).length, 60);
});

test('keyAction: Enter sends, Shift+Enter is a newline, the rest is ignored', () => {
  assert.equal(H.keyAction({ key: 'Enter' }), 'send');
  assert.equal(H.keyAction({ key: 'Enter', shiftKey: true }), 'newline');
  assert.equal(H.keyAction({ key: 'Enter', isComposing: true }), 'none');
  assert.equal(H.keyAction({ key: 'Enter', ctrlKey: true }), 'none');
  assert.equal(H.keyAction({ key: 'a' }), 'none');
  assert.equal(H.keyAction(null), 'none');
});

test('chips: add, replace by kind, remove, attach object', () => {
  const HANDLE = 'h:' + 'A'.repeat(22);
  let c = [];
  c = H.addChip(c, { kind: 'sel', text: 'demo text' });
  c = H.addChip(c, { kind: 'pack', packId: 'pdemo1' });
  c = H.addChip(c, { kind: 'file', handle: HANDLE, name: 'demo.txt' });
  assert.deepEqual(c.map(x => x.kind), ['sel', 'pack', 'file']);
  assert.deepEqual(H.toAttach(c), { text: 'demo text', packId: 'pdemo1', file: HANDLE });
  const d = H.addChip(c, { kind: 'sel', text: 'second' });         // same kind replaces
  assert.deepEqual(d.map(x => x.kind), ['pack', 'file', 'sel']);
  assert.equal(H.toAttach(d).text, 'second');
  assert.equal(c.length, 3, 'the old list is not changed');
  const e = H.removeChip(d, 'pack');
  assert.deepEqual(e.map(x => x.kind), ['file', 'sel']);
  assert.equal(H.toAttach([]), undefined);
  assert.equal(H.toAttach(H.removeChip(H.removeChip(e, 'file'), 'sel')), undefined);
});

test('chips: refuses a bad kind, an empty selection, a path as a file, a bad pack id', () => {
  assert.deepEqual(H.addChip([], { kind: 'url', text: 'x' }), []);
  assert.deepEqual(H.addChip([], { kind: 'sel', text: '   ' }), []);
  assert.deepEqual(H.addChip([], { kind: 'file', handle: 'C:\\demo\\a.txt' }), []);
  assert.deepEqual(H.addChip([], { kind: 'file', handle: 'h:short' }), []);
  assert.deepEqual(H.addChip([], { kind: 'pack', packId: '../x' }), []);
  assert.equal(H.addChip([], { kind: 'sel', text: 'y'.repeat(70000) })[0].text.length, 64 * 1024);
});

test('sanitizer config: no script / iframe, no on* attribute, only http(s) and mailto links', () => {
  const c = H.SANITIZE_CONFIG;
  for (const t of ['script', 'iframe', 'object', 'embed', 'form', 'style', 'img', 'svg']) assert.ok(c.FORBID_TAGS.includes(t), 'FORBID_TAGS has ' + t);
  for (const a of ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style', 'srcdoc']) assert.ok(c.FORBID_ATTR.includes(a), 'FORBID_ATTR has ' + a);
  assert.ok(c.FORBID_ATTR.filter(a => /^on/.test(a)).length >= 40);
  assert.equal(c.ALLOW_DATA_ATTR, false);
  assert.equal(c.ALLOW_UNKNOWN_PROTOCOLS, false);
  assert.equal(c.ADD_TAGS, undefined);
  assert.equal(c.ADD_ATTR, undefined);
  assert.equal(c.ALLOWED_ATTR, undefined);
  assert.throws(() => { 'use strict'; c.FORBID_TAGS.push('x'); }, TypeError);
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///c:/x', 'chrome://settings', '/relative']) assert.equal(H.uriAllowed(bad), false, bad);
  for (const ok of ['https://example.com/a', 'http://127.0.0.1:8080/', 'mailto:a@example.com']) assert.equal(H.uriAllowed(ok), true, ok);
});

test('costLine', () => {
  assert.equal(H.costLine(0.0123), 'Költség: $0.0123');
  assert.equal(H.costLine(undefined), '');
  assert.equal(H.costLine(-1), '');
});

test('claudeterm.resume: --resume and the session are two argv items, in the repo, account picks the profile', () => {
  const REPO = path.resolve(__dirname, '..', '..');
  const calls = [], events = [];
  const pty = { open: (prof, cwd, o) => { calls.push({ prof, cwd, args: o.args }); return { term: 't1', title: prof }; }, on() {} };
  const ct = createClaudeTerm({ pty, emit: (...a) => events.push(a), env: {}, repo: REPO });
  const r = ct.resume('B', 'sess-demo-1');
  assert.equal(r.term, 't1');
  assert.deepEqual(calls[0], { prof: 'claude-b', cwd: REPO, args: ['--resume', 'sess-demo-1'] });
  assert.deepEqual(events[0], ['layout', 'open', { kind: 'term', term: 't1', prof: 'claude-b' }]);
  assert.equal(ct.resume('A', 'x').term, 't1');
  assert.equal(calls[1].prof, 'claude-a');
});

test('claudeterm.resume: refuses a session that is not a plain id, and a missing repo', () => {
  const pty = { open: () => { throw new Error('must not open'); }, on() {} };
  const ct = createClaudeTerm({ pty, env: {}, repo: path.resolve(__dirname) });
  for (const bad of ['', '--dangerous', 'a b', 'a;b', '../x', 'x'.repeat(101), 5, null, undefined]) {
    const r = ct.resume('A', bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.err, 'bad-request');
  }
  const noRepo = createClaudeTerm({ pty, env: {} });
  assert.equal(noRepo.resume('A', 'sess-demo-1').ok, false);
});

test('claudeterm.resume: the VRG_CLAUDE_BIN node script comes first, then --resume', () => {
  const bin = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const calls = [];
  const pty = { open: (prof, cwd, o) => { calls.push(o.args); return { term: 't2', title: prof }; }, on() {} };
  const ct = createClaudeTerm({ pty, env: { VRG_CLAUDE_BIN: bin }, expand: s => s.replace('{node}', 'node'), repo: path.resolve(__dirname) });
  ct.resume('A', 'sess-demo-1');
  assert.deepEqual(calls[0], [bin, '--resume', 'sess-demo-1']);
});
