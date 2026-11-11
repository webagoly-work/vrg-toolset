// WP-47 Archívum: the Artifact Archive (Archive/archive.js + Archive/index.json) and how the VRG Asztal reaches it: a catalog item
// that opens as an in-shell app on vrg-app://archive/, a Dashboard section shown at every level, the real index valid and VRG-first.
// The add / build / stale round trip runs on a throwaway folder in %TEMP%, never on the real Archive.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), os = require('os');
const A = require('../../Archive/archive.js');
const build = require('../build.js');
const layout = require('../shell/lib/layout.js');
const { createCatalog } = require('../shell/lib/catalog.js');
const { createAppScheme } = require('../shell/lib/appscheme.js');
const D = require('../shell/lib/desk.js');

const REPO = path.resolve(__dirname, '..', '..');
const C = build.collect();
const cat = createCatalog({ file: path.join(REPO, 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: layout.KINDS });
cat.load();
const isFile = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
const sch = createAppScheme({ catalog: cat, repo: REPO, expand: s => C.expand(s), isFile });

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-archive-'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ version: 1, items: [] }));
  return dir;
}
const page = (dir, name, title) => { const f = path.join(dir, name); fs.writeFileSync(f, '<!doctype html><html><head><title>' + title + '</title></head><body><script>1</script></body></html>'); return f; };

test('the real index: valid, every saved copy present, index.js current, VRG entries first and newest first', () => {
  const j = A.read();
  assert.deepEqual(A.validate(j), []);
  assert.equal(A.stale(), false, 'run node Archive/archive.js build');
  const s = A.sorted(j.items);
  const firstOther = s.findIndex(i => !i.vrg);
  if (firstOther >= 0) assert.ok(s.slice(firstOther).every(i => !i.vrg), 'no VRG entry after the first other one');
  for (let i = 1; i < s.length; i++) if (s[i].vrg === s[i - 1].vrg) assert.ok(s[i - 1].created >= s[i].created, 'newest first: ' + s[i - 1].id + ' / ' + s[i].id);
  assert.ok(j.items.length >= 20, 'the archive holds the published artifacts');
});

test('add: copies the page into files/<id>.html, takes the title from <title>, never overwrites an id, rebuilds index.js', () => {
  const dir = tmp();
  const a = A.add(page(dir, 'x.html', 'Próba Lap'), { vrg: true, created: '2026-11-01', purpose: 'test' }, dir);
  assert.equal(a.id, 'proba-lap');
  assert.equal(a.file, 'files/proba-lap.html');
  assert.ok(fs.existsSync(path.join(dir, a.file)));
  const b = A.add(page(dir, 'y.html', 'Próba Lap'), { created: '2026-11-05' }, dir);
  assert.equal(b.id, 'proba-lap-2', 'a clashing title gets a fresh id');
  assert.throws(() => A.add(page(dir, 'z.html', 'Z'), { id: 'proba-lap' }, dir), /already exists/);
  assert.throws(() => A.add(page(dir, 'u.html', 'U'), { url: 'https://evil.example/x' }, dir), /claude\.ai/);
  assert.equal(A.stale(dir), false);
  const l = A.list(dir);
  assert.deepEqual(l.items.map(i => i.id), ['proba-lap', 'proba-lap-2'], 'VRG first even when older');
  assert.equal(l.items[0].saved, true);
  fs.writeFileSync(path.join(dir, 'files', 'proba-lap.html'), '');
  fs.rmSync(path.join(dir, 'files', 'proba-lap-2.html'));
  assert.ok(A.validate(A.read(dir), dir).some(e => /missing/.test(e)), 'a missing copy is reported');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validate: bad ids, dates, kinds and links are reported', () => {
  const errs = A.validate({ items: [
    { id: 'Bad Id', title: 'x', created: '2026-1-1', vrg: 'yes', kind: 'poster', url: 'http://claude.ai/artifact/x' },
    { id: 'ok', title: 'x', created: '2026-01-01', vrg: false },
  ] });
  for (const re of [/bad id/, /created/, /vrg must/, /kind must/, /not a claude\.ai/, /neither url, file nor localPath/]) assert.ok(errs.some(e => re.test(e)), String(re));
});

test('the catalog: archive is a User application-level item that opens in-shell on its own origin; the section shows at every level', () => {
  const it = cat.get('archive');
  assert.ok(it, 'catalog item archive');
  assert.equal(it.level, 'user');
  assert.equal(sch.urlFor('archive'), 'vrg-app://archive/Archive/vrg-archive.html');
  assert.equal(sch.decide('vrg-app://archive/Archive/index.js').ok, true);
  assert.equal(sch.decide('vrg-app://archive/shared/melyviz.css').ok, true);
  assert.equal(sch.decide('vrg-app://archive/Archive/archive.js').ok, true, 'served, but harmless: the page never loads it');
  assert.equal(sch.decide('vrg-app://archive/Calculator/panel_anyagar_kalkulator.html').ok, false, 'another app folder is refused');
  const first = A.read().items.find(i => i.file);
  if (first) assert.equal(sch.decide('vrg-app://archive/Archive/' + first.file).ok, true, 'a saved copy is served');
  for (const lv of ['user', 'dev', 'all']) {
    const secs = D.sections(cat.listFor(lv), lv, cat.sections(), cat.groups());
    assert.ok(secs.some(s => s.id === 'archivum'), 'archivum at ' + lv);
  }
});
