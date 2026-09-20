// The catalogue feature: filters + table + detail drawer, wired together.
// Talks to core and to the bus only.

import { el } from '../../ui/dom.js';
import { createColumnState } from './columns.js';
import { createTable } from './table.js';
import { createFilters } from './filters.js';
import { createDetail } from './detail.js';

function createCatalog(opts) {
  const { store, bus, userdata, lists } = opts;
  // onListChange lets an interactive cell announce a write without knowing who
  // is listening — the table repaints, and the list panel hears it on the bus.
  const ctx = {
    vendors: store.vendors,
    lists,
    onListChange: id => { table.refresh(); bus.emit('lists:changed', { id }); }
  };
  const columns = createColumnState(opts.columnState);

  const status = el('p', { class: 'note status' });

  const table = createTable({
    columns, ctx,
    onSelect: id => { detail.show(id); bus.emit('item:selected', { id }); }
  });

  const detail = createDetail({
    store, userdata, lists,
    onEdit: id => {
      store.remerge(id);
      detail.show(id);
      apply(last);
      filters.refreshTree();
      bus.emit('userdata:changed', { id });
      bus.emit('lists:changed', { id });
    },
    onClose: () => bus.emit('item:deselected', {})
  });

  const filters = createFilters({
    store, columns,
    onChange: f => apply(f),
    onVendorChange: () => {
      table.refresh();
      if (detail.isOpen() && currentId()) detail.show(currentId());
      bus.emit('vendor:changed', { id: store.vendors.selectedId() });
      apply(last);
    },
    onColumnsChange: () => {
      table.refresh();
      bus.emit('columns:changed', columns.serialize());
    }
  });

  let last = { ...filters.state };
  let shown = 0;
  let selected = null;
  bus.on('item:selected', e => { selected = e.id; });
  bus.on('item:deselected', () => { selected = null; });
  const currentId = () => selected;

  function apply(f) {
    last = f || last;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const rows = store.query({
      text: last.text,
      fo: last.fo || undefined,
      al: last.al || undefined,
      brand: last.brand || undefined,
      missing: last.missing || undefined,
      hasPrice: last.hasPrice,
      kedvenc: last.kedvenc || undefined,
      sort: null                       // the table sorts by its active column
    });
    table.setRows(rows);
    shown = rows.length;
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

    const vendor = store.vendors.selectedVendor();
    status.textContent =
      `${shown} / ${store.items.length} tétel · ${ms.toFixed(0)} ms · ` +
      (vendor ? `beszállítói oszlopok: ${vendor.nev}` : 'semleges nézet — beszállítói adat nem látszik');
    bus.emit('catalog:rendered', { shown, total: store.items.length, ms });
    bus.emit('filters:changed', { ...last });
  }

  /** Re-read everything after a wholesale userdata change (import / reset). */
  function reload() {
    store.remergeAll();
    filters.refreshTree();
    table.refresh();
    if (detail.isOpen() && currentId()) detail.show(currentId());
    apply(last);
  }

  const root = el('div', { class: 'catalog-layout' }, [
    filters.root,
    el('div', { class: 'panel grow-panel' }, [table.root, status]),
    detail.root
  ]);

  apply(filters.state);

  return {
    root, apply, reload,
    refreshRows: () => table.refresh(),
    openItem: id => { detail.show(id); bus.emit('item:selected', { id }); },
    focusSearch: filters.focusSearch,
    setFilters: filters.restore,
    columns, table, detail,
    shownCount: () => shown
  };
}

export { createCatalog };
