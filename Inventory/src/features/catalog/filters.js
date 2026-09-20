// Filter bar + category tree + column picker.
// Owns no data: it produces a filter object and announces changes.

import { el, clear, option } from '../../ui/dom.js';
import { COLUMNS } from './columns.js';

const MISSING = [
  ['', 'nincs hiányszűrő'],
  ['kategoria', 'nincs hivatalos kategória'],
  ['tomeg', 'nincs tömeg'],
  ['gyarto', 'nincs márka'],
  ['gyartoi_cikkszam', 'nincs gyártói cikkszám'],
  ['gyartoi_link', 'nincs gyártói link'],
  ['ar', 'nincs ár']
];

function createFilters(opts) {
  const { store, columns, onChange, onVendorChange, onColumnsChange } = opts;
  const state = { text: '', fo: '', al: '', brand: '', missing: '', hasPrice: undefined, kedvenc: false };

  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  const fire = () => onChange({ ...state });
  const fireSoon = debounce(fire, 90);

  // ------------------------------------------------------------- search
  const search = el('input', {
    type: 'search', id: 'f-search', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'név, VRG azonosító, cikkszám, gyártó…',
    oninput: e => { state.text = e.target.value; fireSoon(); },
    onkeydown: e => { if (e.key === 'Escape') { e.target.value = ''; state.text = ''; fire(); } }
  });

  // ------------------------------------------------------------- vendor
  const vendorSelect = el('select', {
    id: 'f-vendor',
    onchange: e => { store.vendors.select(e.target.value || null); onVendorChange(); }
  }, [option('', 'nincs — semleges nézet', true)]
    .concat(store.vendors.list().map(v => option(v.id, v.nev))));

  // -------------------------------------------------------------- brand
  const brandSelect = el('select', {
    id: 'f-brand',
    onchange: e => { state.brand = e.target.value; fire(); }
  }, [option('', 'összes márka', true)].concat(store.brands.map(b => option(b, b))));

  // ------------------------------------------------------------ missing
  const missingSelect = el('select', {
    id: 'f-missing',
    onchange: e => { state.missing = e.target.value; fire(); }
  }, MISSING.map(([v, l], i) => option(v, l, i === 0)));

  // ------------------------------------------------------------ has price
  const priceSelect = el('select', {
    id: 'f-price',
    onchange: e => {
      state.hasPrice = e.target.value === '' ? undefined : e.target.value === 'igen';
      fire();
    }
  }, [option('', 'ár: mindegy', true), option('igen', 'csak ismert árral'), option('nem', 'csak ár nélkül')]);

  // ----------------------------------------------------------- favourites
  const favBtn = el('button', {
    type: 'button', class: 'ghost fav', id: 'f-fav', 'aria-pressed': 'false',
    text: '☆ Csak kedvencek',
    onclick: () => {
      state.kedvenc = !state.kedvenc;
      favBtn.classList.toggle('on', state.kedvenc);
      favBtn.setAttribute('aria-pressed', state.kedvenc ? 'true' : 'false');
      favBtn.textContent = (state.kedvenc ? '★' : '☆') + ' Csak kedvencek';
      fire();
    }
  });

  const bar = el('div', { class: 'controls' }, [
    el('label', { for: 'f-search', class: 'grow' }, ['Keresés', search]),
    el('label', { for: 'f-vendor' }, ['Beszállító', vendorSelect]),
    el('label', { for: 'f-brand' }, ['Márka', brandSelect]),
    el('label', { for: 'f-price' }, ['Ár', priceSelect]),
    el('label', { for: 'f-missing' }, ['Hiányzó adat', missingSelect]),
    el('label', {}, [el('span', { class: 'sr-space' }), favBtn]),
    el('div', { class: 'spacer' }),
    el('button', { type: 'button', class: 'ghost', onclick: () => toggleColumns(), text: 'Oszlopok ▾' }),
    el('button', { type: 'button', class: 'ghost', onclick: () => resetAll(), text: 'Szűrők törlése' })
  ]);

  // ------------------------------------------------------ category tree
  const treeBox = el('div', { class: 'tree' });

  function renderTree() {
    clear(treeBox);
    treeBox.appendChild(treeButton('Összes kategória', store.items.length, !state.fo, () => {
      state.fo = ''; state.al = ''; fire(); renderTree();
    }));
    for (const node of store.tree) {
      const openNode = state.fo === node.nev;
      treeBox.appendChild(treeButton(node.nev, node.count, openNode && !state.al, () => {
        state.fo = openNode ? '' : node.nev;
        state.al = '';
        fire(); renderTree();
      }, node.official ? null : 'prov'));
      if (openNode) {
        for (const child of node.children) {
          treeBox.appendChild(treeButton(child.nev, child.count, state.al === child.nev, () => {
            state.al = state.al === child.nev ? '' : child.nev;
            fire(); renderTree();
          }, 'child' + (child.official ? '' : ' prov')));
        }
      }
    }
  }

  function treeButton(label, count, on, onclick, extra) {
    return el('button', {
      type: 'button',
      class: 'treebtn' + (on ? ' on' : '') + (extra ? ' ' + extra : ''),
      'aria-pressed': on ? 'true' : 'false',
      onclick
    }, [el('span', { class: 'lbl', text: label }), el('span', { class: 'cnt', text: String(count) })]);
  }

  // ------------------------------------------------------ column picker
  const columnBox = el('div', { class: 'colpicker', hidden: true });

  function renderColumns() {
    clear(columnBox);
    columnBox.appendChild(el('p', { class: 'note', text: 'Pipáld ki, mely oszlopok látszódjanak, a nyilakkal pedig átrendezheted őket. A beszállítói oszlopok csak kiválasztott beszállítónál jelennek meg.' }));
    for (const col of columns.all()) {
      const id = 'col-' + col.id;
      columnBox.appendChild(el('div', { class: 'colrow' }, [
        el('input', {
          type: 'checkbox', id, checked: columns.isVisible(col.id) || null,
          onchange: e => {
            if (!columns.toggle(col.id, e.target.checked)) e.target.checked = true;
            onColumnsChange();
          }
        }),
        el('label', { for: id, class: col.vendor ? 'vendor-lbl' : null, text: col.label }),
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'tiny', title: 'előrébb', text: '↑', onclick: () => { if (columns.move(col.id, -1)) { renderColumns(); onColumnsChange(); } } }),
        el('button', { type: 'button', class: 'tiny', title: 'hátrébb', text: '↓', onclick: () => { if (columns.move(col.id, 1)) { renderColumns(); onColumnsChange(); } } })
      ]));
    }
    columnBox.appendChild(el('button', {
      type: 'button', class: 'ghost', text: 'Alapértelmezett oszlopok',
      onclick: () => { columns.reset(); renderColumns(); onColumnsChange(); }
    }));
  }

  function toggleColumns() {
    columnBox.hidden = !columnBox.hidden;
    if (!columnBox.hidden) renderColumns();
  }

  function paintInputs() {
    search.value = state.text || '';
    brandSelect.value = state.brand || '';
    missingSelect.value = state.missing || '';
    priceSelect.value = state.hasPrice === undefined ? '' : (state.hasPrice ? 'igen' : 'nem');
    favBtn.classList.toggle('on', !!state.kedvenc);
    favBtn.setAttribute('aria-pressed', state.kedvenc ? 'true' : 'false');
    favBtn.textContent = (state.kedvenc ? '★' : '☆') + ' Csak kedvencek';
    renderTree();
  }

  function resetAll() {
    state.text = ''; state.fo = ''; state.al = ''; state.brand = '';
    state.missing = ''; state.hasPrice = undefined; state.kedvenc = false;
    paintInputs();
    fire();
  }

  /** Re-apply a saved filter state (Phase 3 restores this from storage). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return false;
    for (const k of ['text', 'fo', 'al', 'brand', 'missing']) {
      if (typeof saved[k] === 'string') state[k] = saved[k];
    }
    if (saved.hasPrice === true || saved.hasPrice === false || saved.hasPrice === undefined) {
      state.hasPrice = saved.hasPrice;
    }
    state.kedvenc = !!saved.kedvenc;
    // a category that no longer exists must not silently hide everything
    if (state.fo && !store.tree.some(t => t.nev === state.fo)) { state.fo = ''; state.al = ''; }
    paintInputs();
    fire();
    return true;
  }

  renderTree();
  renderColumns();

  const root = el('div', {}, [
    el('div', { class: 'panel' }, [bar, columnBox]),
    el('div', { class: 'panel tree-panel' }, [treeBox])
  ]);

  return {
    root, state, restore,
    focusSearch: () => search.focus(),
    refreshTree: renderTree,
    columnCount: COLUMNS.length
  };
}

export { createFilters };
