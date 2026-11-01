/* Redaction before anything leaves the device (L1, L2, L7): the client becomes "Client-A", the
   address drops to its district, phones and emails go. Pure, so Phase 3 traces can use it too. */
const PHONE = /(?:\+|\b00)\s?\d[\d\s/().-]{6,}\d|\b06[\s/-]?\d{1,2}[\s/-]?\d{3}[\s/-]?\d{3,4}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/* Hungarian postcodes: a Budapest one (1xx0-1xx9) keeps its district digits */
const BUDAPEST = /\b1(\d{2})\d\b/;
const POSTCODE = /\b\d{4}\b/;

export function coarseAddress(address, placeholder) {
  const text = String(address ?? '').trim();
  if (!text) return '';
  const bp = text.match(BUDAPEST);
  if (bp) return `Budapest ${Number(bp[1])}.`;
  const town = text.replace(POSTCODE, '').split(',')[0].trim().split(/\s+/)[0];
  return town || placeholder;
}

const SECRET = /\b(?:sk|pk|rk|ghp|gho|ghs|xox[a-z]|github_pat|AKIA)[-_A-Z0-9][\w-]{14,}|\bBearer\s+[\w.~+/-]{16,}|\b(?:password|passwd|pwd|jelsz[oó]|token|secret|api[_-]?key)\b["'\s:=]+[^\s"',;]{6,}/gi;
/* street and number, with the postcode and town in front when they are there */
const STREET = /(?:\b\d{4}\s+[\p{Lu}][\p{L}-]*,?\s+)?\b[\p{Lu}][\p{L}.-]+\s+(?:utca|út|útja|tér|tere|köz|körút|krt\.|sor|sétány|u\.)\s*\d+[\w/.-]*/gu;
/* a client's name is often the folder name */
const JOB_PATH = /\b(jobs|Planner_projektek_[^\\/\s"']*)([\\/]+)(?!\[…\])[^\\/\s"']+/g;

/* Traces (Phase 3): the same rules as redactText plus secrets, streets and job folders. Returns the
   text and how many of each went, so the UI can show that redaction ran. */
export function scrubText(text, { names = [], clientLabel = 'Client-A', dropped = '[…]' } = {}) {
  const counts = { names: 0, contact: 0, address: 0, secret: 0, path: 0 };
  let out = String(text ?? '');
  const swap = (re, kind, to) => { out = out.replace(re, (...m) => { counts[kind]++; return typeof to === 'function' ? to(...m) : to; }); };
  swap(SECRET, 'secret', dropped);
  swap(EMAIL, 'contact', dropped);
  swap(PHONE, 'contact', dropped);
  for (const n of names.filter(Boolean).sort((a, b) => b.length - a.length)) {
    const parts = out.split(n);
    counts.names += parts.length - 1;
    out = parts.join(clientLabel);
  }
  swap(STREET, 'address', dropped);
  swap(JOB_PATH, 'path', (m, root, sep) => root + sep + dropped);
  return { text: out, counts };
}

/* job: { client, site, contact }. names: every literal value to replace, longest first. */
export function redactText(text, { names = [], address, clientLabel = 'Client-A', dropped = '[…]' } = {}) {
  let out = String(text ?? '');
  for (const n of names.filter(Boolean).sort((a, b) => b.length - a.length)) out = out.split(n).join(clientLabel);
  if (address) out = out.split(address).join(coarseAddress(address, dropped));
  return out.replace(EMAIL, dropped).replace(PHONE, dropped);
}
