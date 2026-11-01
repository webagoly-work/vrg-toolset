/* The one trace event format. Every source (hooks, managed sessions, a saved file) turns its input
   into these, so the model and the view never know where an event came from.
   { v, t, sid, kind, agent, agentType, tool, target, file, callId, ms, error, usage, text, output } */
export const TRACE_V = 1;
const CUT = 1500;
const clip = (s) => (s.length > CUT ? s.slice(0, CUT) + '…' : s);
const toText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return clip(v);
  try { return clip(JSON.stringify(v)); } catch { return ''; }
};

/* What a tool call points at: a plain tool, an MCP server, a skill or a subagent. */
export function classify(tool, input = {}) {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (mcp) return { type: 'mcp', id: 'mcp:' + mcp[1], label: mcp[1], sub: mcp[2] };
  if (tool === 'Skill') return { type: 'skill', id: 'skill:' + input.skill, label: String(input.skill ?? tool) };
  if (tool === 'Agent' || tool === 'Task') return { type: 'tool', id: 'tool:Agent', label: 'Agent', sub: input.subagent_type };
  return { type: 'tool', id: 'tool:' + tool, label: tool };
}

export const filePath = (input = {}) => input.file_path ?? input.notebook_path ?? null;

const summary = (tool, input = {}) => toText(tool === 'Bash' || tool === 'PowerShell' ? input.command : input);

/* hook: the JSON Claude Code gives a command hook on stdin */
export function fromHook(hook, now = Date.now()) {
  const base = {
    v: TRACE_V, t: now, sid: String(hook.session_id ?? '').slice(0, 8),
    agent: hook.agent_id ? 'agent:' + hook.agent_id : 'root', agentType: hook.agent_type,
  };
  const tool = hook.tool_name;
  const call = () => ({ tool, target: classify(tool, hook.tool_input), file: filePath(hook.tool_input), callId: hook.tool_use_id });
  switch (hook.hook_event_name) {
    case 'UserPromptSubmit': return String(hook.prompt).startsWith('<task-notification>') ? null : { ...base, kind: 'prompt', text: toText(hook.prompt) };
    case 'PreToolUse': return { ...base, kind: 'call', ...call(), text: summary(tool, hook.tool_input) };
    case 'PostToolUse': return { ...base, kind: 'result', ...call(), ms: hook.duration_ms, output: toText(hook.tool_response) };
    case 'PostToolUseFailure': return { ...base, kind: 'result', ...call(), ms: hook.duration_ms, error: toText(hook.error) || 'error' };
    case 'SubagentStart': return { ...base, kind: 'agent-start' };
    case 'SubagentStop': return { ...base, kind: 'agent-stop', output: toText(hook.last_assistant_message) };
    case 'Stop': return { ...base, kind: 'stop', output: toText(hook.last_assistant_message) };
    case 'Notification': return { ...base, kind: 'notice', text: toText(hook.message), notice: hook.notification_type };
    default: return null;
  }
}

/* A subagent writes its own transcript in a folder beside the session's. */
export function transcriptOf(hook) {
  if (!hook.agent_id) return hook.transcript_path;
  return hook.agent_transcript_path ?? hook.transcript_path?.replace(/\.jsonl$/, `/subagents/agent-${hook.agent_id}.jsonl`);
}

/* The newest token count in a Claude Code transcript's tail. Each message id counts once. */
export function usageFromTail(tail) {
  const lines = String(tail).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    let row;
    try { row = JSON.parse(lines[i]); } catch { continue; }
    const u = row.message?.usage;
    if (u) return { id: row.message.id ?? row.uuid, tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) };
  }
  return null;
}

export function parseJsonl(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev && ev.v === TRACE_V && ev.kind) out.push(ev);
    } catch { /* a half-written last line */ }
  }
  return out;
}
