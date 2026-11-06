#!/usr/bin/env node
/* VRG UI Kit — tools/kotlin-tokens.js (WP M16, decision 2A: one source)
   Reads tokens/base.css, the four theme files and density.css, and writes VRG Mobile's
     Mobile/android/kit/src/main/kotlin/hu/vrg/mobile/kit/theme/KitTokens.kt
   one `Palette` per kit theme (the app's existing data class) plus the sizes of the `touch` density.
   Colours with alpha (rgba(), color-mix(… transparent)) are composited in sRGB over the theme's own --vk-bg,
   so Kotlin sees plain opaque colours. kit-core's KitTokens.kt does the same maths and its test checks this
   file against the real tokens.
     node shared/vrg-ui-kit/tools/kotlin-tokens.js           → write the file
     node shared/vrg-ui-kit/tools/kotlin-tokens.js --check   → exit 1 when the file differs from what the tokens give
     node shared/vrg-ui-kit/tools/kotlin-tokens.js --print   → write it to stdout */
'use strict';
const fs = require('fs');
const path = require('path');

const KIT = path.join(__dirname, '..');
const REPO = path.join(KIT, '..', '..');
const OUT = path.join(REPO, 'Mobile', 'android', 'kit', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'kit', 'theme', 'KitTokens.kt');

/** Kit theme file → the phone palette: id (Look.PALETTES), name (Hungarian UI), Kotlin constant. */
const THEMES = [
  { file: 'theme-dark.css', id: 'kit-ej', name: 'Éj', konst: 'EJ' },
  { file: 'theme-light.css', id: 'kit-papir', name: 'Papír', konst: 'PAPIR' },
  { file: 'theme-contrast.css', id: 'kit-kontraszt', name: 'Kontraszt', konst: 'KONTRASZT' },
  { file: 'theme-melyviz.css', id: 'kit-melyviz', name: 'Mélyvíz (kit)', konst: 'MELYVIZ' },
];

/** Palette field → kit token (docs/mobile/WP/M16.md). Anything translucent is resolved over --vk-bg. */
const FIELDS = [
  ['abyss', '--vk-bg-sunken'], ['deep', '--vk-bg'], ['surface', '--vk-surface-1'], ['raised', '--vk-surface-2'],
  ['line', '--vk-line-strong'], ['lineSoft', '--vk-line'],
  ['ink', '--vk-text'], ['muted', '--vk-text-muted'], ['faint', '--vk-text-faint'],
  ['glow', '--vk-accent'], ['glowDim', '--vk-accent-line'], ['current', '--vk-info'],
  ['sand', '--vk-warn'], ['coral', '--vk-crit'], ['kelp', '--vk-ok'],
  ['onGlow', '--vk-text-on-accent'], ['shallows', '--vk-bg'],
  ['activity', '--vk-activity'],
];

/** The touch density's sizes (tokens/density.css over base.css): Kotlin name → token, unit. */
const SIZES = [
  ['targetMin', '--vk-target-min', 'dp'], ['controlH', '--vk-control-h', 'dp'], ['rowH', '--vk-row-h', 'dp'],
  ['iconSize', '--vk-icon-size', 'dp'], ['iconStroke', '--vk-icon-stroke', 'f'],
  ['padPanel', '--vk-pad-panel', 'dp'], ['gutter', '--vk-gutter', 'dp'], ['focusW', '--vk-focus-w', 'dp'],
  ['space1', '--vk-space-1', 'dp'], ['space2', '--vk-space-2', 'dp'], ['space3', '--vk-space-3', 'dp'],
  ['space4', '--vk-space-4', 'dp'], ['space5', '--vk-space-5', 'dp'], ['space6', '--vk-space-6', 'dp'], ['space7', '--vk-space-7', 'dp'],
  ['fs2xs', '--vk-fs-2xs', 'sp'], ['fsXs', '--vk-fs-xs', 'sp'], ['fsSm', '--vk-fs-sm', 'sp'], ['fsMd', '--vk-fs-md', 'sp'],
  ['fsLg', '--vk-fs-lg', 'sp'], ['fsXl', '--vk-fs-xl', 'sp'], ['fs2xl', '--vk-fs-2xl', 'sp'], ['fs3xl', '--vk-fs-3xl', 'sp'],
];

const read = (f) => fs.readFileSync(path.join(KIT, 'tokens', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first block whose selector matches `sel` (a RegExp). */
function block(css, sel) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!sel.test(m[1].trim())) continue;
    const vars = {};
    m[2].replace(/(--vk-[\w-]+)\s*:\s*([^;]+);/g, (x, n, v) => { vars[n] = v.trim(); return x; });
    return vars;
  }
  throw new Error('no block ' + sel);
}

const BASE = block(read('base.css'), /^:root$/);

function expand(v, vars, depth) {
  if (depth > 20) throw new Error('var() loop at ' + v);
  return v.replace(/var\(\s*(--vk-[\w-]+)\s*\)/g, (m, n) => {
    if (!(n in vars)) throw new Error('unknown token ' + n);
    return expand(vars[n], vars, depth + 1);
  });
}

/** A colour as {r,g,b,a} (0…255, a 0…1). Knows #rgb, #rrggbb, rgb(a)(), transparent and color-mix(in srgb, C P%, transparent). */
function colour(v) {
  v = v.trim();
  let m;
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if ((m = /^#([0-9a-f]{3})$/i.exec(v))) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  if ((m = /^#([0-9a-f]{6})$/i.exec(v))) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  if ((m = /^color-mix\(\s*in srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i.exec(v))) {
    const c = colour(m[1]);
    return { r: c.r, g: c.g, b: c.b, a: c.a * (+m[2] / 100) };
  }
  throw new Error('cannot read colour ' + v);
}

/** Source-over in sRGB, rounded to the nearest 8-bit value. */
function over(c, bg) {
  const ch = (x, y) => Math.round(x * c.a + y * (1 - c.a));
  return { r: ch(c.r, bg.r), g: ch(c.g, bg.g), b: ch(c.b, bg.b), a: 1 };
}

const hex = (c) => '0xFF' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

function px(v) {
  const m = /^(-?[\d.]+)(px)?$/.exec(v.trim());
  if (!m) throw new Error('not a length: ' + v);
  return +m[1];
}

function theme(t) {
  const css = read(t.file);
  const own = block(css, /data-vk-theme/);
  const vars = Object.assign({}, BASE, own);
  const scheme = /color-scheme:\s*(light|dark)/.exec(css.slice(css.indexOf('{')));
  const bg = colour(expand(vars['--vk-bg'], vars, 0));
  const cols = FIELDS.map(([f, tok]) => {
    const c = colour(expand(vars[tok], vars, 0));
    return [f, c.a < 1 ? over(c, bg) : c];
  });
  return {
    t, light: scheme ? scheme[1] === 'light' : false, cols,
    radius: px(expand(vars['--vk-radius-lg'], vars, 0)), radiusSmall: px(expand(vars['--vk-radius'], vars, 0)),
  };
}

function generate() {
  const L = [];
  L.push('// GENERATED by shared/vrg-ui-kit/tools/kotlin-tokens.js from the VRG UI Kit tokens (tokens/base.css,');
  L.push('// theme-dark/light/contrast/melyviz.css, density.css). Do not edit by hand: change the tokens, then run');
  L.push('// `node shared/vrg-ui-kit/tools/kotlin-tokens.js`. `--check` (mobile.cmd test, the kit\'s test/lint.js) fails on drift.');
  L.push('// Translucent tokens are composited over the theme\'s --vk-bg. kit-core KitTokensTest checks these values against the tokens.');
  L.push('package hu.vrg.mobile.kit.theme');
  L.push('');
  L.push('import androidx.compose.ui.graphics.Color');
  L.push('import androidx.compose.ui.unit.dp');
  L.push('import androidx.compose.ui.unit.sp');
  L.push('');
  L.push('/** The four VRG UI Kit themes as phone palettes (WP M16). They come after the app\'s own six in [Palettes.ALL]. */');
  L.push('object KitTokens {');
  THEMES.map(theme).forEach((p, i) => {
    if (i) L.push('');
    L.push('    val ' + p.t.konst + ' = Palette(');
    L.push('        "' + p.t.id + '", "' + p.t.name + '", ' + p.light + ',');
    const cols = p.cols.map(([f, c]) => f + ' = Color(' + hex(c) + ')');
    for (let k = 0; k < cols.length; k += 4) L.push('        ' + cols.slice(k, k + 4).join(', ') + ',');
    L.push('        radius = ' + p.radius + '.dp, radiusSmall = ' + p.radiusSmall + '.dp, kitFaces = true,');
    L.push('    )');
  });
  L.push('');
  L.push('    val ALL = listOf(' + THEMES.map(t => t.konst).join(', ') + ')');
  L.push('}');
  L.push('');
  const touch = Object.assign({}, BASE, block(read('density.css'), /data-vk-density="touch"/));
  L.push('/** The kit\'s `touch` density (40 dp targets, 15 sp body): the sizes a phone part such as the MINI is drawn with. */');
  L.push('object KitSize {');
  SIZES.forEach(([n, tok, unit]) => {
    const v = px(expand(touch[tok], touch, 0));
    L.push('    val ' + n + ' = ' + String(v) + (unit === 'f' ? 'f' : '.' + unit));
  });
  L.push('}');
  L.push('');
  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const text = generate();
  if (args.includes('--print')) { process.stdout.write(text); return; }
  if (args.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== text) {
      console.log('x KitTokens.kt differs from the kit tokens. Run: node shared/vrg-ui-kit/tools/kotlin-tokens.js');
      process.exit(1);
    }
    console.log('ok KitTokens.kt matches the kit tokens (' + THEMES.length + ' palettes, ' + SIZES.length + ' sizes)');
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log('ok wrote ' + path.relative(REPO, OUT));
}

module.exports = { generate, colour, over, THEMES, FIELDS };
if (require.main === module) main();
