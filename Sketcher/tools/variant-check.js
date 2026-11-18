#!/usr/bin/env node
// Sketcher/tools/variant-check.js — the gate every VRG Sketcher variant passes (Sketcher/variants/PROTOCOL.md step 6).
//
//   node Sketcher/tools/variant-check.js                 every variant in Sketcher/variants + the field kit
//   node Sketcher/tools/variant-check.js <file.json>…    just these (a draft outside the folder is fine)
//   node Sketcher/tools/variant-check.js --kit           the field kit alone
//
// Checks the shape (Sketcher/lib/fieldkit.js validateKit / validateVariant), that the file name is <id>.json inside
// the folder, that no id collides with another variant's, and that the merged kit still parses on both sides' rules
// (conditions, regexes). Exit 1 on any error, so it can gate a commit.
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../lib/fieldkit.js');
const ROOT = path.join(__dirname, '..');
const kitJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'fieldkit.json'), 'utf8'));
let bad = 0;
const report = (name, errs) => {
  if (errs.length) { bad++; console.log('FAIL ' + name); errs.forEach(e => console.log('     ' + e)); } else console.log('ok   ' + name);
};

report('catalog/fieldkit.json', K.validateKit(kitJson));
if (!process.argv.includes('--kit')) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dir = path.join(ROOT, 'variants');
  const files = args.length ? args : fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => path.join(dir, f));
  const ids = {};
  for (const f of files) {
    let v, errs = [];
    try { v = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { report(f, ['not JSON: ' + e.message]); continue; }
    errs = K.validateVariant(v, kitJson);
    if (path.dirname(path.resolve(f)) === dir && path.basename(f) !== v.id + '.json') errs.push('file name must be ' + v.id + '.json');
    if (ids[v.id]) errs.push('id ' + v.id + ' is also ' + ids[v.id]);
    ids[v.id] = path.basename(f);
    try { K.withVariant(K.parseKit(kitJson), v); } catch (e) { errs.push('does not merge: ' + e.message); }
    report(path.relative(process.cwd(), f), errs);
  }
}
process.exit(bad ? 1 : 0);
