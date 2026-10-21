#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-hub.js — VRG Kapu source -> one self-contained file.
//
//   Hub/src/index.html   with three markers:
//     <!--@css-->   every Hub/src/css/*.css, in name order, as one <style>
//     <!--@data-->  topology / access list / public key as JSON blocks
//                   (a file that does not exist yet is embedded as null)
//     <!--@js-->    every Hub/src/js/*.js, in name order, one shared scope
//   -> Hub/dist/vrg-kapu.html
//
// KP_BUILD is the first 12 hex of a sha256 over the page as built, so the
// footer says exactly which build is open.
//
//   node tools/build-hub.js
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const HUB = path.join(REPO, 'Hub');
const SRC = path.join(HUB, 'src');
const OUT = path.join(HUB, 'dist', 'vrg-kapu.html');

const DATA = [
  ['kpTopology', path.join(HUB, 'data', 'topology.json')],
  ['kpAccess', path.join(HUB, 'data', 'access.json')],
  ['kpPubkey', path.join(SRC, 'access-pubkey.json')]
];

function fail(msg) { console.error('build-hub: ' + msg); process.exit(1); }

function readDir(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort()
    .map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

// JSON inside <script> must not be able to close the tag.
const safeJson = v => JSON.stringify(v).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

function build() {
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  for (const m of ['<!--@css-->', '<!--@data-->', '<!--@js-->']) {
    if (!html.includes(m)) fail('index.html is missing ' + m);
  }

  const css = readDir(path.join(SRC, 'css'), '.css');
  const js = readDir(path.join(SRC, 'js'), '.js');
  for (const f of js) if (/<\/script/i.test(f.text)) fail('js/' + f.name + ' contains </script');

  const data = DATA.map(([id, file]) => {
    let v = null;
    if (fs.existsSync(file)) {
      try { v = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (e) { fail(path.relative(REPO, file) + ': ' + e.message); }
    }
    return '<script type="application/json" id="' + id + '">' + safeJson(v) + '</script>';
  }).join('\n');

  const style = '<style>\n' + css.map(f => '/* ' + f.name + ' */\n' + f.text).join('\n') + '</style>';
  const script = '<script>\n"use strict";\nconst KP_BUILD = "@@KP_BUILD@@";\n' +
    js.map(f => '// ---- ' + f.name + '\n' + f.text).join('\n') + '</script>';

  // function replacers: a "$" in the sources must stay literal
  html = html.replace('<!--@css-->', () => style)
    .replace('<!--@data-->', () => data)
    .replace('<!--@js-->', () => script);

  const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);
  html = html.replace('@@KP_BUILD@@', hash);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log('built ' + path.relative(REPO, OUT) + ' — ' + kb + ' kB, ' + css.length + ' css, ' +
    js.length + ' js, data: ' + DATA.map(([id, f]) => id + (fs.existsSync(f) ? '' : '=null')).join(' ') +
    ' — KP_BUILD ' + hash);
}

build();
