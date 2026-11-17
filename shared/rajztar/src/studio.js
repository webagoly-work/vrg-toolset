// studio.js — Rajztár Stúdió: package wizard (Csomag), sheet editor (Lap), symbol editor (Jelek).
// Runs from one generated HTML file (build.js inlines the data as window.RAJZTAR and render.js as
// window.Rajztar). Offline; state lives in localStorage when the page is served, and always in an
// exportable project JSON, because file:// gives no storage (CLAUDE.md, Testing browser apps).
(function () {
  'use strict';
  const DB = window.RAJZTAR, RZ = window.Rajztar;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r2 = (v, g) => Math.round(v / g) * g;
  const fmtNum = (v) => +(+v).toFixed(2);
  const F = DB.formats, D = DB.documents;
  const DOC = Object.fromEntries(D.docTypes.map((d) => [d.id, d]));
  const KEY = 'rajztar.studio.v1';

  // ------------------------------------------------------------------ state
  const blankProject = () => ({
    v: 1,
    meta: { client: '', site: '', office: 'Varler Villamos', generalDesigner: '', jobNo: '', part: 'Épületvillamosság', date: today(),
      people: [{ role: 'Felelős tervező', name: '', lic: '' }, { role: 'Tervező munkatárs', name: '', lic: '' }, { role: 'Szerkesztette', name: '', lic: '' }, { role: 'Ellenőrizte', name: '', lic: '' }] },
    cls: 'haz', phase: 'kiviteli', levels: '0', flags: {}, optional: {},
    sheets: [], cur: null, symOverrides: {}
  });
  function today() { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }
  let P = load() || blankProject();
  function load() { try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* file:// — export instead */ } }, 250); }

  // symbols: the built library, with the project's edits laid over it
  const BASE = Object.fromEntries(DB.symbols.items.map((s) => [s.id, s]));
  const sym = (id) => P.symOverrides[id] || BASE[id];
  const allSyms = () => { const m = Object.assign({}, BASE, P.symOverrides); return Object.values(m); };

  // ------------------------------------------------------------------ tabs
  function showTab(t) {
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $$('.pane').forEach((p) => (p.hidden = p.id !== 'pane-' + t));
    if (t === 'pkg') renderPkg(); if (t === 'sheet') renderSheetPane(); if (t === 'sym') renderSymPane();
    try { sessionStorage.setItem('rajztar.tab', t); } catch (e) { }
  }

  // ==================================================================================================
  // 1 · CSOMAG — the package wizard
  // ==================================================================================================
  // Which project flag turns a 'C' (conditional) document on. Docs not listed stay off unless ticked.
  const COND = {
    D03E: { flag: 'permit', hu: 'Engedélyköteles építés' },
    D07: { flag: 'feedChange', hu: 'Betáp / védelem változik', only: ['panel'] },
    D13: { flag: 'control', hu: 'Vezérlés van (lépcsőház, szivattyú, HFR, gépek)' },
    D19: { flag: 'fire', hu: 'Tűzjelző előírt (OTSZ / hatóság)' },
    D20: { flag: 'emergency', hu: 'Biztonsági világítás előírt (OTSZ)' },
    D21: { flag: 'lightning', hu: 'Villámvédelem kell (kockázat / OTSZ)' },
    D23: { flag: 'meterChange', hu: 'Mérőhely / teljesítmény változik', only: ['panel'] },
    D26: { flag: 'automation', hu: 'Épületautomatika / gépészeti automatika' },
    D29: { flag: 'pv', hu: 'Napelem (PV)' },
    D30: { flag: 'ev', hu: 'EV töltő' },
    D33: { flag: 'renovation', hu: 'Felújítás (meglévő állapot)' },
    D35: { flag: 'mv', hu: 'Saját KÖF / transzformátor' }
  };
  const PER_LEVEL = new Set(['D15', 'D16', 'D17', 'D19', 'D20', 'D33']);
  const SZAK = { D17: 'VG', D18: 'VG', D19: 'VT', D20: 'VB', D21: 'VL', D22: 'VL', D35: 'VK', D26: 'VA' };
  const GROUP = (d) => d.id === 'D10' ? '6' : ['D12', 'D13', 'D14', 'D34'].includes(d.id) ? '3' : ({ szoveges: '0', alaprajz: '1', sema: '2', nezet: '3', reszlet: '4', lista: '5', szamitas: '0', dokumentacio: '9' }[d.group] || '0');
  function levelName(l) { l = String(l).trim(); if (l === 'T') return 'Tető'; if (l === '-1') return 'Pince'; if (l === '0') return 'Földszint'; if (/^-?\d+$/.test(l)) return (+l < 0 ? l + '. pinceszint' : l + '. emelet'); return l; }
  function levels() { return String(P.levels || '0').split(/[,;\s]+/).filter(Boolean); }

  // The register: every document the chosen class + phase + flags call for, numbered.
  function register() {
    const pkg = D.packages[P.cls] || [];
    const ids = D.docTypes.map((d) => d.id).filter((id) => pkg.includes(id) || DOC[id].need[P.cls] !== '-');
    const rows = [];
    const seq = {};
    for (const id of D.docTypes.map((d) => d.id)) {
      if (!ids.includes(id)) continue;
      const d = DOC[id], need = d.need[P.cls];
      if (P.phase && !(d.phases || []).includes(P.phase) && !(P.phase === 'megvalosulasi' && (d.phases || []).includes('kiviteli'))) continue;
      let on, why;
      if (need === 'R') { on = true; why = 'kötelező'; }
      else if (need === 'C') { const c = COND[id]; on = !!(c && P.flags[c.flag]) || !!P.optional[id]; why = c ? (P.flags[c.flag] ? 'feltétel: ' + c.hu : 'feltételes – ' + (c.hu || d.cond)) : 'feltételes – ' + (d.cond || ''); }
      else if (need === 'O') { on = !!P.optional[id]; why = 'ajánlott'; }
      else { on = !!P.optional[id]; why = 'nem jellemző'; }
      const szak = SZAK[id] || 'V', grp = GROUP(d);
      const per = PER_LEVEL.has(id) ? levels() : [null];
      for (const lv of per) {
        const k = szak + grp; seq[k] = (seq[k] || 0) + (on ? 1 : 0);
        rows.push({ id, d, need, on, why, lv, no: on ? `${szak}-${grp}${String(seq[k]).padStart(2, '0')}` : '', title: d.hu + (lv != null ? ' – ' + levelName(lv) : '') });
      }
    }
    return rows;
  }

  function renderPkg() {
    const m = P.meta;
    $('#pkg-form').innerHTML = `
      <fieldset><legend>Projekt</legend>
        ${inp('meta.client', 'Építtető (név, cím)', m.client)}
        ${inp('meta.site', 'Létesítés helye (cím, hrsz.)', m.site)}
        ${inp('meta.office', 'Tervező iroda (név, cím, elérhetőség)', m.office)}
        ${inp('meta.generalDesigner', 'Generáltervező (ha eltér)', m.generalDesigner)}
        <div class="row2">${inp('meta.jobNo', 'Munkaszám', m.jobNo)}${inp('meta.date', 'Dátum', m.date)}</div>
        ${inp('meta.part', 'Munkarész', m.part)}
      </fieldset>
      <fieldset><legend>Készítők (MMK 4. G)</legend>
        ${m.people.map((p, i) => `<div class="row2"><label>${esc(p.role)}<input data-k="people.${i}.name" value="${esc(p.name)}" placeholder="név"></label><label>Jogosultság<input data-k="people.${i}.lic" value="${esc(p.lic)}" placeholder="pl. V 01-0000"></label></div>`).join('')}
      </fieldset>
      <fieldset><legend>Feladat</legend>
        <label>Projektosztály<select data-k="cls">${D.projectClasses.map((c) => `<option value="${c.id}"${c.id === P.cls ? ' selected' : ''}>${esc(c.hu)}</option>`).join('')}</select></label>
        <p class="hint">${esc((D.projectClasses.find((c) => c.id === P.cls) || {}).designDuty || '')}</p>
        <label>Tervfázis<select data-k="phase">${D.phases.map((p) => `<option value="${p.id}"${p.id === P.phase ? ' selected' : ''}>${esc(p.hu)}</option>`).join('')}</select></label>
        <p class="hint">${esc((D.phases.find((p) => p.id === P.phase) || {}).note || '')}</p>
        <label>Szintek (vesszővel: -1, 0, 1 … T)<input data-k="levels" value="${esc(P.levels)}"></label>
        <div class="flags">${Object.entries(COND).filter(([id, c]) => DOC[id].need[P.cls] === 'C' && (!c.only || c.only.includes(P.cls))).map(([id, c]) => `<label class="ck"><input type="checkbox" data-flag="${c.flag}"${P.flags[c.flag] ? ' checked' : ''}> ${esc(c.hu)}</label>`).join('') || '<p class="hint">Ennél az osztálynál nincs feltételes lap.</p>'}</div>
      </fieldset>`;
    $$('#pkg-form [data-k]').forEach((el) => el.addEventListener('change', () => { setPath(el.dataset.k, el.value); save(); renderPkg(); }));
    $$('#pkg-form [data-flag]').forEach((el) => el.addEventListener('change', () => { P.flags[el.dataset.flag] = el.checked; save(); renderPkg(); }));

    const rows = register();
    const made = new Set(P.sheets.map((s) => s.key));
    const missing = rows.filter((r) => r.on && r.need === 'R' && !made.has(rowKey(r)) && isDrawing(r.d));
    $('#pkg-sum').innerHTML = `<b>${rows.filter((r) => r.on).length}</b> dokumentum a csomagban · <b>${rows.filter((r) => r.on && isDrawing(r.d)).length}</b> rajzlap · <span class="${missing.length ? 'bad' : 'good'}">${missing.length ? missing.length + ' kötelező rajzlap még nincs elkészítve' : 'minden kötelező rajzlap megvan'}</span>`;
    $('#pkg-reg tbody').innerHTML = rows.map((r) => {
      const k = rowKey(r), has = made.has(k);
      return `<tr class="${r.on ? '' : 'off'}"><td><input type="checkbox" data-opt="${r.id}"${r.on ? ' checked' : ''}${r.need === 'R' ? ' disabled' : ''} aria-label="Csomagba"></td>
      <td><code>${esc(r.no)}</code></td><td>${esc(r.title)}<small>${esc(r.why)}${r.d.clause ? ' · MMK ' + esc(r.d.clause) : ''}</small></td>
      <td class="nd n-${r.need === '-' ? 'x' : r.need}">${r.need === '-' ? '·' : r.need}</td><td class="sh">${esc(r.d.sheet || '')}</td>
      <td>${!isDrawing(r.d) ? '<span class="hint">szöveges</span>' : r.on ? (has ? `<button class="lnk" data-open="${esc(k)}">Megnyitás</button>` : `<button data-make="${esc(k)}">Lap létrehozása</button>`) : ''}</td></tr>`;
    }).join('');
    $$('#pkg-reg [data-opt]').forEach((el) => el.addEventListener('change', () => { P.optional[el.dataset.opt] = el.checked; save(); renderPkg(); }));
    $$('#pkg-reg [data-make]').forEach((el) => el.addEventListener('click', () => { const r = rows.find((x) => rowKey(x) === el.dataset.make); makeSheet(r); showTab('sheet'); }));
    $$('#pkg-reg [data-open]').forEach((el) => el.addEventListener('click', () => { P.cur = P.sheets.find((s) => s.key === el.dataset.open).uid; save(); showTab('sheet'); }));
    $('#pkg-all').onclick = () => { for (const r of rows) if (r.on && isDrawing(r.d) && !made.has(rowKey(r))) makeSheet(r); renderPkg(); };
    // print copy of the register (D02 tervjegyzék)
    $('#print-register').innerHTML = `<h1>Tartalomjegyzék és tervjegyzék</h1><p>${esc(m.client)} · ${esc(m.site)} · ${esc((D.phases.find((p) => p.id === P.phase) || {}).hu)} · munkaszám ${esc(m.jobNo)} · ${esc(m.date)}</p>
      <table><thead><tr><th>Rajzszám</th><th>Megnevezés</th><th>Lap</th><th>Méretarány</th><th>Index</th><th>Dátum</th></tr></thead><tbody>${rows.filter((r) => r.on).map((r) => { const s = P.sheets.find((x) => x.key === rowKey(r)); return `<tr><td>${esc(r.no)}</td><td>${esc(r.title)}</td><td>${esc(s ? s.size : r.d.sheet || 'A4')}</td><td>${esc(s ? s.scale : '–')}</td><td>${esc(s ? lastRev(s) : '–')}</td><td>${esc(s ? s.date || m.date : m.date)}</td></tr>`; }).join('')}</tbody></table>`;
  }
  const isDrawing = (d) => !['szoveges', 'szamitas'].includes(d.group) && d.id !== 'D08' && d.id !== 'D32' && d.id !== 'D36';
  const rowKey = (r) => r.id + (r.lv != null ? '@' + r.lv : '');
  const lastRev = (s) => (s.revs && s.revs.length ? s.revs[s.revs.length - 1].idx : '–');
  function inp(k, label, v) { return `<label>${esc(label)}<input data-k="${k}" value="${esc(v)}"></label>`; }
  function setPath(k, v) {
    if (k.startsWith('people.')) { const [, i, f] = k.split('.'); P.meta.people[+i][f] = v; return; }
    if (k.startsWith('meta.')) { P.meta[k.slice(5)] = v; return; }
    P[k] = v;
  }

  function defaultSize(d) { const m = String(d.sheet || '').match(/A\d(x\d)?/); return m ? m[0] : 'A3'; }
  function makeSheet(r) {
    const d = r.d, size = defaultSize(d);
    const sc = d.scale ? F.scales.byDocType[d.scale][0] : '–';
    const s = { uid: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key: rowKey(r), docId: d.id, no: r.no, title: r.title, size, orient: size === 'A4' ? 'portrait' : 'landscape', scale: sc, date: P.meta.date, revs: [], items: [], legendRef: '' };
    P.sheets.push(s); P.cur = s.uid; save(); return s;
  }

  // ==================================================================================================
  // 2 · LAP — the sheet editor
  // ==================================================================================================
  const SIZES = Object.fromEntries(F.sheets.series.concat(F.sheets.elongated).map((s) => [s.id, s]));
  const cur = () => P.sheets.find((s) => s.uid === P.cur) || null;
  let tool = 'select', selIdx = -1, wireDraft = null, placeSym = null, zoom = 0;

  function sheetDims(s) { const z = SIZES[s.size] || SIZES.A3; const land = s.orient !== 'portrait'; return land ? { W: Math.max(z.w, z.h), H: Math.min(z.w, z.h) } : { W: Math.min(z.w, z.h), H: Math.max(z.w, z.h) }; }
  const isSchem = (s) => ['sema', 'lista'].includes((DOC[s.docId] || {}).group);
  const pens = (s) => (isSchem(s) ? F.lines.groups.schematic : F.lines.groups.plan);

  function renderSheetPane() {
    const s = cur();
    $('#sheet-list').innerHTML = P.sheets.length ? P.sheets.map((x) => `<li><button class="${x.uid === P.cur ? 'on' : ''}" data-uid="${x.uid}"><code>${esc(x.no || '—')}</code> ${esc(x.title)}</button></li>`).join('') : '<li class="hint">Még nincs lap. Hozz létre a Csomag fülön, vagy adj hozzá üreset.</li>';
    $$('#sheet-list [data-uid]').forEach((b) => b.onclick = () => { P.cur = b.dataset.uid; selIdx = -1; save(); renderSheetPane(); });
    $('#sheet-empty').hidden = !!s; $('#sheet-work').hidden = !s;
    if (!s) return;
    const docOpts = D.docTypes.filter(isDrawing).map((d) => `<option value="${d.id}"${d.id === s.docId ? ' selected' : ''}>${d.id} ${esc(d.hu)}</option>`).join('');
    $('#sheet-props').innerHTML = `
      <label>Rajzszám<input data-sp="no" value="${esc(s.no)}"></label>
      <label>Tervlap címe<input data-sp="title" value="${esc(s.title)}"></label>
      <label>Dokumentumtípus<select data-sp="docId">${docOpts}</select></label>
      <div class="row2"><label>Lapméret<select data-sp="size">${Object.keys(SIZES).map((k) => `<option${k === s.size ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Tájolás<select data-sp="orient"><option value="landscape"${s.orient !== 'portrait' ? ' selected' : ''}>fekvő</option><option value="portrait"${s.orient === 'portrait' ? ' selected' : ''}>álló</option></select></label></div>
      <div class="row2"><label>Méretarány<select data-sp="scale">${['–'].concat(F.scales.allowed).map((k) => `<option${k === s.scale ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Dátum<input data-sp="date" value="${esc(s.date)}"></label></div>
      <label>Jelmagyarázat másik lapon (rajzszám, üres = ezen a lapon)<input data-sp="legendRef" value="${esc(s.legendRef || '')}"></label>
      <fieldset><legend>Módosítások</legend>
        ${(s.revs || []).map((r, i) => `<div class="rev"><input data-rv="${i}.idx" value="${esc(r.idx)}" aria-label="Index"><input data-rv="${i}.desc" value="${esc(r.desc)}" aria-label="Leírás"><input data-rv="${i}.date" value="${esc(r.date)}" aria-label="Dátum"><button data-rvdel="${i}" aria-label="Törlés">×</button></div>`).join('')}
        <button id="rev-add">+ módosítás</button></fieldset>
      <div class="btns"><button id="sheet-print" class="pri">Nyomtatás / PDF</button><button id="sheet-svg">SVG mentése</button><button id="sheet-del" class="danger">Lap törlése</button></div>`;
    $$('#sheet-props [data-sp]').forEach((el) => el.addEventListener('change', () => { s[el.dataset.sp] = el.value; save(); renderSheetPane(); }));
    $$('#sheet-props [data-rv]').forEach((el) => el.addEventListener('change', () => { const [i, f] = el.dataset.rv.split('.'); s.revs[+i][f] = el.value; save(); drawSheet(); }));
    $$('#sheet-props [data-rvdel]').forEach((el) => el.onclick = () => { s.revs.splice(+el.dataset.rvdel, 1); save(); renderSheetPane(); });
    $('#rev-add').onclick = () => { const n = (s.revs || []).length; (s.revs = s.revs || []).push({ idx: 'R' + String(n + 1).padStart(2, '0'), desc: n ? '' : 'Kiadás', date: today(), by: '', chk: '' }); save(); renderSheetPane(); };
    $('#sheet-print').onclick = () => printSheet(s);
    $('#sheet-svg').onclick = () => download(`${(s.no || 'lap').replace(/[^\w.-]+/g, '_')}.svg`, sheetSvg(s, false), 'image/svg+xml');
    $('#sheet-del').onclick = () => { if (confirm('Biztosan törlöd ezt a lapot?')) { P.sheets = P.sheets.filter((x) => x !== s); P.cur = P.sheets[0] ? P.sheets[0].uid : null; save(); renderSheetPane(); } };
    renderPalette(s); renderInspector(s); drawSheet();
  }

  function renderPalette(s) {
    const cats = (DOC[s.docId] || {}).symbols || Object.keys(DB.symbols.categories);
    const q = ($('#pal-q').value || '').toLowerCase();
    const list = allSyms().filter((x) => (cats.includes(x.cat) || q) && (!q || (x.id + ' ' + x.hu).toLowerCase().includes(q)));
    $('#palette').innerHTML = list.map((x) => `<button class="pal${placeSym === x.id ? ' on' : ''}" data-sym="${x.id}" title="${esc(x.hu)}">${RZ.symbolToSvg(x, { px: 3.2, formats: F, pad: 0.6 })}<span>${esc(x.hu)}</span></button>`).join('');
    $$('#palette [data-sym]').forEach((b) => b.onclick = () => { placeSym = b.dataset.sym; setTool('place'); renderPalette(s); });
  }
  function setTool(t) { tool = t; if (t !== 'place') placeSym = null; if (t !== 'wire') wireDraft = null; $$('.tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); $('#sheet-canvas').dataset.tool = t; drawSheet(); }

  function renderInspector(s) {
    const it = s.items[selIdx];
    const el = $('#inspector');
    if (!it) { el.innerHTML = '<p class="hint">Kattints egy elemre a kijelöléshez. Billentyűk: R forgatás · Del törlés · nyilak 2,5 mm · Esc. Vonal: pontonként kattints, az utolsó pontra még egyszer (vagy Enter) zár.</p>'; return; }
    const x = it.t === 'sym' ? sym(it.sym) : null;
    el.innerHTML = `<b>${esc(x ? x.hu : it.t === 'wire' ? 'Vonal' : 'Felirat')}</b>
      <label>${it.t === 'text' ? 'Szöveg' : 'Felirat / tervjel'}<input id="it-label" value="${esc(it.label || '')}"></label>
      ${it.t === 'sym' ? `<label>Forgatás<select id="it-rot">${[0, 90, 180, 270].map((r) => `<option${(it.rot || 0) === r ? ' selected' : ''}>${r}</option>`).join('')}</select></label>` : ''}
      ${it.t === 'wire' ? `<label>Vonalfajta<select id="it-lt">${F.lines.types.map((l) => `<option value="${l.id}"${l.id === it.lt ? ' selected' : ''}>${l.id} ${esc(l.name)}</option>`).join('')}</select></label>` : ''}
      ${it.t === 'text' ? `<label>Betűmagasság<select id="it-h">${F.lettering.heights.map((h) => `<option${(it.h || 2.5) === h ? ' selected' : ''}>${h}</option>`).join('')}</select></label>` : ''}
      <button id="it-del" class="danger">Törlés</button>`;
    $('#it-label').onchange = (e) => { it.label = e.target.value; save(); drawSheet(); };
    if ($('#it-rot')) $('#it-rot').onchange = (e) => { it.rot = +e.target.value; save(); drawSheet(); };
    if ($('#it-lt')) $('#it-lt').onchange = (e) => { it.lt = e.target.value; save(); drawSheet(); };
    if ($('#it-h')) $('#it-h').onchange = (e) => { it.h = +e.target.value; save(); drawSheet(); };
    $('#it-del').onclick = () => { s.items.splice(selIdx, 1); selIdx = -1; save(); renderInspector(s); drawSheet(); };
  }

  // ---- the sheet as SVG, in millimetres. 'live' adds selection marks and hit targets.
  function sheetSvg(s, live) {
    const { W, H } = sheetDims(s), pg = pens(s);
    const ML = 20, MO = 10, fx = ML, fy = MO, fw = W - ML - MO, fh = H - 2 * MO;
    const parts = [];
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="none"/>`);
    parts.push(`<rect x="0.1" y="0.1" width="${W - 0.2}" height="${H - 0.2}" fill="none" stroke="#000" stroke-width="0.18"/>`);
    parts.push(`<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="#000" stroke-width="${F.sheets.frame.frameLine}"/>`);
    // centring marks: from the trimmed edge to 5 mm inside the frame
    const cm = F.sheets.frame.centringMarks.beyondFrame;
    parts.push(`<g stroke="#000" stroke-width="0.7"><line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${fy + cm}"/><line x1="${W / 2}" y1="${H}" x2="${W / 2}" y2="${H - MO - cm}"/><line x1="0" y1="${H / 2}" x2="${fx + cm}" y2="${H / 2}"/><line x1="${W}" y1="${H / 2}" x2="${W - MO - cm}" y2="${H / 2}"/></g>`);
    // grid reference zones (ISO 5457): an even number of fields of about 50 mm (A4: 25 mm)
    const fl = s.size === 'A4' ? F.sheets.frame.gridReference.a4FieldLength : F.sheets.frame.gridReference.fieldLength;
    const nx = Math.max(2, Math.round(fw / fl / 2) * 2), ny = Math.max(2, Math.round(fh / fl / 2) * 2);
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const zg = [];
    for (let i = 0; i <= nx; i++) { const x = fx + (fw / nx) * i; zg.push(`<line x1="${x}" y1="${fy}" x2="${x}" y2="${fy - 5}"/><line x1="${x}" y1="${fy + fh}" x2="${x}" y2="${fy + fh + 5}"/>`); if (i < nx) { const tx = x + fw / nx / 2; zg.push(`<text x="${tx}" y="${fy - 1.6}">${i + 1}</text><text x="${tx}" y="${fy + fh + 4.1}">${i + 1}</text>`); } }
    for (let j = 0; j <= ny; j++) { const y = fy + (fh / ny) * j; zg.push(`<line x1="${fx}" y1="${y}" x2="${fx - 5}" y2="${y}"/><line x1="${fx + fw}" y1="${y}" x2="${fx + fw + 5}" y2="${y}"/>`); if (j < ny) { const ty = y + fh / ny / 2 + 1.2; zg.push(`<text x="${fx - 2.5}" y="${ty}">${letters[j]}</text><text x="${fx + fw + 2.5}" y="${ty}">${letters[j]}</text>`); } }
    parts.push(`<g stroke="#000" stroke-width="0.35" font-size="3.5" text-anchor="middle" font-family="Bahnschrift,DIN,Arial,sans-serif">${zg.join('').replace(/<text /g, '<text stroke="none" fill="#000" ')}</g>`);
    // title block bottom-right on the frame
    const lay = F.titleBlock.layouts['mmk-180x62'];
    const tbx = fx + fw - lay.w, tby = fy + fh - lay.h;
    const vals = titleValues(s);
    parts.push(`<g transform="translate(${tbx},${tby})" color="#000">${stripSvg(RZ.titleBlockToSvg(lay, F.titleBlock.mandatoryFields, vals, { px: 1 }))}</g>`);
    // revision table above the title block, newest on top
    let top = tby;
    const revs = (s.revs || []);
    if (revs.length) {
      const cols = F.revisionTable.columns, rh = F.revisionTable.rowHeight;
      const rows = [{ idx: 'Index', desc: 'Módosítás leírása', date: 'Dátum', by: 'Készítette', chk: 'Ellenőrizte', head: true }].concat(revs.slice().reverse().map((r) => Object.assign({ by: '', chk: '' }, r)));
      top -= rows.length * rh;
      const g = [];
      rows.slice().reverse().forEach((r, i) => { const y = tby - (i + 1) * rh; let cx = tbx; for (const c of cols) { g.push(`<rect x="${cx}" y="${y}" width="${c.w}" height="${rh}"/>`); g.push(`<text x="${cx + 1}" y="${y + rh - 1.5}" font-size="${r.head ? 1.8 : 2.2}" ${r.head ? 'opacity=".62"' : ''}>${esc(r[c.key] || '')}</text>`); cx += c.w; } });
      parts.push(`<g fill="none" stroke="#000" stroke-width="0.25" font-family="Bahnschrift,DIN,Arial,sans-serif">${g.join('').replace(/<text /g, '<text stroke="none" fill="#000" ')}</g>`);
    }
    // legend above that: only the symbols actually used on this sheet
    const used = [...new Set(s.items.filter((i) => i.t === 'sym').map((i) => i.sym))].map(sym).filter(Boolean);
    if (s.legendRef) { top -= 7; parts.push(`<text x="${tbx + 1}" y="${top + 4.6}" font-size="2.5" font-family="Bahnschrift,DIN,Arial,sans-serif">Jelmagyarázat: lásd ${esc(s.legendRef)} rajzszámú lapot.</text>`); }
    else if (used.length) {
      const rh = 7, n = used.length; top -= (n + 1) * rh + 1;
      const g = [`<text x="${tbx + 1}" y="${top + 4.6}" font-size="2.5" font-weight="600">JELMAGYARÁZAT</text>`, `<line x1="${tbx}" y1="${top + rh}" x2="${tbx + 180}" y2="${top + rh}" stroke="#000" stroke-width="0.25"/>`];
      used.forEach((x, i) => {
        const y = top + rh * (i + 1); const k = Math.min(1, 9 / Math.max(x.w, x.h * 1.2), 6 / x.h);
        g.push(`<g transform="translate(${tbx + 2 + (12 - x.w * k) / 2},${y + (rh - x.h * k) / 2}) scale(${k})" color="#000">${RZ.symbolToGroup(x, { formats: F })}</g>`);
        const code = x.code || (x.refdes ? '-' + x.refdes : '');
        g.push(`<text x="${tbx + 16}" y="${y + 4.6}" font-size="2.2">${esc(code)}</text><text x="${tbx + 28}" y="${y + 4.6}" font-size="2.5">${esc(x.hu)}${x.params && x.params.ip ? ', ' + esc(x.params.ip) : ''}</text>`);
      });
      parts.push(`<g font-family="Bahnschrift,DIN,Arial,sans-serif" fill="#000">${g.join('')}</g><rect x="${tbx}" y="${top}" width="180" height="${(n + 1) * rh}" fill="none" stroke="#000" stroke-width="0.35"/>`);
    }
    // scale bar on plans (formats.scales.scaleBar)
    const m = String(s.scale).match(/^1:(\d+)$/);
    if (m && !isSchem(s)) {
      const k = 1000 / +m[1]; const segs = [0, 1, 2, 5]; const bx = fx + 6, by = fy + fh - 8;
      const g = [`<line x1="${bx}" y1="${by}" x2="${bx + 5 * k}" y2="${by}" stroke-width="0.35"/>`];
      segs.forEach((v) => g.push(`<line x1="${bx + v * k}" y1="${by - 1.2}" x2="${bx + v * k}" y2="${by + 1.2}" stroke-width="0.25"/><text x="${bx + v * k}" y="${by + 4.2}" font-size="2.2" text-anchor="middle" stroke="none" fill="#000">${v}</text>`));
      g.push(`<text x="${bx + 5 * k + 3}" y="${by + 0.9}" font-size="2.5" stroke="none" fill="#000">m · M ${esc(s.scale)} @ ${esc(s.size)}</text>`);
      parts.push(`<g stroke="#000" font-family="Bahnschrift,DIN,Arial,sans-serif">${g.join('')}</g>`);
    }
    // the drawing content
    const cont = [];
    s.items.forEach((it, i) => {
      const sel = live && i === selIdx;
      if (it.t === 'sym') {
        const x = sym(it.sym); if (!x) return;
        const a = x.anchor || [x.w / 2, x.h / 2];
        cont.push(`<g data-i="${i}" transform="translate(${it.x},${it.y}) rotate(${it.rot || 0}) translate(${-a[0]},${-a[1]})" color="#000">${live ? `<rect x="-1" y="-1" width="${x.w + 2}" height="${x.h + 2}" fill="transparent" stroke="${sel ? '#b5452f' : 'none'}" stroke-width="0.3" stroke-dasharray="1 0.8"/>` : ''}${RZ.symbolToGroup(x, { formats: F })}</g>`);
        if (it.label) cont.push(`<text data-i="${i}" x="${it.x + x.w / 2 + 1.5}" y="${it.y - x.h / 2 + 1}" font-size="2.5" font-family="Bahnschrift,DIN,Arial,sans-serif" fill="#000">${esc(it.label)}</text>`);
      } else if (it.t === 'wire') {
        const lt = F.lines.types.find((l) => l.id === it.lt) || F.lines.types[1];
        const wdt = lt.id.endsWith('.2') ? pg.wide : pg.narrow;
        const dash = lt.dash ? `stroke-dasharray="${lt.dash.map((v) => fmtNum(v * wdt)).join(' ')}"` : '';
        const d = 'M' + it.pts.map((p) => p.join(' ')).join(' L');
        cont.push(`<g data-i="${i}">${live ? `<path d="${d}" fill="none" stroke="transparent" stroke-width="3"/>` : ''}<path d="${d}" fill="none" stroke="${sel ? '#b5452f' : '#000'}" stroke-width="${wdt}" ${dash} stroke-linecap="round" stroke-linejoin="round"/></g>`);
        if (it.label) { const [p, q] = [it.pts[0], it.pts[1] || it.pts[0]]; cont.push(`<text x="${(p[0] + q[0]) / 2}" y="${(p[1] + q[1]) / 2 - 1.2}" font-size="2.5" text-anchor="middle" font-family="Bahnschrift,DIN,Arial,sans-serif" fill="#000">${esc(it.label)}</text>`); }
      } else if (it.t === 'text') {
        cont.push(`<text data-i="${i}" x="${it.x}" y="${it.y}" font-size="${it.h || 2.5}" font-family="Bahnschrift,DIN,Arial,sans-serif" fill="${sel ? '#b5452f' : '#000'}">${esc(it.label || '')}</text>`);
      }
    });
    if (live && wireDraft && wireDraft.pts.length) cont.push(`<path d="M${wireDraft.pts.map((p) => p.join(' ')).join(' L')}${wireDraft.hover ? ' L' + wireDraft.hover.join(' ') : ''}" fill="none" stroke="#b5452f" stroke-width="0.35" stroke-dasharray="1 1"/>`);
    parts.push(`<g id="content">${cont.join('')}</g>`);
    const gridPat = live ? `<defs><pattern id="g25" width="2.5" height="2.5" patternUnits="userSpaceOnUse"><path d="M2.5 0 H0 V2.5" fill="none" stroke="#e8e2d8" stroke-width="0.08"/></pattern></defs><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="url(#g25)"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" data-w="${W}" data-h="${H}">${parts[0]}${gridPat}${parts.slice(1).join('')}</svg>`;
  }
  function stripSvg(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
  function titleValues(s) {
    const PH = { tanulmany: 'TANULMÁNY', engedelyezesi: 'ENGEDÉLYEZÉSI', csatlakozasi: 'CSATLAKOZÁSI', kiviteli: 'KIVITELI', gyartmany: 'GYÁRTMÁNY', megvalosulasi: 'MEGVALÓSULÁSI', felulvizsgalat: 'FELÜLVIZSGÁLATI' };
    const m = P.meta, v = { client: m.client, site: m.site, office: m.office, phase: PH[P.phase] || '', part: m.part, jobNo: m.jobNo, title: s.title, scale: s.scale === '–' ? 'M: –' : `M ${s.scale} @ ${s.size}`, date: s.date || m.date, docType: (DOC[s.docId] || {}).hu ? shortDoc(DOC[s.docId]) : '', sheetNo: `${s.no || ''}${(s.revs || []).length ? ' · ' + lastRev(s) : ''}` };
    m.people.forEach((p, i) => { v['people.' + i] = [p.name, p.lic].filter(Boolean).join(' · '); });
    return v;
  }
  function shortDoc(d) { const t = d.hu.split(/[–(]/)[0].trim(); return t.length > 18 ? t.slice(0, 17) + '…' : t; }

  function drawSheet() {
    const s = cur(); if (!s) return;
    const host = $('#sheet-canvas');
    host.innerHTML = sheetSvg(s, true);
    const svg = host.firstElementChild, { W } = sheetDims(s);
    const fit = (host.clientWidth - 24) / W;
    const z = zoom || fit;
    svg.setAttribute('width', W * z); svg.removeAttribute('height');
    svg.style.height = 'auto';
    $('#zoom-val').textContent = Math.round((z / (96 / 25.4)) * 100) + '%';
  }

  function toMm(ev) { const svg = $('#sheet-canvas svg'); const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; }
  // Bound once to the host: drawSheet() replaces the <svg> on every change, so listeners on the svg
  // itself would die in the middle of a drag.
  function bindCanvas() {
    const host = $('#sheet-canvas');
    let drag = null;
    host.addEventListener('pointerdown', (ev) => {
      const s = cur(); if (!s || !ev.target.closest('svg')) return;
      const [x, y] = toMm(ev), g = 2.5;
      if (tool === 'place' && placeSym) { s.items.push({ t: 'sym', sym: placeSym, x: r2(x, g), y: r2(y, g), rot: 0, label: '' }); selIdx = s.items.length - 1; save(); drawSheet(); renderInspector(s); return; }
      // A second click on the last point ends the line. (dblclick never fires here: drawSheet()
      // replaces the svg between the two clicks, so they land on different elements.)
      if (tool === 'wire') {
        const pt = [r2(x, g), r2(y, g)]; wireDraft = wireDraft || { pts: [] };
        const last = wireDraft.pts[wireDraft.pts.length - 1];
        if (last && last[0] === pt[0] && last[1] === pt[1]) { finishWire(s); return; }
        wireDraft.pts.push(pt); drawSheet(); return;
      }
      if (tool === 'text') { const t = prompt('Felirat:'); if (t) { s.items.push({ t: 'text', x: r2(x, g), y: r2(y, g), label: t, h: 2.5 }); selIdx = s.items.length - 1; save(); } drawSheet(); renderInspector(s); return; }
      const hit = ev.target.closest('[data-i]');
      selIdx = hit ? +hit.dataset.i : -1; renderInspector(s);
      if (hit) { const it = s.items[selIdx]; drag = { x0: x, y0: y, it, orig: it.t === 'wire' ? it.pts.map((p) => p.slice()) : [it.x, it.y] }; host.setPointerCapture(ev.pointerId); }
      drawSheet();
    });
    host.addEventListener('pointermove', (ev) => {
      if (!cur() || !$('#sheet-canvas svg')) return;
      const [x, y] = toMm(ev);
      if (tool === 'wire' && wireDraft) { wireDraft.hover = [r2(x, 2.5), r2(y, 2.5)]; drawSheet(); return; }
      if (!drag) return;
      const dx = r2(x - drag.x0, 2.5), dy = r2(y - drag.y0, 2.5);
      if (drag.it.t === 'wire') drag.it.pts = drag.orig.map((p) => [p[0] + dx, p[1] + dy]); else { drag.it.x = drag.orig[0] + dx; drag.it.y = drag.orig[1] + dy; }
      drawSheet();
    });
    host.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });  }
  function finishWire(s) { if (wireDraft && wireDraft.pts.length >= 2) { const pts = wireDraft.pts.filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]); if (pts.length >= 2) { s.items.push({ t: 'wire', pts, lt: $('#wire-lt').value, label: '' }); selIdx = s.items.length - 1; save(); } } wireDraft = null; drawSheet(); renderInspector(s); }

  document.addEventListener('keydown', (ev) => {
    if ($('#pane-sheet').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const s = cur(); if (!s) return;
    if (ev.key === 'Escape') { if (wireDraft) { wireDraft = null; } else { selIdx = -1; setTool('select'); } drawSheet(); renderInspector(s); return; }
    if (ev.key === 'Enter' && wireDraft) { finishWire(s); return; }
    const it = s.items[selIdx]; if (!it) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { s.items.splice(selIdx, 1); selIdx = -1; }
    else if (ev.key === 'r' || ev.key === 'R') { if (it.t === 'sym') it.rot = ((it.rot || 0) + 90) % 360; }
    else if (ev.key.startsWith('Arrow')) { const d = { ArrowLeft: [-2.5, 0], ArrowRight: [2.5, 0], ArrowUp: [0, -2.5], ArrowDown: [0, 2.5] }[ev.key]; if (it.t === 'wire') it.pts = it.pts.map((p) => [p[0] + d[0], p[1] + d[1]]); else { it.x += d[0]; it.y += d[1]; } ev.preventDefault(); }
    else return;
    save(); drawSheet(); renderInspector(s);
  });

  function printSheet(s) {
    const { W, H } = sheetDims(s);
    $('#print-sheet').innerHTML = sheetSvg(s, false);
    let st = $('#page-size'); if (!st) { st = document.createElement('style'); st.id = 'page-size'; document.head.appendChild(st); }
    st.textContent = `@page{size:${W}mm ${H}mm;margin:0}`;
    document.body.dataset.print = 'sheet'; window.print();
  }
  window.addEventListener('afterprint', () => { delete document.body.dataset.print; const st = $('#page-size'); if (st) st.textContent = ''; });

  // ==================================================================================================
  // 4 · JELEK — the symbol editor
  // ==================================================================================================
  let edId = null, edDraft = null, addPort = false;
  function renderSymPane() {
    const q = ($('#sym-q').value || '').toLowerCase();
    const items = allSyms().filter((x) => !q || (x.id + ' ' + x.hu + ' ' + x.en).toLowerCase().includes(q));
    $('#sym-list').innerHTML = items.map((x) => `<li><button class="${x.id === edId ? 'on' : ''}" data-id="${x.id}">${RZ.symbolToSvg(x, { px: 2.4, formats: F, pad: 0.5 })}<span>${esc(x.hu)}<small>${esc(x.id)}${P.symOverrides[x.id] ? ' · <b>módosítva</b>' : ''}</small></span></button></li>`).join('');
    $$('#sym-list [data-id]').forEach((b) => b.onclick = () => { edId = b.dataset.id; edDraft = JSON.parse(JSON.stringify(sym(edId))); renderSymPane(); });
    $('#sym-count').textContent = `${Object.keys(P.symOverrides).length} módosított / új jel`;
    $('#sym-ed').hidden = !edDraft; $('#sym-none').hidden = !!edDraft;
    if (edDraft) renderEditor();
  }
  function renderEditor() {
    const x = edDraft, cats = DB.symbols.categories, confs = DB.symbols.confidence;
    $('#ed-fields').innerHTML = `
      <div class="row2"><label>Azonosító<input data-e="id" value="${esc(x.id)}"></label><label>Kategória<select data-e="cat">${Object.entries(cats).map(([k, v]) => `<option value="${k}"${k === x.cat ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
      <label>Magyar név<input data-e="hu" value="${esc(x.hu)}"></label><label>Angol név<input data-e="en" value="${esc(x.en)}"></label>
      <div class="row3"><label>Szélesség (mm)<input type="number" step="0.5" data-e="w" value="${x.w}"></label><label>Magasság (mm)<input type="number" step="0.5" data-e="h" value="${x.h}"></label><label>Tervjel betű<input data-e="refdes" value="${esc(x.refdes || '')}"></label></div>
      <div class="row2"><label>Bizonyosság<select data-e="conf">${Object.entries(confs).map(([k, v]) => `<option value="${k}"${k === x.conf ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>Fal (alaprajzi jel)<select data-e="wall"><option value=""${!x.wall ? ' selected' : ''}>nincs</option><option value="bottom"${x.wall === 'bottom' ? ' selected' : ''}>alsó él</option></select></label></div>
      <label>Rajz (SVG elemek; osztályok: f kitöltés · w vastag · dot pontozott · t szöveg)<textarea data-e="body" rows="7" spellcheck="false">${esc(x.body)}</textarea></label>
      <label>Megjegyzés (jelmagyarázatba)<input data-e="note" value="${esc(x.note || '')}"></label>
      <fieldset><legend>Csatlakozási pontok</legend>${(x.ports || []).map((p, i) => `<div class="port"><input data-p="${i}.id" value="${esc(p.id)}" aria-label="Azonosító"><input type="number" step="0.5" data-p="${i}.x" value="${p.x}" aria-label="x"><input type="number" step="0.5" data-p="${i}.y" value="${p.y}" aria-label="y"><select data-p="${i}.dir" aria-label="Irány">${['up', 'down', 'left', 'right', 'any'].map((d) => `<option${d === p.dir ? ' selected' : ''}>${d}</option>`).join('')}</select><button data-pdel="${i}" aria-label="Törlés">×</button></div>`).join('')}
        <label class="ck"><input type="checkbox" id="ed-addport"${addPort ? ' checked' : ''}> Pont hozzáadása kattintással az előnézeten</label></fieldset>`;
    $$('#ed-fields [data-e]').forEach((el) => el.addEventListener('input', () => { const k = el.dataset.e; x[k] = ['w', 'h'].includes(k) ? +el.value : (k === 'wall' ? (el.value || null) : el.value); if (k === 'refdes' && !el.value) x.refdes = null; drawPreview(); }));
    $$('#ed-fields [data-p]').forEach((el) => el.addEventListener('change', () => { const [i, f] = el.dataset.p.split('.'); x.ports[+i][f] = ['x', 'y'].includes(f) ? +el.value : el.value; drawPreview(); }));
    $$('#ed-fields [data-pdel]').forEach((el) => el.onclick = () => { x.ports.splice(+el.dataset.pdel, 1); renderEditor(); });
    $('#ed-addport').onchange = (e) => { addPort = e.target.checked; };
    drawPreview();
  }
  function lint(x) {
    const out = [];
    if (!/^[a-z]+\.[a-z0-9-]+$/.test(x.id)) out.push('Az azonosító formája: kategória.név (kisbetű, kötőjel).');
    if (!x.id.startsWith(x.cat + '.')) out.push(`Az azonosító „${x.cat}.” előtaggal kezdődjön.`);
    const rest = x.body.replace(/<text\b[^>]*>[^<]*<\/text>/g, '').replace(/<\/?(path|rect|circle|ellipse|line|polygon|g)\b[^>]*>/g, '');
    if (/[<>]/.test(rest)) out.push('A rajzban ismeretlen elem van (csak path, rect, circle, ellipse, line, polygon, g, text).');
    const bad = (x.body.match(/class='([^']+)'/g) || []).map((m) => m.slice(7, -1)).filter((c) => !['f', 'w', 'dot', 't'].includes(c));
    if (bad.length) out.push('Ismeretlen osztály: ' + bad.join(', '));
    if (/"/.test(x.body)) out.push('Az attribútumokat egyszeres idézőjellel írd (a JSON-ban így marad olvasható).');
    for (const p of x.ports || []) { if (p.x < 0 || p.y < 0 || p.x > x.w || p.y > x.h) out.push(`A(z) ${p.id} pont kilóg a dobozból.`); if (['sw', 'meas', 'src'].includes(x.cat) && (Math.abs(p.x / 2.5 - Math.round(p.x / 2.5)) > 1e-6 || Math.abs(p.y / 2.5 - Math.round(p.y / 2.5)) > 1e-6)) out.push(`A(z) ${p.id} pont nincs a 2,5 mm-es hálón (MSZ EN 61082-1).`); }
    if (edId !== x.id && BASE[x.id] && !P.symOverrides[x.id]) out.push('Ez az azonosító már létezik a könyvtárban – mentéskor felülírja.');
    return out;
  }
  function drawPreview() {
    const x = edDraft, k = 22, pad = 2.5;
    const W = x.w + pad * 2, H = x.h + pad * 2;
    const grid = [];
    for (let gx = -pad; gx <= x.w + pad + 1e-6; gx += 0.5) grid.push(`<line x1="${gx}" y1="${-pad}" x2="${gx}" y2="${x.h + pad}" stroke="${Math.abs(gx / 2.5 - Math.round(gx / 2.5)) < 1e-6 ? '#d4cbbd' : '#efe9df'}" stroke-width="${Math.abs(gx / 2.5 - Math.round(gx / 2.5)) < 1e-6 ? 0.05 : 0.025}"/>`);
    for (let gy = -pad; gy <= x.h + pad + 1e-6; gy += 0.5) grid.push(`<line x1="${-pad}" y1="${gy}" x2="${x.w + pad}" y2="${gy}" stroke="${Math.abs(gy / 2.5 - Math.round(gy / 2.5)) < 1e-6 ? '#d4cbbd' : '#efe9df'}" stroke-width="${Math.abs(gy / 2.5 - Math.round(gy / 2.5)) < 1e-6 ? 0.05 : 0.025}"/>`);
    let inner = '';
    try { inner = RZ.symbolToGroup(x, { formats: F }); } catch (e) { inner = ''; }
    const ports = (x.ports || []).map((p) => `<circle cx="${p.x}" cy="${p.y}" r="0.45" fill="#d23"/><text x="${p.x + 0.7}" y="${p.y - 0.6}" font-size="1.1" fill="#d23">${esc(p.id)}</text>`).join('');
    const anc = x.anchor ? `<path d="M${x.anchor[0] - 0.8} ${x.anchor[1]} h1.6 M${x.anchor[0]} ${x.anchor[1] - 0.8} v1.6" stroke="#2f6fc0" stroke-width="0.12"/>` : '';
    const wall = x.wall === 'bottom' ? `<line x1="${-pad}" y1="${x.h}" x2="${x.w + pad}" y2="${x.h}" stroke="#9b9389" stroke-width="0.12" stroke-dasharray="0.6 0.6"/>` : '';
    $('#ed-preview').innerHTML = `<svg viewBox="${-pad} ${-pad} ${W} ${H}" width="${Math.min(560, W * k)}" style="color:#2f2c28;background:#fff">${grid.join('')}<rect x="0" y="0" width="${x.w}" height="${x.h}" fill="none" stroke="#9b9389" stroke-width="0.06" stroke-dasharray="0.3 0.3"/>${wall}${inner}${ports}${anc}</svg>`;
    const svg = $('#ed-preview svg');
    svg.onclick = (ev) => { if (!addPort) return; const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); x.ports = x.ports || []; x.ports.push({ id: String(x.ports.length + 1), x: r2(p.x, 0.5), y: r2(p.y, 0.5), dir: 'any' }); renderEditor(); };
    $('#ed-actual').innerHTML = RZ.symbolToSvg(x, { px: 96 / 25.4, formats: F }) + '<small>valós méret (100%)</small>';
    const l = lint(x);
    $('#ed-lint').innerHTML = l.length ? l.map((m) => `<li>${esc(m)}</li>`).join('') : '<li class="good">Nincs hiba.</li>';
  }
  function saveSym() {
    const x = edDraft; const l = lint(x).filter((m) => !m.includes('felülírja'));
    if (l.some((m) => /formája|előtaggal|ismeretlen|Ismeretlen/.test(m))) { alert('Előbb javítsd: ' + l.join(' ')); return; }
    if (edId && edId !== x.id && P.symOverrides[edId] && !BASE[edId]) delete P.symOverrides[edId];
    P.symOverrides[x.id] = JSON.parse(JSON.stringify(x)); edId = x.id; save(); renderSymPane();
  }

  // ------------------------------------------------------------------ files
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function importProject(file) { const r = new FileReader(); r.onload = () => { try { const p = JSON.parse(r.result); if (!p || !p.meta || !Array.isArray(p.sheets)) throw new Error('nem Rajztár projekt'); P = Object.assign(blankProject(), p); save(); showTab('pkg'); } catch (e) { alert('Nem olvasható: ' + e.message); } }; r.readAsText(file); }

  // ------------------------------------------------------------------ boot
  function boot() {
    $$('.tab').forEach((b) => b.onclick = () => showTab(b.dataset.tab));
    $('#prj-export').onclick = () => download(`${(P.meta.jobNo || 'projekt').replace(/[^\w.-]+/g, '_')}.rajztar.json`, JSON.stringify(P, null, 1));
    $('#prj-import').onchange = (e) => e.target.files[0] && importProject(e.target.files[0]);
    $('#prj-new').onclick = () => { if (confirm('Új projekt? A jelenlegi elvész, ha nem exportáltad.')) { P = blankProject(); save(); showTab('pkg'); } };
    $('#pkg-print').onclick = () => { renderPkg(); document.body.dataset.print = 'register'; let st = $('#page-size'); if (!st) { st = document.createElement('style'); st.id = 'page-size'; document.head.appendChild(st); } st.textContent = '@page{size:A4;margin:20mm 10mm 10mm 20mm}'; window.print(); };
    $('#sheet-add').onclick = () => { const d = DOC.D15; makeSheet({ d, id: d.id, lv: null, no: '', title: 'Új lap', need: 'O' }); renderSheetPane(); };
    $$('.tools [data-tool]').forEach((b) => b.onclick = () => setTool(b.dataset.tool));
    $('#pal-q').oninput = () => { const s = cur(); if (s) renderPalette(s); };
    $('#zoom-in').onclick = () => { zoom = (zoom || $('#sheet-canvas svg').clientWidth / sheetDims(cur()).W) * 1.25; drawSheet(); };
    $('#zoom-out').onclick = () => { zoom = (zoom || $('#sheet-canvas svg').clientWidth / sheetDims(cur()).W) / 1.25; drawSheet(); };
    $('#zoom-fit').onclick = () => { zoom = 0; drawSheet(); };
    $('#wire-lt').innerHTML = F.lines.types.map((l) => `<option value="${l.id}"${l.id === '01.2' ? ' selected' : ''}>${l.id} ${esc(l.name)}</option>`).join('');
    $('#sym-q').oninput = renderSymPane;
    $('#ed-save').onclick = saveSym;
    $('#ed-revert').onclick = () => { if (P.symOverrides[edId]) { delete P.symOverrides[edId]; save(); } edDraft = BASE[edId] ? JSON.parse(JSON.stringify(BASE[edId])) : null; if (!edDraft) edId = null; renderSymPane(); };
    $('#ed-dup').onclick = () => { const c = JSON.parse(JSON.stringify(edDraft)); c.id = c.id + '-masolat'; c.hu += ' (másolat)'; edId = null; edDraft = c; renderSymPane(); };
    $('#sym-new').onclick = () => { edId = null; edDraft = { id: 'inst.uj-jel', cat: 'inst', hu: 'Új jel', en: 'New symbol', std: { ref: 'practice.vrg' }, conf: 'vrg', w: 10, h: 10, anchor: [5, 5], wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }], body: "<circle cx='5' cy='5' r='3'/>", refdes: 'X', use: [] }; renderSymPane(); };
    $('#sym-export').onclick = () => download('symbols.overrides.json', JSON.stringify({ $schema: 'rajztar/symbol-overrides/1', about: 'Rajztár Stúdió symbol edits. Put this file at shared/rajztar/data/symbols.overrides.json and run node shared/rajztar/build.js: the build validates and merges it over the library.', exported: new Date().toISOString().slice(0, 10), items: Object.values(P.symOverrides) }, null, 1));
    bindCanvas();
    window.addEventListener('resize', () => { if (!$('#pane-sheet').hidden) drawSheet(); });
    let t = 'pkg'; try { t = sessionStorage.getItem('rajztar.tab') || 'pkg'; } catch (e) { }
    showTab(t);
  }
  boot();
})();
