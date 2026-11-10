// WP-35a: the fix-up after night 5 (DESK-Q73…Q96). Fakes only; the real DOMPurify / read view run in selftest/wp-28.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const is = require('../shell/lib/innersearch.js');
const { createGit } = require('../shell/lib/git.js');
const palette = require('../shell/lib/palette.js');
const settings = require('../shell/lib/settings.js');
const mailClean = require('../shell/lib/mailclean.js');

const FULL = path.join('X:', 'Full'), REPO = path.join('X:', 'repo');
function fakeExec(outFor) {
  const calls = [];
  return { calls, execFile: (file, args, opts, cb) => { calls.push({ file, args }); setImmediate(() => cb(null, outFor(args), '')); } };
}

test('Q84 C: inner({ only: "code" }) runs the code index alone, "stack" the stack alone, anything else is refused', async () => {
  const f = fakeExec(args => (String(args[0]).endsWith('stack.js') ? '[]' : '[]'));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  const code = await s.inner({ q: 'kapu', only: 'code' });
  assert.equal(code.only, 'code');
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].args[0].endsWith('vrg-ctx.js'), 'only the code index ran');
  const st = await s.inner({ q: 'kapu', only: 'stack' });
  assert.equal(st.only, 'stack');
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[1].args[0].endsWith('stack.js'), 'only stack.js ran');
  await s.inner({ q: 'kapu' });
  assert.equal(f.calls.length, 4, 'no option: both halves');
  assert.equal((await s.inner({ q: 'kapu', only: 'all' })).err, 'bad-request');
});

test('Q87 C: the default push check passes --map <file> before --check; no map file → no --map (anonymise.js then exits 2 = refused)', async () => {
  const seen = [];
  const exec = (file, args, opts, cb) => { seen.push(args); setImmediate(() => cb(null, '', '')); };
  const mk = map => createGit({ execFile: exec, git: 'git', node: 'NODE', anonymiseJs: 'A.js', anonymiseMap: () => map, repos: () => [] });
  // the check is internal; reach it through the exported helper when there is one, else by its argv in a push (repos are empty here,
  // so drive it directly through the closure the module exposes for tests)
  const g = mk('C:/main/tools/anonymise.map.json');
  assert.equal(typeof g._check, 'function', 'git.js exposes _check for tests');
  await g._check(['a.js', 'b.js'], REPO);
  assert.deepEqual(seen[0], ['A.js', '--map', 'C:/main/tools/anonymise.map.json', '--check', 'a.js', 'b.js']);
  await mk('')._check(['a.js'], REPO);
  assert.deepEqual(seen[1], ['A.js', '--check', 'a.js']);
  await createGit({ execFile: exec, git: 'git', node: 'NODE', anonymiseJs: 'A.js', anonymiseMap: () => { throw new Error('x'); }, repos: () => [] })._check(['a.js'], REPO);
  assert.deepEqual(seen[2], ['A.js', '--check', 'a.js'], 'a throwing map lookup = no map');
});

test('Q74 B / Q90 B / Q93: the palette lists Posta, the Git panel and Munkaterek', () => {
  assert.equal(palette.PANES.mail[0], 'Posta');
  assert.match(palette.PANES.git[0], /^Git/);
  assert.equal(palette.PANES.workspaces[0], 'Munkaterek');
  assert.equal(palette.kindOf('pane:workspaces'), 'pane');
  assert.equal(palette.search([{ id: 'pane:mail', hu: palette.PANES.mail[0], en: palette.PANES.mail[1] }], 'posta', [])[0].id, 'pane:mail');
});

test('Q91 A: ws.openWithLine is a known setting, default true, boolean only', () => {
  const k = settings.KEYS && settings.KEYS['ws.openWithLine'];
  assert.ok(k, 'in KEYS');
  assert.equal(k.def, true);
  assert.equal(k.type(false), true);
  assert.equal(k.type('no'), false);
});

test('Q73 B: the page cleaner never returns a non-string and keeps one forbid list with main', () => {
  assert.equal(require('../shell/lib/mail.js').SANITIZE, mailClean.SANITIZE);
  assert.equal(mailClean.clean({ sanitize: () => '<p>x</p>' }, '<p>x</p>'), '<p>x</p>');
  assert.equal(mailClean.clean(undefined, '<script>1</script>'), '');
});
