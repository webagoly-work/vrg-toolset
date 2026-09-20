// Export profiles: a saved answer to "which columns, in what order, grouped
// how, in which dialect". One profile per recurring job — the spreadsheet for
// the accountant, the order for the vendor, the shopping list for the van.

const TARGETS = ['katalogus', 'lista'];
const FORMATS = ['csv', 'tsv', 'txt', 'json', 'rendeles'];

let counter = 0;
function newId() {
  counter += 1;
  return 'p' + Date.now().toString(36) + counter.toString(36);
}

function defaults() {
  return [
    {
      id: 'p_katalogus_excel', nev: 'Katalógus — Excel', builtin: true,
      target: 'katalogus', format: 'csv', dialect: 'excel-hu',
      columns: ['vrg_id', 'megnevezes', 'marka', 'gyartoi_cikkszam', 'kategoria_fo', 'kategoria_al', 'egyseg', 'netto', 'brutto'],
      categoryOrder: [], groupByCategory: false, header: true
    },
    {
      id: 'p_lista_excel', nev: 'Rendelési lista — Excel', builtin: true,
      target: 'lista', format: 'csv', dialect: 'excel-hu',
      columns: ['vrg_id', 'megnevezes', 'mennyiseg', 'egyseg', 'egysegar', 'sor_netto', 'sor_megjegyzes'],
      categoryOrder: [], groupByCategory: true, header: true
    },
    {
      id: 'p_lista_rendeles', nev: 'Rendelés a beszállítónak', builtin: true,
      target: 'lista', format: 'rendeles', dialect: 'standard',
      columns: [], categoryOrder: [], groupByCategory: false, header: false
    }
  ];
}

function sanitizeProfile(raw, knownColumn) {
  if (!raw || typeof raw !== 'object') return null;
  const target = TARGETS.includes(raw.target) ? raw.target : 'katalogus';
  const format = FORMATS.includes(raw.format) ? raw.format : 'csv';
  const cols = Array.isArray(raw.columns) ? raw.columns.filter(c => !knownColumn || knownColumn(c)) : [];
  return {
    id: String(raw.id || newId()),
    nev: (typeof raw.nev === 'string' && raw.nev.trim()) ? raw.nev.trim() : 'Névtelen profil',
    builtin: !!raw.builtin,
    target, format,
    dialect: typeof raw.dialect === 'string' ? raw.dialect : 'excel-hu',
    columns: cols,
    categoryOrder: Array.isArray(raw.categoryOrder) ? raw.categoryOrder.map(String) : [],
    groupByCategory: !!raw.groupByCategory,
    header: raw.header !== false
  };
}

function createProfiles(opts) {
  const { userdata, knownColumn } = opts;

  function ensure() {
    return userdata.mutate(d => {
      if (!Array.isArray(d.exportProfiles) || !d.exportProfiles.length) {
        d.exportProfiles = defaults();
      }
      return d.exportProfiles;
    });
  }

  function all() {
    const d = userdata.doc;
    if (!Array.isArray(d.exportProfiles) || !d.exportProfiles.length) return ensure();
    return d.exportProfiles;
  }

  function get(id) { return all().find(p => p.id === id) || null; }

  function forTarget(target) { return all().filter(p => p.target === target); }

  /** Always mints a fresh id — `partial` may be a copy of an existing profile,
   *  and reusing its id would overwrite the original instead of forking it. */
  function create(partial) {
    const p = sanitizeProfile(Object.assign({}, partial, { id: newId(), builtin: false }), knownColumn);
    userdata.mutate(d => { d.exportProfiles = all().concat([p]); });
    return p;
  }

  function update(id, patch) {
    const existing = get(id);
    if (!existing) return null;
    if (existing.builtin) {
      // a built-in profile is a starting point, not something to overwrite
      return create(Object.assign({}, existing, patch, { nev: (patch.nev || existing.nev + ' (saját)') }));
    }
    const next = sanitizeProfile(Object.assign({}, existing, patch, { id, builtin: false }), knownColumn);
    userdata.mutate(d => { d.exportProfiles = all().map(p => (p.id === id ? next : p)); });
    return next;
  }

  function remove(id) {
    const p = get(id);
    if (!p || p.builtin) return false;
    userdata.mutate(d => { d.exportProfiles = all().filter(x => x.id !== id); });
    return true;
  }

  function resetAll() {
    userdata.mutate(d => { d.exportProfiles = defaults(); });
    return all();
  }

  return { all, get, forTarget, create, update, remove, resetAll, ensure };
}

export { createProfiles, sanitizeProfile, defaults, TARGETS, FORMATS };
