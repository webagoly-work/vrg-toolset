// Import formats.
//
// Invariant 5 of the project: everything the app can export, it can re-import.
// These parsers exist so that is a test rather than a hope.

import { dialect } from './exporters.js';

/**
 * RFC4180-ish CSV parser: handles quoted fields, doubled quotes inside them,
 * separators and newlines inside quotes, a BOM, and both line endings.
 * Returns an array of string arrays — no type guessing at this level.
 */
function parseDelimited(text, sepHint) {
  let s = String(text);
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  const sep = sepHint || sniffSeparator(s);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; continue; }
    if (ch === sep) { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows: rows.filter(r => r.length > 1 || r[0] !== ''), sep };
}

/** Pick the separator that yields the most consistent column count. */
function sniffSeparator(s) {
  const head = s.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (!head.length) return ';';
  let best = ';', bestScore = -1;
  for (const cand of [';', ',', '\t']) {
    const counts = head.map(line => line.split(cand).length);
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.every(c => c === first);
    const score = (consistent ? 100 : 0) + first;
    if (score > bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

/** "1 234,56" / "1234.56" / "" -> number | null */
function parseNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/\s| /g, '').replace(/Ft$/i, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // whichever comes last is the decimal mark; the other groups thousands
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Map a header row to column indexes, case- and accent-insensitively. */
function headerIndex(header) {
  const fold = x => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const map = new Map();
  header.forEach((h, i) => { if (!map.has(fold(h))) map.set(fold(h), i); });
  return name => {
    const i = map.get(fold(name));
    return i === undefined ? -1 : i;
  };
}

/**
 * Read an order list back from a CSV/TSV that this app produced.
 * Needs a column holding `vrg_id` and one holding the quantity; everything
 * else in the file is ignored, because the catalogue is the authority on names
 * and prices — a list only ever owns ids and quantities.
 */
function parseListCsv(text, opts) {
  const o = opts || {};
  const { rows } = parseDelimited(text, o.sep);
  if (!rows.length) return { lines: [], warnings: ['A fájl üres.'] };

  const warnings = [];
  const at = headerIndex(rows[0]);
  const idCol = [o.idColumn, 'vrg_id', 'VRG', 'azonosito', 'azonosító']
    .filter(Boolean).map(at).find(i => i >= 0);
  const qtyCol = [o.qtyColumn, 'mennyiseg', 'mennyiség', 'darab', 'qty']
    .filter(Boolean).map(at).find(i => i >= 0);
  const noteCol = ['megjegyzes', 'megjegyzés'].map(at).find(i => i >= 0);

  if (idCol === undefined) {
    throw new Error('Nem találtam „vrg_id” oszlopot a fájlban.');
  }
  if (qtyCol === undefined) {
    throw new Error('Nem találtam „mennyiseg” oszlopot a fájlban.');
  }

  const lines = [];
  const seen = new Map();
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const id = (cells[idCol] || '').trim();
    if (!/^VRG-\d{4,}$/.test(id)) continue;          // skip group headings and blanks
    const qty = parseNumber(cells[qtyCol]);
    if (qty == null || qty <= 0) { warnings.push(`${id}: érvénytelen mennyiség, kihagytam.`); continue; }
    if (o.knownId && !o.knownId(id)) { warnings.push(`${id}: nincs ilyen tétel a katalógusban, kihagytam.`); continue; }
    if (seen.has(id)) {
      seen.get(id).mennyiseg += qty;                 // the same item twice adds up
      warnings.push(`${id}: többször szerepel, a mennyiségeket összeadtam.`);
      continue;
    }
    const line = { vrg_id: id, mennyiseg: qty };
    if (noteCol !== undefined && cells[noteCol]) line.megjegyzes = cells[noteCol].trim();
    seen.set(id, line);
    lines.push(line);
  }
  if (!lines.length) warnings.push('Egyetlen érvényes sort sem találtam.');
  return { lines, warnings };
}

/** Read the `@data_tsv` block out of a dual-layer text export. */
function parseDualText(text) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex(l => l.startsWith('@data_tsv'));
  if (start < 0) throw new Error('Ez nem kétrétegű szöveges export (@data_tsv hiányzik).');
  const cols = lines[start].replace(/^@data_tsv\s+columns:\s*/, '').split('\t');
  const end = lines.findIndex((l, i) => i > start && l.startsWith('@end_data_tsv'));
  const body = lines.slice(start + 1, end < 0 ? lines.length : end).filter(l => l !== '');
  const meta = {};
  for (const l of lines.slice(0, start)) {
    const m = /^@(\w+)\s+(.*)$/.exec(l);
    if (m) meta[m[1]] = m[2].trim();
  }
  return {
    meta,
    columns: cols,
    rows: body.map(l => {
      const cells = l.split('\t');
      const o = {};
      cols.forEach((c, i) => { o[c] = cells[i] === undefined ? '' : cells[i]; });
      return o;
    })
  };
}

export { parseDelimited, sniffSeparator, parseNumber, headerIndex, parseListCsv, parseDualText };
