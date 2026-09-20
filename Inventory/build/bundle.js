// Dependency-free bundler: src/*.js + src/ui/theme.css + data snapshot
// -> dist/vrg-inventory.html, one self-contained file that runs from file://.
//
// Browsers refuse to load ES modules over file://, which is the whole reason
// this exists. Rather than pull in a bundler and an npm tree that will rot,
// we accept a deliberately small ES subset and transform it ourselves:
//
//   allowed   import { a, b as c } from './x.js';
//             import * as ns from './x.js';
//             export function f() {}   export const c = 1;   export class K {}
//             export { a, b };
//   rejected  default exports, re-exports (export … from), dynamic import(),
//             top-level await, import cycles
//
// Brace lists in import/export statements may span lines; they are joined
// before the transform runs. Anything rejected throws at build time with the
// file and line, so the rule is enforced rather than merely documented.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const ENTRY = 'app.js';

const read = p => fs.readFileSync(p, 'utf8');
const rel = p => path.relative(SRC, p).split(path.sep).join('/');

// ------------------------------------------------------------------ checks
const BANNED = [
  [/^\s*export\s+default\b/m, 'default export'],
  [/^\s*export\s+.*\bfrom\b/m, 're-export (export … from)'],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/^\s*await\b/m, 'top-level await']
];

function assertAllowed(file, code) {
  for (const [re, what] of BANNED) {
    const m = re.exec(code);
    if (m) {
      const line = code.slice(0, m.index).split('\n').length;
      throw new Error(`${rel(file)}:${line}: ${what} is not supported by build/bundle.js`);
    }
  }
}

/**
 * Join brace lists in import/export statements onto one line, so the rest of
 * the transform can stay line-based. A statement that opens `{` and has not
 * closed it yet absorbs following lines until `}` appears.
 */
function joinBraceLists(file, code) {
  const src = code.split('\n');
  const out = [];
  for (let i = 0; i < src.length; i++) {
    let line = src[i];
    if (/^\s*(import|export)\s*\{/.test(line) && !line.includes('}')) {
      const start = i;
      while (!line.includes('}')) {
        if (++i >= src.length) {
          throw new Error(`${rel(file)}:${start + 1}: unterminated import/export brace list`);
        }
        line = line.replace(/\s*$/, ' ') + src[i].trim();
      }
    }
    out.push(line.replace(/\s+/g, m => (m.includes('\n') ? ' ' : m)));
  }
  return out.join('\n');
}

// --------------------------------------------------------------- transform
const IMPORT_NAMED = /^\s*import\s*\{([^}]*)\}\s*from\s*['"](.+?)['"]\s*;\s*$/;
const IMPORT_STAR = /^\s*import\s*\*\s*as\s+(\w+)\s+from\s*['"](.+?)['"]\s*;\s*$/;

function transform(file, rawCode) {
  assertAllowed(file, rawCode);
  const code = joinBraceLists(file, rawCode);
  const dir = path.dirname(file);
  const deps = [];
  const exported = new Set();
  const out = [];

  for (const line of code.split('\n')) {
    let m;
    if ((m = IMPORT_NAMED.exec(line))) {
      const id = rel(path.resolve(dir, m[2]));
      deps.push(id);
      const names = m[1].split(',').map(s => s.trim()).filter(Boolean)
        .map(s => { const [a, b] = s.split(/\s+as\s+/); return b ? `${a}: ${b}` : a; });
      out.push(`const { ${names.join(', ')} } = __req(${JSON.stringify(id)});`);
      continue;
    }
    if ((m = IMPORT_STAR.exec(line))) {
      const id = rel(path.resolve(dir, m[2]));
      deps.push(id);
      out.push(`const ${m[1]} = __req(${JSON.stringify(id)});`);
      continue;
    }
    if ((m = /^\s*export\s*\{([^}]*)\}\s*;\s*$/.exec(line))) {
      for (const n of m[1].split(',').map(s => s.trim()).filter(Boolean)) exported.add(n);
      continue;
    }
    if ((m = /^(\s*)export\s+(async\s+)?(function|class|const|let|var)\s+(\w+)/.exec(line))) {
      exported.add(m[4]);
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      continue;
    }
    out.push(line);
  }
  // self-check: nothing module-shaped may survive into the bundle
  for (const [i, line] of out.entries()) {
    if (/^\s*(import|export)\b/.test(line)) {
      throw new Error(`${rel(file)}:${i + 1}: could not transform: ${line.trim()}`);
    }
  }
  if (exported.size) out.push(`Object.assign(exports, { ${[...exported].join(', ')} });`);
  return { code: out.join('\n'), deps, exported: [...exported] };
}

// ------------------------------------------------------------------ graph
const modules = new Map();
const stack = [];

function collect(id) {
  // stack first: a module already in `modules` may still be mid-collection,
  // which is exactly what a cycle looks like
  if (stack.includes(id)) throw new Error('import cycle: ' + [...stack, id].join(' -> '));
  if (modules.has(id)) return;
  const file = path.join(SRC, id);
  if (!fs.existsSync(file)) throw new Error('module not found: ' + id);
  stack.push(id);
  const t = transform(file, read(file));
  modules.set(id, t);                       // set before recursing keeps order stable
  for (const d of t.deps) collect(d);
  stack.pop();
}
collect(ENTRY);

// ------------------------------------------------------------------ output
const data = JSON.parse(read(path.join(ROOT, 'data', 'vrg-inventory.json')));
const css = read(path.join(SRC, 'ui', 'theme.css'));
const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');

const defs = [...modules.entries()].map(([id, m]) =>
  `__defs[${JSON.stringify(id)}] = function (exports, __req) {\n${m.code}\n};`
).join('\n\n');

const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>VRG Készlet</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script type="application/json" id="vrg-data">${safeJson}</script>
<script>
(function () {
  'use strict';
  var __defs = {}, __cache = {};
  function __req(id) {
    if (__cache[id]) return __cache[id].exports;
    var m = __cache[id] = { exports: {} };
    __defs[id](m.exports, __req);
    return m.exports;
  }

${defs}

  __req(${JSON.stringify(ENTRY)});
})();
</script>
</body>
</html>
`;

const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const outFile = path.join(dist, 'vrg-inventory.html');
fs.writeFileSync(outFile, html, 'utf8');

const kb = n => (n / 1024).toFixed(1) + ' kB';
console.log(`bundled ${modules.size} modules, ${data.items.length} items`);
console.log(`  ${[...modules.keys()].join(', ')}`);
console.log(`  data ${kb(safeJson.length)} | css ${kb(css.length)} | total ${kb(html.length)}`);
console.log(`  -> ${path.relative(ROOT, outFile)}`);
