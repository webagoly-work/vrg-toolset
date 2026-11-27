// VRG Stack — O · Külső (lib/outside.js, S18). Run:  node --test test/outside.test.js
// On the repo: the vendor manifest, which tracked files use each component, the npm packages, the MCP servers; the
// branch check agrees with the manifest. On a mini-repo: copyleft in copied code, an unknown licence, a lockfile licence.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const O = require('../lib/outside');
const SG = require('../lib/signals');

const ROOT = path.join(__dirname, '..', '..');
const git = (cwd) => a => cp.execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
const files = git(ROOT)(['ls-files']).split('\n').filter(Boolean);
const man = require('../../vendor-manifest.json');
const r = O.read({ repo: ROOT, files, grep: O.grepper(ROOT, git(ROOT)), settings: [require('../../.claude/settings.json')] });
const L = O.layer(r), n = id => L.nodes.find(x => x.id === id);

test('the repo: every manifest component, the files that use it, the npm packages, the MCP servers', () => {
  assert.equal(r.vendor.length, man.components.length);
  assert.ok(n('O:vendor.three').extra.usedBy.includes('CodeCity/build.js'), "path.join(REPO, 'Vendor', 'three') is a use");
  assert.ok(n('O:vendor.pdfjs').extra.docs.includes('CLAUDE.md') && !n('O:vendor.pdfjs').extra.usedBy.includes('CLAUDE.md'), 'a document mentions, code uses');
  assert.equal(n('O:vendor.pdfjs').title, 'pdf.js · Inventory', 'the app it serves, so that pillar takes it in');
  assert.equal(n('O:vendor.pdfjs').extra.refType, 'version');
  assert.ok(n('O:npm.ws') && n('O:npm.ws').extra.usedBy.length >= 1);
  assert.ok(n('O:mcp.vrg-stack'), 'an allowed mcp__vrg-stack__ tool names the server');
  assert.ok(n('O:vendor.paperless-ngx').kind === 'reference');
});

test('checks: a fetched source on a branch (CLAUDE.md wants a tag); referenced GPL code is no copyleft problem', () => {
  const c = O.checks(L.nodes);
  const want = man.components.filter(x => (x.source || 'git') === 'git' && x.vendor === 'fetch' && x.refType !== 'tag').map(x => 'O:vendor.' + x.slug).sort();
  assert.deepEqual(c.branch.map(x => x.id).sort(), want);
  assert.deepEqual(c.copyleft.map(x => x.id), [], 'the GPL / AGPL ones are references: read, never copied');
  assert.ok(c.unknown.some(x => x.id === 'O:vendor.idb-keyval'), 'NOASSERTION is not a licence');
  assert.ok(!c.unknown.some(x => x.id === 'O:vendor.pdfjs'));
  assert.ok(O.licenceOk('MIT OR Apache-2.0') && O.licenceOk('MPL-2.0 OR Apache-2.0') && !O.licenceOk(null) && !O.licenceOk('MIT (npm szerint)'));
});

test('a mini-repo: copied GPL code in use is red; an npm licence comes from the lockfile; mcpServers count', () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-out-'));
  const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(T, rel)), { recursive: true }); fs.writeFileSync(path.join(T, rel), typeof s === 'string' ? s : JSON.stringify(s)); };
  w('vendor-manifest.json', { components: [
    { slug: 'gpl-lib', name: 'GPL lib', repo: 'x/gpl', ref: 'v1.0', refType: 'tag', license: 'GPL-3.0', aspect: 'Planner', vendor: 'fetch', target: 'gpl-lib' },
    { slug: 'dual', name: 'Dual', repo: 'x/dual', ref: 'main', license: 'MPL-2.0 OR Apache-2.0', aspect: 'Térkép', vendor: 'fetch', target: 'dual' }] });
  w('App/app.js', "const g = require('../Vendor/gpl-lib/index.js');\n");
  w('App/package.json', { dependencies: { leftpad: '^1.0.0' } });
  w('App/package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/leftpad': { version: '1.3.0', license: 'WTFPL' } } });
  cp.execFileSync('git', ['init', '-q'], { cwd: T }); cp.execFileSync('git', ['add', '-A'], { cwd: T });
  const f = git(T)(['ls-files']).split('\n').filter(Boolean);
  const x = O.read({ repo: T, files: f, grep: O.grepper(T, git(T)), settings: [{ mcpServers: { 'my-server': {} } }] }), M = O.layer(x);
  assert.deepEqual(x.vendor.find(v => v.slug === 'gpl-lib').usedBy, ['App/app.js']);
  assert.equal(x.npm[0].versions[0], '1.3.0'); assert.equal(x.npm[0].license, 'WTFPL');
  const J = SG.detect({ nodes: new Map(M.nodes.map(y => [y.id, y])) }), st = id => (J.nodes.find(y => y.id === id) || {}).state;
  assert.equal(st('J:copyleft.vendor.gpl-lib'), 'red');
  assert.equal(st('J:vendor-branch.dual'), 'amber'); assert.equal(st('J:copyleft.vendor.dual'), undefined, 'an OR licence lets us choose the permissive one');
  assert.ok(M.nodes.some(y => y.id === 'O:mcp.my-server'));
  fs.rmSync(T, { recursive: true, force: true });
});
