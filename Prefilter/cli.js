#!/usr/bin/env node
// cli.js — try the Előszűrő on one prompt.
//   node Prefilter/cli.js "prompt" [--json] [--attach file.pdf]... [--mode auto|context|independent|unsure] [--rebuild] [--full <dir>] [--stats]
// Prints the verdict, the score, the signals, the anchors, the model and the dressed prompt (--json: the whole analysis + dress).
'use strict';
const path = require('path');
const pf = require('./prefilter.js');

const argv = process.argv.slice(2);
const flag = k => argv.includes(k);
const vals = k => argv.flatMap((a, i) => (a === k && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
const skip = new Set();
argv.forEach((a, i) => { if (['--attach', '--mode', '--full'].includes(a)) { skip.add(i); skip.add(i + 1); } else if (a.startsWith('--')) skip.add(i); });
const text = argv.filter((a, i) => !skip.has(i)).join(' ');
const repo = path.resolve(__dirname, '..');
const full = vals('--full')[0] || process.env.VRG_FULL || path.dirname(repo);

const t0 = Date.now();
const index = pf.loadIndex({ repo, full, rebuild: flag('--rebuild') });
const loadMs = Date.now() - t0;
if (flag('--stats') || !text) {
  console.log(JSON.stringify({ ...index.stats, names: Object.keys(index.names).length, body: Object.keys(index.body).length, units: index.units, loadMs }, null, 1));
  if (!text) process.exit(0);
}
const attachments = vals('--attach').map(n => ({ name: path.basename(n), ext: path.extname(n).slice(1) }));
const a = pf.analyze(text, { index, attachments });
const d = pf.dress(text, a, { mode: vals('--mode')[0] || 'auto' });
if (flag('--json')) { console.log(JSON.stringify({ analysis: a, dress: d }, null, 1)); process.exit(0); }
console.log('verdict : ' + a.verdict + '   score ' + a.score + '   (context ≥ ' + a.threshold.context + ', independent < ' + a.threshold.independent + ')');
console.log('intent  : ' + a.intent + '   model ' + a.model + '   ' + a.ms + ' ms (index ' + loadMs + ' ms)');
console.log('signals : ' + (a.signals.map(s => s.kind + ':' + s.text + '=' + s.weight).join('  ') || '—'));
console.log('anchors : ' + (a.anchors.map(x => x.title + ' [' + x.kind + ', ' + x.source + ']').join('; ') || '—'));
console.log('reasons : ' + a.reasons.join(' · '));
console.log('---- dressed prompt (' + d.length + ' chars, +' + d.overhead + ') ----');
console.log(d.prompt);
