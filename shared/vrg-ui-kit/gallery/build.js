#!/usr/bin/env node
/* VRG UI Kit — gallery/build.js — assemble gallery.html from gallery/shell.html + gallery/NN-*.html fragments.
   node gallery/build.js                       → ../gallery.html (links to the kit's files: open it from file://)
   node gallery/build.js --only 03 --out F     → a test page with the foundation + fragment 03 only
   node gallery/build.js --inline --out F      → one self-contained file (fonts, CSS, JS inlined) = the published Artifact
   CSS/JS order: tokens → fonts → base, button, mini → manifest order → any component not yet in the
   manifest (alphabetical). JS has no load-time coupling, so order only matters for core/focus/actions first. */
'use strict';
const fs = require('fs');
const path = require('path');
const G = __dirname, KIT = path.join(G, '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = opt('--only'), outArg = opt('--out'), inline = args.includes('--inline');

const man = fs.existsSync(path.join(KIT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(KIT, 'manifest.json'), 'utf8')) : { components: [] };
const compFiles = fs.readdirSync(path.join(KIT, 'components'));
const orderedCss = [], orderedJs = [];
const pushU = (arr, f) => { if (!arr.includes(f)) arr.push(f); };
['components/base.css', 'components/button.css', 'components/mini.css'].forEach(f => pushU(orderedCss, f));
['components/core.js', 'components/focus.js', 'actions.js', 'components/mini.js'].forEach(f => pushU(orderedJs, f));
man.components.forEach(c => (c.files || []).forEach(f => pushU(f.endsWith('.css') ? orderedCss : orderedJs, f)));
compFiles.sort().forEach(f => pushU(f.endsWith('.css') ? orderedCss : f.endsWith('.js') ? orderedJs : [], 'components/' + f));

const tokens = ['fonts/fonts.css', 'tokens/base.css', 'tokens/theme-dark.css', 'tokens/theme-light.css', 'tokens/theme-contrast.css', 'tokens/theme-melyviz.css', 'tokens/density.css'];
const outFile = outArg ? path.resolve(outArg) : path.join(KIT, 'gallery.html');
const relFromOut = (f) => path.relative(path.dirname(outFile), path.join(KIT, f)).split(path.sep).join('/');

const frags = fs.readdirSync(G).filter(f => /^\d\d-.*\.html$/.test(f)).sort()
  .filter(f => !only || f.startsWith(only.padStart(2, '0')) || f.startsWith('00-'));

let sections = '', inits = '', toc = '', foundation = '';
frags.forEach(f => {
  let src = fs.readFileSync(path.join(G, f), 'utf8');
  const scripts = [];
  src = src.replace(/<script\b[^>]*data-g-init[^>]*>([\s\S]*?)<\/script>/gi, (m, code) => { scripts.push(code); return ''; });
  const id = (src.match(/<section[^>]*\bid="([^"]+)"/) || [])[1];
  const title = (src.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
  const num = f.slice(0, 2);
  if (num === '00') foundation += src;
  else {
    sections += '\n<!-- ===== ' + f + ' ===== -->\n' + src;
    if (id && title) toc += '<li><a href="#' + id + '"><span class="vk-num">' + num + '</span> ' + title.replace(/<[^>]+>/g, '') + '</a></li>';
  }
  scripts.forEach(code => {
    inits += '<script>\n/* ' + f + ' */\n(function(){try{\n' + code + '\n}catch(e){console.error("[gallery ' + f + ']",e);}})();\n</script>\n';
  });
});

const css = ['gallery/gallery.css'].concat([]);
let html = fs.readFileSync(path.join(G, 'shell.html'), 'utf8');
const cssTags = tokens.concat(orderedCss).concat(['gallery/gallery.css']).filter(f => fs.existsSync(path.join(KIT, f)))
  .map(f => '<link rel="stylesheet" href="' + relFromOut(f) + '">').join('\n');
const jsTags = ['icons/sprite.js'].concat(orderedJs).concat(['gallery/gallery.js']).filter(f => fs.existsSync(path.join(KIT, f)))
  .map(f => '<script src="' + relFromOut(f) + '"></script>').join('\n');
// function replacements: fragment code may contain $' / $& which a string replacement would expand
const put = { '<!--@CSS@-->': cssTags, '<!--@JS@-->': jsTags, '<!--@TOC@-->': toc, '<!--@FOUNDATION@-->': foundation, '<!--@SECTIONS@-->': sections, '<!--@INIT@-->': inits };
Object.keys(put).forEach(k => { html = html.replace(k, () => put[k]); });

if (inline) {
  const tmp = outFile + '.tmp.html';
  fs.writeFileSync(tmp, html);
  const { inlinePage } = require(path.join(KIT, 'inline.js'));
  html = inlinePage(tmp, {});
  fs.unlinkSync(tmp);
}
fs.writeFileSync(outFile, html);
console.error('gallery → ' + path.relative(process.cwd(), outFile) + ' (' + frags.length + ' fragments, ' + Math.round(html.length / 1024) + ' kB' + (inline ? ', inlined' : '') + ')');
