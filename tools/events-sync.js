#!/usr/bin/env node
// events-sync.js — keep the Munkavászon's inline copy of the event spine in step with its source.
//
// shared/vrg-events/events.js is the one source (VIS-Q4). The Munkavászon is a self-contained page (it must open
// from file:// too), so it carries a copy between  /* model:begin */ … /* model:end */ . This writes the source into
// that copy, or with --check only compares them (exit 1 when they differ).
//   node tools/events-sync.js            write the copy
//   node tools/events-sync.js --check    exit 1 if the copy has drifted
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SOURCE = path.join(REPO, 'shared', 'vrg-events', 'events.js');
const TARGETS = ['SessionCanvas/vrg-munkavaszon.html'];
const BEGIN = '/* model:begin */', END = '/* model:end */';

const src = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
// the header comment stays in the source; the copy starts at the code
const code = src.slice(src.indexOf('*/') + 2).replace(/^\n+/, '').trimEnd();
let bad = 0;
for (const rel of TARGETS) {
  const file = path.join(REPO, rel), text = fs.readFileSync(file, 'utf8');
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < a) { console.log('NOMARK   ' + rel); bad++; continue; }
  const now = text.slice(a + BEGIN.length, b).trim();
  if (now === code) { console.log('ok       ' + rel); continue; }
  if (process.argv.includes('--check')) { console.log('DRIFT    ' + rel); bad++; continue; }
  fs.writeFileSync(file, text.slice(0, a + BEGIN.length) + '\n' + code + '\n' + text.slice(b));
  console.log('synced   ' + rel);
}
process.exit(bad ? 1 : 0);
