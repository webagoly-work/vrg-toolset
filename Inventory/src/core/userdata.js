// Everything the user creates, in one self-contained, versioned document.
//
// This is the file you carry to a fresh copy of the HTML to keep working, and
// it is deliberately separate from the catalogue: a rebuild from the vendor
// documents replaces the catalogue wholesale and must never touch these values.
//
// It holds two kinds of thing:
//   * purely user-owned fields that exist nowhere in the catalogue
//     (megjegyzes, kedvenc, jeloles)
//   * OVERRIDES of catalogue fields the user is allowed to correct or fill in
//     (tomeg_kg, gyartoi_termek_link, kategoria) — these win over the base
//     value and are reported as overridden so the UI can say so.
//   * ORDER LISTS: named selections of items with quantities and notes.
//   * EXPORT PROFILES: saved column sets, category orders and dialects.
//   * VENDOR OVERLAY: what a price check read from the vendor's site, kept
//     here rather than in the catalogue so a data rebuild cannot erase it.
//   * FINANCE LOG: an append-only record of price CHANGES. The catalogue is a
//     statement of current facts; this is a statement of events.
//   * PROJECTS: a job, its imported Planner requirements, and the list that
//     answers them.

const USERDATA_SCHEMA = 'vrg-userdata';
const USERDATA_VERSION = '1.4.0';

// Catalogue fields the user may override. Anything not listed is ignored on
// import, so a hand-edited file cannot rewrite prices or identifiers.
const OVERRIDABLE = ['tomeg_kg', 'gyartoi_termek_link', 'kategoria'];
// Fields that exist only here.
const OWN = ['megjegyzes', 'kedvenc', 'jeloles'];

const MARKS = ['piros', 'sarga', 'zold', 'kek'];

function emptyDoc() {
  return {
    schema: USERDATA_SCHEMA,
    schema_version: USERDATA_VERSION,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    items: {},
    lists: {},
    activeList: null,
    exportProfiles: [],
    vendorData: {},
    financeLog: [],
    saveLog: [],
    projects: {},
    activeProject: null,
    ui: {}
  };
}

const MIGRATIONS = [
  {
    from: '1.0.0', to: '1.1.0',
    // order lists arrived in Phase 4; documents written before that simply had none
    apply(d) {
      if (!d.lists || typeof d.lists !== 'object') d.lists = {};
      if (d.activeList === undefined) d.activeList = null;
      d.schema_version = '1.1.0';
      return d;
    }
  },
  {
    from: '1.1.0', to: '1.2.0',
    // export profiles arrived in Phase 5; an empty array means "use the defaults"
    apply(d) {
      if (!Array.isArray(d.exportProfiles)) d.exportProfiles = [];
      d.schema_version = '1.2.0';
      return d;
    }
  },
  {
    from: '1.2.0', to: '1.3.0',
    // Phase 7 added the vendor overlay and the finance log
    apply(d) {
      if (!d.vendorData || typeof d.vendorData !== 'object') d.vendorData = {};
      if (!Array.isArray(d.financeLog)) d.financeLog = [];
      if (!Array.isArray(d.saveLog)) d.saveLog = [];
      d.schema_version = '1.3.0';
      return d;
    }
  },
  {
    from: '1.3.0', to: '1.4.0',
    // Phase 9 added projects and their imported plan requirements
    apply(d) {
      if (!d.projects || typeof d.projects !== 'object') d.projects = {};
      if (d.activeProject === undefined) d.activeProject = null;
      d.schema_version = '1.4.0';
      return d;
    }
  }
];

function migrateUserData(doc) {
  let d = JSON.parse(JSON.stringify(doc));
  let guard = 0;
  while (d.schema_version !== USERDATA_VERSION) {
    const step = MIGRATIONS.find(m => m.from === d.schema_version);
    if (!step) throw new Error('no migration path from userdata schema_version ' + d.schema_version);
    d = step.apply(d);
    if (++guard > 50) throw new Error('userdata migration loop');
  }
  return d;
}

/**
 * Accept an imported document, dropping anything unrecognised rather than
 * trusting it. Returns { doc, warnings } — warnings are shown to the user so a
 * partial import is never silent.
 */
function sanitize(input, knownId) {
  const warnings = [];
  if (!input || typeof input !== 'object') throw new Error('A fájl nem érvényes JSON objektum.');
  if (input.schema !== USERDATA_SCHEMA) {
    throw new Error(`Nem saját-adat fájl (schema: ${JSON.stringify(input.schema)}).`);
  }
  const migrated = migrateUserData(input);
  const out = emptyDoc();
  out.created = typeof migrated.created === 'string' ? migrated.created : out.created;
  out.updated = typeof migrated.updated === 'string' ? migrated.updated : out.updated;

  const items = migrated.items && typeof migrated.items === 'object' ? migrated.items : {};
  let unknown = 0;
  for (const [id, raw] of Object.entries(items)) {
    if (!raw || typeof raw !== 'object') continue;
    if (knownId && !knownId(id)) { unknown++; continue; }
    const rec = {};
    for (const f of OWN) if (raw[f] !== undefined && raw[f] !== null && raw[f] !== '') rec[f] = raw[f];
    for (const f of OVERRIDABLE) if (raw[f] !== undefined && raw[f] !== null && raw[f] !== '') rec[f] = raw[f];
    if (rec.jeloles && !MARKS.includes(rec.jeloles)) delete rec.jeloles;
    if (rec.tomeg_kg != null) {
      const n = Number(rec.tomeg_kg);
      if (Number.isFinite(n) && n >= 0) rec.tomeg_kg = n; else delete rec.tomeg_kg;
    }
    if (rec.kedvenc !== undefined) rec.kedvenc = !!rec.kedvenc;
    if (Object.keys(rec).length) out.items[id] = rec;
  }
  if (unknown) warnings.push(`${unknown} tétel nem szerepel ebben a katalógusban, ezeket kihagytam.`);

  // ------------------------------------------------------------- lists
  const lists = migrated.lists && typeof migrated.lists === 'object' ? migrated.lists : {};
  let droppedLines = 0;
  for (const [lid, raw] of Object.entries(lists)) {
    if (!raw || typeof raw !== 'object') continue;
    const list = {
      id: String(raw.id || lid),
      nev: typeof raw.nev === 'string' && raw.nev.trim() ? raw.nev.trim() : 'Névtelen lista',
      created: typeof raw.created === 'string' ? raw.created : new Date().toISOString(),
      updated: typeof raw.updated === 'string' ? raw.updated : new Date().toISOString(),
      megjegyzes: typeof raw.megjegyzes === 'string' ? raw.megjegyzes : '',
      sorok: {}
    };
    const sorok = raw.sorok && typeof raw.sorok === 'object' ? raw.sorok : {};
    for (const [id, line] of Object.entries(sorok)) {
      if (knownId && !knownId(id)) { droppedLines++; continue; }
      const qty = Number(line && line.mennyiseg);
      if (!Number.isFinite(qty) || qty <= 0) { droppedLines++; continue; }
      list.sorok[id] = { mennyiseg: qty };
      if (line.megjegyzes) list.sorok[id].megjegyzes = String(line.megjegyzes);
    }
    out.lists[list.id] = list;
  }
  if (droppedLines) warnings.push(`${droppedLines} listasort kihagytam (ismeretlen tétel vagy érvénytelen mennyiség).`);
  out.activeList = out.lists[migrated.activeList] ? migrated.activeList : (Object.keys(out.lists)[0] || null);

  // --------------------------------------------------- export profiles
  if (Array.isArray(migrated.exportProfiles)) {
    out.exportProfiles = migrated.exportProfiles
      .filter(p => p && typeof p === 'object' && typeof p.nev === 'string')
      .map(p => ({
        id: String(p.id || ''),
        nev: p.nev.trim() || 'Névtelen profil',
        builtin: !!p.builtin,
        target: p.target === 'lista' ? 'lista' : 'katalogus',
        format: ['csv', 'tsv', 'txt', 'json', 'rendeles'].includes(p.format) ? p.format : 'csv',
        dialect: typeof p.dialect === 'string' ? p.dialect : 'excel-hu',
        columns: Array.isArray(p.columns) ? p.columns.map(String) : [],
        categoryOrder: Array.isArray(p.categoryOrder) ? p.categoryOrder.map(String) : [],
        groupByCategory: !!p.groupByCategory,
        header: p.header !== false
      }))
      .filter(p => p.id);
  }

  // ----------------------------------------------------- vendor overlay
  if (migrated.vendorData && typeof migrated.vendorData === 'object') {
    for (const [vid, byItem] of Object.entries(migrated.vendorData)) {
      if (!byItem || typeof byItem !== 'object') continue;
      const clean = {};
      for (const [id, patch] of Object.entries(byItem)) {
        if (knownId && !knownId(id)) continue;
        if (!patch || typeof patch !== 'object') continue;
        const rec = {};
        for (const f of VENDOR_REFRESHABLE) {
          if (patch[f] === undefined || patch[f] === null) continue;
          if (f === 'ar_ellenorizve' || f === 'termek_link') rec[f] = String(patch[f]);
          else {
            const n = Number(patch[f]);
            if (Number.isFinite(n) && n >= 0) rec[f] = n;
          }
        }
        if (Object.keys(rec).length) clean[id] = rec;
      }
      if (Object.keys(clean).length) out.vendorData[vid] = clean;
    }
  }

  // -------------------------------------------------------- finance log
  if (Array.isArray(migrated.financeLog)) {
    out.financeLog = migrated.financeLog
      .filter(e => e && typeof e === 'object' && e.datum && e.vrg_id)
      .map(e => ({
        datum: String(e.datum),
        vrg_id: String(e.vrg_id),
        vendor: String(e.vendor || ''),
        regi_brutto: e.regi_brutto == null ? null : Number(e.regi_brutto),
        uj_brutto: e.uj_brutto == null ? null : Number(e.uj_brutto),
        valtozas_huf: e.valtozas_huf == null ? null : Number(e.valtozas_huf),
        valtozas_szazalek: e.valtozas_szazalek == null ? null : Number(e.valtozas_szazalek),
        forras_url: String(e.forras_url || '')
      }));
  }
  if (Array.isArray(migrated.saveLog)) {
    out.saveLog = migrated.saveLog
      .filter(e => e && typeof e === 'object' && e.datum)
      .map(e => ({ datum: String(e.datum), valtozasok: Number(e.valtozasok) || 0, tetelek: Number(e.tetelek) || 0 }));
  }

  // ---------------------------------------------------------- projects
  if (migrated.projects && typeof migrated.projects === 'object') {
    for (const [pid, raw] of Object.entries(migrated.projects)) {
      if (!raw || typeof raw !== 'object') continue;
      const terv = raw.terv && typeof raw.terv === 'object' ? raw.terv : null;
      out.projects[String(raw.id || pid)] = {
        id: String(raw.id || pid),
        nev: (typeof raw.nev === 'string' && raw.nev.trim()) ? raw.nev.trim() : 'Névtelen projekt',
        cim: typeof raw.cim === 'string' ? raw.cim : '',
        datum: typeof raw.datum === 'string' ? raw.datum : '',
        megjegyzes: typeof raw.megjegyzes === 'string' ? raw.megjegyzes : '',
        listaId: (raw.listaId && out.lists[raw.listaId]) ? raw.listaId : null,
        terv: terv ? {
          forras: String(terv.forras || ''),
          nev: String(terv.nev || ''),
          mentve: String(terv.mentve || ''),
          rajz: sanitizeDrawing(terv.rajz),
          igenyek: Array.isArray(terv.igenyek) ? terv.igenyek
            .filter(i => i && typeof i === 'object' && i.kulcs)
            .map(i => ({
              kulcs: String(i.kulcs),
              cimke: String(i.cimke || i.kulcs),
              egyseg: String(i.egyseg || 'db'),
              mennyiseg: Number(i.mennyiseg) || 0,
              kategoriak: Array.isArray(i.kategoriak) ? i.kategoriak.map(String) : [],
              ismeretlen: !!i.ismeretlen
            })) : []
        } : null
      };
    }
  }
  out.activeProject = out.projects[migrated.activeProject] ? migrated.activeProject : (Object.keys(out.projects)[0] || null);

  if (migrated.ui && typeof migrated.ui === 'object') out.ui = migrated.ui;
  return { doc: out, warnings };
}

// Vendor fields a price check may refresh. Prices we negotiated and pack sizes
// are NOT here: those come from order documents, not from a webshop read.
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * An imported drawing travels inside the user document, so it is validated
 * like everything else that arrives from a file: geometry only, numbers only.
 */
function sanitizeDrawing(r) {
  if (!r || typeof r !== 'object') return null;
  const pt = p => (Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null) ? [num(p[0]), num(p[1])] : null;
  const out = {
    szintek: Array.isArray(r.szintek) ? r.szintek.map(String) : [],
    helyisegek: (Array.isArray(r.helyisegek) ? r.helyisegek : [])
      .map(h => ({ szint: String((h && h.szint) || ''), pontok: (Array.isArray(h && h.pontok) ? h.pontok : []).map(pt).filter(Boolean) }))
      .filter(h => h.pontok.length >= 3),
    eszkozok: (Array.isArray(r.eszkozok) ? r.eszkozok : [])
      .filter(e => e && num(e.x) !== null && num(e.y) !== null)
      .map(e => ({ szint: String(e.szint || ''), tipus: String(e.tipus || ''), x: num(e.x), y: num(e.y), ref: String(e.ref || '') })),
    nyilasok: (Array.isArray(r.nyilasok) ? r.nyilasok : [])
      .filter(o => o && num(o.x) !== null && num(o.y) !== null)
      .map(o => ({ szint: String(o.szint || ''), tipus: String(o.tipus || ''), x: num(o.x), y: num(o.y) })),
    hatar: null
  };
  const h = r.hatar;
  if (h && ['minX', 'maxX', 'minY', 'maxY'].every(k => num(h[k]) !== null)) {
    out.hatar = { minX: num(h.minX), maxX: num(h.maxX), minY: num(h.minY), maxY: num(h.maxY) };
  }
  if (!out.helyisegek.length && !out.eszkozok.length) return null;
  return out;
}

const VENDOR_REFRESHABLE = ['aktualis_brutto_ar_huf', 'keszlet_db', 'termek_link', 'ar_ellenorizve'];

/**
 * Merge one catalogue item with its override record and, if a price check has
 * run, with the vendor overlay. Never mutates the base.
 *
 * `vendorRecs` is `{ <vendorId>: { <field>: value } }`. The overlay is merged
 * into the item's own vendor block, so the gate in core/vendors.js keeps
 * working unchanged — a refreshed price is still invisible until that vendor
 * is selected.
 */
function mergeItem(base, rec, vendorRecs) {
  const vendorPatch = vendorRecs && Object.keys(vendorRecs).length ? vendorRecs : null;
  if (!rec || !Object.keys(rec).length) {
    const plain = Object.assign({}, base, { user: {}, overridden: [], vendor_frissitve: [] });
    return vendorPatch ? applyVendorOverlay(plain, vendorPatch) : plain;
  }
  const merged = Object.assign({}, base);
  const overridden = [];
  for (const f of OVERRIDABLE) {
    if (rec[f] === undefined) continue;
    if (f === 'kategoria') {
      merged.kategoria = Object.assign({}, base.kategoria, rec.kategoria);
    } else {
      merged[f] = rec[f];
    }
    overridden.push(f);
  }
  const user = {};
  for (const f of OWN) if (rec[f] !== undefined) user[f] = rec[f];
  merged.user = user;
  merged.overridden = overridden;
  merged.vendor_frissitve = [];
  return vendorPatch ? applyVendorOverlay(merged, vendorPatch) : merged;
}

/** Copy-on-write the vendor blocks this item has an overlay for. */
function applyVendorOverlay(item, vendorRecs) {
  const vendors = Object.assign({}, item.vendors);
  const refreshed = [];
  for (const [vid, patch] of Object.entries(vendorRecs)) {
    if (!vendors[vid] || !patch) continue;          // never invent a vendor block
    const block = Object.assign({}, vendors[vid]);
    for (const f of VENDOR_REFRESHABLE) {
      if (patch[f] !== undefined && patch[f] !== null) {
        block[f] = patch[f];
        if (f !== 'ar_ellenorizve') refreshed.push(vid + '.' + f);
      }
    }
    vendors[vid] = block;
  }
  item.vendors = vendors;
  item.vendor_frissitve = refreshed;
  return item;
}

function createUserData(initial) {
  let doc = initial ? migrateUserData(initial) : emptyDoc();
  const listeners = new Set();

  function touch() {
    doc.updated = new Date().toISOString();
    for (const fn of [...listeners]) fn(doc);
  }

  function record(id) { return doc.items[id] || null; }

  /** The price-check overlay for one item, keyed by vendor. */
  function vendorRecord(id) {
    const out = {};
    for (const [vid, byItem] of Object.entries(doc.vendorData || {})) {
      if (byItem[id]) out[vid] = byItem[id];
    }
    return out;
  }

  function set(id, field, value) {
    if (!OWN.includes(field) && !OVERRIDABLE.includes(field)) {
      throw new Error('field is not user-owned: ' + field);
    }
    const rec = doc.items[id] || (doc.items[id] = {});
    const empty = value === null || value === undefined || value === '' || value === false;
    if (empty) delete rec[field]; else rec[field] = value;
    if (!Object.keys(rec).length) delete doc.items[id];
    touch();
    return true;
  }

  function clearItem(id) {
    if (!doc.items[id]) return false;
    delete doc.items[id];
    touch();
    return true;
  }

  function setUi(key, value) {
    doc.ui[key] = value;
    touch();
  }

  function ui(key, fallback) {
    return doc.ui[key] === undefined ? fallback : doc.ui[key];
  }

  function stats() {
    const ids = Object.keys(doc.items);
    const has = f => ids.filter(id => doc.items[id][f] !== undefined).length;
    return {
      tetelek: ids.length,
      megjegyzessel: has('megjegyzes'),
      kedvencek: ids.filter(id => doc.items[id].kedvenc).length,
      jelolessel: has('jeloles'),
      felulirt_mezok: ids.reduce((a, id) =>
        a + OVERRIDABLE.filter(f => doc.items[id][f] !== undefined).length, 0)
    };
  }

  /** Structured edit seam for features that own a whole sub-tree (core/lists.js).
   *  The callback mutates the document; touch() then notifies and autosaves. */
  function mutate(fn) {
    const r = fn(doc);
    touch();
    return r;
  }

  return {
    get doc() { return doc; },
    record, vendorRecord, set, clearItem, setUi, ui, stats, mutate,
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    replace(next) { doc = next; touch(); },
    reset() { doc = emptyDoc(); touch(); },
    serialize: () => JSON.parse(JSON.stringify(doc))
  };
}

export {
  USERDATA_SCHEMA, USERDATA_VERSION, OVERRIDABLE, OWN, MARKS, VENDOR_REFRESHABLE,
  emptyDoc, migrateUserData, sanitize, mergeItem, createUserData
};
