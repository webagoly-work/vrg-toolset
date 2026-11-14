/* What a session is doing right now, folded from its trace events (pure, no I/O):
     working  the main agent is calling tools or thinking
     blocked  it waits for you: a permission prompt, a question (AskUserQuestion), a plan to approve, a relay gate
     waiting  its turn ended but background subagents still run, so it will go on by itself
     idle     its turn ended and nothing runs: your move
   Only root events clear `blocked`; a background subagent's calls do not mean you answered.
   noticeFor() says when a change of state is worth a ping (agent-notify.js decides how and whether it still holds). */

export const ASK_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);
const BLOCKING_NOTICES = new Set(['permission_prompt', 'elicitation_dialog']);

export const emptyState = () => ({ state: 'idle', since: 0, turnAt: 0, last: 0, why: '', open: [] });

export function step(prev, ev) {
  const s = { ...prev, open: prev.open.slice(), last: Math.max(prev.last, ev.t || 0) };
  const root = !ev.agent || ev.agent === 'root';
  const set = (state, why = '') => {
    if (s.state !== state) s.since = ev.t || s.since;
    s.state = state;
    s.why = why;
  };
  switch (ev.kind) {
    case 'prompt':
      s.turnAt = ev.t || s.turnAt;
      set('working');
      break;
    case 'call':
      if (root && ASK_TOOLS.has(ev.tool)) set('blocked', ev.tool === 'ExitPlanMode' ? 'plan' : 'question');
      else if (root || s.state !== 'blocked') set('working');
      break;
    case 'pending':
      set('blocked', 'approval');
      break;
    case 'result':
    case 'resolved':
      if (root || s.state !== 'blocked') set('working');
      break;
    case 'agent-start':
      if (ev.agent && !s.open.includes(ev.agent)) s.open.push(ev.agent);
      if (s.state === 'idle') set('working');
      break;
    case 'agent-stop':
      s.open = s.open.filter((a) => a !== ev.agent);
      break;
    case 'notice':
      if (BLOCKING_NOTICES.has(ev.notice)) set('blocked', ev.notice === 'permission_prompt' ? 'permission' : 'question');
      break;
    case 'stop':
      if (root) set(s.open.length ? 'waiting' : 'idle');
      break;
    default:
      break;
  }
  return s;
}

export function sessionState(events, from = emptyState()) {
  let s = from;
  for (const ev of events) s = step(s, ev);
  return s;
}

/* -> null | { kind: 'blocked', why } | { kind: 'done', ms }   (doneAfterMs: a quick answer does not ring) */
export function noticeFor(before, after, ev, { doneAfterMs = 60000 } = {}) {
  if (after.state === 'blocked' && before.state !== 'blocked') return { kind: 'blocked', why: after.why };
  if (ev.kind === 'stop' && after.state === 'idle' && before.state !== 'idle') {
    const ms = after.turnAt ? (ev.t || 0) - after.turnAt : 0;
    if (ms >= doneAfterMs) return { kind: 'done', ms };
  }
  return null;
}

/* Is the ping still true when the delay is over? The same episode must still be on: in that state,
   entered no later than `at` (you answered and it blocked again → that new episode pings by itself). */
export function stillHolds(s, kind, at) {
  return s.state === (kind === 'done' ? 'idle' : 'blocked') && s.since <= at;
}
