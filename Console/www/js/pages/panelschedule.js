/* Panel schedule: the ways of a board for the current job. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { activeJob, addButton, deleteWithUndo, downloadCsv, guide, jobBar, listRow, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'panel', category: 'field', permissions: [], offline: true, name: { hu: 'Elosztó áramkörjegyzék', en: 'Panel schedule' } };

export const strings = {
  hu: {
    'panel.ways': 'Áramkörök', 'panel.add': 'Új áramkör', 'panel.edit': 'Áramkör szerkesztése',
    'panel.none': 'Még nincs áramkör. Vidd fel az elosztó első kismegszakítóját.',
    'panel.f.board': 'Elosztó', 'panel.f.way': 'Hely', 'panel.f.label': 'Áramkör neve', 'panel.f.device': 'Védelem, például B16',
    'panel.f.rcd': 'ÁVK-csoport', 'panel.f.cable': 'Vezeték, például NYM-J 3x2,5', 'panel.f.note': 'Megjegyzés',
  },
  en: {
    'panel.ways': 'Circuits', 'panel.add': 'New circuit', 'panel.edit': 'Edit circuit',
    'panel.none': 'No circuits yet. Enter the first breaker of the board.',
    'panel.f.board': 'Board', 'panel.f.way': 'Way', 'panel.f.label': 'Circuit name', 'panel.f.device': 'Device, for example B16',
    'panel.f.rcd': 'RCD group', 'panel.f.cable': 'Cable, for example NYM-J 3x2.5', 'panel.f.note': 'Note',
  },
};

const fields = () => [
  { key: 'board', label: t('panel.f.board') }, { key: 'way', label: t('panel.f.way') },
  { key: 'label', label: t('panel.f.label') }, { key: 'device', label: t('panel.f.device') },
  { key: 'rcd', label: t('panel.f.rcd') }, { key: 'cable', label: t('panel.f.cable') },
  { key: 'note', label: t('panel.f.note'), type: 'textarea' },
];

export function mount(root, ctx) {
  const view = liveRender(root, ctx, async () => {
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const ways = await ctx.db.list('panel', (r) => r.jobId === job.id);
    ways.sort((a, b) => String(a.board ?? '').localeCompare(String(b.board ?? '')) || String(a.way ?? '').localeCompare(String(b.way ?? ''), undefined, { numeric: true }));
    const edit = (w) => recordSheet({
      title: t(w ? 'panel.edit' : 'panel.add'), fields: fields(),
      value: w ?? { board: ways.at(-1)?.board ?? '' },
      onSave: async (v) => { await ctx.db.put('panel', { ...v, jobId: job.id }); await view.refresh(); },
      onDelete: w ? () => deleteWithUndo(ctx, 'panel', w, w.label || t('panel.f.label'), view.refresh) : null,
    });
    return pageWrap(jobBar(job, ctx), panel(t('panel.ways'),
      ways.length ? ways.map((w) => listRow({
        title: [w.way, w.label].filter(Boolean).join(' · ') || '—',
        sub: [w.board, w.device, w.rcd, w.cable].filter(Boolean).join(' · '),
        onclick: () => edit(w),
      })) : guide(t('panel.none')),
      h('div.btn-row', {},
        addButton(t('panel.add'), () => edit(null)),
        ways.length ? addButton(t('common.exportCsv'), () => downloadCsv(`aramkorok-${job.id}.csv`, ['board', 'way', 'circuit', 'device', 'rcd', 'cable', 'note'], ways.map((w) => [w.board, w.way, w.label, w.device, w.rcd, w.cable, w.note]))) : null)));
  });
  return view.stop;
}
