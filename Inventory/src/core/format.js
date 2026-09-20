// Hungarian formatting. Kept separate so exports and the UI agree.

const NBSP = ' ';

/** Group the integer part in threes with a non-breaking space; decimal comma. */
function num(v, decimals) {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const d = decimals == null ? (Number.isInteger(n) ? 0 : 2) : decimals;
  const fixed = Math.abs(n).toFixed(d);
  const dot = fixed.indexOf('.');
  const int = dot < 0 ? fixed : fixed.slice(0, dot);
  const frac = dot < 0 ? '' : fixed.slice(dot + 1);
  const grouped = int.replace(/\B(?=(\d{3})+$)/g, NBSP);
  return (n < 0 ? '-' : '') + grouped + (frac ? ',' + frac : '');
}

function huf(v, decimals) {
  if (v == null || v === '') return '—';
  return num(v, decimals) + NBSP + 'Ft';
}

/** Source dates are "2026.09.17"; normalise anything close to that. */
function date(v) {
  if (!v) return '';
  const m = /^(\d{4})[.-](\d{2})[.-](\d{2})/.exec(v);
  return m ? `${m[1]}.${m[2]}.${m[3]}.` : String(v);
}

function pct(v) {
  if (v == null || v === '') return '';
  return String(v).replace('.', ',') + '%';
}

export { num, huf, date, pct, NBSP };
