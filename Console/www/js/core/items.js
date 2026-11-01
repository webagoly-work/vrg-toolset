/* Supplier CSV: name;code;EAN;unit;price;date. Rows with no name or price are skipped. */
import { parseNumber } from './format.js';

export function parseItems(text) {
  return text.split(/\r?\n/).map((line) => line.split(';').map((c) => c.trim().replace(/^"|"$/g, '')))
    .filter((c) => c[0] && parseNumber(c[4]) !== null)
    .map(([name, code, ean, unit, price, date]) => ({ name, code, ean, unit, price: parseNumber(price), date }));
}
