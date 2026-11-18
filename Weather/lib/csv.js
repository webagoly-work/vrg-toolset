// VRG Időjárás — header-driven CSV reading for the HungaroMet files.
// The column names come from config (sources.json "columns": var -> list of accepted header names), so a
// renamed column is a config change. Separator is guessed (; , tab), comment and metadata lines before the
// header are skipped (the header is the first line holding a time and a station/lat column).
'use strict';

function sniff(line) {
  const c = { ';': 0, ',': 0, '\t': 0 };
  for (const ch of line) if (ch in c) c[ch]++;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

function table(text, columns, requiredKeys) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  for (let h = 0; h < Math.min(lines.length, 40); h++) {
    const sep = sniff(lines[h]);
    const head = lines[h].split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
    const idx = {};
    for (const [key, names] of Object.entries(columns)) {
      const i = head.findIndex(x => names.some(n => n.toLowerCase() === x.toLowerCase()));
      if (i >= 0) idx[key] = i;
    }
    if (!requiredKeys.every(k => k in idx)) continue;
    const rows = [];
    for (const l of lines.slice(h + 1)) {
      const cells = l.split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
      if (cells.length < 2) continue;
      const r = {};
      for (const [k, i] of Object.entries(idx)) r[k] = cells[i];
      rows.push(r);
    }
    return { head, idx, rows };
  }
  throw new Error('CSV: no header with ' + requiredKeys.join(', '));
}

const num = (s, missing = []) => {
  if (s == null) return null;
  const t = String(s).trim();
  if (missing.includes(t)) return null;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) && v > -998 ? v : null;
};

// 202611180600 | 2026-11-18 06:00 | 2026-11-18T06:00:00Z -> Date (UTC; HungaroMet files are UTC)
function time(s) {
  const t = String(s || '').trim();
  let m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  m = /^(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{2}):(\d{2})/.exec(t);
  if (m) return new Date(t.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(t) ? t : Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  const d = new Date(t);
  return isNaN(d) ? null : d;
}

module.exports = { table, num, time, sniff };
