// VRG Stack — the shapes of what the stack stores, and their checks.
//
// Three record types:
//   node   one thing on one layer              (out/stack.json → nodes)
//   event  one change to the stack, append-only (data/events.jsonl)       event sourcing
//   step   one step of a recorded session       (out/recordings/<sid>.jsonl)
// The step's `span` names follow the OpenTelemetry GenAI conventions (invoke_agent, chat,
// execute_tool), so a live feed from hooks or Claude Code telemetry can reuse the same shape.
// Each check returns a list of problems; an empty list means the record is valid.
'use strict';

const LAYER = /^[FIQLAURCGEZ]$/;
const ISO = /^\d{4}-\d\d-\d\d/;

function checkNode(n) {
  const p = [];
  if (!n || typeof n !== 'object') return ['not an object'];
  if (typeof n.id !== 'string' || !/^[A-Z]:./.test(n.id)) p.push('id must be "<layer>:<local id>"');
  if (!LAYER.test(n.layer || '')) p.push(`unknown layer ${n.layer}`);
  else if (n.id && n.id[0] !== n.layer) p.push('id prefix differs from layer');
  if (typeof n.kind !== 'string' || !n.kind) p.push('kind missing');
  if (typeof n.title !== 'string') p.push('title must be a string');
  if (!Array.isArray(n.own)) p.push('own must be an array of keys');
  if (n.t && !ISO.test(n.t)) p.push(`date "${n.t}" is not ISO`);
  return p;
}

/* op: node+ node- state edge+ edge- build
   valid = when it happened in the work (the node's own date, if it has one)
   seen  = when the stack noticed it (the build time)                       → bitemporal */
const OPS = new Set(['node+', 'node-', 'state', 'edge+', 'edge-', 'build']);
function checkEvent(e) {
  const p = [];
  if (!OPS.has(e.op)) p.push(`unknown op ${e.op}`);
  if (!ISO.test(e.seen || '')) p.push('seen must be an ISO time');
  if (e.valid && !ISO.test(e.valid)) p.push('valid must be an ISO date');
  if (e.op !== 'build' && !e.id) p.push('id missing');
  return p;
}

const SPANS = new Set(['prompt', 'invoke_agent', 'chat', 'execute_tool', 'commit', 'session']);
const ACTORS = new Set(['user', 'agent', 'subagent', 'script']);
function checkStep(s) {
  const p = [];
  if (!SPANS.has(s.span)) p.push(`unknown span ${s.span}`);
  if (!ACTORS.has(s.actor)) p.push(`unknown actor ${s.actor}`);
  if (!ISO.test(s.t || '')) p.push('t must be an ISO time');
  if (!Number.isInteger(s.seq)) p.push('seq must be an integer');
  if (!Array.isArray(s.nodes)) p.push('nodes must be an array');
  return p;
}

module.exports = { checkNode, checkEvent, checkStep, SPANS, ACTORS, OPS };
