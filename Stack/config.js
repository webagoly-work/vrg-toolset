// VRG Stack — every path and tunable in one place. Nothing else hard-codes a location.
//
// Three kinds of folders, three rules:
//   SOURCES   (the maps, the repo, memory, transcripts) — read only, never written by the stack
//   out/      derived: safe to delete, rebuilt from SOURCES by `stack.js build`
//   data/     history: append-only logs and daily snapshots; cannot be rebuilt, so it is
//             validated, repaired (torn last line) and backed up, never rewritten
// The archive under _admin/recordings is a copy of the transcripts (STK-Q8 = A), so a
// recording survives Claude Code's own clean-up.
'use strict';

const path = require('path');

const ROOT = __dirname;
const FULL = 'H:/VRG/Full';
const CLAUDE_HOME = 'C:/Users/webag/.claude';

module.exports = {
  schema: 2, // bump when stack.json / events change shape; lib/health.js migrates or rebuilds

  root: ROOT,
  out: path.join(ROOT, 'out'),
  data: path.join(ROOT, 'data'),

  sources: {
    full: FULL,
    repo: FULL + '/Planner_VRG_U100',
    notes: FULL + '/notes',
    memory: CLAUDE_HOME + '/projects/H--/memory',
    claudeHome: CLAUDE_HOME,
    transcripts: CLAUDE_HOME + '/projects',
    fileHistory: CLAUDE_HOME + '/file-history',
  },

  archive: {
    dir: FULL + '/_admin/recordings',
    // what is copied: every transcript (+ subagent transcripts) and the file-history checkpoints
    take: [
      { from: CLAUDE_HOME + '/projects', to: 'projects', only: /\.(jsonl|json)$/i },
      { from: CLAUDE_HOME + '/file-history', to: 'file-history', only: null },
    ],
  },

  record: {
    // a recording is rebuilt when its transcript is newer than it
    minSteps: 1,
    // tool inputs are cut to this many characters in a recording (the archive keeps the full text)
    inputClip: 400,
  },

  search: {
    rrfK: 60,          // reciprocal rank fusion constant (Cormack et al.)
    chunkChars: 1800,  // a chunk is a heading section, split further above this size
    perNodeChunks: 24,
  },

  embed: {
    // STK-Q12 = B: bge-m3. It runs through Ollama when Ollama is installed and the model pulled
    // (`ollama pull bge-m3`, about 1.2 GB). Until then the provider reports "off" and search is
    // full-text only. Nothing is downloaded by the stack itself.
    provider: 'ollama',
    model: 'bge-m3',
    url: 'http://127.0.0.1:11434',
    timeoutMs: 1500,
    batch: 32,
  },

  activation: {
    decay: 0.5,        // energy kept per hop
    hops: 2,
    hubPenalty: 0.5,   // lateral inhibition: a node with degree d passes on energy / d^hubPenalty
    threshold: 0.02,
  },

  strings: {
    // Stack Strings (lib/strings.js, research/STRINGS-PLAN.md §1). Any key here overrides its DEFAULTS.
    depth: 2, cutoff: 0.15, hub: 16, hubPenalty: 1, inBuildDays: 14,
  },

  patterns: {
    minSupport: 3,     // a sequence must occur in at least this many sessions
    maxLen: 4,
  },

  health: {
    volumeDrop: 0.3,   // a layer losing more than 30 % of its nodes in one build is flagged
    lockStaleMin: 10,
  },

  mcp: { name: 'vrg-stack', version: '2.0.0', protocol: '2025-06-18' },
  serve: { port: 8806 },
};
