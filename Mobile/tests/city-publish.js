#!/usr/bin/env node
// city-publish.js — VRG Mobile M5: Mobile/city/publish-city.js against throwaway git repos in %TEMP%\VRG.
//
//   node Mobile/tests/city-publish.js
//
// A bare "origin" plus a working clone with main and a feature branch. Checks the branch-name keys (the
// fixture kit-core's CityTest reads too), a dry run that sends nothing, the first publish creating city-pages
// as one root commit, a second branch added beside it, an unchanged republish, removal, a raced push that the
// lease refuses and the retry that keeps both cities, and that the source branches, HEAD, the index and the
// working tree are never touched. The workflow (.github/workflows/mobile-city.yml) runs this before it publishes.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const P = require('../city/publish-city.js');

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + what); } };
const eq = (a, b, what) => ok(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// ---- keys ------------------------------------------------------------------------------------------------
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'city-keys.json'), 'utf8'));
for (const { branch, key } of fx.pairs) {
  eq(P.key(branch), key, `key(${branch})`);
  eq(P.branchOf(key), branch, `branchOf(${key})`);
  ok(/^[A-Za-z0-9._~-]+$/.test(key) && !key.startsWith('.'), `${key} is one safe URL segment`);
}
for (const k of fx.notKeys) eq(P.branchOf(k), null, `branchOf(${JSON.stringify(k)}) refused`);
ok((() => { try { P.key(''); return false; } catch { return true; } })(), 'an empty branch name is refused');

// ---- a throwaway origin + clone ------------------------------------------------------------------------
const base = path.join(os.tmpdir(), 'VRG', `city-publish-${process.pid}-${Date.now()}`);
fs.mkdirSync(base, { recursive: true });
const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const origin = path.join(base, 'origin.git'), work = path.join(base, 'work');
run(base, 'init', '-q', '--bare', '-b', 'main', origin);
run(base, 'clone', '-q', origin, work);
run(work, 'config', 'user.name', 'Test'); run(work, 'config', 'user.email', 'test@example.invalid');
run(work, 'config', 'commit.gpgsign', 'false');
fs.writeFileSync(path.join(work, 'a.js'), 'console.log(1)\n');
run(work, 'add', '-A'); run(work, 'commit', '-q', '-m', 'one');
run(work, 'push', '-q', 'origin', 'main');
run(work, 'checkout', '-q', '-b', 'claude/m5-city');
fs.writeFileSync(path.join(work, 'b.js'), 'console.log(2)\n');
run(work, 'add', '-A'); run(work, 'commit', '-q', '-m', 'two');
run(work, 'push', '-q', 'origin', 'claude/m5-city');
run(work, 'checkout', '-q', 'main');
fs.writeFileSync(path.join(work, 'dirty.txt'), 'uncommitted\n');   // a dirty working tree must stay dirty

const cityDir = (name, n) => {
  const d = path.join(base, name); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'city.html'), `<!doctype html><title>${name}</title><p>${'x'.repeat(n)}</p>\n`);
  fs.writeFileSync(path.join(d, 'city.json'), JSON.stringify({ kind: 'vrg-codecity', version: 1,
    repo: { name: 'work', head: 'abc1234', branch: name, scannedAt: '2026-11-06T10:00:00.000Z' },
    commits: [[1, 0, -1, 'one', 'abc1234', []]], files: [{ p: 'a.js' }, { p: 'gone.js', gone: true }] }));
  return d;
};
const mainCity = cityDir('main-city', 10), featCity = cityDir('feat-city', 20);
const quiet = [];
const opts = o => ({ repo: work, log: s => quiet.push(s), ...o });

const state = () => ({
  head: run(work, 'rev-parse', 'HEAD'), sym: run(work, 'symbolic-ref', 'HEAD'),
  branches: run(work, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
  status: run(work, 'status', '--porcelain'), originMain: run(origin, 'rev-parse', 'main'),
  originFeat: run(origin, 'rev-parse', 'claude/m5-city'),
});
const before = state();
const pagesTip = () => { try { return run(origin, 'rev-parse', '--verify', '-q', 'refs/heads/city-pages'); } catch { return null; } };
const tree = () => run(origin, 'ls-tree', '-r', '--name-only', 'city-pages').split('\n').filter(Boolean);
const show = p => run(origin, 'show', `city-pages:${p}`);

try {
  // refusals
  ok((() => { try { P.publish(opts({ branch: 'city-pages', from: mainCity })); return false; } catch { return true; } })(), 'city-pages itself is refused');
  ok((() => { try { P.publish(opts({ branch: 'main', from: path.join(base, 'nothing') })); return false; } catch { return true; } })(), 'a missing city is refused');

  // dry run: builds, sends nothing
  const dry = P.publish(opts({ branch: 'main', from: mainCity }));
  ok(dry.changed && !dry.pushed && /^[0-9a-f]{40}$/.test(dry.commit), 'the dry run builds a commit');
  eq(pagesTip(), null, 'the dry run pushed nothing');

  // first publish: city-pages is created as one root commit
  const sha = run(work, 'rev-parse', 'main');
  const one = P.publish(opts({ branch: 'main', from: mainCity, push: true, sha, runUrl: 'https://example.invalid/run/1' }));
  ok(one.pushed && one.attempts === 1, 'main published');
  eq(tree(), ['README.md', 'city/main/city.html', 'city/main/city.json', 'city/main/meta.json'], 'the first tree');
  eq(run(origin, 'rev-list', '--count', 'city-pages'), '1', 'city-pages is one commit');
  eq(run(origin, 'log', '-1', '--format=%P', 'city-pages'), '', 'a root commit (no parent)');
  const m = JSON.parse(show('city/main/meta.json'));
  eq([m.kind, m.branch, m.key, m.sha, m.head, m.commits, m.files, m.run], ['vrg-city-meta', 'main', 'main', sha, 'abc1234', 1, 1, 'https://example.invalid/run/1'], 'meta.json');
  eq(m.htmlBytes, fs.statSync(path.join(mainCity, 'city.html')).size, 'meta.htmlBytes');
  eq(show('city/main/city.html'), fs.readFileSync(path.join(mainCity, 'city.html'), 'utf8').trim(), 'city.html is the scanned page');
  ok(show('README.md').includes('city-pages'), 'README written');

  // a second branch beside it, under its key
  const two = P.publish(opts({ branch: 'claude/m5-city', from: featCity, push: true, sha: run(work, 'rev-parse', 'claude/m5-city') }));
  ok(two.pushed, 'the feature branch published');
  eq(two.branches, ['claude~2fm5-city', 'main'], 'both cities listed');
  eq(tree().filter(p => p.startsWith('city/')).length, 6, 'six city files');
  eq(run(origin, 'rev-list', '--count', 'city-pages'), '1', 'still one commit');

  // the same city again: nothing to push
  const tip = pagesTip();
  const same = P.publish(opts({ branch: 'claude/m5-city', from: featCity, push: true, sha: run(work, 'rev-parse', 'claude/m5-city') }));
  ok(!same.changed && !same.pushed && pagesTip() === tip, 'an unchanged city is not pushed');

  // a race: another publisher moves city-pages between our read and our push
  const otherCity = cityDir('other-city', 30);
  const other = path.join(base, 'other');
  run(base, 'clone', '-q', origin, other);
  let raced = false;
  const r = P.publish(opts({ branch: 'main', from: cityDir('main-city-2', 40), push: true, sha,
    beforePush: attempt => { if (attempt === 1 && !raced) { raced = true; P.publish({ repo: other, branch: 'other', from: otherCity, push: true, sha, log: () => {} }); } } }));
  ok(r.pushed && r.attempts === 2, `the raced push is refused once and retried (attempts ${r.attempts})`);
  eq(tree().filter(p => p.endsWith('meta.json')), ['city/claude~2fm5-city/meta.json', 'city/main/meta.json', 'city/other/meta.json'], 'no city lost in the race');
  ok(show('city/main/city.html').includes('x'.repeat(40)), 'the retry carries the new main city');
  ok(quiet.some(s => /refused/.test(s)), 'the refusal is logged');

  // removal (the branch was deleted)
  const gone = P.publish(opts({ branch: 'claude/m5-city', remove: true, push: true }));
  ok(gone.pushed, 'removal pushed');
  eq(gone.branches, ['main', 'other'], 'the removed city is gone, the others stay');
  ok(!P.publish(opts({ branch: 'claude/m5-city', remove: true, push: true })).changed, 'removing it again changes nothing');

  // the CLI, as the workflow calls it (dry run)
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'city', 'publish-city.js'), '--repo', work, '--branch', 'main', '--from', mainCity],
    { encoding: 'utf8' });
  ok(/dry run, would publish/.test(out), 'the CLI dry run');
  let cliFail = false;
  try { execFileSync(process.execPath, [path.join(__dirname, '..', 'city', 'publish-city.js'), '--repo', work], { stdio: 'pipe' }); } catch (e) { cliFail = e.status === 1; }
  ok(cliFail, 'the CLI exits 1 without --branch');

  // nothing of the source side moved
  const after = state();
  eq(after, before, 'HEAD, local branches, the working tree and origin\'s source branches are untouched');
  // (git push itself records refs/remotes/origin/city-pages, as every push to a named remote does)
  ok(!run(work, 'for-each-ref', '--format=%(refname)').split('\n').some(r => /^refs\/(city-publish\/|heads\/city-pages$)/.test(r)), 'no private ref or local branch is left behind');
  eq(run(work, 'branch', '--list', 'city-pages'), '', 'no local city-pages branch was created');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

console.log(`city-publish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
