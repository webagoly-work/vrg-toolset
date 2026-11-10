#!/usr/bin/env node
// VRG Stack — MCP server (stdio, JSON-RPC 2.0, one message per line). No dependencies.
//
// Tools (names follow the official memory server's style: <server>_<verb>):
//   stack_search    words + meaning search, with each hit's vertical neighbours
//   stack_node      one node card, links read as sentences
//   stack_path      shortest chain between two nodes (optionally forward in time)
//   stack_pillar    the pillars, or one pillar's members per layer
//   stack_string    a Stack String (Füzér): what one thing reaches on every layer, and its development class
//   stack_session   a recorded session step by step, or the list of sessions
//   stack_report    drift · status · health · patterns · proposals
// Resources (read once, cheap, cache-friendly):
//   stack://codec/L0  stack://codec/L1  stack://drift  stack://status  stack://health  stack://proposals
// Read only: the server never builds and never writes (a missing stack is reported, not built,
// so a session cannot start a one-minute build by accident).
//
// Registered at user scope on 2026-11-06 with (remove: claude mcp remove vrg-stack -s user):
//   claude mcp add vrg-stack -s user -- H:\VRG\Full\tools\node\node.exe H:\VRG\Full\notes\stack\stack.js mcp
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');

const TOOLS = [
  { name: 'stack_search', description: 'Search the VRG Stack (all layers: features, ideas, decisions, dev lines, agent memory, runs, commits, code, documents). Returns ranked nodes with their links to other layers. Ask this before reading files.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, layers: { type: 'string', description: 'comma list of layer codes F,I,Q,L,A,U,R,C,G,E' }, limit: { type: 'number' }, budget: { type: 'number', description: 'token budget for the answer (default 900)' } }, required: ['query'] } },
  { name: 'stack_node', description: 'One node card by id (e.g. L:views, R:5ee8b1e, C:Planner/src, E:planner): its links grouped by layer, read as sentences.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, all: { type: 'boolean' } }, required: ['id'] } },
  { name: 'stack_path', description: 'Shortest chain of links between two node ids. time=true keeps the chain moving forward in time.',
    inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, time: { type: 'boolean' } }, required: ['from', 'to'] } },
  { name: 'stack_pillar', description: 'Entity pillars (one real thing across all layers). Without id: the list. With id: its members per layer.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } } },
  { name: 'stack_string', description: 'Stack String (Füzér): select one thing (id or words) and get every node about it on every layer, its reach mask (which layers it touches) and its development class (Program, In build, Built quiet, Planned, Spark, Orphan, Loose). orphans=true lists code folders nobody registered.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'node id (E:planner, F:f8) or words' }, per: { type: 'number', description: 'members shown per layer (default 3)' }, orphans: { type: 'boolean' } } } },
  { name: 'stack_session', description: 'A recorded Claude Code session step by step (prompts, tool calls, files, commits, the stack nodes touched). Without sid: the newest sessions.',
    inputSchema: { type: 'object', properties: { sid: { type: 'string', description: 'first 8 characters of the session id' }, steps: { type: 'number' } } } },
  { name: 'stack_report', description: 'One of the stack reports: drift, status, health, patterns, proposals.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', enum: ['drift', 'status', 'health', 'patterns', 'proposals'] } }, required: ['name'] } },
];
const REPORT = { drift: 'DRIFT.md', status: 'STATUS.md', health: 'HEALTH.md', patterns: 'PATTERNS.md', proposals: 'PROPOSALS.md' };
const RESOURCES = [
  ['stack://codec/L0', 'L0 — the stack on one screen', 'codec/L0.txt'], ['stack://codec/L1', 'L1 — the pillars', 'codec/L1-pillars.txt'],
  ['stack://drift', 'Drift report', 'DRIFT.md'], ['stack://status', 'Status and metrics', 'STATUS.md'],
  ['stack://health', 'Health of the last build', 'HEALTH.md'], ['stack://proposals', 'Proposals (nothing applied)', 'PROPOSALS.md'],
];

async function callTool(name, a, Q) {
  switch (name) {
    case 'stack_search': return Q.ask(String(a.query || ''), { n: a.limit || 8, budget: a.budget || 900, layers: a.layers ? String(a.layers).split(',') : null });
    case 'stack_node': return Q.node(String(a.id), { all: !!a.all });
    case 'stack_path': return Q.chain(String(a.from), String(a.to), { time: !!a.time });
    case 'stack_pillar': return Q.pillar(a.id);
    case 'stack_string': return Q.string(String(a.id || ''), { per: a.per || 3, orphans: !!a.orphans });
    case 'stack_session': return Q.session(a.sid, { steps: a.steps || 40 });
    case 'stack_report': return REPORT[a.name] ? Q.report(REPORT[a.name]) : 'unknown report';
    default: throw Object.assign(new Error('unknown tool ' + name), { code: -32602 });
  }
}

async function handle(msg, Q) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize':
      return { protocolVersion: params.protocolVersion || CFG.mcp.protocol, capabilities: { tools: {}, resources: {} },
        serverInfo: { name: CFG.mcp.name, version: CFG.mcp.version },
        instructions: 'The VRG Stack: every map of the VRG work as one multilayer graph. Read stack://codec/L0 first, then stack_search before opening files.' };
    case 'ping': return {};
    case 'tools/list': return { tools: TOOLS };
    case 'tools/call': {
      try { return { content: [{ type: 'text', text: String(await callTool(params.name, params.arguments || {}, Q)) }] }; }
      catch (e) { if (e.code) throw e; return { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true }; }
    }
    case 'resources/list': return { resources: RESOURCES.map(([uri, name]) => ({ uri, name, mimeType: 'text/plain' })) };
    case 'resources/read': {
      const r = RESOURCES.find(x => x[0] === params.uri); if (!r) throw Object.assign(new Error('unknown resource'), { code: -32602 });
      let text; try { text = fs.readFileSync(path.join(CFG.out, r[2]), 'utf8'); } catch { text = 'not built yet: node stack.js build'; }
      return { contents: [{ uri: r[0], mimeType: 'text/plain', text }] };
    }
    default:
      if (id === undefined) return undefined; // a notification (notifications/initialized …): no answer
      throw Object.assign(new Error('method not found: ' + method), { code: -32601 });
  }
}

function start({ input = process.stdin, output = process.stdout } = {}) {
  const Q = require('../lib/query');
  Q.readOnly(); // the MCP server must never build
  const send = m => output.write(JSON.stringify(m) + '\n');
  let buf = '';
  input.setEncoding('utf8');
  input.on('data', async chunk => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
      try { const result = await handle(msg, Q); if (msg.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: msg.id, result }); }
      catch (e) { if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: e.message } }); }
    }
  });
}

module.exports = { start, handle, TOOLS };
if (require.main === module) start();
