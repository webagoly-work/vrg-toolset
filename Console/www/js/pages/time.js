/* Time tracker: start and stop per job, for yourself only. No location is ever read (L3). */
import { t } from '../core/i18n.js';
import { formatDateTime, formatNumber } from '../core/format.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { activeJob, addButton, deleteWithUndo, guide, jobBar, listRow, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'time', category: 'field', permissions: [], offline: true, name: { hu: 'Időmérés', en: 'Time tracker' } };

export const strings = {
  hu: {
    'time.start': 'Indítás', 'time.stop': 'Leállítás', 'time.entries': 'Bejegyzések', 'time.total': 'Összesen: {hours} óra',
    'time.running': 'Fut', 'time.none': 'Még nincs bejegyzés. Az indítással kezdődik a mérés.', 'time.edit': 'Bejegyzés szerkesztése',
    'time.f.start': 'Kezdés', 'time.f.end': 'Vége', 'time.f.note': 'Megjegyzés', 'time.privacy': 'Csak a saját időd. Helyadatot nem használ.',
  },
  en: {
    'time.start': 'Start', 'time.stop': 'Stop', 'time.entries': 'Entries', 'time.total': 'Total: {hours} hours',
    'time.running': 'Running', 'time.none': 'No entries yet. Start begins the timing.', 'time.edit': 'Edit entry',
    'time.f.start': 'Start', 'time.f.end': 'End', 'time.f.note': 'Note', 'time.privacy': 'Your own time only. Location is never used.',
  },
};

const pad = (n) => String(n).padStart(2, '0');
const toLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

export function mount(root, ctx) {
  let tick = null;
  const view = liveRender(root, ctx, async () => {
    clearInterval(tick);
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const entries = await ctx.db.list('time', (r) => r.jobId === job.id);
    const running = entries.find((e) => e.end == null);
    const hours = entries.filter((e) => e.end != null).reduce((sum, e) => sum + (e.end - e.start), 0) / 3600000;
    const display = h('div.bignum', { text: running ? clock(Date.now() - running.start) : clock(0) });
    if (running) tick = setInterval(() => { display.textContent = clock(Date.now() - running.start); }, 1000);
    const edit = (e) => recordSheet({
      title: t('time.edit'),
      fields: [{ key: 'start', label: t('time.f.start'), type: 'datetime-local' }, { key: 'end', label: t('time.f.end'), type: 'datetime-local' }, { key: 'note', label: t('time.f.note') }],
      value: { ...e, start: toLocal(e.start), end: e.end == null ? '' : toLocal(e.end) },
      onSave: async (v) => {
        await ctx.db.put('time', { ...e, note: v.note, start: Date.parse(v.start) || e.start, end: v.end ? Date.parse(v.end) : null });
        await view.refresh();
      },
      onDelete: () => deleteWithUndo(ctx, 'time', e, formatDateTime(new Date(e.start)), view.refresh),
    });
    return pageWrap(jobBar(job, ctx),
      panel(null, display,
        h('button.btn.primary', {
          type: 'button', text: t(running ? 'time.stop' : 'time.start'),
          onclick: async () => {
            if (running) await ctx.db.put('time', { ...running, end: Date.now() });
            else await ctx.db.put('time', { jobId: job.id, start: Date.now(), end: null });
            await view.refresh();
          },
        }),
        h('p.hint', { text: t('time.privacy') })),
      panel(t('time.entries'),
        h('p.kpi', {}, h('b', { text: t('time.total', { hours: formatNumber(hours, 2) }) })),
        entries.length ? entries.slice().reverse().map((e) => listRow({
          title: formatDateTime(new Date(e.start)),
          sub: e.end == null ? t('time.running') : clock(e.end - e.start) + (e.note ? ' · ' + e.note : ''),
          onclick: () => edit(e),
        })) : guide(t('time.none'))));
  });
  return () => { clearInterval(tick); view.stop(); };
}
