#!/usr/bin/env node
// The Divergence board: signals on the divergence ring, each one a way into a piece of work.
// Input:  Divergence/config.json (kinds, targets, actions, prompt templates) and Divergence/signals.json.
// State:  Divergence/data/log.jsonl, tracked, so an ignore rides the next ordinary push regardless.
// Notes:  Divergence/data/outbox.jsonl (gitignored) until `push` sends them to the vrg-devnotes branch,
//         one file per topic, built with plumbing like solomon-data: no checkout, no branch switch, never forced.
//
//   node tools/divergence.js list                     open signals with their state
//   node tools/divergence.js prompt <id>              the hand-off text for another session (also saved to data/handoff/)
//   node tools/divergence.js enter <id>               mark entered and print the hand-off
//   node tools/divergence.js note <id> "<text>"       leave a dev note on the signal's topic
//   node tools/divergence.js ignore <id> ["<why>"]    take it off the ring, logged
//   node tools/divergence.js close <id> "<summary>"   done; off the ring
//   node tools/divergence.js add --kind K --title T --why W [--level 0.5] [--topic X] [--target doc:path[:line]]
//                                [--read a,b] [--done D] [--source S] [--id ID]
//   node tools/divergence.js push                     notes + the action log to vrg-devnotes
//   node tools/divergence.js check                    config and signals are sound; every target exists
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'Divergence');
const CONFIG = path.join(DIR, 'config.json'), SIGNALS = path.join(DIR, 'signals.json');
const DATA = path.join(DIR, 'data'), LOG = path.join(DATA, 'log.jsonl'), OUTBOX = path.join(DATA, 'outbox.jsonl');
const HANDOFF = path.join(DATA, 'handoff'), SENT = path.join(DATA, 'sent.jsonl');
const ACTIONS = ['enter', 'note', 'ignore', 'close', 'reopen'];
const GONE = { ignore: 'ignored', close: 'closed', note: 'noted' }; // these take a signal off the ring
const NO_PROMPT = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const readJsonl = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const appendJsonl = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify(x) + '\n'); };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const git = (args, env) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', env: env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
class Refusal extends Error {}
const refuse = m => { throw new Refusal(m); };

function config() { return readJson(CONFIG); }
function signals() { return readJson(SIGNALS).signals; }

// The log is the state: the last action on a signal decides where it stands.
function state() {
  const cfg = config(), log = readJsonl(LOG), last = {};
  for (const x of log) last[x.id] = x;
  const out = signals().map(s => {
    const l = last[s.id], status = !l || l.action === 'reopen' ? 'open' : l.action === 'enter' ? 'entered' : GONE[l.action];
    const kind = cfg.kinds[s.kind] || { label: s.kind.toUpperCase(), topic: 'general', prompt: 'default' };
    return { ...s, topic: s.topic || kind.topic, kindLabel: kind.label, status, since: l ? l.at : s.created };
  });
  return { config: cfg, signals: out, pending: readJsonl(OUTBOX).length, unsentLog: unsentLog() };
}

function find(id) {
  const s = state().signals.find(x => x.id === id);
  if (!s) refuse(`No signal ${id}.`);
  return s;
}

function targetLine(s, cfg) {
  const t = s.target || {}, kind = (cfg.targets[t.type] || t.type || 'target');
  const where = t.path ? `\`${t.path}${t.line ? ':' + t.line : ''}\`` : '(none given)';
  return `${kind[0].toUpperCase() + kind.slice(1)}: ${where}${t.note ? ' — ' + t.note : ''}`;
}

function handoff(id) {
  const st = state(), cfg = st.config, s = find(id);
  const tpl = (cfg.prompts[(cfg.kinds[s.kind] || {}).prompt] || cfg.prompts.default).join('\n');
  const val = {
    id: s.id, title: s.title, why: s.why, kindLabel: s.kindLabel, levelPct: Math.round((s.level || 0) * 100) + ' %',
    repo: cfg.board.repo, branch: cfg.board.branch, topic: s.topic, done: s.done || 'Ask the Founder what done means here.',
    target: targetLine(s, cfg), readFirst: (s.readFirst || []).map(p => `- \`${p}\``).join('\n') || '- CLAUDE.md'
  };
  const text = tpl.replace(/\{(\w+)\}/g, (m, k) => val[k] != null ? val[k] : m);
  fs.mkdirSync(HANDOFF, { recursive: true });
  const file = path.join(HANDOFF, `${s.id}.md`);
  fs.writeFileSync(file, text + '\n');
  return { text, file: path.relative(REPO, file).replace(/\\/g, '/') };
}

function act(id, action, text) {
  if (!ACTIONS.includes(action)) refuse(`Unknown action ${action}.`);
  const s = find(id);
  text = String(text || '').trim().slice(0, 4000);
  if ((action === 'note' || action === 'close') && !text) refuse(`${action} needs a text.`);
  const at = now();
  // The note's words go to its topic on the dev-notes branch; the tracked log keeps only that one was left.
  if (action === 'note') appendJsonl(OUTBOX, { id, topic: s.topic, title: s.title, at, text });
  appendJsonl(LOG, { id, action, at, ...(action !== 'note' && text ? { text } : {}) });
  return action === 'enter' ? handoff(id) : { ok: true };
}

function add(o) {
  const cfg = config();
  for (const k of ['kind', 'title', 'why']) if (!o[k]) refuse(`add needs --${k}.`);
  if (!cfg.kinds[o.kind]) refuse(`Unknown kind ${o.kind}; the kinds are in Divergence/config.json.`);
  const all = readJson(SIGNALS);
  const id = o.id || `${o.kind}-${Date.now().toString(36)}`;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id) || all.signals.some(s => s.id === id)) refuse(`Bad or taken id ${id}.`);
  let target;
  if (o.target) { const [type, p, line] = o.target.split(/:(?![\\/])/); target = { type, path: p, ...(line ? { line: +line } : {}) }; }
  all.signals.push({
    id, kind: o.kind, title: o.title, why: o.why, level: Math.max(0, Math.min(1, +(o.level || 0.5))),
    topic: o.topic || cfg.kinds[o.kind].topic, ...(target ? { target } : {}),
    readFirst: o.read ? o.read.split(',') : [], done: o.done || '', source: o.source || 'manual', created: now().slice(0, 10)
  });
  fs.writeFileSync(SIGNALS, JSON.stringify(all, null, 2) + '\n');
  return id;
}

function check() {
  const cfg = config(), bad = [], ids = new Set();
  for (const k of ['board', 'kinds', 'targets', 'actions', 'prompts', 'devnotes']) if (!cfg[k]) bad.push(`config: no ${k}`);
  for (const [k, v] of Object.entries(cfg.kinds)) if (!cfg.prompts[v.prompt]) bad.push(`kind ${k}: no prompt ${v.prompt}`);
  for (const s of signals()) {
    if (ids.has(s.id)) bad.push(`${s.id}: id used twice`); ids.add(s.id);
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(s.id)) bad.push(`${s.id}: bad id`);
    if (!cfg.kinds[s.kind]) bad.push(`${s.id}: unknown kind ${s.kind}`);
    if (!(s.level >= 0 && s.level <= 1)) bad.push(`${s.id}: level outside 0..1`);
    if (s.target && !cfg.targets[s.target.type]) bad.push(`${s.id}: unknown target type ${s.target.type}`);
    for (const p of [s.target && s.target.path, ...(s.readFirst || [])].filter(Boolean))
      if (!fs.existsSync(path.join(REPO, p))) bad.push(`${s.id}: ${p} does not exist`);
  }
  return bad;
}

/* ---- the dev-notes branch ---- */

function unsentLog() {
  const n = readJsonl(LOG).length, sent = fs.existsSync(SENT) ? readJsonl(SENT).reduce((m, x) => Math.max(m, x.logLines || 0), 0) : 0;
  return Math.max(0, n - sent);
}

function topicFile(dir, topic) { return `${dir}/${topic.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.md`; }

function push() {
  const cfg = config(), BR = cfg.devnotes.branch, D = cfg.devnotes.dir;
  for (let attempt = 0; attempt < 3; attempt++) {
    let found;
    try { found = git(['ls-remote', '--heads', 'origin', BR], NO_PROMPT).trim(); }
    catch { refuse('No link to origin; the notes stay here for the next push.'); }
    let tip = null;
    if (found) { git(['fetch', '--quiet', 'origin', `+refs/heads/${BR}:refs/remotes/origin/${BR}`], NO_PROMPT); tip = git(['rev-parse', `refs/remotes/origin/${BR}`]).trim(); }
    const outbox = readJsonl(OUTBOX), files = {};
    const show = p => { try { return tip ? git(['show', `${tip}:${p}`]) : ''; } catch { return ''; } };
    for (const n of outbox) {
      const f = topicFile(D, n.topic);
      if (!(f in files)) files[f] = show(f) || `# Dev notes: ${n.topic}\n\nLeft from the Divergence board. Newest last.\n`;
      files[f] += `\n## ${n.at.slice(0, 10)} · ${n.id} · ${n.title}\n\n${n.text}\n`;
    }
    files[`${D}/log.jsonl`] = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';   // ignores and all, every push
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'divergence-'));
    const index = path.join(tmp, 'index'), env = { ...process.env, GIT_INDEX_FILE: index };
    try {
      const paths = Object.keys(files).map(f => { const p = path.join(tmp, f.replace(/\//g, '_')); fs.writeFileSync(p, files[f]); return p; });
      const clean = spawnSync(process.execPath, [path.join(REPO, 'tools', 'anonymise.js'), '--check', ...paths], { cwd: REPO, stdio: 'inherit' });
      if (clean.status !== 0) refuse('Not pushed: a note holds a client code (anonymise check).');
      if (tip) git(['read-tree', tip], env);
      Object.keys(files).forEach((f, i) => {
        const blob = git(['hash-object', '-w', '--no-filters', paths[i]]).trim();
        git(['update-index', '--add', '--cacheinfo', `100644,${blob},${f}`], env);
      });
      const tree = git(['write-tree'], env).trim();
      if (tip && git(['rev-parse', `${tip}^{tree}`]).trim() === tree) { clearOutbox(outbox); return { pushed: false, notes: 0, message: `${BR} is up to date` }; }
      const sha = git(['commit-tree', tree, ...(tip ? ['-p', tip] : []), '-m', `devnotes: ${outbox.length} note(s), ${now()}`]).trim();
      const r = spawnSync('git', ['push', '--quiet', 'origin', `${sha}:refs/heads/${BR}`], { cwd: REPO, encoding: 'utf8', env: NO_PROMPT });
      if (r.status === 0) {
        git(['update-ref', `refs/heads/${BR}`, sha]);   // a local branch too, so BACKUP's push --all carries it
        clearOutbox(outbox);
        return { pushed: true, sha: sha.slice(0, 7), notes: outbox.length, message: `pushed ${sha.slice(0, 7)} to ${BR}` };
      }
      if (!/rejected|fetch first|non-fast-forward/.test(r.stderr)) refuse(`Not pushed, the notes stay here: ${r.stderr.trim()}`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  refuse(`Not pushed: ${BR} kept moving.`);
}

function clearOutbox(sent) {
  const at = now(), logLines = readJsonl(LOG).length;
  for (const n of sent) appendJsonl(SENT, { ...n, sentAt: at });
  appendJsonl(SENT, { sentAt: at, logLines });
  const left = readJsonl(OUTBOX).slice(sent.length);   // a note left during the push waits for the next one
  fs.writeFileSync(OUTBOX, left.map(x => JSON.stringify(x)).join('\n') + (left.length ? '\n' : ''));
}

module.exports = { state, handoff, act, add, check, push, Refusal, REPO };

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const flags = {}; for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
  try {
    if (cmd === 'list') {
      for (const s of state().signals) console.log(`${s.status.padEnd(8)} ${String(Math.round(s.level * 100)).padStart(3)}%  ${s.id.padEnd(16)} ${s.kindLabel} · ${s.title}`);
      const st = state(); console.log(`\n${st.pending} note(s) waiting, ${st.unsentLog} log line(s) not on the dev-notes branch yet`);
    } else if (cmd === 'prompt') { const h = handoff(args[0]); console.log(h.text + `\n\n(saved to ${h.file})`); }
    else if (cmd === 'enter') { const h = act(args[0], 'enter'); console.log(h.text + `\n\n(saved to ${h.file})`); }
    else if (['note', 'ignore', 'close', 'reopen'].includes(cmd)) { act(args[0], cmd, args.slice(1).join(' ')); console.log(`${cmd}: ${args[0]}`); }
    else if (cmd === 'add') console.log(`added ${add(flags)}`);
    else if (cmd === 'push') console.log(push().message);
    else if (cmd === 'check') { const b = check(); b.forEach(x => console.log('BAD ' + x)); console.log(b.length ? `${b.length} problem(s)` : 'divergence: ok'); process.exit(b.length ? 1 : 0); }
    else { console.error('usage: divergence.js list | prompt | enter | note | ignore | close | reopen | add | push | check'); process.exit(1); }
  } catch (e) { console.error(e instanceof Refusal ? e.message : e.stack); process.exit(1); }
}
