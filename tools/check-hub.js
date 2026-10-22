#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check-hub.js — gate for VRG Kapu, run after build-hub.js.
//
//   1. Hub/dist/vrg-kapu.html exists and carries a KP_BUILD stamp
//   2. no token / key pattern anywhere in the built page or the hub data
//   3. topology.json passes kpValidate (errors fail, warnings print)
//   4. every repo path in the topology exists in this checkout. Paths that are
//      still uncommitted work elsewhere only warn; --strict (before handing the
//      hub out, WP-H13) makes them errors, since GitHub would 404 on them.
//
//   node tools/check-hub.js [--strict]
//
// Exit code 1 if anything is wrong, so it can gate a commit.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HUB = path.join(REPO, 'Hub');
const DIST = path.join(HUB, 'dist', 'vrg-kapu.html');
const STRICT = process.argv.includes('--strict');

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

const TOPO = path.join(HUB, 'data', 'topology.json');
if (!fs.existsSync(TOPO)) {
  bad('Hub/data/topology.json missing');
} else {
  const { kpValidate } = require(path.join(HUB, 'src', 'js', '10-model.js'));
  let topo = null;
  try { topo = JSON.parse(fs.readFileSync(TOPO, 'utf8')); } catch (e) { bad('topology.json: ' + e.message); }
  if (topo) {
    const r = kpValidate(topo);
    r.errors.forEach(e => bad('topology: ' + e));
    if (r.ok) ok('topology valid (' + topo.departments.length + ' departments, ' + topo.programs.length + ' programs)');
    if (r.warnings.length) console.log('  warn  ' + r.warnings.length + ' warning(s), e.g. ' + r.warnings[0]);

    // every repo path must exist; the hub's own build output may not exist before the first build
    const repoPaths = [];
    const add = (where, p) => p && repoPaths.push([where, p]);
    for (const p of topo.programs) {
      add(p.id + '.open', p.open && p.open.repo);
      for (const a of p.agent || []) add(p.id + '.agent', a.repo);
      for (const f of p.folders || []) add(p.id + '.folder', f.repo);
      for (const g of (p.git && p.git.paths) || []) add(p.id + '.git', g);
    }
    const missing = repoPaths.filter(([, p]) => !p.startsWith('Hub/dist/') && !fs.existsSync(path.join(REPO, p)));
    if (STRICT) missing.forEach(([w, p]) => bad('repo path missing: ' + p + '  (' + w + ')'));
    else if (missing.length) {
      console.log('  warn  ' + missing.length + ' of ' + repoPaths.length + ' repo paths not in this checkout (yet):');
      [...new Set(missing.map(([, p]) => p))].forEach(p => console.log('          ' + p));
    }
    if (!missing.length) ok(repoPaths.length + ' repo paths exist');
  }
}

// the allowed list: a bad signature fails, a missing or unsigned list only warns
const ACCESS = path.join(HUB, 'data', 'access.json'), PUB = path.join(HUB, 'src', 'access-pubkey.json');
if (!fs.existsSync(ACCESS)) console.log('  warn  no Hub/data/access.json yet - every program stays closed (WP-H5)');
else {
  const a = JSON.parse(fs.readFileSync(ACCESS, 'utf8'));
  if (!a.sig || !fs.existsSync(PUB)) console.log('  warn  access.json is not signed - run node tools/hub-sign.js');
  else {
    const crypto = require('crypto');
    const { kpCanon } = require(path.join(HUB, 'src', 'js', '10-model.js'));
    const key = crypto.createPublicKey({ key: JSON.parse(fs.readFileSync(PUB, 'utf8')), format: 'jwk' });
    if (crypto.verify('sha256', Buffer.from(kpCanon(a.body)), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(a.sig, 'base64'))) ok('access.json signature valid (' + a.body.people.length + ' people)');
    else bad('access.json signature INVALID - changed after signing?');
  }
}

// agent init docs (WP-H12): the fixed template's 7 headings in order, at most 60 lines, a Forrás line
const AGENTS = path.join(REPO, 'docs', 'hub', 'agents');
const HEADS = ['1. What it is', '2. Where', '3. Read first', '4. Build / test / check', '5. Rules and traps', '6. Current state', '7. Do not touch'];
if (fs.existsSync(AGENTS)) {
  const docs = fs.readdirSync(AGENTS).filter(f => f.endsWith('.md') && !['README.md', 'SESSIONS.md'].includes(f));
  const before = problems.length;
  for (const f of docs) {
    const lines = fs.readFileSync(path.join(AGENTS, f), 'utf8').trimEnd().split(/\r?\n/);
    const got = lines.filter(l => l.startsWith('## ')).map(l => l.slice(3));
    if (got.length !== HEADS.length || HEADS.some((h, i) => !got[i].startsWith(h))) bad('agents/' + f + ': headings are not the 7 of the template, in order');
    if (lines.length > 60) bad('agents/' + f + ': ' + lines.length + ' lines (max 60)');
    if (!/^Forrás: /.test(lines[lines.length - 1])) bad('agents/' + f + ': last line is not "Forrás: ..."');
  }
  if (problems.length === before) ok(docs.length + ' agent init docs follow the template');
}

const scan = [DIST, path.join(HUB, 'data')].filter(fs.existsSync).flatMap(function walk(p) {
  return fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap(f => walk(path.join(p, f))) : [p];
});
const leaks = scan.filter(f => SECRETS.test(fs.readFileSync(f, 'utf8')));
if (leaks.length) leaks.forEach(f => bad('secret-like pattern in ' + path.relative(REPO, f)));
else ok('no secret patterns in ' + scan.length + ' file(s)');

console.log(problems.length ? '\n' + problems.length + ' problem(s).' : '\nRendben.');
process.exit(problems.length ? 1 : 0);
