#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check-hub.js — gate for VRG Kapu, run after build-hub.js.
//
//   1. Hub/dist/vrg-kapu.html exists and carries a KP_BUILD stamp
//   2. no token / key pattern anywhere in the built page or the hub data
//   (later WPs add: topology schema, every repo path resolves)
//
//   node tools/check-hub.js
//
// Exit code 1 if anything is wrong, so it can gate a commit.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HUB = path.join(REPO, 'Hub');
const DIST = path.join(HUB, 'dist', 'vrg-kapu.html');

const SECRETS = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|BEGIN [A-Z ]*PRIVATE KEY/;

const problems = [];
const ok = msg => console.log('  ok    ' + msg);
const bad = msg => { problems.push(msg); console.log('  HIBA  ' + msg); };

console.log('VRG Kapu check');

if (!fs.existsSync(DIST)) {
  bad('Hub/dist/vrg-kapu.html missing - run node tools/build-hub.js');
} else {
  const html = fs.readFileSync(DIST, 'utf8');
  const m = html.match(/const KP_BUILD = "([0-9a-f]{12})"/);
  if (m) ok('build ' + m[1]); else bad('dist has no KP_BUILD stamp');
}

const scan = [DIST, path.join(HUB, 'data')].filter(fs.existsSync).flatMap(function walk(p) {
  return fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap(f => walk(path.join(p, f))) : [p];
});
const leaks = scan.filter(f => SECRETS.test(fs.readFileSync(f, 'utf8')));
if (leaks.length) leaks.forEach(f => bad('secret-like pattern in ' + path.relative(REPO, f)));
else ok('no secret patterns in ' + scan.length + ' file(s)');

console.log(problems.length ? '\n' + problems.length + ' problem(s).' : '\nRendben.');
process.exit(problems.length ? 1 : 0);
