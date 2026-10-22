#!/usr/bin/env node
// ---------------------------------------------------------------------------
// anonymise.js — swap client job codes for neutral ones in the tracked tree.
//
// HUB-Q10 = B / Q10b = A (2026-10-21): before a colleague is invited, the
// client job codes leave the tracked files and file names. Varler Group is
// our own name and stays. History is NOT rewritten — see DECISIONS.md.
//
// The mapping is deliberately not in this file: a script that spells out
// "<code> -> neutral" would itself be the leak. It lives in
//   tools/anonymise.map.json            (gitignored; copy the .example)
//
//   node tools/anonymise.js             dry run: what would change
//   node tools/anonymise.js --apply     rewrite contents + git mv the paths
//
// A match is skipped when it is preceded by a letter (gitInv4, base64),
// followed by a digit (a longer number) or sits inside a base64-looking run.
// Every replacement must be identifier-safe ([A-Za-z0-9_]): the codes live in
// JS names, file names and in data the app builds file names from, so one
// form everywhere is the only one that round-trips. Paths go through the
// same function, so a file and the strings that reference it stay identical.
//
// With --apply, untracked paths on disk that carry a code (the gitignored
// client folders) are renamed too, so the rewritten references still resolve.
//
// .gitignore lines that change are kept in their old form too, so an
// ignored folder still on disk under its old name stays ignored.
//
// Exit code 1 if anything that should have been replaced is left over.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const MAP_FILE = path.join(__dirname, 'anonymise.map.json');
const APPLY = process.argv.includes('--apply');

/* Files whose content is never rewritten (they still get renamed if needed). */
const SKIP_CONTENT = [/\.(png|jpe?g|gif|ico|pdf|woff2?|ttf|zip|7z|exe|dll|bak)$/i, /\.sxe$/i];
const BASE64_RUN = 32;

if (!fs.existsSync(MAP_FILE)) {
  console.error('No ' + path.relative(REPO, MAP_FILE) + ' - copy anonymise.map.example.json and fill it in.');
  process.exit(2);
}
const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

/* Each code also gets its lower-case twin; longer codes first so a short one
   never eats part of a longer one. */
const CODES = [];
for (const c of MAP.codes) {
  CODES.push(c);
  if (c.from.toLowerCase() !== c.from) {
    CODES.push({ from: c.from.toLowerCase(), to: c.to.toLowerCase() });
  }
}
for (const c of CODES) {
  if (!/^[A-Za-z0-9_]+$/.test(c.to)) { console.error('Not identifier-safe: ' + c.to); process.exit(2); }
}
CODES.sort((a, b) => b.from.length - a.from.length);
const CODE_RE = new RegExp(CODES.map(c => c.from).join('|'), 'g');
const BY_FROM = Object.fromEntries(CODES.map(c => [c.from, c]));

const isLetter = ch => /[A-Za-z]/.test(ch || '');
const isB64 = ch => /[A-Za-z0-9+/=]/.test(ch || '');

function base64Around(s, i, len) {
  let a = i, b = i + len;
  while (a > 0 && isB64(s[a - 1])) a--;
  while (b < s.length && isB64(s[b])) b++;
  return b - a >= BASE64_RUN;
}

/* Returns [newText, replacedCount]. */
function swap(s) {
  let n = 0;
  for (const l of MAP.literals || []) {
    const parts = s.split(l.from);
    if (parts.length > 1) { n += parts.length - 1; s = parts.join(l.to); }
  }
  s = s.replace(CODE_RE, (m, i, str) => {
    const prev = str[i - 1], next = str[i + m.length];
    if (isLetter(prev) || /[0-9]/.test(next || '')) return m;
    if (base64Around(str, i, m.length)) return m;
    n++;
    return BY_FROM[m].to;
  });
  return [s, n];
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
}

const files = git(['ls-files', '-z']).split('\0').filter(Boolean)
  .filter(f => f !== 'tools/anonymise.map.example.json');

let contentFiles = 0, contentHits = 0;
const renames = [];

for (const f of files) {
  const abs = path.join(REPO, f);
  if (!fs.existsSync(abs)) continue;

  if (!SKIP_CONTENT.some(re => re.test(f))) {
    const buf = fs.readFileSync(abs);
    if (!buf.includes(0)) {
      const text = buf.toString('utf8');
      let [out, n] = swap(text);
      if (f === '.gitignore') {
        // comments are swapped; a pattern line stays and gains its swapped twin once,
        // so an ignored folder still on disk under its old name stays ignored
        const lines = text.split('\n'), have = new Set(lines);
        n = 0;
        out = lines.map(line => {
          const [t, k] = swap(line);
          if (!k) return line;
          if (line.startsWith('#')) { n += k; return t; }
          if (have.has(t)) return line;
          have.add(t); n += k;
          return line + '\n' + t;
        }).join('\n');
      }
      if (n) {
        contentFiles++; contentHits += n;
        console.log('  ' + String(n).padStart(4) + '  ' + f);
        if (APPLY) fs.writeFileSync(abs, out);
      }
    }
  }

  const [to, pn] = swap(f);
  if (pn) renames.push([f, to]);
}

console.log('\nContent: ' + contentHits + ' replacements in ' + contentFiles + ' files');
console.log('Paths:   ' + renames.length + ' renames');
for (const [a, b] of renames) {
  console.log('  ' + a + '\n    -> ' + b);
  if (APPLY) {
    fs.mkdirSync(path.dirname(path.join(REPO, b)), { recursive: true });
    git(['mv', a, b]);
  }
}

/* Untracked and ignored paths on disk, outermost match only. */
const others = git(['ls-files', '-o', '--directory', '-z']).split('\0')
  .concat(git(['ls-files', '-o', '-i', '--exclude-standard', '--directory', '-z']).split('\0'))
  .filter(Boolean).map(p => p.replace(/\/$/, ''));
const diskRenames = [...new Set(others)].map(p => [p, swap(p)]).filter(([, [, n]]) => n)
  .map(([p, [to]]) => [p, to]);
console.log('On disk, not tracked: ' + diskRenames.length + ' renames');
for (const [a, b] of diskRenames) {
  console.log('  ' + a + '\n    -> ' + b);
  if (APPLY) {
    if (fs.existsSync(path.join(REPO, b))) { console.error('  target exists, left alone: ' + b); continue; }
    fs.mkdirSync(path.dirname(path.join(REPO, b)), { recursive: true });
    fs.renameSync(path.join(REPO, a), path.join(REPO, b));
  }
}

if (!APPLY) {
  console.log('\nDry run. Nothing changed. Run with --apply to rewrite.');
  process.exit(0);
}

/* What is left: the same rules over the rewritten tree must find nothing. */
const left = git(['ls-files', '-z']).split('\0').filter(Boolean).filter(f => {
  if (swap(f)[1]) return true;
  const abs = path.join(REPO, f);
  if (f === '.gitignore' || SKIP_CONTENT.some(re => re.test(f)) || !fs.existsSync(abs)) return false;
  const buf = fs.readFileSync(abs);
  return !buf.includes(0) && swap(buf.toString('utf8'))[1] > 0;
});
if (left.length) {
  console.log('\nLeft over (check by hand):');
  left.forEach(f => console.log('  ' + f));
  process.exit(1);
}
console.log('\nApplied. No leftovers.');
