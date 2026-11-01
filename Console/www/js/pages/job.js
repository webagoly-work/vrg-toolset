/* Field job: the object everything else hangs on. Client details stay on this device. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { confirmDialog, toast } from '../ui/feedback.js';
import { addButton, guide, JOB_COLLECTIONS, listRow, liveRender, pageWrap, panel, download } from './shared.js';

const STATUSES = ['planned', 'active', 'testing', 'done'];
const EARTHING = ['', 'TN-S', 'TN-C', 'TN-C-S', 'TT', 'IT'];

export const manifest = { id: 'job', category: 'field', permissions: [], offline: true, name: { hu: 'Munkalap', en: 'Field job' } };

export const strings = {
  hu: {
    'job.jobs': 'Munkák', 'job.new': 'Új munka', 'job.edit': 'Munka szerkesztése',
    'job.empty': 'Még nincs munka. Hozd létre az elsőt, és a mérések, fotók és anyagok ehhez kapcsolódnak.',
    'job.privacy': 'Az ügyféladatok csak ezen az eszközön vannak, és a munkával együtt törölhetők.',
    'job.current': 'Aktuális', 'job.select': 'Kiválasztás', 'job.navigate': 'Navigáció', 'job.exportJson': 'Munka exportálása JSON-ba',
    'job.f.name': 'Munka neve', 'job.f.client': 'Ügyfél', 'job.f.site': 'Helyszín címe', 'job.f.scope': 'Feladat',
    'job.f.contact': 'Kapcsolattartó', 'job.f.access': 'Bejutás, megjegyzések', 'job.f.earthing': 'Hálózati rendszer',
    'job.f.status': 'Állapot', 'job.f.quote': 'várlerÁron azonosító',
    'job.st.planned': 'Tervezett', 'job.st.active': 'Folyamatban', 'job.st.testing': 'Mérés', 'job.st.done': 'Kész',
    'job.confirm.title': 'Munka törlése',
    'job.confirm.body': 'A(z) „{name}” munka törlődik a méréseivel, fotóival, idejével és anyagaival együtt. {seconds} másodpercig visszavonható.',
  },
  en: {
    'job.jobs': 'Jobs', 'job.new': 'New job', 'job.edit': 'Edit job',
    'job.empty': 'No jobs yet. Create the first one; readings, photos and materials attach to it.',
    'job.privacy': 'Client details stay on this device and can be deleted with the job.',
    'job.current': 'Current', 'job.select': 'Select', 'job.navigate': 'Navigate', 'job.exportJson': 'Export job as JSON',
    'job.f.name': 'Job name', 'job.f.client': 'Client', 'job.f.site': 'Site address', 'job.f.scope': 'Scope',
    'job.f.contact': 'Contact', 'job.f.access': 'Access notes', 'job.f.earthing': 'Earthing system',
    'job.f.status': 'Status', 'job.f.quote': 'várlerÁron reference',
    'job.st.planned': 'Planned', 'job.st.active': 'In progress', 'job.st.testing': 'Testing', 'job.st.done': 'Done',
    'job.confirm.title': 'Delete job',
    'job.confirm.body': 'The job "{name}" will be deleted with its readings, photos, time and materials. You can undo for {seconds} seconds.',
  },
};

const fields = () => [
  { key: 'name', label: t('job.f.name') },
  { key: 'client', label: t('job.f.client') },
  { key: 'site', label: t('job.f.site') },
  { key: 'scope', label: t('job.f.scope'), type: 'textarea' },
  { key: 'contact', label: t('job.f.contact') },
  { key: 'access', label: t('job.f.access'), type: 'textarea' },
  { key: 'earthing', label: t('job.f.earthing'), type: 'select', options: EARTHING.map((v) => ({ value: v, label: v })) },
  { key: 'status', label: t('job.f.status'), type: 'select', options: STATUSES.map((v) => ({ value: v, label: t('job.st.' + v) })) },
  { key: 'quote', label: t('job.f.quote') },
];

async function childrenOf(ctx, jobId) {
  const out = [];
  for (const coll of JOB_COLLECTIONS) {
    for (const rec of await ctx.db.list(coll, (r) => r.jobId === jobId)) out.push({ coll, rec });
  }
  return out;
}

async function removeJob(ctx, job, refresh) {
  const yes = await confirmDialog({
    title: t('job.confirm.title'), body: t('job.confirm.body', { name: job.name, seconds: 10 }),
    ok: t('common.delete'), glove: ctx.store.state.settings.glove,
  });
  if (!yes) return;
  const kids = await childrenOf(ctx, job.id);
  const wasActive = ctx.store.state.settings.activeJob === job.id;
  for (const k of kids) await ctx.db.del(k.coll, k.rec.id);
  await ctx.db.del('job', job.id);
  if (wasActive) ctx.store.setSetting('activeJob', null);
  await refresh();
  toast(t('common.deleted', { name: job.name }), {
    ms: 10000,
    action: {
      label: t('common.undo'),
      run: async () => {
        await ctx.db.restore('job', job);
        for (const k of kids) await ctx.db.restore(k.coll, k.rec);
        if (wasActive) ctx.store.setSetting('activeJob', job.id);
        await refresh();
      },
    },
  });
}

export function mount(root, ctx) {
  const edit = (job) => recordSheet({
    title: t(job ? 'job.edit' : 'job.new'),
    fields: fields(),
    value: job ?? { status: 'planned' },
    onSave: async (v) => {
      const rec = await ctx.db.put('job', { ...v, name: v.name || t('job.new') });
      if (!job) ctx.store.setSetting('activeJob', rec.id);
      await view.refresh();
    },
    onDelete: job ? () => removeJob(ctx, job, view.refresh) : null,
  });

  const view = liveRender(root, ctx, async () => {
    const jobs = await ctx.db.list('job');
    const active = ctx.store.state.settings.activeJob;
    const current = jobs.find((j) => j.id === active);
    const select = (j) => { ctx.store.setSetting('activeJob', j.id); view.refresh(); };
    return pageWrap(
      current && panel(t('job.current'),
        h('div.kpi', {}, h('b', { text: current.name }), h('small', { text: t('job.st.' + (current.status ?? 'planned')) })),
        h('div.btn-row', {},
          addButton(t('common.edit'), () => edit(current)),
          current.site ? h('a.btn', { href: 'geo:0,0?q=' + encodeURIComponent(current.site), text: t('job.navigate') }) : null,
          addButton(t('job.exportJson'), async () => {
            const kids = await childrenOf(ctx, current.id);
            const safe = kids.filter((k) => k.coll !== 'photo').map((k) => ({ collection: k.coll, ...k.rec }));
            download(`job-${current.id}.json`, JSON.stringify({ job: current, records: safe }, null, 2), 'application/json');
          }))),
      panel(t('job.jobs'),
        jobs.length ? jobs.map((j) => listRow({
          title: j.name,
          sub: t('job.st.' + (j.status ?? 'planned')),
          onclick: () => select(j),
          chip: j.id === active ? h('span.chip.on', { text: t('job.current') }) : null,
        })) : guide(t('job.empty')),
        addButton(t('job.new'), () => edit(null)),
        h('p.hint', { text: t('job.privacy') })));
  });
  return view.stop;
}
