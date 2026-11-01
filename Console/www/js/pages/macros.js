/* Macro pad: the curated macros from bridge/macros.json. Dangerous ones confirm first. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { confirmDialog, toast } from '../ui/feedback.js';
import { guide, liveRender, pageWrap, panel } from './shared.js';
import { bridgePanel } from './servicekit-shared.js';

export const manifest = { id: 'macros', category: 'servicekit', permissions: ['bridge'], offline: false, name: { hu: 'Makrók', en: 'Macro pad' } };

export const strings = {
  hu: { 'macro.title': 'Makrók', 'macro.none': 'A makrók a PC-híd kapcsolódása után jelennek meg.', 'macro.danger': 'Megerősítést kér', 'macro.confirm': 'Biztosan futtatod ezt: {name}?' },
  en: { 'macro.title': 'Macros', 'macro.none': 'Macros appear once the PC bridge is connected.', 'macro.danger': 'Asks to confirm', 'macro.confirm': 'Run this now: {name}?' },
};

export function mount(root, ctx) {
  const view = liveRender(root, ctx, async () => {
    const { macros, allowRun } = ctx.bridge.state;
    const press = async (m) => {
      if (m.danger) {
        const yes = await confirmDialog({ title: t('bridge.confirmTitle'), body: t('macro.confirm', { name: m.label }), ok: t('bridge.confirmOk'), glove: ctx.store.state.settings.glove });
        if (!yes) return;
      }
      const r = await ctx.bridge.runMacro(m.id, m.danger);
      toast(t(r.ok ? 'bridge.ran' : 'bridge.failed', { detail: r.detail || m.label }), { error: !r.ok, ms: 6000 });
    };
    return pageWrap(
      bridgePanel(ctx),
      panel(t('macro.title'),
        macros.length ? h('div.macros', {}, macros.map((m) => h(m.danger ? 'button.btn.danger.macro' : 'button.btn.macro', { type: 'button', disabled: !allowRun, onclick: () => press(m) },
          m.label, m.danger ? h('small', { text: t('macro.danger') }) : null))) : guide(t('macro.none'))));
  });
  const off = ctx.bridge.subscribe(() => view.refresh());
  return () => { off(); view.stop(); };
}
