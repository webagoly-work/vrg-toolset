#!/usr/bin/env node
// hook.js — the Előszűrő as a Claude Code UserPromptSubmit hook: the same judgement for EVERY session, not only the Vezérlő's.
//   stdin : the hook's JSON { session_id, transcript_path, cwd, hook_event_name, prompt }
//   stdout: { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } } or nothing
// First prompt of a session → the dressing of its verdict (context / unsure / independent) as additional context; the prompt itself
// is never changed or blocked. Later prompts → silent, unless the prompt brings a NEW strong anchor (a codephrase, a job, a catalog
// item, a path the session has not touched) or turns a so-far independent session towards VRG: then one short "új horgony" note.
// A prompt the Vezérlő already dressed ("[VRG Előszűrő"), a slash command, an empty prompt and VRG_PREFILTER_OFF=1 are left alone.
// State per session: Prefilter/.cache/hook/<session id>.json (anchors seen, the verdict). Log: Prefilter/.cache/log.jsonl — metadata
// and a hash only, never the prompt text. Any error → exit 0 with no output: a broken filter must never stop a prompt.
//   node Prefilter/hook.js --install [--user] [--dry]   adds the hook to .claude/settings.json (or ~/.claude/settings.json) with THIS
//                                                       node and THIS script as absolute paths; --dry prints it only
//   node Prefilter/hook.js --test "a prompt" [--session x]   runs one prompt through the hook as if Claude Code sent it
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const HERE = __dirname, REPO = path.resolve(HERE, '..');
const CACHE = process.env.VRG_PREFILTER_CACHE || path.join(HERE, '.cache');
const MARK = '[VRG Előszűrő';
const MAX_CONTEXT = 9000;                                             // the hook output cap is 10 000 characters per field
const STRONG = ['codephrase', 'job', 'catalog', 'tool', 'feature', 'path', 'branch'];

const fullDir = () => process.env.VRG_FULL || path.dirname(REPO);
const sid = s => (typeof s === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(s) ? s : '');
function readState(id) { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'hook', id + '.json'), 'utf8')); } catch (e) { return null; } }
function writeState(id, st) { try { fs.mkdirSync(path.join(CACHE, 'hook'), { recursive: true }); fs.writeFileSync(path.join(CACHE, 'hook', id + '.json'), JSON.stringify(st)); } catch (e) {} }
function log(rec) {
  try { fs.mkdirSync(CACHE, { recursive: true }); fs.appendFileSync(path.join(CACHE, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n'); } catch (e) {}
}
const keep = list => (list || []).filter(x => x && x.id).map(x => ({ id: String(x.id), title: String(x.title || x.id).slice(0, 80), kind: x.kind || '', source: x.source || '' }));
const merge = (a, b) => { const m = new Map(); for (const x of [...a, ...b]) if (!m.has(x.id)) m.set(x.id, x); return [...m.values()].slice(0, 40); };
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 12);

// one prompt → { context: string|'', state, rec } (pure apart from the index; `state` = the session's state so far or null)
function judge(pf, index, prompt, state) {
  const text = String(prompt || '');
  if (!text.trim() || text.trimStart().startsWith('/')) return { context: '', state, rec: { skip: 'empty-or-command' } };
  if (text.includes(MARK)) {
    // dressed by the Vezérlő: remember its anchors, add nothing
    const a = pf.analyze(text.replace(/\[VRG Előszűrő[^\]]*\][\s\S]*?\n\n/, ''), { index });
    return { context: '', state: { n: (state ? state.n : 0) + 1, verdict: a.verdict, anchors: merge(state ? state.anchors : [], keep(a.anchors)) }, rec: { skip: 'dressed', verdict: a.verdict } };
  }
  if (!state) {
    const a = pf.analyze(text, { index });
    const d = pf.dress(text, a, { mode: 'auto' });
    const ctx = [d.parts.before, d.parts.after ? '(A kérés után:) ' + d.parts.after : ''].filter(Boolean).join('\n').slice(0, MAX_CONTEXT);
    return { context: ctx, state: { n: 1, verdict: a.verdict, anchors: keep(a.anchors) }, rec: { first: true, verdict: a.verdict, score: a.score, intent: a.intent, model: a.model, anchors: a.anchors.map(x => x.id).slice(0, 5) } };
  }
  // a later prompt: the session's anchors are the prior (a bare "folytasd" stays on the line); only new strong anchors speak
  const a = pf.analyze(text, { index, prior: { anchors: keep(state.anchors) } });
  const seen = new Set(keep(state.anchors).map(x => x.id));
  // a new named thing (one word like "Kapu" weighs 0.36), counted only when the prompt as a whole is about VRG
  const fresh = a.verdict === 'context' ? a.signals.filter(s => STRONG.includes(s.kind) && !s.negated && s.ref && !seen.has(s.ref) && s.weight >= 0.3) : [];
  const turned = state.verdict === 'independent' && a.verdict === 'context';
  const next = { n: state.n + 1, verdict: state.verdict === 'independent' && a.verdict !== 'independent' ? a.verdict : state.verdict, anchors: merge(keep(state.anchors), keep(a.anchors)) };
  if (!fresh.length && !turned) return { context: '', state: next, rec: { n: next.n, verdict: a.verdict, drift: false } };
  const names = [...new Map(fresh.map(s => [s.text.toLowerCase(), s.text])).values()].slice(0, 4);
  const q = (names.length ? names : a.anchors.map(x => x.title)).slice(0, 4).join(' ').replace(/"/g, '');
  const lines = [MARK + ' · új horgony]' + (turned ? ' Ez a munkamenet eddig önálló volt; ez a kérés VRG-munkára utal.' : ' Ez a kérés új területet érint: ' + names.join(', ') + '.'),
    'Mielőtt dolgozol rajta: stack_search "' + q + '" (MCP nélkül: node Stack/stack.js q "' + q + '"), és csak a releváns szakaszt olvasd.'];
  return { context: lines.join('\n'), state: next, rec: { n: next.n, verdict: a.verdict, drift: true, fresh: fresh.map(s => s.ref).slice(0, 4) } };
}

function run(input) {
  if (process.env.VRG_PREFILTER_OFF === '1') return '';
  let j; try { j = JSON.parse(input); } catch (e) { return ''; }
  const id = sid(j && j.session_id);
  if (!id || typeof j.prompt !== 'string') return '';
  const pf = require('./prefilter.js');
  const index = pf.loadIndex({ repo: REPO, full: fullDir() });
  const t0 = Date.now();
  const r = judge(pf, index, j.prompt, readState(id));
  if (r.state) writeState(id, r.state);
  log({ src: 'hook', session: id.slice(0, 40), len: j.prompt.length, h: hash(j.prompt), ms: Date.now() - t0, ...r.rec });
  return r.context ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: r.context } }) : '';
}

// the settings entry: absolute node + script, so it works where node is not on PATH (Full\tools\node)
function settingsEntry() {
  const q = p => (/\s/.test(p) ? '"' + p + '"' : p);
  return { matcher: '', hooks: [{ type: 'command', command: q(process.execPath) + ' ' + q(path.join(HERE, 'hook.js')), timeout: 10 }] };
}
function install({ user, dry }) {
  const file = user ? path.join(os.homedir(), '.claude', 'settings.json') : path.join(REPO, '.claude', 'settings.json');
  let s = {}; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file)) throw new Error('cannot parse ' + file); }
  const entry = settingsEntry();
  s.hooks = s.hooks || {};
  const list = (s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || []);
  const already = list.some(m => (m.hooks || []).some(h => /Prefilter[\\/]hook\.js/.test(h.command || '')));
  if (dry || already) return { file, already, entry };
  list.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  return { file, installed: true, entry };
}

module.exports = { judge, run, settingsEntry, install, MARK };

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    if (argv.includes('--install')) { console.log(JSON.stringify(install({ user: argv.includes('--user'), dry: argv.includes('--dry') }), null, 1)); process.exit(0); }
    if (argv.includes('--test')) {
      const i = argv.indexOf('--session');
      const prompt = argv.filter((a, k) => !a.startsWith('--') && k !== i + 1).join(' ');
      const out = run(JSON.stringify({ session_id: i >= 0 ? argv[i + 1] : 'test-' + Date.now(), prompt, hook_event_name: 'UserPromptSubmit' }));
      console.log(out ? JSON.parse(out).hookSpecificOutput.additionalContext : '(nothing added)');
      process.exit(0);
    }
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => { input += d; });
    process.stdin.on('end', () => { try { const o = run(input); if (o) process.stdout.write(o); } catch (e) { log({ src: 'hook', error: String(e && e.message || e).slice(0, 200) }); } process.exit(0); });
  } catch (e) { log({ src: 'hook', error: String(e && e.message || e).slice(0, 200) }); process.exit(0); }
}
