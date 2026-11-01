/* A made-up session for the empty state and the tests. It holds no real data; the example address,
   phone and key are there so redaction has something to show. */
const ASK = 'Nézd át a mérési napló határérték-ellenőrzését. Példa Bt., 1134 Budapest, Minta utca 12., +36 30 123 4567';
const TEST = 'npm test';
const T0 = Date.UTC(2026, 0, 15, 9, 0, 0);
let clock = T0;
const ev = (fields, gap = 4000) => {
  clock += gap;
  return { v: 1, t: clock, sid: 'sample01', agent: 'root', ...fields };
};
const tool = (name, input = {}, extra = {}) => {
  const callId = 'c' + (clock + 1);
  const target = { type: 'tool', id: 'tool:' + name, label: name };
  return [
    ev({ kind: 'call', tool: name, target, callId, text: JSON.stringify(input), file: input.file_path, ...extra }),
    ev({ kind: 'result', tool: name, target, callId, ms: 300 + (clock % 900), usage: { id: 'm' + clock, tokens: 800 + (clock % 2400) }, output: 'ok', ...extra }, 1500),
  ];
};
const scout = { agent: 'agent:scout001', agentType: 'Explore' };

export const SAMPLE_EVENTS = [
  ev({ kind: 'prompt', text: ASK }),
  ...tool('Read', { file_path: 'www/js/core/limits.js' }),
  ...tool('Grep', { pattern: 'checkReading' }),
  ev({ kind: 'agent-start', ...scout }),
  ...tool('Read', { file_path: 'www/js/pages/measure.js' }, scout),
  ...tool('Read', { file_path: 'tests/phase2-core.test.js' }, scout),
  ...tool('Bash', { command: 'npm test', env: 'token=abcd1234efgh5678' }, scout),
  ev({ kind: 'agent-stop', ...scout, output: 'A határértékek rendben.' }),
  ev({ kind: 'call', tool: 'Skill', target: { type: 'skill', id: 'skill:debug', label: 'debug' }, callId: 's1', text: '{"skill":"debug"}' }),
  ev({ kind: 'result', tool: 'Skill', target: { type: 'skill', id: 'skill:debug', label: 'debug' }, callId: 's1', ms: 40, output: 'ok' }, 600),
  ...tool('Edit', { file_path: 'www/js/core/limits.js' }),
  ev({ kind: 'call', tool: 'Bash', target: { type: 'tool', id: 'tool:Bash', label: 'Bash' }, callId: 'b9', text: TEST }),
  ev({ kind: 'result', tool: 'Bash', target: { type: 'tool', id: 'tool:Bash', label: 'Bash' }, callId: 'b9', ms: 5200, error: 'Exit code 1', usage: { id: 'm-fail', tokens: 2600 } }, 5200),
  ...tool('Edit', { file_path: 'www/js/core/limits.js' }),
  ...tool('Bash', { command: 'npm test' }),
  ev({ kind: 'call', tool: 'mcp__docs__search', target: { type: 'mcp', id: 'mcp:docs', label: 'docs', sub: 'search' }, callId: 'm1', text: '{"q":"Zs"}' }),
  ev({ kind: 'result', tool: 'mcp__docs__search', target: { type: 'mcp', id: 'mcp:docs', label: 'docs', sub: 'search' }, callId: 'm1', ms: 900, output: 'ok', usage: { id: 'm-mcp', tokens: 1200 } }, 900),
  ev({ kind: 'stop', output: 'Kész.' }),
];
