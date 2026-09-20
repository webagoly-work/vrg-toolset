// Price arithmetic and price-change detection.
//
// Vocabulary, because the sources mix three different prices:
//   listaár        the vendor's own net list price
//   nettó egységár our partner-specific DISCOUNTED net price (what we pay)
//   bruttó         gross; in this dataset always *computed* as net × (1 + VAT)
//                  except vendors.*.aktualis_brutto_ar_huf, which is read from
//                  the webshop and is therefore a real gross price

import { VAT_RATE } from './schema.js';

function gross(net, vat) {
  if (net == null || net === '') return null;
  return Math.round(net * (1 + (vat == null ? VAT_RATE : vat)));
}

function net(grossValue, vat) {
  if (grossValue == null || grossValue === '') return null;
  return Math.round((grossValue / (1 + (vat == null ? VAT_RATE : vat))) * 100) / 100;
}

/** Discount implied by a list price and the price we actually paid. */
function discountPct(listaar, nettoEgysegar) {
  if (!listaar || nettoEgysegar == null) return null;
  return Math.round((1 - nettoEgysegar / listaar) * 1000) / 10;
}

/** The estimate shown when no vendor is selected. */
function estimate(item) {
  const a = item.becsult_ar || {};
  return {
    netto: a.netto_huf == null ? null : a.netto_huf,
    brutto: a.brutto_huf == null ? gross(a.netto_huf) : a.brutto_huf,
    datum: a.datum || null,
    forras: a.forras || null,
    ismert: a.netto_huf != null
  };
}

/**
 * Compare a freshly read webshop gross price with the stored one.
 * Returns null when there is nothing to compare or nothing changed, otherwise
 * the entry to append to the finance log (Phase 7).
 */
function priceChange(previous, current, meta) {
  if (current == null) return null;
  if (previous == null) {
    return Object.assign({ regi_brutto: null, uj_brutto: current, valtozas_huf: null, valtozas_szazalek: null }, meta);
  }
  if (previous === current) return null;
  const diff = current - previous;
  return Object.assign({
    regi_brutto: previous,
    uj_brutto: current,
    valtozas_huf: Math.round(diff * 100) / 100,
    valtozas_szazalek: Math.round((diff / previous) * 1000) / 10
  }, meta);
}

/** Order quantity vs. the vendor's pack size. Phase 4 warns on `false`. */
function fitsPack(qty, packQty) {
  if (!packQty || packQty <= 1) return true;
  return Math.abs(qty / packQty - Math.round(qty / packQty)) < 1e-9;
}

export { gross, net, discountPct, estimate, priceChange, fitsPack };
