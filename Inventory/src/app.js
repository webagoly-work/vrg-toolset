// Composition root. Wiring only — no business logic lives here.

import { createStore } from './core/store.js';
import { createBus } from './core/events.js';
import { createStorage, createAutosave } from './core/persistence.js';
import { createUserData } from './core/userdata.js';
import { createLists } from './core/lists.js';
import { createProfiles } from './core/profiles.js';
import { SCHEMA_VERSION } from './core/schema.js';
import * as fmt from './core/format.js';
import { el } from './ui/dom.js';
import { createCatalog } from './features/catalog/index.js';
import { createUserDataPanel } from './features/userdata/panel.js';
import { createListPanel } from './features/lists/panel.js';
import { createExportPanel } from './features/export/panel.js';
import { createPriceCheckPanel } from './features/pricecheck/panel.js';
import { createQrPanel } from './features/qr/panel.js';
import { createProjects } from './core/projects.js';
import { createProjectPanel } from './features/projects/panel.js';
import { COLUMNS } from './features/catalog/columns.js';

const KEY_USERDATA = 'userdata';
const KEY_UI = 'ui';

function loadData() {
  const node = document.getElementById('vrg-data');
  if (!node) throw new Error('missing #vrg-data');
  return JSON.parse(node.textContent);
}

function statsPanel(store) {
  const s = store.stats();
  const stat = (value, label, isGap) => el('div', { class: 'stat' + (isGap ? ' gap' : '') }, [
    el('b', { text: fmt.num(value) }),
    el('span', { text: label })
  ]);
  return el('div', { class: 'panel stats-panel', hidden: true }, [
    el('div', { class: 'stats' }, [
      stat(s.items, 'tétel'),
      stat(s.arral, 'ismert árral'),
      stat(s.listaarral, 'listaárral + engedménnyel'),
      stat(s.markaval, 'márkával'),
      stat(s.gyartoi_cikkszammal, 'gyártói cikkszámmal'),
      stat(s.hivatalos_kategoria.done, 'hivatalos kategóriával', true),
      stat(s.tomeggel, 'tömeggel', true),
      stat(s.gyartoi_linkkel, 'gyártói linkkel', true)
    ]),
    el('p', { class: 'note', text: 'A sárga számok a még begyűjtendő adatok (Phase 6). A „~” jelöli az AI-javaslat kategóriákat — ezek nem hivatalos Daniella-kategóriák.' })
  ]);
}

function start() {
  const store = createStore(loadData());
  const bus = createBus();
  const root = document.getElementById('app');

  // ------------------------------------------------------------ storage
  const storageErrors = [];
  const storage = createStorage({ onError: e => storageErrors.push(e) });
  const saved = storage.read(KEY_USERDATA);
  let userdata;
  try {
    userdata = createUserData(saved || undefined);
  } catch (e) {
    // an unreadable saved document must not brick the app
    storageErrors.push({ op: 'userdata', error: e });
    userdata = createUserData();
  }
  store.setUserData(userdata);

  const savedUi = storage.read(KEY_UI) || {};
  const autosaveUser = createAutosave(storage, KEY_USERDATA, () => userdata.serialize());
  const autosaveUi = createAutosave(storage, KEY_UI, () => uiState);
  userdata.onChange(() => autosaveUser.schedule());

  let uiState = {
    columns: savedUi.columns || null,
    filters: savedUi.filters || null,
    vendor: typeof savedUi.vendor === 'string' ? savedUi.vendor : null,
    exportProfile: typeof savedUi.exportProfile === 'string' ? savedUi.exportProfile : null
  };

  // ------------------------------------------------------------- shell
  const stats = statsPanel(store);
  const lists = createLists({ userdata, store });
  const catalog = createCatalog({ store, bus, userdata, lists, columnState: uiState.columns });
  const listPanel = createListPanel({
    store, lists,
    onChange: () => { catalog.refreshRows(); listBtn.textContent = listLabel(); },
    onPick: id => catalog.openItem(id)
  });
  const profiles = createProfiles({
    userdata,
    knownColumn: id => COLUMNS.some(c => c.id === id) || true
  });
  const exportPanel = createExportPanel({
    store, lists, profiles, catalogColumns: COLUMNS,
    onImported: () => { catalog.reload(); listPanel.render(); listBtn.textContent = listLabel(); },
    onProfileChange: id => { uiState.exportProfile = id; autosaveUi.schedule(); }
  });

  const pricePanel = createPriceCheckPanel({
    store, userdata,
    onApplied: () => { catalog.reload(); listPanel.render(); if (!exportPanel.root.hidden) exportPanel.render(); }
  });

  const qrPanel = createQrPanel({
    store, lists,
    onImported: () => { catalog.reload(); listPanel.render(); listBtn.textContent = listLabel(); }
  });

  const projects = createProjects({ userdata, lists });
  const projectPanel = createProjectPanel({
    store, lists, projects,
    onPickCategory: cats => {
      // clicking a symbol group filters the catalogue to what could answer it
      catalog.setFilters({ al: cats[0] || '' });
    },
    onChanged: () => {
      catalog.refreshRows();
      listPanel.render();
      listBtn.textContent = listLabel();
      if (!exportPanel.root.hidden) exportPanel.render();
    }
  });

  const udPanel = createUserDataPanel({
    store, userdata, storage,
    onImported: () => { store.setUserData(userdata); catalog.reload(); listPanel.render(); listBtn.textContent = listLabel(); pricePanel.render(); },
    onReset: () => { store.setUserData(userdata); catalog.reload(); listPanel.render(); listBtn.textContent = listLabel(); pricePanel.render(); }
  });

  const statsBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'Adatállapot ▾',
    onclick: () => {
      stats.hidden = !stats.hidden;
      statsBtn.textContent = stats.hidden ? 'Adatállapot ▾' : 'Adatállapot ▴';
    }
  });
  const listLabel = () => {
    const l = lists.active();
    const n = l ? Object.keys(l.sorok).length : 0;
    return (listPanel.root.hidden ? 'Listák ▾' : 'Listák ▴') + (n ? ` (${n})` : '');
  };
  const listBtn = el('button', {
    type: 'button', class: 'ghost',
    onclick: () => { listPanel.toggle(); listBtn.textContent = listLabel(); }
  });
  listBtn.textContent = listLabel();

  const exportBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'Export ▾',
    onclick: () => { exportBtn.textContent = exportPanel.toggle() ? 'Export ▴' : 'Export ▾'; }
  });

  const priceBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'Árellenőrzés ▾',
    onclick: () => { priceBtn.textContent = pricePanel.toggle() ? 'Árellenőrzés ▴' : 'Árellenőrzés ▾'; }
  });

  const qrBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'QR ▾',
    onclick: () => { qrBtn.textContent = qrPanel.toggle() ? 'QR ▴' : 'QR ▾'; }
  });

  const projBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'Projektek ▾',
    onclick: () => { projBtn.textContent = projectPanel.toggle() ? 'Projektek ▴' : 'Projektek ▾'; }
  });

  const udBtn = el('button', {
    type: 'button', class: 'ghost',
    text: 'Saját adatok ▾',
    onclick: () => { udBtn.textContent = udPanel.toggle() ? 'Saját adatok ▴' : 'Saját adatok ▾'; }
  });

  const header = el('header', { class: 'top' }, [
    el('h1', { text: 'VRG Készlet-adatbázis' }),
    el('span', { class: 'badge', text: 'séma ' + SCHEMA_VERSION }),
    el('span', { class: 'badge', text: store.items.length + ' tétel' }),
    el('span', { class: 'badge', text: 'generálva ' + store.doc.generated }),
    storage.available ? null : el('span', { class: 'badge warn-badge', text: 'nincs helyi mentés' }),
    el('div', { class: 'spacer' }),
    statsBtn, projBtn, listBtn, exportBtn, priceBtn, qrBtn, udBtn
  ].filter(Boolean));

  root.appendChild(header);
  root.appendChild(stats);
  root.appendChild(projectPanel.root);
  root.appendChild(listPanel.root);
  root.appendChild(exportPanel.root);
  root.appendChild(pricePanel.root);
  root.appendChild(qrPanel.root);
  root.appendChild(udPanel.root);
  root.appendChild(catalog.root);

  // --------------------------------------------------- restore UI state
  if (uiState.vendor) {
    try {
      store.vendors.select(uiState.vendor);
      const sel = document.getElementById('f-vendor');
      if (sel) sel.value = uiState.vendor;
      catalog.table.refresh();
    } catch (e) {
      uiState.vendor = null;              // a vendor that no longer exists
    }
  }
  if (uiState.exportProfile) exportPanel.select(uiState.exportProfile);
  if (uiState.filters) catalog.setFilters(uiState.filters);
  catalog.apply();

  // ------------------------------------------------------ persist UI state
  bus.on('columns:changed', c => { uiState.columns = c; autosaveUi.schedule(); });
  bus.on('filters:changed', f => { uiState.filters = f; autosaveUi.schedule(); });
  bus.on('vendor:changed', v => { uiState.vendor = v.id; autosaveUi.schedule(); });
  bus.on('userdata:changed', () => udPanel.refresh());
  bus.on('lists:changed', () => { listPanel.render(); listBtn.textContent = listLabel(); if (!exportPanel.root.hidden) exportPanel.render(); if (!qrPanel.root.hidden) qrPanel.render(); if (!projectPanel.root.hidden) projectPanel.render(); });
  bus.on('item:selected', e => {
    qrPanel.setItem(e.id);
    // light up the symbols the selected item could answer
    const it = store.get(e.id);
    const c = it ? [(it.kategoria && it.kategoria.al) || (it.kategoria_javaslat && it.kategoria_javaslat.al)] : [];
    projectPanel.highlight(c.filter(Boolean));
  });
  bus.on('item:deselected', () => projectPanel.highlight([]));
  bus.on('vendor:changed', () => { listPanel.render(); if (!exportPanel.root.hidden) exportPanel.render(); });

  // never lose the last keystroke of a note
  window.addEventListener('beforeunload', () => { autosaveUser.flush(); autosaveUi.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { autosaveUser.flush(); autosaveUi.flush(); }
  });

  if (storageErrors.length) {
    // eslint-disable-next-line no-console
    console.warn('VRG: tárolási figyelmeztetés', storageErrors);
  }

  // "/" focuses the search box, the way every catalogue ought to behave
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      catalog.focusSearch();
    }
  });

  // Other VRG tools plug in here (Planner, Kalkulátor). Read-only on purpose.
  window.VRG = window.VRG || {};
  window.VRG.inventory = {
    version: SCHEMA_VERSION,
    get: id => store.get(id),
    getByLegacy: id => store.getByLegacy(id),
    query: q => store.query(q),
    stats: () => store.stats(),
    categories: () => store.tree,
    userdata: () => userdata.serialize(),
    lists: () => lists.all().map(l => ({ id: l.id, nev: l.nev, sorok: Object.keys(l.sorok).length })),
    listRows: id => lists.rows(id),
    listTotals: id => lists.totals(id),
    exportProfiles: () => profiles.all(),
    exportWith: id => exportPanel.build(profiles.get(id)),
    financeLog: () => (userdata.doc.financeLog || []).slice(),
    projects: () => projects.all().map(p => ({ id: p.id, nev: p.nev, listaId: p.listaId, igenyek: p.terv ? p.terv.igenyek.length : 0 })),
    on: (type, fn) => bus.on(type, fn)
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
