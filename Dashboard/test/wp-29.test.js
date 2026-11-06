// WP-29 — presets and feeds: each kind against its fixture, the host allow-list, the every clamp, the cache, feed.open refusals, textify.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { createPresets, validate, parsePorcelain, parseFeed, paletteItems, bind } = require('../shell/lib/presets.js');
const { textify, title } = require('../shell/lib/textify.js');
const { createJobs } = require('../shell/lib/jobs.js');

const FX = path.join(__dirname, 'fixtures', 'feeds');
const fx = n => fs.readFileSync(path.join(FX, n), 'utf8');
fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let hits = 0, server = null, base = '';
test.before(async () => {
  server = http.createServer((req, res) => {
    hits++;
    const f = { '/rss.xml': 'rss.xml', '/atom.xml': 'atom.xml', '/page.html': 'page.html' }[req.url];
    if (req.url === '/redir') { res.writeHead(302, { location: '/rss.xml' }); return res.end(); }
    if (!f) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(fx(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server && server.close());

let seq = 0;
function make(presets, over = {}) {
  const dir = path.join(TMP, 'c' + (++seq));
  fs.mkdirSync(dir, { recursive: true });
  const cfg = path.join(dir, 'presets.json');
  fs.writeFileSync(cfg, JSON.stringify({ allowHosts: over.allowHosts || [], presets }));
  const jobs = createJobs();
  const lib = createPresets({ jobs, configFile: cfg, userFile: over.userFile, cacheFile: path.join(dir, 'cache', 'presets.json'), sources: over.sources || {}, execFile: over.execFile, now: over.now });
  return { lib, jobs, dir, cfg };
}
const rec = async (lib, id) => { await lib.exec(id); return lib.results().results.find(r => r.pre === id); };

test('stack-drift: listed sections, first 10 bullets each', async () => {
  const { lib } = make([{ id: 'drift', hu: 'D', kind: 'stack-drift', sections: [1, 2, 4] }], { sources: { driftFile: path.join(FX, 'drift.md') } });
  const r = await rec(lib, 'drift');
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.items.length, 2 + 2 + 10);                          // section 1: 2 bullets, section 2: 2 table rows, section 4: 12 bullets cut to 10
  assert.strictEqual(r.items[0].hu, 'main is 2 commits ahead of origin/main.');
  assert.strictEqual(r.items[2].hu, 'L:demo Demo line · waiting · 2026-10-18 · 19');
  assert.strictEqual(r.items[4].hu, 'Feature one: last commit 2026-11-01');
});

test('git-status: porcelain v2 fixture → branch, ahead/behind, changed', async () => {
  assert.deepStrictEqual(parsePorcelain(fx('porcelain.txt')), { branch: 'demo-branch', ahead: 3, behind: 1, changed: 3 });
  let args = null;
  const execFile = (cmd, a, o, cb) => { args = [cmd, ...a]; cb(null, fx('porcelain.txt')); };
  const { lib } = make([{ id: 'git', hu: 'G', kind: 'git-status', repo: 'demo' }], { execFile, sources: { repoPath: n => (n === 'demo' ? 'C:\\demo-repo' : '') } });
  const r = await rec(lib, 'git');
  assert.deepStrictEqual(args, ['git', '-C', 'C:\\demo-repo', 'status', '--porcelain=v2', '--branch']);
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(r.items[0].hu, 'Ág: demo-branch');
  assert.strictEqual(r.items[0].detail, '↑3 ↓1 · 3 változott fájl');
});

test('ports and devlog-waiting', async () => {
  const sources = {
    ports: () => [{ id: 'demo', name: 'Demo server', port: 9001, up: true }, { id: 'idle', name: 'Idle server', port: 9002, up: false }],
    lines: () => [{ name: 'Demo line', status: 'waiting', nextStep: 'Say yes.', contAct: 'cont:demo' }, { name: 'Active line', status: 'active' }],
  };
  const { lib } = make([{ id: 'ports', hu: 'P', kind: 'ports' }, { id: 'waiting', hu: 'W', kind: 'devlog-waiting' }], { sources });
  const p = await rec(lib, 'ports');
  assert.strictEqual(p.items.length, 2);
  assert.strictEqual(p.items[0].hu, 'Demo server');
  assert.strictEqual(p.items[0].detail, 'fut · 9001');
  assert.strictEqual(p.items[0].open, true);
  assert.strictEqual(p.items[1].open, undefined);
  const w = await rec(lib, 'waiting');
  assert.strictEqual(w.items.length, 1);
  assert.strictEqual(w.items[0].hu, 'Demo line');
});

test('mail-query: not signed in → one sign-in item; signed in → subjects; no mail module → "Később"', async () => {
  const mail = signed => ({ accounts: () => [{ acc: 'gmail-api', kind: 'gmail', signedIn: signed }], list: async (acc, q) => ({ ok: true, items: [{ subject: 'Hello ' + q, from: 'a@example.org', date: '2026-11-05' }] }) });
  const preset = [{ id: 'inbox', hu: 'I', kind: 'mail-query', acc: 'gmail', q: 'is:unread', every: 30 }];
  let r = await rec(make(preset, { sources: { mail: mail(false) } }).lib, 'inbox');
  assert.deepStrictEqual(r.items.map(i => i.hu), ['Jelentkezz be a Postában']);
  r = await rec(make(preset, { sources: { mail: mail(true) } }).lib, 'inbox');
  assert.deepStrictEqual(r.items.map(i => i.hu), ['Hello is:unread']);
  r = await rec(make(preset, { sources: {} }).lib, 'inbox');
  assert.match(r.items[0].hu, /^Később/);
});

test('rss and atom against the local server, allowed host', async () => {
  const host = '127.0.0.1';
  const { lib } = make([{ id: 'r', hu: 'R', kind: 'rss', url: base + '/rss.xml' }, { id: 'a', hu: 'A', kind: 'atom', url: base + '/atom.xml' }], { allowHosts: [host] });
  const r = await rec(lib, 'r');
  assert.strictEqual(r.items.length, 3);
  assert.strictEqual(r.items[0].hu, 'First & best');
  assert.strictEqual(r.items[1].hu, 'Second <item>');
  const a = await rec(lib, 'a');
  assert.strictEqual(a.items.length, 2);
  assert.strictEqual(a.items[0].hu, 'Atom one');
  assert.strictEqual(parseFeed(fx('rss.xml'))[0].link, 'http://127.0.0.1/a');
  assert.strictEqual(parseFeed(fx('atom.xml'))[0].link, 'http://127.0.0.1/x');
});

test('feed items are cut at 20', () => {
  const xml = '<rss><channel>' + Array.from({ length: 30 }, (_, i) => '<item><title>T' + i + '</title><link>http://127.0.0.1/' + i + '</link></item>').join('') + '</channel></rss>';
  const items = parseFeed(xml);
  assert.strictEqual(items.length, 20);
  assert.strictEqual(items[19].title, 'T19');
});

test('page-text: textify of the fixture, first 2000 chars', async () => {
  const { lib } = make([{ id: 'pg', hu: 'P', kind: 'page-text', url: base + '/page.html' }], { allowHosts: ['127.0.0.1'] });
  const r = await rec(lib, 'pg');
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(r.items[0].hu, 'Demo page');
  assert.strictEqual(r.items[0].detail, 'Main heading\nFirst paragraph with bold text & an entity.\nSecond paragraph.');
  assert.ok(r.items[0].detail.length <= 2000);
});

test('a host that is not allowed is refused without a request', async () => {
  const before = hits;
  const { lib } = make([{ id: 'r', hu: 'R', kind: 'rss', url: base + '/rss.xml' }], { allowHosts: ['example.org'] });
  const r = await rec(lib, 'r');
  assert.strictEqual(hits, before);                                        // the server saw nothing
  assert.strictEqual(r.error, 'A gazdagép nincs engedélyezve: 127.0.0.1');
  assert.deepStrictEqual(r.items, []);
  const d = await rec(make([{ id: 'p', hu: 'P', kind: 'page-text', url: base + '/page.html' }]).lib, 'p');   // empty allowHosts (the default)
  assert.strictEqual(d.error, 'A gazdagép nincs engedélyezve: 127.0.0.1');
  assert.strictEqual(hits, before);
});

test('a redirect is not followed', async () => {
  const { lib } = make([{ id: 'r', hu: 'R', kind: 'rss', url: base + '/redir' }], { allowHosts: ['127.0.0.1'] });
  const before = hits;
  const r = await rec(lib, 'r');
  assert.strictEqual(hits, before + 1);
  assert.match(r.error, /átirányít/);
});

test('search: opens the saved search, no fetch', async () => {
  const before = hits;
  const { lib } = make([{ id: 's', hu: 'S', kind: 'search', provider: 'google', q: 'demo words' }]);
  const r = await rec(lib, 's');
  assert.strictEqual(r.items[0].hu, 'demo words');
  assert.strictEqual(r.items[0].open, true);
  assert.strictEqual(lib.resolveOpen('s', 0).target, 'srch:google:demo words');
  assert.strictEqual(hits, before);
});

test('every: 5 is clamped to 15; unknown kind refused; user file merges', () => {
  assert.strictEqual(validate({ id: 'x', kind: 'ports', every: 5 }).every, 15);
  assert.strictEqual(validate({ id: 'x', kind: 'ports', every: 45 }).every, 45);
  assert.strictEqual(validate({ id: 'x', kind: 'nope' }).err, 'unknown kind: nope');
  assert.ok(validate({ id: '../x', kind: 'ports' }).err);
  assert.ok(validate({ id: 'x', kind: 'rss', url: 'javascript:alert(1)' }).err);
  const dir = path.join(TMP, 'u'); fs.mkdirSync(dir, { recursive: true });
  const user = { presets: [{ id: 'mine', hu: 'Mine', kind: 'ports', every: 5 }, { id: 'bad', kind: 'weird' }] };
  const { lib } = make([{ id: 'ports', hu: 'P', kind: 'ports' }], { userFile: () => user });
  const l = lib.load();
  assert.deepStrictEqual(l.presets.map(p => p.id), ['ports', 'mine']);
  assert.strictEqual(l.presets[1].every, 15);
  assert.deepStrictEqual(l.rejected, [{ id: 'bad', err: 'unknown kind: weird' }]);
  assert.strictEqual(lib.list().presets.find(p => p.id === 'mine').every, 15);
});

test('the shipped config/presets.json is valid and has the six presets, allowHosts empty', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'presets.json'), 'utf8'));
  assert.deepStrictEqual(j.allowHosts, []);
  assert.deepStrictEqual(j.presets.map(p => p.id), ['drift', 'git', 'ports', 'waiting', 'inbox', 'rss-example']);
  for (const p of j.presets) assert.strictEqual(validate(p).err, undefined, p.id);
  assert.strictEqual(validate(j.presets[5]).enabled, false);
});

test('cache round-trip across instances; run() is a job; a disabled preset does not run', async () => {
  const { lib, jobs, dir, cfg } = make([{ id: 'ports', hu: 'P', kind: 'ports' }, { id: 'off', hu: 'O', kind: 'ports', enabled: false }], { sources: { ports: () => [{ id: 'demo', name: 'Demo', port: 1, up: false }] } });
  const r = lib.run('ports');
  assert.strictEqual(r.ok, true);
  await jobs.whenDone(r.job);
  assert.strictEqual(jobs.get(r.job).state, 'done');
  assert.strictEqual(jobs.get(r.job).kind, 'feed');
  assert.strictEqual(lib.run('off').err, 'disabled');
  assert.strictEqual(lib.run('nope').err, 'not-found');
  const again = createPresets({ jobs, configFile: cfg, cacheFile: path.join(dir, 'cache', 'presets.json') });
  const res = again.results().results;
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].pre, 'ports');
  assert.strictEqual(res[0].items[0].hu, 'Demo');
  assert.ok(Number.isFinite(res[0].at));
});

test('feed.open: a javascript: link is refused, an http link resolves; links never reach the page', async () => {
  const { lib } = make([{ id: 'r', hu: 'R', kind: 'rss', url: base + '/rss.xml' }], { allowHosts: ['127.0.0.1'] });
  await lib.exec('r');
  const pageItems = lib.results().results[0].items;
  assert.deepStrictEqual(Object.keys(pageItems[0]).sort(), ['detail', 'hu', 'open']);   // no link field
  assert.deepStrictEqual(lib.resolveOpen('r', 0), { ok: true, target: 'http://127.0.0.1/a' });
  const bad = lib.resolveOpen('r', 2);                                                   // javascript:alert(1)
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.err, 'bad-request');
  assert.strictEqual(lib.resolveOpen('r', 50).err, 'not-found');
  assert.strictEqual(lib.resolveOpen('nope', 0).err, 'not-found');
  const { lib: l2 } = make([{ id: 'a', hu: 'A', kind: 'atom', url: base + '/atom.xml' }], { allowHosts: ['127.0.0.1'] });
  await l2.exec('a');
  assert.strictEqual(l2.resolveOpen('a', 1).ok, false);                                  // atom entry with a javascript: href
});

test('scheduler: runs due presets only, skips a busy one', async () => {
  let t = 1000000;
  let calls = 0;
  const sources = { ports: () => { calls++; return []; } };
  const { lib, jobs } = make([{ id: 'p', hu: 'P', kind: 'ports', every: 30 }, { id: 'n', hu: 'N', kind: 'ports' }], { sources, now: () => t });
  assert.deepStrictEqual(lib.tick(), ['p']);                              // never ran → due; 'n' has no every
  await jobs.whenDone(jobs.list()[0].job);
  assert.strictEqual(calls, 1);
  t += 10 * 60000;
  assert.deepStrictEqual(lib.tick(), []);                                 // 10 min < 30
  t += 25 * 60000;
  assert.deepStrictEqual(lib.tick(), ['p']);
  assert.strictEqual(lib.isBusy('p'), true);
  assert.strictEqual(lib.run('p').err, 'busy');                           // the job is queued/running: a second run is refused
  assert.deepStrictEqual(lib.tick(), []);                                 // and the scheduler skips it
  await jobs.whenDone(jobs.list().pop().job);
  assert.strictEqual(lib.isBusy('p'), false);
  assert.strictEqual(calls, 2);
});

test('palette hooks: pre:<id> items for enabled presets only', () => {
  const { lib } = make([{ id: 'ports', hu: 'Helyi', kind: 'ports' }, { id: 'off', hu: 'Off', kind: 'ports', enabled: false }]);
  bind(lib);
  assert.deepStrictEqual(paletteItems().map(i => i.id), ['pre:ports']);
  bind(null);
  assert.deepStrictEqual(paletteItems(), []);
});

test('textify: drops script/style/nav/footer, keeps headings and paragraphs, collapses whitespace', () => {
  const html = fx('page.html');
  assert.strictEqual(title(html), 'Demo page');
  assert.strictEqual(textify(html), 'Main heading\nFirst paragraph with bold text & an entity.\nSecond paragraph.');
  assert.strictEqual(textify('<div>a<script>x</script>  b</div><!-- c --><p>&#65;&lt;</p>'), 'a b\nA<');
  assert.strictEqual(textify(null), '');
});
