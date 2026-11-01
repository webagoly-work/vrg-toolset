/* Numbers and dates follow the language (decimal comma in Hungarian). Units never change. */
import { getLocale } from './i18n.js';

export function formatNumber(value, digits) {
  const opts = digits == null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  return new Intl.NumberFormat(getLocale(), opts).format(value);
}

export const formatUnit = (value, unit, digits) => formatNumber(value, digits) + ' ' + unit;

/* Typed numbers accept a decimal comma or point. Empty or invalid gives null. */
export function parseNumber(text) {
  const s = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const formatDate = (date) =>
  new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const formatTime = (date) =>
  new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

export const formatDateTime = (date) => formatDate(date) + ' ' + formatTime(date);
