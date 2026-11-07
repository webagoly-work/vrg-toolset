// VRG Stack — one adapter per layer. Each reads its own source as it is and returns
//   { nodes: [{ id, kind, title, brief, t, state, own: [keys], text, extra }], edges: [{ a, b, rel }] }
// Adapters never write to a source. Node ids are "<layer code>:<local id>" and stay stable
// as long as the source's own ids do.
'use strict';

const C = require('./common');
const { read, exists, git, clip, day, fold, normPath, REPO, NOTES, MEMORY, CLAUDE_HOME, FULL, fs, path } = C;

/* Rows like "f12" in a mindmap source are only unique inside that source, so ids get the layer code. */
const node = (L, id, o) => Object.assign({ id: `${L}:${id}`, own: [], text: '', state: '', t: '', brief: '' }, o);
const fresh = mod => { delete require.cache[require.resolve(mod)]; return require(mod); };
const frontmatter = s => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(s); const o = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) o[k[1]] = k[2].replace(/^["']|["']$/g, ''); }
  return o;
};
const firstPara = s => clip(s.replace(/^---[\s\S]*?---/, '').replace(/^#.*$/gm, '').replace(/^>.*$/gm, '').trim().split(/\r?\n\s*\r?\n/)[0] || '', 260);
const heading = (s, fb) => (/^#\s+(.+)$/m.exec(s) || [])[1] || fb;

/* ============================================================ F · Featured (top: what the user touches) */
function featured() {
  const src = fresh(NOTES + '/features/features.json');
  const tierName = { 1: 'in use', 2: 'built', 3: 'in development', 4: 'planned', 5: 'idea' };
  const nodes = [], edges = [];
  for (const f of src.features) {
    nodes.push(node('F', f.id, {
      kind: f.kind, title: f.title, brief: f.brief, state: tierName[f.tier] || '', tier: f.tier, lane: f.lane,
      own: ['ft:' + f.id], text: [f.title, f.brief, f.open, f.next].join(' \n'),
      extra: { open: f.open, next: f.next },
    }));
    for (const l of f.links || []) edges.push({ a: 'F:' + f.id, b: 'F:' + l.to, rel: l.kind });
  }
  return { nodes, edges, lanes: src.lanes };
}

/* ============================================================ I · Ideas (why things exist, on a time axis) */
function ideas() {
  const src = fresh(NOTES + '/idea-timeline/data.js');
  const type = { B: 'built', D: 'document', I: 'inferred', X: 'dormant', Q: 'question' };
  const nodes = src.NODES.map(([id, lane, date, ty, title, brief, evidence, fate]) => node('I', id, {
    kind: type[ty] || ty, title, brief, t: date.replace('~', ''), lane, state: fate ? clip(fate, 80) : '',
    text: [title, brief, evidence, fate].join(' \n'), extra: { evidence, inferredDate: date.startsWith('~') },
  }));
  const edges = src.LINKS.map(([a, b, rel, inf]) => ({ a: 'I:' + a, b: 'I:' + b, rel: rel + (inf ? '?' : '') }));
  return { nodes, edges };
}

/* ============================================================ Q · Decisions (questions asked, answers given) */
// Decision files differ in shape, so this reads them loosely: every "<NS>-Qn" or a bold local
// "Qn" at the start of a line is one decision; it counts as answered when its own text block
// carries "= X", "Answered", "Válasz" or a struck-through option. Marked ≈ until a file
// declares its namespace explicitly (see LAYERS.md, Q layer).
const DECISION_FILES_EXTRA = [
  FULL + '/Varler_Workflow_Kit/DECISIONS_L1-L18.md',
];
const NS_BY_FILE = [ // a local "Q01" in these files belongs to this namespace
  [/docs\/hub\//, 'HUB'], [/docs\/solomon\//, 'SOL'], [/docs\/council\//, 'COUNCIL'], [/docs\/mobile\//, 'MOB'],
  [/docs\/city\//, 'CITY'], [/views\//, 'D-V'], [/round-2026-10-18/, 'R1018'], [/round-2026-10-22-villany/, 'R1022'],
  [/docs\/mcp\//, 'MCP'], [/BRIDGE/, 'BRIDGE'], [/Workflow_Kit/, 'KIT'], [/varler-planner\/docs\/DECISIONS/, 'PLN'],
];
function decisions(facts) {
  const files = facts.files.filter(f => /decisions/i.test(f) && /\.md$/.test(f)).concat(DECISION_FILES_EXTRA.filter(exists));
  const nodes = [], edges = [];
  for (const f of files) {
    const abs = f.includes(':') ? f : REPO + '/' + f;
    const rel = normPath(f);
    const txt = read(abs);
    const fileId = 'file.' + rel.replace(/[^\w]+/g, '_').slice(-60);
    const ns = (NS_BY_FILE.find(([rx]) => rx.test(rel)) || [, 'X'])[1];
    const items = new Map();
    const lines = txt.split(/\r?\n/);
    const LEAD = /^[\s|>#*\-]+/;
    const idOf = rest => {
      let m;
      if ((m = /^([A-Z][A-Z0-9]{0,11}(?:-[A-Z0-9]{1,8}){0,2})-Q-?(\d{1,3})([a-z]?)\b/.exec(rest))) return C.qid(m[1], m[2], m[3]);
      if ((m = /^D-V(\d+[a-z]?)-(\d+[a-z]?)\b/.exec(rest))) return `D-V${m[1]}-${m[2]}`;
      if ((m = /^Q-?([A-Z]{0,2})(\d{1,3})([a-z]?)\b/.exec(rest))) return `${ns}-Q${m[1]}${parseInt(m[2], 10)}${m[3]}`;
      if (ns === 'KIT' && (m = /^L-(\d{1,2})\b/.exec(rest))) return `KIT-L${m[1]}`;
      return null;
    };
    let section = ''; // "## Answered …" / "## Open …" headings decide for the items under them
    lines.forEach((l, i) => {
      const h = /^#{1,3}\s+(.*)$/.exec(l);
      if (h && !idOf(h[1].replace(/^\*\*/, ''))) { section = /answer|válasz|decided|döntött/i.test(h[1]) ? 'answered' : /\bopen\b|nyitott|held open|waiting/i.test(h[1]) ? 'open' : section; return; }
      const id = idOf(l.replace(LEAD, '')); if (!id) return;
      // the item's own text: up to the next item or heading, at most 8 lines
      let end = i + 1; while (end < lines.length && end < i + 8 && !/^#{1,3}\s/.test(lines[end]) && !idOf(lines[end].replace(LEAD, ''))) end++;
      const block = lines.slice(i, end).join('\n');
      const own = /=\s*\**[A-F]\b|answered|válasz|döntés:|~~|\bchose\b|\bdecided\b|\|\s*\*\*[A-F]\b|^\|[^|]+\|\s*[A-F]\b/i.test(l + '\n' + block);
      const answered = section === 'open' ? /answered|=\s*\**[A-F]\b/i.test(l) : own || section === 'answered';
      const prev = items.get(id);
      const title = clip(l.replace(LEAD, '').replace(/\*\*/g, '').replace(/^\|/, '').replace(/\s*\|\s*/g, ' · '), 120);
      if (!prev) items.set(id, { id, line: i + 1, title, answered, block });
      else if (answered) prev.answered = true;
    });
    // answer tables: "| S1 | **B** | …" under an Answers heading answers Q-S1 / Q01 / Q-02
    section = '';
    lines.forEach(l => {
      const h = /^#{1,3}\s+(.*)$/.exec(l); if (h) { section = /answer|válasz/i.test(h[1]) ? 'answered' : ''; return; }
      if (section !== 'answered') return;
      const m = /^\|\s*\**(?:Q-?)?([A-Z]{0,2})-?(\d{1,3})([a-z]?)\**\s*\|\s*\**([A-F])\b/.exec(l); if (!m) return;
      const it = items.get(`${ns}-Q${m[1]}${parseInt(m[2], 10)}${m[3]}`); if (it) it.answered = true;
    });
    // a file-wide default ("Unanswered = A", "took every open question at its recommended answer")
    const byDefault = /unanswered\s*=\s*\**A|every open question at its recommended/i.test(txt);
    for (const it of items.values()) if (!it.answered && byDefault) it.byDefault = true;
    nodes.push(node('Q', fileId, {
      kind: 'decision-file', title: heading(txt, path.basename(rel)), brief: `${items.size} decisions in ${rel}`,
      own: ['p:' + rel], t: '', text: txt.slice(0, 1500), extra: { path: rel, ns },
    }));
    for (const it of items.values()) {
      const nid = 'Q:' + it.id;
      if (nodes.some(n => n.id === nid)) { edges.push({ a: 'Q:' + fileId, b: nid, rel: 'holds' }); continue; }
      nodes.push({ id: nid, kind: 'decision', title: it.id + ' — ' + clip(it.title.replace(/^[A-Z0-9\-]+\s*/, '').replace(/^[\s—:.·\-]+/, ''), 100),
        brief: clip(it.block, 240), state: it.answered ? 'answered' : it.byDefault ? 'default A' : 'open≈', own: ['q:' + it.id], t: '',
        text: it.block, extra: { path: rel, line: it.line } });
      edges.push({ a: 'Q:' + fileId, b: nid, rel: 'holds' });
    }
  }
  return { nodes, edges };
}

/* ============================================================ L · DevLog (the work process: lines + sessions) */
function devlog() {
  const { LANES, LINES, ASSIGN } = fresh(NOTES + '/devlog/lines.js');
  const sessions = fresh(NOTES + '/devlog/sessions.json');
  const nodes = [], edges = [];
  for (const l of LINES) {
    nodes.push(node('L', l.id, {
      kind: 'line', title: l.name, brief: l.brief, state: l.status, lane: l.lane, own: ['ln:' + l.id],
      text: [l.name, l.brief, (l.milestones || []).map(m => m.join(' ')).join('\n'), (l.remaining || []).join('\n'), l.nextStep, (l.notes || []).join('\n')].join('\n'),
      t: (l.milestones || []).length ? '2026-' + l.milestones[l.milestones.length - 1][0] : '',
      extra: { nextStep: l.nextStep, remaining: l.remaining || [], notes: l.notes || [], doc: `notes/devlog/lines/${l.id}.md` },
    }));
    if (l.from) edges.push({ a: 'L:' + l.from[0], b: 'L:' + l.id, rel: 'fork' });
    if (l.by) edges.push({ a: 'L:' + l.id, b: 'L:' + l.by[0], rel: l.status === 'overruled' ? 'overruled-by' : 'absorbed-by' });
    for (const [n] of l.next || []) edges.push({ a: 'L:' + l.id, b: 'L:' + n, rel: 'next' });
    for (const [n] of l.feeds || []) edges.push({ a: 'L:' + l.id, b: 'L:' + n, rel: 'feeds' });
  }
  const lineOf = s => { const a = ASSIGN[s.id.slice(0, 8)]; return Array.isArray(a) ? a.map(x => x[1]) : a ? [a] : []; };
  for (const s of sessions) {
    const sid = s.id.slice(0, 8);
    const prompts = s.prompts || [];
    const files = [...new Set(prompts.flatMap(p => p.files || []))];
    nodes.push(node('L', 's' + sid, {
      kind: 'session', title: s.title || s.aiTitle || sid, t: day(s.start),
      brief: clip(prompts[0] ? prompts[0].text : '', 220), state: `${prompts.length} prompts`,
      own: ['s:' + sid], text: [s.title, s.aiTitle, prompts.map(p => p.text + '\n' + (p.reply || '')).join('\n'), files.join('\n')].join('\n'),
      extra: { project: s.project, cwd: s.cwd, start: s.start, end: s.end, prompts: prompts.length, files: files.slice(0, 40), forkOf: s.forkOf },
    }));
    for (const ln of lineOf(s)) if (ln) edges.push({ a: 'L:s' + sid, b: 'L:' + ln, rel: 'on-line' });
    if (s.forkOf) edges.push({ a: 'L:s' + String(s.forkOf).slice(0, 8), b: 'L:s' + sid, rel: 'fork' });
  }
  return { nodes, edges, lanes: LANES };
}

/* ============================================================ A · Agentic backbone (what agents read and run on) */
function agentic(facts) {
  const nodes = [], edges = [];
  const add = (id, o) => { nodes.push(node('A', id, o)); return 'A:' + id; };
  // memory: one fact per file, [[links]] between them
  for (const f of fs.readdirSync(MEMORY).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')) {
    const txt = read(MEMORY + '/' + f); const fm = frontmatter(txt); const slug = f.replace(/\.md$/, '');
    const type = (/type:\s*(\w+)/.exec(txt) || [])[1] || 'memory';
    add('mem.' + slug, { kind: 'memory/' + type, title: slug, brief: clip(fm.description || firstPara(txt), 240), own: ['m:' + slug, 'p:' + MEMORY + '/' + f],
      t: day((/modified:\s*(\S+)/.exec(txt) || [])[1]), text: txt, extra: { path: MEMORY + '/' + f } });
  }
  const repoMd = (rx, kind, idp, ownKey) => facts.files.filter(f => rx.test(f)).forEach(f => {
    const txt = read(REPO + '/' + f); const base = path.basename(f, '.md'); const fm = frontmatter(txt);
    add(idp + base, { kind, title: fm.name || heading(txt, base), brief: clip(fm.description || firstPara(txt), 240),
      own: ['p:' + f].concat(ownKey ? [ownKey(base)] : []), text: txt, extra: { path: f } });
  });
  repoMd(/^\.claude\/agents\/[^/]+\.md$/, 'agent', 'agent.', b => 'ag:' + b);
  repoMd(/^docs\/hub\/agents\/[^/]+\.md$/, 'brief', 'brief.', b => 'br:' + b);
  repoMd(/^GO-[A-Z0-9]+\.md$/, 'codephrase (live)', 'go.', b => 'go:' + b.slice(3));
  repoMd(/^docs\/go-archive\/GO-[A-Z0-9]+\.md$/, 'codephrase (archived)', 'goarch.', b => 'go:' + b.slice(3).replace(/-\d{4}-\d\d-\d\d$/, ''));
  repoMd(/(^|\/)CLAUDE\.md$/, 'house rules (CLAUDE.md)', 'claude.', null);
  repoMd(/^docs\/council\/[^/]+\.md$/, 'council doc', 'council.', null);
  repoMd(/^docs\/workflow\/[^/]+\.md$/, 'workflow doc', 'wf.', null);
  // the agent tools: scripts that exist so a session spends fewer tokens or stays inside rules
  for (const t of ['vrg-ctx', 'brief-state', 'council-gate', 'standin', 'solomon', 'anonymise', 'check-start', 'divergence']) {
    const f = `tools/${t}.js`; if (!facts.paths.has(f)) continue;
    const txt = read(REPO + '/' + f);
    const doc = (txt.match(/^\/\/.*$/gm) || []).slice(0, 14).map(l => l.replace(/^\/\/\s?-*/, '')).join(' ');
    add('tool.' + t, { kind: 'agent tool', title: f, brief: clip(doc, 240), own: ['p:' + f], text: doc, extra: { path: f } });
  }
  // the Workflow Kit (outside the repo): its top documents
  const KIT = FULL + '/Varler_Workflow_Kit';
  if (exists(KIT)) for (const f of fs.readdirSync(KIT).filter(f => f.endsWith('.md'))) {
    const txt = read(KIT + '/' + f);
    add('kit.' + f.replace(/\.md$/, ''), { kind: 'workflow kit', title: 'Workflow Kit · ' + heading(txt, f), brief: firstPara(txt),
      own: ['p:' + KIT + '/' + f], text: txt, extra: { path: KIT + '/' + f } });
  }
  // scheduled tasks + skills
  const ST = CLAUDE_HOME + '/scheduled-tasks';
  if (exists(ST)) for (const d of fs.readdirSync(ST)) {
    const f = `${ST}/${d}/SKILL.md`; if (!exists(f)) continue; const txt = read(f); const fm = frontmatter(txt);
    add('sched.' + d, { kind: 'scheduled task', title: d, brief: clip(fm.description || firstPara(txt), 240), own: ['p:' + f], text: txt, extra: { path: f } });
  }
  // the generators of the other layers are agentic machinery too: each map is a script
  for (const [id, dir, what] of [['gen.features', 'features', 'Featured map'], ['gen.devlog', 'devlog', 'DevLog lines + sessions'],
    ['gen.devrep', 'devrep', 'DevRep git map'], ['gen.ideas', 'idea-timeline', 'Idea timeline'], ['gen.dashboard', 'dashboard', 'Desktop Dashboard data'], ['gen.stack', 'stack', 'This stack']]) {
    add(id, { kind: 'generator', title: `notes/${dir}/build.js`, brief: `Rebuilds the ${what}.`, own: ['p:' + NOTES + '/' + dir], text: what });
  }
  // memory [[links]] become horizontal edges in the join (they are ref keys m:…)
  return { nodes, edges };
}

/* ============================================================ R · DevRepo (git: what was committed when) */
function devrepo() {
  const SEP = '\x1e', US = '\x1f';
  const raw = git('log', '--all', '--date=iso-strict', `--format=${SEP}%h${US}%p${US}%ad${US}%an${US}%D${US}%s${US}%b`, '--name-only');
  const tldr = fresh(NOTES + '/devrep/notes.js');
  const nodes = [], edges = [];
  for (const rec of raw.split(SEP).filter(Boolean)) {
    const [h, parents, date, author, refs, subject, rest] = rec.split(US);
    const lines = (rest || '').split('\n');
    // after the body git prints a blank line, then the file list
    const files = []; const body = [];
    let inFiles = false;
    for (const l of lines) { if (!inFiles && l === '' && body.length) inFiles = true; (inFiles && l ? files : body).push(l); }
    const h7 = h.slice(0, 7);
    const ps = parents.trim() ? parents.trim().split(' ') : [];
    const tl = tldr['S' + h7] || tldr['M' + h7];
    nodes.push(node('R', h7, {
      kind: ps.length > 1 ? 'merge' : tl ? 'session start' : 'commit', title: subject, t: day(date),
      brief: clip(tl || body.join(' '), 240), state: refs ? clip(refs, 60) : '', own: ['c:' + h7],
      text: [subject, body.join('\n'), files.join('\n')].join('\n'),
      extra: { date, author, files: files.filter(Boolean).slice(0, 60), nFiles: files.filter(Boolean).length, tldr: tl || '' },
    }));
    for (const p of ps) edges.push({ a: 'R:' + p.slice(0, 7), b: 'R:' + h7, rel: ps.length > 1 && p !== ps[0] ? 'merged-in' : 'parent' });
  }
  return { nodes, edges };
}

/* ============================================================ C · Code (the repo as a tree of modules) */
// Folders down to three levels (Vendor and dist stay one node each). A file is not a node:
// a mention of a file lands on its folder here, or on the document itself in the Globe.
function code(facts, commitsByPath) {
  const nodes = [], edges = [];
  const depth = d => d.split('/').length;
  // a heavy folder (vendored code, build output, fonts …) is one node; nothing below it
  const HEAVY = /^(Vendor|node_modules|dist|lib|vendor|_build|assets|fonts|img|build|out|res|gradle)$/;
  const shallow = d => { const seg = d.split('/'); return seg.length <= 3 && !seg.slice(0, -1).some(s => HEAVY.test(s)); };
  const dirs = [...facts.dirs].filter(d => (shallow(d) && !/(^|\/)\./.test(d)) || d === '.claude' || d === '.claude/agents').sort();
  const stats = new Map(dirs.map(d => [d, { files: 0, bytes: 0, ext: {}, last: '' }]));
  for (const f of facts.files) {
    let d = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    while (d && !stats.has(d)) d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '';
    const s = d ? stats.get(d) : null; if (!s) continue;
    s.files++; const e = (/\.(\w+)$/.exec(f) || [, '-'])[1]; s.ext[e] = (s.ext[e] || 0) + 1;
    const last = commitsByPath.get(f); if (last && last > s.last) s.last = last;
  }
  // roll counts up so a module node says how big it is with everything under it
  const total = new Map();
  for (const d of dirs) { let t = 0, last = ''; for (const [k, s] of stats) if (k === d || k.startsWith(d + '/')) { t += s.files; if (s.last > last) last = s.last; } total.set(d, { t, last }); }
  for (const d of dirs) {
    const s = stats.get(d); const tt = total.get(d);
    const top = Object.entries(s.ext).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, n]) => `${n} .${e}`).join(', ');
    let readme = '';
    for (const r of ['README.md', 'CLAUDE.md']) if (facts.paths.has(d + '/' + r)) { readme = firstPara(read(REPO + '/' + d + '/' + r)); break; }
    nodes.push(node('C', d, {
      kind: depth(d) === 1 ? 'module' : 'folder', title: d, brief: readme || `${tt.t} files${top ? ' (here: ' + top + ')' : ''}`,
      t: tt.last, state: `${tt.t} files`, own: ['p:' + d], text: d.replace(/[\/_\-]/g, ' ') + ' ' + readme, extra: { files: tt.t, here: s.files },
    }));
    if (d.includes('/')) { const parent = d.slice(0, d.lastIndexOf('/')); if (stats.has(parent)) edges.push({ a: 'C:' + parent, b: 'C:' + d, rel: 'contains' }); }
  }
  return { nodes, edges };
}

/* ============================================================ G · Data Globe (the documents: Solomon's corpus) */
function globe(facts) {
  const sig = fresh(REPO + '/Solomon/data/signals.json');
  const nodes = [], edges = [];
  for (const s of sig.sections) nodes.push(node('G', 'sec.' + s.id, { kind: 'section', title: s.n, brief: s.summary || `${s.docs} documents, not reviewed yet`,
    t: s.reviewed || '', state: s.reviewed ? 'reviewed' : 'unreviewed', text: s.n + ' ' + (s.summary || '') }));
  for (const d of sig.docs) {
    const abs = REPO + '/' + d.p; if (!exists(abs)) continue;
    const txt = read(abs);
    nodes.push(node('G', d.p, { kind: 'document', title: heading(txt, d.t), brief: firstPara(txt), t: d.d, state: d.s,
      own: ['p:' + d.p], text: txt.slice(0, 60000), extra: { path: d.p, section: d.s, cited: d.i } }));
    edges.push({ a: 'G:sec.' + d.s, b: 'G:' + d.p, rel: 'holds' });
  }
  for (const s of sig.signals) {
    nodes.push(node('G', 'sig.' + s.id, { kind: 'signal/' + s.type, title: s.title, state: s.stage,
      brief: clip([s.a && `${s.a.p}:${s.a.line} ${s.a.text}`, s.b && `↔ ${s.b.p}:${s.b.line} ${s.b.text}`].filter(Boolean).join(' '), 260),
      text: JSON.stringify(s), extra: { type: s.type, stage: s.stage } }));
    for (const side of [s.a, s.b]) if (side && side.p) edges.push({ a: 'G:sig.' + s.id, b: 'G:' + side.p, rel: 'flags' });
  }
  return { nodes, edges, generated: sig.generated, commit: sig.commit };
}

module.exports = { featured, ideas, decisions, devlog, agentic, devrepo, code, globe };
