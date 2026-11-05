#!/usr/bin/env node
/* VRG UI Kit — tokens/melyviz-map.js — generates tokens/theme-melyviz.css from shared/melyviz.css.
   shared/melyviz.css (--mv-*) is the source; this file is the mapping onto kit tokens. Values Mélyvíz does not
   define (surface-3, info, heat scale, terminal tones…) are kit-owned and written as they are here.
   Called by tools/melyviz-sync.js (write / --check); also runnable alone:
     node shared/vrg-ui-kit/tokens/melyviz-map.js          write tokens/theme-melyviz.css
     node shared/vrg-ui-kit/tokens/melyviz-map.js --check  exit 1 if the file differs from what the source gives */
'use strict';
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', '..', 'melyviz.css');
const TARGET = path.join(__dirname, 'theme-melyviz.css');

function readMv(css) {
  const root = (css.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
  const mv = {};
  root.replace(/(--mv-[\w-]+)\s*:\s*([^;]+);/g, (m, k, v) => { mv[k] = v.trim(); return m; });
  return mv;
}

/** the generated stylesheet for a given melyviz.css text */
function render(css) {
  const mv = readMv(css);
  const v = (k) => { if (!(k in mv)) throw new Error('shared/melyviz.css has no ' + k); return mv[k]; };
  // fonts: Mélyvíz's own stack first, then the kit's vendored face as the offline fallback
  const withKit = (stack, kit) => stack.replace(/,\s*(ui-monospace|monospace|sans-serif|system-ui)/, ', "' + kit + '", $1');
  return `/* VRG UI Kit — theme "Mélyvíz", the VRG dev-side style mapped onto kit tokens.
   GENERATED from shared/melyviz.css by tokens/melyviz-map.js (run: node tools/melyviz-sync.js). Do not edit by hand:
   change melyviz.css (the source) or the mapping in melyviz-map.js, then sync. --check fails on drift.
   M1 ice = instrument / you, warm = activity · M5 smoked glass, 1 px hairlines, square controls, two cut
   corners, no drop shadows · M6 mono readouts, condensed titles. */
:root[data-vk-theme="melyviz"], [data-vk-theme="melyviz"] {
  color-scheme: dark;
  --vk-bg: ${v('--mv-bg')};
  --vk-bg-sunken: #071017;
  --vk-surface-1: ${v('--mv-panel-solid')};
  --vk-surface-2: ${v('--mv-raised')};
  --vk-surface-3: #1d2a34;
  --vk-overlay: ${v('--mv-panel')};
  --vk-scrim: rgba(4, 9, 13, .6);
  --vk-line: ${v('--mv-line')};
  --vk-line-strong: ${v('--mv-line-strong')};
  --vk-border-control: #6c7880;
  --vk-text: ${v('--mv-text')};
  --vk-text-muted: ${v('--mv-dim')};
  --vk-text-faint: ${v('--mv-faint')};
  --vk-text-on-accent: #071318;
  --vk-text-on-solid: ${v('--mv-bg')};
  --vk-accent: ${v('--mv-accent')};
  --vk-accent-hover: #b9e3f0;
  --vk-activity: ${v('--mv-warm')};
  --vk-focus: ${v('--mv-accent')};
  --vk-ok: ${v('--mv-ok')};
  --vk-warn: ${v('--mv-warn')};
  --vk-crit: ${v('--mv-crit')};
  --vk-info: #9db8e8;
  --vk-idea: #b4a7e6;             /* MindMap THEMES.melyviz.violet */
  --vk-heat-0: ${v('--mv-raised')}; --vk-heat-1: #3a2e25; --vk-heat-2: #6a4a30; --vk-heat-3: #a87048; --vk-heat-4: ${v('--mv-warm')};
  --vk-term-bg: #071017;
  --vk-term-text: #d8e4ec;
  --vk-term-ok: ${v('--mv-ok')}; --vk-term-warn: ${v('--mv-warn')}; --vk-term-crit: ${v('--mv-crit')}; --vk-term-info: #9db8e8; --vk-term-muted: ${v('--mv-dim')};
  --vk-shadow-1: none;
  --vk-shadow-overlay: none;      /* M5: no drop shadows — glass + hairline carry the layer */
  --vk-glow: 0 0 ${v('--mv-glow')} ${v('--mv-accent-glow')};
  --vk-blur: ${v('--mv-blur')};
  --vk-radius-sm: 0; --vk-radius: 0; --vk-radius-lg: 0;   /* M5: square controls (dots excepted) */
  --vk-cut: ${v('--mv-cut')};
  --vk-font-voice: ${withKit(v('--mv-voice'), 'VK Barlow Condensed')};
  --vk-font-mono: ${withKit(v('--mv-mono'), 'VK JetBrains Mono')};
  --vk-font-sans: ${withKit(v('--mv-sans'), 'VK Inter')};
}
`;
}

/** 'ok' | 'drift' | 'written' */
function sync(mode) {
  const want = render(fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n'));
  const have = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
  if (have === want) return 'ok';
  if (mode === 'check') return 'drift';
  fs.writeFileSync(TARGET, want);
  return 'written';
}

module.exports = { render, sync, TARGET };
if (require.main === module) {
  const r = sync(process.argv.includes('--check') ? 'check' : 'write');
  console.log(r + '  shared/vrg-ui-kit/tokens/theme-melyviz.css');
  if (r === 'drift') process.exit(1);
}
