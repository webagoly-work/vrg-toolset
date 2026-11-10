// WP-15: the pure helpers of the terminal pane (paste confirm, key routing, find, write chunks).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pasteNeedsConfirm, pasteLines, keyRoute, unavailable, findAll, chunks } = require('../page/panes/term.js');

test('pasteNeedsConfirm: only text with a line break', () => {
  assert.equal(pasteNeedsConfirm('a\nb'), true);
  assert.equal(pasteNeedsConfirm('a\r\nb'), true);
  assert.equal(pasteNeedsConfirm('ab'), false);
  assert.equal(pasteNeedsConfirm(''), false);
  assert.equal(pasteNeedsConfirm(null), false);
});

test('pasteLines counts lines', () => {
  assert.equal(pasteLines('a\nb'), 2);
  assert.equal(pasteLines('a\r\nb\r\nc'), 3);
  assert.equal(pasteLines('ab'), 1);
});

test('keyRoute: ten cases', () => {
  const k = (key, m) => keyRoute(Object.assign({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }, m));
  assert.equal(k('C', { ctrlKey: true, shiftKey: true }), 'copy');
  assert.equal(k('V', { ctrlKey: true, shiftKey: true }), 'paste');
  assert.equal(k('F', { ctrlKey: true, shiftKey: true }), 'find');
  assert.equal(k('T', { ctrlKey: true, shiftKey: true }), 'newtab');
  assert.equal(k('P', { ctrlKey: true, shiftKey: true }), 'frame');
  assert.equal(k('w', { ctrlKey: true }), 'frame');
  assert.equal(k('ArrowLeft', { ctrlKey: true, altKey: true }), 'frame');
  assert.equal(k('Enter', { shiftKey: true }), 'newline');
  assert.equal(k('c', { ctrlKey: true }), 'pty');                 // Ctrl+C is the shell's interrupt
  assert.equal(k('a'), 'pty');
});

test('keyRoute: junk input goes to the pty', () => {
  assert.equal(keyRoute(null), 'pty');
  assert.equal(keyRoute({}), 'pty');
  assert.equal(keyRoute({ key: 'C', ctrlKey: true, shiftKey: true, metaKey: true }), 'pty');
});

test('unavailable, findAll, chunks', () => {
  assert.equal(unavailable({ reason: 'missing' }), 'Nem érhető el: missing');
  assert.deepEqual(findAll(['Foo bar', 'none', 'foofoo'], 'FOO'), [{ row: 0, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 3 }]);
  assert.deepEqual(findAll(['abc'], ''), []);
  assert.deepEqual(chunks('abcdef', 4), ['abcd', 'ef']);
  assert.deepEqual(chunks('abc😀', 4), ['abc', '😀']);     // a surrogate pair is never split
  assert.deepEqual(chunks(''), []);
});
