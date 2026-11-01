/* Job materials: lines added from the item list, or typed by hand. */
import { t } from '../core/i18n.js';
import { formatNumber, formatUnit } from '../core/format.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { activeJob, addButton, deleteWithUndo, downloadCsv, guide, jobBar, listRow, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'materials', category: 'field', permissions: [], offline: true, name: { hu: 'Munka anyaglistája', en: 'Job materials list' } };

export const strings = {
  hu: {
    'materials.lines': 'Anyagok', 'materials.add': 'Új sor', 'materials.edit': 'Sor szerkesztése', 'materials.total': 'Összesen: {sum}',
    'materials.none': 'Még üres. Adj hozzá sorokat, vagy küldj tételeket a Beszállítói tételek oldalról.',
    'materials.f.name': 'Megnevezés', 'materials.f.qty': 'Mennyiség', 'materials.f.unit': 'Egység', 'materials.f.price': 'Egységár',
  },
  en: {
    'materials.lines': 'Materials', 'materials.add': 'New line', 'materials.edit': 'Edit line', 'materials.total': 'Total: {sum}',
    'materials.none': 'Empty so far. Add lines, or send items from the Supplier items page.',
    'materials.f.name': 'Name', 'materials.f.qty': 'Quantity', 'materials.f.unit': 'Unit', 'materials.f.price': 'Unit price',
  },
};

export function mount(root, ctx) {
  const view = liveRender(root, ctx, async () => {
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const lines = await ctx.db.list('material', (r) => r.jobId === job.id);
    const sum = lines.reduce((s, l) => s + (l.qty ?? 0) * (l.price ?? 0), 0);
    const edit = (l) => recordSheet({
      title: t(l ? 'materials.edit' : 'materials.add'),
      fields: [
        { key: 'name', label: t('materials.f.name') }, { key: 'qty', label: t('materials.f.qty'), type: 'number' },
        { key: 'unit', label: t('materials.f.unit') }, { key: 'price', label: t('materials.f.price'), type: 'number', unit: 'Ft' },
      ],
      value: l ?? { qty: 1 },
      onSave: async (v) => { await ctx.db.put('material', { ...v, jobId: job.id }); await view.refresh(); },
      onDelete: l ? () => deleteWithUndo(ctx, 'material', l, l.name || t('materials.f.name'), view.refresh) : null,
    });
    return pageWrap(jobBar(job, ctx), panel(t('materials.lines'),
      lines.length ? h('p.kpi', {}, h('b', { text: t('materials.total', { sum: formatUnit(sum, 'Ft', 0) }) })) : guide(t('materials.none')),
      lines.map((l) => listRow({ title: l.name || '—', sub: [formatNumber(l.qty ?? 0), l.unit, l.price != null ? formatUnit(l.price, 'Ft') : null].filter(Boolean).join(' · '), onclick: () => edit(l) })),
      h('div.btn-row', {},
        addButton(t('materials.add'), () => edit(null)),
        lines.length ? addButton(t('common.exportCsv'), () => downloadCsv(`anyagok-${job.id}.csv`, ['name', 'qty', 'unit', 'price'], lines.map((l) => [l.name, l.qty, l.unit, l.price]))) : null)));
  });
  return view.stop;
}
