#!/usr/bin/env node
// Static checks that need no PowerShell: ASCII-only .ps1, CRLF .cmd, no PS7-only operators outside strings and comments,
// balanced braces per file. A rough guard for machines without pwsh; parse-check.ps1 is the real parser check.
'use strict';
const fs = require('fs'), path = require('path');
const term = path.resolve(__dirname, '..'), kit = path.resolve(term, '..');
let bad = 0;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// Blanks out comments, here-strings and string literals (a small PowerShell scanner) so operators and braces
// inside text are not reported. Keeps newlines so line numbers stay right.
function strip(src) {
  let out = '', i = 0;
  const n = src.length, keepNl = t => t.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '<' && d === '#') { const e = src.indexOf('#>', i + 2); const j = e < 0 ? n : e + 2; out += keepNl(src.slice(i, j)); i = j; continue; }
    if (c === '@' && (d === '"' || d === "'") && /^[ \t]*\r?\n/.test(src.slice(i + 2, i + 4) + src.slice(i + 4, i + 6))) {
      const end = '\n' + d + '@'; const e = src.indexOf(end, i + 2); const j = e < 0 ? n : e + end.length;
      out += '""' + keepNl(src.slice(i + 2, j)); i = j; continue;
    }
    if (c === '#') { const e = src.indexOf('\n', i); const j = e < 0 ? n : e; out += ' '.repeat(j - i); i = j; continue; }
    if (c === "'") { let j = i + 1; while (j < n) { if (src[j] === "'") { if (src[j + 1] === "'") { j += 2; continue; } break; } j++; } out += "''" + keepNl(src.slice(i + 1, j - 1 < i + 1 ? i + 1 : j - 1)); i = j + 1; continue; }
    if (c === '"') { let j = i + 1; while (j < n) { if (src[j] === '`') { j += 2; continue; } if (src[j] === '"') { if (src[j + 1] === '"') { j += 2; continue; } break; } j++; } out += '""' + keepNl(src.slice(i + 1, j - 1 < i + 1 ? i + 1 : j - 1)); i = j + 1; continue; }
    if (c === '`') { out += '  '; i += 2; continue; }
    out += c; i++;
  }
  return out;
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
// every literal text key used by TT / TB / Write-TermBoth exists in both languages of text.json
const text = JSON.parse(fs.readFileSync(path.join(term, 'text.json'), 'utf8'));
for (const f of walk(term).filter(f => f.endsWith('.ps1'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:\bTT|\bTB|Write-TermBoth)\s+\(?'([A-Za-z0-9_-]+)'(?!\s*\+)/g)) {
    for (const lang of ['hu', 'en']) if (!(m[1] in text[lang])) { console.log('TEXT ' + path.relative(kit, f) + ' key ' + m[1] + ' missing in ' + lang); bad++; }
  }
}
console.log(bad ? bad + ' problem(s)' : 'lint: OK');
process.exit(bad ? 1 : 0);
