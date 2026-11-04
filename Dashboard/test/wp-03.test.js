// WP-03: lib/ipc.js (validator, registry, sender check) and lib/audit.js, without Electron.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createIpc, types: T } = require('../shell/lib/ipc.js');
const { createAudit } = require('../shell/lib/audit.js');

const PAGE = 'file:///H:/x/Dashboard/vrg-dashboard.html';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-test-wp03-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = new Map();
const fakeIpcMain = { handle: (ch, fn) => handlers.set(ch, fn) };
const audit = createAudit({ dir });
const ipc = createIpc({ ipcMain: fakeIpcMain, audit, allowedUrls: () => [PAGE] });
let calls = 0;
ipc.register('t', 'all', {
  id: T.id, h: T.handle, name: T.name, url: T.url, text: T.text(10), n: T.int(1, 5), flag: T.bool,
  mode: T.enum('a', 'b'), list: T.arr(T.handle, 2), meta: T.json(50),
}, async () => { calls++; return { done: true }; }, { optional: ['flag', 'meta', 'list'] });
ipc.register('t', 'none', {}, async () => ({ n: 1 }));
ipc.register('t', 'boom', {}, async () => { throw new Error('kaboom'); });

const H = 'h:' + 'A'.repeat(22);
const good = { id: 'root:repo', h: H, name: 'report.txt', url: 'https://example.com/a?b=1', text: 'abcdefghij', n: 3, mode: 'a' };
const ev = url => ({ senderFrame: { url } });
const invoke = (ch, payload, url = PAGE) => handlers.get('vrg2:' + ch)(ev(url), payload);
const readAudit = () => fs.readdirSync(dir).filter(f => /^audit-\d{4}-\d\d-\d\d\.jsonl$/.test(f))
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');

test('5 good payloads pass', async () => {
  const goods = [
    good,
    { ...good, flag: true },
    { ...good, list: [H, H], n: 5 },
    { ...good, meta: { a: [1, 2] }, mode: 'b' },
    { ...good, name: 'a b.c', id: 'x', text: '' },
  ];
  for (const p of goods) assert.deepStrictEqual(await invoke('t.all', p), { ok: true, done: true }, JSON.stringify(p));
  assert.strictEqual(calls, 5);
});

test('30 bad payloads are refused, the handler never runs', async () => {
  const before = calls;
  const bad = [
    { ...good, extra: 1 },                                  // 1 extra key
    { ...good, id: 7 },                                     // wrong type
    { ...good, text: 'x'.repeat(11) },                      // one char too long
    { ...good, name: '../evil' },                           // ../ in a name
    { ...good, name: 'a/b' },
    { ...good, name: 'a\\b' },
    { ...good, name: 'con' },
    { ...good, name: 'trail.' },
    { ...good, name: 'x'.repeat(201) },
    { ...good, url: 'file:///C:/Windows/win.ini' },         // file: URL
    { ...good, url: 'javascript:alert(1)' },
    { ...good, url: 'data:text/html,hi' },
    { ...good, url: 'https://x/' + 'a'.repeat(4100) },
    { ...good, h: 'h:' + 'A'.repeat(21) },                  // handle of wrong length
    { ...good, h: 'h:' + 'A'.repeat(23) },
    { ...good, h: 'C:\\Windows' },
    { ...good, h: H + '/sub' },
    { ...good, list: [H, H, H] },                           // array over max
    { ...good, list: [H, 'nope'] },
    { ...good, list: 'x' },
    { ...good, text: { a: 'b' } },                          // nested object for a text
    { ...good, text: ['abc'] },
    { ...good, n: 6 },
    { ...good, n: 1.5 },
    { ...good, mode: 'c' },
    { ...good, flag: 'true' },
    { ...good, meta: { s: 'x'.repeat(60) } },
    JSON.parse('{"__proto__":{"x":1},"id":"a"}'),           // __proto__ key
    null,
    'a string',
    [good],
    (({ id, ...r }) => r)(good),                            // missing required key
  ];
  assert.ok(bad.length >= 30);
  for (const p of bad) {
    const r = await invoke('t.all', p);
    assert.deepStrictEqual(r, { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' }, JSON.stringify(p));
  }
  assert.strictEqual(calls, before);
  const r = await invoke('t.none', { x: 1 });
  assert.strictEqual(r.err, 'bad-request');
  assert.deepStrictEqual(await invoke('t.none', {}), { ok: true, n: 1 });
});

test('sender check refuses a web view', async () => {
  for (const u of ['https://example.com/', 'file:///C:/other.html', '', null]) {
    assert.strictEqual((await invoke('t.none', {}, u)).err, 'forbidden');
  }
  assert.strictEqual((await handlers.get('vrg2:t.none')({}, {})).err, 'forbidden');
  assert.strictEqual((await invoke('t.none', {}, PAGE + '#x')).ok, true);
});

test('handler exception: generic reply, stack only in the audit log', async () => {
  const r = await invoke('t.boom', {});
  assert.deepStrictEqual(r, { ok: false, err: 'error', hu: 'Hiba történt.' });
  assert.ok(!JSON.stringify(r).includes('kaboom'));
  assert.ok(readAudit().includes('kaboom'));
});

test('audit never logs a secret value or long text', async () => {
  await invoke('t.all', { token: 'secret' });
  await invoke('t.all', { ...good, text: 'L'.repeat(500), password: 'hunter2', nested: { code_verifier: 'cv-value' } });
  const log = readAudit();
  assert.ok(log.length > 0);
  for (const bad of ['"secret"', 'hunter2', 'cv-value']) assert.ok(!log.includes(bad), bad);
  assert.ok(!log.includes('L'.repeat(201)));
  assert.ok(log.includes('[redacted]'));
  for (const line of log.trim().split('\n')) JSON.parse(line);
});

test('register: namespaces, duplicate and bad names; emit', () => {
  assert.deepStrictEqual(ipc.namespaces(), ['t']);
  assert.throws(() => ipc.register('t', 'none', {}, async () => ({})));
  assert.throws(() => ipc.register('Bad NS', 'x', {}, async () => ({})));
  const sent = [];
  const win = { isDestroyed: () => false, webContents: { send: (...a) => sent.push(a) } };
  assert.strictEqual(ipc.emit(win, 'jobs', 'update', { job: 'j1', ns: 'evil' }), true);
  assert.deepStrictEqual(sent, [['vrg2:evt', { job: 'j1', ns: 'jobs', type: 'update' }]]);
  assert.strictEqual(ipc.emit({ isDestroyed: () => true }, 'a', 'b', {}), false);
});
