#!/usr/bin/env node
// VRG Stack — one command for everything. Cheap first: an answer is a few lines, not files.
//
//   node stack.js q "<words>" [-n 8] [--layer F,L,A] [--budget 900] [--json]   search (words + meaning), with vertical neighbours
//   node stack.js node <id> [--all]                                             one node card, links read as sentences
//   node stack.js path <id> <id> [--time]                                       shortest chain; --time = forward in time only
//   node stack.js ent [<pillar>]                                                pillars, or one pillar's members
//   node stack.js layer <code>                                                  a layer's rules and its page
//   node stack.js session [<sid8>]                                              a recorded session step by step (or the list)
//   node stack.js drift | stats | health | patterns | proposals                 the reports in out/
//   node stack.js build [--quiet] [--no-archive] [--no-embed] [--rerecord]      rebuild out/ from the sources (≈ 1 min)
//   node stack.js doctor [--fix]                                                check out/ and data/; --fix repairs and rebuilds
//   node stack.js archive                                                       copy new transcripts into _admin/recordings
//   node stack.js connectome                                                    rewrite out/connectome-data.js (connectome.html)
//   node stack.js lineage                                                       rewrite out/lineage-data.js (lineage.html, Ötletfolyam)
//   node stack.js control                                                       rewrite out/control-data.js (control.html, Vezérlőterem)
//   node stack.js commits                                                       rewrite out/commits-data.js (commits.html, Commit-pixel)
//   node stack.js decisions                                                     rewrite out/decisions-data.js (decisions.html, Döntésnapló)
//   node stack.js metro                                                         rewrite out/metro-data.js (metro.html, Vonaltérkép)
//   node stack.js neuron [<address | root prefix>]                              an axiom neuron by address (or the gate counts)
//   node stack.js mcp                                                          run the MCP server on stdio
//
// Ids look like  F:p9  L:views  L:s0969dff9  U:run.0969dff9  R:5ee8b1e  C:Planner/src  E:planner
// Words are matched without accents and as prefixes ("vezetek" finds "vezetékcsatorna").
'use strict';

const Q = require('./lib/query');

const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };

async function main() {
  switch (cmd) {
    case 'q': case 'ask': {
      const n = +opt('-n', 8), budget = +opt('--budget', 900), layers = opt('--layer', ''), json = flag('--json');
      return Q.ask(args.join(' '), { n, budget, json, layers: layers ? layers.split(',') : null });
    }
    case 'node': return Q.node(args[0], { all: flag('--all') });
    case 'path': { const time = flag('--time'); return Q.chain(args[0], args[1], { time }); }
    case 'ent': return Q.pillar(args[0]);
    case 'layer': return Q.layer(args[0]);
    case 'session': return Q.session(args[0], { steps: +opt('--steps', 40) });
    case 'drift': return Q.report('DRIFT.md');
    case 'stats': return Q.report('STATUS.md');
    case 'health': return Q.report('HEALTH.md');
    case 'patterns': return Q.report('PATTERNS.md');
    case 'proposals': return Q.report('PROPOSALS.md');
    case 'build': {
      const r = await require('./lib/pipeline').run({ quiet: flag('--quiet'), noArchive: flag('--no-archive'), noEmbed: flag('--no-embed'), rerecord: flag('--rerecord') });
      if (r.worst === 'fail') process.exitCode = 2;
      return '';
    }
    case 'doctor': {
      const fix = flag('--fix');
      const H = require('./lib/health');
      const d = H.doctor({ fix });
      const lines = d.results.map(r => `${r.ok ? '✓' : '✗'} ${r.check.padEnd(11)} ${r.msg}${r.ok ? '' : '  → ' + r.repair}`);
      if (fix && d.needBuild) { lines.push('rebuilding …'); await require('./lib/pipeline').run({ quiet: true }); lines.push('rebuilt. ' + H.doctor().results.filter(r => !r.ok).length + ' problems left'); }
      else if (d.needBuild) lines.push('run  node stack.js doctor --fix  to rebuild');
      return lines.join('\n');
    }
    case 'neuron': {   // node stack.js neuron <address or root prefix>
      const J = JSON.parse(require('fs').readFileSync(require('path').join(require('./config').out, 'neurons.json'), 'utf8')), q = String(args[0] || '').toLowerCase(), r = q.length === 6 ? q.slice(1) : q;
      const hit = J.neurons.filter(x => x[0] === q || x[0].slice(1).startsWith(r));
      if (!q) { const by = {}; for (const x of J.neurons) by[x[0][0]] = (by[x[0][0]] || 0) + 1; return J.count + ' neurons; gates: ' + Object.entries(by).map(([g, n]) => g + ' ' + J.gates[g] + ' ' + n).join(' · '); }
      return hit.slice(0, 20).map(x => x[0] + '  ' + x[1] + '  ' + x[2] + ' KB #' + x[3] + '  w' + x[4] + (x[5].length ? '  → ' + x[5].join(' ') : '')).join('\n') || 'no neuron ' + q;
    }
    case 'connectome': return require('./lib/connectome').write().msg;
    case 'lineage': return require('./lib/lineage').write().msg;
    case 'control': return require('./lib/control').write().msg;
    case 'commits': return require('./lib/commitpixel').write().msg;
    case 'decisions': return require('./lib/decisions').write().msg;
    case 'metro': return require('./lib/metro').write().msg;
    case 'archive': { const r = require('./lib/archive').archive(); return `archive: ${r.copied} copied, ${r.same} unchanged, ${r.failed.length} failed`; }
    case 'mcp': require('./mcp/server').start(); return null;
    default: return require('fs').readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).slice(0, 24).map(l => l.slice(3)).join('\n');
  }
}

main().then(out => { if (out) console.log(out); }).catch(e => { console.error('stack: ' + (e && e.message || e)); process.exitCode = 1; });
