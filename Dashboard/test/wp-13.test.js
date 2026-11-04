// WP-13: viewer and open-with. A temp root under %TEMP%\VRG\desk-test-*, a fake shell, clipboard and execFile.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const { createRoots } = require('../shell/lib/roots.js');
const { createHandles } = require('../shell/lib/handles.js');
const { createFileView } = require('../shell/lib/fsview.js');
const viewer = require('../page/panes/viewer.js');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const A = path.join(TMP, 'A');
fs.mkdirSync(A);
const conf = path.join(TMP, 'roots.json');
fs.writeFileSync(conf, JSON.stringify([{ id: 'a', hu: 'A', path: A }]));
const roots = createRoots({ configFile: conf, repo: A, full: TMP });
roots.load();
const handles = createHandles({ roots });
const FAKE_CODE = path.join(TMP, 'Code.exe');
fs.writeFileSync(FAKE_CODE, 'x');

const calls = { open: [], reveal: [], exec: [], clip: [] };
function make(extra = {}) {
  const shell = { openPath: async p => { calls.open.push(p); return extra.openErr || ''; }, showItemInFolder: p => { calls.reveal.push(p); } };
  const clipboard = { writeText: t => { calls.clip.push(t); } };
  const execFile = (file, args, opts, cb) => { calls.exec.push({ file, args }); return { unref() {} }; };
  return createFileView({ fs, shell, clipboard, handles, roots, execFile, codePath: () => extra.code === undefined ? FAKE_CODE : extra.code, cloud: extra.cloud });
}
const view = make();
const put = (name, data) => { const p = path.join(A, name); fs.writeFileSync(p, data); return handles.issue(p); };

test('UTF-8 text with ő ű', async () => {
  const r = await view.read(put('utf8.txt', 'ő ű\nsor2\n'));
  assert.equal(r.kind, 'text');
  assert.equal(r.encoding, 'utf-8');
  assert.equal(r.text, 'ő ű\nsor2\n');
  assert.equal(r.truncated, false);
});

test('Windows-1250 text: bytes F5 FB are ő ű', async () => {
  const r = await view.read(put('w1250.txt', Buffer.from([0xF5, 0x20, 0xFB])));
  assert.equal(r.kind, 'text');
  assert.equal(r.encoding, 'windows-1250');
  assert.equal(r.text, 'ő ű');
});

test('a 3 MB file is cut to 2 MB and says so', async () => {
  const r = await view.read(put('big.txt', Buffer.alloc(3 * 1024 * 1024, 'a')));
  assert.equal(r.kind, 'text');
  assert.equal(r.truncated, true);
  assert.equal(r.text.length, 2 * 1024 * 1024);
});

test('a cut inside a UTF-8 character stays utf-8', async () => {
  const r = await view.read(put('cut.txt', 'aő'), { max: 2 });         // 'a' + first byte of ő
  assert.equal(r.encoding, 'utf-8');
  assert.equal(r.text, 'a');
  assert.equal(r.truncated, true);
});

test('a 1x1 PNG is an image with a data URL', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const r = await view.read(put('p.png', png));
  assert.equal(r.kind, 'image');
  assert.equal(r.mime, 'image/png');
  assert.equal(r.dataUrl, 'data:image/png;base64,' + png.toString('base64'));
});

test('SVG comes as text for the page to sanitize', async () => {
  const r = await view.read(put('s.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'));
  assert.equal(r.kind, 'image');
  assert.equal(r.svg, true);
  assert.equal(r.dataUrl, undefined);
  assert.equal(r.text, '<svg xmlns="http://www.w3.org/2000/svg"/>');
});

test('a .bin file is a hex dump of the first 512 bytes', async () => {
  const buf = Buffer.alloc(600); buf[0] = 0x41; buf[1] = 0; buf[2] = 0xff;
  const r = await view.read(put('x.bin', buf));
  assert.equal(r.kind, 'binary');
  const lines = r.text.split('\n');
  assert.equal(lines.length, 32);
  assert.equal(lines[0], '00000000  41 00 ff 00 00 00 00 00 00 00 00 00 00 00 00 00  A...............');
  assert.equal(r.truncated, true);
});

test('unknown extension with a NUL in the first 4 KB is binary', async () => {
  const r = await view.read(put('noext', Buffer.from([0x61, 0, 0x62])));
  assert.equal(r.kind, 'binary');
});

test('cloud-only file is refused unless fetch:true', async () => {
  const cloudRoot = path.join(TMP, 'C'); fs.mkdirSync(cloudRoot);
  const cconf = path.join(TMP, 'croots.json');
  fs.writeFileSync(cconf, JSON.stringify([{ id: 'c', hu: 'C', path: cloudRoot, kind: 'onedrive' }]));
  const cr = createRoots({ configFile: cconf, repo: cloudRoot, full: TMP }); cr.load();
  const ch = createHandles({ roots: cr });
  const p = path.join(cloudRoot, 'doc.txt'); fs.writeFileSync(p, 'felho');
  const v = createFileView({ fs, shell: {}, clipboard: {}, handles: ch, roots: cr, execFile() {}, codePath: '',
    cloud: { marks: async () => new Map([['doc.txt', 'online']]) } });
  assert.deepEqual(await v.read(ch.issue(p)), { ok: false, err: 'cloud', hu: 'Csak a felhőben van.' });
  assert.equal((await v.read(ch.issue(p), { fetch: true })).text, 'felho');
});

test('a bad or foreign handle is refused', async () => {
  assert.equal((await view.read('h:AAAAAAAAAAAAAAAAAAAAAA')).err, 'not-found');
  assert.equal((await view.read(handles.issue(A))).err, 'bad-request');          // a folder
});

test('edit passes the absolute path as one argument, spaces and & included', async () => {
  const h = put('a & b (1) c.txt', 'x');
  calls.exec.length = 0;
  assert.deepEqual(await view.edit(h), {});
  assert.equal(calls.exec.length, 1);
  assert.equal(calls.exec[0].file, FAKE_CODE);
  assert.deepEqual(calls.exec[0].args, [path.join(A, 'a & b (1) c.txt')]);
});

test('edit without VS Code says so and starts nothing', async () => {
  calls.exec.length = 0;
  const r = await make({ code: path.join(TMP, 'nope', 'Code.exe') }).edit(put('e.txt', 'x'));
  assert.deepEqual(r, { ok: false, err: 'missing', hu: 'A VS Code nincs telepítve' });
  assert.equal(calls.exec.length, 0);
});

test('open, reveal and copyPath use the resolved path', async () => {
  const h = put('o.txt', 'x'), abs = path.join(A, 'o.txt');
  assert.deepEqual(await view.open(h), {});
  assert.deepEqual(calls.open.at(-1), abs);
  assert.deepEqual(await view.reveal(h), {});
  assert.equal(calls.reveal.at(-1), abs);
  assert.deepEqual(await view.copyPath(h), { display: abs });
  assert.equal(calls.clip.at(-1), abs);
});

test('open refuses a program file and reports an openPath error', async () => {
  calls.open.length = 0;
  const r = await view.open(put('tool.bat', 'echo'));
  assert.equal(r.ok, false);
  assert.equal(r.err, 'forbidden');
  assert.equal(calls.open.length, 0);
  const e = await make({ openErr: 'no app' }).open(put('q.txt', 'x'));
  assert.equal(e.err, 'io');
});

test('viewer helpers: markdown names and line splitting', () => {
  assert.equal(viewer.isMarkdown('README.md'), true);
  assert.equal(viewer.isMarkdown('a.txt'), false);
  assert.deepEqual(viewer.splitLines('a\r\nb\n'), ['a', 'b']);
  assert.deepEqual(viewer.splitLines(''), ['']);
});
