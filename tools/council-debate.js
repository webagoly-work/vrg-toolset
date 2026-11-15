#!/usr/bin/env node
// ---------------------------------------------------------------------------
// council-debate.js — checks a seat debate record (docs/council/04_DEBATE-PROTOCOL.md).
// A debate is only worth its cost when the seats really disagree, really answer
// each other and say what they know versus what they assume. A model will happily
// agree in round one and sound sure about guesses, so those failure modes are
// checked here, in code, and not left to the moderator's mood.
//
//   node tools/council-debate.js new <slug> --seats arnold,elsie [--question "..."]
//                                       write a skeleton to docs/council/debates/
//   node tools/council-debate.js check [file ...] [--strict]
//                                       check records (default: every record in
//                                       docs/council/debates); exit 1 on an error,
//                                       or on a warning with --strict
//
// R0 is the request the Founder approves (COUNCIL-Q9 B): why it matters, if overlooked,
// how to settle it without a debate, the cost, and "Approved: Founder, <date>".
// Evidence tags: [FACT: source]  [INFERENCE: from what]  [ASSUMPTION]  [UNKNOWN: how to find out]
// A FACT whose source looks like a repo path (file or file:line) must point at a
// file that exists, and at a line inside it.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DEBATES = path.join(REPO, 'docs', 'council', 'debates');
const DECISIONS = path.join(REPO, 'docs', 'council', 'DECISIONS.md');

const ROUNDS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'];
const ROUND_TITLE = { R0: 'Request', R1: 'Restate', R2: 'Positions', R3: 'Cross-examination', R4: 'Final stances', R5: 'Verdict' };
// the request is read by the Founder before approving: a few words, not an essay
const WHY_WORDS = 30, ITEM_WORDS = 25;
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const TAGS = ['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN'];
const NEEDS_BODY = { FACT: 'a source', INFERENCE: 'what it follows from', UNKNOWN: 'how to find out' };
const TAG_RE = /\[(FACT|INFERENCE|ASSUMPTION|UNKNOWN)(?:\s*:\s*([^\]]*))?\]/g;
// Words that claim certainty. On a guess they are the "unsupported confidence" the protocol forbids.
const SURE_RE = /\b(clearly|obviously|certainly|definitely|undoubtedly|surely|always|never|guaranteed)\b|nyilvánvaló|egyértelmű|biztosan|kétségtelen|mindig|soha/i;
const PATH_RE = /^([\w.\-]+(?:\/[\w.\-]+)*\.[A-Za-z0-9]+)(?::(\d+)(?:-(\d+))?)?$/;
const MAX_LINES = 15;

const norm = (s) => s.toLowerCase().replace(TAG_RE, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stanceKey = (s) => (/^\s*([A-Z])\b/.exec(s)?.[1]) ?? norm(s);

// --- parse ---------------------------------------------------------------

function parse(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const doc = { title: '', meta: {}, rounds: [], order: [] };
  let round = null, seat = null;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd(), n = i + 1;
    let m;
    if ((m = /^#\s+(.*)$/.exec(line))) { doc.title = m[1].trim(); return; }
    if ((m = /^##\s+(R\d)\b\s*(.*)$/.exec(line))) {
      round = { id: m[1], title: m[2].trim(), line: n, body: [], seats: new Map() };
      doc.rounds.push(round); doc.order.push(m[1]); seat = null; return;
    }
    if (/^##\s/.test(line)) { round = null; seat = null; return; }
    if (!round) {
      if ((m = /^-\s*([a-z]+)\s*:\s*(.*)$/i.exec(line))) doc.meta[m[1].toLowerCase()] = m[2].trim();
      return;
    }
    if ((m = /^###\s+(.*)$/.exec(line))) {
      const name = m[1].trim().toLowerCase();
      seat = { name, line: n, lines: [] };
      round.seats.set(name, seat); return;
    }
    if (!line.trim()) return;
    (seat ? seat.lines : round.body).push({ n, text: line });
  });
  doc.seats = (doc.meta.seats || '').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return doc;
}

const field = (lines, name) => {
  const re = new RegExp(`^${name}\\s*:\\s*(.*)$`, 'i');
  for (const l of lines) { const m = re.exec(l.text.trim()); if (m) return { n: l.n, value: m[1].trim() }; }
  return null;
};
const bullets = (lines) => lines.filter((l) => /^\s*-\s+/.test(l.text));
const tagsOf = (text) => [...text.matchAll(TAG_RE)].map((m) => ({ tag: m[1], body: (m[2] ?? '').trim() }));
// the bullets under "Name:" up to the next "Word:" line
function listAfter(lines, name) {
  const at = lines.findIndex((l) => new RegExp(`^${name}\\s*:`, 'i').test(l.text.trim()));
  if (at < 0) return null;
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^\s*-\s+/.test(l.text)) out.push(l); else if (/^[A-Z][\w ]*:/.test(l.text.trim())) break;
  }
  const inline = lines[at].text.split(':').slice(1).join(':').trim();
  return { n: lines[at].n, items: out, inline };
}

// --- check ---------------------------------------------------------------

function check(text, { repo = REPO, decisions = null, file = 'record' } = {}) {
  const doc = parse(text);
  const errors = [], warnings = [];
  const err = (n, msg) => errors.push({ n, msg });
  const warn = (n, msg) => warnings.push({ n, msg });
  const counts = Object.fromEntries(TAGS.map((t) => [t, 0]));

  if (!doc.title) err(1, 'no "# Debate: <question>" title');
  if (doc.seats.length < 2) err(1, 'header "- seats:" needs at least two seats');
  if (doc.seats.length > 3) warn(1, `${doc.seats.length} seats: the protocol keeps a debate to three`);

  const want = ROUNDS.join(' '), got = doc.order.join(' ');
  if (got !== want) err(doc.rounds[0]?.line ?? 1, `rounds must be ${want} in that order, found "${got || 'none'}"`);
  const R = Object.fromEntries(doc.rounds.map((r) => [r.id, r]));

  // R0: the request the Founder approved (COUNCIL-Q9 B): why it matters, what goes wrong if it is
  // never argued, and the safe ways to settle it without a debate
  if (R.R0) {
    const b = R.R0.body;
    const why = field(b, 'Why it matters');
    if (!why?.value) err(R.R0.line, 'R0: "Why it matters:" missing');
    else if (words(why.value) > WHY_WORDS) warn(why.n, `R0: "Why it matters" is ${words(why.value)} words; keep it under ${WHY_WORDS}`);
    for (const name of ['If overlooked', 'Settle without a debate']) {
      const list = listAfter(b, name);
      if (!list?.items.length) { err(list?.n ?? R.R0.line, `R0: "${name}:" needs at least one bullet`); continue; }
      for (const l of list.items) if (words(l.text) > ITEM_WORDS + 1) warn(l.n, `R0 ${name}: ${words(l.text) - 1} words; a few words each`);
    }
    if (!field(b, 'Cost')?.value) err(R.R0.line, 'R0: "Cost:" missing (seats and calls)');
    const ok = field(b, 'Approved');
    if (!ok?.value) err(R.R0.line, 'R0: "Approved:" missing; every debate is approved by the Founder (COUNCIL-Q9)');
    else if (!/founder|alapító/i.test(ok.value) || !/\d{4}-\d{2}-\d{2}/.test(ok.value))
      err(ok.n, 'R0: "Approved:" must say the Founder and the date (an agent\'s word is not the Founder\'s approval)');
  }

  // every bullet in R2-R4 is a claim and carries a tag with its required body
  const checkClaim = (l, who) => {
    const tags = tagsOf(l.text);
    if (!tags.length) { err(l.n, `${who}: untagged claim (FACT, INFERENCE, ASSUMPTION or UNKNOWN)`); return tags; }
    for (const { tag, body } of tags) {
      counts[tag]++;
      if (NEEDS_BODY[tag] && !body) err(l.n, `${who}: [${tag}] needs ${NEEDS_BODY[tag]}`);
      if (tag === 'FACT' && body) checkSource(l.n, who, body);
      if (tag !== 'FACT' && SURE_RE.test(l.text)) warn(l.n, `${who}: sure-sounding words on an ${tag}; say it plainly or bring a FACT`);
    }
    return tags;
  };
  const checkSource = (n, who, body) => {
    const m = PATH_RE.exec(body.split(/[\s,;]/)[0]);
    if (!m) return; // a URL, a measurement, a command: not checkable here
    const fp = path.join(repo, m[1]);
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { err(n, `${who}: FACT source ${m[1]} does not exist`); return; }
    if (m[2]) {
      const len = fs.readFileSync(fp, 'utf8').split('\n').length;
      const last = Number(m[3] ?? m[2]);
      if (last > len) err(n, `${who}: FACT source ${m[1]}:${m[2]} is past the end (${len} lines)`);
    }
  };
  const seatSection = (r, s) => {
    const sec = r?.seats.get(s);
    if (r && !sec) err(r.line, `${r.id}: no "### ${s}" section`);
    if (sec && sec.lines.length > MAX_LINES) warn(sec.line, `${r.id} ${s}: ${sec.lines.length} lines; heads report in at most ${MAX_LINES}`);
    return sec;
  };

  // R1: the question restated, with its options and the bar for done
  if (R.R1) for (const f of ['Question', 'Options', 'Done when'])
    if (!field(R.R1.body, f)?.value && !listAfter(R.R1.body, f)?.items.length) err(R.R1.line, `R1: "${f}:" missing`);

  // R2: independent positions
  const r2 = {};
  for (const s of doc.seats) {
    const sec = seatSection(R.R2, s); if (!sec) continue;
    const stance = field(sec.lines, 'Stance');
    if (!stance?.value) err(sec.line, `R2 ${s}: "Stance:" missing`);
    const claims = bullets(sec.lines);
    if (claims.length < 2) err(sec.line, `R2 ${s}: at least two tagged claims behind the stance`);
    const tags = claims.flatMap((l) => checkClaim(l, `R2 ${s}`));
    if (claims.length && !tags.some((t) => t.tag === 'FACT')) warn(sec.line, `R2 ${s}: no FACT behind this stance`);
    r2[s] = { stance: stance?.value ?? '', claims: new Set(claims.map((l) => norm(l.text))) };
  }

  // premature agreement: one shared stance in R2 calls for a counter-case in R3
  const r2keys = new Set(Object.values(r2).map((x) => stanceKey(x.stance)).filter(Boolean));
  const unanimous = Object.keys(r2).length === doc.seats.length && r2keys.size === 1;

  // R3: every seat challenges another seat by name
  if (R.R3) {
    for (const s of doc.seats) {
      const sec = seatSection(R.R3, s); if (!sec) continue;
      const claims = bullets(sec.lines);
      claims.forEach((l) => checkClaim(l, `R3 ${s}`));
      const targets = claims.map((l) => /challenge\s*(?:→|->)\s*([a-z]+)/i.exec(l.text)?.[1]?.toLowerCase()).filter(Boolean);
      if (!targets.length) err(sec.line, `R3 ${s}: no "- Challenge → <seat>:" line`);
      for (const t of targets) {
        if (t === s) err(sec.line, `R3 ${s}: challenges itself`);
        else if (!doc.seats.includes(t)) err(sec.line, `R3 ${s}: challenges "${t}", who is not in this debate`);
      }
      for (const l of claims) if (r2[s]?.claims.has(norm(l.text))) warn(l.n, `R3 ${s}: repeats its own R2 claim; bring something new`);
    }
    const counter = [...R.R3.seats.keys()].find((k) => k.startsWith('counter-case'));
    if (unanimous && !counter) err(R.R3.line, 'R2 was unanimous: R3 needs a "### counter-case (<who>)" section arguing the strongest other option');
    if (counter) {
      const claims = bullets(R.R3.seats.get(counter).lines);
      if (!claims.length) err(R.R3.seats.get(counter).line, 'counter-case: no tagged claims');
      claims.forEach((l) => checkClaim(l, 'R3 counter-case'));
    }
  }

  // R4: final stance, and a reason for keeping or changing it
  const r4 = {};
  for (const s of doc.seats) {
    const sec = seatSection(R.R4, s); if (!sec) continue;
    const stance = field(sec.lines, 'Stance');
    if (!stance?.value) { err(sec.line, `R4 ${s}: "Stance:" missing`); continue; }
    r4[s] = stance.value;
    const changed = r2[s] && stanceKey(r2[s].stance) !== stanceKey(stance.value);
    const need = changed ? 'Changed because' : 'Kept because';
    const other = changed ? 'Kept because' : 'Changed because';
    if (!field(sec.lines, need)?.value) err(sec.line, `R4 ${s}: stance ${changed ? 'changed' : 'kept'} from R2, so "${need}:" is needed`);
    if (field(sec.lines, other)) err(field(sec.lines, other).n, `R4 ${s}: says "${other}" but the stance was ${changed ? 'changed' : 'kept'}`);
    for (const l of bullets(sec.lines)) {
      checkClaim(l, `R4 ${s}`);
      if (r2[s]?.claims.has(norm(l.text))) warn(l.n, `R4 ${s}: repeats its own R2 claim word for word`);
    }
  }

  // R5: the verdict carries its dissent, its assumptions, its unknowns and what would reverse it
  if (R.R5) {
    const b = R.R5.body;
    const decision = field(b, 'Decision');
    if (!decision?.value) err(R.R5.line, 'R5: "Decision:" missing');
    const dissent = field(b, 'Dissent');
    if (!dissent?.value) err(R.R5.line, 'R5: "Dissent:" missing (write "none" and why, if nobody dissents)');
    else if (decision?.value) {
      const against = Object.entries(r4).filter(([, st]) => stanceKey(st) !== stanceKey(decision.value)).map(([s]) => s);
      for (const s of against) if (!dissent.value.toLowerCase().includes(s)) err(dissent.n, `R5: ${s} ended on another stance and is not named in "Dissent:"`);
      if (!against.length && /^none\b\W*$/i.test(dissent.value)) warn(dissent.n, 'R5: "Dissent: none" with no reason; say why nobody held out');
    }
    const kill = listAfter(b, 'Kill criteria');
    if (!kill?.items.length) err(kill?.n ?? R.R5.line, 'R5: "Kill criteria:" needs at least one bullet: what would make us reverse this');
    for (const [name, tag] of [['Rests on assumptions', 'ASSUMPTION'], ['Unknowns', 'UNKNOWN']]) {
      const list = listAfter(b, name);
      if (!list) { err(R.R5.line, `R5: "${name}:" missing`); continue; }
      if (counts[tag] && !list.items.length) err(list.n, `R5: the debate has ${counts[tag]} ${tag} claim(s); list the ones the decision rests on under "${name}:"`);
      if (!counts[tag] && !list.items.length && !list.inline) warn(list.n, `R5: "${name}:" is empty; write "none"`);
    }
  }

  // a debate that decides a numbered question must show up in DECISIONS.md
  const decides = doc.meta.decides;
  if (decides && !/^none$/i.test(decides) && decisions !== null && !decisions.includes(decides))
    err(1, `decides ${decides}, which DECISIONS.md does not mention`);

  return { file, errors, warnings, counts, unanimous, seats: doc.seats };
}

// --- skeleton ------------------------------------------------------------

function skeleton({ question = '<the question>', seats, date }) {
  const per = (round, extra) => seats.map((s) => `### ${s}\n${extra(s)}`).join('\n\n');
  return `# Debate: ${question}

- date: ${date}
- seats: ${seats.join(', ')}
- decides: none

## R0 ${ROUND_TITLE.R0}
Why it matters: …
If overlooked:
- …
Settle without a debate:
- …
Cost: ${seats.length} seats, ${seats.length * 3} seat calls
Approved: <Founder, date — only once the Founder has said yes>

## R1 ${ROUND_TITLE.R1}
Question: ${question}
Options: A … / B … / C …
Out of scope: …
Done when: …

## R2 ${ROUND_TITLE.R2}
${per('R2', () => 'Stance: A\n- [FACT: path/to/file.md:12] …\n- [INFERENCE: from the line above] …\n- [ASSUMPTION] …\n- [UNKNOWN: how to find out] …')}

## R3 ${ROUND_TITLE.R3}
${per('R3', (s) => `- Challenge → ${seats.find((x) => x !== s)}: [INFERENCE: …] …`)}

## R4 ${ROUND_TITLE.R4}
${per('R4', () => 'Stance: A\nKept because: …')}

## R5 ${ROUND_TITLE.R5}
Decision: A
Dissent: none, because …
Rests on assumptions:
- …
Unknowns:
- …
Kill criteria:
- …
`;
}

// --- CLI -----------------------------------------------------------------

function records() {
  if (!fs.existsSync(DEBATES)) return [];
  return fs.readdirSync(DEBATES).filter((f) => /^\d{4}-\d{2}-\d{2}_.+\.md$/.test(f)).map((f) => path.join(DEBATES, f));
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest.splice(i, 2)[1] : undefined; };
  if (cmd === 'new') {
    const seats = (flag('--seats') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const question = flag('--question');
    const slug = rest[0];
    if (!slug || !/^[a-z0-9-]+$/.test(slug) || seats.length < 2) {
      console.error('usage: council-debate.js new <slug-in-kebab-case> --seats a,b[,c] [--question "..."]'); return 2;
    }
    const date = new Date().toISOString().slice(0, 10);
    const fp = path.join(DEBATES, `${date}_${slug}.md`);
    if (fs.existsSync(fp)) { console.error(`exists: ${path.relative(REPO, fp)}`); return 1; }
    fs.mkdirSync(DEBATES, { recursive: true });
    fs.writeFileSync(fp, skeleton({ question, seats, date }));
    console.log(`wrote ${path.relative(REPO, fp).replace(/\\/g, '/')}`);
    return 0;
  }
  if (cmd === 'check') {
    const strict = rest.includes('--strict');
    const files = rest.filter((a) => a !== '--strict');
    const list = files.length ? files.map((f) => path.resolve(f)) : records();
    if (!list.length) { console.log('no debate records yet (docs/council/debates)'); return 0; }
    const decisions = fs.existsSync(DECISIONS) ? fs.readFileSync(DECISIONS, 'utf8') : '';
    let bad = 0;
    for (const fp of list) {
      const rel = path.relative(REPO, fp).replace(/\\/g, '/');
      const r = check(fs.readFileSync(fp, 'utf8'), { decisions, file: rel });
      const tally = TAGS.map((t) => `${t} ${r.counts[t]}`).join(', ');
      console.log(`${r.errors.length ? 'FAIL' : 'ok  '}  ${rel}  (${r.errors.length} errors, ${r.warnings.length} warnings; ${tally})`);
      for (const e of r.errors) console.log(`  error  line ${e.n}: ${e.msg}`);
      for (const w of r.warnings) console.log(`  warn   line ${w.n}: ${w.msg}`);
      if (r.errors.length || (strict && r.warnings.length)) bad++;
    }
    return bad ? 1 : 0;
  }
  console.error('usage: council-debate.js new <slug> --seats a,b | check [file ...] [--strict]');
  return 2;
}

module.exports = { parse, check, skeleton, TAGS };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
