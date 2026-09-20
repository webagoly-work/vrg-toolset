// "Saját adatok" panel: what is stored, and how to move it between copies.
//
// The promise this panel has to keep: export here, import into a fresh copy of
// the HTML, and you are exactly where you left off.

import { el, clear } from '../../ui/dom.js';
import { sanitize, USERDATA_VERSION } from '../../core/userdata.js';

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function createUserDataPanel(opts) {
  const { store, userdata, storage, onImported, onReset } = opts;

  const summary = el('div', { class: 'stats' });
  const message = el('p', { class: 'note' });
  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: e => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; }
  });

  function say(text, kind) {
    message.textContent = text;
    message.className = 'note' + (kind ? ' ' + kind : '');
  }

  function refresh() {
    const s = userdata.stats();
    const st = store.stats();
    clear(summary);
    const box = (v, l, cls) => summary.appendChild(el('div', { class: 'stat' + (cls ? ' ' + cls : '') }, [
      el('b', { text: String(v) }), el('span', { text: l })
    ]));
    box(s.tetelek, 'tétel saját adattal');
    box(s.kedvencek, 'kedvenc');
    box(s.megjegyzessel, 'megjegyzés');
    box(s.jelolessel, 'jelölés');
    box(s.felulirt_mezok, 'saját mezőérték');
    box(st.tomeggel, 'tömeg kitöltve');
  }

  function download() {
    const doc = userdata.serialize();
    const json = JSON.stringify(doc, null, 1);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `vrg-sajat-adatok-${stamp()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Mentve: ${Object.keys(doc.items).length} tétel saját adata (séma ${USERDATA_VERSION}).`, 'ok-note');
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onerror = () => say('A fájlt nem sikerült beolvasni.', 'err-note');
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        return say('A fájl nem érvényes JSON.', 'err-note');
      }
      let result;
      try {
        result = sanitize(parsed, id => !!store.get(id));
      } catch (e) {
        return say('Importálás sikertelen: ' + e.message, 'err-note');
      }
      const count = Object.keys(result.doc.items).length;
      if (!confirm(`Importálás: ${count} tétel saját adata.\n\nEz felülírja a jelenlegi saját adataidat ezen a gépen. Folytatod?`)) {
        return say('Importálás megszakítva.', null);
      }
      userdata.replace(result.doc);
      onImported(result.doc);
      refresh();
      say([`Importálva: ${count} tétel.`].concat(result.warnings).join(' '),
        result.warnings.length ? 'warn-note' : 'ok-note');
    };
    reader.readAsText(file);
  }

  function reset() {
    if (!confirm('Minden saját adat törlése ezen a gépen: megjegyzések, kedvencek, jelölések, saját mezőértékek.\n\nExportáltad már? Ez nem vonható vissza.')) return;
    userdata.reset();
    storage.clearAll();
    onReset();
    refresh();
    say('Saját adatok törölve ezen a gépen.', 'warn-note');
  }

  const root = el('div', { class: 'panel userdata-panel', hidden: true }, [
    el('div', { class: 'controls' }, [
      el('button', { type: 'button', onclick: download, text: '⭳ Saját adatok mentése fájlba' }),
      el('button', { type: 'button', onclick: () => fileInput.click(), text: '⭱ Saját adatok betöltése' }),
      el('div', { class: 'spacer' }),
      el('button', { type: 'button', class: 'ghost danger', onclick: reset, text: 'Törlés ezen a gépen' })
    ]),
    summary,
    message,
    el('p', {
      class: 'note',
      text: storage.available
        ? 'A saját adataid ebben a böngészőben tárolódnak, ezen a gépen. Másik gépre vagy a HTML új példányába a mentett fájllal viszed át őket — a katalógus adatai külön élnek, adatfrissítéskor a saját adataid megmaradnak.'
        : 'FIGYELEM: ez a böngésző nem engedi a helyi tárolást, ezért a saját adataid csak addig élnek, amíg nyitva van az oldal. Munka végén mentsd ki őket fájlba.'
    }),
    fileInput
  ]);

  refresh();
  return { root, refresh, toggle: () => { root.hidden = !root.hidden; if (!root.hidden) refresh(); return !root.hidden; } };
}

export { createUserDataPanel };
