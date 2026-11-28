// VRG Stack — Függőségek, the import graph inside C (lib/imports.js, ROADMAP 2.8). Run:  node --test test/imports.test.js
// On the repo: known imports are found, the folders that lean on each other get a 'depends' edge, nothing is broken.
// On invented files: each kind of import, what counts as broken and what does not, cycles.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const I = require('../lib/imports');

const ROOT = path.join(__dirname, '..', '..');
// tracked files and new ones not yet committed (a fresh lib file is required before it is committed)
const files = cp.execFileSync('git', ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
const ignored = ps => { let o = ''; try { o = cp.execFileSync('git', ['-C', ROOT, 'check-ignore', '--stdin'], { input: ps.join('\n'), encoding: 'utf8' }); } catch (e) { o = e.stdout || ''; } return new Set(o.split('\n').filter(Boolean)); };
const S = I.scan(files, read, { ignored });
const has = (a, b, how) => S.edges.some(e => e[0] === a && e[1] === b && (!how || e[2] === how));

test('the repo: requires, script tags and imports are found; the repo has no broken import', () => {
  assert.ok(has('Stack/test/entry.test.js', 'Stack/lib/entry.js', 'require'), 'require(\'../lib/entry\') → the .js file');
  assert.ok(has('Stack/viewer.html', 'Stack/lib/live.js', 'script'), 'a <script src>');
  assert.ok(has('Stack/board.html', 'shared/melyviz.css', 'link'), 'a stylesheet <link>');
  assert.ok(S.edges.length > 500);
  assert.deepEqual(S.broken, [], 'every relative import in the repo lands on a tracked file');
  const L = I.layer(S, new Set(['Stack', 'Stack/lib', 'Stack/test', 'shared']));
  assert.ok(L.nodes.find(n => n.id === 'C:Stack/lib/entry.js').extra.in >= 2);
  assert.ok(L.edges.some(e => e.a === 'C:Stack/test' && e.b === 'C:Stack/lib' && e.rel === 'depends' && e.w > 10), 'the tests lean on lib');
  assert.ok(L.edges.some(e => e.a === 'C:Stack/lib' && e.b === 'C:Stack/lib/entry.js' && e.rel === 'contains'));
});

test('invented files: each kind of import; broken only when it is a statement and nothing excuses it', () => {
  const F = {
    'a/app.js': "const x = require('./lib');\nimport y from '../b/y.mjs';\nconst cfg = require(path.join(__dirname, '..', 'b', 'cfg.js'));\nconst gone = require('./gone');\nconst fs = require('fs');\n",
    'a/lib/index.js': "module.exports = 1;\n",
    'a/test.js': "const cases = [\"import z from './fixture.js'\", \"require('./nope')\"];\nawait page.evaluate(() => import('./js/in-browser.js'));\n",
    'b/y.mjs': "export const y = 1;\n", 'b/cfg.js': "require('../a/app.js');\n",
    'b/page.html': '<script src="y.mjs"></script><script src="../out/gen.js"></script><script src="https://cdn.example/x.js"></script><link rel="stylesheet" href="s.css">',
    'b/s.css': "@import 'missing.css';\n",
    'c/run.ps1': '. "$PSScriptRoot\\lib.ps1"\n', 'c/lib.ps1': '',
    'c/sketch.ino': '#include "USB.h"\n#include "pins.h"\n', 'c/pins.h': '',
    'd/page.html': '<script src="generated-data.js"></script>',
  };
  const R = I.scan(Object.keys(F), f => F[f], { ignored: ps => new Set(ps.filter(p => p === 'd/generated-data.js')) });
  const e = (a, b) => R.edges.some(x => x[0] === a && x[1] === b);
  assert.ok(e('a/app.js', 'a/lib/index.js'), 'a folder with an index.js');
  assert.ok(e('a/app.js', 'b/y.mjs') && e('a/app.js', 'b/cfg.js'), 'an ES import and a path.join require');
  assert.ok(e('b/page.html', 'b/y.mjs') && e('b/page.html', 'b/s.css'), 'a sibling script and a stylesheet');
  assert.ok(e('c/run.ps1', 'c/lib.ps1') && e('c/sketch.ino', 'c/pins.h'));
  assert.deepEqual(R.broken.map(b => b.slice(0, 2)).sort(), [['a/app.js', './gone'], ['b/s.css', 'missing.css']],
    'not: a package, a fixture string, an import run in a browser, out/, a URL, a library header, a git-ignored file');
  const L = I.layer(R, new Set(['a', 'b', 'c']));
  assert.equal(L.nodes.find(n => n.id === 'C:a/app.js').state, 'broken import');
  assert.deepEqual(I.cycles(R.edges), [['a/app.js', 'b/cfg.js']], 'app requires cfg, cfg requires app');
});

test('signals: a broken import is red, a cycle amber', () => {
  const SG = require('../lib/signals');
  const nodes = [{ id: 'C:a/app.js', layer: 'C', kind: 'file', title: 'a/app.js', state: 'broken import', extra: { path: 'a/app.js', broken: 1 } }, { id: 'C:b/cfg.js', layer: 'C', kind: 'file', title: 'b/cfg.js', extra: { path: 'b/cfg.js', broken: 0 } }];
  const edges = [{ a: 'C:a/app.js', b: 'C:b/cfg.js', rel: 'imports' }, { a: 'C:b/cfg.js', b: 'C:a/app.js', rel: 'imports' }];
  const J = SG.detect({ nodes: new Map(nodes.map(n => [n.id, n])), edges });
  assert.equal(J.nodes.find(n => n.id === 'J:import-broken.a/app.js').state, 'red');
  assert.equal(J.nodes.find(n => n.kind === 'import-cycle').state, 'amber');
});
