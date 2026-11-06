#!/usr/bin/env node
/* VRG UI Kit — test/lint.js
   1. No literal colours in components/, actions.js, gallery fragments (tokens/ is where colours live).
   2. Every var(--vk-*) used is defined in tokens/ (or is a component-local --vk-<component>-* /
      a declared custom property in the same file).
   3. manifest.json `tokens` lists match what each component's files actually read (warning only).
   node test/lint.js                 → lint everything, exit 1 on errors
   node test/lint.js --tokens FILE…  → print the --vk-* tokens FILE reads (for a manifest entry) */
'use strict';
const fs = require('fs');
const path = require('path');
const KIT = path.join(__dirname, '..');
const rel = (p) => path.relative(KIT, p).split(path.sep).join('/');

const NAMED = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'cyan', 'magenta',
  'lime', 'navy', 'teal', 'olive', 'maroon', 'silver', 'gold', 'aqua', 'fuchsia', 'brown', 'beige', 'ivory', 'coral', 'salmon', 'tomato',
  'crimson', 'indigo', 'violet', 'orchid', 'plum', 'tan', 'khaki', 'lavender', 'turquoise', 'chocolate', 'firebrick', 'darkgray', 'lightgray',
  'whitesmoke', 'gainsboro', 'snow', 'linen', 'wheat', 'skyblue', 'steelblue', 'slategray', 'dimgray'];
const NAMED_RE = new RegExp('(?:^|[\\s:,(])(' + NAMED.join('|') + ')(?=[\\s;,)!]|$)', 'i');

function tokenDefs() {
  const defs = new Set();
  fs.readdirSync(path.join(KIT, 'tokens')).filter(f => f.endsWith('.css')).forEach(f => {
    fs.readFileSync(path.join(KIT, 'tokens', f), 'utf8').replace(/(--vk-[\w-]+)\s*:/g, (m, n) => { defs.add(n); return m; });
  });
  return defs;
}

function strip(src, isJs) {
  // drop comments and data: URIs (mask images may carry 'black'), keep line numbers
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  if (isJs) s = s.replace(/(^|[^:"'\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
  s = s.replace(/data:[^"')\s]+/g, m => ' '.repeat(m.length));
  s = s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  return s;
}

function literalColours(file) {
  const isJs = file.endsWith('.js'), isHtml = file.endsWith('.html');
  const src = strip(fs.readFileSync(file, 'utf8'), isJs);
  const out = [];
  src.split('\n').forEach((line, i) => {
    let hit = null;
    const hex = line.match(/(?:^|[^\w&#-])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b(?![\w-])/i);
    if (hex && !/href=["']#|url\(#|getElementById|querySelector|['"]#[\w-]+['"]/.test(line.slice(Math.max(0, hex.index - 20), hex.index + 12))) hit = '#' + hex[1];
    const fn = line.match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/i);
    if (fn) hit = fn[0];
    if (!isHtml || /style|fill|stroke|color|background/i.test(line)) {
      // named colours only in CSS-ish contexts
      const cssish = isJs ? /(color|fill|stroke|background|border|shadow)['"]?\s*[:=,]\s*['"][^'"]*$/i : /:/;
      const nm = line.match(NAMED_RE);
      if (nm && (!isJs || cssish.test(line.slice(0, nm.index + 1)))) {
        const ctx = line.slice(Math.max(0, nm.index - 30), nm.index);
        if (/(color|fill|stroke|background|border|shadow|outline)[\w-]*\s*[:=]\s*['"]?\s*$/i.test(ctx) || /(color|fill|stroke|background|border|shadow|outline)[\w-]*\s*:[^;]*$/i.test(ctx)) hit = nm[1];
      }
    }
    if (hit) out.push({ line: i + 1, hit, text: line.trim().slice(0, 120) });
  });
  return out;
}

function usedTokens(file) {
  const src = fs.readFileSync(file, 'utf8'); const used = new Set();
  src.replace(/var\(\s*(--vk-[\w-]+)/g, (m, n) => { used.add(n); return m; });
  src.replace(/['"](--vk-[\w-]+)['"]/g, (m, n) => { used.add(n); return m; });
  return used;
}
function localDefs(file) {
  const src = fs.readFileSync(file, 'utf8'); const d = new Set();
  src.replace(/(--vk-[\w-]+)\s*:/g, (m, n) => { d.add(n); return m; });
  src.replace(/setProperty\(\s*['"](--vk-[\w-]+)/g, (m, n) => { d.add(n); return m; });
  return d;
}

function files() {
  const list = [];
  const add = (dir, re) => { const p = path.join(KIT, dir); if (fs.existsSync(p)) fs.readdirSync(p).filter(f => re.test(f)).forEach(f => list.push(path.join(p, f))); };
  add('components', /\.(css|js)$/); add('gallery', /\.(html|css)$/);
  list.push(path.join(KIT, 'actions.js'));
  return list;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--tokens') {
    const all = new Set(); args.slice(1).forEach(f => usedTokens(path.resolve(f)).forEach(t => all.add(t)));
    console.log(JSON.stringify([...all].sort()));
    return;
  }
  const defs = tokenDefs();
  let errors = 0, warnings = 0;
  files().forEach(f => {
    literalColours(f).forEach(h => { errors++; console.log('✗ literal colour ' + rel(f) + ':' + h.line + '  ' + h.hit + '   ' + h.text); });
    const local = localDefs(f);
    usedTokens(f).forEach(t => {
      if (!defs.has(t) && !local.has(t) && !/^--vk-p$/.test(t)) {
        // component-local tokens --vk-<component>-* defined in another file of the same component are fine
        const comp = path.basename(f).replace(/\.(css|js|html)$/, '');
        const sib = ['css', 'js'].map(e => path.join(KIT, 'components', comp + '.' + e)).filter(fs.existsSync);
        if (sib.some(s => localDefs(s).has(t))) return;
        errors++; console.log('✗ unknown token ' + t + ' in ' + rel(f));
      }
    });
  });
  // manifest token lists
  const manPath = path.join(KIT, 'manifest.json');
  if (fs.existsSync(manPath)) {
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    man.components.forEach(c => {
      const used = new Set(); (c.files || []).forEach(f => { const p = path.join(KIT, f); if (fs.existsSync(p)) usedTokens(p).forEach(t => { if (defs.has(t)) used.add(t); }); });
      const listed = new Set(c.tokens || []);
      const missing = [...used].filter(t => !listed.has(t));
      if (missing.length) { warnings++; console.log('! manifest ' + c.name + ' does not list ' + missing.length + ' token(s): ' + missing.slice(0, 6).join(' ') + (missing.length > 6 ? ' …' : '')); }
    });
  }
  // 4. VRG Mobile's generated KitTokens.kt still says what the tokens say (WP M16); skipped where the app is not beside the kit
  const kotlinTokens = path.join(KIT, 'tools', 'kotlin-tokens.js');
  if (fs.existsSync(path.join(KIT, '..', '..', 'Mobile', 'android', 'kit'))) {
    const r = require('child_process').spawnSync(process.execPath, [kotlinTokens, '--check'], { encoding: 'utf8' });
    if (r.status !== 0) { errors++; console.log('✗ ' + (r.stdout || r.stderr || 'kotlin-tokens --check failed').trim()); }
  }
  console.log((errors ? '✗ ' : '✓ ') + errors + ' error(s), ' + warnings + ' warning(s)');
  process.exit(errors ? 1 : 0);
}
main();
