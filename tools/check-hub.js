#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check-hub.js — gate for VRG Kapu, run after build-hub.js.
//
//   1. Hub/dist/vrg-kapu.html exists and carries a KP_BUILD stamp
//   2. no token / key pattern anywhere in the built page or the hub data
//   3. the START.cmd tool list baked into the page, every path existing
//   4. the allowed list's signature; the agent init docs' template
//
//   node tools/check-hub.js   (--strict is accepted and changes nothing since the
//                              2026-10-26 rework: there are no topology paths left)
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

// the tool list baked from START.cmd: present, and every path still exists
if (fs.existsSync(DIST)) {
  const m = fs.readFileSync(DIST, 'utf8').match(/id="kpTools">(.*?)<\/script>/);
  const tools = m ? JSON.parse(m[1]) : null;
  if (!tools || !tools.length) bad('dist has no kpTools (the START.cmd tool list) - rebuild');
  else {
    const missing = tools.filter(t => !fs.existsSync(path.join(REPO, t.path)));
    missing.forEach(t => bad('tool ' + t.key + ' path missing: ' + t.path + ' - rebuild after fixing START.cmd'));
    if (!missing.length) ok(tools.length + ' START.cmd tools, every path exists');
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
    const { kpCanon } = require(path.join(HUB, 'src', 'js', '60-access.js'));
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
