// "Árellenőrzés" — load a price check, review what it would change, apply it,
// and keep the finance log.
//
// Nothing is written until you have seen the diff. The plan is computed and
// shown first; only then does the Apply button do anything.

import { el, clear } from '../../ui/dom.js';
import * as fmt from '../../core/format.js';
import * as pc from '../../core/pricecheck.js';

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function createPriceCheckPanel(opts) {
  const { store, userdata, onApplied } = opts;
  let plan = null;

  const message = el('p', { class: 'note' });
  const planBox = el('div');
  const logBox = el('div');
  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: e => { const f = e.target.files[0]; if (f) load(f); e.target.value = ''; }
  });

  function say(text, kind) {
    message.textContent = text || '';
    message.className = 'note' + (kind ? ' ' + kind : '');
  }

  const applyBtn = el('button', {
    type: 'button', disabled: true, text: 'Változások alkalmazása',
    onclick: () => apply()
  });

  // ------------------------------------------------------------- loading
  function load(file) {
    const reader = new FileReader();
    reader.onerror = () => say('A fájlt nem sikerült beolvasni.', 'err-note');
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { return say('A fájl nem érvényes JSON.', 'err-note'); }

      let check;
      try {
        check = pc.parseCheck(parsed, {
          knownId: id => !!store.get(id),
          knownVendor: v => store.vendors.list().some(x => x.id === v)
        });
      } catch (e) { return say('Betöltés sikertelen: ' + e.message, 'err-note'); }

      plan = pc.planCheck(check, store);
      applyBtn.disabled = plan.valtozasok.length + plan.ujak.length + plan.valtozatlan.length === 0;
      renderPlan();
      const w = check.warnings.length ? ' ' + check.warnings.slice(0, 3).join(' ') : '';
      say(`Betöltve: ${check.tetelek.length} tétel, ${check.datum}, ${vendorName(check.vendor)}.` + w,
        check.warnings.length ? 'warn-note' : 'ok-note');
    };
    reader.readAsText(file);
  }

  const vendorName = id => {
    const v = store.vendors.list().find(x => x.id === id);
    return v ? v.nev : id;
  };

  // -------------------------------------------------------------- apply
  function apply() {
    if (!plan) return;
    const n = plan.valtozasok.length;
    if (n && !confirm(`${n} tétel ára változott. Alkalmazod?\n\n` +
      `Ez a saját adataidba ír — a katalógusfájl nem módosul.`)) return;

    const res = pc.applyPlan(plan, userdata);
    store.remergeAll();
    onApplied();

    const promptNeeded = pc.needsSavePrompt(userdata);
    say(`Alkalmazva: ${res.irt} tétel frissítve, ${res.naplo} naplóbejegyzés.`, 'ok-note');

    if (promptNeeded) {
      offerSave({ valtozasok: res.naplo, tetelek: res.irt });
    } else {
      const last = (userdata.doc.saveLog || []).slice(-1)[0];
      say(`Alkalmazva: ${res.irt} tétel frissítve, ${res.naplo} naplóbejegyzés. ` +
        `Ma már mentettél (${last.datum}), ezért nem kérdezek rá újra.`, 'ok-note');
    }
    plan = null;
    applyBtn.disabled = true;
    renderPlan();
    renderLog();
  }

  function offerSave(info) {
    if (!confirm('Mentsem ki a pénzügyi naplót és a saját adataidat fájlba?\n\n' +
      'Ma még nem mentettél. Ez az árváltozások dokumentuma.')) {
      say('Nem mentettél — a naplót később is kimentheted innen.', 'warn-note');
      return;
    }
    downloadLog();
    pc.recordSave(userdata, info);
    renderLog();
  }

  function downloadLog() {
    const doc = {
      schema: 'vrg-finance-log',
      schema_version: '1.0.0',
      generated: new Date().toISOString(),
      megjegyzes: 'Árváltozások naplója. A katalógus a jelen állapotot írja le, ez a napló az eseményeket.',
      osszegzes: pc.logSummary(userdata, store),
      bejegyzesek: userdata.doc.financeLog || []
    };
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `vrg-penzugyi-naplo-${stamp()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------ rendering
  function renderPlan() {
    clear(planBox);
    if (!plan) return;

    const box = (v, l, cls) => el('div', { class: 'stat' + (cls ? ' ' + cls : '') }, [
      el('b', { text: String(v) }), el('span', { text: l })
    ]);
    planBox.appendChild(el('div', { class: 'stats' }, [
      box(plan.valtozasok.length, 'ár változott', plan.valtozasok.length ? 'gap' : ''),
      box(plan.emelkedes, 'drágult'),
      box(plan.csokkenes, 'olcsóbb lett'),
      box(plan.ujak.length, 'első mérés'),
      box(plan.valtozatlan.length, 'változatlan'),
      box(plan.kihagyva.length, 'kihagyva', plan.kihagyva.length ? 'gap' : '')
    ]));

    if (plan.valtozasok.length) {
      planBox.appendChild(el('table', { class: 'mini' }, [
        el('thead', {}, [el('tr', {}, ['VRG', 'Megnevezés', 'Eddig', 'Most', 'Változás', '%']
          .map((h, i) => el('th', { class: i >= 2 ? 'num' : null, text: h })))]),
        el('tbody', {}, plan.valtozasok.map(v => el('tr', {}, [
          el('td', { class: 'id', text: v.vrg_id }),
          el('td', { text: v.megnevezes }),
          el('td', { class: 'num', text: fmt.huf(v.regi_brutto) }),
          el('td', { class: 'num', text: fmt.huf(v.uj_brutto) }),
          el('td', { class: 'num ' + (v.valtozas_huf > 0 ? 'up' : 'down'), text: (v.valtozas_huf > 0 ? '+' : '') + fmt.huf(v.valtozas_huf) }),
          el('td', { class: 'num ' + (v.valtozas_huf > 0 ? 'up' : 'down'), text: (v.valtozas_szazalek > 0 ? '+' : '') + fmt.pct(v.valtozas_szazalek) })
        ])))
      ]));
    } else {
      planBox.appendChild(el('p', { class: 'note', text: 'Egyetlen ár sem változott az utolsó ellenőrzés óta.' }));
    }

    if (plan.kihagyva.length) {
      planBox.appendChild(el('details', {}, [
        el('summary', { text: `${plan.kihagyva.length} tétel kihagyva` }),
        el('ul', { class: 'plain' }, plan.kihagyva.slice(0, 40).map(k =>
          el('li', { text: `${k.vrg_id} — ${k.ok}` })))
      ]));
    }
  }

  function renderLog() {
    const s = pc.logSummary(userdata, store);
    clear(logBox);
    if (!s.bejegyzesek) {
      logBox.appendChild(el('p', { class: 'note', text: 'A pénzügyi napló még üres. Az első alkalmazott árváltozás kerül bele.' }));
      return;
    }
    logBox.appendChild(el('div', { class: 'stats' }, [
      ['b', s.bejegyzesek, 'naplóbejegyzés'], ['b', s.erintett_tetelek, 'érintett tétel'],
      ['b', s.emelkedes, 'drágulás'], ['b', s.csokkenes, 'árcsökkenés'],
      ['b', fmt.pct(s.atlagos_valtozas_szazalek), 'átlagos változás'],
      ['b', s.utolso || '—', 'utolsó']
    ].map(([, v, l]) => el('div', { class: 'stat' }, [el('b', { text: String(v) }), el('span', { text: l })]))));

    const log = (userdata.doc.financeLog || []).slice().reverse().slice(0, 60);
    logBox.appendChild(el('table', { class: 'mini' }, [
      el('thead', {}, [el('tr', {}, ['Dátum', 'VRG', 'Eddig', 'Most', 'Változás', '%']
        .map((h, i) => el('th', { class: i >= 2 ? 'num' : null, text: h })))]),
      el('tbody', {}, log.map(e => el('tr', {}, [
        el('td', { text: fmt.date(String(e.datum).slice(0, 10)) }),
        el('td', { class: 'id', text: e.vrg_id }),
        el('td', { class: 'num', text: fmt.huf(e.regi_brutto) }),
        el('td', { class: 'num', text: fmt.huf(e.uj_brutto) }),
        el('td', { class: 'num ' + (e.valtozas_huf > 0 ? 'up' : 'down'), text: (e.valtozas_huf > 0 ? '+' : '') + fmt.huf(e.valtozas_huf) }),
        el('td', { class: 'num ' + (e.valtozas_huf > 0 ? 'up' : 'down'), text: (e.valtozas_szazalek > 0 ? '+' : '') + fmt.pct(e.valtozas_szazalek) })
      ])))
    ]));
    if ((userdata.doc.financeLog || []).length > 60) {
      logBox.appendChild(el('p', { class: 'note', text: 'A legutóbbi 60 bejegyzés látszik; a teljes napló a kimentett fájlban van.' }));
    }
  }

  const root = el('div', { class: 'panel pricecheck-panel', hidden: true }, [
    el('div', { class: 'controls' }, [
      el('button', { type: 'button', onclick: () => fileInput.click(), text: '⭱ Ellenőrzés betöltése' }),
      applyBtn,
      el('div', { class: 'spacer' }),
      el('button', { type: 'button', class: 'ghost', onclick: () => { downloadLog(); say('Napló kimentve.', 'ok-note'); }, text: '⭳ Pénzügyi napló mentése' })
    ]),
    el('p', {
      class: 'note',
      text: 'Az árellenőrzést a tools/pricecheck.js futtatja (a böngésző nem érheti el a beszállító oldalát). ' +
        'Az eredményfájlt töltsd be ide. Csak a webshop bruttó ára és a készlet frissül — a megrendeléseinkből ismert partner-árat semmi nem írja felül.'
    }),
    message,
    planBox,
    el('h3', { class: 'log-head', text: 'Pénzügyi napló' }),
    logBox,
    fileInput
  ]);

  renderLog();
  return {
    root,
    render: () => { renderPlan(); renderLog(); },
    toggle: () => { root.hidden = !root.hidden; if (!root.hidden) { renderPlan(); renderLog(); } return !root.hidden; }
  };
}

export { createPriceCheckPanel };
