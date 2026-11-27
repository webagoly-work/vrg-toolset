#!/usr/bin/env node
// VRG Jegyzetek: checks Notes/catalog/noteskit.json (the same rules as kit-core NotesKit.problems, WP M69).
// Exit 1 when something is wrong. Usage: node Notes/tools/check.js [file]
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'catalog', 'noteskit.json');
let k;
try { k = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('noteskit: cannot read ' + file + ': ' + e.message); process.exit(1); }

const out = [];
if (k.kind !== 'vrg-noteskit') out.push('kind must be vrg-noteskit');
const modules = k.modules || [], profiles = k.profiles || [], templates = k.templates || [], origins = k.origins || [];
const ID = /^[a-z0-9-]+$/;
function dup(what, list) {
  const seen = new Set();
  for (const x of list) {
    if (!x.id || !ID.test(x.id)) out.push(what + ': bad id ' + JSON.stringify(x.id));
    else if (seen.has(x.id)) out.push(what + ' twice: ' + x.id);
    seen.add(x.id);
    if (!x.label && !x.name) out.push(what + ' ' + x.id + ': no label');
  }
}
dup('module', modules); dup('profile', profiles); dup('template', templates); dup('origin', origins);
const mod = id => modules.find(m => m.id === id);
if (profiles.filter(p => p.default).length !== 1) out.push('exactly one profile must be the default');
for (const p of profiles) {
  for (const m of p.modules || []) {
    if (m === '*') continue;
    if (!mod(m)) out.push('profile ' + p.id + ': no module ' + m);
    else if (mod(m).planned) out.push('profile ' + p.id + ': ' + m + ' is only planned');
  }
  for (const t of p.templates || []) if (t !== '*' && !templates.some(x => x.id === t)) out.push('profile ' + p.id + ': no template ' + t);
  if (!['lista', 'kartyak'].includes(p.list || 'lista')) out.push('profile ' + p.id + ': list is lista or kartyak');
  if (!p.premise) out.push('profile ' + p.id + ': no premise');
}
for (const o of origins) {
  if (o.mirror && !o.link && !o.planned) out.push('origin ' + o.id + ': a mirror needs a link back');
  if (o.color && !/^#[0-9a-f]{6}$/i.test(o.color)) out.push('origin ' + o.id + ': colour is #rrggbb');
}
if (!origins.some(o => o.id === 'kezi')) out.push('origin kezi (notes written in the app) is missing');

if (out.length) { out.forEach(l => console.error('noteskit: ' + l)); process.exit(1); }
console.log('noteskit: OK (' + modules.length + ' modules, ' + profiles.length + ' versions, ' + templates.length + ' templates, ' + origins.length + ' origins)');
