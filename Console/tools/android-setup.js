#!/usr/bin/env node
/* Run after `cap add android`; safe to run again. Brings in the network rule and the launcher icons, and sets
   the manifest: no cloud backup of client records (L1), and the microphone only for the sound meter. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIPMAPS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const PERMISSIONS = ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'];
const APPLICATION = { 'android:allowBackup': 'false', 'android:networkSecurityConfig': '@xml/network_security_config' };

export function patchManifest(xml) {
  let out = xml.replace(/<application\b[^>]*>/, (tag) => {
    let next = tag;
    for (const [name, value] of Object.entries(APPLICATION)) {
      const attr = `${name}="${value}"`;
      const had = new RegExp(`${name}="[^"]*"`);
      next = had.test(next) ? next.replace(had, attr) : next.replace('<application', `<application\n        ${attr}`);
    }
    return next;
  });
  for (const p of PERMISSIONS) {
    const line = `<uses-permission android:name="${p}" />`;
    if (!out.includes(line)) out = out.replace('</manifest>', `    ${line}\n</manifest>`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = path.join(ROOT, 'android/app/src/main/res');
  const manifest = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(manifest)) {
    console.error('No android/ yet: run npx cap add android first.');
    process.exit(1);
  }
  fs.writeFileSync(manifest, patchManifest(fs.readFileSync(manifest, 'utf8')));
  fs.cpSync(path.join(ROOT, 'android-res/xml'), path.join(res, 'xml'), { recursive: true });
  for (const m of MIPMAPS) {
    const icon = path.join(ROOT, `android-res/mipmap-${m}/ic_launcher.png`);
    fs.copyFileSync(icon, path.join(res, `mipmap-${m}/ic_launcher.png`));
    fs.copyFileSync(icon, path.join(res, `mipmap-${m}/ic_launcher_round.png`));
  }
  fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
  console.log('android/ set up');
}
