#!/usr/bin/env node
// Solomon: our three-signal check over the VRG knowledge base. Rules: docs/solomon/README.md.
//
//   node tools/solomon.js scan                 read every tracked document, write the signals, build the page
//   node tools/solomon.js next                 the section whose turn it is, with its worklist (Caleb reads this)
//   node tools/solomon.js flag <id> confirmed|dismissed|unsure "<why>"
//   node tools/solomon.js report <file:line> <file:line> "<why>"    a discrepancy the scan missed
//   node tools/solomon.js done <section> "<one line>"               close the section's review
//   node tools/solomon.js rule <id> first|second|coexist "<why>"    the Founder's ruling, dated
//   node tools/solomon.js intern               run Caleb on the next section (cheap model, narrow permissions), then publish
//   node tools/solomon.js publish              send Solomon/data to the solomon-data branch, bringing the phone's rulings back
//   node tools/solomon.js pull                 only bring the phone's rulings here
//
// The script finds and quotes; it never edits a source file. Client job folders and the Workflow Kit are
// outside Git and outside this scan, so client data cannot reach Solomon/data.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const DATA = path.join(REPO, 'Solomon', 'data');
const SIGNALS = path.join(DATA, 'signals.json');
const REVIEWS = path.join(DATA, 'reviews.jsonl');   // Caleb: verdicts, reported pairs, closed sections
const RULINGS = path.join(DATA, 'rulings.jsonl');   // the Founder: append only
const SRC_PAGE = path.join(REPO, 'Solomon', 'src', 'index.html');
const DIST_PAGE = path.join(REPO, 'Solomon', 'dist', 'vrg-solomon.html');

const FROZEN_DAYS = 45, BEHIND_DAYS = 3, WORK_LIMIT = 12, MAX_DOC_BYTES = 400 * 1024;

// Order is priority: BRIDGE builds on itself, so its sections come first when reviews tie.
const SECTIONS = [
  { id: 'bridge-std', n: 'BRIDGE szabványok', strict: true, match: p => p.startsWith('BRIDGE/05_standards/') },
  { id: 'bridge-arch', n: 'BRIDGE felépítés', strict: true, match: p => /^BRIDGE\/(0[1-4]_|BRIDGE-|README)/.test(p) },
  { id: 'bridge-cat', n: 'BRIDGE katalógus', strict: true, match: p => /^BRIDGE\/(09_catalogue\/(src\/.*\.js$|.*\.md$)|10_media-wall\/)/.test(p) },
  { id: 'bridge-cla', n: 'BRIDGE CLA', strict: true, match: p => p.startsWith('BRIDGE/07_CLA/') },
  { id: 'planner', n: 'Planner', match: p => p.startsWith('Planner/') },
  { id: 'inventory', n: 'Készlet', match: p => p.startsWith('Inventory/') },
  { id: 'firmware', n: 'Firmware', match: p => /^(Firmware|ServiceKit|CoreRef)/.test(p) },
  { id: 'council', n: 'Tanács', match: p => p.startsWith('docs/council/') || p.startsWith('.claude/agents/') },
  { id: 'hub', n: 'Kapu, indítók', match: p => p.startsWith('docs/hub/') || /^GO-|^CLAUDE\.md$/.test(p) },
  { id: 'city', n: 'Kódváros', match: p => p.startsWith('docs/city/') || p.startsWith('CodeCity/') },
  { id: 'mobile', n: 'Mobil', match: p => p.startsWith('docs/mobile/') || p.startsWith('Mobile/') },
  { id: 'docs', n: 'Kutatás, egyéb', match: p => p.startsWith('docs/') },
];
// Archived and generated material is never a source of signals.
const SKIP = /^(docs\/go-archive\/|docs\/council\/dna\/|docs\/solomon\/|Vendor\/|BRIDGE\/_|Solomon\/)|\/(node_modules|dist|build)\//;

// Words that name a whole class of things: a value next to them says nothing about one thing.
const GENERIC = new Set(`LED USB RGB RGBW RGBWW CCT GPIO UART SPI I2C PWM AC DC IP POE SMD PCB CPU GPU RAM ROM SSD HDD PC API
 HTTP HTTPS JSON HTML PDF CSS WIFI BLE ESP MCU IC NVR TV UPS PIR DIN EN IEC MSZ HU EU US CE ROI FAQ BOM NB OK IT MM CM
 TODO TBD NEM IGEN AND THE FOR NOT MAX MIN TYP NOM`.split(/\s+/));

const git = (args, env) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, env: env || process.env });
const today =() => new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const sid = (...parts) => crypto.createHash('sha1').update(parts.join('\0')).digest('hex').slice(0, 8);
const readJsonl = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const append = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify(o) + '\n'); };
const clip = s => { s = s.replace(/\s+/g, ' ').trim(); return s.length > 220 ? s.slice(0, 217) + '…' : s; };

/* ---- the documents ---- */

// Last real change of each file. Sweeps (the anonymiser, renames en masse) say nothing about the content.
function lastChanged() {
  const out = {};
  let date = null, sweep = false;
  for (const line of git(['log', '--no-merges', '--format=@%cs %s', '--name-only', '--no-renames']).split('\n')) {
    if (line.startsWith('@')) { date = line.slice(1, 11); sweep = /anonymis|re-?root|mechanical/i.test(line); continue; }
    if (line && !sweep && !out[line]) out[line] = date;
  }
  return out;
}

function loadDocs() {
  const dates = lastChanged(), docs = [];
  for (const p of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
    if (SKIP.test(p) || !/\.(md|js)$/.test(p)) continue;
    if (p.endsWith('.js') && !p.startsWith('BRIDGE/09_catalogue/src/')) continue;
    const sec = SECTIONS.find(s => s.match(p));
    if (!sec) continue;
    const abs = path.join(REPO, p);
    if (!fs.existsSync(abs) || fs.statSync(abs).size > MAX_DOC_BYTES) continue;
    const text = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || path.basename(p);
    docs.push({ p, sec: sec.id, strict: !!sec.strict, text, lines: text.split('\n'), title: clip(title), date: dates[p] || today() });
  }
  return docs;
}

/* ---- ids and references ---- */

const ID_RE = /\b(?:BRIDGE-)?([A-Z]{2,})-(\d{3})(-A\d)?\b/g;
const norm = (kind, num, sub) => `${kind}-${num}${sub || ''}`;

function linkGraph(docs) {
  const byId = {}, known = new Set();
  for (const d of docs) {
    for (const m of path.basename(d.p).replace(/_/g, ' ').matchAll(ID_RE)) { byId[norm(m[1], m[2], m[3])] = d; known.add(m[1]); }
  }
  for (const d of docs) {
    d.refs = new Map();              // target doc -> first line that cites it
    d.dangling = new Map();
    d.lines.forEach((l, i) => {
      for (const m of l.matchAll(ID_RE)) {
        const id = norm(m[1], m[2], m[3]);
        const t = byId[id] || byId[norm(m[1], m[2])];
        if (t && t !== d && !d.refs.has(t)) d.refs.set(t, i + 1);
        if (!t && known.has(m[1]) && !d.dangling.has(id)) d.dangling.set(id, i + 1);
      }
      for (const m of l.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(m[1])) continue;
        const rel = path.posix.normalize(path.posix.join(path.posix.dirname(d.p), decodeURI(m[1])));
        const t = docs.find(o => o.p === rel);
        if (t && t !== d && !d.refs.has(t)) d.refs.set(t, i + 1);
        if (!t && !fs.existsSync(path.join(REPO, rel)) && !SKIP.test(rel)) d.dangling.set(m[1], i + 1);
      }
    });
    d.defines = Object.values(byId).includes(d);
  }
  for (const d of docs) d.inbound = 0;
  for (const d of docs) for (const t of d.refs.keys()) t.inbound++;
}

/* ---- the three signals ---- */

const VALUE_RE = /(?<![\w.-])(\d+(?:[.,]\d+)?)(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?\s?(mm²|mm|cm|V|mA|A|kW|W|MHz|GHz|Mbps|°C)(?![\p{L}\d])/gu;
const TERM_RE = /`([A-Za-z][\w.-]{2,})`|\b([A-Z][A-Z0-9]{2,}(?:[-_][A-Z0-9]+)*|Silver Rail|Golden Rail|Bronze Rail|[Tt]runk|[Pp]ort[aá]l)\b/g;

function contradictions(docs) {
  // term + unit -> value -> doc -> first line. Only the nearest term before a value counts, on prose and table rows alike.
  const facts = new Map();
  for (const d of docs) {
    if (!/\.md$/.test(d.p)) continue;
    let fence = false;
    d.lines.forEach((l, i) => {
      if (l.startsWith('```')) fence = !fence;
      if (fence || l.length > 600) return;
      const vals = [...l.matchAll(VALUE_RE)];
      if (!vals.length || vals.length > 3) return;
      for (const v of vals) {
        const before = l.slice(Math.max(0, v.index - 48), v.index);
        const terms = [...before.matchAll(TERM_RE)].map(m => m[1] || m[2]).filter(t => !GENERIC.has(t.toUpperCase()) && !/^\d/.test(t));
        const term = terms[terms.length - 1];
        if (!term) continue;
        const key = `${term}|${v[2]}`, value = v[0].replace(/\s/g, '');
        if (!facts.has(key)) facts.set(key, new Map());
        const byVal = facts.get(key);
        if (!byVal.has(value)) byVal.set(value, new Map());
        if (!byVal.get(value).has(d)) byVal.get(value).set(d, i + 1);
      }
    });
  }
  const out = [];
  for (const [key, byVal] of facts) {
    if (byVal.size !== 2) continue;              // three or more values are a range of variants, not a clash
    const [[va, da], [vb, db]] = [...byVal];
    const shared = [...da.keys()].some(d => db.has(d));
    if (shared) continue;                        // one document holds both: it knows about the difference
    const a = [...da][0], b = [...db][0];
    if (a[0].sec !== b[0].sec && !(a[0].strict && b[0].strict)) continue;
    const term = key.split('|')[0];
    out.push({
      id: sid('c', a[0].p, b[0].p, key, va, vb), type: 'contradiction', stage: 'candidate', sec: a[0].sec,
      title: `${term}: ${va} vagy ${vb}?`,
      a: { p: a[0].p, line: a[1], text: clip(a[0].lines[a[1] - 1]) },
      b: { p: b[0].p, line: b[1], text: clip(b[0].lines[b[1] - 1]) },
    });
  }
  return out;
}

// The Planner's endpoint table takes its codes from the BRIDGE catalogue, so a mounting height must match.
function catalogueAgainstPlanner(docs) {
  const planner = docs.length && 'Planner/projects/varler-planner/src/05s-endpoints.js';
  const src = fs.readFileSync(path.join(REPO, planner), 'utf8');
  const start = src.indexOf('const EP_CAT=[') + 'const EP_CAT='.length;
  let depth = 0, end = start;
  for (; end < src.length; end++) {
    if (src[end] === '[') depth++;
    else if (src[end] === ']' && --depth === 0) break;
  }
  const EP = vm.runInNewContext(`(${src.slice(start, end + 1)})`);
  const lineOf = (text, needle) => text.split('\n').findIndex(l => l.includes(needle)) + 1;
  const db = JSON.parse(fs.readFileSync(path.join(REPO, 'BRIDGE/09_catalogue/SMARTHOME-DB-001.json'), 'utf8'));
  const out = [];
  for (const row of [...db.control, ...db.lighting, ...db.switches, ...db.fleet]) {
    if (!row.code || typeof row.h !== 'number') continue;
    const ep = EP.find(e => e.code === row.code);
    const v = ep && row.var ? (ep.vars || []).find(x => x.k === row.var) : null;
    const h = v && typeof v.h === 'number' ? v.h : ep && (row.var ? v : true) ? ep.h : undefined;
    if (typeof h !== 'number' || h === row.h) continue;
    const doc = docs.find(d => d.p.startsWith('BRIDGE/09_catalogue/src/') && d.text.includes(`k: '${row.k}'`));
    if (!doc) continue;
    const aLine = lineOf(doc.text, `k: '${row.k}'`), bLine = lineOf(src, `code:'${row.code}'`);
    out.push({
      id: sid('h', row.k, row.h, h), type: 'contradiction', stage: 'candidate', sec: 'bridge-cat',
      title: `${row.n}: ${row.h} mm vagy ${h} mm?`,
      a: { p: doc.p, line: aLine, text: clip(doc.lines[aLine - 1]) },
      b: { p: planner, line: bLine, text: clip(src.split('\n')[bLine - 1]) },
    });
  }
  return out;
}

// Our own validators are facts too: a failing one is a hole until someone looks.
const CHECKS = [
  { n: 'BRIDGE katalógus', sec: 'bridge-cat', args: ['BRIDGE/09_catalogue/tools/build.js', '--check'] },
  { n: 'Brief állapot', sec: 'hub', args: ['tools/brief-state.js', '--check'] },
  { n: 'START jegyzék', sec: 'hub', args: ['tools/check-start.js'] },
];

function validators() {
  const out = [];
  for (const c of CHECKS) {
    const r = spawnSync(process.execPath, c.args, { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    if (r.status === 0) continue;
    const last = (r.stdout + r.stderr).trim().split('\n').pop() || 'no output';
    out.push({ id: sid('v', c.n), type: 'dark', kind: 'ellenőrzés', sec: c.sec, title: `Hibás ellenőrzés: ${c.n}`,
      a: { p: c.args[0], line: 1, text: clip(last) } });
  }
  return out;
}

function darkZones(docs) {
  const out = [];
  const answered = new Set();
  const asked = new Map();
  const QID = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-(?:Q|D)\d+)\b/g;
  for (const d of docs) d.lines.forEach((l, i) => {
    for (const m of l.matchAll(QID)) {
      if (/\b(válasz|eldönt|answered|decided|done|kész)\b|\*\*[A-E]\b|= ?[A-E]\b/i.test(l)) answered.add(m[1]);
      else if (/\b(open|nyitott|tisztázandó|várjuk|pending)\b/i.test(l) && !asked.has(m[1])) asked.set(m[1], { d, line: i + 1 });
    }
  });
  for (const [q, at] of asked) {
    if (answered.has(q)) continue;
    out.push({ id: sid('q', q), type: 'dark', kind: 'kérdés', stage: 'candidate', sec: at.d.sec, title: `Nyitott kérdés: ${q}`,
      a: { p: at.d.p, line: at.line, text: clip(at.d.lines[at.line - 1]) } });
  }
  for (const d of docs) {
    for (const [ref, line] of d.dangling) {
      out.push({ id: sid('r', d.p, ref), type: 'dark', kind: 'hivatkozás', sec: d.sec, title: `Sehová nem mutat: ${ref}`,
        a: { p: d.p, line, text: clip(d.lines[line - 1]) } });
    }
    const marks = [];
    d.lines.forEach((l, i) => { if (/\b(TBD|TODO|FIXME|tisztázandó)\b|\?\?\?|⚑/.test(l)) marks.push(i + 1); });
    if (marks.length && d.strict) {
      out.push({ id: sid('m', d.p), type: 'dark', kind: 'lyuk', sec: d.sec, title: `${marks.length} befejezetlen pont: ${d.title}`,
        a: { p: d.p, line: marks[0], text: clip(d.lines[marks[0] - 1]) }, n: marks.length });
    }
    if (d.strict && d.defines && !d.inbound && !d.refs.size) {
      out.push({ id: sid('o', d.p), type: 'dark', kind: 'híd', sec: d.sec, title: `Nincs híd: ${d.title}`,
        a: { p: d.p, line: 1, text: clip(d.lines[0]) } });
    }
  }
  return out;
}

function frozen(docs, reviewed, now) {
  const out = [];
  const seen = d => (reviewed[d.p] && reviewed[d.p] > d.date ? reviewed[d.p] : d.date);
  for (const d of docs) {
    const age = days(seen(d), now);
    if (d.strict) {
      for (const [t, line] of d.refs) {
        const lag = days(seen(d), t.date);
        if (lag < BEHIND_DAYS) continue;
        out.push({ id: sid('b', d.p, t.p, t.date), type: 'frozen', kind: 'lemaradt', sec: d.sec,
          title: `${path.basename(d.p)} lemaradt ${path.basename(t.p)} mögött (${lag} nap)`,
          a: { p: d.p, line, text: clip(d.lines[line - 1]) }, b: { p: t.p, line: 1, text: clip(t.title) } });
      }
    }
    if (age >= FROZEN_DAYS) {
      out.push({ id: sid('f', d.p), type: 'frozen', kind: 'alvó', sec: d.sec, title: `${age} napja érintetlen: ${d.title}`,
        a: { p: d.p, line: 1, text: clip(d.title) }, age, keystone: d.inbound >= 3 });
    }
  }
  return out;
}

/* ---- state ---- */

function applyVerdicts(signals, reviews, rulings) {
  const v = {}, r = {};
  for (const x of reviews) if (x.id) v[x.id] = x;
  for (const x of rulings) r[x.id] = x;
  for (const x of reviews) {
    if (x.kind !== 'report') continue;
    signals.push({ id: x.reportId, type: 'contradiction', stage: 'confirmed', sec: x.sec, title: x.why, a: x.a, b: x.b, by: x.by });
  }
  for (const s of signals) {
    if (v[s.id] && s.stage) s.stage = v[s.id].verdict === 'confirmed' ? 'confirmed' : v[s.id].verdict === 'dismissed' ? 'dismissed' : s.stage;
    if (v[s.id]) s.note = v[s.id].why;
    if (r[s.id]) s.ruling = { how: r[s.id].how, why: r[s.id].why, date: r[s.id].date };
  }
  return signals;
}

function scan() {
  const now = today(), docs = loadDocs();
  linkGraph(docs);
  const reviews = readJsonl(REVIEWS), rulings = readJsonl(RULINGS);
  const reviewed = {};
  for (const x of reviews) if (x.kind === 'section') for (const p of x.files) reviewed[p] = x.date;
  const found = [...contradictions(docs), ...catalogueAgainstPlanner(docs), ...darkZones(docs), ...validators(), ...frozen(docs, reviewed, now)];
  const signals = applyVerdicts([...new Map(found.map(s => [s.id, s])).values()], reviews, rulings);
  const index = Object.fromEntries(docs.map((d, i) => [d.p, i]));
  const out = {
    generated: now,
    commit: git(['rev-parse', '--short', 'HEAD']).trim(),
    sections: SECTIONS.map(s => {
      const last = reviews.filter(x => x.kind === 'section' && x.sec === s.id).pop();
      return { id: s.id, n: s.n, docs: docs.filter(d => d.sec === s.id).length, reviewed: last ? last.date : null, summary: last ? last.summary : null };
    }).filter(s => s.docs),
    docs: docs.map(d => ({ p: d.p, s: d.sec, t: d.title, d: d.date, i: d.inbound })),
    signals: signals.map(s => ({ ...s, ai: s.a ? index[s.a.p] : undefined, bi: s.b ? index[s.b.p] : undefined })),
  };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(SIGNALS, JSON.stringify(out, null, 1) + '\n');
  buildPage(out);
  return out;
}

function buildPage(data) {
  if (!fs.existsSync(SRC_PAGE)) return;
  const css = fs.readFileSync(path.join(REPO, 'shared', 'melyviz.css'), 'utf8');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = fs.readFileSync(SRC_PAGE, 'utf8')
    .replace('/*MELYVIZ*/', () => css).replace('/*DATA*/null', () => json);
  fs.mkdirSync(path.dirname(DIST_PAGE), { recursive: true });
  fs.writeFileSync(DIST_PAGE, html);
}

/* ---- the intern's routine ---- */

const counts = list => {
  const c = {};
  for (const s of list) { const k = s.type + (s.stage ? ':' + s.stage : ''); c[k] = (c[k] || 0) + 1; }
  return c;
};

function nextSection(data) {
  return [...data.sections].sort((a, b) => (a.reviewed || '') < (b.reviewed || '') ? -1 : (a.reviewed || '') > (b.reviewed || '') ? 1 : 0)[0];
}

function cmdNext() {
  const data = scan(), sec = nextSection(data);
  const open = data.signals.filter(s => s.sec === sec.id && !s.ruling);
  const todo = open.filter(s => s.stage === 'candidate').slice(0, WORK_LIMIT);
  const files = data.docs.filter(d => d.s === sec.id).sort((a, b) => b.i - a.i).slice(0, 8);
  console.log(`SECTION ${sec.id} (${sec.n}), ${sec.docs} documents, last reviewed ${sec.reviewed || 'never'}`);
  console.log(`\nCANDIDATES to judge (${todo.length} of ${open.filter(s => s.stage === 'candidate').length}):`);
  for (const s of todo) {
    console.log(`\n${s.id}  ${s.title}\n  A ${s.a.p}:${s.a.line}  ${s.a.text}`);
    if (s.b) console.log(`  B ${s.b.p}:${s.b.line}  ${s.b.text}`);
  }
  console.log('\nMOST CITED documents, read these for clashes the scan cannot see:');
  for (const f of files) console.log(`  ${f.p}  (cited by ${f.i})`);
  console.log(`\nOTHER SIGNALS here: ${JSON.stringify(counts(open.filter(s => s.stage !== 'candidate')))}`);
}

function cmdFlag(id, verdict, why) {
  if (!['confirmed', 'dismissed', 'unsure'].includes(verdict) || !why) die('flag <id> confirmed|dismissed|unsure "<why>"');
  const data = JSON.parse(fs.readFileSync(SIGNALS, 'utf8'));
  if (!data.signals.some(s => s.id === id)) die('no signal ' + id);
  append(REVIEWS, { kind: 'verdict', id, verdict, why, date: today(), by: 'caleb' });
  console.log('recorded');
}

// The script quotes the lines itself, so a reported clash always shows what the files really say.
function quote(ref) {
  const m = ref.match(/^(.+):(\d+)$/);
  if (!m) die('expected file:line, got ' + ref);
  const abs = path.join(REPO, m[1]);
  if (!fs.existsSync(abs)) die('no file ' + m[1]);
  const line = fs.readFileSync(abs, 'utf8').split(/\r?\n/)[+m[2] - 1];
  if (!line || !line.trim()) die('empty line ' + ref);
  return { p: m[1].replace(/\\/g, '/'), line: +m[2], text: clip(line) };
}

function cmdReport(refA, refB, why) {
  if (!why) die('report <file:line> <file:line> "<why>"');
  const a = quote(refA), b = quote(refB);
  const sec = (SECTIONS.find(s => s.match(a.p)) || { id: 'docs' }).id;
  append(REVIEWS, { kind: 'report', reportId: sid('x', a.p, a.line, b.p, b.line), a, b, why, sec, date: today(), by: 'caleb' });
  console.log('recorded');
}

function cmdDone(secId, summary) {
  if (!SECTIONS.some(s => s.id === secId) || !summary) die('done <section> "<one line>"');
  const files = loadDocs().filter(d => d.sec === secId).map(d => d.p);
  append(REVIEWS, { kind: 'section', sec: secId, files, summary, date: today(), by: 'caleb' });
  scan();
  console.log('section closed');
}

function cmdRule(id, how, why) {
  if (!['first', 'second', 'coexist'].includes(how) || !why) die('rule <id> first|second|coexist "<why>"');
  append(RULINGS, { id, how, why, date: today() });
  scan();
  console.log('ruled');
}

function cmdIntern() {
  const claude = process.env.CLAUDE_BIN || 'claude';
  const allowed = 'Read,Grep,Glob,Bash(node tools/solomon.js next),Bash(node tools/solomon.js flag *),Bash(node tools/solomon.js report *),Bash(node tools/solomon.js done *)';
  const before = readJsonl(REVIEWS).filter(x => x.kind === 'section').length;
  // claude is a .cmd on Windows, so this goes through a shell: one quoted string, or the rules split at their spaces.
  const r = spawnSync(`${claude} --agent caleb -p "Take the next Solomon section. Follow your instructions and stop." --allowedTools "${allowed}"`,
    { cwd: REPO, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status === null ? 1 : r.status);
  if (readJsonl(REVIEWS).filter(x => x.kind === 'section').length === before) die('Caleb stopped without closing a section.');
  publish();
}

/* ---- the solomon-data branch (SOL-Q2 = B) ---- */

// A branch of its own history holding only Solomon/data: no checkout and no branch switch here, so it can
// run while other sessions work on main, and nothing else can reach GitHub this way.
const BRANCH = 'solomon-data';
const DATA_FILES = [SIGNALS, REVIEWS, RULINGS];
const NO_PROMPT = { ...process.env, GIT_TERMINAL_PROMPT: '0' };   // a scheduled run has nobody to answer one

// The phone rules on the branch, so its lines come here before anything goes back up.
function pullRulings() {
  let found;
  try { found = git(['ls-remote', '--heads', 'origin', BRANCH], NO_PROMPT).trim(); }
  catch { die('No link to origin; the data stays here for the next run.'); }
  if (!found) return { tip: null, fresh: 0 };
  git(['fetch', '--quiet', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`], NO_PROMPT);
  const tip = git(['rev-parse', `refs/remotes/origin/${BRANCH}`]).trim();
  const have = new Set(readJsonl(RULINGS).map(x => JSON.stringify(x)));
  const fresh = git(['show', `${tip}:Solomon/data/rulings.jsonl`]).split('\n').filter(l => l && !have.has(JSON.stringify(JSON.parse(l))));
  if (fresh.length) fs.appendFileSync(RULINGS, fresh.join('\n') + '\n');
  return { tip, fresh: fresh.length };
}

// Null when the branch already holds exactly these files.
function commitData(parent, message) {
  const index = path.join(os.tmpdir(), `solomon-index-${process.pid}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    for (const f of DATA_FILES) {
      const blob = git(['hash-object', '-w', '--no-filters', f]).trim();
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path.relative(REPO, f).replace(/\\/g, '/')}`], env);
    }
    const tree = git(['write-tree'], env).trim();
    if (parent && git(['rev-parse', `${parent}^{tree}`]).trim() === tree) return null;
    return git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message]).trim();
  } finally { fs.rmSync(index, { force: true }); }
}

function publish() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { tip } = pullRulings();
    const data = scan();
    const clean = spawnSync(process.execPath, ['tools/anonymise.js', '--check', ...DATA_FILES], { cwd: REPO, stdio: 'inherit' });
    if (clean.status !== 0) die('Not pushed: Solomon/data did not pass the anonymise check.');
    const sha = commitData(tip, `solomon-data: ${data.generated}`);
    if (!sha) { console.log(`${BRANCH} is up to date`); return; }
    const push = spawnSync('git', ['push', '--quiet', 'origin', `${sha}:refs/heads/${BRANCH}`], { cwd: REPO, encoding: 'utf8', env: NO_PROMPT });
    if (push.status === 0) {
      git(['update-ref', `refs/heads/${BRANCH}`, sha]);   // a local branch too, so BACKUP's push --all carries it
      console.log(`pushed ${sha.slice(0, 7)} to ${BRANCH}`);
      return;
    }
    if (!/rejected|fetch first|non-fast-forward/.test(push.stderr)) die(`Not pushed, the data stays here for the next run: ${push.stderr.trim()}`);
    // A ruling landed in between: take it and try again. Never forced.
  }
  die(`Not pushed: ${BRANCH} kept moving.`);
}

function cmdPull() {
  const { fresh } = pullRulings();
  if (fresh) scan();
  console.log(`${fresh} new ruling(s) from ${BRANCH}`);
}

function die(msg) { console.error(msg); process.exit(1); }

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'scan') {
  const d = scan();
  console.log(`${d.docs.length} documents in ${d.sections.length} sections, ${d.signals.length} signals: ${JSON.stringify(counts(d.signals))}`);
} else if (cmd === 'next') cmdNext();
else if (cmd === 'flag') cmdFlag(...args);
else if (cmd === 'report') cmdReport(...args);
else if (cmd === 'done') cmdDone(...args);
else if (cmd === 'rule') cmdRule(...args);
else if (cmd === 'intern') cmdIntern();
else if (cmd === 'publish') publish();
else if (cmd === 'pull') cmdPull();
else die('usage: solomon.js scan | next | flag | report | done | rule | intern | publish | pull');
