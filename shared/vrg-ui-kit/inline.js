#!/usr/bin/env node
/* VRG UI Kit — inline.js — build one inlined <style>/<script> bundle from a list of component names.
   No dependencies (Node ≥ 18). Reads manifest.json, resolves dependencies, orders them, inlines.

   node inline.js table palette                       → bundle to stdout (tokens + base + deps + sprite + scripts)
   node inline.js table palette --out bundle.html     → write the snippet to a file
   node inline.js table palette --insert app.html     → replace the region between
                                                         <!-- vk:begin --> and <!-- vk:end --> in app.html
   node inline.js --all --page gallery.html --out g.html   → inline every local <link>/<script src>/font url of a
                                                         page into one self-contained file (the published gallery)
   options:
     --themes dark,light,contrast,melyviz   which theme files (default: all four; dark is always in base)
     --density / --no-density               include tokens/density.css (default on)
     --fonts                                inline the vendored fonts as data: URIs (adds ~100 kB)
     --icons a,b,c | --icons all | --icons used   sprite subset (default 'used': icons named by the chosen
                                            components' manifest entries + any `#vk-i-NAME` found in the files)
     --no-sprite                            leave the sprite out
     --list                                 print the resolved component order and sizes, nothing else
     --check                                validate manifest (files exist, deps known, no cycles); exit 1 on error
     --sync                                 regenerate icons/icons.json + icons/sprite.js from icons/sprite.svg
*/
'use strict';
const fs = require('fs');
const path = require('path');

const KIT = __dirname;
const rd = (p) => fs.readFileSync(path.join(KIT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(KIT, p));

function parseArgs(argv) {
  const o = { names: [], themes: null, density: true, fonts: false, icons: 'used', sprite: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--out') o.out = val();
    else if (a === '--insert') o.insert = val();
    else if (a === '--page') o.page = val();
    else if (a === '--themes') o.themes = val().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--density') o.density = true;
    else if (a === '--no-density') o.density = false;
    else if (a === '--fonts') o.fonts = true;
    else if (a === '--icons') o.icons = val();
    else if (a === '--no-sprite') o.sprite = false;
    else if (a === '--list') o.list = true;
    else if (a === '--check') o.check = true;
    else if (a === '--sync') o.sync = true;
    else if (a === '--all') o.all = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--')) throw new Error('unknown option ' + a);
    else o.names.push(a);
  }
  return o;
}

function manifest() { return JSON.parse(rd('manifest.json')); }

/** dependency closure in a stable topological order (deps first, then manifest order) */
function resolve(names, man) {
  const byName = Object.fromEntries(man.components.map(c => [c.name, c]));
  const order = [], state = {};
  function visit(n, trail) {
    if (!byName[n]) throw new Error('unknown component "' + n + '"' + (trail.length ? ' (needed by ' + trail[trail.length - 1] + ')' : ''));
    if (state[n] === 2) return;
    if (state[n] === 1) throw new Error('dependency cycle: ' + trail.concat(n).join(' → '));
    state[n] = 1;
    (byName[n].deps || []).forEach(d => visit(d, trail.concat(n)));
    state[n] = 2; order.push(byName[n]);
  }
  names.forEach(n => visit(n, []));
  return order;
}

function check(man) {
  const errs = [];
  const names = new Set();
  man.components.forEach(c => {
    if (names.has(c.name)) errs.push('duplicate component ' + c.name);
    names.add(c.name);
    (c.files || []).forEach(f => { if (!exists(f)) errs.push(c.name + ': missing file ' + f); });
    (c.deps || []).forEach(d => { if (!man.components.some(x => x.name === d)) errs.push(c.name + ': unknown dep ' + d); });
    (c.families || []).forEach(f => { if (!(f >= 1 && f <= 10)) errs.push(c.name + ': bad family ' + f); });
  });
  try { resolve(man.components.map(c => c.name), man); } catch (e) { errs.push(e.message); }
  const icons = iconNames();
  man.components.forEach(c => (c.icons || []).forEach(i => { if (!icons.has(i)) errs.push(c.name + ': unknown icon ' + i); }));
  return errs;
}

// ---------- icons ----------
function spriteSymbols() {
  const svg = rd('icons/sprite.svg');
  const out = {};
  svg.replace(/<symbol id="vk-i-([\w-]+)"[\s\S]*?<\/symbol>/g, (m, id) => { out[id] = m; return m; });
  return out;
}
function iconNames() { return new Set(Object.keys(spriteSymbols())); }
function spriteFor(names) {
  const sym = spriteSymbols();
  const pick = names === 'all' ? Object.keys(sym) : names.filter(n => sym[n]);
  return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true" data-vk-sprite>' +
    '<defs><style>.f{fill:currentColor;stroke:none}</style></defs>' + pick.map(n => sym[n]).join('') + '</svg>';
}
function sync() {
  const sym = spriteSymbols();
  const json = {};
  Object.keys(sym).sort().forEach(n => { json[n] = '<svg class="vk-icon" aria-hidden="true"><use href="#vk-i-' + n + '"/></svg>'; });
  fs.writeFileSync(path.join(KIT, 'icons/icons.json'), JSON.stringify(json, null, 1) + '\n');
  const js = '/* VRG UI Kit — icons/sprite.js — GENERATED by `node inline.js --sync` from icons/sprite.svg; do not edit.\n' +
    '   Injects the icon sprite into <body> so <use href="#vk-i-NAME"> works, also from file:// (Chrome refuses\n' +
    '   external sprite references there). Classic script; safe to include twice. */\n' +
    '(function(){var S=' + JSON.stringify(spriteFor('all')) + ';\n' +
    'function go(){if(document.querySelector("svg[data-vk-sprite]"))return;var d=document.createElement("div");d.innerHTML=S;document.body.insertBefore(d.firstChild,document.body.firstChild);}\n' +
    'if(document.body)go();else document.addEventListener("DOMContentLoaded",go);})();\n';
  fs.writeFileSync(path.join(KIT, 'icons/sprite.js'), js);
  return Object.keys(sym).length;
}

// ---------- fonts ----------
function fontsCss(inline) {
  let css = rd('fonts/fonts.css');
  if (!inline) return css;
  return css.replace(/url\("([^"]+\.woff2)"\)/g, (m, f) =>
    'url("data:font/woff2;base64,' + fs.readFileSync(path.join(KIT, 'fonts', f)).toString('base64') + '")');
}

// ---------- bundle ----------
function bundle(o) {
  const man = manifest();
  const names = o.all ? man.components.map(c => c.name) : o.names;
  const comps = resolve(names, man);
  const themes = o.themes || ['dark', 'light', 'contrast', 'melyviz'];
  const css = [], js = [], usedIcons = new Set();
  css.push('/* vrg-ui-kit ' + man.version + ' — ' + comps.map(c => c.name).join(', ') + ' */');
  if (o.fonts) css.push(fontsCss(true));
  css.push(rd('tokens/base.css'));
  themes.forEach(t => { if (exists('tokens/theme-' + t + '.css')) css.push(rd('tokens/theme-' + t + '.css')); else throw new Error('no theme ' + t); });
  if (o.density) css.push(rd('tokens/density.css'));
  comps.forEach(c => {
    (c.icons || []).forEach(i => usedIcons.add(i));
    (c.files || []).forEach(f => {
      const src = rd(f);
      src.replace(/vk-i-([a-z0-9-]+)/g, (m, n) => { usedIcons.add(n); return m; });
      if (f.endsWith('.css')) css.push('/* ' + f + ' */\n' + src);
      else if (f.endsWith('.js')) js.push('/* ' + f + ' */\n' + src);
    });
  });
  let icons = o.icons === 'all' ? 'all' : o.icons === 'used' ? [...usedIcons] : o.icons.split(',').map(s => s.trim());
  const sprite = o.sprite ? spriteFor(icons) : '';
  const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
  return {
    comps, html:
      '<style data-vk-kit>\n' + safe(css.join('\n')) + '\n</style>\n' +
      (sprite ? sprite + '\n' : '') +
      (js.length ? '<script data-vk-kit>\n' + safe(js.join('\n;\n')) + '\n</script>\n' : '')
  };
}

/** inline a page: <link rel=stylesheet href=local>, <script src=local>, fonts.css urls, sprite.js → sprite */
function inlinePage(file, o) {
  const dir = path.dirname(path.resolve(file));
  let html = fs.readFileSync(file, 'utf8');
  const local = (href) => !/^(https?:|data:|\/\/)/i.test(href);
  const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
    if (!href || !local(href)) return tag;
    const p = path.join(dir, href);
    let css = fs.readFileSync(p, 'utf8');
    css = css.replace(/url\(["']?([^"')]+\.woff2)["']?\)/g, (m, f) =>
      'url("data:font/woff2;base64,' + fs.readFileSync(path.join(path.dirname(p), f)).toString('base64') + '")');
    return '<style data-src="' + href + '">\n' + safe(css) + '\n</style>';
  });
  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, a, src, b) => {
    if (!local(src)) return tag;
    const code = fs.readFileSync(path.join(dir, src), 'utf8');
    return '<script data-src="' + src + '"' + (a + b).replace(/\s+$/, '') + '>\n' + safe(code) + '\n</script>';
  });
  return html;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0] + '*/\n'); return; }
  if (o.sync) { const n = sync(); console.error('icons: ' + n + ' symbols → icons/icons.json, icons/sprite.js'); if (!o.names.length && !o.page && !o.check) return; }
  if (o.check) {
    const errs = check(manifest());
    if (errs.length) { errs.forEach(e => console.error('✗ ' + e)); process.exit(1); }
    console.error('✓ manifest ok (' + manifest().components.length + ' components)'); if (!o.names.length && !o.page) return;
  }
  if (o.page) {
    const out = inlinePage(o.page, o);
    if (o.out) { fs.writeFileSync(o.out, out); console.error('page → ' + o.out + ' (' + Math.round(out.length / 1024) + ' kB)'); }
    else process.stdout.write(out);
    return;
  }
  if (!o.names.length && !o.all) { console.error('name at least one component (or --all); --help for usage'); process.exit(2); }
  const b = bundle(o);
  if (o.list) { b.comps.forEach(c => console.log(c.name.padEnd(18) + (c.files || []).join(' '))); return; }
  if (o.insert) {
    const src = fs.readFileSync(o.insert, 'utf8');
    const re = /(<!--\s*vk:begin\s*-->)[\s\S]*?(<!--\s*vk:end\s*-->)/;
    if (!re.test(src)) { console.error('no <!-- vk:begin --> … <!-- vk:end --> markers in ' + o.insert); process.exit(1); }
    fs.writeFileSync(o.insert, src.replace(re, (m, a, z) => a + '\n' + b.html + z));
    console.error('inserted ' + b.comps.length + ' components into ' + o.insert);
    return;
  }
  if (o.out) { fs.writeFileSync(o.out, b.html); console.error(b.comps.length + ' components → ' + o.out + ' (' + Math.round(b.html.length / 1024) + ' kB)'); }
  else process.stdout.write(b.html);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('inline.js: ' + e.message); process.exit(1); }
}
module.exports = { resolve, bundle, inlinePage, check, spriteFor, sync };
