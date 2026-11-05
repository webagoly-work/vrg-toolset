// WP-26: webmail panes — unread counts from titles, the partition allow-list, mail presets through web.open (fake views; no real mail site).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { unreadFromTitle } = require('../shell/lib/webmail.js');
const web = require('../shell/lib/web.js');
const panes = require('../page/panes/web.js');

test('unreadFromTitle: 8 cases', () => {
  const table = [
    ['Inbox (3) - demo@example.com - Gmail', 3],
    ['Beérkező levelek (12) - demo@example.com - Gmail', 12],
    ['(3) Mail - Demo - Outlook', 3],
    ['Inbox - demo@example.com - Gmail', null],
    ['Mail - Demo - Outlook', null],
    ['Inbox (0) - demo@example.com - Gmail', 0],
    ['(0) Mail - Demo - Outlook', 0],
    ['(x) ((3', null],
  ];
  assert.strictEqual(table.length, 8);
  for (const [t, want] of table) assert.strictEqual(unreadFromTitle(t), want, t);
  assert.strictEqual(unreadFromTitle(null), null);
  assert.strictEqual(unreadFromTitle(42), null);
});

function fakeWc() {
  const wc = new EventEmitter();
  Object.assign(wc, { url: '', title: 't', loads: [], getURL() { return this.url; }, getTitle() { return this.title; }, isDestroyed: () => false,
    setWindowOpenHandler() {}, loadURL(u) { this.loads.push(u); this.url = u; return Promise.resolve(); },
    isLoading: () => false, isCurrentlyAudible: () => false, canGoBack: () => false, canGoForward: () => false });
  return wc;
}
function env() {
  const made = [], events = [], sessions = {};
  let seq = 0;
  const views = {
    createWeb({ partition, id }) { id = id || 'w' + (++seq); const view = { webContents: fakeWc() }; made.push({ id, partition, view }); return { id, view }; },
    destroy() { return true; }, setBounds() { return true; },
  };
  const getSession = p => sessions[p] || (sessions[p] = Object.assign(new EventEmitter(), {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1.0', setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {},
  }));
  const host = web.createWebHost({ getViews: () => views, getSession, settings: { get: () => ({}), set: () => {} }, emit: (t, d) => events.push([t, d]) });
  return { host, made, events, sessions };
}

test('partition allow-list: persist:other is refused, the two known ones pass', () => {
  const e = env();
  const bad = e.host.open({ url: 'https://example.com/', partition: 'persist:other' });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.err, 'bad-request');
  assert.strictEqual(e.made.length, 0);
  assert.ok(e.host.createTab({ url: 'https://example.com/', partition: 'persist:vrg-mail' }).view);
  assert.ok(e.host.open({ url: 'https://example.com/', partition: 'persist:vrg-web' }).view);
  assert.deepStrictEqual(e.made.map(m => m.partition), ['persist:vrg-mail', 'persist:vrg-web']);
});

test('web.open {target:"web:gmail"} / outlook: right URL and the mail partition; github stays in the web partition', () => {
  const e = env();
  const g = e.host.open({ target: 'web:gmail' });
  const o = e.host.open({ target: 'web:outlook' });
  assert.ok(g.view && o.view);
  assert.deepStrictEqual(e.made.map(m => m.partition), ['persist:vrg-mail', 'persist:vrg-mail']);
  assert.deepStrictEqual(e.made.map(m => m.view.webContents.loads[0]), ['https://mail.google.com/mail/u/0/#inbox', 'https://outlook.live.com/mail/0/']);
  e.host.open({ target: 'web:github' });
  assert.strictEqual(e.made[2].partition, 'persist:vrg-web');
  assert.strictEqual(e.host.open({ target: 'web:nope' }).err, 'not-found');
  assert.strictEqual(e.host.open({ target: 'web:../x' }).err, 'not-found');
});

test('a preset with a foreign partition is refused', () => {
  const e = env();
  const host = web.createWebHost({ getViews: () => ({ createWeb: () => null }), getSession: () => ({}), settings: {}, presets: () => [{ id: 'x', url: 'https://example.com/', partition: 'persist:other' }] });
  assert.strictEqual(host.open({ target: 'web:x' }).err, 'bad-request');
  assert.strictEqual(e.made.length, 0);
});

test('a mail tab reports mail.unread on page-title-updated and carries it in its state', () => {
  const e = env();
  const g = e.host.open({ target: 'web:gmail' });
  const wc = e.made[0].view.webContents;
  wc.title = 'Inbox (3) - demo@example.com - Gmail';
  wc.emit('page-title-updated');
  const ev = e.events.filter(x => x[0] === 'mail.unread');
  assert.deepStrictEqual(ev, [['mail.unread', { acc: 'gmail', n: 3, view: g.view }]]);
  const s = e.host.state(g.view);
  assert.strictEqual(s.acc, 'gmail');
  assert.strictEqual(s.unread, 3);
  wc.emit('page-title-updated');                               // same count: no second event
  assert.strictEqual(e.events.filter(x => x[0] === 'mail.unread').length, 1);
  const p = e.host.open({ url: 'https://example.com/' });      // a plain tab has no mail fields
  assert.strictEqual(e.host.state(p.view).acc, undefined);
});

test('palette items: web:gmail and web:outlook are listed', () => {
  const ids = web.paletteItems().map(i => i.id);
  assert.ok(ids.includes('web:gmail') && ids.includes('web:outlook'));
});

test('pane: mail tabs are saved as their preset and restored', () => {
  assert.deepStrictEqual(panes.restoreList({ tabs: ['web:gmail', 'web:evil', 'https://example.com/', 'javascript:1'], active: 1 }), { tabs: ['web:gmail', 'https://example.com/'], active: 1 });
  assert.strictEqual(panes.unreadText(3), '3 olvasatlan');
});
