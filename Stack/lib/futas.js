// VRG Stack — layer U · Futás (runtime): what agents actually did, built from the recordings.
//
//   U:run.<sid8>   one recorded session: steps, tools, tokens, the nodes it touched
//   U:day.<date>   one day: sessions, tool calls, tokens
// Links: run → day (on-day), run → its DevLog session L:s<sid8> (ran), run → every stack node it
// touched (touched, w = how many steps touched it). The `touched` weights are what the neural
// view thickens with use.
'use strict';

const { clip, day } = require('./common');

const MAX_TOUCHED = 40; // per run; the rest stay in the recording
const k = x => x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x / 1000) + 'k';

function futas(index, nodes) {
  const out = { nodes: [], edges: [] };
  const days = new Map();
  for (const s of Object.values(index.sessions)) {
    const sid8 = s.sid.slice(0, 8); const id = 'U:run.' + sid8; const d = day(s.start);
    const calls = Object.values(s.tools).reduce((a, b) => a + b, 0);
    const tokens = s.tokens.in + s.tokens.out + s.tokens.cr + s.tokens.cw;
    out.nodes.push({
      id, layer: 'U', kind: 'run', title: clip(s.title, 120), t: d, own: ['run:' + sid8],
      state: `${s.steps} steps · ${calls} tools`, brief: clip(`${s.project} · ${s.prompts} prompts · ${s.commits.length} commits · ${s.subagents} subagents · tokens out ${k(s.tokens.out)}, in ${k(s.tokens.in + s.tokens.cw)}, cache read ${k(s.tokens.cr)} · top tools: ${Object.entries(s.tools).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(', ')}`, 300),
      text: [s.title, s.cwd, s.branch, s.project].join(' \n'), extra: { sid: s.sid, start: s.start, end: s.end, tools: s.tools, tokens: s.tokens },
    });
    if (!days.has(d)) days.set(d, { runs: 0, calls: 0, tokens: 0, commits: 0 });
    const dd = days.get(d); dd.runs++; dd.calls += calls; dd.tokens += tokens; dd.commits += s.commits.length;
    out.edges.push({ a: id, b: 'U:day.' + d, rel: 'on-day' });
    if (nodes.has('L:s' + sid8)) out.edges.push({ a: id, b: 'L:s' + sid8, rel: 'ran' });
    for (const [nid, w] of s.touched.slice(0, MAX_TOUCHED)) if (nodes.has(nid)) out.edges.push({ a: id, b: nid, rel: 'touched', w });
  }
  for (const [d, x] of days) out.nodes.push({
    id: 'U:day.' + d, layer: 'U', kind: 'day', title: d, t: d, own: [], text: d,
    state: `${x.runs} sessions · ${x.calls} tools`, brief: `${x.runs} sessions, ${x.calls} tool calls, ${x.commits} commits, ≈ ${k(x.tokens)} tokens in all (cache reads included).`,
  });
  return out;
}

module.exports = { futas };
