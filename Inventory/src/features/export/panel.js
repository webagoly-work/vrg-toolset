// Export panel: pick a profile, see exactly what it will produce, then save,
// copy or print it.
//
// The preview is the point. An export you cannot see before sending is an
// export you will get wrong once and not notice.

import { el, clear, option } from '../../ui/dom.js';
import * as exporters from '../../core/io/exporters.js';
import { parseListCsv } from '../../core/io/importers.js';
import * as categories from '../../core/categories.js';
import * as fmt from '../../core/format.js';
import { catalogFields, listFields, visibleFields, pick } from './fields.js';

const FORMAT_LABEL = {
  csv: 'CSV (Excel)', tsv: 'TSV (tabulátor)', txt: 'Kétrétegű szöveg (ember + AI)',
  json: 'JSON', rendeles: 'Rendelés szövege a beszállítónak'
};

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function createExportPanel(opts) {
  const { store, lists, profiles, catalogColumns, onImported, onProfileChange } = opts;
  const ctx = { vendors: store.vendors };

  const CATALOG = catalogFields(catalogColumns);
  const LIST = listFields();
  const fieldsFor = target => (target === 'lista' ? LIST : CATALOG);

  let currentId = null;

  const profileSelect = el('select', {
    id: 'x-profile',
    onchange: e => { currentId = e.target.value; render(); announce(); }
  });

  function announce() {
    if (onProfileChange && currentId) onProfileChange(currentId);
  }
  const message = el('p', { class: 'note' });
  const preview = el('pre', { class: 'preview' });
  const summary = el('p', { class: 'note' });
  const fieldBox = el('div', { class: 'colpicker' });
  const catOrderBox = el('div', { class: 'catorder' });
  const importInput = el('input', {
    type: 'file', accept: '.csv,.tsv,.txt,text/csv', hidden: true,
    onchange: e => { const f = e.target.files[0]; if (f) importList(f); e.target.value = ''; }
  });

  function say(text, kind) {
    message.textContent = text || '';
    message.className = 'note' + (kind ? ' ' + kind : '');
  }

  function current() {
    const p = currentId ? profiles.get(currentId) : null;
    return p || profiles.all()[0] || null;
  }

  // ------------------------------------------------------------ building
  function rowsFor(profile) {
    if (profile.target === 'lista') {
      const rows = lists.rows();
      return order(rows, r => (r.item ? categories.key(r.item) : '(hiányzó tétel)'), profile);
    }
    const items = store.query({ sort: 'nev' });
    return order(items, it => categories.key(it), profile);
  }

  function order(rows, keyOf, profile) {
    const ordered = exporters.orderByCategory(rows, keyOf, profile.categoryOrder);
    if (profile.groupByCategory) return ordered;
    // no grouping asked for: keep a stable, meaningful order instead
    return rows.slice();
  }

  function build(profile) {
    const fields = pick(fieldsFor(profile.target), profile.columns, ctx);
    const rows = rowsFor(profile);
    const keyOf = profile.target === 'lista'
      ? r => (r.item ? categories.key(r.item) : '(hiányzó tétel)')
      : it => categories.key(it);
    const groupBy = profile.groupByCategory ? keyOf : null;
    const vendor = store.vendors.selectedVendor();

    if (profile.format === 'rendeles') {
      if (profile.target !== 'lista') throw new Error('A rendelés-formátum csak listához használható.');
      if (!vendor) throw new Error('Válassz beszállítót — rendelést nem lehet címzett nélkül kiírni.');
      const l = lists.active();
      const orderRows = lists.rows().filter(r => r.item).map(r => ({
        cikkszam: store.vendors.read(r.item, 'v_cikkszam'),
        mennyiseg: r.mennyiseg,
        egyseg: r.item.egyseg,
        megnevezes: r.item.megnevezes,
        megjegyzes: r.megjegyzes
      }));
      return {
        text: exporters.vendorOrder({
          rows: orderRows, vendor, listName: l && l.nev, note: l && l.megjegyzes, totals: lists.totals()
        }),
        ext: 'txt', rowCount: orderRows.length
      };
    }

    if (profile.format === 'json') {
      const payload = rows.map(r => {
        const o = {};
        for (const f of fields) o[f.id] = f.exportValue ? f.exportValue(r, ctx) : f.get(r, ctx);
        return o;
      });
      return { text: exporters.json({ payload }), ext: 'json', rowCount: rows.length };
    }

    if (profile.format === 'txt') {
      const l = profile.target === 'lista' ? lists.active() : null;
      return {
        text: exporters.dualText({
          title: profile.target === 'lista'
            ? `VRG RENDELÉSI LISTA — ${(l && l.nev) || 'névtelen'}`
            : 'VRG KÉSZLET-ADATBÁZIS — TÉTELLISTA',
          meta: {
            schema: profile.target === 'lista' ? 'vrg-order-list' : 'vrg-inventory',
            schema_version: store.doc.schema_version,
            generated: new Date().toISOString().slice(0, 10),
            currency: 'HUF',
            vat_rate: '0.27',
            vendor: vendor ? vendor.id : 'none'
          },
          preamble: vendor
            ? [`Árak: ${vendor.nev} nettó egységárai.`, 'A bruttó értékek 27% ÁFA-val számított becslések.']
            : ['Semleges nézet: beszállítói adat nélkül, becsült árakkal.',
              'A bruttó értékek 27% ÁFA-val számított becslések.'],
          aiNotes: [
            '@note  A list line owns only vrg_id and mennyiseg; names and prices are',
            '@note  resolved from the catalogue at export time and may change later.'
          ],
          rows, columns: fields, ctx, groupBy
        }),
        ext: 'txt', rowCount: rows.length
      };
    }

    const text = exporters.csv({
      rows, columns: fields, ctx,
      dialect: profile.format === 'tsv' ? 'tsv' : profile.dialect,
      header: profile.header,
      groupBy
    });
    return { text, ext: profile.format === 'tsv' ? 'tsv' : 'csv', rowCount: rows.length };
  }

  function safeBuild(profile) {
    try {
      const r = build(profile);
      say('');
      return r;
    } catch (e) {
      say(e.message, 'err-note');
      return null;
    }
  }

  // ------------------------------------------------------------- actions
  function download() {
    const p = current(); if (!p) return;
    const r = safeBuild(p); if (!r) return;
    const mime = r.ext === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    const blob = new Blob([r.text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `vrg-${p.target}-${stamp()}.${r.ext}` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Mentve: ${r.rowCount} sor, ${FORMAT_LABEL[p.format]}.`, 'ok-note');
  }

  function copy() {
    const p = current(); if (!p) return;
    const r = safeBuild(p); if (!r) return;
    const done = () => say(`Vágólapra másolva: ${r.rowCount} sor.`, 'ok-note');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(r.text).then(done, () => fallbackCopy(r.text, done));
    } else fallbackCopy(r.text, done);
  }

  function fallbackCopy(text, done) {
    const ta = el('textarea', { style: 'position:fixed;left:-9999px' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { say('A vágólapra másolás nem sikerült — jelöld ki az előnézetet és másold kézzel.', 'err-note'); }
    ta.remove();
  }

  function printView() {
    const p = current(); if (!p) return;
    const r = safeBuild(p); if (!r) return;
    const holder = document.getElementById('print-area') || el('div', { id: 'print-area' });
    clear(holder);
    holder.appendChild(el('h1', { text: p.nev }));
    holder.appendChild(el('pre', { text: r.text }));
    if (!holder.parentNode) document.body.appendChild(holder);
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  function importList(file) {
    const reader = new FileReader();
    reader.onerror = () => say('A fájlt nem sikerült beolvasni.', 'err-note');
    reader.onload = () => {
      let result;
      try {
        result = parseListCsv(String(reader.result), { knownId: id => !!store.get(id) });
      } catch (e) {
        return say('Importálás sikertelen: ' + e.message, 'err-note');
      }
      if (!result.lines.length) {
        return say(['Importálás sikertelen.'].concat(result.warnings).join(' '), 'err-note');
      }
      const name = prompt('Melyik listába kerüljenek a sorok? Írd be az új lista nevét:',
        file.name.replace(/\.[^.]+$/, ''));
      if (name === null) return say('Importálás megszakítva.');
      const l = lists.create(name);
      for (const line of result.lines) {
        lists.setQty(line.vrg_id, line.mennyiseg, l.id);
        if (line.megjegyzes) lists.setLineNote(line.vrg_id, line.megjegyzes, l.id);
      }
      onImported();
      render();
      say([`Importálva: ${result.lines.length} sor a(z) „${l.nev}” listába.`].concat(result.warnings).join(' '),
        result.warnings.length ? 'warn-note' : 'ok-note');
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------ profile UI
  function renderProfileSelect() {
    clear(profileSelect);
    for (const p of profiles.all()) {
      profileSelect.appendChild(option(p.id, `${p.nev} — ${p.target} / ${FORMAT_LABEL[p.format] || p.format}`,
        current() && p.id === current().id));
    }
  }

  function renderFields(p) {
    clear(fieldBox);
    const available = visibleFields(fieldsFor(p.target), ctx);
    const chosen = p.columns.filter(id => available.some(f => f.id === id));
    const rest = available.filter(f => !chosen.includes(f.id));

    fieldBox.appendChild(el('p', { class: 'note', text: 'Kiválasztott oszlopok — a sorrend az exportban is ez lesz. A beszállítói mezők csak kiválasztott beszállítónál jelennek meg.' }));
    for (const [i, id] of chosen.entries()) {
      const f = available.find(x => x.id === id);
      fieldBox.appendChild(el('div', { class: 'colrow' }, [
        el('span', { class: 'ord', text: String(i + 1) }),
        el('label', { class: f.vendor ? 'vendor-lbl' : null, text: f.label }),
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'tiny', text: '↑', title: 'előrébb', onclick: () => moveField(p, id, -1) }),
        el('button', { type: 'button', class: 'tiny', text: '↓', title: 'hátrébb', onclick: () => moveField(p, id, 1) }),
        el('button', { type: 'button', class: 'tiny ghost', text: '✕', title: 'elvétel', onclick: () => setColumns(p, chosen.filter(x => x !== id)) })
      ]));
    }
    if (rest.length) {
      const add = el('select', {
        onchange: e => { if (e.target.value) setColumns(p, chosen.concat([e.target.value])); }
      }, [option('', '+ oszlop hozzáadása', true)].concat(rest.map(f => option(f.id, f.label))));
      fieldBox.appendChild(el('div', { class: 'colrow' }, [add]));
    }
  }

  function setColumns(p, cols) {
    const saved = profiles.update(p.id, { columns: cols });
    currentId = saved.id;
    render();
  }

  function moveField(p, id, delta) {
    const cols = p.columns.slice();
    const i = cols.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= cols.length) return;
    cols.splice(i, 1); cols.splice(j, 0, id);
    setColumns(p, cols);
  }

  function renderCategoryOrder(p) {
    clear(catOrderBox);
    if (!p.groupByCategory) return;
    const present = [...new Set(rowsFor(p).map(r => {
      const it = p.target === 'lista' ? r.item : r;
      return it ? categories.key(it) : '(hiányzó tétel)';
    }))];
    const ranked = p.categoryOrder.filter(k => present.includes(k));
    const rest = present.filter(k => !ranked.includes(k)).sort((a, b) => a.localeCompare(b, 'hu'));

    catOrderBox.appendChild(el('p', { class: 'note', text: 'Kategóriák sorrendje a táblázatban. A be nem sorolt kategóriák ábécésorrendben követik a rangsoroltakat.' }));
    for (const [i, k] of ranked.entries()) {
      catOrderBox.appendChild(el('div', { class: 'colrow' }, [
        el('span', { class: 'ord', text: String(i + 1) }),
        el('label', { text: k }),
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'tiny', text: '↑', onclick: () => moveCat(p, k, -1) }),
        el('button', { type: 'button', class: 'tiny', text: '↓', onclick: () => moveCat(p, k, 1) }),
        el('button', { type: 'button', class: 'tiny ghost', text: '✕', onclick: () => setCats(p, ranked.filter(x => x !== k)) })
      ]));
    }
    if (rest.length) {
      const add = el('select', {
        onchange: e => { if (e.target.value) setCats(p, ranked.concat([e.target.value])); }
      }, [option('', '+ kategória rangsorolása', true)].concat(rest.map(k => option(k, k))));
      catOrderBox.appendChild(el('div', { class: 'colrow' }, [add]));
    }
  }

  function setCats(p, order) {
    const saved = profiles.update(p.id, { categoryOrder: order });
    currentId = saved.id;
    render();
  }

  function moveCat(p, key, delta) {
    const arr = p.categoryOrder.slice();
    const i = arr.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= arr.length) return;
    arr.splice(i, 1); arr.splice(j, 0, key);
    setCats(p, arr);
  }

  // --------------------------------------------------------------- render
  const settings = el('div', { class: 'controls' });

  function renderSettings(p) {
    clear(settings);
    const fmtSel = el('select', {
      onchange: e => { const s = profiles.update(p.id, { format: e.target.value }); currentId = s.id; render(); }
    }, Object.keys(FORMAT_LABEL)
      .filter(f => f !== 'rendeles' || p.target === 'lista')
      .map(f => option(f, FORMAT_LABEL[f], f === p.format)));

    const dialSel = el('select', {
      onchange: e => { const s = profiles.update(p.id, { dialect: e.target.value }); currentId = s.id; render(); }
    }, [
      option('excel-hu', 'Excel-HU (";" + tizedesvessző)', p.dialect === 'excel-hu'),
      option('standard', 'Szabványos ("," + tizedespont)', p.dialect === 'standard')
    ]);

    const groupCb = el('input', {
      type: 'checkbox', id: 'x-group', checked: p.groupByCategory || null,
      onchange: e => { const s = profiles.update(p.id, { groupByCategory: e.target.checked }); currentId = s.id; render(); }
    });
    const headCb = el('input', {
      type: 'checkbox', id: 'x-head', checked: p.header || null,
      onchange: e => { const s = profiles.update(p.id, { header: e.target.checked }); currentId = s.id; render(); }
    });

    settings.appendChild(el('label', {}, ['Formátum', fmtSel]));
    if (p.format === 'csv') settings.appendChild(el('label', {}, ['Nyelvjárás', dialSel]));
    settings.appendChild(el('label', { class: 'inline' }, [groupCb, el('span', { text: 'kategóriák szerint csoportosítva' })]));
    if (p.format === 'csv' || p.format === 'tsv') {
      settings.appendChild(el('label', { class: 'inline' }, [headCb, el('span', { text: 'fejléc sor' })]));
    }
    settings.appendChild(el('div', { class: 'spacer' }));
    settings.appendChild(el('button', {
      type: 'button', class: 'ghost', text: 'Profil másolása',
      onclick: () => {
        const n = prompt('Az új profil neve:', p.nev + ' (saját)');
        if (!n) return;
        const c = profiles.create(Object.assign({}, p, { nev: n }));
        currentId = c.id; render();
      }
    }));
    if (!p.builtin) {
      settings.appendChild(el('button', {
        type: 'button', class: 'ghost danger', text: 'Profil törlése',
        onclick: () => { if (confirm(`„${p.nev}” profil törlése?`)) { profiles.remove(p.id); currentId = null; render(); } }
      }));
    }
  }

  function render() {
    const p = current();
    renderProfileSelect();
    if (!p) { clear(preview); summary.textContent = ''; return; }
    currentId = p.id;
    renderSettings(p);
    renderFields(p);
    renderCategoryOrder(p);

    const r = safeBuild(p);
    clear(preview);
    if (r) {
      const lines = r.text.split('\n');
      const head = lines.slice(0, 40).join('\n');
      preview.textContent = head + (lines.length > 40 ? `\n… és további ${lines.length - 40} sor` : '');
      summary.textContent = `${r.rowCount} sor · ${(r.text.length / 1024).toFixed(1)} kB · ${FORMAT_LABEL[p.format]}`
        + (p.builtin ? ' · beépített profil — szerkesztésnél saját másolat készül' : '');
    } else {
      summary.textContent = '';
    }
  }

  const root = el('div', { class: 'panel export-panel', hidden: true }, [
    el('div', { class: 'controls' }, [
      el('label', { for: 'x-profile', class: 'grow' }, ['Export profil', profileSelect]),
      el('button', { type: 'button', onclick: download, text: '⭳ Mentés fájlba' }),
      el('button', { type: 'button', class: 'ghost', onclick: copy, text: '⧉ Vágólapra' }),
      el('button', { type: 'button', class: 'ghost', onclick: printView, text: '🖶 Nyomtatás' }),
      el('div', { class: 'spacer' }),
      el('button', { type: 'button', class: 'ghost', onclick: () => importInput.click(), text: '⭱ Lista importálása CSV-ből' })
    ]),
    settings,
    message,
    el('div', { class: 'export-cols' }, [fieldBox, catOrderBox]),
    summary,
    preview,
    importInput
  ]);

  render();
  return {
    root, render,
    /** Restore the profile the user last worked with. */
    select: id => { if (profiles.get(id)) { currentId = id; render(); return true; } return false; },
    toggle: () => { root.hidden = !root.hidden; if (!root.hidden) render(); return !root.hidden; },
    build: p => build(p || current())
  };
}

export { createExportPanel };
