#!/usr/bin/env node
// check-globals.js — the guard for a single-scope codebase.
//
// build.js concatenates src/*.js into ONE <script>, so every top-level name is global.
// A duplicate `function x` does not fail: the later one silently replaces the earlier one
// everywhere. A duplicate `const`/`let` is a SyntaxError that stops the whole app at boot.
// This script catches both before a build is ever opened:
//
//   1. every top-level declaration (function / const / let / var / class) across the modules,
//      in build order — any name declared twice is reported with file:line;
//   2. the concatenated script is compiled with vm.Script — a syntax error is reported.
//
//   node tools/check-globals.js            # exit 1 on a duplicate or a syntax error
//   node tools/check-globals.js --names    # also print every top-level name (for prefix checks)
//   node tools/check-globals.js --prefix lyr,stk   # list the names that use these prefixes
//
// Top-level means "starts at column 0". The modules are written that way; a declaration that is
// indented is inside a block and is not global.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const MODULE_RE = /^\d\d[a-z]?-.*\.js$/;          // the same rule build.js applies
const files = fs.readdirSync(SRC).filter(f => /\.js$/.test(f)).sort().filter(f => MODULE_RE.test(f));

const DECL = [
  /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /^class\s+([A-Za-z_$][\w$]*)/,
  /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
];
// `const a=1,b=2;` — pick up the names after the first one on the same statement line
const MORE = /,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g;

const seen = new Map();   // name -> [{file,line,kind}]
let code = '';
for (const f of files) {
  const txt = fs.readFileSync(path.join(SRC, f), 'utf8');
  code += txt + '\n';
  txt.split(/\r?\n/).forEach((ln, i) => {
    for (const re of DECL) {
      const m = re.exec(ln);
      if (!m) continue;
      const kind = /^(const|let|var)/.test(ln) ? ln.split(/\s/)[0] : (/^class/.test(ln) ? 'class' : 'function');
      const add = n => { if (!seen.has(n)) seen.set(n, []); seen.get(n).push({ file: f, line: i + 1, kind }); };
      add(m[1]);
      // only a plain `const a=…,b=…;` line, not an arrow body or an object literal
      if (kind !== 'function' && kind !== 'class' && !/[{(\[]/.test(ln.slice(0, ln.indexOf('=')))) {
        const head = ln.split(';')[0];
        let mm; MORE.lastIndex = 0;
        while ((mm = MORE.exec(head))) { if (!/[{(\[]/.test(head.slice(0, mm.index))) add(mm[1]); }
      }
      break;
    }
  });
}

let bad = 0;
const dups = [...seen.entries()].filter(([, v]) => v.length > 1);
for (const [name, where] of dups) {
  bad++;
  console.log('DUPLICATE ' + name + ': ' + where.map(w => w.kind + ' ' + w.file + ':' + w.line).join('  |  '));
}

try { new vm.Script(code, { filename: 'concatenated-src.js' }); }
catch (e) {
  bad++;
  // map the line of the concatenated script back to a module
  const m = /concatenated-src\.js:(\d+)/.exec(String(e.stack || ''));
  let where = '';
  if (m) {
    let n = +m[1];
    for (const f of files) {
      const len = fs.readFileSync(path.join(SRC, f), 'utf8').split(/\r?\n/).length;
      if (n <= len) { where = ' (' + f + ':' + n + ')'; break; }
      n -= len;
    }
  }
  console.log('SYNTAX ' + e.message + where);
}

const arg = process.argv.slice(2);
if (arg.includes('--names')) [...seen.keys()].sort().forEach(n => console.log('  ' + n + '  ' + seen.get(n).map(w => w.file).join(',')));
const pi = arg.indexOf('--prefix');
if (pi >= 0 && arg[pi + 1]) {
  const pre = arg[pi + 1].split(',');
  [...seen.keys()].filter(n => pre.some(p => n.startsWith(p))).sort()
    .forEach(n => console.log('  ' + n + '  ' + seen.get(n).map(w => w.file + ':' + w.line).join(',')));
}

console.log(bad ? 'check-globals: ' + bad + ' problem(s) in ' + files.length + ' modules'
                : 'check-globals: OK — ' + seen.size + ' top-level names in ' + files.length + ' modules, no duplicates, compiles');
process.exit(bad ? 1 : 0);
