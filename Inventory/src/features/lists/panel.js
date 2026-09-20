// Order-list panel: the active list, its lines, and what it costs.
//
// A list stores ids and quantities only, so everything shown here is resolved
// live against the catalogue and the selected vendor. Switch vendor and the
// same list re-prices itself.

import { el, clear, option } from '../../ui/dom.js';
import * as fmt from '../../core/format.js';

function createListPanel(opts) {
  const { store, lists, onChange, onPick } = opts;

  const picker = el('select', {
    id: 'l-active',
    onchange: e => { lists.setActive(e.target.value || null); render(); onChange(); }
  });
  const listNote = el('input', {
    type: 'text', class: 'wide-input', placeholder: 'Megjegyzés a listához…',
    oninput: e => lists.setListNote(lists.activeId(), e.target.value)
  });
  const body = el('div');
  const totalsBar = el('div', { class: 'totals' });

  function ask(message, fallback) {
    const v = prompt(message, fallback || '');
    return v == null ? null : v.trim();
  }

  const buttons = el('div', { class: 'controls' }, [
    el('label', { for: 'l-active' }, ['Aktív lista', picker]),
    el('button', {
      type: 'button', text: '+ Új lista',
      onclick: () => { const n = ask('Új lista neve:'); if (n !== null) { lists.create(n); render(); onChange(); } }
    }),
    el('button', {
      type: 'button', class: 'ghost', text: 'Átnevezés',
      onclick: () => {
        const l = lists.active(); if (!l) return;
        const n = ask('Lista új neve:', l.nev);
        if (n) { lists.rename(l.id, n); render(); onChange(); }
      }
    }),
    el('button', {
      type: 'button', class: 'ghost', text: 'Másolat',
      onclick: () => { const l = lists.active(); if (l) { lists.duplicate(l.id); render(); onChange(); } }
    }),
    el('button', {
      type: 'button', class: 'ghost', text: 'Összefésülés…',
      onclick: () => mergeDialog()
    }),
    el('div', { class: 'spacer' }),
    el('button', {
      type: 'button', class: 'ghost', text: 'Sorok törlése',
      onclick: () => {
        const l = lists.active(); if (!l) return;
        if (confirm(`"${l.nev}" összes sorának törlése?`)) { lists.clearLines(l.id); render(); onChange(); }
      }
    }),
    el('button', {
      type: 'button', class: 'ghost danger', text: 'Lista törlése',
      onclick: () => {
        const l = lists.active(); if (!l) return;
        if (confirm(`"${l.nev}" lista törlése véglegesen?`)) { lists.remove(l.id); render(); onChange(); }
      }
    })
  ]);

  function mergeDialog() {
    const target = lists.active();
    if (!target) return;
    const others = lists.all().filter(l => l.id !== target.id);
    if (!others.length) return alert('Nincs másik lista, amivel össze lehetne fésülni.');
    const names = others.map((l, i) => `${i + 1}. ${l.nev} (${Object.keys(l.sorok).length} sor)`).join('\n');
    const pick = prompt(`Melyik listát fésüljem bele a(z) "${target.nev}" listába?\n\n${names}\n\nÍrd be a sorszámot:`);
    const idx = Number(pick) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= others.length) return;
    const r = lists.merge(target.id, others[idx].id);
    render(); onChange();
    alert(`Kész: ${r.added} új sor, ${r.summed} sornál a mennyiségek összeadódtak.`);
  }

  function renderPicker() {
    const ls = lists.all();
    clear(picker);
    if (!ls.length) {
      picker.appendChild(option('', 'nincs lista', true));
      return;
    }
    for (const l of ls) {
      picker.appendChild(option(l.id, `${l.nev} — ${Object.keys(l.sorok).length} sor`, l.id === lists.activeId()));
    }
  }

  function renderTotals(t) {
    clear(totalsBar);
    const vendor = store.vendors.selectedVendor();
    const box = (v, label, cls) => totalsBar.appendChild(el('div', { class: 'stat' + (cls ? ' ' + cls : '') }, [
      el('b', { text: v }), el('span', { text: label })
    ]));
    box(String(t.sorok), 'sor');
    box(fmt.num(t.osszes_mennyiseg), 'összes mennyiség');
    box(fmt.huf(t.netto), vendor ? `nettó — ${vendor.nev}` : 'nettó (becsült árakkal)');
    box(fmt.huf(t.brutto), 'bruttó (27% ÁFA)');
    if (t.ar_nelkul) box(String(t.ar_nelkul), 'sor ár nélkül', 'gap');
    if (t.csomag_figyelmeztetes) box(String(t.csomag_figyelmeztetes), 'kiszerelés-eltérés', 'gap');
    if (t.hianyzo_tetel) box(String(t.hianyzo_tetel), 'ismeretlen tétel', 'gap');
  }

  function renderRows() {
    const l = lists.active();
    clear(body);
    if (!l) {
      body.appendChild(el('p', { class: 'note', text: 'Még nincs lista. Hozz létre egyet, aztán a katalógus „Lista” oszlopában a + gombbal vehetsz fel tételeket.' }));
      return;
    }
    listNote.value = l.megjegyzes || '';
    const rows = lists.rows(l.id);
    if (!rows.length) {
      body.appendChild(el('p', { class: 'note', text: 'Ez a lista üres. A katalógus „Lista” oszlopában a + gombbal vehetsz fel tételeket.' }));
      return;
    }

    const vendorOn = !!store.vendors.selectedId();
    const head = ['', 'Megnevezés', 'Mennyiség', 'Egységár', 'Sor összesen', 'Megjegyzés', ''];
    body.appendChild(el('table', { class: 'mini listrows' }, [
      el('thead', {}, [el('tr', {}, head.map((h, i) =>
        el('th', { class: i === 2 || i === 3 || i === 4 ? 'num' : null, text: h })))]),
      el('tbody', {}, rows.map(r => rowNode(r, l, vendorOn)))
    ]));
  }

  function rowNode(r, l, vendorOn) {
    if (r.hianyzo) {
      return el('tr', { class: 'missing' }, [
        el('td', { class: 'id', text: r.vrg_id }),
        el('td', { colspan: '4', class: 'warn-note', text: 'Ez a tétel nincs a mostani katalógusban — a sor megmaradt, de nem árazható.' }),
        el('td'),
        el('td', {}, [removeBtn(r, l)])
      ]);
    }

    const qtyInput = el('input', {
      type: 'number', min: '0', step: 'any', class: 'qty-input',
      onchange: e => { lists.setQty(r.vrg_id, e.target.value, l.id); render(); onChange(); }
    });
    qtyInput.value = String(r.mennyiseg);

    const noteInput = el('input', {
      type: 'text', class: 'line-note', placeholder: '—',
      oninput: e => lists.setLineNote(r.vrg_id, e.target.value, l.id)
    });
    noteInput.value = r.megjegyzes;

    const packWarn = !r.csomag_ok
      ? el('span', {
        class: 'pack-warn',
        title: `A beszállító kiszerelése ${r.csomag_mennyiseg} ${r.item.egyseg || 'db'} — ${r.mennyiseg} nem egész csomag.`,
        text: '⚠'
      })
      : null;

    return el('tr', {}, [
      el('td', { class: 'id', text: r.vrg_id }),
      el('td', {}, [
        el('a', {
          href: '#', class: 'rowlink',
          onclick: e => { e.preventDefault(); onPick(r.vrg_id); },
          text: r.item.megnevezes
        })
      ]),
      el('td', { class: 'num' }, [qtyInput, ' ', r.item.egyseg || '', packWarn]),
      el('td', { class: 'num' + (r.egysegar_forras === 'becsles' ? ' muted' : ''), title: r.egysegar_forras === 'becsles' ? 'Becsült ár — nincs kiválasztva beszállító, vagy nincs beszállítói ára' : null, text: fmt.huf(r.egysegar) }),
      el('td', { class: 'num', text: fmt.huf(r.sor_netto) }),
      el('td', {}, [noteInput]),
      el('td', {}, [removeBtn(r, l)])
    ]);
  }

  function removeBtn(r, l) {
    return el('button', {
      type: 'button', class: 'tiny ghost', text: '✕', title: 'Sor törlése',
      onclick: () => { lists.setQty(r.vrg_id, 0, l.id); render(); onChange(); }
    });
  }

  function render() {
    renderPicker();
    renderRows();
    renderTotals(lists.totals());
  }

  const root = el('div', { class: 'panel lists-panel', hidden: true }, [
    buttons,
    el('label', { class: 'mini-lbl listnote-lbl' }, ['Lista megjegyzés', listNote]),
    totalsBar,
    body
  ]);

  render();
  return {
    root, render,
    toggle: () => { root.hidden = !root.hidden; if (!root.hidden) render(); return !root.hidden; },
    show: () => { root.hidden = false; render(); }
  };
}

export { createListPanel };
