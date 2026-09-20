// What goes inside a QR code.
//
// Two payloads, because they serve two different readers:
//
//   compact  ids + quantities only. Re-importable by this app, meaningless to
//            a human. ~350 lines fit in one code, so a realistic order list
//            never needs splitting.
//   text     the list as a person would read it. Fits ~40 lines. This is the
//            one worth scanning with a phone's own camera, because the camera
//            shows you the text and lets you share it straight into a message.
//
// The compact format is deliberately plain ASCII with no compression: a QR
// encoder packs alphanumerics far better than it packs base64 of a deflate
// stream, so "compressing" it would make the code BIGGER. Measured, not assumed.

const TAG = 'VRGL1';
const SEP = '|';

/** "VRG-0098" -> "0098" ; anything else is kept whole so nothing is silently lost. */
function shortId(vrgId) {
  const m = /^VRG-(\d{4,})$/.exec(String(vrgId || ''));
  return m ? m[1] : String(vrgId || '');
}

function longId(short) {
  return /^\d{4,}$/.test(short) ? 'VRG-' + short : String(short);
}

/** Quantities are written as compactly as they can be read back exactly. */
function shortQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}

/**
 * encodeList({ nev, sorok:[{vrg_id, mennyiseg}] }) -> "VRGL1|Hetényi|0098:7,0004:1"
 * The list name is included because a list without a name arrives as a puzzle.
 */
function encodeList(list) {
  // the separators cannot appear in a name, and stripping one must not leave a
  // gap where it was
  const nev = String((list && list.nev) || '').replace(/[|,]/g, ' ').replace(/\s+/g, ' ').trim();
  const rows = ((list && list.sorok) || [])
    .filter(r => r && r.vrg_id && Number(r.mennyiseg) > 0)
    .map(r => shortId(r.vrg_id) + ':' + shortQty(r.mennyiseg));
  return TAG + SEP + nev + SEP + rows.join(',');
}

/**
 * Read a compact payload back. Returns { nev, sorok, warnings } and never
 * throws on a malformed row — it reports it, because a payload that arrived by
 * camera or clipboard has had every chance to be mangled.
 */
function decodeList(text, opts) {
  const o = opts || {};
  const s = String(text == null ? '' : text).trim();
  if (!s.startsWith(TAG + SEP)) {
    throw new Error('Ez nem VRG lista-kód (a ' + TAG + ' jelölés hiányzik).');
  }
  const parts = s.split(SEP);
  const nev = (parts[1] || '').trim();
  const body = parts.slice(2).join(SEP).trim();
  const warnings = [];
  const sorok = [];
  const seen = new Map();

  for (const chunk of body ? body.split(',') : []) {
    const piece = chunk.trim();
    if (!piece) continue;
    const m = /^([A-Za-z0-9-]+):(\d+(?:\.\d+)?)$/.exec(piece);
    if (!m) { warnings.push('Értelmezhetetlen rész, kihagyva: ' + piece); continue; }
    const id = longId(m[1]);
    const qty = Number(m[2]);
    if (!(qty > 0)) { warnings.push(id + ': érvénytelen mennyiség, kihagyva.'); continue; }
    if (o.knownId && !o.knownId(id)) { warnings.push(id + ': nincs ilyen tétel a katalógusban.'); continue; }
    if (seen.has(id)) {
      seen.get(id).mennyiseg += qty;
      warnings.push(id + ': többször szerepel, a mennyiségeket összeadtam.');
      continue;
    }
    const row = { vrg_id: id, mennyiseg: qty };
    seen.set(id, row);
    sorok.push(row);
  }
  return { nev, sorok, warnings };
}

/**
 * The human-readable payload. Short lines on purpose: this is read on a phone
 * screen, and every character costs QR capacity.
 */
function listText(opts) {
  const { nev, rows, vendor, totals } = opts;
  const L = [];
  L.push('VRG rendelés — ' + (nev || 'névtelen lista'));
  if (vendor) L.push(vendor.nev);
  L.push('');
  for (const r of rows) {
    if (!r.item) { L.push(`${r.vrg_id}  ${r.mennyiseg}  (ismeretlen tétel)`); continue; }
    const code = (opts.vendorCode && opts.vendorCode(r.item)) || r.item.gyartoi_cikkszam || r.vrg_id;
    const qty = shortQty(r.mennyiseg) + ' ' + (r.item.egyseg || 'db');
    L.push(`${qty}  ${code}  ${r.item.megnevezes}`);
  }
  if (totals) {
    L.push('');
    L.push(`${totals.sorok} sor, nettó ${Math.round(totals.netto)} Ft`);
  }
  return L.join('\n');
}

/** A single item, for the "what is this thing" code stuck on a shelf or a box. */
function itemText(item, opts) {
  const o = opts || {};
  const L = [item.megnevezes, item.vrg_id];
  if (item.marka_gyarto) L.push('Gyártó: ' + item.marka_gyarto);
  if (item.gyartoi_cikkszam) L.push('Gyártói cikkszám: ' + item.gyartoi_cikkszam);
  if (item.gtin) L.push('EAN: ' + item.gtin);
  if (o.vendorCode) L.push(o.vendorNev + ': ' + o.vendorCode);
  if (item.tomeg_kg != null) L.push('Tömeg: ' + item.tomeg_kg + ' kg');
  if (o.link) L.push(o.link);
  return L.join('\n');
}

export { TAG, shortId, longId, encodeList, decodeList, listText, itemText };
