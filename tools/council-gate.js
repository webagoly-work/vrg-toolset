#!/usr/bin/env node
// ---------------------------------------------------------------------------
// council-gate.js — the Hand's budget gate, a PreToolUse hook. The Council can
// only spend what the harness lets it spend, so the rule lives here and not in
// a prompt: a worker or contractor that asks for a costly move is refused and
// told to escalate. The Hand opens a door by writing a permit.
//
//   settings: PreToolUse, matcher "Agent|Workflow|Read|WebFetch|WebSearch|Bash"
//   node tools/council-gate.js                 the hook: JSON on stdin
//   node tools/council-gate.js permit <agent> <kind> [minutes=60]   the Hand's permit
//   node tools/council-gate.js permits                              list live ones
//
// Permits are in H:\VRG\Full\_admin\council\permits.json. Only the main session
// runs the permit command: a hook refuses it from any subagent. This gates cost,
// never safety: pushing, sending and deleting stay with the user's own prompts.
// A broken gate lets work through, because a dead hook must not stop the day.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DIR = process.env.VRG_COUNCIL_DIR || path.join(path.dirname(REPO), '_admin', 'council');
const PERMITS = path.join(DIR, 'permits.json');
const LOG = path.join(DIR, 'gate.log');

// Agents are called by their persona, so the tier comes from this roster (docs/council/ROSTER.md).
// Bernard is absent on purpose: the Hand answers to the Founder, not to the gate.
const ROSTER = {
  arnold: 'council', charlotte: 'council', elsie: 'council', stubbs: 'council', lee: 'council',
  felix: 'contractor', theresa: 'contractor', akecheta: 'contractor', abernathy: 'contractor', 'vrg-piacmero': 'contractor',
  teddy: 'worker', armistice: 'worker', clementine: 'worker', sylvester: 'worker',
};
const TIER = t => ROSTER[t] || null;
const COSTLY_MODEL = /opus|fable/i;
const COSTLY_EFFORT = /^(xhigh|max)$/;
const READ_LIMIT = { worker: 60 * 1024, contractor: 200 * 1024, council: 1024 * 1024 };

const loadPermits = () => { try { return JSON.parse(fs.readFileSync(PERMITS, 'utf8')); } catch { return []; } };
const hasPermit = (agent, kind, now = Date.now()) => loadPermits().some(p => (p.agent === agent || p.agent === '*') && p.kind === kind && p.until > now);

/* Pure: what the gate says about one tool call. null means no objection. */
function judge(input, permit) {
  const agent = input.agent_type || '';
  const tier = TIER(agent);
  if (!tier) return null;                                       // the Hand, and agents outside the Council
  const tool = input.tool_name, ti = input.tool_input || {};
  const need = (kind, why) => permit(agent, kind) ? null : `${why} Stop here and return ESCALATE with kind "${kind}", what you need and why. The Hand decides.`;

  if (tool === 'Agent') {
    if (tier === 'worker') return 'Workers do not hire. Return ESCALATE to your contractor.';
    // A subagent's own Agent(type) list is ignored by Claude Code, so who may hire whom is enforced here.
    const hired = TIER(ti.subagent_type || '');
    if (hired === 'council' || ti.subagent_type === 'bernard' || (tier === 'contractor' && hired !== 'worker')) return need('hire', `${agent} may not hire ${ti.subagent_type || 'a general agent'}: ${tier === 'contractor' ? 'contractors hire workers only' : 'department heads hire contractors and workers'}.`);
    if (COSTLY_MODEL.test(ti.model || '')) return need('model', `${agent} asked for ${ti.model}, above its tier.`);
    if (COSTLY_EFFORT.test(ti.effort || '')) return need('effort', `${agent} asked for ${ti.effort} effort.`);
  }
  if (tool === 'Workflow' && tier !== 'council') return need('workflow', 'Only the Council starts workflows.');
  if ((tool === 'WebFetch' || tool === 'WebSearch') && tier === 'worker') return need('web', 'Workers do not use the web.');
  if (tool === 'Read' && ti.file_path && !ti.limit) {
    let size = 0;
    try { size = fs.statSync(ti.file_path).size; } catch { return null; }
    if (size > READ_LIMIT[tier]) return need('bigread', `${path.basename(ti.file_path)} is ${Math.round(size / 1024)} KB, over the ${tier} limit. Search it with tools/vrg-ctx.js or read a line range.`);
  }
  if (tool === 'Bash' && /council-gate\.js\s+permit/.test(ti.command || '')) return 'Permits come from the Hand only.';
  return null;
}

function hook() {
  let raw = '';
  process.stdin.on('data', d => raw += d);
  process.stdin.on('end', () => {
    let why = null, input = {};
    try { input = JSON.parse(raw); why = judge(input, hasPermit); } catch { return; }
    if (!why) return;
    try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), agent: input.agent_type, tool: input.tool_name, why }) + '\n'); } catch { /* the log is not worth a failed hook */ }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why } }));
  });
}

function permit(agent, kind, minutes = '60') {
  if (!agent || !kind) { console.error('node tools/council-gate.js permit <agent|*> <model|effort|workflow|web|bigread> [minutes]'); process.exit(2); }
  const now = Date.now();
  const live = loadPermits().filter(p => p.until > now);
  live.push({ agent, kind, until: now + (+minutes) * 60000, by: 'hand' });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(PERMITS, JSON.stringify(live, null, 2));
  console.log(`Permit: ${agent} ${kind} for ${minutes} min`);
}

if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'permit') permit(a, b, c);
  else if (cmd === 'permits') console.log(JSON.stringify(loadPermits().filter(p => p.until > Date.now()), null, 2));
  else hook();
}

module.exports = { judge, TIER };
