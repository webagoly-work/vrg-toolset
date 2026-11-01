/* Fails on a key missing from either language, on a key used in code but not defined,
   and on user-facing text written straight into the source. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaries, t, setLang, LANGS } from '../www/js/core/i18n.js';
import { formatNumber, formatUnit, formatDate } from '../www/js/core/format.js';
import { CATALOG, CATEGORIES, PERMISSIONS } from '../www/js/pages/catalog.js';
import { DENSITIES } from '../www/js/core/store.js';

const WWW = path.join(path.dirname(fileURLToPath(import.meta.url)), '../www');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}
const sources = walk(WWW).filter((f) => /\.(js|html)$/.test(f));
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(WWW, f).replaceAll('\\', '/');

export function missingKeys(dicts) {
  const out = [];
  const all = new Set(LANGS.flatMap((l) => Object.keys(dicts[l])));
  for (const key of all) {
    for (const l of LANGS) {
      const v = dicts[l][key];
      if (typeof v !== 'string' || !v.trim()) out.push(`${l}: ${key}`);
    }
  }
  return out;
}

function placeholderGaps(dicts) {
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  return Object.keys(dicts.hu).filter((k) => vars(dicts.hu[k]) !== vars(dicts.en[k] ?? ''));
}

function usedKeys(source) {
  const keys = new Set();
  for (const m of source.matchAll(/\bt\('([\w.]+)'/g)) keys.add(m[1]);
  for (const m of source.matchAll(/data-i18n(?:-aria|-title)?="([\w.]+)"/g)) keys.add(m[1]);
  // t('perm.' + p) is a prefix; 'keys built at runtime' below checks those
  return [...keys].filter((k) => !k.endsWith('.'));
}

/* Literals with a letter in them, in the places that reach the screen. */
export function hardCoded(source, file) {
  const hits = [];
  const patterns = [
    /\.textContent\s*=\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /\.title\s*=\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /\.placeholder\s*=\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /\btext:\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /(?:'aria-label'|title|placeholder):\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /setAttribute\('(?:aria-label|title|placeholder)',\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
    /toast\(\s*['"`]([^'"`]*[\p{L}][^'"`]*)['"`]/gu,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      // `[${n}] ` is only a value, not text
      if (/\p{L}/u.test(m[1].replace(/\$\{[^}]*\}/g, ''))) hits.push(`${file}: ${m[0]}`);
    }
  }
  if (file.endsWith('.html')) {
    const body = source.slice(source.indexOf('<body'));
    for (const m of body.matchAll(/>([^<>]*\p{L}[^<>]*)</gu)) {
      if (m[1].trim()) hits.push(`${file}: text "${m[1].trim()}"`);
    }
    for (const m of body.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]+)"/g)) hits.push(`${file}: attr "${m[1]}"`);
  }
  return hits;
}

test('every key exists in both languages', () => {
  assert.deepEqual(missingKeys(dictionaries()), []);
});

test('the check really fails on a missing key', () => {
  const d = { hu: { a: 'x', b: 'y' }, en: { a: 'x' } };
  assert.deepEqual(missingKeys(d), ['en: b']);
  assert.deepEqual(missingKeys({ hu: { a: 'x' }, en: { a: '  ' } }), ['en: a']);
});

test('placeholders match between languages', () => {
  assert.deepEqual(placeholderGaps(dictionaries()), []);
});

test('every key used in the source is defined', () => {
  const dict = dictionaries().hu;
  const gaps = [];
  for (const f of sources) for (const key of usedKeys(read(f))) if (!(key in dict)) gaps.push(`${rel(f)}: ${key}`);
  assert.deepEqual(gaps, []);
});

test('keys built at runtime are defined', () => {
  const dict = dictionaries().hu;
  const built = [
    ...CATEGORIES.map((c) => 'category.' + c),
    ...PERMISSIONS.map((p) => 'perm.' + p),
    ...['inherit', ...DENSITIES].map((d) => 'density.' + d),
    ...LANGS.map((l) => 'settings.lang.' + l),
  ];
  assert.deepEqual(built.filter((k) => !(k in dict)), []);
});

test('no hard-coded user-facing strings', () => {
  assert.deepEqual(sources.flatMap((f) => hardCoded(read(f), rel(f))), []);
});

test('the check really finds hard-coded strings', () => {
  assert.equal(hardCoded(`x.textContent = 'Mentés';`, 'a.js').length, 1);
  assert.equal(hardCoded(`h('b', { text: 'Save' })`, 'a.js').length, 1);
  assert.equal(hardCoded(`<body><button>Save</button></body>`, 'a.html').length, 1);
  assert.equal(hardCoded(`<body><button aria-label="Save"></button></body>`, 'a.html').length, 1);
  assert.equal(hardCoded(`x.textContent = t('a.b');`, 'a.js').length, 0);
  assert.equal(hardCoded('x.textContent = `[${n}] `;', 'a.js').length, 0);
  assert.equal(hardCoded('x.textContent = `Hiba: ${n}`;', 'a.js').length, 1);
});

test('Hungarian is the default and t() fills placeholders', () => {
  assert.equal(t('nav.home'), 'Kezdőlap');
  assert.equal(t('library.moved', { name: 'A', pos: 2 }), 'A, új hely: 2.');
});

test('numbers and dates follow the locale, units stay', () => {
  const date = new Date(2026, 10, 1);
  setLang('hu');
  assert.equal(formatNumber(1.5, 1), '1,5');
  assert.equal(formatUnit(0.38, 'Ω', 2), '0,38 Ω');
  assert.match(formatDate(date), /^2026\. ?11\. ?01\.$/);
  setLang('en');
  assert.equal(formatNumber(1.5, 1), '1.5');
  assert.equal(formatUnit(0.38, 'Ω', 2), '0.38 Ω');
  assert.equal(formatDate(date), '01/11/2026');
  setLang('hu');
});

test('every manifest is complete', () => {
  assert.equal(new Set(CATALOG.map((p) => p.id)).size, CATALOG.length);
  for (const p of CATALOG) {
    assert.ok(p.name.hu && p.name.en, p.id);
    assert.ok(CATEGORIES.includes(p.category), p.id);
    assert.equal(typeof p.offline, 'boolean', p.id);
    assert.ok(p.permissions.every((x) => PERMISSIONS.includes(x)), p.id);
  }
});

test('names stay clear of landmines L4 and L10', () => {
  const banned = /daniella|rehoboam|delos|westworld|stilo|delux|skybox/i;
  for (const l of LANGS) {
    const hits = Object.entries(dictionaries()[l]).filter(([, v]) => banned.test(v));
    assert.deepEqual(hits, []);
  }
});
