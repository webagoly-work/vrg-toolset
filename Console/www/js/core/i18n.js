/* Every user-facing string goes through t(). Page manifests add their names with addStrings(). */
import { hu } from '../i18n/hu.js';
import { en } from '../i18n/en.js';

export const LANGS = ['hu', 'en'];
export const DEFAULT_LANG = 'hu';
export const LOCALES = { hu: 'hu-HU', en: 'en-GB' };

const dicts = { hu: { ...hu }, en: { ...en } };
let lang = DEFAULT_LANG;

export const getLang = () => lang;
export const getLocale = () => LOCALES[lang];
export const dictionaries = () => dicts;

export function setLang(next) {
  if (LANGS.includes(next)) lang = next;
  return lang;
}

export function addStrings(strings) {
  for (const l of LANGS) Object.assign(dicts[l], strings[l]);
}

export function t(key, vars) {
  const text = dicts[lang][key];
  if (text == null) {
    console.error('Missing i18n key: ' + key);
    return '[' + key + ']';
  }
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/* data-i18n sets the text; the other attributes set what a screen reader or tooltip shows. */
export function applyDom(root) {
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = t(n.dataset.i18nTitle); });
}
