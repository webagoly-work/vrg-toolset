/* Playbook runner. Works through the steps by hand; the automated checks run on the PC in the
   ServiceKit Dashboard, so here they are marked as such and ticked off when done. */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { h } from '../ui/dom.js';
import { listRow, liveRender, pageWrap, panel } from './shared.js';
import { loadKit, pick } from './servicekit-shared.js';

export const manifest = { id: 'playbooks', category: 'servicekit', permissions: [], offline: true, name: { hu: 'Hibakeresési forgatókönyvek', en: 'Playbook runner' } };

export const strings = {
  hu: {
    'pb.title': 'Forgatókönyvek', 'pb.back': 'Vissza a listához', 'pb.progress': '{done}/{total} lépés', 'pb.minutes': 'kb. {n} perc',
    'pb.kind.check': 'PC: ellenőrzés', 'pb.kind.action': 'PC: művelet', 'pb.kind.manual': 'Kézi lépés', 'pb.admin': 'Rendszergazda', 'pb.reset': 'Újrakezdés',
    'pb.pcNote': 'A PC-s lépéseket a ServiceKit Dashboard futtatja. Itt azt követed, hol tartasz.',
  },
  en: {
    'pb.title': 'Playbooks', 'pb.back': 'Back to the list', 'pb.progress': '{done}/{total} steps', 'pb.minutes': 'about {n} min',
    'pb.kind.check': 'PC: check', 'pb.kind.action': 'PC: action', 'pb.kind.manual': 'Manual step', 'pb.admin': 'Admin', 'pb.reset': 'Start over',
    'pb.pcNote': 'The ServiceKit Dashboard runs the PC steps. Here you keep track of where you are.',
  },
};

export function mount(root, ctx) {
  let open = null;
  const view = liveRender(root, ctx, async () => {
    const data = await loadKit('playbooks', 'KIT_PLAYBOOKS');
    if (!open) {
      return pageWrap(panel(t('pb.title'), data.playbooks.map((p) => listRow({
        title: pick(p.title),
        sub: [t('pb.minutes', { n: formatNumber(p.minutes) }), pick(p.desc)].join(' · '),
        onclick: () => { open = p.id; view.refresh(); },
      }))));
    }
    const p = data.playbooks.find((x) => x.id === open);
    const done = ctx.store.pageSetting('playbooks', p.id) ?? {};
    const count = () => Object.values(done).filter(Boolean).length;
    const progress = h('b', { text: t('pb.progress', { done: formatNumber(count()), total: formatNumber(p.steps.length) }) });
    return pageWrap(
      h('button.btn', { type: 'button', text: t('pb.back'), onclick: () => { open = null; view.refresh(); } }),
      h('h2.title', { text: pick(p.title) }),
      panel(null,
        h('p.kpi', {}, progress),
        p.steps.map((s, i) => h('label.tpl', {},
          h('input', {
            type: 'checkbox', checked: !!done[i],
            onchange: (e) => {
              done[i] = e.target.checked;
              ctx.store.setPageSetting('playbooks', p.id, done);
              progress.textContent = t('pb.progress', { done: formatNumber(count()), total: formatNumber(p.steps.length) });
            },
          }),
          h('span.tname.plain', { text: pick(s.title) }),
          h('span.chip', { text: t('pb.kind.' + s.kind) }))),
        h('p.hint', { text: t('pb.pcNote') }),
        h('button.btn', { type: 'button', text: t('pb.reset'), onclick: () => { ctx.store.setPageSetting('playbooks', p.id, {}); view.refresh(); } })));
  });
  return view.stop;
}
