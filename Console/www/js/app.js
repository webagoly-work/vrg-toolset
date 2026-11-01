/* Varler Console: the app frame. */
import { t, setLang, getLang, applyDom } from './core/i18n.js';
import { createStore, MAX_PRESETS } from './core/store.js';
import { createDb } from './core/db.js';
import { createBridge } from './core/bridge.js';
import { formatNumber } from './core/format.js';
import { PAGE_IDS } from './pages/catalog.js';
import { HOME, mountPage, pageName } from './pages/registry.js';
import { createCarousel } from './ui/carousel.js';
import { h, icon } from './ui/dom.js';
import { toast } from './ui/feedback.js';
import { openLibrary, openPageSettings } from './ui/library.js';
import { openSettings } from './ui/settings.js';
import { initSheet, sheetOpen } from './ui/sheet.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = createStore({ known: PAGE_IDS, defaultName: t('preset.defaultName') });
setLang(store.state.settings.lang);

const db = createDb();

const order = () => [HOME, ...store.active().pages];

function densityFor(id) {
  const own = store.pageSetting(id, 'density');
  return own && own !== 'inherit' ? own : store.state.settings.density;
}

const ctx = {
  store,
  db,
  bridge: createBridge(),
  goto(id) {
    if (store.enablePage(id)) {
      carousel.setPages(order(), carousel.pageId);
      toast(t('nav.enabled', { name: pageName(id) }));
    }
    carousel.go(order().indexOf(id));
  },
  densityFor,
  openPageSettings: (id) => openPageSettings(ctx, id),
  refreshPage: () => carousel.refresh(),
  pagesChanged: () => carousel.setPages(order(), carousel.pageId),
  presetsChanged: () => renderPresets(),
  languageChanged() {
    setLang(store.state.settings.lang);
    root.lang = getLang();
    applyDom(document);
    renderPresets();
    renderDots();
    renderTitle();
    carousel.refresh();
  },
  displayChanged: applyDisplay,
  switchPreset(id) {
    if (!store.activatePreset(id)) return;
    renderPresets();
    carousel.setPages(order(), carousel.pageId);
    toast(t('preset.switched', { name: store.active().name }));
  },
  reset() {
    setLang(store.state.settings.lang);
    applyDisplay();
    renderPresets();
    carousel.setPages(order(), HOME);
  },
};

const carousel = createCarousel({
  view: $('view'),
  reducedMotion,
  mountPage: (id) => mountPage(id, ctx),
  onChange() {
    renderDots();
    renderTitle();
  },
});

function applyDisplay() {
  const { sunlight, glove } = store.state.settings;
  if (sunlight) root.dataset.theme = 'sun'; else delete root.dataset.theme;
  if (glove) root.dataset.glove = ''; else delete root.dataset.glove;
}

function renderTitle() {
  const ids = order();
  const at = carousel.index;
  const title = $('ptitle');
  title.replaceChildren(
    h('span.ptname', { text: pageName(ids[at]) }),
    h('small', { text: t('nav.position', { n: formatNumber(at + 1), total: formatNumber(ids.length) }) }));
}

function renderDots() {
  const ids = order();
  const box = $('dots');
  box.replaceChildren(...ids.map((id, i) => {
    const b = h('button.dot', {
      type: 'button', 'aria-label': t('nav.gotoPage', { name: pageName(id) }), title: pageName(id),
      'aria-current': String(i === carousel.index), onclick: () => carousel.go(i),
    }, h('i'));
    return b;
  }));
  const dot = box.children[carousel.index];
  if (dot) box.scrollLeft = dot.offsetLeft - box.offsetLeft - (box.clientWidth - dot.offsetWidth) / 2;
  const single = ids.length < 2;
  $('btnPrev').disabled = single;
  $('btnNext').disabled = single;
}

function renderPresets() {
  const { presets, active } = store.state;
  const box = $('presets');
  box.replaceChildren(...presets.map((p) => h('button.preset', {
    type: 'button', text: p.name, title: p.name, 'aria-pressed': String(p.id === active),
    onclick: () => { if (p.id !== store.state.active) ctx.switchPreset(p.id); },
  })));
  if (presets.length < MAX_PRESETS) {
    box.append(h('button.preset-add', {
      type: 'button', 'aria-label': t('preset.add'), title: t('preset.add'),
      onclick: () => openSettings(ctx, { focus: '#presetNew' }),
    }, icon('plus')));
  }
}

function warnIfUnsaved() {
  if (!store.persisted && !warnIfUnsaved.shown) {
    warnIfUnsaved.shown = true;
    toast(t('error.storage'), { error: true, ms: 12000 });
  }
}

$('btnHome').append(icon('home'));
$('btnPrev').append(icon('prev'));
$('btnNext').append(icon('next'));
$('btnLibrary').append(icon('library'));
$('btnSettings').append(icon('settings'));
$('btnHome').onclick = () => carousel.go(0);
$('btnPrev').onclick = () => carousel.prev();
$('btnNext').onclick = () => carousel.next();
$('btnLibrary').onclick = () => openLibrary(ctx);
$('btnSettings').onclick = () => openSettings(ctx);

addEventListener('keydown', (e) => {
  if (sheetOpen() || $('confirm').open || e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') carousel.next();
  if (e.key === 'ArrowLeft') carousel.prev();
  if (e.key === 'Home') carousel.go(0);
});

initSheet();
root.lang = getLang();
applyDom(document);
applyDisplay();
renderPresets();
carousel.setPages(order(), HOME);
store.subscribe(warnIfUnsaved);
warnIfUnsaved();
