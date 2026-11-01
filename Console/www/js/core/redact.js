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

/* job: { client, site, contact }. names: every literal value to replace, longest first. */
export function redactText(text, { names = [], address, clientLabel = 'Client-A', dropped = '[…]' } = {}) {
  let out = String(text ?? '');
  for (const n of names.filter(Boolean).sort((a, b) => b.length - a.length)) out = out.split(n).join(clientLabel);
  if (address) out = out.split(address).join(coarseAddress(address, dropped));
  return out.replace(EMAIL, dropped).replace(PHONE, dropped);
}
