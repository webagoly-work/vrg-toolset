// WP-11: the pure helpers of the dual-pane file manager pane (jsdom is not available).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../page/panes/files.js');

test('formatSize uses a Hungarian decimal comma', () => {
  assert.equal(H.formatSize(0), '0 B');
  assert.equal(H.formatSize(1023), '1023 B');
  assert.equal(H.formatSize(1024), '1 KB');
  assert.equal(H.formatSize(1536), '1,5 KB');
  assert.equal(H.formatSize(5 * 1024 * 1024), '5 MB');
  assert.equal(H.formatSize(1.25 * 1024 * 1024 * 1024), '1,3 GB');
  assert.equal(H.formatSize(-1), '');
});

test('formatDate is local YYYY-MM-DD HH:mm', () => {
  assert.equal(H.formatDate(new Date(2026, 10, 4, 22, 31, 59).getTime()), '2026-11-04 22:31');
  assert.equal(H.formatDate(new Date(2026, 0, 5, 3, 7).getTime()), '2026-01-05 03:07');
  assert.equal(H.formatDate('nope'), '');
});

const tree = {
  R: { items: [{ name: 'a', kind: 'dir', handle: 'hA' }, { name: 'f.txt', kind: 'file', handle: 'hF' }] },
  hA: { items: [{ name: 'b', kind: 'dir', handle: 'hB' }] },
  hB: { items: [] },
};
const lister = calls => async h => { calls.push(h); return tree[h] ? { dir: { handle: h }, ...tree[h] } : { ok: false, err: 'not-found' }; };

test('walkBack follows folder names and stops at a missing one', async () => {
  let calls = [];
  let w = await H.walkBack(['a', 'b'], lister(calls), 'R');
  assert.deepEqual([w.handle, w.names, calls], ['hB', ['a', 'b'], ['R', 'hA', 'hB']]);
  w = await H.walkBack(['a', 'gone', 'b'], lister([]), 'R');
  assert.deepEqual([w.handle, w.names], ['hA', ['a']]);
  w = await H.walkBack(['f.txt'], lister([]), 'R');                       // a file is not a folder
  assert.deepEqual([w.handle, w.names], ['R', []]);
  w = await H.walkBack([], lister([]), 'R');
  assert.deepEqual([w.handle, w.names], ['R', []]);
  assert.equal(await H.walkBack(['a'], lister([]), 'nope'), null);
  w = await H.walkBack('not-an-array', lister([]), 'R');
  assert.deepEqual(w.names, []);
});

test('keyAction maps the Total Commander keys', () => {
  const k = (key, o = {}) => H.keyAction({ key, ...o }, { filter: '' });
  assert.deepEqual(k('Tab'), { a: 'switch' });
  assert.deepEqual(k('Enter'), { a: 'open' });
  assert.deepEqual(k('Backspace'), { a: 'parent' });
  assert.deepEqual(k('Insert'), { a: 'mark' });
  assert.deepEqual(k(' '), { a: 'mark' });
  assert.deepEqual(k('ArrowDown'), { a: 'move', d: 1 });
  assert.deepEqual(k('ArrowUp', { shiftKey: true }), { a: 'range', d: -1 });
  assert.deepEqual(k('a', { ctrlKey: true }), { a: 'all' });
  assert.deepEqual(k('r', { ctrlKey: true }), { a: 'reload' });
  assert.deepEqual(k('F', { ctrlKey: true }), { a: 'filter' });
  assert.deepEqual(k('F1', { altKey: true }), { a: 'rootMenu', side: 'left' });
  assert.deepEqual(k('F2', { altKey: true }), { a: 'rootMenu', side: 'right' });
  assert.deepEqual(['F3', 'F4', 'F5', 'F6', 'F7', 'F8'].map(f => k(f).op), ['view', 'edit', 'copy', 'move', 'mkdir', 'trash']);
  assert.deepEqual(k('F6', { shiftKey: true }), { a: 'op', op: 'rename' });
  assert.deepEqual(k('q'), { a: 'type', ch: 'q' });
  assert.equal(k('Escape'), null);
  assert.equal(k('F9'), null);
  assert.equal(k('x', { ctrlKey: true }), null);
  assert.equal(k('x', { altKey: true }), null);
});

test('keyAction: with a filter, Backspace edits it and Escape clears it', () => {
  const k = key => H.keyAction({ key }, { filter: 'ab' });
  assert.deepEqual(k('Backspace'), { a: 'filterBack' });
  assert.deepEqual(k('Escape'), { a: 'filterClear' });
  assert.deepEqual(k('c'), { a: 'type', ch: 'c' });
});

test('sortItems keeps folders first and honours column and direction', () => {
  const items = [
    { name: 'b.txt', kind: 'file', size: 5, mtime: 1 }, { name: 'a.txt', kind: 'file', size: 9, mtime: 3 },
    { name: 'z', kind: 'dir', size: 0, mtime: 2 }, { name: 'c.txt', kind: 'file', size: 1, mtime: 2 },
  ];
  const names = s => H.sortItems(items, s).map(i => i.name);
  assert.deepEqual(names({ by: 'name', dir: 'asc' }), ['z', 'a.txt', 'b.txt', 'c.txt']);
  assert.deepEqual(names({ by: 'name', dir: 'desc' }), ['z', 'c.txt', 'b.txt', 'a.txt']);
  assert.deepEqual(names({ by: 'size', dir: 'asc' }), ['z', 'c.txt', 'b.txt', 'a.txt']);
  assert.deepEqual(names({ by: 'mtime', dir: 'desc' }), ['z', 'a.txt', 'c.txt', 'b.txt']);
});
