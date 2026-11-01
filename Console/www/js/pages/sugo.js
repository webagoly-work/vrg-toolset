/* Súgó: the offline ServiceKit troubleshooting database. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { guide, listRow, liveRender, pageWrap, panel } from './shared.js';
import { fold, loadKit, pick } from './servicekit-shared.js';

export const manifest = { id: 'sugo', category: 'servicekit', permissions: [], offline: true, name: { hu: 'Súgó', en: 'Súgó' } };

export const strings = {
  hu: { 'sugo.title': 'Hibaelhárítás', 'sugo.symptoms': 'Tünetek', 'sugo.steps': 'Lépések', 'sugo.warn': 'Figyelem', 'sugo.tools': 'Eszközök', 'sugo.back': 'Vissza a listához' },
  en: { 'sugo.title': 'Troubleshooting', 'sugo.symptoms': 'Symptoms', 'sugo.steps': 'Steps', 'sugo.warn': 'Warning', 'sugo.tools': 'Tools', 'sugo.back': 'Back to the list' },
};

/* **bold** is the only markup the entries use */
const rich = (text) => String(text).split('**').map((part, i) => (i % 2 ? h('b', { text: part }) : part));

const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export function mount(root, ctx) {
  let query = '';
  let open = null;
  const view = liveRender(root, ctx, async () => {
    const data = await loadKit('sugo', 'KIT_SUGO');
    if (open) {
      const e = data.entries.find((x) => x.id === open);
      const warn = list(pick(e.warn));
      const tools = list(e.tools);
      return pageWrap(
        h('button.btn', { type: 'button', text: t('sugo.back'), onclick: () => { open = null; view.refresh(); } }),
        h('h2.title', { text: pick(e.title) }),
        panel(t('sugo.symptoms'), h('ul.plain.dashed', {}, list(pick(e.sym)).map((s) => h('li', {}, rich(s))))),
        panel(t('sugo.steps'), h('ol.steps', {}, list(pick(e.steps)).map((s) => h('li', {}, rich(s))))),
        warn.length ? panel(t('sugo.warn'), warn.map((w) => h('p.attn', {}, rich(w)))) : null,
        tools.length ? panel(t('sugo.tools'), h('p', { text: tools.join(', ') })) : null);
    }
    const words = fold(query).split(/\s+/).filter(Boolean);
    const hits = data.entries.filter((e) => words.every((w) => fold(`${pick(e.title)} ${list(pick(e.sym)).join(' ')} ${list(pick(e.tags)).join(' ')}`).includes(w)));
    return pageWrap(panel(t('sugo.title'),
      h('input.input', { type: 'search', value: query, 'aria-label': t('common.search'), placeholder: t('common.search'), onchange: (e) => { query = e.target.value; view.refresh(); } }),
      hits.length ? hits.map((e) => listRow({
        title: pick(e.title),
        sub: pick(data.categories.find((c) => c.id === e.cat)),
        onclick: () => { open = e.id; view.refresh(); },
      })) : guide(t('common.noResults'))));
  });
  return view.stop;
}
