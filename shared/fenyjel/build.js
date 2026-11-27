#!/usr/bin/env node
/* Fényjel — build.js: board.html as one self-contained file (fonts as data: URIs, the CSS and icons.js inlined),
   for publishing or for opening on a machine without the repo.
     node shared/fenyjel/build.js --out <file>      (default: shared/fenyjel/dist/fenyjel-board.html) */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const args = process.argv.slice(2);
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(DIR, 'dist', 'fenyjel-board.html');

/** A stylesheet with every url(...) turned into a data: URI, resolved from the stylesheet's own folder. */
function inlineCss(file) {
  const base = path.dirname(file);
  return fs.readFileSync(file, 'utf8').replace(/url\("([^"]+\.woff2)"\)/g, (m, rel) =>
    'url("data:font/woff2;base64,' + fs.readFileSync(path.join(base, rel)).toString('base64') + '")');
}

let html = fs.readFileSync(path.join(DIR, 'board.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => '<style>\n' + inlineCss(path.join(DIR, href)) + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>\n' + fs.readFileSync(path.join(DIR, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
if (/<link rel="stylesheet"|<script src=/.test(html)) throw new Error('fenyjel build: an external file is left');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('fenyjel board -> ' + path.relative(process.cwd(), out) + ' (' + Math.round(html.length / 1024) + ' kB)');
