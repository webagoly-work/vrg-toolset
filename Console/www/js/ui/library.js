/* The page library sheet: enabled pages in order (up/down buttons plus a drag handle), then the
   catalogue by category. Also the per-page settings sheet. */
import { t } from '../core/i18n.js';
import { DENSITIES } from '../core/store.js';
import { formatNumber } from '../core/format.js';
import { CATALOG, CATEGORIES } from '../pages/catalog.js';
import { pageName } from '../pages/registry.js';
import { h, icon, iconButton, segmented } from './dom.js';
import { openSheet } from './sheet.js';

function enableDrag(handle, row, list, onDrop) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    row.classList.add('dragging');
    const scroller = list.closest('.sheet-body');
    const move = (ev) => {
      const box = scroller.getBoundingClientRect();
      if (ev.clientY < box.top + 48) scroller.scrollTop -= 8;
      else if (ev.clientY > box.bottom - 48) scroller.scrollTop += 8;
      const others = [...list.children].filter((c) => c !== row);
      const before = others.find((c) => {
        const r = c.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      });
      list.insertBefore(row, before ?? null);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      row.classList.remove('dragging');
      onDrop([...list.children].map((c) => c.dataset.page));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

export function openLibrary(ctx) {
  const { store } = ctx;
  const body = h('div.sheet-body');
  const openCats = new Set(['field']);

  function enabledRow(id, i, total) {
    const name = pageName(id);
    const row = h('div.prow', { 'data-page': id });
    const handle = h('button.ico.handle', { type: 'button', 'aria-label': t('library.drag', { name }), title: t('library.drag', { name }) }, icon('handle'));
    const move = (delta) => {
      if (store.movePage(id, delta)) {
        ctx.pagesChanged();
        render(`[data-page="${id}"] [data-move="${delta}"]`);
      }
    };
    row.append(handle,
      h('span.pname', { text: name }),
      iconButton('up', t('library.moveUp', { name }), () => move(-1), { disabled: i === 0, 'data-move': '-1' }),
      iconButton('down', t('library.moveDown', { name }), () => move(1), { disabled: i === total - 1, 'data-move': '1' }),
      iconButton('tune', t('library.pageSettings', { name }), () => ctx.openPageSettings(id)),
      iconButton('off', t('library.disable', { name }), () => { store.disablePage(id); ctx.pagesChanged(); render(); }));
    return { row, handle };
  }

  function render(focusSelector) {
    const pages = store.active().pages;
    const glove = store.state.settings.glove;
    const list = h('div.plist');
    pages.forEach((id, i) => {
      const { row, handle } = enabledRow(id, i, pages.length);
      list.append(row);
      enableDrag(handle, row, list, (ids) => {
        store.reorderPages(ids);
        ctx.pagesChanged();
        render();
      });
    });

    const cats = CATEGORIES.map((cat) => {
      const items = CATALOG.filter((p) => p.category === cat);
      const on = items.filter((p) => pages.includes(p.id)).length;
      const det = h('details', { open: openCats.has(cat), ontoggle: (e) => { (e.target.open ? openCats.add(cat) : openCats.delete(cat)); } },
        h('summary', {}, t('category.' + cat),
          h('small', { text: t('library.count', { n: formatNumber(on), total: formatNumber(items.length) }) })),
        items.map((p) => {
          const name = pageName(p.id);
          return h('label.tpl', {},
            h('input', {
              type: 'checkbox', checked: pages.includes(p.id), 'aria-label': t('library.toggle', { name }), 'data-tpl': p.id,
              onchange: (e) => {
                if (e.target.checked) store.enablePage(p.id); else store.disablePage(p.id);
                ctx.pagesChanged();
                render(`[data-tpl="${p.id}"]`);
              },
            }),
            h('span.tname', { text: name }),
            h('span.chip', { text: t(p.offline ? 'chip.offline' : 'chip.online') }));
        }));
      return det;
    });

    const top = body.scrollTop;
    body.replaceChildren(
      h('section.sect', {},
        h('h3', { text: t('library.enabled') }),
        h('p.hint', { text: t(glove ? 'library.gloveHint' : 'library.enabledHint') }),
        pages.length ? list : h('p.hint', { text: t('library.none') })),
      h('section.sect', {}, h('h3', { text: t('library.catalogue') }), cats));
    body.scrollTop = top;
    if (focusSelector) {
      const target = body.querySelector(focusSelector);
      (target && !target.disabled ? target : body.querySelector(`[data-page] .ico:not(:disabled)`))?.focus();
    }
  }

  render();
  openSheet(t('library.title'), body);
}

export function openPageSettings(ctx, id) {
  const { store } = ctx;
  const name = pageName(id);
  const options = ['inherit', ...DENSITIES].map((value) => ({ value, label: t('density.' + value) }));
  const body = h('div.sheet-body', {},
    h('section.sect', {},
      h('h3', { text: t('pageSettings.density') }),
      h('p.hint', { text: t('pageSettings.densityHint') }),
      segmented(options, store.pageSetting(id, 'density') ?? 'inherit', (value) => {
        store.setPageSetting(id, 'density', value);
        ctx.refreshPage();
      })));
  openSheet(t('pageSettings.title', { name }), body, { stacked: true });
}
