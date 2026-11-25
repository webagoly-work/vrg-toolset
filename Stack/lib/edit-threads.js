// VRG Stack — the write gateway's threads editor (S6 of research/STRINGS-PLAN.md §4): "mark done" on the Füzértábla.
//
//   op = { editor: 'threads', thread: 'mindmap', item: 'Döntésnapló', toBuilt: true, page: 'board' }
//
// takes the item off the thread's not-yet list `t` in notes/devlog/threads.js and (toBuilt) appends its label to the
// thread's built list `d`. threads.js is JavaScript kept by hand, not data, so (§9 of the plan) the editor works on
// well-delimited literals only and proves the result before anything is written:
//   1. the file is run as a module: the row and the item must be there, once
//   2. a small tokenizer (strings, comments, brackets) finds the row object by its `id` literal, its `t` array and the
//      item's own element in it, and the `d` array; nothing is matched inside a string or a comment
//   3. the element is cut out with its comma (its line too, when it stood alone), the label is appended to `d` in the
//      file's own quotes and layout (or `d: [...]` is added before `t:` when the row has none)
//   4. the new file is run again and must equal the old one with exactly that change: the item gone from `t`, the label
//      at the end of `d`, every other value the same. Otherwise nothing is written.
// The rest is the gateway's: the diff shown first, the hash checked at apply, an edit event, never a commit.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

class Refused extends Error { constructor(code, msg) { super(msg); this.code = code; } }

/* ---- run the file the way the build requires it */
function load(src, file) {
  const m = { exports: {} };
  const fn = vm.runInThisContext(`(function (module, exports, require, __filename, __dirname) {${src}\n})`, { filename: file });
  fn(m, m.exports, Module.createRequire(file), file, path.dirname(file));
  return m.exports;
}
const expr = text => { try { return vm.runInNewContext('(' + text + ')', {}, { timeout: 200 }); } catch { return undefined; } };

/* ---- strings, comments, brackets; `code` is the text with every string and comment blanked (positions kept) */
function scan(t) {
  const strings = [], pairs = new Map(), parent = new Map(), stack = [];
  const code = t.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (code[k] !== '\n') code[k] = ' '; };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '/' && t[i + 1] === '/') { const e = t.indexOf('\n', i); const j = e < 0 ? t.length : e; blank(i, j); i = j - 1; continue; }
    if (ch === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); const j = e < 0 ? t.length : e + 2; blank(i, j); i = j - 1; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') {
      let j = i + 1; while (j < t.length && t[j] !== ch) { if (t[j] === '\\') j++; j++; }
      const lit = t.slice(i, j + 1);
      strings.push({ s: i, e: j + 1, q: ch, value: expr(lit) });
      blank(i + 1, j); i = j; continue;
    }
    if ('([{'.includes(ch)) { parent.set(i, stack.length ? stack[stack.length - 1] : -1); stack.push(i); }
    else if (')]}'.includes(ch)) { const o = stack.pop(); if (o === undefined) throw new Refused(500, 'threads.js: unbalanced brackets'); pairs.set(o, i); }
  }
  if (stack.length) throw new Refused(500, 'threads.js: unbalanced brackets');
  return { strings, pairs, parent, code: code.join('') };
}
const enclosing = (S, p) => { let best = -1; for (const [o, c] of S.pairs) if (o < p && p < c && o > best) best = o; return best; };

// a key in an object (the pair opening at `obj`): an identifier or a quoted key, then ':' → { start, after } each
function keyIn(S, t, obj, key) {
  const hits = [];
  const rx = new RegExp(`(^|[{,\\s])${key}\\s*:`, 'g'); let m;
  while ((m = rx.exec(S.code))) { const start = m.index + m[1].length; if (enclosing(S, start) === obj) hits.push({ start, after: m.index + m[0].length }); }
  for (const s of S.strings) if (s.value === key && /^\s*:/.test(S.code.slice(s.e)) && enclosing(S, s.s) === obj) hits.push({ start: s.s, after: s.e + S.code.slice(s.e).indexOf(':') + 1 });
  return hits;
}
// the array right after a key's ':' → its elements [{ s, e, text }] (comments and whitespace around them left out)
function arrayAfter(S, t, at) {
  const o = at + S.code.slice(at).search(/\S/);
  if (t[o] !== '[') return null;
  const c = S.pairs.get(o), els = [];
  let start = o + 1;
  const push = end => { const raw = S.code.slice(start, end); const a = raw.search(/\S/); if (a >= 0) { const b = raw.length - raw.split('').reverse().join('').search(/\S/); els.push({ s: start + a, e: start + b, text: t.slice(start + a, start + b) }); } };
  for (let i = o + 1; i < c; i++) {
    if (S.pairs.has(i)) { i = S.pairs.get(i); continue; }
    if (S.code[i] === ',') { push(i); start = i + 1; }
  }
  push(c);
  return { o, c, els };
}

// a value as text with its keys sorted: where a new key sits in the object does not matter, its value does
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x));
const labelOf = v => { const it = require('./todo').item(v); return it ? it.label : null; };

function plan(op, c) {
  const file = c.threadsFile;
  if (!file) throw new Refused(500, 'no threads.js configured');
  let buf; try { buf = fs.readFileSync(file); } catch { throw new Refused(404, 'threads.js not found: ' + file); }
  const txt = buf.toString('utf8');
  const thread = String(op.thread || ''), label = String(op.item || '');
  if (!thread || !label) throw new Refused(400, 'thread and item are needed');
  let before; try { before = load(txt, file); } catch (e) { throw new Refused(500, 'threads.js does not run: ' + e.message); }
  const rows = ((before && before.AREAS) || []).flatMap(a => a.rows || []);
  const row = rows.filter(r => r.id === thread);
  if (row.length !== 1) throw new Refused(404, `thread ${thread} is ${row.length ? 'there more than once' : 'not'} in threads.js`);
  const ti = (row[0].t || []).map(labelOf).reduce((a, l, i) => (l === label ? a.concat(i) : a), []);
  if (ti.length !== 1) throw new Refused(ti.length ? 409 : 404, ti.length ? `"${label}" is on ${thread}'s list more than once` : `"${label}" is not on ${thread}'s not-yet list (already taken off?)`);

  const S = scan(txt);
  // the row: the object whose `id` key holds the thread's literal
  // (in the blanked code a quoted key 'id' reads as a quote, two spaces, a quote)
  const ids = S.strings.filter(s => s.value === thread && /(?:^|[{,\s])(?:id|(['"]) {2}\1)\s*:\s*$/.test(S.code.slice(Math.max(0, s.s - 60), s.s)));
  if (ids.length !== 1) throw new Refused(500, `the row ${thread} could not be found in the text exactly once`);
  const rowObj = enclosing(S, ids[0].s);
  const tKey = keyIn(S, txt, rowObj, 't');
  if (tKey.length !== 1) throw new Refused(500, `${thread}: its t list could not be found in the text`);
  const tArr = arrayAfter(S, txt, tKey[0].after);
  if (!tArr) throw new Refused(500, `${thread}: t is not a literal list`);
  const hit = tArr.els.map((el, i) => [i, labelOf(expr(el.text))]).filter(([, l]) => l === label);
  if (hit.length !== 1) throw new Refused(500, `"${label}" could not be found in ${thread}'s t list in the text exactly once`);
  const i = hit[0][0], el = tArr.els[i];

  const edits = [];
  // cut the element with its comma; the whole line when it stood alone
  let rs = el.s, re = el.e;
  const after = S.code.slice(re, tArr.c), comma = after.search(/\S/);
  if (comma >= 0 && after[comma] === ',') { re = re + comma + 1; while (txt[re] === ' ' || txt[re] === '\t') re++; }
  else if (i > 0) { const prev = tArr.els[i - 1]; const between = S.code.slice(prev.e, rs); const k = between.lastIndexOf(','); if (k >= 0) rs = prev.e + k; }
  // alone on its line (a comment after it belongs to it): the whole line goes
  const ls = txt.lastIndexOf('\n', rs - 1) + 1, le = txt.indexOf('\n', re);
  if (le >= 0 && S.code.slice(ls, rs).trim() === '' && S.code.slice(re, le).trim() === '') { rs = ls; re = le + 1; }
  edits.push({ s: rs, e: re, put: '' });

  // the label into d, in the file's own quotes and layout
  const toBuilt = op.toBuilt !== false;
  if (toBuilt) {
    const counts = { '\'': 0, '"': 0 }; for (const s of S.strings) if (s.q in counts) counts[s.q]++;
    const q = counts['\''] >= counts['"'] ? '\'' : '"';
    const lit = q + label.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q) + q;
    const dKey = keyIn(S, txt, rowObj, 'd');
    if (dKey.length > 1) throw new Refused(500, `${thread}: two d lists`);
    if (dKey.length === 1) {
      const d = arrayAfter(S, txt, dKey[0].after);
      if (!d) throw new Refused(500, `${thread}: d is not a literal list`);
      if (!d.els.length) edits.push({ s: d.o + 1, e: d.c, put: lit });
      else {
        const last = d.els[d.els.length - 1], tail = S.code.slice(last.e, d.c), trailing = /^\s*,/.test(tail);
        const lineStart = txt.lastIndexOf('\n', last.s - 1) + 1, ownLine = txt.slice(lineStart, last.s).trim() === '' && txt.slice(d.o, last.s).includes('\n');
        const indent = txt.slice(lineStart, last.s);
        const at = trailing ? last.e + tail.indexOf(',') + 1 : last.e;
        edits.push({ s: at, e: at, put: ownLine ? (trailing ? '\n' + indent + lit + ',' : ',\n' + indent + lit) : (trailing ? ' ' + lit + ',' : ', ' + lit) });
      }
    } else {
      edits.push({ s: tKey[0].start, e: tKey[0].start, put: `d: [${lit}], ` });
    }
  }
  let next = txt;
  for (const ed of edits.sort((a, b) => b.s - a.s)) next = next.slice(0, ed.s) + ed.put + next.slice(ed.e);

  // proof: the new file runs, and equals the old one with exactly this change
  let after2; try { after2 = load(next, file); } catch (e) { throw new Refused(500, 'the edited threads.js would not run (' + e.message + '); nothing written'); }
  const want = JSON.parse(JSON.stringify(before));
  const wr = want.AREAS.flatMap(a => a.rows || []).find(r => r.id === thread);
  wr.t.splice(ti[0], 1); if (toBuilt) wr.d = (wr.d || []).concat(label);
  if (canon(after2) !== canon(want)) throw new Refused(500, 'the edit would change more than this item; nothing written');
  return { abs: file, rel: 'notes/devlog/threads.js', buf, next, info: { thread, item: label, toBuilt }, txt };
}

module.exports = { plan, scan, load, Refused };
