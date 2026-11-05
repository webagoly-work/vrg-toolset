// claudeterm.js — Claude Code in an embedded terminal pane (WP-16). The pty manager (WP-14) does the spawning; this module picks the
// profile (claude-a / claude-b), passes the first prompt as ONE argv item (never typed into the pty) and tells the frame to show the term.
//   const ct = createClaudeTerm({ pty, emit, env, expand, log });
//   ct.open({ account: 'A'|'B', cwd, firstPrompt?, extraArgs? }) → { term, title, prof, account } | { ok:false, err, hu }
//   emit('layout', 'open', { kind: 'term', term, prof })
// VRG_CLAUDE_BIN (tests only, CONTRACT §4.9) replaces the profile exe: use withBinOverride(profiles, env, expand) when building the pty manager.
// A `.js` value runs through node ({node}) with the script as the first argument.
'use strict';
const path = require('path');

const PROFILES = { A: 'claude-a', B: 'claude-b' };
const MAX_PROMPT = 4000;

// the exe override of the test binary: { exe, lead } or null
function binOverride(env, expand = s => s) {
  const bin = env && env.VRG_CLAUDE_BIN;
  if (typeof bin !== 'string' || !bin || !path.isAbsolute(bin)) return null;
  if (/\.js$/i.test(bin)) return { exe: expand('{node}'), lead: [bin] };
  return { exe: bin, lead: [] };
}

// profiles with the claude-* exe replaced by VRG_CLAUDE_BIN (a copy; the list is returned unchanged when the variable is not set)
function withBinOverride(profiles, env, expand) {
  const o = binOverride(env, expand);
  if (!o) return profiles;
  return (profiles || []).map(p => (p && /^claude-[ab]$/.test(p.id) ? { ...p, exe: o.exe } : p));
}

function createClaudeTerm({ pty, emit = () => {}, env = process.env, expand = s => s, log = () => {} }) {
  const replay = new Map();                                   // term id → last output (≤ 64 KB), for a pane that attaches late
  if (pty && pty.on) {
    pty.on('data', m => { if (replay.has(m.term)) replay.set(m.term, (replay.get(m.term) + m.data).slice(-65536)); });
    pty.on('exit', m => { replay.delete(m.term); });
  }

  function open({ account, cwd, firstPrompt, extraArgs } = {}) {
    const acc = account === 'B' ? 'B' : 'A';
    const prof = PROFILES[acc];
    if (firstPrompt !== undefined && (typeof firstPrompt !== 'string' || !firstPrompt || firstPrompt.length > MAX_PROMPT))
      return { ok: false, err: 'bad-request', hu: 'Érvénytelen kezdő kérés.' };
    const o = binOverride(env, expand);
    const args = [...(o ? o.lead : []), ...(Array.isArray(extraArgs) ? extraArgs.filter(x => typeof x === 'string') : [])];
    if (firstPrompt !== undefined) args.push(firstPrompt);   // one argv item, exactly as D2 does
    const r = pty.open(prof, cwd, { args });
    if (!r || !r.term) { log('claudeterm', 'refused', r && r.err); return r || { ok: false, err: 'error', hu: 'A terminál nem indult el.' }; }
    replay.set(r.term, '');
    emit('layout', 'open', { kind: 'term', term: r.term, prof });
    return { term: r.term, title: r.title, prof, account: acc };
  }

  return { open, replay: id => replay.get(id) || '' };
}

module.exports = { createClaudeTerm, withBinOverride, binOverride, PROFILES };
