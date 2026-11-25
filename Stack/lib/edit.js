// VRG Stack — the write gateway (S6 of research/STRINGS-PLAN.md §4; ROADMAP 2.7). The house rule stays: "a source
// changes only by its own tool or by hand". This is that tool, and the Founder's click on the shown diff is the hand.
//
//   preview(op, ctx) → { ok, file, id, line, at, answer, diff, hash, before, after }      nothing is written
//   apply(op, hash, ctx) → { ok, file, id, line, ... }                                     writes, logs an `edit` event
//
// One editor so far (the Founder's choice, 2026-11-25: decisions only, one fixed answer line):
//
//   op = { editor: 'decisions', file: 'docs/visual/README.md', id: 'VIS-Q5', choice: 'B', text: 'option text',
//          own: 'an answer in my words' (instead of choice), note: 'optional', page: 'viewer' | 'decisions' }
//
//   It inserts ONE line, the same in every file, right under the question:
//       > **VIS-Q5** answered 2026-11-25: **B** — the option's text · note · _(Döntésnapló)_
//   under a heading item: just below the heading; under a table row: after the table; otherwise after the item's own
//   lines. Blank lines keep it its own block. No other byte of the file changes, and the file keeps its line endings.
//   lib/layers.js parseDecisionFile, the parser the next build uses, must read the result as answered, or nothing is
//   written. An answered question is refused; so is a file that changed since the preview (its hash), a path outside
//   the repo, and a file that is not a decisions file the Q layer reads.
//
// Never commits; never touches R, U, A, C or G (§4). The event goes to data/events.jsonl, which the time scrubber shows.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Refused extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const oneLine = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

function ctxOf(ctx = {}) {
  const L = ctx.layers || require('./layers');
  return { repo: path.resolve(ctx.repo || require('./common').REPO), log: ctx.log || null, layers: L,
    extra: (ctx.extra || L.DECISION_FILES_EXTRA || []).map(f => f.replace(/\\/g, '/')), now: ctx.now || (() => new Date()) };
}

// where the file is on disk, and the name the Q layer knows it by
function locate(file, c) {
  const f = String(file || '').replace(/\\/g, '/');
  if (!f) throw new Refused(400, 'file missing');
  if (/^[A-Za-z]:\//.test(f) || f.startsWith('/')) {
    const hit = c.extra.find(x => x.toLowerCase() === f.toLowerCase());
    if (!hit) throw new Refused(403, 'not a decisions file the stack reads: ' + f);
    return { abs: hit, rel: hit };
  }
  if (f.split('/').some(s => s === '..' || s === '.' || s === '' || s === '.git')) throw new Refused(400, 'path not allowed: ' + f);
  if (!/decisions/i.test(f) || !/\.md$/i.test(f)) throw new Refused(403, 'not a decisions file: ' + f);
  const abs = path.resolve(c.repo, f);
  if (!abs.startsWith(c.repo + path.sep)) throw new Refused(403, 'outside the repo');
  return { abs, rel: f };
}

function answerLine(raw, op, date) {
  const note = oneLine(op.note, 200);
  let body;
  if (op.own != null && String(op.own).trim()) body = `“${oneLine(op.own, 400)}”`;
  else {
    const k = String(op.choice || '').toUpperCase();
    if (!/^[A-F]$/.test(k)) throw new Refused(400, 'choice must be A–F, or give `own`');
    const t = oneLine(op.text, 200).replace(/^[\s|·]+|[\s|·]+$/g, '');   // an option cut from a table row keeps its pipe
    body = `**${k}**${t ? ' — ' + t : ''}`;
  }
  return `> **${raw}** answered ${date}: ${body}${note ? ' · ' + note : ''} · _(Döntésnapló)_`;
}

// where the line goes: under a heading item, after a table, or after the item's own lines
function insertAt(lines, i, isItem) {
  const L = lines[i];
  if (/^#{1,6}\s/.test(L)) return i + 1;
  if (/^\s*\|/.test(L)) { let j = i + 1; while (j < lines.length && /^\s*\|/.test(lines[j])) j++; return j; }
  let j = i + 1;
  while (j < lines.length && lines[j].trim() !== '' && !/^#{1,6}\s/.test(lines[j]) && !/^\s*\|/.test(lines[j]) && !isItem(lines[j])) j++;
  return j;
}

function unified(rel, lines, at, add) {
  const c0 = Math.max(0, at - 3), c1 = Math.min(lines.length, at + 3);
  const out = [`--- a/${rel}`, `+++ b/${rel}`, `@@ -${c0 + 1},${c1 - c0} +${c0 + 1},${c1 - c0 + add.length} @@`];
  for (let k = c0; k < at; k++) out.push(' ' + lines[k]);
  for (const a of add) out.push('+' + a);
  for (let k = at; k < c1; k++) out.push(' ' + lines[k]);
  return out.join('\n') + '\n';
}

function plan(op, c) {
  if (!op || op.editor !== 'decisions') throw new Refused(400, 'unknown editor: ' + (op && op.editor));
  const { abs, rel } = locate(op.file, c);
  let buf; try { buf = fs.readFileSync(abs); } catch { throw new Refused(404, 'file not found: ' + rel); }
  const txt = buf.toString('utf8'), eol = /\r\n/.test(txt) ? '\r\n' : '\n';
  const P = c.layers.parseDecisionFile(txt, rel), it = P.items.get(String(op.id || ''));
  if (!it) throw new Refused(404, `${op.id} is not a decision in ${rel}`);
  if (it.answered) throw new Refused(409, `${op.id} is already answered in ${rel} (line ${it.line})`);
  const lines = P.lines, i = it.line - 1;
  const idHere = l => !!c.layers.decisionIdOf(l.replace(/^[\s|>#*\-]+/, ''), P.ns);
  const raw = (c.layers.decisionIdOf(lines[i].replace(/^[\s|>#*\-]+/, ''), P.ns) || {}).raw || op.id;
  const date = /^\d{4}-\d\d-\d\d$/.test(op.date || '') ? op.date : today();
  const line = answerLine(raw, op, date);
  const at = insertAt(lines, i, idHere);
  const add = [];
  if (at > 0 && lines[at - 1].trim() !== '') add.push('');
  add.push(line);
  if (at < lines.length && lines[at].trim() !== '') add.push('');
  // spliced into the bytes as they are: every other byte, mixed line endings included, stays the same
  let off = 0;
  if (at >= lines.length) off = txt.length;
  else { const rx = /\r?\n/g; for (let k = 0; k < at; k++) { const m = rx.exec(txt); off = m ? m.index + m[0].length : txt.length; } }
  const ins = at >= lines.length ? eol + add.join(eol) : add.map(x => x + eol).join('');
  const next = txt.slice(0, off) + ins + txt.slice(off);
  // read it back with the build's own parser: the question must now be answered, and still be the same question
  const Q = c.layers.parseDecisionFile(next, rel), back = Q.items.get(it.id);
  if (!back || !back.answered || back.line !== it.line) throw new Refused(500, `the answer line would not read as an answer to ${it.id}; nothing written`);
  for (const [id, x] of P.items) { const y = Q.items.get(id); if (!y || (id !== it.id && y.answered !== x.answered)) throw new Refused(500, `the edit would change ${id} too; nothing written`); }
  return { abs, rel, buf, next, it, at, add, line, date, diff: unified(rel, lines, at, add), ins };
}

function preview(op, ctx) {
  const c = ctxOf(ctx), p = plan(op, c);
  return { ok: true, file: p.rel, id: p.it.id, line: p.it.line, at: p.at + 1, answer: p.line, diff: p.diff, hash: sha(p.buf) };
}

function apply(op, hash, ctx) {
  const c = ctxOf(ctx), p = plan(op, c);
  if (!hash || sha(p.buf) !== hash) throw new Refused(409, `${p.rel} changed since the preview; look at the new diff`);
  const tmp = p.abs + '.tmp' + process.pid;
  fs.writeFileSync(tmp, p.next); fs.renameSync(tmp, p.abs);
  const now = c.now().toISOString();
  const ev = { op: 'edit', id: 'Q:' + p.it.id, layer: 'Q', editor: 'decisions', file: p.rel, line: p.it.line, page: oneLine(op.page, 40) || '',
    answer: op.own != null && String(op.own).trim() ? 'own' : String(op.choice).toUpperCase(), diff: sha(p.diff).slice(0, 16), valid: p.date, seen: now };
  if (c.log) { fs.mkdirSync(path.dirname(c.log), { recursive: true }); fs.appendFileSync(c.log, JSON.stringify(ev) + '\n'); }
  return { ok: true, file: p.rel, id: p.it.id, line: p.it.line, at: p.at + 1, answer: p.line, event: ev };
}

module.exports = { preview, apply, answerLine, Refused };
