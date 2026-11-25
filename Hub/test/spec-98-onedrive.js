'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const build = args => execFileSync(process.execPath, [path.join(REPO, 'tools', 'build-hub.js'), ...args], { encoding: 'utf8', stdio: 'pipe' });
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

module.exports = [
  { name: '--onedrive: byte-identical copy + OLVASS_EL.md (two modes, owner by GitHub name, no e-mail)', fn() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-od-'));
    build(['--onedrive', dir]);
    assert.strictEqual(sha(path.join(dir, 'vrg-kapu.html')), sha(path.join(REPO, 'Hub', 'dist', 'vrg-kapu.html')));
    const md = fs.readFileSync(path.join(dir, 'OLVASS_EL.md'), 'utf8');
    for (const s of ['**Csak linkek mód**', '**Teljes mód**', 'Hub\\VRG Kapu.cmd', 'KOLLEGA-INDULAS.md', '`webagoly-work`']) assert.ok(md.includes(s), s);
    assert.ok(!/@/.test(md), 'no e-mail address in the note');
    fs.rmSync(dir, { recursive: true });
  } },
  { name: '--onedrive: the guest page (T9): a missing linkek.html gets the empty one, the VRG Böngésző\'s own is kept', fn() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-od-'));
    build(['--onedrive', dir]);
    const g = fs.readFileSync(path.join(dir, 'linkek.html'), 'utf8');
    assert.ok(!/<script/i.test(g) && /Content-Security-Policy/.test(g) && /Még nincs megosztott link/.test(g));
    fs.writeFileSync(path.join(dir, 'linkek.html'), 'OWN PAGE');
    build(['--onedrive', dir]);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'linkek.html'), 'utf8'), 'OWN PAGE');
    assert.match(fs.readFileSync(path.join(dir, 'OLVASS_EL.md'), 'utf8'), /Linkek \(vendég\)/);
    const kapu = fs.readFileSync(path.join(REPO, 'Hub', 'dist', 'vrg-kapu.html'), 'utf8');
    assert.ok(kapu.includes("'Linkek (vendég)'") && kapu.includes("KP_GUEST_PAGE = 'linkek.html'"), 'the sign-in card has the button');
    fs.rmSync(dir, { recursive: true });
  } },
  { name: '--onedrive: a folder that does not exist fails, nothing is guessed', fn() {
    assert.throws(() => build(['--onedrive', path.join(os.tmpdir(), 'kp-od-does-not-exist-' + process.pid)]));
  } }
];
