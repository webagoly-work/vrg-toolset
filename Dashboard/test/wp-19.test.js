// WP-19: selection menu — build() order, disabled "(később)" items, text limits, empty selection; popup / pick against fakes;
// the web view's context-menu hook (lib/web.js) against a fake webContents. No disk, no network.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { build, createSelMenu } = require('../shell/lib/selmenu.js');
const { createWebHost } = require('../shell/lib/web.js');

const ALL = { 'web.open': true, 'search.inner': true, 'chat.start': true, 'note.save': true, ctx: true };
const names = t => t.map(i => (i.type === 'separator' ? '-' : i.label));

test('build with every feature: the items in the contract order', () => {
  const t = build('Kapu', 'frame', ALL);
  assert.deepStrictEqual(names(t), ['Másolás', '-', 'Belső keresés', 'Google', 'AI keresés', '-', 'Claude oldalchat', 'Mentés fejlesztői jegyzetként', '-', 'Csomaghoz adás']);
  assert.strictEqual(t.filter(i => i.type !== 'separator').length, 7);
  assert.ok(t.filter(i => i.type !== 'separator').every(i => i.enabled === true));
  assert.deepStrictEqual(t.filter(i => i.type !== 'separator').map(i => i.action), ['copy', 'search.inner', 'google', 'ai', 'chat', 'note', 'ctx']);
});

test('build with no features: Másolás, Google, AI keresés on, the rest greyed with (később)', () => {
  const t = build('Kapu', 'term', {});
  const on = t.filter(i => i.enabled === true).map(i => i.label);
  assert.deepStrictEqual(on, ['Másolás', 'Google', 'AI keresés']);
  const off = t.filter(i => i.enabled === false).map(i => i.label);
  assert.deepStrictEqual(off, ['Belső keresés (később)', 'Claude oldalchat (később)', 'Mentés fejlesztői jegyzetként (később)', 'Csomaghoz adás (később)']);
  assert.deepStrictEqual(build('x', 'frame').filter(i => i.enabled === true).length, 3);
});

test('text limits: search 300, chat / note / copy 65 536; the text is trimmed', () => {
  const t = build('  ' + 'a'.repeat(70000) + '  ', 'frame', ALL);
  const by = a => t.find(i => i.action === a).text;
  assert.strictEqual(by('chat').length, 65536);
  assert.strictEqual(by('note').length, 65536);
  assert.strictEqual(by('copy').length, 65536);
  assert.strictEqual(by('google').length, 300);
  assert.strictEqual(by('ai').length, 300);
  assert.strictEqual(by('search.inner').length, 300);
  assert.strictEqual(build('  Kapu \n', 'file', ALL)[0].text, 'Kapu');
});

test('an empty or whitespace-only selection builds no menu', () => {
  for (const s of ['', '   ', '\n\t ', null, undefined]) assert.strictEqual(build(s, 'frame', ALL), null);
});

function fakes() {
  const clip = [], events = [], shown = [];
  const Menu = { buildFromTemplate: tpl => ({ tpl, popup: o => shown.push({ tpl, o }) }) };
  const sm = createSelMenu({ Menu, clipboard: { writeText: s => clip.push(s) }, emit: (type, d) => events.push([type, d]), features: () => ({}) });
  return { sm, clip, events, shown };
}

test('pick: copy goes to the clipboard, the rest to the frame as sel.pick', () => {
  const { sm, clip, events } = fakes();
  sm.pick('copy', 'Kapu');
  sm.pick('google', 'Kapu');
  assert.deepStrictEqual(clip, ['Kapu']);
  assert.deepStrictEqual(events, [['pick', { action: 'google', text: 'Kapu' }]]);
});

test('popup: native template, click on Google emits sel.pick, empty text pops nothing', () => {
  const { sm, events, shown } = fakes();
  assert.strictEqual(sm.popup({ text: ' ', origin: 'frame' }), false);
  assert.strictEqual(shown.length, 0);
  assert.strictEqual(sm.popup({ text: 'Kapu', origin: 'web', extra: [{ label: 'Link megnyitása új lapon', click() {} }] }), true);
  const tpl = shown[0].tpl;
  assert.strictEqual(tpl[0].label, 'Link megnyitása új lapon');
  assert.strictEqual(tpl[1].type, 'separator');
  tpl.find(i => i.label === 'Google').click();
  assert.deepStrictEqual(events, [['pick', { action: 'google', text: 'Kapu' }]]);
  assert.strictEqual(tpl.find(i => i.label === 'Belső keresés (később)').enabled, false);
});

test('web tab: context-menu with a selection raises the menu; a link adds "Link megnyitása új lapon"; no selection, no menu', () => {
  const wc = new EventEmitter();
  Object.assign(wc, {
    setWindowOpenHandler() {}, isDestroyed: () => false, getURL: () => 'http://127.0.0.1/', getTitle: () => '', loadURL: () => Promise.resolve(),
    isLoading: () => false, isCurrentlyAudible: () => false, canGoBack: () => false, canGoForward: () => false,
  });
  const raised = [];
  const host = createWebHost({
    getViews: () => ({ createWeb: () => ({ id: 'w1', view: { webContents: wc } }), destroy() {}, setBounds: () => true }),
    getSession: () => ({ setUserAgent() {}, getUserAgent: () => '', setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {}, on() {} }),
    settings: { get: () => ({}), set() {} }, onSelection: o => raised.push(o),
  });
  assert.strictEqual(host.open({ url: 'http://127.0.0.1/' }).view, 'w1');
  wc.emit('context-menu', {}, { selectionText: '   ' });
  wc.emit('context-menu', {}, { selectionText: '' });
  assert.strictEqual(raised.length, 0);
  wc.emit('context-menu', {}, { selectionText: 'Kapu', linkURL: '' });
  assert.deepStrictEqual(raised[0], { text: 'Kapu', origin: 'web', extra: [] });
  wc.emit('context-menu', {}, { selectionText: 'Kapu', linkURL: 'javascript:alert(1)' });
  assert.strictEqual(raised[1].extra.length, 0);
  wc.emit('context-menu', {}, { selectionText: 'Kapu', linkURL: 'http://127.0.0.1/x' });
  assert.deepStrictEqual(raised[2].extra.map(x => x.label), ['Link megnyitása új lapon']);
});
