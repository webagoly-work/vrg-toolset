#!/usr/bin/env node
/* VRG UI Kit — tools/android-fonts.js
   The kit's OFL fonts for VRG Mobile (WP M16). Android's res/font takes TTF, not woff2, and wants one file per
   face, so each face's two subsets (latin + latin-ext, see fonts/fonts.css) are decompressed and merged into one
   TTF, and the licence files are copied beside the APK's assets:
     fonts/<Face>-latin.woff2 + fonts/<Face>-latin-ext.woff2 → Mobile/android/kit/src/main/res/font/<face>.ttf
     fonts/LICENSE-*.txt                                     → Mobile/android/kit/src/main/assets/licenses/
   The woff2 subsets carry only the basic tables (no GPOS / kern), so nothing is lost in the merge.

   Needs fonteditor-core (MIT, woff2 via its wasm), which the repo does not vendor; it is only for this one-off:
     npm install --no-save --prefix <somewhere> fonteditor-core@2.4.1
     node shared/vrg-ui-kit/tools/android-fonts.js --lib <somewhere>/node_modules/fonteditor-core
   Rerun it only when the kit's fonts change. */
'use strict';
const fs = require('fs');
const path = require('path');

const KIT = path.join(__dirname, '..');
const REPO = path.join(KIT, '..', '..');
const OUT_FONT = path.join(REPO, 'Mobile', 'android', 'kit', 'src', 'main', 'res', 'font');
const OUT_LIC = path.join(REPO, 'Mobile', 'android', 'kit', 'src', 'main', 'assets', 'licenses');

const FACES = [
  { src: 'Inter-Regular', out: 'vk_inter_regular' },
  { src: 'Inter-SemiBold', out: 'vk_inter_semibold' },
  { src: 'BarlowCondensed-SemiBold', out: 'vk_barlow_condensed_semibold' },
  { src: 'JetBrainsMono-Regular', out: 'vk_jetbrains_mono_regular' },
];
const LICENCES = ['LICENSE-Inter.txt', 'LICENSE-BarlowCondensed.txt', 'LICENSE-JetBrainsMono.txt'];

async function main() {
  const i = process.argv.indexOf('--lib');
  const lib = i > 0 ? path.resolve(process.argv[i + 1]) : 'fonteditor-core';
  const { Font, woff2 } = require(lib);
  await woff2.init();
  const read = (f) => Font.create(fs.readFileSync(path.join(KIT, 'fonts', f)), { type: 'woff2', compound2simple: true, hinting: false });

  fs.mkdirSync(OUT_FONT, { recursive: true });
  fs.mkdirSync(OUT_LIC, { recursive: true });
  for (const face of FACES) {
    const base = read(face.src + '-latin.woff2');
    const ext = read(face.src + '-latin-ext.woff2').get();
    const o = base.get();
    const have = new Set();
    o.glyf.forEach(g => (g.unicode || []).forEach(u => have.add(u)));
    let added = 0;
    ext.glyf.forEach((g, n) => {
      if (n === 0) return;                                     // .notdef
      const u = (g.unicode || []).filter(c => !have.has(c));
      if (!u.length) return;
      u.forEach(c => have.add(c));
      o.glyf.push(Object.assign({}, g, { unicode: u }));
      added++;
    });
    base.set(o);
    const buf = Buffer.from(base.write({ type: 'ttf', hinting: false }));
    // the Hungarian double-acute letters must be there (ő ű Ő Ű)
    for (const c of [0x0151, 0x0171, 0x0150, 0x0170]) if (!have.has(c)) throw new Error(face.src + ' lacks U+' + c.toString(16));
    fs.writeFileSync(path.join(OUT_FONT, face.out + '.ttf'), buf);
    console.log('ok  ' + face.out + '.ttf  ' + o.glyf.length + ' glyphs (+' + added + ' latin-ext)  ' + buf.length + ' B');
  }
  for (const l of LICENCES) fs.copyFileSync(path.join(KIT, 'fonts', l), path.join(OUT_LIC, l));
  console.log('ok  ' + LICENCES.length + ' licence files → ' + path.relative(REPO, OUT_LIC));
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
