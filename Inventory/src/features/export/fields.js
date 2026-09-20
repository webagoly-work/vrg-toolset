// Export field descriptors.
//
// Two shapes of row get exported: catalogue items and order-list rows. The
// catalogue set is derived from the table's column registry so a column only
// has to be defined once; the list set is defined here because list rows are
// computed, not stored.

import * as fmt from '../../core/format.js';
import * as categories from '../../core/categories.js';

/** Catalogue export fields, derived from the table columns. */
function catalogFields(COLUMNS) {
  return COLUMNS
    .filter(c => !c.interactive)                 // a quantity stepper is not a value
    .map(c => ({
      id: c.id,
      label: c.label,
      vendor: !!c.vendor,
      vendorDerived: !!c.vendorDerived,
      get: (row, ctx) => c.get(row, ctx),
      show: (row, ctx) => (c.show ? c.show(row, ctx) : c.get(row, ctx)),
      // raw values keep their type so the CSV dialect can format numbers
      exportValue: (row, ctx) => c.get(row, ctx)
    }));
}

/** Order-list export fields. `row` is what core/lists.js rows() produces. */
function listFields() {
  const item = (r, f) => (r.item ? f(r.item) : null);
  return [
    { id: 'vrg_id', label: 'vrg_id', get: r => r.vrg_id },
    { id: 'megnevezes', label: 'Megnevezés', get: r => item(r, i => i.megnevezes) },
    { id: 'marka', label: 'Márka', get: r => item(r, i => i.marka_gyarto) },
    { id: 'gyartoi_cikkszam', label: 'Gyártói cikkszám', get: r => item(r, i => i.gyartoi_cikkszam) },
    { id: 'kategoria_fo', label: 'Kategória (fő)', get: r => item(r, i => categories.resolve(i).fo) },
    { id: 'kategoria_al', label: 'Kategória (al)', get: r => item(r, i => categories.resolve(i).al) },
    { id: 'egyseg', label: 'Egység', get: r => item(r, i => i.egyseg) },
    { id: 'mennyiseg', label: 'mennyiseg', get: r => r.mennyiseg },
    { id: 'egysegar', label: 'Egységár (nettó)', get: r => r.egysegar, show: r => fmt.huf(r.egysegar) },
    { id: 'sor_netto', label: 'Sor nettó', get: r => r.sor_netto, show: r => fmt.huf(r.sor_netto) },
    { id: 'sor_brutto', label: 'Sor bruttó', get: r => (r.sor_netto == null ? null : Math.round(r.sor_netto * 1.27)), show: r => fmt.huf(r.sor_netto == null ? null : Math.round(r.sor_netto * 1.27)) },
    { id: 'sor_megjegyzes', label: 'Megjegyzés', get: r => r.megjegyzes || null },
    { id: 'tomeg_kg', label: 'Tömeg (kg)', get: r => item(r, i => i.tomeg_kg) },
    { id: 'sor_tomeg', label: 'Sor tömeg (kg)', get: r => item(r, i => (i.tomeg_kg == null ? null : Math.round(i.tomeg_kg * r.mennyiseg * 1000) / 1000)) },
    // vendor-gated, exactly like the table
    { id: 'v_cikkszam', label: 'Besz. cikkszám', vendor: true, get: (r, ctx) => (r.item ? ctx.vendors.read(r.item, 'v_cikkszam') : null) },
    { id: 'v_kiszereles', label: 'Kiszerelés', vendor: true, get: (r, ctx) => (r.item ? ctx.vendors.read(r.item, 'v_kiszereles') : null) },
    { id: 'csomag_ok', label: 'Egész csomag', vendor: true, get: r => (r.csomag_mennyiseg ? r.csomag_ok : null) }
  ];
}

/** Drop vendor fields unless that vendor is selected — the gate, for exports. */
function visibleFields(fields, ctx) {
  const on = !!(ctx && ctx.vendors && ctx.vendors.selectedId());
  return fields.filter(f => on || !(f.vendor || f.vendorDerived));
}

function pick(fields, ids, ctx) {
  const byId = new Map(visibleFields(fields, ctx).map(f => [f.id, f]));
  const chosen = (ids || []).map(id => byId.get(id)).filter(Boolean);
  return chosen.length ? chosen : visibleFields(fields, ctx).slice(0, 6);
}

export { catalogFields, listFields, visibleFields, pick };
