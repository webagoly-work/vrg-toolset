/* Phase 4: what the PWA and the APK scaffold promise. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchManifest } from '../tools/android-setup.js';
import { precacheSource } from '../tools/build-precache.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

test('precache.js is current and lists files that exist', () => {
  const stored = fs.readFileSync(path.join(WWW, 'precache.js'), 'utf8');
  assert.equal(stored.replaceAll('\r\n', '\n'), precacheSource(), 'run npm run build:pwa');
  const files = [...stored.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  for (const f of files) assert.ok(fs.existsSync(path.join(WWW, f)), f);
  for (const need of ['index.html', 'js/app.js', 'js/pages/commands.js', 'data/commands.js', 'manifest.webmanifest', 'icons/icon-192.png']) {
    assert.ok(files.includes(need), need);
  }
  assert.ok(files.some((f) => f.endsWith('.woff2')));
});

test('web manifest: icons exist, a maskable one is there, standalone, Hungarian', () => {
  const m = json('www/manifest.webmanifest');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'hu');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(WWW, i.src)), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  assert.doesNotMatch(fs.readFileSync(path.join(WWW, 'icons/icon.svg'), 'utf8'), /<text|<image|href/);
});

test('the service worker leaves other origins and non-GET requests alone', () => {
  const sw = fs.readFileSync(path.join(WWW, 'sw.js'), 'utf8');
  assert.match(sw, /req\.method !== 'GET'/);
  assert.match(sw, /origin !== self\.location\.origin/);
});

test('capacitor config points at www and keeps the app id of this project', () => {
  const c = json('capacitor.config.json');
  assert.equal(c.webDir, 'www');
  assert.equal(c.appId, 'work.webagoly.varlerconsole');
  assert.equal(c.server.androidScheme, 'https');
});

test('android manifest patch: no cloud backup, network rule, microphone only; runs twice the same', () => {
  const before = '<manifest>\n    <application\n        android:allowBackup="true"\n        android:label="x">\n    </application>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
  const once = patchManifest(before);
  assert.match(once, /android:allowBackup="false"/);
  assert.doesNotMatch(once, /android:allowBackup="true"/);
  assert.match(once, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(once, /RECORD_AUDIO/);
  assert.doesNotMatch(once, /LOCATION|READ_CONTACTS/);
  assert.equal(patchManifest(once), once);
});
