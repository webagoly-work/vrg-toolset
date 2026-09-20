// Virtualised table. Only the rows in view exist in the DOM, so the catalogue
// stays responsive as it grows past the current 221 items.
//
// Rows are a fixed height and cells are single-line with ellipsis; the full
// text lives in the detail drawer. That is what makes the windowing arithmetic
// exact rather than an estimate.

import { el, clear } from '../../ui/dom.js';
import * as dom from '../../ui/dom.js';
import { cellText, comparator } from './columns.js';

const ROW_H = 30;
const OVERSCAN = 6;

/**
 * Pure windowing arithmetic — the part worth unit-testing.
 * Returns the half-open row range [start, end) plus the spacer heights that
 * keep the scrollbar honest.
 */
function windowRange(o) {
  const rowHeight = o.rowHeight || ROW_H;
  const overscan = o.overscan == null ? OVERSCAN : o.overscan;
  const total = Math.max(0, o.total | 0);
  if (total === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };

  const fit = Math.ceil(Math.max(0, o.viewportHeight) / rowHeight) + 1;
  let start = Math.floor(Math.max(0, o.scrollTop) / rowHeight) - overscan;
  if (start < 0) start = 0;
  if (start > total - 1) start = total - 1;
  let end = start + fit + overscan * 2;
  if (end > total) end = total;

  return { start, end, padTop: start * rowHeight, padBottom: (total - end) * rowHeight };
}

function createTable(opts) {
  const { columns, ctx, onSelect } = opts;
  let rows = [];
  let sort = { id: 'megnevezes', desc: false };
  let selectedId = null;
  let lastRange = null;

  const padTop = el('tr', { class: 'pad', 'aria-hidden': 'true' }, [el('td')]);
  const padBottom = el('tr', { class: 'pad', 'aria-hidden': 'true' }, [el('td')]);
  const tbody = el('tbody');
  const thead = el('thead');
  const table = el('table', { class: 'catalog' }, [thead, tbody]);
  const scroller = el('div', { class: 'scroller', onscroll: () => paint() }, [table]);
  const empty = el('div', { class: 'empty', text: 'Nincs találat.' , hidden: true });
  const root = el('div', { class: 'table-wrap' }, [scroller, empty]);

  function setSort(id) {
    sort = sort.id === id ? { id, desc: !sort.desc } : { id, desc: false };
    applySort();
    paint(true);
    renderHead();
  }

  function applySort() {
    const cols = columns.active(ctx);
    const col = cols.find(c => c.id === sort.id) || cols[0];
    if (!col) return;
    sort.id = col.id;
    rows.sort(comparator(col, ctx, sort.desc));
  }

  function renderHead() {
    const cols = columns.active(ctx);
    clear(thead).appendChild(el('tr', {}, cols.map(c => {
      const active = c.id === sort.id;
      return el('th', {
        class: [c.kind === 'num' ? 'num' : '', c.vendor ? 'vendor-col' : '', active ? 'sorted' : ''].filter(Boolean).join(' ') || null,
        style: `width:${c.width}px`,
        scope: 'col',
        tabindex: '0',
        title: c.label + ' — kattints a rendezéshez',
        'aria-sort': active ? (sort.desc ? 'descending' : 'ascending') : 'none',
        onclick: () => setSort(c.id),
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSort(c.id); } }
      }, [c.label, active ? el('span', { class: 'arrow', text: sort.desc ? ' ▼' : ' ▲' }) : null]);
    })));
  }

  function renderRow(it, cols) {
    const tr = el('tr', {
      class: it.vrg_id === selectedId ? 'selected' : null,
      tabindex: '0',
      onclick: () => select(it.vrg_id),
      onkeydown: e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it.vrg_id); }
      }
    }, cols.map(c => {
      if (c.render) {
        return el('td', { class: 'cell-interactive' + (c.kind === 'num' ? ' num' : '') },
          [c.render(it, ctx, dom)]);
      }
      const text = cellText(c, it, ctx);
      const cls = [
        c.kind === 'num' ? 'num' : c.kind === 'mono' ? 'id' : '',
        c.dim ? 'muted' : '',
        c.vendor ? 'vendor-col' : '',
        c.provisional && c.provisional(it) ? 'prov' : '',
        c.markClass ? c.markClass(it) : '',
        it.overridden && it.overridden.includes(c.overrides) ? 'edited' : '',
        text === '—' ? 'muted' : ''
      ].filter(Boolean).join(' ');
      return el('td', { class: cls || null, title: text.length > 18 ? text : null, text });
    }));
    return tr;
  }

  function select(id) {
    selectedId = id;
    for (const tr of tbody.querySelectorAll('tr')) tr.classList.remove('selected');
    paint(true);
    if (onSelect) onSelect(id);
  }

  function paint(force) {
    const r = windowRange({
      scrollTop: scroller.scrollTop,
      viewportHeight: scroller.clientHeight || 600,
      rowHeight: ROW_H,
      total: rows.length
    });
    if (!force && lastRange && r.start === lastRange.start && r.end === lastRange.end) return;
    lastRange = r;

    const cols = columns.active(ctx);
    padTop.firstChild.setAttribute('colspan', String(cols.length));
    padBottom.firstChild.setAttribute('colspan', String(cols.length));
    padTop.style.height = r.padTop + 'px';
    padBottom.style.height = r.padBottom + 'px';

    clear(tbody);
    tbody.appendChild(padTop);
    for (let i = r.start; i < r.end; i++) tbody.appendChild(renderRow(rows[i], cols));
    tbody.appendChild(padBottom);
  }

  function setRows(next) {
    rows = next.slice();
    applySort();
    scroller.scrollTop = 0;
    lastRange = null;
    empty.hidden = rows.length > 0;
    scroller.hidden = rows.length === 0;
    renderHead();
    paint(true);
  }

  /** Re-render everything, e.g. after the vendor or the column set changed. */
  function refresh() {
    applySort();
    lastRange = null;
    renderHead();
    paint(true);
  }

  function scrollToId(id) {
    const i = rows.findIndex(r => r.vrg_id === id);
    if (i < 0) return false;
    scroller.scrollTop = Math.max(0, i * ROW_H - scroller.clientHeight / 2);
    select(id);
    return true;
  }

  return { root, setRows, refresh, select, scrollToId, getSort: () => ({ ...sort }), setSort, rowHeight: ROW_H };
}

export { createTable, windowRange, ROW_H };
