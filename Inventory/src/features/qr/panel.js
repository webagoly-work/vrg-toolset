// QR panel: turn the active list, or one item, into something a phone can read.
//
// Targets are registered, the same shape the Planner uses, so adding one is a
// single call rather than a feature.

import { el, clear, option } from '../../ui/dom.js';
import { qrEncode, qrPng, qrBytes, QRCAP } from '../../core/qr.js';
import * as pay from '../../core/qrpayload.js';
import * as fmt from '../../core/format.js';

const ECC_LABEL = {
  L: 'L — legtöbb fér el (7% hibatűrés)',
  M: 'M — kiegyensúlyozott (15%)',
  Q: 'Q — strapabíró (25%)',
  H: 'H — legstrapabíróbb, legkevesebb fér el (30%)'
};

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function createQrPanel(opts) {
  const { store, lists, onImported } = opts;

  const state = { targetId: 'lista-szoveg', ecc: 'L', itemId: null };

  // ------------------------------------------------------------- targets
  const TARGETS = [
    {
      id: 'lista-szoveg',
      label: 'Rendelési lista — olvasható szöveg',
      hint: 'A telefon kamerája ezt elolvassa és továbbküldhetővé teszi. Kb. 40 sor fér bele.',
      text: () => {
        const l = lists.active();
        if (!l) throw new Error('Nincs aktív lista.');
        const vendor = store.vendors.selectedVendor();
        return pay.listText({
          nev: l.nev,
          rows: lists.rows(l.id),
          vendor,
          totals: lists.totals(l.id),
          vendorCode: item => (vendor ? store.vendors.read(item, 'v_cikkszam') : null)
        });
      }
    },
    {
      id: 'lista-adat',
      label: 'Rendelési lista — adat (visszaolvasható)',
      hint: 'Csak azonosítók és mennyiségek. Egy másik gépen a lenti mezőbe beillesztve visszaáll a lista. Több száz sor is elfér.',
      text: () => {
        const l = lists.active();
        if (!l) throw new Error('Nincs aktív lista.');
        return pay.encodeList({
          nev: l.nev,
          sorok: Object.entries(l.sorok).map(([id, r]) => ({ vrg_id: id, mennyiseg: r.mennyiseg }))
        });
      }
    },
    {
      id: 'tetel',
      label: 'Egy tétel adatai',
      hint: 'Polcra, dobozra ragasztható. A kiválasztott tétel adatai.',
      needsItem: true,
      text: () => {
        const it = state.itemId && store.get(state.itemId);
        if (!it) throw new Error('Válassz egy tételt a katalógusban.');
        const vid = store.vendors.selectedId();
        return pay.itemText(it, {
          vendorCode: vid ? store.vendors.read(it, 'v_cikkszam') : null,
          vendorNev: vid ? store.vendors.selectedVendor().nev : null,
          link: vid ? store.vendors.read(it, 'v_link') : null
        });
      }
    },
    {
      id: 'cim',
      label: 'Tetszőleges cím vagy szöveg',
      hint: 'Pl. egy helyi hálózaton futó kiszolgáló címe, amit nem akarsz kézzel begépelni a telefonba.',
      free: true,
      text: () => freeInput.value
    }
  ];

  const target = () => TARGETS.find(t => t.id === state.targetId) || TARGETS[0];

  // ---------------------------------------------------------------- UI
  const targetSelect = el('select', {
    id: 'qr-target',
    onchange: e => { state.targetId = e.target.value; render(); }
  }, TARGETS.map(t => option(t.id, t.label, t.id === state.targetId)));

  const eccSelect = el('select', {
    id: 'qr-ecc',
    onchange: e => { state.ecc = e.target.value; render(); }
  }, Object.keys(ECC_LABEL).map(k => option(k, ECC_LABEL[k], k === state.ecc)));

  const freeInput = el('input', {
    type: 'text', class: 'wide-input', placeholder: 'http://192.168.1.24:8123/  vagy bármilyen szöveg',
    oninput: () => render()
  });
  const freeWrap = el('label', { class: 'mini-lbl grow', hidden: true }, ['Tartalom', freeInput]);

  const codeBox = el('div', { class: 'qr-code' });
  const info = el('p', { class: 'note' });
  const payloadBox = el('pre', { class: 'preview qr-payload' });
  const hint = el('p', { class: 'note' });

  const importInput = el('textarea', {
    class: 'note-input', rows: '2',
    placeholder: 'Ide illeszd be a beolvasott lista-kódot (VRGL1|…), és megnyitom új listaként.'
  });

  // ------------------------------------------------------------ actions
  function build() {
    const t = target();
    try {
      const text = t.text();
      if (!text) return { err: 'Nincs mit kódolni.' };
      return { text, res: qrEncode(text, { ecc: state.ecc, border: 2 }) };
    } catch (e) {
      return { err: e.message };
    }
  }

  function downloadSvg() {
    const b = build();
    if (!b.res || !b.res.ok) return;
    const blob = new Blob([b.res.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    save(url, `vrg-qr-${state.targetId}-${stamp()}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPng() {
    const b = build();
    if (!b.res || !b.res.ok) return;
    const url = qrPng(b.text, { ecc: state.ecc, border: 2 }, 10);
    if (url) save(url, `vrg-qr-${state.targetId}-${stamp()}.png`);
  }

  function save(url, name) {
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function copyPayload() {
    const b = build();
    if (!b.text) return;
    const done = () => { info.textContent = 'A tartalom a vágólapon.'; info.className = 'note ok-note'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(b.text).then(done, done);
    } else done();
  }

  function importPayload() {
    const raw = importInput.value.trim();
    if (!raw) return;
    let parsed;
    try {
      parsed = pay.decodeList(raw, { knownId: id => !!store.get(id) });
    } catch (e) {
      info.textContent = 'Beolvasás sikertelen: ' + e.message;
      info.className = 'note err-note';
      return;
    }
    if (!parsed.sorok.length) {
      info.textContent = ['Nem találtam érvényes sort.'].concat(parsed.warnings).join(' ');
      info.className = 'note err-note';
      return;
    }
    const l = lists.create(parsed.nev || 'Beolvasott lista');
    for (const r of parsed.sorok) lists.setQty(r.vrg_id, r.mennyiseg, l.id);
    importInput.value = '';
    onImported();
    render();
    info.textContent = [`Beolvasva: ${parsed.sorok.length} sor a(z) „${l.nev}” listába.`]
      .concat(parsed.warnings).join(' ');
    info.className = 'note ' + (parsed.warnings.length ? 'warn-note' : 'ok-note');
  }

  // ----------------------------------------------------------- rendering
  function render() {
    const t = target();
    freeWrap.hidden = !t.free;
    hint.textContent = t.hint;

    if (t.needsItem) {
      const it = state.itemId && store.get(state.itemId);
      hint.textContent = it
        ? `${t.hint} Kiválasztva: ${it.megnevezes}`
        : `${t.hint} — kattints egy sorra a katalógusban.`;
    }

    const b = build();
    clear(codeBox);
    clear(payloadBox);

    if (b.err) {
      info.textContent = b.err;
      info.className = 'note err-note';
      return;
    }
    payloadBox.textContent = b.text.length > 1200 ? b.text.slice(0, 1200) + '\n…' : b.text;

    const bytes = qrBytes(b.text);
    if (!b.res.ok) {
      // only suggest lowering the error correction if there is room to lower it
      const canLower = state.ecc !== 'L';
      const fixes = (canLower ? 'Állítsd a hibatűrést L-re, vagy ' : 'Vedd ki a felesleges sorokat, vagy ')
        + 'küldd fájlként az Export panelről — egy telefon kamerája úgysem tud '
        + 'több kódot egyetlen listává összerakni.'
        + (state.targetId === 'lista-szoveg' ? ' (A „lista — adat” kódba jóval több fér.)' : '');
      info.textContent = b.res.err + ` (${bytes} bájt, a határ ECC ${state.ecc} mellett kb. ${QRCAP[state.ecc]}.) ` + fixes;
      info.className = 'note err-note';
      codeBox.appendChild(el('div', { class: 'qr-toobig', text: 'nem fér el' }));
      return;
    }

    const wrap = el('div', { class: 'qr-svg' });
    wrap.innerHTML = b.res.svg;          // our own generated markup, no user text inside
    codeBox.appendChild(wrap);

    const pct = Math.round((bytes / QRCAP[state.ecc]) * 100);
    info.textContent = `${bytes} bájt · a férőképesség ${pct}%-a · ${b.res.n}×${b.res.n} modul · verzió ${b.res.version} · ECC ${state.ecc}`;
    info.className = 'note' + (pct > 85 ? ' warn-note' : '');
  }

  const root = el('div', { class: 'panel qr-panel', hidden: true }, [
    el('div', { class: 'controls' }, [
      el('label', { for: 'qr-target', class: 'grow' }, ['Mit kódoljunk?', targetSelect]),
      el('label', { for: 'qr-ecc' }, ['Hibatűrés', eccSelect]),
      freeWrap,
      el('div', { class: 'spacer' }),
      el('button', { type: 'button', class: 'ghost', onclick: copyPayload, text: '⧉ Tartalom másolása' }),
      el('button', { type: 'button', class: 'ghost', onclick: downloadSvg, text: '⭳ SVG' }),
      el('button', { type: 'button', class: 'ghost', onclick: downloadPng, text: '⭳ PNG' })
    ]),
    hint,
    el('div', { class: 'qr-layout' }, [codeBox, payloadBox]),
    info,
    el('div', { class: 'qr-import' }, [
      el('label', { class: 'mini-lbl' }, ['Lista-kód beolvasása', importInput]),
      el('button', { type: 'button', onclick: importPayload, text: 'Lista megnyitása a kódból' })
    ])
  ]);

  return {
    root, render,
    setItem: id => { state.itemId = id; if (!root.hidden) render(); },
    toggle: () => { root.hidden = !root.hidden; if (!root.hidden) render(); return !root.hidden; }
  };
}

export { createQrPanel };
