'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { kpLoad } = require('./load');
const { kpCanon } = require('../src/js/60-access.js');

const REPO = path.resolve(__dirname, '..', '..');
const SIGN = path.join(REPO, 'tools', 'hub-sign.js');

// a throw-away key pair, made here, never stored
function keys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const j = publicKey.export({ format: 'jwk' });
  return { privateKey, pub: { kty: j.kty, crv: j.crv, x: j.x, y: j.y } };
}
const sign = (body, k) => crypto.sign('sha256', Buffer.from(kpCanon(body)), { key: k, dsaEncoding: 'ieee-p1363' }).toString('base64');
const BODY = () => ({ rev: 1, updated: '2026-10-21', people: [
  { name: 'Owner', github: 'Owner-Login', emails: ['o@example.test'], role: 'owner', layers: ['L1', 'L2', 'L3', 'L4'] },
  { name: 'Member', github: 'member-login', emails: ['m@example.test'], role: 'member', layers: ['L1', 'L2', 'L3', 'L4'] }] });

const page = () => kpLoad(['00-core.js', '60-access.js'], { crypto: globalThis.crypto, atob, TextEncoder });
const run = args => { try { execFileSync(process.execPath, [SIGN, ...args], { cwd: REPO, stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };

module.exports = [
  { name: 'kpCanon sorts keys recursively, no spaces', fn() {
    assert.strictEqual(kpCanon({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  } },
  { name: 'signed in Node, verified with WebCrypto; me found case-insensitively', async fn() {
    const k = keys(), body = BODY();
    const r = await page().kpAccessCheck({ schema: 'vrg-hub-access/1', body, sig: sign(body, k.privateKey) }, k.pub, 'owner-login');
    assert.strictEqual(r.state, 'valid');
    assert.strictEqual(r.me.name, 'Owner');
    assert.strictEqual(r.role, 'owner');
  } },
  { name: 'one changed email after signing -> invalid', async fn() {
    const k = keys(), body = BODY();
    const sig = sign(body, k.privateKey);
    body.people[1].emails[0] = 'someone@else.test';
    const r = await page().kpAccessCheck({ schema: 'vrg-hub-access/1', body, sig }, k.pub, 'member-login');
    assert.strictEqual(r.state, 'invalid');
    assert.strictEqual(r.valid, false);
  } },
  { name: 'reordered keys in body still verify (canonical form)', async fn() {
    const k = keys(), body = BODY();
    const sig = sign(body, k.privateKey);
    const re = { people: body.people.map(p => ({ layers: p.layers, role: p.role, emails: p.emails, github: p.github, name: p.name })), updated: body.updated, rev: body.rev };
    const r = await page().kpAccessCheck({ schema: 'vrg-hub-access/1', body: re, sig }, k.pub, 'x');
    assert.strictEqual(r.state, 'valid');
    assert.strictEqual(r.me, null);
  } },
  { name: 'another key -> invalid; no sig -> unsigned; no list -> none', async fn() {
    const k = keys(), other = keys(), body = BODY();
    const p = page();
    assert.strictEqual((await p.kpAccessCheck({ schema: 'vrg-hub-access/1', body, sig: sign(body, other.privateKey) }, k.pub, 'x')).state, 'invalid');
    assert.strictEqual((await p.kpAccessCheck({ schema: 'vrg-hub-access/1', body }, k.pub, 'x')).state, 'unsigned');
    assert.strictEqual((await p.kpAccessCheck(null, k.pub, 'x')).state, 'none');
  } },
  { name: 'hub-sign --init refuses a key inside the repo or in OneDrive', fn() {
    assert.strictEqual(run(['--init', '--key', 'Hub/x.pem', '--pub', path.join(os.tmpdir(), 'kp-p.json')]), 1);
    assert.ok(!fs.existsSync(path.join(REPO, 'Hub', 'x.pem')));
    assert.strictEqual(run(['--init', '--key', path.join(os.tmpdir(), 'OneDrive', 'k.pem'), '--pub', path.join(os.tmpdir(), 'kp-p.json')]), 1);
  } },
  { name: 'hub-sign round trip: init, sign, verify; tamper -> verify fails', fn() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-sign-'));
    const key = path.join(dir, 'k.pem'), pub = path.join(dir, 'pub.json'), acc = path.join(dir, 'access.json');
    fs.writeFileSync(acc, JSON.stringify({ schema: 'vrg-hub-access/1', body: BODY() }));
    try {
      assert.strictEqual(run(['--init', '--key', key, '--pub', pub]), 0);
      assert.strictEqual(run(['--init', '--key', key, '--pub', pub]), 1, 'no silent overwrite');
      assert.strictEqual(run(['--key', key, '--pub', pub, '--access', acc]), 0);
      assert.strictEqual(run(['--verify', '--pub', pub, '--access', acc]), 0);
      const a = JSON.parse(fs.readFileSync(acc, 'utf8'));
      a.body.people[0].layers = ['L1'];
      fs.writeFileSync(acc, JSON.stringify(a));
      assert.strictEqual(run(['--verify', '--pub', pub, '--access', acc]), 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  } },
  { name: 'gate: member with L1 open; unknown login closed with the ⛔ text', async fn() {
    const k = keys(), body = BODY();
    const access = { schema: 'vrg-hub-access/1', body, sig: sign(body, k.privateKey) };
    const ctx = kpLoad(['00-core.js', '50-github.js', '60-access.js'], { crypto: globalThis.crypto, atob, TextEncoder, kpData: { access, pubkey: k.pub } });
    ctx.kpGh.login = 'member-login';
    await ctx.kpAccessRefresh();
    assert.strictEqual(ctx.kpL1Open(), true);
    ctx.kpGh.login = 'stranger';
    await ctx.kpAccessRefresh();
    assert.strictEqual(ctx.kpL1Open(), false);
    assert.strictEqual(ctx.kpL1Why(), 'Nem szerepelsz az engedélyezett listán — kérd a tulajdonost.');
  } }
];
