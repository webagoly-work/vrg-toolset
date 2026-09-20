// Item detail drawer.
//
// Note what it shows in vendor-neutral mode: name variants, the neutral
// fields, the usage aggregates — and explicitly *no* price history, because
// the history belongs to a vendor. The empty vendor section says so out loud
// rather than leaving the reader to wonder whether the data is missing.

import { el, clear } from '../../ui/dom.js';
import { sparkline, kv, section, chip } from '../../ui/components.js';
import * as fmt from '../../core/format.js';
import * as categories from '../../core/categories.js';
import { estimate, discountPct } from '../../core/pricing.js';
import { MARKS } from '../../core/userdata.js';

const MARK_LABEL = { piros: 'Piros', sarga: 'Sárga', zold: 'Zöld', kek: 'Kék' };

function createDetail(opts) {
  const { store, userdata, lists, onEdit, onClose } = opts;
  const body = el('div', { class: 'drawer-body' });
  const title = el('h2', { class: 'drawer-title' });
  const root = el('aside', {
    class: 'drawer', hidden: true, 'aria-label': 'Tétel részletei', tabindex: '-1'
  }, [
    el('div', { class: 'drawer-head' }, [
      title,
      el('button', { type: 'button', class: 'ghost close', title: 'Bezárás (Esc)', text: '✕', onclick: () => close() })
    ]),
    body
  ]);

  root.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function close() {
    root.hidden = true;
    if (onClose) onClose();
  }

  function show(id) {
    const it = store.get(id);
    if (!it) return close();
    const c = categories.resolve(it);
    const est = estimate(it);
    const vendorId = store.vendors.selectedId();

    clear(title).appendChild(document.createTextNode(it.megnevezes));
    clear(body);

    body.appendChild(el('div', { class: 'chips' }, [
      chip(it.vrg_id, 'mono'),
      it.marka_gyarto ? chip(it.marka_gyarto) : null,
      it.gyartoi_cikkszam ? chip(it.gyartoi_cikkszam, 'mono') : null,
      chip(c.al + (c.official ? '' : ' ~'), c.official ? 'ok' : 'prov')
    ].filter(Boolean)));

    body.appendChild(listSection(it));
    body.appendChild(userSection(it));

    // --------------------------------------------------------- neutral
    body.appendChild(section('Független adatok', el('dl', { class: 'kvs' }, [
      kv('Megnevezés', it.megnevezes),
      kv('Márka / Gyártó', it.marka_gyarto),
      kv('Gyártói cikkszám', it.gyartoi_cikkszam),
      kv('Egység', it.egyseg),
      kv('Tömeg (kg)', it.tomeg_kg == null ? null : fmt.num(it.tomeg_kg, 3)),
      kv('Gyártói termék link', it.gyartoi_termek_link),
      kv('GTIN / EAN', it.gtin),
      kv('Kategória (hivatalos)', c.official ? c.fo + ' / ' + c.al : null),
      kv('Kategória (AI-javaslat)', c.official ? null : c.fo + ' / ' + c.al, c.official ? null : 'prov'),
      kv('Kategória útvonal', c.ut),
      kv('Kategória forrása', categoryOrigin(it, c))
    ])));

    body.appendChild(section('Becsült ár', [
      el('dl', { class: 'kvs' }, [
        kv('Nettó', fmt.huf(est.netto)),
        kv('Bruttó (27% ÁFA-val, becslés)', fmt.huf(est.brutto)),
        kv('Megfigyelve', fmt.date(est.datum)),
        kv('Forrás', est.forras)
      ]),
      est.ismert ? null : el('p', { class: 'note', text: 'Erre a tételre még nem láttunk árat egyetlen bizonylaton sem.' })
    ]));

    body.appendChild(section('Felhasználás', el('dl', { class: 'kvs' }, [
      kv('Rendelések száma', fmt.num(it.felhasznalas.rendelesek_szama)),
      kv('Összes rendelt mennyiség', fmt.num(it.felhasznalas.osszes_rendelt_mennyiseg) + (it.egyseg ? ' ' + it.egyseg : '')),
      kv('Első rendelés', fmt.date(it.felhasznalas.elso_rendeles)),
      kv('Utolsó rendelés', fmt.date(it.felhasznalas.utolso_rendeles))
    ])));

    // ---------------------------------------------------------- vendor
    body.appendChild(vendorSection(it, vendorId));

    // ------------------------------------------------------ provenance
    if (it.nev_valtozatok && it.nev_valtozatok.length > 1) {
      body.appendChild(section('Névváltozatok a forrásokban',
        el('ul', { class: 'plain' }, it.nev_valtozatok.map(n => el('li', { text: n })))));
    }
    // legacy_id is literally the vendor's article number, so it stays hidden in
    // neutral mode for the same reason the vendor block does
    body.appendChild(section('Forrás', el('dl', { class: 'kvs' }, [
      kv('Bizonylattípusok', it.forras),
      vendorId ? kv('Régi azonosító (Phase 0)', it.legacy_id) : null
    ].filter(Boolean))));

    root.hidden = false;
    root.focus();
  }

  /**
   * Where a category came from. Worth showing: an official one adopted from the
   * vendor's own catalogue, one inferred from a colour-variant sibling and one
   * the user typed are three different degrees of confidence.
   */
  function categoryOrigin(it, c) {
    if (!c.official) return 'AI-javaslat a megnevezés alapján — nem hivatalos';
    if ((it.overridden || []).includes('kategoria')) return 'saját besorolás';
    const f = it.kategoria && it.kategoria.forras;
    if (!f) return null;
    if (f.startsWith('daniella-webshop-testver')) {
      return `testvér termék alapján (${f.split(':')[1]}) — a webshop ezt a tételt akciós gyűjtőben tartja`;
    }
    return 'DANIELLA webshop';
  }

  /** Quantity of this item in the active order list. */
  function listSection(it) {
    const l = lists && lists.active();
    if (!l) {
      return section('Rendelési lista', el('p', { class: 'note', text: 'Nincs aktív lista. A „Listák” panelen hozhatsz létre egyet.' }), 'list-sect');
    }
    const n = lists.qty(it.vrg_id, l.id);
    const input = el('input', {
      type: 'number', min: '0', step: 'any', class: 'qty-input',
      onchange: e => { lists.setQty(it.vrg_id, e.target.value, l.id); onEdit(it.vrg_id); }
    });
    input.value = String(n);

    const pack = store.vendors.selectedId() ? store.vendors.read(it, 'v_kiszereles_db') : null;
    const packNote = pack && pack > 1
      ? el('p', { class: 'note', text: `A beszállító kiszerelése ${pack} ${it.egyseg || 'db'}.` })
      : null;

    return section(`Rendelési lista — ${l.nev}`, [
      el('div', { class: 'userbar' }, [
        el('button', { type: 'button', text: '+1', onclick: () => { lists.add(it.vrg_id, 1, l.id); onEdit(it.vrg_id); } }),
        pack && pack > 1
          ? el('button', { type: 'button', class: 'ghost', text: '+' + pack + ' (1 csomag)', onclick: () => { lists.add(it.vrg_id, pack, l.id); onEdit(it.vrg_id); } })
          : null,
        el('label', { class: 'mini-lbl' }, ['Mennyiség', input]),
        n ? el('button', { type: 'button', class: 'ghost tiny', text: 'levétel', onclick: () => { lists.setQty(it.vrg_id, 0, l.id); onEdit(it.vrg_id); } }) : null
      ].filter(Boolean)),
      packNote
    ], 'list-sect');
  }

  /** The only editable part of the drawer. Writes go to the userdata document,
   *  never to the catalogue — a data rebuild leaves all of this untouched. */
  function userSection(it) {
    const u = it.user || {};

    const fav = el('button', {
      type: 'button',
      class: 'ghost fav' + (u.kedvenc ? ' on' : ''),
      'aria-pressed': u.kedvenc ? 'true' : 'false',
      text: (u.kedvenc ? '★' : '☆') + ' Kedvenc',
      onclick: () => { userdata.set(it.vrg_id, 'kedvenc', !u.kedvenc); onEdit(it.vrg_id); }
    });

    const marks = el('div', { class: 'marks' }, MARKS.map(m => el('button', {
      type: 'button',
      class: 'markbtn mark-' + m + (u.jeloles === m ? ' on' : ''),
      title: MARK_LABEL[m],
      'aria-label': 'Jelölés: ' + MARK_LABEL[m],
      'aria-pressed': u.jeloles === m ? 'true' : 'false',
      text: '●',
      onclick: () => { userdata.set(it.vrg_id, 'jeloles', u.jeloles === m ? null : m); onEdit(it.vrg_id); }
    })).concat(el('button', {
      type: 'button', class: 'ghost tiny', text: 'törlés', title: 'Jelölés törlése',
      onclick: () => { userdata.set(it.vrg_id, 'jeloles', null); onEdit(it.vrg_id); }
    })));

    const note = el('textarea', {
      class: 'note-input', rows: '3', placeholder: 'Saját megjegyzés ehhez a tételhez…',
      oninput: e => userdata.set(it.vrg_id, 'megjegyzes', e.target.value.trim())
    });
    note.value = u.megjegyzes || '';

    const weight = el('input', {
      type: 'number', step: '0.001', min: '0', class: 'small-input', placeholder: 'kg',
      onchange: e => {
        const v = e.target.value === '' ? null : Number(e.target.value);
        userdata.set(it.vrg_id, 'tomeg_kg', Number.isFinite(v) ? v : null);
        onEdit(it.vrg_id);
      }
    });
    if (it.tomeg_kg != null) weight.value = String(it.tomeg_kg);

    const link = el('input', {
      type: 'url', class: 'wide-input', placeholder: 'https://…',
      onchange: e => { userdata.set(it.vrg_id, 'gyartoi_termek_link', e.target.value.trim() || null); onEdit(it.vrg_id); }
    });
    if (it.gyartoi_termek_link) link.value = it.gyartoi_termek_link;

    const edited = (it.overridden || []).length;

    return section('Saját adatok', [
      el('div', { class: 'userbar' }, [fav, marks]),
      note,
      el('div', { class: 'fieldrow' }, [
        el('label', { class: 'mini-lbl' }, ['Tömeg (kg)', weight]),
        el('label', { class: 'mini-lbl grow' }, ['Gyártói termék link', link])
      ]),
      edited ? el('p', { class: 'note edited-note' }, [
        `${edited} mezőt magad töltöttél ki — ezek a saját adataid közt élnek, adatfrissítéskor nem vesznek el. `,
        el('button', {
          type: 'button', class: 'ghost tiny', text: 'saját értékek elvetése',
          onclick: () => {
            for (const f of it.overridden) userdata.set(it.vrg_id, f, null);
            onEdit(it.vrg_id);
          }
        })
      ]) : null
    ], 'user-sect');
  }

  function vendorSection(it, vendorId) {
    if (!vendorId) {
      const carried = store.vendors.carriedBy(it);
      return section('Beszállítói adatok', el('p', { class: 'note' }, [
        'Semleges nézet: beszállítói cikkszám, ár, készlet és árelőzmény nem látszik. ',
        carried.length
          ? `Ezt a tételt ${carried.length} beszállító viszi a nyilvántartásban — válassz beszállítót a fenti listából.`
          : 'Ehhez a tételhez nincs beszállítói adat.'
      ]), 'vendor-empty');
    }

    const v = store.vendors.selectedVendor();
    const hist = (store.vendors.block(it) || {}).ar_elozmeny || [];
    const listaar = store.vendors.read(it, 'v_listaar');
    const netto = store.vendors.read(it, 'v_netto');
    const implied = discountPct(listaar, netto);

    const rows = hist.map(h => el('tr', {}, [
      el('td', { text: fmt.date(h.date) || '—' }),
      el('td', { class: 'id', text: h.order || '—' }),
      el('td', { class: 'num', text: fmt.huf(h.netto_egysegar) }),
      el('td', { class: 'muted', text: h.src })
    ]));

    return section(v.nev, [
      el('dl', { class: 'kvs' }, [
        kv('Cikkszám', store.vendors.read(it, 'v_cikkszam')),
        kv('Nettó egységár', fmt.huf(netto)),
        kv('Bruttó egységár', fmt.huf(store.vendors.read(it, 'v_brutto'))),
        kv('Listaár (nettó)', fmt.huf(listaar)),
        kv('Engedmény', fmt.pct(store.vendors.read(it, 'v_engedmeny'))
          + (implied != null ? ` (számítva: ${fmt.pct(implied)})` : '')),
        kv('Kiszerelés', store.vendors.read(it, 'v_kiszereles')),
        kv('Webshop bruttó ár', fmt.huf(store.vendors.read(it, 'v_aktualis_brutto'))),
        kv('Készlet', store.vendors.read(it, 'v_keszlet')),
        kv('Termék link', store.vendors.read(it, 'v_link')),
        kv('Ár ellenőrizve', fmt.date(store.vendors.read(it, 'v_ellenorizve')))
      ]),
      hist.length ? el('div', { class: 'spark-wrap' }, [
        sparkline(hist.map(h => h.netto_egysegar)),
        el('span', { class: 'note', text: hist.length === 1 ? '1 megfigyelés' : hist.length + ' megfigyelés' })
      ]) : null,
      hist.length ? el('table', { class: 'mini' }, [
        el('thead', {}, [el('tr', {}, ['Dátum', 'Bizonylat', 'Nettó egységár', 'Forrás'].map(h => el('th', { text: h })))]),
        el('tbody', {}, rows)
      ]) : el('p', { class: 'note', text: 'Nincs rögzített árelőzmény ennél a beszállítónál.' })
    ], 'vendor-sect');
  }

  return { root, show, close, isOpen: () => !root.hidden };
}

export { createDetail };
