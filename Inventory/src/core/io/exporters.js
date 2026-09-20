// Export formats.
//
// Everything here is a pure function from data to a string, so an export can
// be unit-tested without a browser and re-imported by importers.js. The
// exporters take column descriptors as an argument rather than importing the
// catalogue's column registry — core must not depend on a feature.

const BOM = '﻿';

/** Excel-HU wants ";" and a decimal comma; machines want "," and a dot. */
const DIALECTS = {
  'excel-hu': { sep: ';', decimal: ',', bom: true, eol: '\r\n' },
  'standard': { sep: ',', decimal: '.', bom: false, eol: '\n' },
  'tsv': { sep: '\t', decimal: '.', bom: false, eol: '\n' }
};

function dialect(name) {
  const d = DIALECTS[name];
  if (!d) throw new Error('unknown csv dialect: ' + name);
  return d;
}

function formatNumber(v, d) {
  return d.decimal === ',' ? String(v).replace('.', ',') : String(v);
}

function quote(s, d) {
  const needs = s.includes(d.sep) || s.includes('"') || /[\r\n]/.test(s);
  return needs ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function cell(value, d) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return formatNumber(value, d);
  if (typeof value === 'boolean') return value ? 'igen' : 'nem';
  return quote(String(value), d);
}

/**
 * Order rows by a user-defined category order, then by name inside each group.
 * Categories the user has not ranked keep their Hungarian alphabetical order
 * after the ranked ones, so an incomplete order never hides anything.
 */
function orderByCategory(rows, categoryOf, categoryOrder) {
  const rank = new Map((categoryOrder || []).map((k, i) => [k, i]));
  const big = Number.MAX_SAFE_INTEGER;
  return rows.slice().sort((a, b) => {
    const ka = categoryOf(a), kb = categoryOf(b);
    const ra = rank.has(ka) ? rank.get(ka) : big;
    const rb = rank.has(kb) ? rank.get(kb) : big;
    if (ra !== rb) return ra - rb;
    if (ka !== kb) return ka.localeCompare(kb, 'hu');
    return 0;
  });
}

/**
 * csv({ rows, columns, ctx, dialect, header, groupBy })
 * `columns` are { id, label, get(row, ctx), show(row, ctx) } descriptors.
 * `groupBy(row)` (optional) inserts a heading line before each new group —
 * useful for a spreadsheet a human reads, wrong for one a machine parses.
 */
function csv(o) {
  const d = dialect(o.dialect || 'excel-hu');
  const lines = [];
  if (o.header !== false) lines.push(o.columns.map(c => quote(c.label, d)).join(d.sep));

  let lastGroup = null;
  for (const row of o.rows) {
    if (o.groupBy) {
      const g = o.groupBy(row);
      if (g !== lastGroup) {
        lastGroup = g;
        lines.push(quote(g, d) + d.sep.repeat(Math.max(0, o.columns.length - 1)));
      }
    }
    lines.push(o.columns.map(c => {
      const raw = c.exportValue ? c.exportValue(row, o.ctx) : c.get(row, o.ctx);
      return cell(raw, d);
    }).join(d.sep));
  }
  return (d.bom ? BOM : '') + lines.join(d.eol) + d.eol;
}

function tsv(o) {
  return csv(Object.assign({}, o, { dialect: 'tsv' }));
}

function json(o) {
  return JSON.stringify(o.payload, null, 1);
}

// ------------------------------------------------------- vendor order text
/**
 * The plain-text order you paste into an e-mail to the vendor: their article
 * number, the quantity, the name. Refuses to run without a selected vendor —
 * an order addressed to nobody is worse than no order.
 */
function vendorOrder(o) {
  const { rows, vendor, listName, note } = o;
  if (!vendor) throw new Error('vendor order needs a selected vendor');
  const L = [];
  L.push(`Megrendelés — ${listName || 'névtelen lista'}`);
  L.push(`Beszállító: ${vendor.nev}`);
  L.push(`Dátum: ${o.date || new Date().toISOString().slice(0, 10)}`);
  if (note) L.push(`Megjegyzés: ${note}`);
  L.push('');
  const w = Math.max(10, ...rows.map(r => String(r.cikkszam || '').length));
  for (const r of rows) {
    const qty = `${r.mennyiseg} ${r.egyseg || 'db'}`;
    L.push(`${String(r.cikkszam || '—').padEnd(w)}  ${qty.padStart(10)}  ${r.megnevezes}` +
      (r.megjegyzes ? `   [${r.megjegyzes}]` : ''));
  }
  L.push('');
  if (o.totals) {
    L.push(`Sorok: ${o.totals.sorok}   Nettó összesen: ${o.totals.netto} Ft   Bruttó: ${o.totals.brutto} Ft`);
    L.push('(A végösszeg tájékoztató, a beszállítói visszaigazolás az irányadó.)');
  }
  return L.join('\n') + '\n';
}

// ----------------------------------------------------------- dual-layer text
const RULE = '='.repeat(78);
const THIN = '-'.repeat(78);

/**
 * The format the whole project is built around: a human-readable block, then
 * an `@`-tagged machine block carrying the schema and the same data as TSV, so
 * one text file is enough for a person *or* an agent to rebuild from.
 */
function dualText(o) {
  const { title, meta, rows, columns, ctx, groupBy, aiNotes, tsvColumns } = o;
  const L = [];

  L.push(RULE);
  L.push(title);
  const metaLine = Object.entries(meta || {}).map(([k, v]) => `${k}: ${v}`).join('   |   ');
  if (metaLine) L.push(metaLine);
  L.push(RULE);
  L.push('');
  for (const line of o.preamble || []) L.push(line);
  if ((o.preamble || []).length) L.push('');

  let lastGroup = null;
  for (const row of rows) {
    if (groupBy) {
      const g = groupBy(row);
      if (g !== lastGroup) {
        lastGroup = g;
        L.push(THIN);
        L.push(g.toUpperCase());
        L.push(THIN);
      }
    }
    const parts = columns.map(c => {
      const s = c.show ? c.show(row, ctx) : c.get(row, ctx);
      return s == null || s === '' ? null : `${c.label}: ${s}`;
    }).filter(Boolean);
    L.push('  ' + parts.join('  |  '));
  }

  L.push('');
  L.push(RULE);
  L.push('AI-CONTEXT BLOCK — MACHINE READABLE. Everything below this line is');
  L.push('written for an AI agent / importer, not for a human reader.');
  L.push(RULE);
  L.push('');
  for (const [k, v] of Object.entries(meta || {})) L.push('@' + k.padEnd(18) + ' ' + v);
  L.push('@row_count         ' + rows.length);
  L.push('@encoding          UTF-8, LF line endings');
  L.push('@decimal_separator "." inside this block');
  L.push('');
  for (const line of aiNotes || []) L.push(line);
  if ((aiNotes || []).length) L.push('');

  const tcols = tsvColumns || columns;
  L.push('@data_tsv  columns: ' + tcols.map(c => c.id).join('\t'));
  for (const row of rows) {
    L.push(tcols.map(c => {
      const v = c.exportValue ? c.exportValue(row, ctx) : c.get(row, ctx);
      return v == null ? '' : String(v).replace(/[\t\r\n]/g, ' ');
    }).join('\t'));
  }
  L.push('@end_data_tsv');
  L.push('');
  return L.join('\n');
}

export { csv, tsv, json, vendorOrder, dualText, orderByCategory, DIALECTS, dialect, BOM };
