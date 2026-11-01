/* Site checklists: three templates, ticked per job. Item wording is our own. */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { h, segmented } from '../ui/dom.js';
import { activeJob, jobBar, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'checklist', category: 'field', permissions: [], offline: true, name: { hu: 'Helyszíni ellenőrzőlista', en: 'Site checklist' } };

const ITEMS = { arrival: 5, isolation: 6, handover: 6 };

export const strings = {
  hu: {
    'check.arrival': 'Érkezés', 'check.isolation': 'Leválasztás', 'check.handover': 'Átadás',
    'check.progress': '{done}/{total} kész',
    'check.arrival.1': 'Megbeszéltem az ügyféllel, mi a mai feladat', 'check.arrival.2': 'Megvan a főkapcsoló és az elosztó helye',
    'check.arrival.3': 'A munkaterület szabad és megvilágított', 'check.arrival.4': 'A szerszám és a mérőműszer ép', 'check.arrival.5': 'Ismerem a menekülési utat',
    'check.isolation.1': 'Azonosítottam az áramkört', 'check.isolation.2': 'Leválasztottam a tápot', 'check.isolation.3': 'Biztosítottam a visszakapcsolás ellen, felirattal',
    'check.isolation.4': 'A feszültségmentességet ismert forráson próbált műszerrel ellenőriztem', 'check.isolation.5': 'Az érintésvédelem a munka alatt is megmarad', 'check.isolation.6': 'A munka végén mindenkit értesítettem a visszakapcsolásról',
    'check.handover.1': 'Minden kötődoboz fedele a helyén', 'check.handover.2': 'Az elosztó feliratozva', 'check.handover.3': 'Az ÁVK-k próbagombja működik',
    'check.handover.4': 'A mérések rögzítve', 'check.handover.5': 'A dokumentációt átadtam', 'check.handover.6': 'A munkaterületet rendben hagytam',
  },
  en: {
    'check.arrival': 'Arrival', 'check.isolation': 'Isolation', 'check.handover': 'Handover',
    'check.progress': '{done}/{total} done',
    'check.arrival.1': 'Agreed today\'s task with the client', 'check.arrival.2': 'Found the main switch and the board',
    'check.arrival.3': 'Work area is clear and lit', 'check.arrival.4': 'Tools and tester are undamaged', 'check.arrival.5': 'I know the way out',
    'check.isolation.1': 'Identified the circuit', 'check.isolation.2': 'Isolated the supply', 'check.isolation.3': 'Locked off against reconnection, with a notice',
    'check.isolation.4': 'Proved dead with a tester checked on a known source', 'check.isolation.5': 'Shock protection stays in place during the work', 'check.isolation.6': 'Told everyone before re-energising',
    'check.handover.1': 'All junction box lids are back on', 'check.handover.2': 'Board is labelled', 'check.handover.3': 'RCD test buttons work',
    'check.handover.4': 'Readings are recorded', 'check.handover.5': 'Documents handed over', 'check.handover.6': 'Work area left tidy',
  },
};

export function mount(root, ctx) {
  let tpl = 'arrival';
  const view = liveRender(root, ctx, async () => {
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const id = `${job.id}-${tpl}`;
    const rec = (await ctx.db.get('check', id)) ?? { id, jobId: job.id, tpl, done: {} };
    const total = ITEMS[tpl];
    const count = () => Object.values(rec.done).filter(Boolean).length;
    const progress = h('p.kpi', {}, h('b', { text: t('check.progress', { done: formatNumber(count()), total: formatNumber(total) }) }));
    const items = [];
    for (let i = 1; i <= total; i++) {
      items.push(h('label.tpl', {},
        h('input', {
          type: 'checkbox', checked: !!rec.done[i],
          onchange: async (e) => {
            rec.done[i] = e.target.checked;
            await ctx.db.put('check', rec);
            progress.firstChild.textContent = t('check.progress', { done: formatNumber(count()), total: formatNumber(total) });
          },
        }),
        h('span.tname.plain', { text: t(`check.${tpl}.${i}`) })));
    }
    return pageWrap(jobBar(job, ctx),
      segmented(Object.keys(ITEMS).map((k) => ({ value: k, label: t('check.' + k) })), tpl, (v) => { tpl = v; view.refresh(); }),
      panel(null, progress, h('div.checks', {}, items)));
  });
  return view.stop;
}
