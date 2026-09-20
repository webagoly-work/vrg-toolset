// The bundler is the only build step, so its rules are worth pinning down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { SCHEMA_VERSION } from '../src/core/schema.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'vrg-inventory.html');

// bundle.js resolves its own project root from import.meta.url, so a fixture
// build must run the copy that lives inside the fixture.
function build(root) {
  const r = root || ROOT;
  return execFileSync(process.execPath, [path.join(r, 'build', 'bundle.js')],
    { cwd: r, encoding: 'utf8' });
}

test('build produces a self-contained page', () => {
  build();
  const html = fs.readFileSync(DIST, 'utf8');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /id="vrg-data"/);
  assert.doesNotMatch(html, /<script[^>]+src=/, 'no external scripts');
  assert.doesNotMatch(html, /<link[^>]+href=/, 'no external stylesheets');
  assert.doesNotMatch(html, /@import/, 'no CSS imports');
});

test('the page cannot reach the network', () => {
  const html = fs.readFileSync(DIST, 'utf8');
  for (const api of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'EventSource', 'navigator.sendBeacon']) {
    assert.ok(!html.includes(api), `page must not use ${api}`);
  }
  // A URL in the page is only dangerous where the browser would FETCH it. The
  // page legitimately contains plenty of URLs that are just text: vendor
  // product pages and datasheets in the data, the MIT attribution for the QR
  // encoder, an input placeholder. So look at loading positions only.
  const loaders = [
    /\bsrc\s*=\s*["']([^"']+)["']/gi,
    /\bhref\s*=\s*["']([^"']+)["']/gi,
    /\baction\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi,      // CSS
    /@import\s+['"]([^'"]+)['"]/gi
  ];
  const loaded = [];
  for (const re of loaders) for (const m of html.matchAll(re)) loaded.push(m[1]);
  const remote = loaded.filter(u => /^(https?:)?\/\//i.test(u) && !u.startsWith('http://www.w3.org/'));
  assert.deepEqual(remote, [], 'the page would load something remote: ' + remote.join(', '));
});

test('the embedded snapshot is intact and escaped', () => {
  const html = fs.readFileSync(DIST, 'utf8');
  const json = html.slice(html.indexOf('id="vrg-data">') + 14, html.indexOf('</script>', html.indexOf('id="vrg-data"')));
  const doc = JSON.parse(json);
  assert.equal(doc.items.length, 221);
  assert.equal(doc.schema_version, SCHEMA_VERSION);
  assert.doesNotMatch(json, /</, 'every "<" must be escaped so it cannot close the script tag');
});

test('every module ends up in the bundle exactly once', () => {
  const html = fs.readFileSync(DIST, 'utf8');
  for (const id of ['app.js', 'core/schema.js', 'core/store.js', 'core/vendors.js',
    'core/categories.js', 'core/pricing.js', 'core/format.js', 'ui/dom.js']) {
    const hits = html.split(`__defs[${JSON.stringify(id)}]`).length - 1;
    assert.equal(hits, 1, id);
  }
  assert.doesNotMatch(html, /^\s*import\s/m, 'no untransformed import survived');
  assert.doesNotMatch(html, /^\s*export\s/m, 'no untransformed export survived');
});

test('the banned ES subset is rejected at build time, not silently emitted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-bundle-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(path.join(src, 'ui'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
  fs.writeFileSync(path.join(src, 'ui', 'theme.css'), '');
  fs.writeFileSync(path.join(tmp, 'data', 'vrg-inventory.json'), '{"items":[]}');
  fs.cpSync(path.join(ROOT, 'build'), path.join(tmp, 'build'), { recursive: true });

  const cases = [
    ['export default function f() {}', /default export/],
    ["export { a } from './x.js';", /re-export/],
    ["const m = await import('./x.js');", /dynamic import/],
    ['await something();', /top-level await/],
    ["import { a\nfrom './x.js';", /unterminated import\/export brace list/]
  ];
  for (const [code, expected] of cases) {
    fs.writeFileSync(path.join(src, 'app.js'), code + '\n');
    assert.throws(() => build(tmp), expected, code);
  }

  // a cycle must be reported, not hang or half-build
  fs.writeFileSync(path.join(src, 'app.js'), "import { b } from './b.js';\nconst a = b;\n");
  fs.writeFileSync(path.join(src, 'b.js'), "import { a } from './app.js';\nexport const b = a;\n");
  assert.throws(() => build(tmp), /import cycle/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('multi-line import and export lists are joined, not passed through', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-bundle-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(path.join(src, 'ui'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
  fs.writeFileSync(path.join(src, 'ui', 'theme.css'), '');
  fs.writeFileSync(path.join(tmp, 'data', 'vrg-inventory.json'), '{"items":[]}');
  fs.cpSync(path.join(ROOT, 'build'), path.join(tmp, 'build'), { recursive: true });

  fs.writeFileSync(path.join(src, 'lib.js'),
    'const a = 1;\nconst b = 2;\nexport {\n  a,\n  b\n};\n');
  fs.writeFileSync(path.join(src, 'app.js'),
    "import {\n  a,\n  b\n} from './lib.js';\nglobalThis.sum = a + b;\n");

  build(tmp);
  const html = fs.readFileSync(path.join(tmp, 'dist', 'vrg-inventory.html'), 'utf8');
  assert.doesNotMatch(html, /^\s*export\s/m);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.match(html, /Object\.assign\(exports, \{ a, b \}\)/);

  fs.rmSync(tmp, { recursive: true, force: true });
});
