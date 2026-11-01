/* Supplier items: the user's own list, plus a CSV they were given. No scraping, and no supplier
   name or logo in the UI (L4). The search link is a URL the user sets. */
import { t } from '../core/i18n.js';
import { formatDate, formatUnit } from '../core/format.js';
import { parseItems } from '../core/items.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { toast } from '../ui/feedback.js';
import { activeJob, addButton, deleteWithUndo, guide, listRow, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'supplier', category: 'field', permissions: ['files'], offline: true, name: { hu: 'Beszállítói tételek', en: 'Supplier items' } };

export const strings = {
  hu: {
    'supplier.items': 'Saját tételek', 'supplier.add': 'Új tétel', 'supplier.edit': 'Tétel szerkesztése', 'supplier.import': 'CSV importálása',
    'supplier.none': 'Még nincs tétel. Vedd fel a gyakori anyagaidat, vagy importáld a kapott árlistát.',
    'supplier.csvHint': 'Elválasztó: pontosvessző. Oszlopok: név;cikkszám;EAN;egység;ár;dátum. Csak hivatalos exportot vagy saját listát használj.',
    'supplier.imported': '{n} tétel importálva', 'supplier.search': 'Keresés a beszállítónál', 'supplier.searchUrl': 'Keresési cím, a kifejezés helye: {q}',
    'supplier.toJob': 'Munkához adás', 'supplier.added': 'Hozzáadva: {name}', 'supplier.private': 'Az árak csak ezen az eszközön vannak.',
    'supplier.noJob': 'Előbb válassz munkát a Munkalapon.',
    'supplier.f.name': 'Megnevezés', 'supplier.f.code': 'Cikkszám', 'supplier.f.ean': 'EAN', 'supplier.f.unit': 'Egység', 'supplier.f.price': 'Utolsó ár', 'supplier.f.date': 'Ár dátuma',
  },
  en: {
    'supplier.items': 'My items', 'supplier.add': 'New item', 'supplier.edit': 'Edit item', 'supplier.import': 'Import CSV',
    'supplier.none': 'No items yet. Add your frequent parts, or import a price list you were given.',
    'supplier.csvHint': 'Separator: semicolon. Columns: name;code;EAN;unit;price;date. Use official exports or your own lists only.',
    'supplier.imported': '{n} items imported', 'supplier.search': 'Search at supplier', 'supplier.searchUrl': 'Search address, with {q} for the term',
    'supplier.toJob': 'Add to job', 'supplier.added': 'Added: {name}', 'supplier.private': 'Prices stay on this device.',
    'supplier.noJob': 'Pick a job on the Field job page first.',
    'supplier.f.name': 'Name', 'supplier.f.code': 'Code', 'supplier.f.ean': 'EAN', 'supplier.f.unit': 'Unit', 'supplier.f.price': 'Last price', 'supplier.f.date': 'Price date',
  },
};

const fields = () => [
  { key: 'name', label: t('supplier.f.name') }, { key: 'code', label: t('supplier.f.code') }, { key: 'ean', label: t('supplier.f.ean') },
  { key: 'unit', label: t('supplier.f.unit') }, { key: 'price', label: t('supplier.f.price'), type: 'number', unit: 'Ft' }, { key: 'date', label: t('supplier.f.date'), type: 'date' },
];


export function mount(root, ctx) {
  let query = '';
  const view = liveRender(root, ctx, async () => {
    const items = await ctx.db.list('item');
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = items.filter((i) => words.every((w) => `${i.name} ${i.code} ${i.ean}`.toLowerCase().includes(w)));
    const edit = (i) => recordSheet({
      title: t(i ? 'supplier.edit' : 'supplier.add'), fields: fields(), value: i ?? {},
      onSave: async (v) => { await ctx.db.put('item', v); await view.refresh(); },
      onDelete: i ? () => deleteWithUndo(ctx, 'item', i, i.name, view.refresh) : null,
    });
    const toJob = async (i) => {
      const job = await activeJob(ctx);
      if (!job) { toast(t('supplier.noJob'), { error: true }); return; }
      await ctx.db.put('material', { jobId: job.id, itemId: i.id, name: i.name, unit: i.unit, price: i.price, priceDate: i.date, qty: 1 });
      toast(t('supplier.added', { name: i.name }));
    };
    const url = ctx.store.pageSetting('supplier', 'searchUrl') ?? '';
    const importer = h('input', {
      type: 'file', accept: '.csv,text/csv', id: 'itemsIn', hidden: true,
      onchange: async (e) => {
        const rows = parseItems(await e.target.files[0].text());
        for (const r of rows) await ctx.db.put('item', r);
        toast(t('supplier.imported', { n: rows.length }));
        await view.refresh();
      },
    });
    const searchBox = h('input.input', {
      type: 'search', value: query, 'aria-label': t('common.search'), placeholder: t('common.search'),
      onchange: (e) => { query = e.target.value; view.refresh(); },
    });
    return pageWrap(
      panel(t('supplier.items'),
        searchBox,
        hits.map((i) => listRow({
          title: i.name,
          sub: [i.code, i.price != null ? formatUnit(i.price, 'Ft') : null, i.date ? formatDate(new Date(i.date)) : null].filter(Boolean).join(' · '),
          onclick: () => edit(i),
          extra: h('button.btn', { type: 'button', text: t('supplier.toJob'), onclick: () => toJob(i) }),
        })),
        items.length && !hits.length ? guide(t('common.noResults')) : null,
        !items.length ? guide(t('supplier.none')) : null,
        h('div.btn-row', {},
          addButton(t('supplier.add'), () => edit(null)),
          importer,
          h('label.btn.filebtn', { for: 'itemsIn', text: t('supplier.import') }),
          url.includes('{q}') && query ? h('a.btn', { href: url.replace('{q}', encodeURIComponent(query)), target: '_blank', rel: 'noopener', text: t('supplier.search') }) : null),
        h('p.hint', { text: t('supplier.csvHint') }),
        h('p.hint', { text: t('supplier.private') })),
      panel(t('supplier.search'),
        h('label.field', {},
          h('span.k', { text: t('supplier.searchUrl') }),
          h('input.input', { type: 'url', value: url, onchange: (e) => { ctx.store.setPageSetting('supplier', 'searchUrl', e.target.value.trim()); view.refresh(); } }))));
  });
  return view.stop;
}
