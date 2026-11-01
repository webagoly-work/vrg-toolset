/* Commands: the ServiceKit CMD and PowerShell database, offline. Copy always works; Run on PC needs
   a connected bridge started with --allow-run, and shows the exact command first. */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { h } from '../ui/dom.js';
import { confirmDialog, toast } from '../ui/feedback.js';
import { guide, liveRender, pageWrap, panel } from './shared.js';
import { fold, loadKit, pick } from './servicekit-shared.js';

export const manifest = { id: 'commands', category: 'servicekit', permissions: ['clipboard', 'bridge'], offline: true, name: { hu: 'Parancsok', en: 'Commands' } };

export const strings = {
  hu: {
    'cmd.title': 'Parancsok', 'cmd.count': '{n} parancs', 'cmd.all': 'Mind', 'cmd.vars': 'Változók', 'cmd.varsHint': 'Ezek a parancsokban szereplő helyőrzőket töltik ki.',
    'cmd.caution': 'Óvatosan', 'cmd.admin': 'Rendszergazda',
  },
  en: {
    'cmd.title': 'Commands', 'cmd.count': '{n} commands', 'cmd.all': 'All', 'cmd.vars': 'Variables', 'cmd.varsHint': 'These fill in the placeholders in the commands.',
    'cmd.caution': 'Caution', 'cmd.admin': 'Admin',
  },
};

const PAGE = 40;

export function mount(root, ctx) {
  let query = '';
  let cat = '';
  let shown = PAGE;
  const view = liveRender(root, ctx, async () => {
    const data = await loadKit('commands', 'KIT_COMMANDS');
    const saved = ctx.store.pageSetting('commands', 'vars') ?? {};
    const fill = (x) => x.replace(/\{(\w+)\}/g, (m, k) => saved[k] ?? data.vars.find((v) => v.k === k)?.d ?? m);
    const words = fold(query).split(/\s+/).filter(Boolean);
    const hits = data.commands.filter((c) => (!cat || c.c === cat) && words.every((w) => fold(`${c.x} ${c.hu} ${c.en}`).includes(w)));
    const list = h('div.list');
    const run = async (text, kind) => {
      const yes = await confirmDialog({ title: t('bridge.confirmTitle'), body: text, ok: t('bridge.confirmOk'), glove: ctx.store.state.settings.glove });
      if (!yes) return;
      const r = await ctx.bridge.runCommand(text, kind);
      toast(t(r.ok ? 'bridge.ran' : 'bridge.failed', { detail: r.detail }), { error: !r.ok, ms: 6000 });
    };
    const canRun = ctx.bridge.state.status === 'on' && ctx.bridge.state.allowRun;
    const row = (c) => {
      const text = fill(c.x);
      return h('div.cmd', {},
        h('code', { text }),
        h('p', { text: pick(c) }),
        h('div.btn-row', {},
          h('button.btn', { type: 'button', text: t('common.copy'), onclick: async () => { await navigator.clipboard.writeText(text); toast(t('common.copied')); } }),
          canRun ? h('button.btn', { type: 'button', text: t('bridge.run'), onclick: () => run(text, c.s === 'ps' ? 'ps' : 'cmd') }) : null));
    };
    const paint = () => {
      list.replaceChildren(...hits.slice(0, shown).map(row));
      more.hidden = hits.length <= shown;
    };
    const more = h('button.btn', { type: 'button', text: t('common.more'), onclick: () => { shown += PAGE; paint(); } });
    paint();
    return pageWrap(
      panel(t('cmd.title'),
        h('input.input', { type: 'search', value: query, 'aria-label': t('common.search'), placeholder: t('common.search'), onchange: (e) => { query = e.target.value; shown = PAGE; view.refresh(); } }),
        h('select.input', { 'aria-label': t('stub.category'), onchange: (e) => { cat = e.target.value; shown = PAGE; view.refresh(); } },
          h('option', { value: '', text: t('cmd.all') }),
          data.categories.map((c) => h('option', { value: c.id, text: pick(c), selected: c.id === cat }))),
        h('p.hint', { text: t('cmd.count', { n: formatNumber(hits.length) }) })),
      hits.length ? list : guide(t('common.noResults')),
      more,
      panel(t('cmd.vars'),
        h('p.hint', { text: t('cmd.varsHint') }),
        data.vars.map((v) => h('label.field', {}, h('span.k', { text: pick(v) }),
          h('input.input', {
            type: 'text', value: saved[v.k] ?? v.d,
            onchange: (e) => { ctx.store.setPageSetting('commands', 'vars', { ...saved, [v.k]: e.target.value }); view.refresh(); },
          })))));
  });
  return view.stop;
}
