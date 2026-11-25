#!/usr/bin/env node
// build-artifact.js — one self-contained page for publishing (a claude.ai artifact, the Archive, a USB kit):
// the part of vrg-kocka.html between the artifact:start / artifact:end markers, with lib/chunk.js inlined and one
// chunk embedded as JSON. The local page (served by Map/serve.js) keeps loading both by relative URL.
//
//   node Map/kocka/tools/build-artifact.js [chunk-id]        -> Map/kocka/dist/vrg-kocka-<chunk-id>.html
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const id = process.argv[2] || 'start-ujlak';
const page = fs.readFileSync(path.join(ROOT, 'vrg-kocka.html'), 'utf8');
const a = page.indexOf('<!-- artifact:start'), b = page.indexOf('<!-- artifact:end -->');
if (a < 0 || b < 0) throw new Error('artifact markers missing in vrg-kocka.html');
let body = page.slice(page.indexOf('-->', a) + 3, b).replace(/^<\/head>\s*$/m, '').replace(/^<body>\s*$/m, '');
const lib = fs.readFileSync(path.join(ROOT, 'lib', 'chunk.js'), 'utf8');
const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, 'chunks', id + '.json'), 'utf8'));
const json = JSON.stringify(chunk).replace(/</g, '\\u003c');
const tag = '<script src="lib/chunk.js"></script>';
if (!body.includes(tag)) throw new Error('lib/chunk.js script tag missing');
body = body.replace(tag, () => `<script id="vrg-kocka-chunk" type="application/json">${json}</script>\n<script>\n${lib}\n</script>`);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', `vrg-kocka-${id}.html`);
fs.writeFileSync(out, body.trim() + '\n');
console.log(path.relative(process.cwd(), out), Math.round(fs.statSync(out).size / 1024) + ' KB');
