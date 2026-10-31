#!/usr/bin/env node
// Installs the kit's Claude Code agents (agents/*.md, the single source) into one or more .claude/agents folders.
//   node agents/install.js <dir>/.claude/agents [...]        copy (creates the folder)
//   node agents/install.js --check <dir>/.claude/agents [...] report installed copies that differ from the kit (exit 1)
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), check = args[0] === '--check', targets = args.filter(a => a !== '--check');
if (!targets.length) { console.error('usage: install.js [--check] <target .claude/agents dir> ...'); process.exit(2); }
const agents = fs.readdirSync(__dirname).filter(f => f.endsWith('.md'));
let diff = 0;
targets.forEach(t => agents.forEach(a => { const src = fs.readFileSync(path.join(__dirname, a), 'utf8'), dst = path.join(t, a);
  if (check) { const same = fs.existsSync(dst) && fs.readFileSync(dst, 'utf8') === src; if (!same) diff++; console.log((same ? 'ok    ' : 'DIFF  ') + dst); return; }
  fs.mkdirSync(t, { recursive: true }); fs.writeFileSync(dst, src); console.log('installed', dst); }));
process.exit(diff ? 1 : 0);
