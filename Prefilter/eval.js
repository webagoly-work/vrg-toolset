#!/usr/bin/env node
// eval.js — how well the Előszűrő judges, on labelled prompts; and the labels themselves.
//   node Prefilter/eval.js run [--set seed|mine|all] [--misses]    accuracy, the confusion table and the weighted cost
//   node Prefilter/eval.js fit [--set …] [--write]                   the thresholds with the lowest weighted cost (--write: into rules.json)
//   node Prefilter/eval.js extract [--dir <claude config dir>]…      the first prompt of every local session → .cache/eval/candidates.jsonl
//   node Prefilter/eval.js label                                    label the candidates one by one: c = context, i = independent, s = skip, q = quit
// Sets: `seed` = eval/seed.jsonl (committed, made up, no client data); `mine` = .cache/eval/labels.jsonl (gitignored: your own prompts,
// from `label` and from the Vezérlő's overrides — a route you forced against the verdict is a label). `all` = both.
// Weighted cost (COST): calling a context prompt independent is the expensive mistake (a failed first turn on a weak model, no rules
// loaded), so it costs 3; the other way round costs 1 (tokens); "unsure" costs a little either way.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), readline = require('readline');

const HERE = __dirname, REPO = path.resolve(HERE, '..');
const CACHE = process.env.VRG_PREFILTER_CACHE || path.join(HERE, '.cache');
const EVAL = () => path.join(CACHE, 'eval');
const LABELS = ['context', 'independent'];
// COST[label][verdict]
const COST = { context: { context: 0, unsure: 0.3, independent: 3 }, independent: { independent: 0, unsure: 0.7, context: 1 } };

const readJsonl = f => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)); } catch (e) { return []; } };
const verdictOf = (score, T) => (score >= T.context ? 'context' : score < T.independent ? 'independent' : 'unsure');

// labelled rows [{ text, label }] + their scores → { n, correct, accuracy, cost, table:{ label:{ verdict:n } }, misses }
function evaluate(rows, T) {
  const table = { context: { context: 0, unsure: 0, independent: 0 }, independent: { context: 0, unsure: 0, independent: 0 } };
  let cost = 0, correct = 0;
  const misses = [];
  for (const r of rows) {
    if (!LABELS.includes(r.label) || typeof r.score !== 'number') continue;
    const v = verdictOf(r.score, T);
    table[r.label][v]++;
    cost += COST[r.label][v];
    if (v === r.label) correct++; else misses.push({ id: r.id, text: r.text, label: r.label, verdict: v, score: r.score });
  }
  const n = table.context.context + table.context.unsure + table.context.independent + table.independent.context + table.independent.unsure + table.independent.independent;
  return { n, correct, accuracy: n ? Math.round(correct / n * 1000) / 1000 : 0, cost: Math.round(cost * 100) / 100, table, misses };
}

// the threshold pair (context ≥ c, independent < i, i ≤ c) with the lowest cost; ties: the pair closest to the current one
function fitThresholds(rows, current) {
  let best = null;
  for (let c = 0.3; c <= 0.9001; c += 0.025) for (let i = 0.05; i <= c + 1e-9; i += 0.025) {
    const T = { context: Math.round(c * 1000) / 1000, independent: Math.round(i * 1000) / 1000 };
    const e = evaluate(rows, T);
    const dist = Math.abs(T.context - current.context) + Math.abs(T.independent - current.independent);
    if (!best || e.cost < best.e.cost - 1e-9 || (Math.abs(e.cost - best.e.cost) < 1e-9 && dist < best.dist)) best = { T, e, dist };
  }
  return best ? { thresholds: best.T, cost: best.e.cost, accuracy: best.e.accuracy } : null;
}

// the first prompt a person typed in a transcript (no meta lines, no <command> lines, no slash commands)
function firstPrompt(text) {
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (x) { continue; }
    if (!e || e.type !== 'user' || e.isMeta || e.isSidechain) continue;
    const c = e.message && e.message.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? ((c.find(b => b && b.type === 'text') || {}).text || '') : '';
    if (!t.trim() || /^\s*</.test(t)) continue;
    if (/^\s*\//.test(t)) return '';
    return t.trim();
  }
  return '';
}

function sets(which) {
  const seed = readJsonl(path.join(HERE, 'eval', 'seed.jsonl')).map(r => ({ ...r, set: 'seed' }));
  const mine = readJsonl(path.join(EVAL(), 'labels.jsonl')).map(r => ({ ...r, set: 'mine' }));
  // a later label for the same text wins (an override after a manual label)
  const dedup = list => { const m = new Map(); for (const r of list) m.set(r.text, r); return [...m.values()]; };
  return which === 'seed' ? seed : which === 'mine' ? dedup(mine) : [...seed, ...dedup(mine)];
}
function scored(rows) {
  const pf = require('./prefilter.js');
  const index = pf.loadIndex({ repo: REPO, full: process.env.VRG_FULL || path.dirname(REPO) });
  return rows.map(r => ({ ...r, score: pf.analyze(r.text, { index }).score }));
}

// one label row into .cache/eval/labels.jsonl (the Vezérlő's override, or `label`)
function appendLabel({ text, label, source, verdict }) {
  if (typeof text !== 'string' || !text.trim() || !LABELS.includes(label)) return false;
  try {
    fs.mkdirSync(EVAL(), { recursive: true });
    fs.appendFileSync(path.join(EVAL(), 'labels.jsonl'), JSON.stringify({ at: new Date().toISOString(), text: text.slice(0, 4000), label, source: source || 'manual', ...(verdict ? { verdict } : {}) }) + '\n');
    return true;
  } catch (e) { return false; }
}

function claudeRoots(extra) {
  const full = process.env.VRG_FULL || path.dirname(REPO);
  return [...extra, process.env.CLAUDE_CONFIG_DIR, path.join(os.homedir(), '.claude'), path.join(full, 'home', 'claude-account-b')]
    .filter(Boolean).map(d => path.resolve(d)).filter((d, i, l) => l.indexOf(d) === i && fs.existsSync(path.join(d, 'projects')));
}
function extract(extra) {
  const seen = new Set(), out = [];
  for (const root of claudeRoots(extra)) {
    const projects = path.join(root, 'projects');
    for (const d of fs.readdirSync(projects, { withFileTypes: true }).filter(x => x.isDirectory())) {
      for (const f of fs.readdirSync(path.join(projects, d.name)).filter(x => x.endsWith('.jsonl'))) {
        const file = path.join(projects, d.name, f);
        let head = '';
        try { const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(256 * 1024); const n = fs.readSync(fd, b, 0, b.length, 0); fs.closeSync(fd); head = b.toString('utf8', 0, n); } catch (e) { continue; }
        const t = firstPrompt(head);
        if (!t || t.includes('[VRG Előszűrő') || seen.has(t)) continue;
        seen.add(t);
        out.push({ id: f.replace(/\.jsonl$/, ''), text: t.slice(0, 4000), at: fs.statSync(file).mtimeMs });
      }
    }
  }
  out.sort((a, b) => b.at - a.at);
  fs.mkdirSync(EVAL(), { recursive: true });
  fs.writeFileSync(path.join(EVAL(), 'candidates.jsonl'), out.map(r => JSON.stringify(r)).join('\n') + (out.length ? '\n' : ''));
  return out.length;
}

async function label() {
  const cands = readJsonl(path.join(EVAL(), 'candidates.jsonl'));
  const done = new Set(readJsonl(path.join(EVAL(), 'labels.jsonl')).map(r => r.text));
  const todo = scored(cands.filter(c => !done.has(c.text)));
  if (!todo.length) { console.log('Nothing to label (run extract first).'); return; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(res => rl.question(q, res));
  const T = require('./prefilter.js').loadRules().thresholds;
  let n = 0;
  for (const c of todo) {
    console.log('\n----- ' + (n + 1) + '/' + todo.length + '   verdict now: ' + verdictOf(c.score, T) + ' (' + c.score + ')');
    console.log(c.text.slice(0, 600));
    const k = String(await ask('[c]ontext / [i]ndependent / [s]kip / [q]uit > ')).trim().toLowerCase();
    if (k === 'q') break;
    if (k === 'c' || k === 'i') { appendLabel({ text: c.text, label: k === 'c' ? 'context' : 'independent', source: 'label', verdict: verdictOf(c.score, T) }); n++; }
  }
  rl.close();
  console.log('\n' + n + ' labelled → ' + path.join(EVAL(), 'labels.jsonl'));
}

module.exports = { evaluate, fitThresholds, firstPrompt, appendLabel, verdictOf, COST, sets };

if (require.main === module) {
  const argv = process.argv.slice(2), cmd = argv[0];
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const which = opt('--set') || 'all';
  if (cmd === 'run' || cmd === 'fit') {
    const rows = scored(sets(which));
    const rules = require('./prefilter.js').loadRules();
    const e = evaluate(rows, rules.thresholds);
    console.log('set ' + which + ': ' + e.n + ' prompts · accuracy ' + e.accuracy + ' · weighted cost ' + e.cost + '   (context ≥ ' + rules.thresholds.context + ', independent < ' + rules.thresholds.independent + ')');
    console.log('               verdict:  context  unsure  independent');
    for (const l of LABELS) console.log('  label ' + l.padEnd(12) + String(e.table[l].context).padStart(9) + String(e.table[l].unsure).padStart(8) + String(e.table[l].independent).padStart(13));
    if (argv.includes('--misses')) for (const m of e.misses) console.log('  ✗ ' + m.label + ' → ' + m.verdict + ' (' + m.score + ')  ' + m.text.slice(0, 90).replace(/\s+/g, ' '));
    if (cmd === 'fit') {
      const f = fitThresholds(rows, rules.thresholds);
      console.log('best: context ≥ ' + f.thresholds.context + ', independent < ' + f.thresholds.independent + ' → cost ' + f.cost + ', accuracy ' + f.accuracy);
      if (argv.includes('--write')) {
        const file = path.join(HERE, 'rules.json');
        const r = JSON.parse(fs.readFileSync(file, 'utf8'));
        r.thresholds = f.thresholds;
        fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
        console.log('written to rules.json');
      }
    }
  } else if (cmd === 'extract') {
    const dirs = argv.flatMap((a, i) => (a === '--dir' && argv[i + 1] ? [argv[i + 1]] : []));
    console.log(extract(dirs) + ' first prompts → ' + path.join(EVAL(), 'candidates.jsonl'));
  } else if (cmd === 'label') label();
  else { console.log('usage: node Prefilter/eval.js run|fit|extract|label [--set seed|mine|all] [--misses] [--write] [--dir d]'); process.exit(2); }
}
