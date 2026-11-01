/* Contrast floors in both themes, and that tokens.css is what the tokens say. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokens } from '../tools/build-tokens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const tokens = json('design/tokens.json');
const sunlight = json('design/sunlight.json');
const hud = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]));
const sun = { ...hud, ...sunlight.tokens };

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['fg', 'muted', 'cyan', 'alert', 'ok'];
const pairs = (theme) => ['ground', 'panel'].flatMap((bg) => TEXT.map((fg) => [fg, bg, contrast(theme[fg], theme[bg])]));

test('text on slate is at least 4.5:1, HUD theme', () => {
  assert.deepEqual(pairs(hud).filter((p) => p[2] < 4.5), []);
});

test('text on slate is at least 4.5:1, sunlight theme', () => {
  assert.deepEqual(pairs(sun).filter((p) => p[2] < 4.5), []);
});

test('text on charcoal chrome is at least 4.5:1 in both themes', () => {
  const chrome = ['charcoal', 'charcoal-800', 'charcoal-900', 'charcoal-950'];
  const low = chrome.flatMap((bg) => ['fg', 'cyan', 'alert'].map((fg) => [fg, bg, contrast(hud[fg], hud[bg])])).filter((p) => p[2] < 4.5);
  assert.deepEqual(low, []);
});

test('sunlight control borders reach 3:1', () => {
  assert.ok(contrast(sun.line, sun.ground) >= 3);
  assert.ok(contrast(sun.line, sun.panel) >= 3);
});

test('the design system colours are unchanged', () => {
  assert.equal(hud.charcoal, '#33363A');
  assert.equal(hud.ground, '#121B22');
  assert.equal(hud.cyan, '#7ED3DF');
});

test('tokens.css is up to date', () => {
  const css = fs.readFileSync(path.join(ROOT, 'www/css/tokens.css'), 'utf8');
  assert.equal(css, buildTokens(tokens, sunlight), 'run: npm run tokens');
});

test('no network resources in the shell', () => {
  const html = fs.readFileSync(path.join(ROOT, 'www/index.html'), 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
});
