#!/usr/bin/env node
/* ==========================================================================
   manifest.js — Varler pendrive állapotjelentés
   --------------------------------------------------------------------------
   Végigjárja a stick-et és egyetlen markdown fájlba írja, mi hol van:
   méret, rövid hash, módosítás dátuma, és a src/ modulok fejléc-sora.

   Ezt a fájlt kell beilleszteni egy beszélgetés elejére — abból pontosan
   látszik a fa aktuális állapota, anélkül hogy bármit fel kellene tölteni.
   A hash mutatja, mi változott a legutóbbi manifest óta.

   HOVA:   projects/varler-planner/tools/manifest.js
   FUTTAT: node tools/manifest.js            (a repóból)
           node tools/manifest.js E:\        (más gyökérrel)
   KIMENET: <root>/docs/MANIFEST.md   — és a konzolra is
   ========================================================================== */

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* --- mit hagyunk ki teljesen ------------------------------------------- */
const SKIP_DIR = new Set(['node_modules', '.git', '.npm-cache', '__pycache__', '.vscode-test']);
/* --- amit csak egy összefoglaló sorral említünk, tartalom nélkül -------- */
const SUMMARIZE = ['apps'];
/* --- amit nem hashelünk (túl nagy) -------------------------------------- */
const MAX_HASH = 25 * 1024 * 1024;

const ROOT = path.resolve(process.argv[2] || findRoot());

function findRoot() {
  // tools/ alól indítva: felmegyünk a stick gyökeréig (ahol a START.cmd van)
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'START.cmd'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return process.cwd();
}

function hashOf(file, size) {
  if (size > MAX_HASH) return '(nagy)';
  try {
    const h = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
    return h.slice(0, 8);
  } catch (e) { return '(?)'; }
}

function human(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' kB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function day(d) { return new Date(d).toISOString().slice(0, 10); }

// első értelmes sor a fájl fejlécéből — így látszik, mi a modul dolga
function headline(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8').slice(0, 2000);
    for (const raw of txt.split(/\r?\n/).slice(0, 12)) {
      const s = raw.replace(/^[\s/*#!<-]+/, '').replace(/[*/-]+$/, '').trim();
      if (s.length > 12 && !/^(use strict|@|\{|import|const|function|var|let)/.test(s))
        return s.slice(0, 90);
    }
  } catch (e) { }
  return '';
}

const rows = [];
const lines = [];

function walk(dir, rel, depth) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }

  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));

  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;

    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) {
        lines.push('  '.repeat(depth) + e.name + '/    (kihagyva)');
        continue;
      }
      if (SUMMARIZE.includes(r)) {
        lines.push('  '.repeat(depth) + e.name + '/');
        let subs = [];
        try { subs = fs.readdirSync(abs, { withFileTypes: true }).filter(d => d.isDirectory()); }
        catch (x) { }
        subs.forEach(s => lines.push('  '.repeat(depth + 1) + s.name + '/    (hordozható program)'));
        continue;
      }
      lines.push('  '.repeat(depth) + e.name + '/');
      walk(abs, r, depth + 1);
      continue;
    }

    let st;
    try { st = fs.statSync(abs); } catch (x) { continue; }
    lines.push('  '.repeat(depth) + e.name + '    ' + human(st.size));
    rows.push({
      rel: r,
      size: st.size,
      mtime: st.mtimeMs,
      hash: hashOf(abs, st.size),
      note: /\.(js|html|md|json|cmd)$/i.test(e.name) && st.size < 400000 ? headline(abs) : ''
    });
  }
}

/* --- futtatás ------------------------------------------------------------ */
lines.push(path.basename(ROOT) + '/');
walk(ROOT, '', 1);

const totalBytes = rows.reduce((s, r) => s + r.size, 0);
const newest = rows.slice().sort((a, b) => b.mtime - a.mtime).slice(0, 8);

const out = [];
out.push('# Varler pendrive — állapot');
out.push('');
out.push('Készült: ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
out.push('Gyökér: `' + ROOT + '`  ·  ' + rows.length + ' fájl  ·  ' + human(totalBytes));
out.push('Node: ' + process.version);
out.push('');
out.push('## Fa');
out.push('');
out.push('```');
out.push(...lines);
out.push('```');
out.push('');
out.push('## Legutóbb módosítva');
out.push('');
newest.forEach(r => out.push('- `' + r.rel + '` — ' + day(r.mtime) + ' · ' + r.hash));
out.push('');
out.push('## Fájlok');
out.push('');
out.push('| fájl | méret | módosítva | hash | mi ez |');
out.push('|---|---|---|---|---|');
rows.forEach(r => out.push('| `' + r.rel + '` | ' + human(r.size) + ' | ' + day(r.mtime) +
  ' | `' + r.hash + '` | ' + (r.note || '') + ' |'));
out.push('');

const text = out.join('\n');
const dest = path.join(ROOT, 'projects', 'varler-planner', 'docs');
const target = fs.existsSync(dest) ? path.join(dest, 'MANIFEST.md') : path.join(ROOT, 'MANIFEST.md');
fs.writeFileSync(target, text, 'utf8');

console.log(text);
console.log('\n--> ' + target);
