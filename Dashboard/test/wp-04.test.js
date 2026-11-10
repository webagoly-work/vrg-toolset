// WP-04: the window-mode state machine on a fake window, the tray menu, and the PNG placeholder.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { createWinModes, isMode, apply } = require('../shell/lib/winmodes.js');
const { menuTemplate, squarePng, createTray } = require('../shell/lib/tray.js');

const DISPLAY = { id: 7, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
function fake() {
  const calls = [];
  let bounds = { x: 100, y: 50, width: 1500, height: 950 };
  const win = {
    calls,
    getBounds: () => ({ ...bounds }),
    setBounds: b => { bounds = { ...b }; calls.push(['setBounds', { ...b }]); },
    setAlwaysOnTop: (...a) => calls.push(['setAlwaysOnTop', ...a]),
    setFullScreen: v => calls.push(['setFullScreen', v]),
    show: () => calls.push(['show']), hide: () => calls.push(['hide']), focus: () => calls.push(['focus']),
  };
  const screen = { getDisplayMatching: () => DISPLAY, getPrimaryDisplay: () => DISPLAY, getAllDisplays: () => [DISPLAY] };
  return { win, screen, calls };
}

test('isMode accepts exactly the three modes', () => {
  assert.deepEqual(['ablak', 'munka', 'overlay'].map(isMode), [true, true, true]);
  for (const m of ['', 'Ablak', 'kiosk', null, undefined, 1, {}]) assert.equal(isMode(m), false);
});

test('ablak → munka → overlay → toggle(hidden) → toggle(shown) → ablak gives the exact calls', () => {
  const { win, screen, calls } = fake();
  const wm = createWinModes({ win, screen });
  assert.deepEqual(wm.mode('munka'), { ok: true, mode: 'munka' });
  assert.deepEqual(wm.mode('overlay'), { ok: true, mode: 'overlay' });
  assert.deepEqual(wm.toggleOverlay(), { ok: true, visible: false });
  assert.deepEqual(wm.toggleOverlay(), { ok: true, visible: true });
  assert.deepEqual(wm.mode('ablak'), { ok: true, mode: 'ablak' });
  assert.deepEqual(calls, [
    ['setAlwaysOnTop', false], ['setBounds', DISPLAY.bounds], ['setFullScreen', true],
    ['setFullScreen', false], ['setAlwaysOnTop', true, 'screen-saver'], ['setBounds', DISPLAY.workArea],
    ['hide'],
    ['show'], ['focus'],
    ['setAlwaysOnTop', false], ['setFullScreen', false], ['setBounds', { x: 100, y: 50, width: 1500, height: 950 }],
  ]);
  assert.equal(wm.state().displayId, 7);
});

test('unknown mode is refused and changes nothing', () => {
  const { win, screen, calls } = fake();
  const wm = createWinModes({ win, screen });
  const r = wm.mode('kiosk');
  assert.equal(r.ok, false); assert.equal(r.err, 'bad-request');
  assert.deepEqual(calls, []); assert.equal(wm.state().mode, 'ablak');
  assert.throws(() => apply(win, screen, 'kiosk', DISPLAY), /unknown mode/);
});

test('bounds are restored after munka', () => {
  const { win, screen } = fake();
  const wm = createWinModes({ win, screen });
  const before = win.getBounds();
  wm.mode('munka'); assert.deepEqual(win.getBounds(), DISPLAY.bounds);
  wm.mode('ablak'); assert.deepEqual(win.getBounds(), before);
});

test('the hotkey outside overlay enters overlay and shows', () => {
  const { win, screen, calls } = fake();
  const wm = createWinModes({ win, screen });
  assert.deepEqual(wm.toggleOverlay(), { ok: true, visible: true });
  assert.equal(wm.state().mode, 'overlay');
  assert.ok(calls.some(c => c[0] === 'setAlwaysOnTop' && c[1] === true && c[2] === 'screen-saver'));
});

test('state is saved to and restored from a temp file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-test-'));
  try {
    const file = path.join(dir, 'winstate.json');
    const a = fake(); createWinModes({ ...a, file }).mode('munka');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { mode: 'munka', displayId: 7, bounds: { x: 100, y: 50, width: 1500, height: 950 } });
    const b = fake(); const wm = createWinModes({ ...b, file });
    assert.equal(wm.restore(), true); assert.equal(wm.state().mode, 'munka');
    assert.equal(createWinModes({ ...fake(), file: path.join(dir, 'none.json') }).restore(), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('tray menu has the five entries in order and calls the handlers', () => {
  const got = [];
  const h = { mode: m => got.push(m), show() {}, refresh: () => got.push('refresh'), quit: () => got.push('quit') };
  const t = menuTemplate(h, 'munka');
  assert.deepEqual(t.filter(i => i.type !== 'separator').map(i => i.label), ['Ablak', 'Munka (teljes képernyő)', 'Overlay (mindig felül)', 'Frissítés', 'Kilépés']);
  assert.deepEqual(t.filter(i => i.type === 'radio').map(i => i.checked), [false, true, false]);
  t.filter(i => i.click).forEach(i => i.click());
  assert.deepEqual(got, ['ablak', 'munka', 'overlay', 'refresh', 'quit']);
});

test('tray double-click shows the window', () => {
  let shown = 0, handler = null;
  class Tray { constructor(i) { this.i = i; } setToolTip() {} setContextMenu() {} on(ev, fn) { if (ev === 'double-click') handler = fn; } destroy() {} }
  const nativeImage = { createFromBuffer: b => ({ buf: b }), createFromPath: () => ({ isEmpty: () => true }) };
  createTray({ Tray, Menu: { buildFromTemplate: t => t }, nativeImage, iconPath: '', handlers: { mode() {}, show: () => shown++, refresh() {}, quit() {} } });
  handler(); assert.equal(shown, 1);
});

test('the placeholder PNG is a 32x32 RGB square in the accent colour', () => {
  const png = squarePng();
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 32); assert.equal(png.readUInt32BE(20), 32);
  const idatLen = png.readUInt32BE(33);
  const raw = zlib.inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, 32 * (1 + 96));
  assert.deepEqual([...raw.subarray(1, 4)], [0x93, 0xd3, 0xe6]);
  const file = path.join(__dirname, '..', 'shell', 'icon.png');
  if (fs.existsSync(file)) assert.ok(fs.readFileSync(file).equals(png));
});
