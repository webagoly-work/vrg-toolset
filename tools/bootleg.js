#!/usr/bin/env node
// bootleg.js — wraps a self-contained HTML page into one self-extracting .cmd file, so it can be sent or downloaded
// as a single file and opened on any Windows PC with nothing installed.
//
//   node tools/bootleg.js <page.html> [out.cmd]
//
// Default output: <Full>\_handoff\<page name>.cmd (the hand-off folder next to the repo). The .cmd carries the page as
// base64 between certificate markers; when run it decodes its own body with Windows' built-in certutil (no PowerShell:
// Avast blocks freshly started PowerShell scripts), writes <page name>.html next to itself (or to the path given as its
// first argument) and opens it in the default browser. A second argument "/n" skips opening.
// The batch part is ASCII with CRLF line endings (cmd.exe mis-parses LF blocks; see CLAUDE.md).
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');

function bootleg(html, name) {
  const b64 = Buffer.from(html).toString('base64'), lines = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  const bat = [
    '@echo off',
    'setlocal',
    'rem ' + name + '.cmd - self-extracting page (made by tools/bootleg.js in the VRG toolset).',
    'rem Running it writes ' + name + '.html next to this file and opens it. Nothing is installed.',
    'set "OUT=%~dp0' + name + '.html"',
    'if not "%~1"=="" set "OUT=%~f1"',
    'echo Kicsomagolas: "%OUT%"',
    'certutil -f -decode "%~f0" "%OUT%" >nul 2>&1',
    'if errorlevel 1 goto fail',
    'if not exist "%OUT%" goto fail',
    'echo Kesz. A fajl: "%OUT%"',
    'if /i "%~2"=="/n" goto done',
    'start "" "%OUT%"',
    ':done',
    'endlocal',
    'exit /b 0',
    ':fail',
    'echo HIBA: nem sikerult kicsomagolni. Masold a .cmd fajlt egy irhato mappaba, es futtasd ujra.',
    'pause',
    'endlocal',
    'exit /b 1',
    '',
    '-----BEGIN CERTIFICATE-----',
    ...lines,
    '-----END CERTIFICATE-----',
    '',
  ];
  return bat.join('\r\n');
}

if (require.main === module) {
  const [src, outArg] = process.argv.slice(2);
  if (!src) { console.log('Hasznalat: node tools/bootleg.js <oldal.html> [kimenet.cmd]'); process.exit(1); }
  const html = fs.readFileSync(src);
  const name = path.basename(src).replace(/\.html?$/i, '').replace(/[^A-Za-z0-9._-]/g, '_');
  const out = outArg || path.join(path.dirname(REPO), '_handoff', name + '.cmd');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const text = bootleg(html, name);
  if (/[^\x00-\x7f]/.test(text)) { console.log('Hiba: a .cmd nem ASCII.'); process.exit(1); }
  fs.writeFileSync(out, text);
  console.log('Kesz: ' + out + ' (' + (fs.statSync(out).size / 1048576).toFixed(1) + ' MB). Futtatva kicsomagolja es megnyitja a ' + name + '.html-t.');
}
module.exports = { bootleg };
