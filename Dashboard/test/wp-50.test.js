// WP-50: Munkamenetek — the local Claude Code sessions of A and B (shell/lib/sessions.js) and the pane's helpers (page/panes/sessions.js).
//  - list(): both roots, newest first, the title / folder name / branch from the first lines, live = written in the last 2 minutes,
//    other files and empty transcripts left out, no path in the reply;
//  - resume(): --resume <id> in the transcript's own folder, --fork-session for Másolat, /remote-control as the first prompt, a live
//    session refused unless forked, a vanished folder refused, bad accounts / ids refused before the disk is touched;
//  - teleport() in the repo, canvas() through the server callback at #s=<id>;
//  - the pane kind is registered everywhere a kind is listed, the catalog item opens it, the IPC channels check their payloads.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createSessions, rootsFrom, headInfo, folderName, SESSION_RE, LIVE_MS, CLOUD_URL, REMOTE_PROMPT } = require('../shell/lib/sessions.js');
const pane = require('../page/panes/sessions.js');

const DASH = path.resolve(__dirname, '..');
const REPO = path.resolve(DASH, '..');
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-11-24T12:00:00Z');

const line = o => JSON.stringify(o) + '\n';
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp50-'));
  const work = path.join(tmp, 'work', 'Planner_VRG_U100');
  fs.mkdirSync(work, { recursive: true });
  const gone = path.join(tmp, 'work', 'deleted-folder');
  const a = path.join(tmp, 'a'), b = path.join(tmp, 'b');
  const put = (root, proj, id, text, mtime) => {
    const d = path.join(root, 'projects', proj); fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, id + '.jsonl'); fs.writeFileSync(f, text);
    fs.utimesSync(f, new Date(mtime), new Date(mtime));
    return f;
  };
  // A: an older idle session with a <command> line before the real prompt; a live one
  put(a, '-work-Planner', ID1,
    line({ type: 'user', isMeta: true, cwd: work, message: { content: 'meta' } }) +
    line({ type: 'user', cwd: work, gitBranch: 'main', message: { content: '<command-name>/clear</command-name>' } }) +
    line({ type: 'user', cwd: work, gitBranch: 'main', message: { content: [{ type: 'text', text: 'GO   MOBILE\n then build the APK' }] } }),
    NOW - 3 * 3600e3);
  put(a, '-work-Planner', ID2,
    line({ type: 'summary', summary: 'Kapu restore' }) + line({ type: 'user', cwd: work, gitBranch: 'claude/x', message: { content: 'fix the Kapu' } }),
    NOW - 30e3);
  // B: a session whose folder no longer exists; an empty transcript and a stray file that are not sessions
  put(b, '-work-deleted', ID3, line({ type: 'user', cwd: gone, gitBranch: 'HEAD', message: { content: 'old work' } }), NOW - 2 * 86400e3);
  put(b, '-work-deleted', '44444444-4444-4444-8444-444444444444', '', NOW - 10e3);
  fs.writeFileSync(path.join(b, 'projects', '-work-deleted', 'notes.jsonl'), line({ type: 'user', message: { content: 'x' } }));
  return { tmp, work, a, b };
}
function recorder() {
  const calls = [];
  return { calls, claudeterm: { open: o => { calls.push(o); return { term: 't7', title: 'Claude', prof: o.account === 'B' ? 'claude-b' : 'claude-a', account: o.account }; } } };
}

test('headInfo: the first real prompt (no meta, no <command>), else the summary; cwd; branch without HEAD; whitespace collapsed', () => {
  const h = headInfo(line({ type: 'user', isMeta: true, cwd: '/x', message: { content: 'm' } }) + line({ type: 'user', gitBranch: 'HEAD', message: { content: '<c/>' } }) +
    line({ type: 'user', gitBranch: 'dev', message: { content: [{ type: 'tool_result' }, { type: 'text', text: '  hello\n\nworld ' }] } }) + 'not json\n');
  assert.deepStrictEqual(h, { title: 'hello world', cwd: '/x', branch: 'dev' });
  assert.strictEqual(headInfo(line({ type: 'summary', summary: 'Sum' })).title, 'Sum');
  assert.strictEqual(headInfo('x'.repeat(10)).title, '');
  assert.strictEqual(Array.from(headInfo(line({ type: 'user', message: { content: 'é'.repeat(200) } })).title).length, 90);
  assert.strictEqual(folderName('H:\\VRG\\Full\\Planner_VRG_U100'), 'Planner_VRG_U100');
  assert.strictEqual(folderName('/home/u/p/'), 'p');
  assert.ok(SESSION_RE.test(ID1) && !SESSION_RE.test('../' + ID1) && !SESSION_RE.test('ABCDEF01-1111-4111-8111-111111111111') && SESSION_RE.test('abcdef01-1111-4111-8111-111111111111'));
});

test('list: both roots, newest first, titles, folder names, branches, live, no paths', () => {
  const fx = fixture();
  const s = createSessions({ roots: [{ account: 'A', dir: fx.a }, { account: 'B', dir: fx.b }, { account: 'C', dir: fx.a }, { account: 'A', dir: 'relative' }], now: () => NOW });
  const r = s.list();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cloud, CLOUD_URL);
  assert.deepStrictEqual(r.roots, ['A', 'B']);
  assert.deepStrictEqual(r.sessions.map(x => x.session), [ID2, ID1, ID3]);
  const [s2, s1, s3] = r.sessions;
  assert.deepStrictEqual([s1.account, s1.title, s1.project, s1.branch, s1.live], ['A', 'GO MOBILE then build the APK', 'Planner_VRG_U100', 'main', false]);
  assert.deepStrictEqual([s2.title, s2.branch, s2.live], ['fix the Kapu', 'claude/x', true]);
  assert.deepStrictEqual([s3.account, s3.project, s3.branch], ['B', 'deleted-folder', '']);
  const text = JSON.stringify(r);
  assert.ok(!text.includes(fx.tmp) && !/[\\/]projects[\\/]/.test(text), 'a path leaked: ' + text);
  assert.ok(Object.keys(s1).every(k => ['account', 'session', 'title', 'project', 'branch', 'mtime', 'size', 'live'].includes(k)));
  // roots as a function (read on every call); the test override
  let list = [{ account: 'A', dir: fx.a }];
  const lazy = createSessions({ roots: () => list, now: () => NOW });
  assert.strictEqual(lazy.list().sessions.length, 2);
  list = [{ account: 'B', dir: fx.b }];
  assert.deepStrictEqual(lazy.list().sessions.map(x => x.account), ['B']);
  const def = [{ account: 'A', dir: fx.a }];
  assert.deepStrictEqual(rootsFrom({ VRG_SESSIONS_ROOTS: 'A=' + fx.b + ';B=' + fx.a }, def), [{ account: 'A', dir: fx.b }, { account: 'B', dir: fx.a }]);
  for (const bad of [undefined, '', 'A=relative', 'C=' + fx.a, 'nonsense']) assert.strictEqual(rootsFrom({ VRG_SESSIONS_ROOTS: bad }, def), def, String(bad));
  // a missing root is not an error
  assert.deepStrictEqual(createSessions({ roots: [{ account: 'A', dir: path.join(fx.tmp, 'none') }] }).list().sessions, []);
});

test('resume: --resume in the session folder; fork, remote; live refused unless forked; vanished folder and bad input refused', () => {
  const fx = fixture();
  const rec = recorder();
  const s = createSessions({ roots: [{ account: 'A', dir: fx.a }, { account: 'B', dir: fx.b }], claudeterm: rec.claudeterm, now: () => NOW });
  assert.strictEqual(s.resume({ account: 'A', session: ID1 }).term, 't7');
  assert.deepStrictEqual(rec.calls[0], { account: 'A', cwd: fx.work, extraArgs: ['--resume', ID1],
    deco: { origin: 'local', account: 'A', session: ID1, title: 'GO MOBILE then build the APK' } });   // WP-51: the board labels ride along
  assert.ok(require('../shell/lib/sheets.js').validDeco(rec.calls[0].deco));
  s.resume({ account: 'A', session: ID1, fork: true });
  assert.deepStrictEqual(rec.calls[1].extraArgs, ['--resume', ID1, '--fork-session']);
  s.resume({ account: 'A', session: ID1, remote: true });
  assert.deepStrictEqual([rec.calls[2].extraArgs, rec.calls[2].firstPrompt], [['--resume', ID1], REMOTE_PROMPT]);
  // the cascade step: the same session on opus
  s.resume({ account: 'A', session: ID1, stronger: true });
  assert.deepStrictEqual(rec.calls[rec.calls.length - 1].extraArgs, ['--resume', ID1, '--model', 'opus']);
  rec.calls.pop();
  // live: refused without fork, a copy is fine
  assert.strictEqual(s.resume({ account: 'A', session: ID2 }).err, 'live');
  assert.strictEqual(rec.calls.length, 3);
  assert.strictEqual(s.resume({ account: 'A', session: ID2, fork: true }).term, 't7');
  // the folder is gone; the session belongs to the other account; bad ids and accounts
  const g = s.resume({ account: 'B', session: ID3 });
  assert.strictEqual(g.err, 'not-found'); assert.match(g.hu, /deleted-folder/); assert.ok(!g.hu.includes(fx.tmp));
  assert.strictEqual(s.resume({ account: 'B', session: ID1 }).err, 'not-found');
  for (const bad of [{ account: 'C', session: ID1 }, { account: 'A', session: '../' + ID1 }, { account: 'A', session: ID1 + '.jsonl' }, { account: 'A' }, {}])
    assert.strictEqual(s.resume(bad).err, 'bad-request', JSON.stringify(bad));
  assert.strictEqual(rec.calls.length, 4);
  // without a claudeterm
  assert.strictEqual(createSessions({ roots: [{ account: 'A', dir: fx.a }], now: () => NOW }).resume({ account: 'A', session: ID1 }).err, 'error');
  // live ends after LIVE_MS
  const later = createSessions({ roots: [{ account: 'A', dir: fx.a }], claudeterm: rec.claudeterm, now: () => NOW + LIVE_MS });
  assert.strictEqual(later.resume({ account: 'A', session: ID2 }).term, 't7');
});

test('teleport in the repo, canvas through the server callback', async () => {
  const fx = fixture();
  const rec = recorder(), asked = [];
  const s = createSessions({ roots: [{ account: 'A', dir: fx.a }, { account: 'B', dir: fx.b }], claudeterm: rec.claudeterm, repo: fx.work, now: () => NOW,
    server: async (id, p) => { asked.push([id, p]); return { do: 'web', url: 'http://127.0.0.1:8810' + p, server: id }; } });
  assert.strictEqual(s.teleport({ account: 'B' }).term, 't7');
  assert.deepStrictEqual(rec.calls[0], { account: 'B', cwd: fx.work, extraArgs: ['--teleport'], deco: { origin: 'local', account: 'B', title: 'Áthozva a felhőből' } });
  assert.strictEqual(s.teleport({ account: 'X' }).err, 'bad-request');
  assert.strictEqual(createSessions({ claudeterm: rec.claudeterm }).teleport({ account: 'A' }).err, 'error');   // no repo
  const c = await s.canvas({ account: 'B', session: ID3 });
  assert.deepStrictEqual(asked, [['munkavaszon', '/#s=' + ID3]]);
  assert.strictEqual(c.url, 'http://127.0.0.1:8810/#s=' + ID3);
  assert.strictEqual((await s.canvas({ account: 'A', session: ID3 })).err, 'not-found');
  assert.strictEqual((await s.canvas({ account: 'A', session: 'x' })).err, 'bad-request');
});

test('pane helpers: ago, filter, actions, state', () => {
  const h = pane;
  assert.strictEqual(h.ago(NOW - 20e3, NOW), 'most');
  assert.strictEqual(h.ago(NOW - 5 * 60e3, NOW), '5 perce');
  assert.strictEqual(h.ago(NOW - 3 * 3600e3, NOW), '3 órája');
  assert.strictEqual(h.ago(NOW - 30 * 3600e3, NOW), 'tegnap');
  assert.strictEqual(h.ago(NOW - 4 * 86400e3, NOW), '4 napja');
  assert.match(h.ago(NOW - 40 * 86400e3, NOW), /^2026-10-1\d$/);
  assert.strictEqual(h.sizeText(2048), '2 KB'); assert.strictEqual(h.sizeText(3 * 1048576), '3.0 MB'); assert.strictEqual(h.sizeText(10), '1 KB');
  assert.deepStrictEqual(h.cleanState({ account: 'B', q: 'x' }), { account: 'B', q: 'x' });
  assert.deepStrictEqual(h.cleanState({ account: 'Z', q: 5 }), { account: 'all', q: '' });
  assert.deepStrictEqual(h.cleanState(null), { account: 'all', q: '' });
  const rows = [{ account: 'A', session: ID1, title: 'GO MOBILE', project: 'Planner_VRG_U100', branch: 'main' },
    { account: 'B', session: ID3, title: 'Kapu', project: 'x', branch: 'claude/kapu' }];
  assert.deepStrictEqual(h.filterRows(rows, { account: 'all', q: '' }).length, 2);
  assert.deepStrictEqual(h.filterRows(rows, { account: 'B' }).map(r => r.session), [ID3]);
  assert.deepStrictEqual(h.filterRows(rows, { q: 'mobile planner' }).map(r => r.session), [ID1]);
  assert.deepStrictEqual(h.filterRows(rows, { q: '3333' }).map(r => r.session), [ID3]);
  assert.deepStrictEqual(h.filterRows(rows, { q: 'mobile kapu' }), []);
  assert.deepStrictEqual(h.filterRows(null, {}), []);
  assert.deepStrictEqual(h.actionsFor({ live: true }), ['fork', 'canvas']);
  assert.deepStrictEqual(h.actionsFor({ live: false }), ['resume', 'stronger', 'fork', 'remote', 'canvas']);
  assert.strictEqual(h.teleportAccount({ account: 'B' }), 'B'); assert.strictEqual(h.teleportAccount({ account: 'all' }), 'A');
});

test('the kind is registered everywhere, the catalog opens it, the page loads it from panes/', () => {
  assert.ok(require('../shell/lib/layout.js').KINDS.includes('sessions'));
  assert.ok(require('../shell/lib/sheets.js').KINDS.includes('sessions'));
  const src = f => fs.readFileSync(path.join(DASH, f), 'utf8');
  assert.match(src('page/layout.js'), /sessions: 'Munkamenetek'/);
  assert.match(src('page/sheets.js'), /\['sessions', 'Munkamenetek', 'Claude sessions', 'sessions', 'MM'\]/);
  assert.match(src('page/panes/empty.js'), /\['sessions', 'Munkamenetek', 'Claude sessions', 'sessions'\]/);
  assert.match(src('shell/lib/palette.js'), /sessions: \['Munkamenetek/);
  assert.match(src('page/panes.css'), /\[data-pane\]\[data-kind="sessions"\] \{ height: 100%/);
  assert.match(src('shell/preload.js'), /sessions: \{[\s\S]*?call\('sessions', 'resume'/);
  const { KINDS } = require('../shell/lib/layout.js');
  const cat = require('../shell/lib/catalog.js').createCatalog({ file: path.join(REPO, 'launcher', 'vrg-catalog.json'), kinds: KINDS });
  cat.load();
  const it = cat.get('sessions');
  assert.ok(it && it.level === 'dev' && it.parent === 'dev:ai' && it.status === 'beta', JSON.stringify(it));
  assert.deepStrictEqual(cat.resolve('sessions'), { do: 'pane', kind: 'sessions' });
  const errs = require('../shell/lib/catalog.js').validate(JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-catalog.json'), 'utf8')), { C: null, kinds: KINDS });
  assert.deepStrictEqual(errs.filter(e => /sessions/.test(e)), []);
});

test('the Munkavászon opens one session: #s=<uuid> in the page, ?s=<uuid> on /api/sessions', () => {
  const page = fs.readFileSync(path.join(REPO, 'SessionCanvas', 'vrg-munkavaszon.html'), 'utf8');
  assert.match(page, /var wantSession = \(\/\[#&\]s=\(\[0-9a-f-\]\{36\}\)\\b\/\.exec\(location\.hash\)/);
  assert.match(page, /\$\('#followNewest'\)\.checked = false; sel\.value = hit\.file; connect\(hit\.file\)/);
  const srv = fs.readFileSync(path.join(REPO, 'SessionCanvas', 'serve.js'), 'utf8');
  assert.match(srv, /sessions\(want\)/);
});
