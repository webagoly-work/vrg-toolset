// WP-30: the quick bar routing, the history, the hotkey config and the wiring.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const Q = require('../shell/lib/quick.js');
const items = [
  { id: 'pane:files', hu: 'Fájlok', en: 'Files', kind: 'pane' },
  { id: 's:planner', hu: 'Planner', en: 'Planner (demo)', kind: 'start' },
  { id: 'pane:term', hu: 'Terminál', en: 'Terminal', kind: 'pane' },
];
const r = input => Q.route(input, { items });

test('routing: 14 cases, exact results', () => {
  assert.deepEqual(r('g villanyszerelés'), { kind: 'google', target: 'srch:google:villanyszerelés', text: 'villanyszerelés' });
  assert.deepEqual(r('? mi az a GFCI'), { kind: 'ai', target: 'srch:ai:mi az a GFCI', text: 'mi az a GFCI' });
  assert.deepEqual(r('ai mi az a GFCI'), { kind: 'ai', target: 'srch:ai:mi az a GFCI', text: 'mi az a GFCI' });
  assert.deepEqual(r('ai'), { kind: 'google', target: 'srch:google:ai', text: 'ai' });          // a bare prefix is only a word
  assert.deepEqual(r('s kapu'), { kind: 'stack', target: '', text: 'kapu' });
  assert.deepEqual(r('k vrg-ctx'), { kind: 'code', target: '', text: 'vrg-ctx' });
  assert.deepEqual(r('c magyarázd el'), { kind: 'chat', target: '', text: 'magyarázd el' });
  assert.deepEqual(r('n jegyzet'), { kind: 'note', target: '', text: 'jegyzet' });
  assert.deepEqual(r('> irany'), { kind: 'filter', target: '', text: 'irany' });
  assert.deepEqual(r('github.com/x'), { kind: 'url', target: 'omni:github.com/x', text: 'github.com/x' });
  assert.deepEqual(r('srv:planner'), { kind: 'server', target: 'srv:planner', text: 'srv:planner' });
  assert.deepEqual(r('localhost:8806'), { kind: 'url', target: 'omni:localhost:8806', text: 'localhost:8806' });
  assert.deepEqual(r('Planner'), { kind: 'command', target: 's:planner', text: 'Planner' });
  assert.deepEqual(r('xyzzy qq'), { kind: 'google', target: 'srch:google:xyzzy qq', text: 'xyzzy qq' });
  assert.deepEqual(r(''), { kind: 'none', target: '', text: '' });
});

test('routing: URLs, spacing, case, limits', () => {
  assert.deepEqual(r('https://example.com/a?b=1'), { kind: 'url', target: 'https://example.com/a?b=1', text: 'https://example.com/a?b=1' });
  assert.equal(r('   ').kind, 'none');
  assert.equal(r('G  két szó').text, 'két szó');
  assert.equal(r('?gfci').kind, 'ai');
  assert.equal(r('?').kind, 'google');
  assert.equal(r('>').kind, 'filter');
  assert.equal(r('file:///c:/x').kind, 'google');                      // not an http(s) URL, so it is only words
  assert.equal(r('x'.repeat(900)).text.length, 500);
  assert.equal(Q.route('Planner').kind, 'google');                      // no palette items → Google
});

test('preview lines are the specified strings', () => {
  assert.equal(Q.PREVIEW.google, 'Enter: Google keresés');
  assert.equal(Q.PREVIEW.ai, 'Enter: AI keresés');
  assert.equal(Q.PREVIEW.stack, 'Enter: Rétegverem');
  assert.equal(Q.PREVIEW.code, 'Enter: kódkeresés');
  assert.equal(Q.PREVIEW.chat, 'Enter: új Claude-beszélgetés');
  assert.equal(Q.PREVIEW.note, 'Enter: jegyzet');
  assert.equal(Q.PREVIEW.command, 'Enter: parancs');
  assert.equal(Q.PREVIEW.url, 'Enter: megnyitás');
});

test('history: newest first, no duplicates, capped at 50, survives a reload', () => {
  const file = path.join(TMP, 'u', 'quick.json');
  const h = Q.createHistory({ file });
  assert.deepEqual(h.list(), []);
  h.add('a'); h.add('b'); h.add('a'); h.add('   ');
  assert.deepEqual(h.list(), ['a', 'b']);
  for (let i = 0; i < 70; i++) h.add('q' + i);
  assert.equal(h.list().length, 50);
  assert.equal(Q.createHistory({ file }).list()[0], 'q69');
});

test('hotkey: config/keymap.json says Control+Alt+K, bad values fall back', () => {
  const real = path.join(__dirname, '..', 'config', 'keymap.json');
  assert.equal(JSON.parse(fs.readFileSync(real, 'utf8')).quick, 'Control+Alt+K');
  assert.equal(Q.loadHotkey(real), 'Control+Alt+K');
  const bad = path.join(TMP, 'k.json');
  fs.writeFileSync(bad, JSON.stringify({ quick: 'rm -rf' }));
  assert.equal(Q.loadHotkey(bad), 'Control+Alt+K');
  assert.equal(Q.loadHotkey(path.join(TMP, 'none.json')), 'Control+Alt+K');
  fs.writeFileSync(bad, JSON.stringify({ quick: 'Alt+Shift+J' }));
  assert.equal(Q.loadHotkey(bad), 'Alt+Shift+J');
});

test('wiring: channel, preload, page scripts, hotkey skipped in selftest', () => {
  const rd = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  const main = rd('shell', 'main.js');
  assert.match(main, /ipc\.register\('search', 'quick', \{ input: types\.text\(500\) \}/);
  assert.match(main, /globalShortcut\.register\(quickKey/);
  assert.ok(main.indexOf('if (SELFTEST) return;') < main.indexOf('globalShortcut.register(quickKey'));
  assert.match(rd('shell', 'preload.js'), /quick: input => call\('search', 'quick'/);
  const html = rd('page', 'vrg-desktop.html');
  assert.ok(html.indexOf('../shell/lib/quick.js') > html.indexOf('palette.js') && html.indexOf('src="quick.js"') > html.indexOf('../shell/lib/quick.js'));
});
