// WP-31 · Git panel: lib/git.js against a temp repo and a bare remote in %TEMP%\VRG\desk-test-git-*, plus the pane's pure helpers.
// Git is the one from vrg-menu.json paths.git ({full} filled in), else `git` on PATH. No test touches the real repo or its remote.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const cp = require('child_process');
const { createGit, parseStatus, parseWorktrees } = require('../shell/lib/git.js');
const pane = require('../page/panes/git.js');

const FULL = process.env.VRG_FULL || 'H:\\VRG\\Full';
const GIT = (() => { const g = path.join(FULL, 'tools', 'git', 'cmd', 'git.exe'); return fs.existsSync(g) ? g : 'git'; })();
const ROOT = path.join(os.tmpdir(), 'VRG', 'desk-test-git-' + Math.random().toString(36).slice(2, 10));
fs.mkdirSync(ROOT, { recursive: true });
test.after(() => { fs.rmSync(ROOT, { recursive: true, force: true }); });

const ALL_ARGV = [];                                                // every argv any git call got, for the --force spy
const sh = (cwd, ...a) => cp.execFileSync(GIT, a, { cwd, encoding: 'utf8', windowsHide: true }).trim();
let seq = 0;
function mk(extra) {
  const dir = path.join(ROOT, 'w' + (++seq)), work = path.join(dir, 'work'), bare = path.join(dir, 'remote.git');
  fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(bare);
  sh(bare, 'init', '--bare');
  sh(work, 'init'); sh(work, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  for (const [k, v] of [['user.name', 'Demo'], ['user.email', 'demo@example.invalid'], ['commit.gpgsign', 'false']]) sh(work, 'config', k, v);
  sh(work, 'remote', 'add', 'origin', bare);
  for (const f of ['a.txt', 'b.txt', 'c.txt', 'd.txt']) fs.writeFileSync(path.join(work, f), f + ' one\n');
  sh(work, 'add', '.'); sh(work, 'commit', '-m', 'init');
  const calls = [];
  const spy = (file, args, opts, cb) => { ALL_ARGV.push(args); return cp.execFile(file, args, opts, cb); };
  const g = createGit({
    execFile: spy, git: GIT, repos: () => [{ name: 'Demo Repo', path: work }],
    anonymise: async (files, cwd) => { calls.push({ files, cwd }); return { ok: true, out: '' }; },
    ...extra,
  });
  return { work, bare, g, calls, id: 'demo-repo' };
}

test('repos: the id is a slug of the name, the path stays in main', async () => {
  const t = mk();
  assert.deepEqual(t.g.repos(), { ok: true, repos: [{ id: 'demo-repo', name: 'Demo Repo' }] });
  assert.equal((await t.g.status('nope')).err, 'not-found');
});

test('status parses the five states: new, modified, staged, renamed, deleted', async () => {
  const t = mk();
  fs.writeFileSync(path.join(t.work, 'a.txt'), 'a.txt two\n');                     // modified
  fs.rmSync(path.join(t.work, 'b.txt'));                                           // deleted
  sh(t.work, 'mv', 'c.txt', 'c2.txt');                                             // renamed
  fs.writeFileSync(path.join(t.work, 'd.txt'), 'd.txt two\n'); sh(t.work, 'add', 'd.txt');   // staged
  fs.writeFileSync(path.join(t.work, 'n.txt'), 'new\n');                           // new
  const s = await t.g.status(t.id);
  assert.equal(s.ok, true);
  assert.equal(s.checkout, t.work);
  assert.equal(s.branch, 'main');
  assert.equal(s.upstream, '');
  const kinds = Object.fromEntries(s.files.map(f => [f.path, f.kind]));
  assert.deepEqual(kinds, { 'a.txt': 'modified', 'b.txt': 'deleted', 'c2.txt': 'renamed', 'd.txt': 'staged', 'n.txt': 'new' });
  assert.deepEqual(s.files.find(f => f.path === 'n.txt'), { path: 'n.txt', x: '?', y: '?', kind: 'new' });
});

test('parseStatus: header fields and a rename record', () => {
  const out = ['# branch.oid abc', '# branch.head side', '# branch.upstream origin/side', '# branch.ab +2 -1',
    '2 R. N... 100644 100644 100644 h1 h2 R100 new name.txt', 'old name.txt', '? u.txt', ''].join('\0');
  const p = parseStatus(out);
  assert.deepEqual([p.branch, p.upstream, p.ahead, p.behind], ['side', 'origin/side', 2, 1]);
  assert.deepEqual(p.files, [{ path: 'new name.txt', orig: 'old name.txt', x: 'R', y: '.', kind: 'renamed' }, { path: 'u.txt', x: '?', y: '?', kind: 'new' }]);
});

test('fileIx: refused before a status, out of range, negative, not an integer', async () => {
  const t = mk();
  assert.equal((await t.g.diff(t.id, 0)).err, 'bad-request');
  assert.equal((await t.g.commit(t.id, [0], 'x')).err, 'bad-request');
  fs.writeFileSync(path.join(t.work, 'a.txt'), 'a.txt two\n');
  await t.g.status(t.id);
  for (const ix of [1, 5, -1, 1.5, '0', null]) {
    assert.equal((await t.g.diff(t.id, ix)).err, 'bad-request', 'diff ' + ix);
    assert.equal((await t.g.commit(t.id, [ix], 'x')).err, 'bad-request', 'commit ' + ix);
  }
  const d = await t.g.diff(t.id, 0);
  assert.equal(d.ok, true);
  assert.match(d.diff, /^\+a\.txt two$/m);
  assert.match(d.diff, /^-a\.txt one$/m);
});

test('diff of an untracked file shows it as added; cached diff shows the index', async () => {
  const t = mk();
  fs.writeFileSync(path.join(t.work, 'n.txt'), 'hello\n');
  fs.writeFileSync(path.join(t.work, 'd.txt'), 'd.txt two\n'); sh(t.work, 'add', 'd.txt');
  const s = await t.g.status(t.id);
  const ix = p => s.files.findIndex(f => f.path === p);
  assert.match((await t.g.diff(t.id, ix('n.txt'))).diff, /^\+hello$/m);
  assert.match((await t.g.diff(t.id, ix('d.txt'), true)).diff, /^\+d\.txt two$/m);
});

test('branch: bad names refused, a good one created, switch needs a clean tree', async () => {
  const t = mk();
  for (const n of ['Main', '../x', 'a b', 'main', 'master', 'HEAD', 'head', '', 'x'.repeat(61), '-x', 'a..b', 'a/', 'a.lock', 5, null]) {
    const r = await t.g.branch(t.id, n);
    assert.equal(r.ok, false, JSON.stringify(n));
    assert.equal(r.err, 'bad-request', JSON.stringify(n));
  }
  assert.equal(sh(t.work, 'branch', '--list'), '* main');
  const r = await t.g.branch(t.id, 'feat/demo-1');
  assert.deepEqual(r, { ok: true, name: 'feat/demo-1', switched: false });
  assert.equal(sh(t.work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  fs.writeFileSync(path.join(t.work, 'a.txt'), 'dirty\n');
  const dirty = await t.g.branch(t.id, 'feat/demo-2', true);
  assert.equal(dirty.err, 'forbidden');
  assert.equal(sh(t.work, 'branch', '--list', 'feat/demo-2'), '');
  sh(t.work, 'checkout', '--', 'a.txt');
  assert.equal((await t.g.branch(t.id, 'feat/demo-2', true)).switched, true);
  assert.equal(sh(t.work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/demo-2');
  const b = await t.g.branches(t.id);
  assert.deepEqual(b.branches.map(x => [x.name, x.current]).sort(), [['feat/demo-1', false], ['feat/demo-2', true], ['main', false]]);
});

test('commit takes only the chosen files, even when another file is already staged', async () => {
  const t = mk();
  fs.writeFileSync(path.join(t.work, 'a.txt'), 'a two\n');
  fs.writeFileSync(path.join(t.work, 'b.txt'), 'b two\n');
  fs.writeFileSync(path.join(t.work, 'd.txt'), 'd two\n'); sh(t.work, 'add', 'd.txt');
  const s = await t.g.status(t.id);
  const ix = p => s.files.findIndex(f => f.path === p);
  assert.equal((await t.g.commit(t.id, [], 'm')).err, 'bad-request');
  assert.equal((await t.g.commit(t.id, [ix('a.txt')], '   ')).err, 'bad-request');
  const r = await t.g.commit(t.id, [ix('a.txt')], 'change a');
  assert.equal(r.ok, true);
  assert.match(r.sha, /^[0-9a-f]{7,}$/);
  assert.equal(sh(t.work, 'show', '--name-only', '--format=%s', 'HEAD'), 'change a\n\na.txt');
  const after = (await t.g.status(t.id)).files.map(f => f.path + ':' + f.kind).sort();
  assert.deepEqual(after, ['b.txt:modified', 'd.txt:modified']);              // d.txt was staged but not chosen: out of the index, content kept
  const log = await t.g.log(t.id, 5);
  assert.deepEqual(log.log.map(x => x.subject), ['change a', 'init']);
  assert.equal((await t.g.log(t.id, 201)).err, 'bad-request');
});

test('commit of a new file, a deletion and a rename', async () => {
  const t = mk();
  fs.writeFileSync(path.join(t.work, 'n.txt'), 'new\n');
  fs.rmSync(path.join(t.work, 'b.txt'));
  sh(t.work, 'mv', 'c.txt', 'c2.txt');
  const s = await t.g.status(t.id);
  const r = await t.g.commit(t.id, s.files.map((f, i) => i), 'all');
  assert.equal(r.ok, true);
  assert.equal((await t.g.status(t.id)).files.length, 0);
});

test('push: a side branch goes to the bare remote with its name typed back', async () => {
  const t = mk();
  sh(t.work, 'push', 'origin', 'main');                                            // the remote already knows main: only the side work is "unpushed"
  await t.g.branch(t.id, 'side-x', true);
  fs.writeFileSync(path.join(t.work, 'new.txt'), 'x\n');
  await t.g.status(t.id);
  assert.equal((await t.g.commit(t.id, [0], 'side work')).ok, true);
  for (const bad of ['', 'main', 'side-y', 'main PUSH', 5]) assert.equal((await t.g.push(t.id, bad)).err, 'forbidden', JSON.stringify(bad));
  assert.equal(t.calls.length, 0, 'a refused confirmation never reaches the check');
  const r = await t.g.push(t.id, 'side-x');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(t.calls.map(c => c.files), [['new.txt']]);
  assert.equal(sh(t.bare, 'rev-parse', 'refs/heads/side-x'), sh(t.work, 'rev-parse', 'HEAD'));
});

test('push of main: refused without "main PUSH", ok with it', async () => {
  const t = mk();
  for (const bad of ['', 'main', 'MAIN PUSH', 'main push', 'main PUSH ']) {
    const r = await t.g.push(t.id, bad);
    assert.equal(r.err, 'forbidden', JSON.stringify(bad));
  }
  assert.throws(() => sh(t.bare, 'rev-parse', 'refs/heads/main'));
  const r = await t.g.push(t.id, 'main PUSH');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(sh(t.bare, 'rev-parse', 'refs/heads/main'), sh(t.work, 'rev-parse', 'HEAD'));
  assert.deepEqual(t.calls[0].files, ['a.txt', 'b.txt', 'c.txt', 'd.txt']);
});

test('push is refused when the anonymise check says a client code is in the changes', async () => {
  let seen = null;
  const t = mk({ anonymise: async (files, cwd) => { seen = { files, cwd }; return { ok: false, out: 'secret.txt: code' }; } });
  sh(t.work, 'push', 'origin', 'main');
  await t.g.branch(t.id, 'leak', true);
  fs.writeFileSync(path.join(t.work, 'secret.txt'), 'DEMO-CODE\n');
  fs.writeFileSync(path.join(t.work, 'plain.txt'), 'fine\n');
  const s = await t.g.status(t.id);
  assert.equal((await t.g.commit(t.id, s.files.map((f, i) => i), 'add')).ok, true);
  const r = await t.g.push(t.id, 'leak');
  assert.equal(r.ok, false);
  assert.match(r.hu, /^Ügyfélkód a változásokban: nem töltöm fel\./);
  assert.match(r.hu, /secret\.txt: code/);
  assert.deepEqual(seen, { files: ['plain.txt', 'secret.txt'], cwd: t.work });
  assert.throws(() => sh(t.bare, 'rev-parse', 'refs/heads/leak'));
});

test('default check runs `node anonymise.js --check <files>`: exit 1 refuses, exit 0 pushes', async () => {
  const stub = path.join(ROOT, 'anon-stub.js');                                    // stands in for tools/anonymise.js (its map file is gitignored)
  fs.writeFileSync(stub, "const fs=require('fs');const i=process.argv.indexOf('--check');" +
    "const bad=process.argv.slice(i+1).filter(f=>fs.readFileSync(f,'utf8').includes('DEMO-CODE'));" +
    "if(bad.length){console.error('hit: '+bad.length);process.exit(1)}\n");
  const t = mk({ anonymise: undefined, node: process.execPath, anonymiseJs: stub });
  await t.g.branch(t.id, 'chk', true);
  fs.writeFileSync(path.join(t.work, 'x.txt'), 'DEMO-CODE\n');
  await t.g.status(t.id);
  assert.equal((await t.g.commit(t.id, [0], 'x')).ok, true);
  const no = await t.g.push(t.id, 'chk');
  assert.equal(no.ok, false);
  assert.match(no.hu, /Ügyfélkód a változásokban/);
  assert.match(no.hu, /hit: 1/);
  fs.writeFileSync(path.join(t.work, 'x.txt'), 'clean\n');
  await t.g.status(t.id);
  assert.equal((await t.g.commit(t.id, [0], 'y')).ok, true);
  assert.equal((await t.g.push(t.id, 'chk')).ok, true);
  const missing = mk({ anonymise: undefined, node: process.execPath, anonymiseJs: path.join(ROOT, 'nope.js') });
  await missing.g.branch(missing.id, 'chk2', true);
  fs.writeFileSync(path.join(missing.work, 'x.txt'), 'x\n');
  await missing.g.status(missing.id);
  await missing.g.commit(missing.id, [0], 'z');
  assert.equal((await missing.g.push(missing.id, 'chk2')).ok, false, 'a check that cannot run refuses');
});

test('a push that needs credentials runs in the embedded terminal', async () => {
  let opened = null;
  const t = mk({ openTerm: (cwd, args) => { opened = { cwd, args }; return { term: 't1' }; } });
  sh(t.work, 'remote', 'set-url', 'origin', 'http://127.0.0.1:9/none.git');          // nothing listens: the failure is not an auth failure
  await t.g.branch(t.id, 'cred', true);
  const r = await t.g.push(t.id, 'cred');
  assert.equal(r.ok, false);
  assert.equal(opened, null, 'a plain network failure does not open a terminal');
});

test('worktrees: the porcelain list parses', () => {
  const w = parseWorktrees('worktree C:/a\nHEAD 1234567890\nbranch refs/heads/main\n\nworktree C:/b\nHEAD abcdef0123\ndetached\n\nworktree C:/c.git\nbare\n');
  assert.deepEqual(w, [
    { path: 'C:/a', head: '1234567', branch: 'main', bare: false, detached: false },
    { path: 'C:/b', head: 'abcdef0', branch: '', bare: false, detached: true },
    { path: 'C:/c.git', head: '', branch: '', bare: true, detached: false },
  ]);
});

test('worktrees and branches of a real repo', async () => {
  const t = mk();
  const w = await t.g.worktrees(t.id);
  assert.equal(w.worktrees.length, 1);
  assert.equal(w.worktrees[0].branch, 'main');
});

test('pane helpers: diff line classes, push word, desktop-os branches', () => {
  assert.deepEqual(['+a', '-b', '@@ -1 +1 @@', '--- a/x', '+++ b/x', 'diff --git a/x b/x', ' ctx', ''].map(pane.diffClass), ['add', 'del', 'hunk', 'meta', 'meta', 'meta', 'ctx', 'ctx']);
  assert.equal(pane.pushWord('main'), 'main PUSH');
  assert.equal(pane.pushWord('master'), 'main PUSH');
  assert.equal(pane.pushWord('side'), 'side');
  assert.equal(pane.isDesktopBranch('desktop-os/WP-31'), true);
  assert.equal(pane.isDesktopBranch('feat/x'), false);
});

test('no git call anywhere carried --force, -f, --force-with-lease or a +refspec', () => {
  assert.ok(ALL_ARGV.length > 20, 'the spy saw the calls: ' + ALL_ARGV.length);
  assert.ok(ALL_ARGV.some(a => a.includes('push')), 'a push was among them');
  for (const a of ALL_ARGV) for (const x of a) assert.doesNotMatch(String(x), /^(-f|--force.*|\+.*)$/, a.join(' '));
});

test('git runs with an argv array and GIT_TERMINAL_PROMPT=0 only', async () => {
  const seen = [];
  const g = createGit({ execFile: (f, a, o, cb) => { seen.push({ f, a, env: o.env.GIT_TERMINAL_PROMPT }); cb(null, '', ''); }, git: GIT, repos: () => [{ name: 'D', path: ROOT }] });
  const r = await g.status('d');
  assert.equal(r.ok, true);
  assert.deepEqual(seen.map(s => [s.f, s.env]), [[GIT, '0']]);
  assert.ok(Array.isArray(seen[0].a));
});
