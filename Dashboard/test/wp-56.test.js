// WP-56 Szem: the Desktop's side of screen reading — shell/lib/eyes.js over a fake Voice/screen module (off by default, the glance taken at
// the global key, bad requests refused), shell/lib/hudwin.js (the always-on-top answer: fixed message keys, placement), the settings keys,
// main's wiring (IPC, the global key, PowerShell on the spawn list), the recorder's global start, the overlay's screen commands.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { createEyes, GLANCE_MS } = require('../shell/lib/eyes.js');
const hud = require('../shell/lib/hudwin.js');
const settings = require('../shell/lib/settings.js');

const DASH = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(DASH, f), 'utf8');

function fakeScreen(log) {
  let n = 0;
  return { createScreen: o => ({ describe: async ({ what }) => { n++; log.push(what); return { ok: true, source: 'uia', app: 'chrome', title: 'T' + n, say: 'Chrome ' + n, detail: '', lines: [], own: false }; }, close: () => log.push('close') }) };
}

test('eyes: off by default, unavailable without the module, bad requests refused', async () => {
  const off = createEyes({ loadScreen: () => fakeScreen([]) });
  assert.strictEqual((await off.describe({ what: 'focused' })).err, 'disabled');
  const none = createEyes({ loadScreen: () => { throw new Error('missing'); }, enabled: () => true });
  assert.strictEqual((await none.describe({ what: 'focused' })).err, 'unavailable');
  const on = createEyes({ loadScreen: () => fakeScreen([]), enabled: () => true });
  assert.strictEqual((await on.describe({ what: 'pixels' })).err, 'bad-request');
  assert.strictEqual((await on.describe({ what: 'windows' })).say, 'Chrome 1');
  assert.deepStrictEqual(on.status(), { ok: true, enabled: true, available: true });
});

test('eyes: the glance — "focused" right after the global key answers about the window that was in front then', async () => {
  let t = 1000;
  const log = [];
  const e = createEyes({ loadScreen: () => fakeScreen(log), enabled: () => true, now: () => t });
  const g = e.glance();
  t += 3000;                                                         // the user speaks; meanwhile another window could come forward
  const r = await e.describe({ what: 'focused' });
  assert.strictEqual(r.title, (await g).title);
  assert.deepStrictEqual(log, ['focused']);                          // read once, at the key
  t += GLANCE_MS;
  assert.notStrictEqual((await e.describe({ what: 'focused' })).title, r.title);   // later: read again
  assert.strictEqual(createEyes({ loadScreen: () => fakeScreen([]) }).glance(), null);   // off → no glance
  e.close();
  assert.ok(log.includes('close'));
});

test('hudwin: fixed message keys, plain capped text, bottom-right of the work area', () => {
  assert.deepStrictEqual(hud.message({ state: 'weird', say: 'a\nb', detail: 'x'.repeat(500), html: '<b>' }), { state: 'result', say: 'a b', detail: 'x'.repeat(240) });
  assert.deepStrictEqual(hud.place({ x: 0, y: 0, width: 1920, height: 1040 }), { x: 1482, y: 926, width: 420, height: 96 });
  const html = read('page/hud.html');
  assert.match(html, /default-src 'none'; script-src 'self' file:/);
  assert.ok(!/<script src="http/.test(html));
  assert.match(read('shell/hud-preload.js'), /exposeInMainWorld\('hud', \{ on:/);
  assert.ok(!/invoke|send\(/.test(read('shell/hud-preload.js')), 'the answer window sends nothing back');
});

test('settings: everything new is off by default; the global key avoids the existing hotkeys', () => {
  for (const k of ['screen.enabled', 'speak.enabled', 'voice.global']) { assert.ok(settings.KEYS[k], k); assert.strictEqual(settings.KEYS[k].def, false, k); }
  assert.strictEqual(settings.KEYS['speak.engine'].def, 'sherpa');
  assert.ok(settings.KEYS['voice.globalKey'].type('Control+Alt+V') && !settings.KEYS['voice.globalKey'].type('Control+Alt+Space'));
  const src = read('shell/lib/settings.js');
  assert.match(src, /'voice\.globalKey':[^\n]*def: 'Control\+Alt\+V'/);
  assert.ok(!/'voice\.globalKey'[^\n]*Control\\\+Alt\\\+Space/.test(src), 'Ctrl+Alt+Space is the overlay mode');
  assert.match(src, /'screen\.deny':[^\n]*keepass[^\n]*bitwarden/);
  assert.match(src, /'screen\.denyTitles':[^\n]*jelsz[^\n]*bank/);
});

test('wiring: IPC, the glance at the global key, the recorder\'s global start, the overlay\'s screen commands and spoken answers', () => {
  const main = read('shell/main.js');
  for (const ch of ["'screen', 'describe'", "'screen', 'status'", "'speak', 'say'", "'speak', 'stop'", "'speak', 'status'", "'hud', 'show'"]) assert.ok(main.includes('ipc.register(' + ch), ch);
  assert.match(main, /ipc\.emit\(win, 'voice', 'global', \{ phase: 'start' \}\);[^\n]*\n\s*eyesLib\.glance\(\);/);
  assert.match(main, /registerGlobalVoice\(\);/);
  const voice = read('page/voice.js');
  assert.match(voice, /vrg\.on\('voice', 'global'/);
  assert.match(voice, /begin\('command', null, \{ global: true \}\)/);
  const cmd = read('page/voicecmd.js');
  for (const a of ["'screen.app'", "'screen.windows'", "'screen.error'", "'screen.read'", "'speak.stop'", "'speak.on'", "'speak.off'"]) assert.ok(cmd.includes('async ' + a + '('), a);
  assert.ok(!/vrg\.(screen|hud|speak)\b/.test(cmd), 'vrg is a function in voicecmd.js: vrg().x, never vrg.x');
  assert.match(cmd, /V\.on\('start', m => \{ stopSpeech\(\);/);
  const reg = require('../../Voice/command/commands.json');
  for (const id of ['screen.app', 'screen.windows', 'screen.error', 'screen.read', 'speak.stop', 'speak.on', 'speak.off']) assert.ok(reg.commands.some(c => c.id === id), id);
  const P = require('../../Voice/command/parse.js');
  const ctx = { catalog: [], laps: [], windows: [], machines: [] };
  const cases = { 'melyik program ez?': 'screen.app', 'mi a hiba?': 'screen.error', 'olvasd fel': 'screen.read', 'milyen ablakok vannak nyitva': 'screen.windows',
    csend: 'speak.stop', 'ne beszélj': 'speak.off', 'beszélj': 'speak.on', 'mi van a képernyőn': 'ask.screen', 'mégse': 'cancel', "what's the error": 'screen.error' };
  for (const [t, want] of Object.entries(cases)) assert.strictEqual(P.parse(t, { registry: reg, ctx }).command, want, t);
});
