#!/usr/bin/env node
// Browser/build.js — the VRG Böngésző's modular source → one self-contained file, dist/vrg-bongeszo.html, that runs from
// the VRG Asztal (vrg-app://browser/), VRG Mobile (M21, fetched from main) and any browser. No dependencies, no network.
//
//   src/index.html            the template; its UI Kit region is kept by shared/vrg-ui-kit/inline.js --sync-app
//   src/app.css               → <!--@css-->
//   VB_DATA                   → <!--@data-->: config/engines.json (+ Dashboard/config/search.json's engines),
//                               config/quicklinks.json, the PC's servers from launcher/vrg-menu.json, the parts index
//                               from Inventory/data/vrg-inventory.json (no prices)
//   src/core/*.js, src/vendor/qr.js, src/app/*.js   → <!--@js-->, in ORDER
//
//   node Browser/build.js           write dist/vrg-bongeszo.html
//   node Browser/build.js --check   exit 1 when dist/ is not what the sources build (the tests run it)
// The output is deterministic: the build id is a hash of the inputs, not a clock.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'dist', 'vrg-bongeszo.html');
const VERSION = '1.0.0';
const ORDER = ['core/engine.js', 'core/url.js', 'core/answers.js', 'core/links.js', 'core/research.js', 'core/store.js', 'core/sync.js', 'core/host.js', 'vendor/qr.js',
  'app/ui.js', 'app/context.js', 'app/omnibox.js', 'app/views.js', 'app/work.js', 'app/knowledge.js', 'app/main.js'];
const OWN_SERVER = 'bongeszo';

const read = p => fs.readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));

function data() {
  const cfg = json(path.join(ROOT, 'config', 'engines.json'));
  const engines = cfg.engines.slice();
  try {
    for (const e of json(path.join(REPO, 'Dashboard', 'config', 'search.json'))) {
      if (!e || !e.id || !e.url || engines.some(x => x.id === e.id)) continue;
      engines.push({ id: e.id, hu: e.hu || e.id, group: 'web', bangs: [], url: String(e.url) });
    }
  } catch (e) { /* the Desktop's list is optional */ }
  const seen = new Map();
  for (const e of engines) for (const b of e.bangs || []) {
    if (seen.has(b)) throw new Error('build: the bang !' + b + ' is used by ' + seen.get(b) + ' and ' + e.id);
    seen.set(b, e.id);
  }
  const menu = json(path.join(REPO, 'launcher', 'vrg-menu.json'));
  // a server is "user" when a finished User-level catalog item runs on it (the catalog says what exists); the rest are dev
  const cat = json(path.join(REPO, 'launcher', 'vrg-catalog.json'));
  const userSrv = new Set();
  for (const it of cat.items || []) {
    if (it.level !== 'user' || !['live', 'beta'].includes(it.status)) continue;
    for (const s of it.servers || []) userSrv.add(s);
    if (it.launch && it.launch.server) userSrv.add(it.launch.server);
  }
  const list = (menu.servers || []).filter(s => s.id !== OWN_SERVER && s.port);
  const first = s => String(s.name).split(' · ')[0];
  const servers = list.map(s => {
    const [name, ...rest] = String(s.name).split(' · ');
    const twin = list.filter(x => first(x) === name).length > 1;           // three "VRG Kapu"s: keep what tells them apart
    return { id: s.id, key: s.key, name: twin && rest.length ? name + ' · ' + rest[0] : name, hint: rest.join(' · '), port: s.port, level: userSrv.has(s.id) ? 'user' : 'dev' };
  });
  const quicklinks = json(path.join(ROOT, 'config', 'quicklinks.json')).links;
  return { version: VERSION, engines, groups: cfg.groups, quicklinks, servers, parts: parts() };
}

// T4: the Inventory's catalogue (Inventory/data/vrg-inventory.json, committed product data) as a parts index: what a part is
// and where its datasheet and product pages are. Never a price (the negotiated prices stay in the Inventory).
const webOrEmpty = u => (typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 2000 ? u : '');
function parts() {
  let inv;
  try { inv = json(path.join(REPO, 'Inventory', 'data', 'vrg-inventory.json')); } catch (e) { return []; }
  return (inv.items || []).filter(i => i && /^VRG-\d{4}$/.test(i.vrg_id)).map(i => {
    const vendors = Object.entries(i.vendors || {}).map(([v, x]) => ({ v, pn: String((x && x.cikkszam) || '').slice(0, 60), url: webOrEmpty(x && x.termek_link) })).filter(x => x.url);
    const cat = i.kategoria_javaslat || i.kategoria || {};
    return { id: i.vrg_id, name: String(i.megnevezes || '').slice(0, 200), brand: String(i.marka_gyarto || '').slice(0, 60),
      pn: String(i.gyartoi_cikkszam || '').slice(0, 60), gtin: String(i.gtin || '').slice(0, 20), cat: [cat.fo, cat.al].filter(Boolean).join(' / ').slice(0, 120),
      sheet: webOrEmpty(i.gyartoi_termek_link), vendors };
  });
}

function qrModule(src) {
  const body = src.replace(/^export\s*\{[^}]*\};?\s*$/m, '');
  return '(function (root) {\n' + body + '\n(root.VB = root.VB || {}).qr = { qrEncode, qrSvg, qrBytes, QRCAP, QRECC };\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
}

function build() {
  const tpl = read(path.join(ROOT, 'src', 'index.html'));
  for (const mark of ['<!--@css-->', '<!--@data-->', '<!--@js-->']) if (!tpl.includes(mark)) throw new Error('build: src/index.html lacks ' + mark);
  const css = read(path.join(ROOT, 'src', 'app.css'));
  const js = ORDER.map(f => {
    let s = read(path.join(ROOT, 'src', f));
    if (f === 'vendor/qr.js') s = qrModule(s);
    return '/* ---- src/' + f + ' */\n' + s.replace(/<\/script/gi, '<\\/script');
  }).join('\n');
  const d = data();
  const id = crypto.createHash('sha256').update(tpl + css + js + JSON.stringify(d)).digest('hex').slice(0, 10);
  d.built = id;
  const dataJs = 'window.VB_DATA = ' + JSON.stringify(d).replace(/</g, '\\u003c') + ';';
  return tpl
    .replace('<!--@css-->', () => '<style data-vb-app>\n' + css + '</style>')
    .replace('<!--@data-->', () => '<script>' + dataJs + '</script>')
    .replace('<!--@js-->', () => '<script>\n' + js + '</script>');
}

module.exports = { build, data, ORDER, OUT };

if (require.main === module) {
  const out = build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? read(OUT) : '';
    if (cur !== out) { console.log('DRIFT  Browser/dist/vrg-bongeszo.html — run: node Browser/build.js'); process.exit(1); }
    console.log('ok     Browser/dist/vrg-bongeszo.html');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, out);
    console.log('wrote  Browser/dist/vrg-bongeszo.html  (' + Math.round(out.length / 1024) + ' kB)');
  }
}
