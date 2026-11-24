// WP-51: the Munkamenetek board — board labels on a Lap (shell/lib/sheets.js): sheet.board (four switches) + win.deco (a window's own values
// and overrides) + what the pane reports, merged by label(); validation stays strict; setDeco / setBoard return the same doc when nothing changes;
// the page wires the label bar, the note, the menus and the session board.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const lib = require('../shell/lib/sheets.js');

const DASH = path.resolve(__dirname, '..');
function docWith() {
  let d = lib.addSheet(lib.empty(), 'Munkamenetek', [
    { id: 'w-term-1', kind: 'term', open: 'pane:term', state: {}, c: 0, r: 0, w: 2, h: 2, max: false },
    { id: 'w-web-1', kind: 'web', open: 'pane:web', state: {}, c: 2, r: 0, w: 2, h: 2, max: false },
  ]);
  assert.ok(lib.validate(d).ok);
  return d;
}

test('validation: deco and board are optional, strictly typed', () => {
  const d = docWith();
  const s = d.sheets[0];
  const bad = (mut, err) => { const x = JSON.parse(JSON.stringify(d)); mut(x); assert.strictEqual(lib.validate(x).err, err); };
  bad(x => { x.sheets[0].wins[0].deco = { origin: 'mars' }; }, 'deco');
  bad(x => { x.sheets[0].wins[0].deco = { title: 'x'.repeat(81) }; }, 'deco');
  bad(x => { x.sheets[0].wins[0].deco = { note: 'a\u0001b' }; }, 'deco');
  bad(x => { x.sheets[0].wins[0].deco = { show: { title: 'yes' } }; }, 'deco');
  bad(x => { x.sheets[0].wins[0].deco = { path: 'C:\\x' }; }, 'deco');
  bad(x => { x.sheets[0].board = { show: { origin: true } }; }, 'board');
  bad(x => { x.sheets[0].board = { kind: 'other', show: { origin: true, color: true, title: true, note: true } }; }, 'board');
  assert.ok(lib.validDeco({ origin: 'machine', machine: 'Laptop', account: 'B', session: 'abc', title: 'T', note: 'N', color: 'violet', show: { note: false } }));
  assert.ok(lib.validBoard({ kind: 'sessions', show: { origin: true, color: false, title: true, note: true } }));
  assert.ok(s && lib.validate(d).ok);
});

test('setBoard / setDeco: on, switches, overrides, back to automatic, same doc when nothing changes', () => {
  let d = docWith();
  const sid = d.sheets[0].id;
  assert.strictEqual(lib.setBoard(d, sid, null), d);                       // no board to remove
  d = lib.setBoard(d, sid, { kind: 'sessions' });
  assert.deepStrictEqual(d.sheets[0].board, { kind: 'sessions', show: { origin: true, color: true, title: true, note: true } });
  assert.strictEqual(lib.boardOf(d, 'sessions').id, sid);
  d = lib.setBoard(d, sid, { show: { note: false } });
  assert.deepStrictEqual(d.sheets[0].board.show, { origin: true, color: true, title: true, note: false });
  d = lib.setDeco(d, 'w-term-1', { title: '  Kapu fix  ', note: 'várja a tesztet', show: { note: true } });
  assert.deepStrictEqual(d.sheets[0].wins[0].deco, { title: 'Kapu fix', note: 'várja a tesztet', show: { note: true } });
  const same = lib.setDeco(d, 'w-term-1', { origin: 'mars' });               // invalid → refused
  assert.strictEqual(same, d);
  d = lib.setDeco(d, 'w-term-1', { title: null, note: '', show: { note: null } });
  assert.ok(!('deco' in d.sheets[0].wins[0]), 'an emptied deco is removed');
  assert.strictEqual(lib.setDeco(d, 'w-term-1', { title: null }), d);
  assert.strictEqual(lib.setDeco(d, 'nope', { title: 'x' }), d);
  d = lib.setBoard(d, sid, null);
  assert.ok(!('board' in d.sheets[0]));
  assert.ok(lib.validate(d).ok);
});

test('label(): board off = nothing; automatic origin and title; own values and overrides win; empty labels hide', () => {
  let d = docWith();
  const sid = d.sheets[0].id;
  let s = d.sheets[0], term = s.wins[0];
  assert.strictEqual(lib.label(s, term, { origin: 'local', account: 'A', title: 'x' }).on, false);
  assert.deepStrictEqual(lib.label(s, term, { origin: 'local' }).show, { origin: false, color: false, title: false, note: false });
  d = lib.setBoard(d, sid, {});
  s = d.sheets[0]; term = s.wins[0];
  let L = lib.label(s, term, { origin: 'local', account: 'B', title: 'Planner router' });
  assert.deepStrictEqual([L.originText, L.color, L.title, L.show.title, L.show.note], ['Helyi · B', 'ice', 'Planner router', true, false]);
  L = lib.label(s, s.wins[1], { origin: 'cloud', title: 'Felhő munka' });
  assert.deepStrictEqual([L.originText, L.color], ['Felhő', 'violet']);
  assert.strictEqual(lib.label(s, s.wins[1], {}).show.origin, false);         // no origin → no chip
  d = lib.setDeco(d, 'w-term-1', { origin: 'machine', machine: 'Laptop', color: 'crit', title: 'Saját cím', note: 'N', show: { color: false } });
  s = d.sheets[0]; term = s.wins[0];
  L = lib.label(s, term, { origin: 'local', account: 'A', title: 'auto' });
  assert.deepStrictEqual([L.originText, L.color, L.title, L.note, L.show.color, L.show.note], ['Gép: Laptop', 'crit', 'Saját cím', 'N', false, true]);
  d = lib.setBoard(d, sid, { show: { title: false } });
  assert.strictEqual(lib.label(d.sheets[0], d.sheets[0].wins[0], {}).show.title, false);
  d = lib.setDeco(d, 'w-term-1', { show: { title: true } });
  assert.strictEqual(lib.label(d.sheets[0], d.sheets[0].wins[0], {}).show.title, true);   // the window's override beats the board
});

test('ops keep the labels: move to another sheet, resize, kind stays', () => {
  let d = docWith();
  d = lib.setDeco(d, 'w-term-1', { title: 'T', origin: 'cloud' });
  d = lib.addSheet(d, 'Másik', []);
  const other = d.sheets[1].id;
  d = lib.moveToSheet(d, 'w-term-1', other);
  const hit = lib.findWin(d, 'w-term-1');
  assert.strictEqual(hit.sheet.id, other);
  assert.deepStrictEqual(hit.win.deco, { title: 'T', origin: 'cloud' });
});

test('the page: label bar + note in every window, the menus, the session board, adoptTerm passes main\'s labels', () => {
  const page = fs.readFileSync(path.join(DASH, 'page', 'sheets.js'), 'utf8');
  for (const s of ["'data-role': 'sh-label'", "'data-role': 'sh-note'", 'function labelMenu(', 'function boardMenu(', 'function editText(', 'async function sessionBoard(',
    "{ open: 'pane:controller', state: {}, c: 0, r: 0, w: 4, h: 1 }", "lib.setBoard(S.doc, sid, { kind: 'sessions' })", "vrg.on('term', 'title'", 'decorate: (id, deco)'])
    assert.ok(page.includes(s), s);
  assert.match(fs.readFileSync(path.join(DASH, 'page', 'frame.js'), 'utf8'), /window\.VRGSheets\.decorate\(id, m\.deco\)/);
  const css = fs.readFileSync(path.join(DASH, 'page', 'desk.css'), 'utf8');
  for (const c of lib.COLORS) assert.ok(css.includes('[data-deco="' + c + '"]'), 'colour ' + c);
  assert.match(fs.readFileSync(path.join(DASH, 'shell', 'lib', 'claudeterm.js'), 'utf8'), /deco && typeof deco === 'object' \? \{ deco \}/);
});
