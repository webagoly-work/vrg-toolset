// Column registry: the single description of what the table can show.
//
// A column owns its label, its width, how to read a value, how to render it
// and how to sort by it. Vendor columns declare `vendor: true` and read
// through the gate, so a column definition is the only thing a new vendor
// field needs — never a change in the table code.

import * as fmt from '../../core/format.js';
import * as categories from '../../core/categories.js';
import { estimate } from '../../core/pricing.js';

const TEXT = 'text', NUM = 'num', MONO = 'mono';

// `get`    -> the sortable/raw value (null when unknown)
// `show`   -> the string to display; defaults to a sensible rendering of get()
// `render` -> a DOM node instead of text, for cells the user can act on
// `ctx`    -> { vendors, lists } so columns can reach the gate and the active list
const COLUMNS = [
  {
    // the only editable cell in the table: quantity in the active order list
    id: 'lista', label: 'Lista', kind: NUM, width: 96, interactive: true,
    get: (it, ctx) => (ctx.lists ? ctx.lists.qty(it.vrg_id) : 0),
    render: (it, ctx, dom) => {
      const n = ctx.lists ? ctx.lists.qty(it.vrg_id) : 0;
      const disabled = !ctx.lists || !ctx.lists.activeId();
      const bump = d => e => {
        e.stopPropagation();                    // a cell button must not also open the drawer
        ctx.lists.add(it.vrg_id, d);
        if (ctx.onListChange) ctx.onListChange(it.vrg_id);
      };
      return dom.el('div', { class: 'qtycell' + (n ? ' on' : '') }, [
        dom.el('button', {
          type: 'button', class: 'tiny', text: '−', disabled: disabled || !n || null,
          title: 'Eggyel kevesebb', onclick: bump(-1)
        }),
        dom.el('span', { class: 'qty', text: n ? String(n) : '·' }),
        dom.el('button', {
          type: 'button', class: 'tiny', text: '+', disabled: disabled || null,
          title: 'Hozzáadás a listához', onclick: bump(1)
        })
      ]);
    }
  },
  {
    id: 'kedvenc', label: '★', kind: TEXT, width: 34, title: 'Kedvenc',
    get: it => (it.user && it.user.kedvenc ? 1 : 0),
    show: it => (it.user && it.user.kedvenc ? '★' : '')
  },
  {
    id: 'jeloles', label: '●', kind: TEXT, width: 34, title: 'Jelölés',
    get: it => (it.user && it.user.jeloles) || null,
    show: it => (it.user && it.user.jeloles ? '●' : ''),
    markClass: it => (it.user && it.user.jeloles ? 'mark-' + it.user.jeloles : null)
  },
  {
    id: 'vrg_id', label: 'VRG', kind: MONO, width: 84,
    get: it => it.vrg_id
  },
  {
    id: 'megnevezes', label: 'Megnevezés', kind: TEXT, width: 380, grow: true,
    get: it => it.megnevezes
  },
  {
    id: 'marka', label: 'Márka', kind: TEXT, width: 140,
    get: it => it.marka_gyarto
  },
  {
    id: 'gyartoi_cikkszam', label: 'Gyártói cikkszám', kind: MONO, width: 150,
    get: it => it.gyartoi_cikkszam
  },
  {
    id: 'kategoria_fo', label: 'Kategória (fő)', kind: TEXT, width: 190, overrides: 'kategoria',
    get: it => categories.resolve(it).fo,
    provisional: it => !categories.resolve(it).official
  },
  {
    id: 'kategoria_al', label: 'Kategória (al)', kind: TEXT, width: 220, overrides: 'kategoria',
    get: it => categories.resolve(it).al,
    provisional: it => !categories.resolve(it).official
  },
  {
    id: 'gtin', label: 'GTIN / EAN', kind: MONO, width: 130,
    get: it => it.gtin
  },
  {
    id: 'egyseg', label: 'Egys.', kind: TEXT, width: 58,
    get: it => it.egyseg
  },
  {
    id: 'netto', label: 'Nettó', kind: NUM, width: 104,
    get: it => estimate(it).netto,
    show: it => fmt.huf(estimate(it).netto)
  },
  {
    id: 'brutto', label: 'Bruttó~', kind: NUM, width: 104, dim: true,
    get: it => estimate(it).brutto,
    show: it => fmt.huf(estimate(it).brutto)
  },
  {
    id: 'ar_datum', label: 'Ár dátuma', kind: TEXT, width: 104, dim: true,
    get: it => estimate(it).datum,
    show: it => fmt.date(estimate(it).datum)
  },
  {
    id: 'tomeg', label: 'Tömeg (kg)', kind: NUM, width: 96, overrides: 'tomeg_kg',
    get: it => it.tomeg_kg,
    show: it => (it.tomeg_kg == null ? '—' : fmt.num(it.tomeg_kg, 3))
  },
  {
    id: 'rendelesek', label: 'Rend.', kind: NUM, width: 70,
    get: it => it.felhasznalas.rendelesek_szama
  },
  {
    id: 'mennyiseg', label: 'Összes mennyiség', kind: NUM, width: 130,
    get: it => it.felhasznalas.osszes_rendelt_mennyiseg
  },
  {
    id: 'utolso_rendeles', label: 'Utolsó rendelés', kind: TEXT, width: 124,
    get: it => it.felhasznalas.utolso_rendeles,
    show: it => fmt.date(it.felhasznalas.utolso_rendeles)
  },
  {
    // legacy_id is stored as a neutral field, but its VALUE is the vendor's own
    // article number. Displaying it in neutral mode would put a DANIELLA code on
    // screen through the back door, so it follows the gate even though it is not
    // read through it.
    id: 'legacy_id', label: 'Régi azonosító', kind: MONO, width: 150, dim: true,
    vendorDerived: true,
    get: it => it.legacy_id
  },
  {
    id: 'megjegyzes', label: 'Megjegyzés', kind: TEXT, width: 260,
    get: it => (it.user && it.user.megjegyzes) || null
  },

  // ---- vendor columns: only ever reachable through the gate --------------
  {
    id: 'v_cikkszam', label: 'Cikkszám', kind: MONO, width: 150, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_cikkszam')
  },
  {
    id: 'v_netto', label: 'Besz. nettó', kind: NUM, width: 112, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_netto'),
    show: (it, ctx) => fmt.huf(ctx.vendors.read(it, 'v_netto'))
  },
  {
    id: 'v_listaar', label: 'Listaár', kind: NUM, width: 112, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_listaar'),
    show: (it, ctx) => fmt.huf(ctx.vendors.read(it, 'v_listaar'))
  },
  {
    id: 'v_engedmeny', label: 'Eng.', kind: NUM, width: 74, vendor: true,
    get: (it, ctx) => {
      const v = ctx.vendors.read(it, 'v_engedmeny');
      return v == null ? null : parseFloat(String(v).replace(',', '.'));
    },
    show: (it, ctx) => fmt.pct(ctx.vendors.read(it, 'v_engedmeny')) || '—'
  },
  {
    id: 'v_kiszereles', label: 'Kiszerelés', kind: TEXT, width: 108, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_kiszereles')
  },
  {
    id: 'v_keszlet', label: 'Készlet', kind: NUM, width: 90, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_keszlet')
  },
  {
    id: 'v_aktualis_brutto', label: 'Webshop bruttó', kind: NUM, width: 128, vendor: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_aktualis_brutto'),
    show: (it, ctx) => fmt.huf(ctx.vendors.read(it, 'v_aktualis_brutto'))
  },
  {
    id: 'v_ellenorizve', label: 'Ár ellenőrizve', kind: TEXT, width: 122, vendor: true, dim: true,
    get: (it, ctx) => ctx.vendors.read(it, 'v_ellenorizve'),
    show: (it, ctx) => fmt.date(ctx.vendors.read(it, 'v_ellenorizve'))
  }
];

const BY_ID = new Map(COLUMNS.map(c => [c.id, c]));

const DEFAULT_ORDER = [
  'lista', 'kedvenc', 'jeloles', 'vrg_id', 'megnevezes', 'marka', 'gyartoi_cikkszam', 'kategoria_al',
  'egyseg', 'netto', 'brutto', 'rendelesek',
  'v_cikkszam', 'v_listaar', 'v_engedmeny', 'v_kiszereles'
];

function column(id) {
  const c = BY_ID.get(id);
  if (!c) throw new Error('unknown column: ' + id);
  return c;
}

function cellText(col, item, ctx) {
  if (col.show) {
    const s = col.show(item, ctx);
    return s == null || s === '' ? '—' : String(s);
  }
  const v = col.get(item, ctx);
  if (v == null || v === '') return '—';
  return typeof v === 'number' ? fmt.num(v) : String(v);
}

/**
 * Column state: which columns are on, and in what order.
 * `serialize()` / `restore()` are the seam Phase 3 plugs localStorage into —
 * this module deliberately knows nothing about persistence.
 */
function createColumnState(initial) {
  let order = (initial && initial.order ? initial.order : DEFAULT_ORDER).filter(id => BY_ID.has(id));
  let visible = new Set(initial && initial.visible ? initial.visible.filter(id => BY_ID.has(id)) : order);

  // every known column must appear in `order` exactly once, so the picker can
  // offer the ones that are currently hidden
  for (const c of COLUMNS) if (!order.includes(c.id)) order.push(c.id);

  function all() {
    return order.map(id => column(id));
  }

  /**
   * Columns to render now: visible, in order, and — unless a vendor is
   * selected — without anything that would put a vendor value on screen,
   * whether it is read through the gate (`vendor`) or merely equal to one
   * (`vendorDerived`).
   */
  function active(ctx) {
    const vendorOn = !!(ctx && ctx.vendors && ctx.vendors.selectedId());
    return all().filter(c => visible.has(c.id) && (vendorOn || !(c.vendor || c.vendorDerived)));
  }

  function isVisible(id) { return visible.has(column(id).id); }

  function toggle(id, on) {
    const c = column(id);
    const next = on == null ? !visible.has(c.id) : !!on;
    if (!next && visible.size === 1 && visible.has(c.id)) return false;  // never hide the last one
    if (next) visible.add(c.id); else visible.delete(c.id);
    return true;
  }

  function move(id, delta) {
    const c = column(id);
    const i = order.indexOf(c.id);
    const j = i + delta;
    if (j < 0 || j >= order.length) return false;
    order.splice(i, 1);
    order.splice(j, 0, c.id);
    return true;
  }

  function reset() {
    order = DEFAULT_ORDER.slice();
    for (const c of COLUMNS) if (!order.includes(c.id)) order.push(c.id);
    visible = new Set(DEFAULT_ORDER);
  }

  function serialize() {
    return { order: order.slice(), visible: [...visible] };
  }

  return { all, active, isVisible, toggle, move, reset, serialize };
}

/** Comparator for a column, stable and null-last regardless of direction. */
function comparator(col, ctx, desc) {
  const dir = desc ? -1 : 1;
  return (a, b) => {
    const va = col.get(a, ctx);
    const vb = col.get(b, ctx);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea && eb) return a.vrg_id.localeCompare(b.vrg_id);
    if (ea) return 1;                       // unknown values always sink
    if (eb) return -1;
    let r;
    if (typeof va === 'number' && typeof vb === 'number') r = va - vb;
    else r = String(va).localeCompare(String(vb), 'hu');
    return r === 0 ? a.vrg_id.localeCompare(b.vrg_id) : r * dir;
  };
}

export { COLUMNS, DEFAULT_ORDER, column, cellText, createColumnState, comparator };
