/* Folds events into a graph. Pure: time comes from the events, so replay and live give one answer. */
export const METRICS = ['calls', 'tokens', 'time', 'errors'];
export const HALF_LIFE = 120000;
const IO_KEEP = 12;
const decay = (dt) => 0.5 ** (Math.max(0, dt) / HALF_LIFE);

export function createTrace() {
  const trace = { nodes: new Map(), edges: new Map(), open: new Map(), pending: new Map(), usage: new Set(), clock: 0, agents: new Set(), tools: new Set(), order: 0, notice: null };
  node(trace, { id: 'root', type: 'root', label: 'Orchestrator' }, 0);
  return trace;
}

function node(trace, { id, type, label, sub }, t) {
  let n = trace.nodes.get(id);
  if (!n) {
    n = { id, type, label, sub, firstAt: t, lastAt: t, calls: 0, tokens: 0, ms: 0, errors: 0, io: [], order: trace.order++ };
    trace.nodes.set(id, n);
  }
  n.lastAt = Math.max(n.lastAt, t);
  return n;
}

function edge(trace, from, to, t) {
  const id = from + '>' + to;
  let e = trace.edges.get(id);
  if (!e) {
    e = { id, from, to, count: 0, tokens: 0, ms: 0, errors: 0, firstAt: t, lastAt: t, heat: { calls: 0, tokens: 0, time: 0, errors: 0 }, heatAt: t };
    trace.edges.set(id, e);
  }
  return e;
}

/* add to an edge's fading heat, carried forward to time t */
function warm(e, t, add) {
  const f = decay(t - e.heatAt);
  for (const m of METRICS) e.heat[m] = e.heat[m] * f + (add[m] ?? 0);
  e.heatAt = t;
  e.lastAt = Math.max(e.lastAt, t);
}

export function heatOf(e, metric, now) {
  return e.heat[metric] * decay(now - e.heatAt);
}

const agentNode = (trace, ev) => {
  if (ev.agent === 'root' || !ev.agent) return node(trace, { id: 'root' }, ev.t);
  const known = trace.nodes.has(ev.agent);
  const n = node(trace, { id: ev.agent, type: 'agent', label: ev.agentType ?? ev.agent.slice(6, 14) }, ev.t);
  if (ev.agentType) n.label = ev.agentType;
  if (!known) {
    trace.agents.add(ev.agent);
    warm(edge(trace, 'root', ev.agent, ev.t), ev.t, {});
  }
  return n;
};

const remember = (n, ev) => {
  n.io.push({ t: ev.t, kind: ev.kind, text: ev.text, output: ev.output, error: ev.error });
  if (n.io.length > IO_KEEP) n.io.shift();
};

export function apply(trace, ev) {
  const { t } = ev;
  trace.clock = Math.max(trace.clock, t);
  if (trace.nodes.get('root').firstAt === 0) trace.nodes.get('root').firstAt = t;
  switch (ev.kind) {
    case 'prompt':
      remember(node(trace, { id: 'root' }, t), ev);
      break;
    case 'agent-start': {
      const a = agentNode(trace, ev);
      const e = edge(trace, 'root', a.id, t);
      e.count++;
      warm(e, t, { calls: 1 });
      break;
    }
    case 'agent-stop':
      remember(agentNode(trace, ev), ev);
      break;
    case 'stop':
      remember(node(trace, { id: 'root' }, t), ev);
      trace.notice = null;
      break;
    case 'notice':
      trace.notice = ev;
      break;
    case 'pending':
      trace.pending.set(ev.callId, ev);
      break;
    case 'resolved':
      trace.pending.delete(ev.callId);
      break;
    case 'call': {
      trace.notice = null;
      const from = agentNode(trace, ev);
      const to = node(trace, ev.target, t);
      trace.tools.add(to.id);
      to.calls++;
      remember(to, ev);
      const e = edge(trace, from.id, to.id, t);
      e.count++;
      warm(e, t, { calls: 1 });
      const touched = [e];
      if (ev.file) {
        const f = node(trace, { id: 'file:' + ev.file, type: 'file', label: ev.file.split(/[\\/]/).pop() }, t);
        f.calls++;
        const fe = edge(trace, to.id, f.id, t);
        fe.count++;
        warm(fe, t, { calls: 1 });
        touched.push(fe);
      }
      if (ev.callId) trace.open.set(ev.callId, touched);
      break;
    }
    case 'result': {
      const edges = trace.open.get(ev.callId) ?? [];
      trace.open.delete(ev.callId);
      trace.pending.delete(ev.callId);
      const tokens = ev.usage && !trace.usage.has(ev.usage.id) ? ev.usage.tokens : 0;
      if (ev.usage) trace.usage.add(ev.usage.id);
      const add = { tokens, time: ev.ms ?? 0, errors: ev.error ? 1 : 0 };
      for (const e of edges) {
        e.tokens += tokens;
        e.ms += ev.ms ?? 0;
        e.errors += add.errors;
        warm(e, t, add);
        const n = trace.nodes.get(e.to);
        n.tokens += tokens;
        n.ms += ev.ms ?? 0;
        n.errors += add.errors;
        n.lastAt = Math.max(n.lastAt, t);
      }
      if (ev.target) remember(node(trace, ev.target, t), ev);
      break;
    }
    default:
  }
  return trace;
}

export function fold(events, upto = events.length) {
  const trace = createTrace();
  for (let i = 0; i < upto; i++) apply(trace, events[i]);
  return trace;
}

/* Filters: agent id, node type, window in ms. Nodes stay while one of their edges does. */
export function visible(trace, { agent = '', type = '', windowMs = 0 } = {}, now = trace.clock) {
  const owned = new Set(['root']);
  if (agent) {
    owned.add(agent);
    for (let grew = true; grew;) {
      grew = false;
      for (const e of trace.edges.values()) {
        if (e.from === 'root' || !owned.has(e.from) || owned.has(e.to)) continue;
        owned.add(e.to);
        grew = true;
      }
    }
  }
  const edges = [...trace.edges.values()].filter((e) => {
    if (windowMs && now - e.lastAt > windowMs) return false;
    if (agent && !(owned.has(e.to) && (e.from === 'root' ? e.to === agent : owned.has(e.from)))) return false;
    if (type) {
      const to = trace.nodes.get(e.to).type;
      if (to !== type && to !== 'agent') return false;
    }
    return true;
  });
  const ids = new Set(['root']);
  for (const e of edges) { ids.add(e.from); ids.add(e.to); }
  return { edges, nodes: [...trace.nodes.values()].filter((n) => ids.has(n.id)) };
}
