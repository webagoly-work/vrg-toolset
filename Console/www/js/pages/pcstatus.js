/* PC status: mirrors the ServiceKit job and playbook from the bridge. The bridge's client field is
   not kept, so a client name never shows here. */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { h } from '../ui/dom.js';
import { guide, liveRender, pageWrap, panel } from './shared.js';
import { bridgePanel } from './servicekit-shared.js';

export const manifest = { id: 'pcstatus', category: 'servicekit', permissions: ['bridge'], offline: false, name: { hu: 'PC-állapot', en: 'PC status mirror' } };

export const strings = {
  hu: { 'pc.title': 'Állapot', 'pc.none': 'Nincs futó ServiceKit-munka.', 'pc.computer': 'Gép', 'pc.playbook': 'Forgatókönyv', 'pc.progress': '{done}/{total}', 'pc.step': 'Lépés' },
  en: { 'pc.title': 'Status', 'pc.none': 'No ServiceKit job is running.', 'pc.computer': 'Computer', 'pc.playbook': 'Playbook', 'pc.progress': '{done}/{total}', 'pc.step': 'Step' },
};

export function mount(root, ctx) {
  const view = liveRender(root, ctx, async () => {
    const { job, pb, step, status } = ctx.bridge.state;
    const rows = [
      job?.computer ? [t('pc.computer'), job.computer] : null,
      pb ? [t('pc.playbook'), `${pb.title} · ${t('pc.progress', { done: formatNumber(pb.done), total: formatNumber(pb.total) })}`] : null,
      step?.text ? [t('pc.step'), step.text] : null,
    ].filter(Boolean);
    return pageWrap(
      bridgePanel(ctx),
      status === 'on' ? panel(t('pc.title'), rows.length
        ? h('dl.kv', {}, rows.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))))
        : guide(t('pc.none'))) : null);
  });
  const off = ctx.bridge.subscribe(() => view.refresh());
  return () => { off(); view.stop(); };
}
