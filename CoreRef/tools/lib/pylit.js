'use strict';
// Parse the top-level literal assignments out of Home Assistant's hassfest-generated
// files (homeassistant/generated/*.py). They are Black-formatted: double-quoted keys,
// trailing commas, True/False/None, and an optional `: Final[...]` annotation.
// Approach: find each `NAME<ann>? = [ or {`, balance-scan the literal (string aware),
// then normalise it to JSON. No eval, no Python needed.

const BACKSLASH = '\\';

function scanLiteral(text, start) {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let quote = '';
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === BACKSLASH) { i++; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '[' || c === '{') { depth++; continue; }
    if (c === ']' || c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new Error('unbalanced literal at offset ' + start + ' (expected ' + close + ')');
}

function toJson(src) {
  let out = '';
  let inStr = false;
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === BACKSLASH) { out += c + src[i + 1]; i++; continue; }
      if (c === quote) { inStr = false; out += '"'; continue; }
      if (c === '"') { out += BACKSLASH + '"'; continue; }
      out += c;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; out += '"'; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === ',') {
      // drop a trailing comma: the next non-space character closes a container
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '}' || src[j] === ']') continue;
      out += c;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let word = '';
      let j = i;
      while (j < src.length && /[A-Za-z_0-9]/.test(src[j])) word += src[j++];
      if (word === 'True') out += 'true';
      else if (word === 'False') out += 'false';
      else if (word === 'None') out += 'null';
      else throw new Error('unexpected bare word in literal: ' + word);
      i = j - 1;
      continue;
    }
    out += c;
  }
  return out;
}

// Returns { NAME: value, ... } for every top-level list/dict assignment.
function parseGenerated(text) {
  const result = {};
  const re = /^([A-Z][A-Z_0-9]*)\s*(?::\s*[^=\n]+?)?\s*=\s*([[{])/gm;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    const litStart = m.index + m[0].length - 1;
    const raw = scanLiteral(text, litStart);
    result[name] = JSON.parse(toJson(raw));
    re.lastIndex = litStart + raw.length;
  }
  return result;
}

module.exports = { parseGenerated };
