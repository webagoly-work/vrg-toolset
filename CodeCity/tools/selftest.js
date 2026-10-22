#!/usr/bin/env node
// selftest.js — scan.js against a throwaway fixture repo with an agent commit, a rename and a delete.
//
//   node CodeCity/tools/selftest.js
//
// The fixture lives in the OS temp folder and is removed afterwards. Exit code 1 on any failure.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodvaros-fx-'));
const g = (...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: dir, encoding: 'utf8' });
const put = (p, s) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) fail++; };

try {
  g('init', '-q', '-b', 'main');
  put('a.js', 'one\ntwo\nthree\n'); put('b.md', '# b\n');
  g('add', '.'); g('commit', '-q', '-m', 'first');
  put('a.js', 'one\ntwo\nthree\nfour\n'); put('c.js', 'x\n');
  g('add', '.'); g('commit', '-q', '-m', 'agent work', '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
  fs.mkdirSync(path.join(dir, 'src')); g('mv', 'a.js', 'src/a2.js'); g('commit', '-q', '-m', 'move');
  g('rm', '-q', 'b.md'); g('commit', '-q', '-m', 'delete');
  put('c.js', "const a = require('./src/a2');\nconst fs = require('fs');\n"); g('add', '.'); g('commit', '-q', '-m', 'import');

  const out = path.join(dir, 'out.city.json');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scan.js'), dir, '--out', out], { stdio: 'ignore' });
  const city = JSON.parse(fs.readFileSync(out, 'utf8'));
  const by = p => city.files.find(f => f.p === p);

  check(city.commits.length === 5, `5 commits (got ${city.commits.length})`);
  check(city.files.length === 3, `3 file identities: a2 (renamed), b (gone), c (got ${city.files.map(f => f.p).join(', ')})`);
  check(!by('a.js'), 'the old name a.js is not a separate building');
  const a = by('src/a2.js');
  check(a && a.n === 3 && a.born === 0 && a.loc === 4, `src/a2.js keeps its history across the rename: n=3 born=0 loc=4 (got n=${a && a.n} born=${a && a.born} loc=${a && a.loc})`);
  const b = by('b.md');
  check(b && b.gone === 1 && b.goneAt === 3, `b.md is a ghost, gone at commit 3 (got gone=${b && b.gone} goneAt=${b && b.goneAt})`);
  const c = by('c.js');
  check(c && c.ag === 1 && c.n === 2, `c.js: 2 commits, 1 agent-assisted (got n=${c && c.n} ag=${c && c.ag})`);
  check(city.agents.join() === 'Claude' && city.commits[1][2] === 0 && city.commits[0][2] === -1, 'only commit 2 is agent-assisted, by Claude');
  check(c && c.imp && c.imp.length === 1 && city.files[c.imp[0]].p === 'src/a2.js', `c.js has one road, to src/a2.js; the package 'fs' is not a road (got ${c && JSON.stringify(c.imp)})`);
  const touched = city.commits[2][5].filter((_, i) => i % 3 === 0).map(i => city.files[i].p);
  check(touched.join() === 'src/a2.js', `the rename commit touches src/a2.js (got ${touched.join()})`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
