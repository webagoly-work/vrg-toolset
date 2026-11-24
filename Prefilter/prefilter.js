// prefilter.js — VRG Előszűrő (Prefilter): an offline judgement on a prompt before it starts a new Claude Code session.
//   const pf = require('<repo>/Prefilter/prefilter.js');
//   const index = pf.buildIndex({ repo, full })                    // reads the local sources; a missing `full` (cloud) is fine
//   const index = pf.loadIndex({ repo, full, cacheDir?, rebuild? }) // the same, cached in Prefilter/.cache/ (gitignored: job codes)
//   const a = pf.analyze(text, { index, attachments: [{ name, ext, size? }], now?, rules? })
//     → { verdict: 'context'|'independent'|'unsure', score, threshold, intent, signals, anchors, model, reasons, ms }
//   const d = pf.dress(text, a, { mode: 'auto'|'context'|'independent'|'unsure', rules? })
//     → { prompt, parts: { before, user, after }, length, overhead, verdict }
// Decision: every hint the prompt gives (a codephrase, a job code, a branch, a repo path or file, a catalog / START / Stack name, a
// word that is specific to the VRG corpus, a continuation word) is a signal with a weight from rules.json; the score is their
// noisy-or 1 − Π(1 − w). ≥ thresholds.context → context, < thresholds.independent → independent, between → unsure.
// Words are compared accent-folded and lightly stemmed (Hungarian case and plural endings, an English plural), so "Plannerben",
// "Planner-t" and "planner" are one word. Nothing here touches the network or writes outside cacheDir.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const HERE = __dirname;
const INDEX_VERSION = 2;
let RULES = null, COMMON = null;
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
function loadRules() { if (!RULES) RULES = readJson(path.join(HERE, 'rules.json')); return RULES; }
function common() {
  if (!COMMON) { const c = readJson(path.join(HERE, 'common-words.json')); COMMON = new Set([...c.hu, ...c.en]); }
  return COMMON;
}

// ------------------------------------------------------------ words
const fold = s => String(s == null ? '' : s).normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase();
const SUF3 = ['bol', 'rol', 'tol', 'ban', 'ben', 'nak', 'nek', 'val', 'vel', 'hoz', 'hez'];
const SUF2 = ['ig', 'ra', 're', 'ba', 'be', 'on', 'en', 'ot', 'at', 'et', 'ok', 'ek', 'ak'];
const SUF1 = ['k', 't', 's', 'n'];
const HYPHEN_LIST = [...SUF3, ...SUF2, ...SUF1, 'as', 'es', 'os', 'nal', 'nel', 'tol', 'ig', 'ja', 'je', 'ai', 'ei'];
const HYPHEN_SUFFIX_RAW = new RegExp('-(?:' + HYPHEN_LIST.join('|') + ')$', 'i');
const HYPHEN_SUFFIX = new RegExp('-(?:' + [...SUF3, ...SUF2, ...SUF1, 'as', 'es', 'os', 'nal', 'nel', 'tol', 'ig', 'ja', 'je', 'ai', 'ei'].join('|') + ')\\b', 'g');

// one folded word → its stem (one ending stripped, the stem keeps ≥ 4 letters; words with digits are kept whole)
function stem(w) {
  if (!w || /\d/.test(w) || w.length < 5) return w;
  for (const s of SUF3) if (w.length >= 7 && w.endsWith(s)) return w.slice(0, -s.length);
  for (const s of SUF2) if (w.length >= 6 && w.endsWith(s)) return w.slice(0, -s.length);
  for (const s of SUF1) if (w.endsWith(s)) return w.slice(0, -1);
  return w;
}

// text → [{ raw, norm, stem, at }]; raw is the original spelling (for reports), norm the folded word
function tokenize(text) {
  const orig = String(text == null ? '' : text).normalize('NFC');
  const f = fold(orig).replace(HYPHEN_SUFFIX, m => ' '.repeat(m.length));   // "M16-ot" → "m16   "; lengths stay aligned with orig
  const out = [];
  const re = /[a-z0-9]+/g; let m;
  while ((m = re.exec(f))) out.push({ raw: orig.slice(m.index, m.index + m[0].length), norm: m[0], stem: stem(m[0]), at: m.index });
  return out;
}
const stems = text => tokenize(text).map(t => t.stem);

// ------------------------------------------------------------ the index
function walk(dir, pred, max = 5000, depth = 8, out = []) {
  if (depth < 0 || out.length >= max) return out;
  let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const d of list) {
    if (out.length >= max) break;
    if (d.name.startsWith('.') || d.name === 'node_modules' || d.name === 'Vendor') continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, pred, max, depth - 1, out); else if (pred(p)) out.push(p);
  }
  return out;
}
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } };
const exists = p => { try { fs.accessSync(p); return true; } catch (e) { return false; } };
const rel = (repo, p) => path.relative(repo, p).split(path.sep).join('/');

// the files the index is built from (for the cache signature)
function sourceList(repo, full) {
  const f = [path.join(repo, 'launcher', 'vrg-catalog.json'), path.join(repo, 'launcher', 'vrg-menu.json'), path.join(repo, 'CLAUDE.md')];
  try { for (const n of fs.readdirSync(repo).sort()) if (/^GO-[A-Z0-9-]+\.md$/.test(n)) f.push(path.join(repo, n)); } catch (e) {}
  f.push(...walk(path.join(repo, 'docs'), p => p.endsWith('.md'), 3000));
  f.push(path.join(repo, 'Stack', 'out', 'stack.sqlite'));
  f.push(path.join(repo, '.git', 'index'), path.join(repo, '.git', 'packed-refs'), path.join(repo, '.git', 'HEAD'));
  if (full) { f.push(path.join(full, 'notes', 'features', 'features.json'), path.join(full, 'jobs')); }
  return f;
}
function signature(repo, full) {
  const h = crypto.createHash('sha1');
  h.update('v' + INDEX_VERSION + '\n');
  for (const p of sourceList(repo, full)) h.update(p + ':' + mtime(p) + '\n');
  return h.digest('hex');
}

function repoFiles(repo, git) {
  try {
    const out = require('child_process').execFileSync(git || 'git', ['-C', repo, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const list = out.split('\0').filter(Boolean);
    if (list.length) return list.sort();
  } catch (e) { /* no git: walk */ }
  return walk(repo, () => true, 20000).map(p => rel(repo, p));
}
function branchNames(repo) {
  const out = new Set();
  const refs = path.join(repo, '.git', 'refs');
  for (const p of walk(refs, () => true, 2000, 6)) {
    const r = rel(refs, p);
    const name = r.replace(/^heads\//, '').replace(/^remotes\/[^/]+\//, '');
    if (/^(heads|remotes)\//.test(r) && name !== 'HEAD') out.add(name);
  }
  try {
    for (const l of fs.readFileSync(path.join(repo, '.git', 'packed-refs'), 'utf8').split('\n')) {
      const m = /^[0-9a-f]{40} refs\/(?:heads|remotes\/[^/]+)\/(.+)$/.exec(l.trim());
      if (m && m[1] !== 'HEAD') out.add(m[1]);
    }
  } catch (e) {}
  return [...out].sort();
}
const headings = text => String(text).split(/\r?\n/).filter(l => /^#{1,4}\s/.test(l)).map(l => l.replace(/^#+\s*/, '').replace(/[*`_]/g, '')).slice(0, 200);
function sections(text) {
  const out = []; let cur = [];
  for (const l of String(text).split(/\r?\n/)) { if (/^##\s/.test(l) && cur.length) { out.push(cur.join('\n')); cur = []; } cur.push(l); }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

// buildIndex → a plain JSON object (see README § Index)
function buildIndex({ repo, full, git } = {}) {
  const t0 = Date.now();
  repo = path.resolve(repo || path.join(HERE, '..'));
  full = full ? path.resolve(full) : null;
  if (full && !exists(full)) full = null;
  const units = [];                       // { tier: 'names'|'body', source, text }
  const entities = [];                    // { id, title, kind, source, toks }
  const used = [];
  const addEntity = (id, title, kind, source, phrase) => {
    const toks = stems(phrase || title).filter(Boolean);
    if (toks.length && toks.length <= 8) entities.push({ id: String(id), title: String(title).slice(0, 80), kind, source, toks });
  };

  // the catalog: ids and titles
  const catFile = path.join(repo, 'launcher', 'vrg-catalog.json');
  if (exists(catFile)) {
    used.push('launcher/vrg-catalog.json');
    for (const it of readJson(catFile).items || []) {
      const hu = it.title && it.title.hu || it.id, en = it.title && it.title.en || '';
      addEntity(it.id, hu, 'catalog', 'catalog:' + it.id, hu);
      if (en && fold(en) !== fold(hu)) addEntity(it.id, hu, 'catalog', 'catalog:' + it.id, en);
      addEntity(it.id, hu, 'catalog', 'catalog:' + it.id, it.id.replace(/[.:-]/g, ' '));
      units.push({ tier: 'names', source: 'catalog:' + it.id, text: [it.id.replace(/[.:-]/g, ' '), hu, en, it.qualifier || ''].join(' ') });
    }
  }
  // START: tools, projects, dev items, servers, programs
  const menuFile = path.join(repo, 'launcher', 'vrg-menu.json');
  if (exists(menuFile)) {
    used.push('launcher/vrg-menu.json');
    const m = readJson(menuFile);
    const s = m.start || {};
    const item = (x, where) => {
      if (!x || !x.name) return;
      addEntity('start:' + where + (x.key || x.name), x.name, 'tool', 'vrg-menu.json', x.name);
      units.push({ tier: 'names', source: 'vrg-menu.json', text: x.name + ' ' + (x.hint || '') });
      if (x.menu && Array.isArray(x.menu.items)) for (const y of x.menu.items) item(y, where + (x.key || '') + '/');
    };
    for (const k of ['tools', 'projects', 'dev', 'bottom']) for (const x of Array.isArray(s[k]) ? s[k] : []) item(x, '');
    for (const x of m.servers || []) { if (x && x.name) { addEntity('server:' + x.id, x.name, 'tool', 'vrg-menu.json', x.name); units.push({ tier: 'names', source: 'vrg-menu.json', text: x.name + ' ' + (x.id || '') }); } }
    for (const x of m.programs || []) if (x && x.name) units.push({ tier: 'names', source: 'vrg-menu.json', text: x.name });
  }
  // CLAUDE.md: the rules (headings = names, sections = body) and the codephrase list
  const codephrases = [], aliases = [];
  const claudeFile = path.join(repo, 'CLAUDE.md');
  let claudeText = '';
  if (exists(claudeFile)) {
    used.push('CLAUDE.md');
    claudeText = fs.readFileSync(claudeFile, 'utf8');
    units.push({ tier: 'names', source: 'CLAUDE.md', text: headings(claudeText).join('\n') });
    for (const sec of sections(claudeText)) units.push({ tier: 'body', source: 'CLAUDE.md', text: sec });
  }
  // GO-*.md: one codephrase each; headings = names, sections = body
  let goFiles = [];
  try { goFiles = fs.readdirSync(repo).filter(n => /^GO-[A-Z0-9-]+\.md$/.test(n)).sort(); } catch (e) {}
  for (const n of goFiles) {
    const text = fs.readFileSync(path.join(repo, n), 'utf8');
    used.push(n);
    const word = n.replace(/^GO-|\.md$/g, '').replace(/-/g, ' ');
    const first = (headings(text)[0] || '').replace(/^GO\s+[A-Z -]+[—-]\s*/, '');
    codephrases.push({ phrase: 'GO ' + word, file: n, title: first.slice(0, 80) });
    units.push({ tier: 'names', source: n, text: headings(text).join('\n') });
    for (const sec of sections(text)) units.push({ tier: 'body', source: n, text: sec });
  }
  // old phrases from CLAUDE.md: "R1010, R1018, FRAME, SUI → GO PLANNER · WIRE → GO ROUTE · …"
  const old = /\*\*Old phrases\*\*[^:]*:([\s\S]*?)(?:`docs\/go-archive|\n\n)/.exec(claudeText);
  if (old) {
    for (const part of old[1].replace(/\s+/g, ' ').split('·')) {
      const m = /^(.*?)→\s*GO\s+([A-Z]+)/.exec(part.trim());
      if (!m) continue;
      const file = 'GO-' + m[2] + '.md';
      if (!goFiles.includes(file)) continue;
      for (const a of m[1].split(',').map(x => x.trim()).filter(x => /^[A-Z0-9]{2,8}$/.test(x))) aliases.push({ alias: a, file, phrase: 'GO ' + m[2] });
    }
  }
  // docs/**/*.md: file and folder names + headings (names tier)
  for (const p of walk(path.join(repo, 'docs'), x => x.endsWith('.md'), 3000)) {
    const r = rel(repo, p);
    let text = ''; try { text = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    const name = r.replace(/^docs\//, '').replace(/\.md$/, '').replace(/[/_.-]+/g, ' ');
    units.push({ tier: 'names', source: r, text: name + '\n' + headings(text).join('\n') });
  }
  if (exists(path.join(repo, 'docs'))) used.push('docs/**/*.md');
  // the VRG Stack (read only, when built): node titles = names + entities (2–6 words), briefs = body
  let stackNodes = 0;
  const stackDb = path.join(repo, 'Stack', 'out', 'stack.sqlite');
  if (exists(stackDb)) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(stackDb, { readOnly: true });
      try {
        for (const r of db.prepare('SELECT id, layer, title, substr(brief, 1, 400) AS brief FROM nodes LIMIT 30000').all()) {
          if (!r.title) continue;
          stackNodes++;
          units.push({ tier: 'names', source: 'stack:' + r.id, text: r.title });
          if (r.brief) units.push({ tier: 'body', source: 'stack:' + r.id, text: r.brief });
          const n = stems(r.title).filter(w => !common().has(w)).length;
          if (n >= 2 && n <= 6) addEntity('stack:' + r.id, r.title, 'stack', 'stack:' + r.id, r.title);
        }
      } finally { db.close(); }
      used.push('Stack/out/stack.sqlite');
    } catch (e) { /* no node:sqlite (Electron) or an old DB: skip */ }
  }
  // the features map (on H: only)
  if (full) {
    const ff = path.join(full, 'notes', 'features', 'features.json');
    if (exists(ff)) {
      try {
        const seen = new Set();
        const visit = (v, d) => {
          if (d > 4 || !v) return;
          if (Array.isArray(v)) { v.forEach(x => visit(x, d + 1)); return; }
          if (typeof v !== 'object') return;
          const title = v.title || v.name;
          if (typeof title === 'string' && typeof v.id === 'string' && !seen.has(v.id)) {
            seen.add(v.id);
            addEntity('feat:' + v.id, title, 'feature', 'features.json', title);
            units.push({ tier: 'names', source: 'features.json', text: title });
          }
          for (const k of Object.keys(v)) if (typeof v[k] === 'object') visit(v[k], d + 1);
        };
        visit(readJson(ff), 0);
        used.push('notes/features/features.json');
      } catch (e) {}
    }
  }
  // job codes (client work: the cache is gitignored)
  const jobs = [];
  if (full) {
    try {
      for (const d of fs.readdirSync(path.join(full, 'jobs'), { withFileTypes: true })) {
        const m = d.isDirectory() && /^([A-Z]{1,3}\d{1,3})(?=$|[^0-9])/.exec(d.name);
        if (m) jobs.push(m[1]);
      }
      used.push('jobs/');
    } catch (e) {}
  }

  // term statistics: document frequency per tier, and the sources a name term comes from
  const names = {}, body = {};
  const nameRefs = {};
  for (const u of units) {
    const set = new Set(stems(u.text).filter(w => w.length >= 2));
    const tbl = u.tier === 'names' ? names : body;
    for (const w of set) {
      tbl[w] = (tbl[w] || 0) + 1;
      if (u.tier === 'names') { const r = nameRefs[w] = nameRefs[w] || {}; r[u.source] = (r[u.source] || 0) + 1; }
    }
  }
  const refs = {};
  for (const w of Object.keys(nameRefs)) refs[w] = Object.entries(nameRefs[w]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(e => e[0]);
  const files = repoFiles(repo, git);
  const top = [...new Set(files.map(f => f.split('/')[0]).filter(x => files.some(f => f.startsWith(x + '/'))))].sort();
  // the lexicon: the VRG world's own names (entities, codephrase words, top folders); a heading word that is not here is weaker
  const lex = {};
  const addLex = w => { if (w && w.length >= 2) lex[w] = (lex[w] || 0) + 1; };
  for (const e of entities) e.toks.forEach(addLex);
  for (const c of codephrases) stems(c.phrase).forEach(addLex);
  for (const d of top) stems(d).forEach(addLex);
  entities.sort((a, b) => (a.kind + a.id + a.toks.join(' ') < b.kind + b.id + b.toks.join(' ') ? -1 : 1));
  return {
    version: INDEX_VERSION, builtAt: Date.now(), sig: signature(repo, full), repoName: path.basename(repo),
    units: { names: units.filter(u => u.tier === 'names').length, body: units.filter(u => u.tier === 'body').length },
    names, body, lex, refs, entities, codephrases, aliases, files, topDirs: top, branches: branchNames(repo), jobs: [...new Set(jobs)].sort(),
    stats: { entities: entities.length, files: files.length, stackNodes, jobs: jobs.length, sources: used, ms: Date.now() - t0 },
  };
}

function loadIndex({ repo, full, cacheDir, rebuild, git } = {}) {
  repo = path.resolve(repo || path.join(HERE, '..'));
  const dir = cacheDir || path.join(HERE, '.cache');
  const file = path.join(dir, 'index.json');
  const sig = signature(repo, full && exists(full) ? path.resolve(full) : null);
  if (!rebuild) {
    try { const c = readJson(file); if (c && c.version === INDEX_VERSION && c.sig === sig) return c; } catch (e) { /* none or stale */ }
  }
  const idx = buildIndex({ repo, full, git });
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(idx)); } catch (e) { /* read-only: keep it in memory */ }
  return idx;
}

// ------------------------------------------------------------ analysis
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a rules word → a regex on folded text: "javit*" = a prefix, "nezd at" = a phrase, else a whole word
const wordRe = w => new RegExp('(?:^|[^a-z0-9])' + escapeRe(w.replace(/\*$/, '')).replace(/ /g, '\\s+') + (w.endsWith('*') ? '' : '(?![a-z0-9])'));
const reCache = new Map();
const hit = (folded, w) => { let r = reCache.get(w); if (!r) { r = wordRe(fold(w)); reCache.set(w, r); } return r.test(folded); };

const prepared = new WeakMap();
function prep(index) {
  let p = prepared.get(index);
  if (p) return p;
  const byFirst = new Map();
  for (const e of index.entities || []) { const k = e.toks[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(e); }
  const fileSet = new Set((index.files || []).map(f => f.toLowerCase()));
  const byBase = new Map();
  for (const f of index.files || []) { const b = f.split('/').pop().toLowerCase(); if (!byBase.has(b)) byBase.set(b, f); }
  const nNames = Math.max(1, (index.units && index.units.names) || 1), nBody = Math.max(1, (index.units && index.units.body) || 1);
  p = { byFirst, fileSet, byBase, nNames, nBody, jobs: new Set(index.jobs || []), top: new Set((index.topDirs || []).map(x => x.toLowerCase())) };
  prepared.set(index, p);
  return p;
}

function analyze(text, { index, attachments = [], rules, now } = {}) {
  const t0 = Date.now();
  const R = rules || loadRules(), W = R.weights;
  const idx = index || { names: {}, body: {}, refs: {}, entities: [], files: [], codephrases: [], aliases: [], branches: [], jobs: [] };
  const P = prep(idx);
  const C = common(), G = new Set((R.genericTech || []).map(fold));
  const orig = String(text == null ? '' : text).normalize('NFC');
  const folded = fold(orig);
  const toks = tokenize(orig);
  const signals = [];
  const add = (kind, txt, weight, ref) => signals.push({ kind, text: String(txt).slice(0, 80), weight: Math.round(weight * 1000) / 1000, ...(ref ? { ref } : {}) });

  // codephrases ("GO MOBILE") and their old aliases (typed in capitals: "WIRE")
  for (const c of idx.codephrases || []) if (new RegExp('(?:^|[^a-z0-9])' + escapeRe(fold(c.phrase)).replace(/ /g, '\\s+') + '(?![a-z0-9])').test(folded)) add('codephrase', c.phrase, W.codephrase, c.file);
  for (const a of idx.aliases || []) if (new RegExp('(?:^|[^A-Za-z0-9])' + escapeRe(a.alias) + '(?![A-Za-z0-9])').test(orig)) add('codephrase', a.alias, W.codephrase * 0.9, a.file);
  // job codes (exact, as typed)
  for (const m of orig.matchAll(/(?:^|[^A-Za-z0-9])([A-Z]{1,3}\d{1,3})(?![0-9])/g)) if (P.jobs.has(m[1])) add('job', m[1], W.job, 'jobs/' + m[1]);
  // branches (whole names; "main" is too common to count)
  for (const b of idx.branches || []) if (b !== 'main' && b !== 'master' && b.length >= 4 && new RegExp('(?:^|[^a-z0-9/_.-])' + escapeRe(fold(b)) + '(?![a-z0-9_-])').test(folded)) add('branch', b, W.branch, b);
  // paths and file names written in the prompt
  const seenFile = new Set(), spans = [];
  const cover = (at, len) => spans.push([at, at + len]);
  for (const m of orig.matchAll(/(?:[A-Za-z]:)?[\w\-./\\]*[\w\-]+\.([A-Za-z][A-Za-z0-9]{0,5})(?![\w])/g)) {
    const s = m[0].replace(/^[.\\/]+/, '');
    if (seenFile.has(s) || /^\d/.test(m[1]) || /^(?:e\.g|i\.e|pl|stb|ill)$/i.test(s)) continue;
    seenFile.add(s); cover(m.index, m[0].length);
    const norm = s.replace(/\\/g, '/').replace(/^[A-Za-z]:\/VRG\/Full\/Planner_VRG_U100\//i, '').replace(/^\.\//, '');
    if (/[\\/]/.test(s)) {
      if (P.fileSet.has(norm.toLowerCase())) add('path', s, W.path, norm);
      else if (P.top.has(norm.split('/')[0].toLowerCase()) || /VRG|Planner|^H:/i.test(s)) add('path', s, W.path * 0.75);
      else add('path', s, W.fileUnknown);
    } else {
      const hitPath = P.byBase.get(s.toLowerCase());
      if (hitPath) add('file', s, W.file, hitPath); else add('file', s, W.fileUnknown);
    }
  }
  // folder paths without an extension: "Dashboard/shell/lib"
  for (const m of orig.matchAll(/(?:^|[\s"'(`])([A-Za-z][\w-]*(?:[\\/][\w.-]+)+)[\\/]?(?=$|[\s"'),`:;])/g)) {
    const s = m[1].replace(HYPHEN_SUFFIX_RAW, '');
    const at = m.index + m[0].indexOf(m[1]);
    if (spans.some(([a, b]) => at < b && at + s.length > a) || /\.[A-Za-z][A-Za-z0-9]{0,5}$/.test(s) || /^https?/i.test(s)) continue;
    if (P.top.has(s.split(/[\\/]/)[0].toLowerCase())) { seenFile.add(s); cover(at, m[1].length); add('path', s, W.path * 0.9, s.replace(/\\/g, '/')); }
  }
  const inSpan = t => spans.some(([a, b]) => t.at >= a && t.at < b);
  // attachments
  for (const a of Array.isArray(attachments) ? attachments.slice(0, 50) : []) {
    const name = String(a && a.name || '').slice(0, 200);
    const ext = fold(a && a.ext || path.extname(name).slice(1));
    if (!name && !ext) continue;
    const inRepo = P.byBase.get(name.toLowerCase());
    if (inRepo) add('file', name, W.attachRepo, inRepo);
    else if ((R.vrgExts || []).includes(ext)) add('file', name || '.' + ext, W.attachVrgExt, 'attach:' + (name || '.' + ext));
    else add('file', name || '.' + ext, W.attachOther, 'attach:' + (name || '.' + ext));
  }
  // entities: catalog items, START tools and servers, features, Stack nodes — matched as phrases on the content words
  const content = toks.filter(t => !C.has(t.norm) && !C.has(t.stem) && !inSpan(t));
  const seenEnt = new Map();
  for (let i = 0; i < content.length; i++) {
    for (const e of P.byFirst.get(content[i].stem) || []) {
      const ent = e.toks.filter(w => !C.has(w));
      if (!ent.length) continue;
      let ok = true;
      for (let j = 0; j < ent.length; j++) if (!content[i + j] || content[i + j].stem !== ent[j]) { ok = false; break; }
      if (!ok) continue;
      const single = ent.length === 1;
      if (single && (G.has(ent[0]) || ent[0].length < 4)) continue;
      const w = (W[e.kind] || 0.4) * (single ? W.singleTokenEntity : 1);
      const prev = seenEnt.get(e.id);
      if (!prev || prev.w < w) seenEnt.set(e.id, { w, e, txt: content.slice(i, i + ent.length).map(t => t.raw).join(' ') });
    }
  }
  const ents = [...seenEnt.values()].sort((a, b) => b.w - a.w || (a.e.id < b.e.id ? -1 : 1)).slice(0, 6);
  for (const x of ents) add(x.e.kind, x.txt, x.w, x.e.id);
  // corpus terms: a word the VRG corpus names (catalog, START, headings, Stack titles) or only uses (bodies)
  const termSeen = new Set(), terms = [];
  for (const t of content) {
    if (termSeen.has(t.stem) || G.has(t.stem) || G.has(t.norm) || (t.stem.length < 3 && !/\d/.test(t.stem))) continue;
    termSeen.add(t.stem);
    const look = tbl => tbl && (tbl[t.stem] || (t.norm !== t.stem && tbl[t.norm]));
    const dn = look(idx.names), db = look(idx.body), dl = look(idx.lex);
    // a capitalised word inside a sentence is typed as a name: "a Kapu", "the Planner"
    const before = orig.slice(0, t.at).replace(/\s+$/, '');
    const cap = /^\p{Lu}/u.test(t.raw) && before.length > 0 && !/[.!?:\n]$/.test(before) ? W.capitalBoost : 1;
    const ref = (idx.refs && (idx.refs[t.stem] || idx.refs[t.norm]) || [])[0];
    if (dn || dl) {
      const spec = (dn || 0) / P.nNames > R.corpusDfCut ? 0.35 : 1;
      terms.push({ t, w: Math.min(0.6, (dl ? W.termName : W.termHeading) * spec * cap), ref });
    } else if (db) {
      const spec = db / P.nBody > R.corpusDfCut ? 0.35 : 1;
      terms.push({ t, w: Math.min(0.3, W.termBody * spec * cap) });
    }
  }
  terms.sort((a, b) => b.w - a.w || a.t.at - b.t.at);
  for (const x of terms.slice(0, W.termTop)) add('term', x.t.raw, x.w, x.ref);
  // continuation words: the prompt leans on earlier work
  let dStrong = 0, dWeak = 0;
  for (const d of (R.deictic && R.deictic.strong) || []) if (dStrong < 2 && hit(folded, d)) { add('deictic', d, W.deictic); dStrong++; }
  for (const d of (R.deictic && R.deictic.weak) || []) if (dWeak < 1 && hit(folded, d)) { add('deictic', d, W.deicticWeak); dWeak++; }
  // intent: the rules list with the most hits (ties: the earlier one)
  let intent = 'other', best = 0;
  for (const it of R.intents || []) {
    const n = it.words.filter(w => hit(folded, w)).length;
    if (n > best) { best = n; intent = it.id; }
  }
  if (intent !== 'other') add('intent', intent, W.intent);

  // the score: noisy-or of every signal
  const score = Math.round((1 - signals.reduce((p, s) => p * (1 - Math.min(0.99, s.weight)), 1)) * 1000) / 1000;
  const T = R.thresholds;
  const verdict = score >= T.context ? 'context' : score < T.independent ? 'independent' : 'unsure';
  const reasons = [];
  const strong = signals.filter(s => s.weight >= 0.5 && s.kind !== 'intent');
  const top = signals.filter(s => s.kind !== 'intent').sort((a, b) => b.weight - a.weight).map(s => s.text).filter((x, i, l) => l.indexOf(x) === i).slice(0, 4);
  if (verdict === 'context') reasons.push((strong.length ? 'erős VRG-jelek: ' : 'több gyenge VRG-jel együtt: ') + top.join(', '));
  else if (verdict === 'unsure') reasons.push('kevés vagy gyenge VRG-jel: ' + (top.join(', ') || '—'));
  else reasons.push('nincs VRG-horgony a szövegben');

  // anchors: entities and codephrases first, then the sources of the strongest corpus words, then paths
  const anchors = [], seenA = new Set();
  const pushA = a => { const k2 = 't:' + fold(a && a.title); if (a && a.id && !seenA.has(a.id) && !seenA.has(k2)) { seenA.add(a.id); seenA.add(k2); anchors.push(a); } };
  for (const s of signals.filter(s => s.kind === 'codephrase')) pushA({ id: s.ref, title: s.text, kind: 'codephrase', source: s.ref });
  for (const s of signals.filter(s => s.kind === 'job')) pushA({ id: s.ref, title: s.text, kind: 'job', source: 'jobs' });
  for (const x of ents) pushA({ id: x.e.id, title: x.e.title, kind: x.e.kind, source: x.e.source });
  for (const s of signals.filter(s => (s.kind === 'path' || s.kind === 'file' || s.kind === 'branch') && s.ref)) pushA({ id: s.ref, title: s.text, kind: s.kind, source: s.kind === 'branch' ? 'git' : /^attach:/.test(s.ref) ? 'melléklet' : s.ref });
  for (const s of signals.filter(s => s.kind === 'term' && s.ref)) pushA({ id: s.ref, title: s.text, kind: 'term', source: s.ref.replace(/^(catalog|stack):.*/, '$1') === s.ref ? s.ref : s.ref.split(':')[0] });

  // the model: by intent, cheaper for a plain question, one step up for a long prompt
  const M = R.models || {};
  let model = (M.byIntent && M.byIntent[intent]) || 'sonnet';
  reasons.push('szándék: ' + intent + ' → ' + model);
  if (verdict === 'independent' && intent === 'ask' && orig.length < 400 && M.independentAsk) { model = M.independentAsk; reasons.push('rövid önálló kérdés → ' + model); }
  if (verdict === 'context' && ['build', 'fix', 'review', 'continue'].includes(intent) && anchors.length && orig.length < 400 && model === 'opus') { model = 'sonnet'; reasons.push('szűk, horgonyzott feladat → sonnet'); }
  if (M.bumpLong && orig.length > (M.longPrompt || 900)) {
    const up = { haiku: 'sonnet', sonnet: 'opus', opus: 'opus' }[model];
    if (up !== model) reasons.push('hosszú kérés (' + orig.length + ' karakter) → ' + up);
    model = up;
  }
  return { verdict, score, threshold: { context: T.context, independent: T.independent }, intent, signals, anchors: anchors.slice(0, (R.dress && R.dress.maxAnchors) || 5),
    model, reasons, ms: Date.now() - t0, ...(now ? { at: now } : {}) };
}

// ------------------------------------------------------------ dressing
function dress(text, analysis, { mode = 'auto', rules } = {}) {
  const R = rules || loadRules(), D = R.dress;
  const a = analysis || analyze(text, {});
  const verdict = ['context', 'independent', 'unsure'].includes(mode) ? mode : a.verdict;
  const intentHu = ((R.intents || []).find(i => i.id === a.intent) || { hu: 'egyéb' }).hu;
  const anchors = (a.anchors || []).slice(0, D.maxAnchors || 5);
  const words = [];
  for (const s of a.signals || []) if (['codephrase', 'job', 'catalog', 'tool', 'feature', 'stack', 'term', 'goTopic', 'doc'].includes(s.kind) && !words.includes(s.text)) words.push(s.text);
  const stackQuery = words.slice(0, 4).join(' ').replace(/"/g, '') || String(text).slice(0, 40).replace(/["\s]+/g, ' ').trim();
  const goFiles = [...new Set(anchors.map(x => x.source).filter(s => /^GO-.*\.md$/.test(s)))];
  const vars = {
    intent_hu: intentHu, model: a.model || 'sonnet', stack_query: stackQuery,
    go_line: goFiles.length ? '2. Olvasd el a releváns szakaszt: ' + goFiles.join(', ') + ' (ne az egészet).' : '2. Ha a vonalnak van GO-fájlja (GO-*.md), csak a releváns szakaszát olvasd.',
    anchor_lines: anchors.length ? '3. Valószínű kapcsolódás: ' + anchors.map(x => x.title + (x.source && x.source !== x.title ? ' (' + x.source + ')' : '')).join('; ') + '.' : '',
    anchor_list: anchors.length ? anchors.map(x => x.title).join(', ') : 'nincs egyértelmű',
  };
  const fill = s => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const tpl = D[verdict];
  let before = (tpl.before || []).map(fill).filter(l => l.trim()).join('\n');
  let after = verdict === 'context' ? fill((tpl.after && (tpl.after[a.intent] || tpl.after.other)) || '') : fill(tpl.after || '');
  const max = D.maxOverhead || 1500;
  if (before.length + after.length > max) {
    before = before.split('\n').filter(l => !l.startsWith('3. ')).join('\n');
    if (before.length + after.length > max) before = before.slice(0, Math.max(0, max - after.length - 1));
  }
  const user = String(text == null ? '' : text);
  const prompt = [before, user, after].filter(Boolean).join('\n\n');
  return { prompt, parts: { before, user, after }, length: prompt.length, overhead: prompt.length - user.length, verdict };
}

module.exports = { buildIndex, loadIndex, analyze, dress, tokenize, stem, fold, stems, loadRules, signature, INDEX_VERSION };
