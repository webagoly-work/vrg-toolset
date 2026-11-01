/* Entry of the single-file trace page (dist/vrg-trace.html). It has no database: live sessions stay in
   the relay's traces folder. Served by the relay, it is paired already. */
import { addStrings, setLang, t, getLang, LANGS } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { mountTrace } from './panel.js';
import { strings } from './strings.js';

addStrings(strings);
const KEY = 'vc.trace.';
const read = (key) => {
  try { return JSON.parse(localStorage.getItem(KEY + key)); } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(KEY + key, JSON.stringify(value)); } catch { /* blocked storage: settings last for this page only */ }
};

setLang(read('lang') ?? 'hu');
const code = document.querySelector('meta[name="trace-code"]')?.content;
if (code && read('source') == null) write('source', 'hooks');

const app = document.getElementById('app');
let stop = null;

function start() {
  stop?.();
  app.replaceChildren();
  document.documentElement.lang = getLang();
  document.title = t('trace.title');
  const page = h('section.page', { 'data-density': 'standard' });
  app.append(
    h('div.btn-row.langs', {}, LANGS.map((l) => h('button.btn', {
      type: 'button', text: t('trace.lang.' + l), 'aria-pressed': String(l === getLang()),
      onclick: () => { setLang(l); write('lang', l); start(); },
    }))),
    page);
  stop = mountTrace(page, { get: read, set: write, names: () => [], code });
}
start();
