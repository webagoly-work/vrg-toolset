// Mobile/tests/app-archive.js — the work app archive (WP M61, D-163) against a FAKE adb: parsing, split APKs, the
// manifest (shared with the Data Vault's tools/apps.js), list, verify catching a changed or missing file. Never runs a
// real adb, never touches a phone. Temporary folders only.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const A = require('../tools/app-archive.js');

let failed = 0, passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-app-archive-'));
const phoneDir = path.join(tmp, 'phone');
fs.mkdirSync(phoneDir);
fs.writeFileSync(path.join(phoneDir, 'base.apk'), 'BASE-APK-BYTES');
fs.writeFileSync(path.join(phoneDir, 'split_config.arm64_v8a.apk'), 'SPLIT-ABI');

// The fake adb: answers from fixtures; "pull" copies from phoneDir.
const fake = path.join(tmp, 'fake-adb.js');
fs.writeFileSync(fake, `
const fs = require('fs'), path = require('path');
const a = process.argv.slice(2), dir = ${JSON.stringify(phoneDir)};
const pkg = 'com.example.fundo';
if (a[0] === 'shell' && a[1] === 'pm' && a[2] === 'list') { process.stdout.write('package:com.example.fundo\\npackage:org.other.app\\n'); }
else if (a[0] === 'shell' && a[1] === 'pm' && a[2] === 'path') {
  if (a[3] !== pkg) process.exit(0);
  process.stdout.write('package:/data/app/~~x==/com.example.fundo-y==/base.apk\\r\\npackage:/data/app/~~x==/com.example.fundo-y==/split_config.arm64_v8a.apk\\r\\n');
}
else if (a[0] === 'shell' && a[1] === 'dumpsys') {
  process.stdout.write('Packages:\\n  Package [com.example.fundo] (abc):\\n    versionCode=278 minSdk=21 targetSdk=33\\n    versionName=2.7.8\\n' +
    '    installerPackageName=com.android.vending\\n    firstInstallTime=2026-11-22 03:58:01\\n    lastUpdateTime=2026-11-22 03:58:01\\n' +
    '  Package [com.example.fundo] (old):\\n    versionCode=1\\n    versionName=0.1\\n');
}
else if (a[0] === 'shell' && a[1] === 'getprop') process.stdout.write(a[2] === 'ro.product.model' ? 'Phone X\\n' : '14\\n');
else if (a[0] === 'pull') fs.copyFileSync(path.join(dir, path.posix.basename(a[1])), a[2]);
else { process.stderr.write('unknown ' + a.join(' ')); process.exit(1); }
`);

(async () => {
  await t('parsers', () => {
    assert.deepStrictEqual(A.parsePmPath('package:/a/base.apk\r\npackage:/a/s.apk\n\n'), ['/a/base.apk', '/a/s.apk']);
    assert.deepStrictEqual(A.parsePmList('package:z.b\npackage:a.c\n'), ['a.c', 'z.b']);
    const d = A.parseDumpsys('versionCode=5 minSdk=1\n versionName=1.0 beta\n installer=com.android.vending\n');
    assert.strictEqual(d.versionCode, 5); assert.strictEqual(d.versionName, '1.0'); assert.strictEqual(d.installer, 'com.android.vending');
    assert.strictEqual(A.safeName('a b/c:d'), 'a_b_c_d');
  });

  const out = path.join(tmp, 'archive');
  let made;
  await t('pull: split APKs, hashes and the shared manifest', async () => {
    made = await A.pull({ _: ['pull', 'com.example.fundo'], adb: fake, out, label: 'FunDo Pro', note: 'Q71 watch app' });
    const m = JSON.parse(fs.readFileSync(path.join(made.dir, 'manifest.json'), 'utf8'));
    assert.strictEqual(m.kind, 'vrg.app-archive'); assert.strictEqual(m.v, 1);
    assert.strictEqual(m.package, 'com.example.fundo'); assert.strictEqual(m.label, 'FunDo Pro');
    assert.strictEqual(m.versionName, '2.7.8'); assert.strictEqual(m.versionCode, 278, 'the first block, not an older one');
    assert.strictEqual(m.installer, 'com.android.vending');
    assert.deepStrictEqual(m.device, { model: 'Phone X', android: '14' });
    assert.deepStrictEqual(m.files.map(f => f.name), ['base.apk', 'split_config.arm64_v8a.apk']);
    assert.strictEqual(m.files[0].bytes, 14);
    assert.strictEqual(m.files[0].sha256, require('crypto').createHash('sha256').update('BASE-APK-BYTES').digest('hex'));
    assert.ok(path.basename(made.dir) === '2.7.8-278');
    const keys = ['kind', 'v', 'package', 'label', 'versionName', 'versionCode', 'installer', 'firstInstall', 'lastUpdate', 'pulledAt', 'device', 'files', 'note'];
    assert.deepStrictEqual(Object.keys(m), keys, 'exactly the shared keys, in order');
    assert.ok(!JSON.stringify(m).includes(tmp), 'no absolute path in the manifest');
  });

  await t('pull --find picks the only match', async () => {
    const r = await A.pull({ _: ['pull'], adb: fake, out: path.join(tmp, 'archive2'), find: 'fundo' });
    assert.strictEqual(r.manifest.package, 'com.example.fundo');
  });

  await t('pull of an app that is not installed fails clearly', async () => {
    await assert.rejects(A.pull({ _: ['pull', 'com.not.there'], adb: fake, out }), /nincs telepitve/);
  });

  await t('list and verify', () => {
    assert.strictEqual(A.list({ out }).length, 1);
    assert.deepStrictEqual(A.verify({ out }), []);
    fs.writeFileSync(path.join(made.dir, 'base.apk'), 'TAMPERED');
    fs.unlinkSync(path.join(made.dir, 'split_config.arm64_v8a.apk'));
    const p = A.verify({ out });
    assert.ok(p.some(x => x.includes('MEGVALTOZOTT base.apk')), p.join('; '));
    assert.ok(p.some(x => x.includes('hianyzik split_config')), p.join('; '));
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`app-archive: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
