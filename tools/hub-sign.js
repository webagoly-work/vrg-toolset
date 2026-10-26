#!/usr/bin/env node
// ---------------------------------------------------------------------------
// hub-sign.js — the owner's signature on the VRG Kapu allowed list.
//
// Both users can push to the repo, so "only the owner edits the list" is a
// signature, not a permission: the page verifies Hub/data/access.json with the
// public key in Hub/src/access-pubkey.json and ignores a list that fails.
//
//   node tools/hub-sign.js --init      make the key pair (once)
//   node tools/hub-sign.js             sign Hub/data/access.json after an edit
//   node tools/hub-sign.js --verify    check the signature
//
//   --key <pem>     private key (default H:\cwebuser\_admin\keys\hub-access.pem).
//                   Must be outside the repo and outside OneDrive.
//   --pub <json>    public key file   (default Hub/src/access-pubkey.json)
//   --access <json> the list          (default Hub/data/access.json)
//   --force         --init may replace an existing key (old signatures stop verifying)
//
// ECDSA P-256 over kpCanon(body), signature as base64 of r||s (ieee-p1363),
// which is what WebCrypto verifies. The private key is never printed.
// Exit code 1 on any failure.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { kpCanon } = require('../Hub/src/js/60-access.js');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const has = name => args.includes(name);

const KEY = path.resolve(opt('--key', 'H:\\cwebuser\\_admin\\keys\\hub-access.pem'));
const PUB = path.resolve(REPO, opt('--pub', 'Hub/src/access-pubkey.json'));
const ACCESS = path.resolve(REPO, opt('--access', 'Hub/data/access.json'));

function fail(msg) { console.error('hub-sign: ' + msg); process.exit(1); }
const inside = (p, root) => { const r = path.relative(root, p); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };

function checkKeyPath() {
  if (inside(KEY, REPO) || KEY === REPO) fail('the private key must not be inside the repo: ' + KEY);
  if (/onedrive/i.test(KEY)) fail('the private key must not be in OneDrive: ' + KEY);
}

function init() {
  checkKeyPath();
  if (fs.existsSync(KEY) && !has('--force')) fail('a key already exists at ' + KEY + ' (use --force to replace it; old signatures then stop verifying)');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  fs.writeFileSync(KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const jwk = publicKey.export({ format: 'jwk' });
  fs.mkdirSync(path.dirname(PUB), { recursive: true });
  fs.writeFileSync(PUB, JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, null, 2) + '\n');
  console.log('key pair made. private: ' + KEY + ' (keep it there, never commit it) · public: ' + path.relative(REPO, PUB));
}

function readAccess() {
  if (!fs.existsSync(ACCESS)) fail('no list at ' + path.relative(REPO, ACCESS));
  const a = JSON.parse(fs.readFileSync(ACCESS, 'utf8'));
  if (a.schema !== 'vrg-hub-access/1' || !a.body) fail('not a vrg-hub-access/1 file');
  return a;
}

function sign() {
  checkKeyPath();
  if (!fs.existsSync(KEY)) fail('no private key at ' + KEY + ' - run with --init first');
  const a = readAccess();
  const key = crypto.createPrivateKey(fs.readFileSync(KEY));
  a.sig = crypto.sign('sha256', Buffer.from(kpCanon(a.body)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');
  fs.writeFileSync(ACCESS, JSON.stringify(a, null, 2) + '\n');
  console.log('signed ' + path.relative(REPO, ACCESS) + ' (' + a.body.people.length + ' people, rev ' + a.body.rev + ')');
}

function verify() {
  const a = readAccess();
  if (!fs.existsSync(PUB)) fail('no public key at ' + path.relative(REPO, PUB));
  if (!a.sig) fail('the list is not signed');
  const key = crypto.createPublicKey({ key: JSON.parse(fs.readFileSync(PUB, 'utf8')), format: 'jwk' });
  const ok = crypto.verify('sha256', Buffer.from(kpCanon(a.body)), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(a.sig, 'base64'));
  if (!ok) fail('signature INVALID - the list was changed after signing, or signed with another key');
  console.log('signature ok (' + a.body.people.length + ' people, rev ' + a.body.rev + ')');
}

if (has('--init')) init();
else if (has('--verify')) verify();
else sign();
