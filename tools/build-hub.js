#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-hub.js — VRG Kapu source -> one self-contained file.
//
//   Hub/src/index.html   with three markers:
//     <!--@css-->   every Hub/src/css/*.css, in name order, as one <style>
//     <!--@data-->  access list / public key as JSON blocks (a file that does not
//                   exist yet is embedded as null), plus kpTools: the TOOL REGISTRY
//                   of Planner/START.cmd, so the page lists exactly what the menu has
//     <!--@js-->    every Hub/src/js/*.js, in name order, one shared scope
//   -> Hub/dist/vrg-kapu.html
//
// KP_BUILD is the first 12 hex of a sha256 over the page as built, so the
// footer says exactly which build is open.
//
//   node tools/build-hub.js [--onedrive <OneDrive VRG-Megosztott\00_START folder>]
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const HUB = path.join(REPO, 'Hub');
const SRC = path.join(HUB, 'src');
const OUT = path.join(HUB, 'dist', 'vrg-kapu.html');

const START = path.join(REPO, 'Planner', 'START.cmd');
const DATA = [
  ['kpAccess', path.join(HUB, 'data', 'access.json')],
  ['kpPubkey', path.join(SRC, 'access-pubkey.json')]
];

function fail(msg) { console.error('build-hub: ' + msg); process.exit(1); }

// START.cmd's T<n>_NAME / T<n>_PATH pairs up to TOOLCOUNT -> [{ n, key, name, path, dir }].
// There the paths are relative to the Planner folder; here relative to the repo, forward slashes.
function startTools() {
  if (!fs.existsSync(START)) fail('Planner/START.cmd missing');
  const cmd = fs.readFileSync(START, 'utf8');
  const val = name => { const m = cmd.match(new RegExp('^set "' + name + '=(.*)"\\s*$', 'm')); return m ? m[1] : null; };
  const count = Number(val('TOOLCOUNT'));
  if (!count) fail('START.cmd: no TOOLCOUNT');
  const key = n => (n < 10 ? String(n) : n === 10 ? '0' : n === 11 ? 'K' : '?');
  const tools = [];
  for (let n = 1; n <= count; n++) {
    const name = val('T' + n + '_NAME'), rel = val('T' + n + '_PATH');
    if (!name || !rel) fail('START.cmd: T' + n + '_NAME / T' + n + '_PATH missing');
    const p = path.relative(REPO, path.resolve(REPO, 'Planner', rel.replace(/\\/g, '/'))).split(path.sep).join('/');
    tools.push({ n, key: key(n), name, path: p, dir: p.split('/').slice(0, -1).join('/') || '.' });
  }
  return tools;
}

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
  });
  const tools = startTools();
  data.push('<script type="application/json" id="kpTools">' + safeJson(tools) + '</script>');

  const style = '<style>\n' + css.map(f => '/* ' + f.name + ' */\n' + f.text).join('\n') + '</style>';
  const script = '<script>\n"use strict";\nconst KP_BUILD = "@@KP_BUILD@@";\n' +
    js.map(f => '// ---- ' + f.name + '\n' + f.text).join('\n') + '</script>';

  // function replacers: a "$" in the sources must stay literal
  html = html.replace('<!--@css-->', () => style)
    .replace('<!--@data-->', () => data.join('\n'))
    .replace('<!--@js-->', () => script);

  const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);
  html = html.replace('@@KP_BUILD@@', hash);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log('built ' + path.relative(REPO, OUT) + ' — ' + kb + ' kB, ' + css.length + ' css, ' +
    js.length + ' js, data: ' + DATA.map(([id, f]) => id + (fs.existsSync(f) ? '' : '=null')).join(' ') +
    ', kpTools: ' + tools.length + ' — KP_BUILD ' + hash);
  return hash;
}

// the OneDrive 00_START note: what the file is, the two modes, how to start the full one, who to ask
function readme(hash) {
  let owner = null;
  try { owner = JSON.parse(fs.readFileSync(DATA[0][1], 'utf8')).body.people.find(p => p.role === 'owner'); } catch (e) { /* no list yet */ }
  const ask = owner ? owner.name + ' (GitHub: `' + owner.github + '`)' : 'a tulajdonos';
  return [
    '# VRG Kapu — olvass el',
    '',
    'Ez a `vrg-kapu.html` a VRG eszköztár belépőlapja: a GitHub-fiókoddal azonosít, és ha szerepelsz az',
    'engedélyezett listán, innen indul a START.cmd és minden eszköze. (Később ide jön a közös irányítópult.)',
    '',
    '*This `vrg-kapu.html` is the access page of the VRG toolset: it identifies you by your GitHub account and,',
    'if you are on the allowed list, hands you over to START.cmd and every tool in it. (The shared dashboard comes here later.)*',
    '',
    '## Két mód',
    '',
    '**Csak linkek mód** — dupla kattintás erre a fájlra. A belépés és az eszközlinkek működnek, de a belépés',
    'nem marad meg, és a gépen lévő programokat, mappákat nem tudja megnyitni.',
    '',
    '*Links-only mode — double-click this file. Signing in and the tool links work, but the sign-in is not kept',
    'and it cannot start programs or open folders on this computer.*',
    '',
    '**Teljes mód** — a saját repó-másolatodban indítsd a `Hub\\VRG Kapu.cmd`-t. Ez elindítja a Kapu segédet',
    '(csak ezen a gépen, localhost:8795), és így működik minden: a START.cmd indítása, az eszközök és a',
    'mappáik megnyitása.',
    '',
    '*Full mode — run `Hub\\VRG Kapu.cmd` in your own clone of the repo. It starts the Kapu helper (on this',
    'computer only, localhost:8795) and everything works: starting START.cmd, opening the tools and their folders.*',
    '',
    '## A teljes mód elindítása',
    '',
    '1. Fogadd el a GitHub-meghívót, és klónozd a `vrg-toolset` repót (GitHub Desktop).',
    '2. Telepítsd a Node-ot (vagy használd a cwebuser kitet a `20_Telepitok` mappából).',
    '3. Indítsd a klónban a `Hub\\VRG Kapu.cmd`-t.',
    '4. Belépés → a saját GitHub tokened. A token csak a te böngésződben marad; soha ne küldd el senkinek.',
    '',
    '*1. Accept the GitHub invite and clone the `vrg-toolset` repo (GitHub Desktop). 2. Install Node (or',
    'use the cwebuser kit from `20_Telepitok`). 3. Run `Hub\\VRG Kapu.cmd` in the clone. 4. Belépés →',
    'your own GitHub token. The token stays in your browser only; never send it to anyone.*',
    '',
    'Részletesen / in detail: `docs/hub/KOLLEGA-INDULAS.md` a repóban.',
    '',
    '## Kérdés esetén / Questions',
    '',
    ask,
    '',
    '---',
    'Build ' + hash + ' · ' + new Date().toISOString().slice(0, 10) + ' · generated by `tools/build-hub.js --onedrive`',
    ''
  ].join('\n');
}

// --onedrive <folder>: the 00_START folder itself; it must exist, its path is never guessed
function copyOnedrive(dir, hash) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail('--onedrive: no such folder: ' + dir);
  const dest = path.join(dir, 'vrg-kapu.html');
  fs.copyFileSync(OUT, dest);
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  if (sha(dest) !== sha(OUT)) fail('--onedrive: the copy differs from ' + path.relative(REPO, OUT));
  fs.writeFileSync(path.join(dir, 'OLVASS_EL.md'), readme(hash));
  console.log('copied to ' + dest + ' (sha256 ' + sha(dest).slice(0, 12) + ', identical) + OLVASS_EL.md');
}

const hash = build();
const od = process.argv.indexOf('--onedrive');
if (od > 0) {
  if (!process.argv[od + 1]) fail('--onedrive needs the 00_START folder path');
  copyOnedrive(path.resolve(process.argv[od + 1]), hash);
}
