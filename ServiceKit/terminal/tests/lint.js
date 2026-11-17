#!/usr/bin/env node
// Static checks that need no PowerShell: ASCII-only .ps1, CRLF .cmd, no PS7-only operators outside strings and comments,
// balanced braces per file. A rough guard for machines without pwsh; parse-check.ps1 is the real parser check.
'use strict';
const fs = require('fs'), path = require('path');
const term = path.resolve(__dirname, '..'), kit = path.resolve(term, '..');
let bad = 0;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// Removes comments, here-strings and string literals so operators inside text are not reported.
function strip(src) {
  let s = src.replace(/<#[\s\S]*?#>/g, '');
  s = s.replace(/@"[\s\S]*?\n"@/g, '""').replace(/@'[\s\S]*?\n'@/g, "''");
  s = s.replace(/'(?:[^']|'')*'/g, "''");
  s = s.replace(/"(?:[^"`]|`.)*"/g, '""');
  s = s.replace(/#.*$/gm, '');
  return s;
}
for (const f of walk(term).filter(f => f.endsWith('.ps1'))) {
  const buf = fs.readFileSync(f), rel = path.relative(kit, f);
  const hi = buf.findIndex(b => b > 127);
  if (hi >= 0) { console.log('ASCII ' + rel + ' byte ' + hi); bad++; }
  const s = strip(buf.toString('utf8'));
  s.split('\n').forEach((line, i) => {
    for (const [re, what] of [[/\?\?/, '??'], [/\?\./, '?.'], [/&&/, '&&'], [/\|\|/, '||'], [/\?\[/, '?[']]) {
      if (re.test(line)) { console.log('PS7 ' + rel + ':' + (i + 1) + ' ' + what + '  ' + line.trim().slice(0, 80)); bad++; }
    }
  });
  let depth = 0; for (const ch of s) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth !== 0) { console.log('BRACES ' + rel + ' unbalanced by ' + depth); bad++; }
  let par = 0; for (const ch of s) { if (ch === '(') par++; else if (ch === ')') par--; }
  if (par !== 0) { console.log('PARENS ' + rel + ' unbalanced by ' + par); bad++; }
}
for (const f of walk(kit).filter(f => f.endsWith('.cmd') && !f.includes(path.sep + 'tools' + path.sep))) {
  const t = fs.readFileSync(f, 'latin1');
  if (/[^\r]\n/.test(t) || /^\n/.test(t)) { console.log('CRLF ' + path.relative(kit, f) + ' has LF-only lines'); bad++; }
}
for (const f of walk(term).filter(f => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log('JSON ' + path.relative(kit, f) + ' ' + e.message); bad++; }
}
console.log(bad ? bad + ' problem(s)' : 'lint: OK');
process.exit(bad ? 1 : 0);
