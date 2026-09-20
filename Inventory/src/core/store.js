// In-memory catalogue: indexes + a single query entry point.
//
// The catalogue is read-only at runtime. Everything the user creates lives in
// a separate userdata document (Phase 3), which is what makes "copy the HTML,
// import your save, keep working" true.

import { SCHEMA_VERSION, validateDocument, migrate } from './schema.js';
import { createVendorGate } from './vendors.js';
import { mergeItem } from './userdata.js';
import * as categories from './categories.js';

function fold(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');   // ékezet-érzéketlen keresés
}

function searchBlobOf(item) {
  const parts = [
    item.vrg_id, item.legacy_id, item.megnevezes, item.marka_gyarto, item.gyartoi_cikkszam,
    categories.key(item)
  ];
  for (const n of item.nev_valtozatok || []) parts.push(n);
  for (const v of Object.values(item.vendors || {})) parts.push(v.cikkszam);
  if (item.user && item.user.megjegyzes) parts.push(item.user.megjegyzes);   // own notes are searchable
  return fold(parts.filter(Boolean).join(' '));
}

function createStore(rawDoc, opts) {
  const doc = rawDoc.schema_version === SCHEMA_VERSION ? rawDoc : migrate(rawDoc, opts);
  const errors = validateDocument(doc);
  if (errors.length && !(opts && opts.tolerant)) {
    throw new Error('invalid inventory document:\n  ' + errors.slice(0, 10).join('\n  '));
  }

  // `base` is the catalogue exactly as published and is never mutated.
  // `items` are merged views of base + the user's overrides, rebuilt on change.
  const base = doc.items;
  let userdata = null;
  let items = base.map(i => mergeItem(i, null, null));
  const byId = new Map(items.map(i => [i.vrg_id, i]));
  const byLegacy = new Map(items.filter(i => i.legacy_id).map(i => [i.legacy_id, i]));
  const blobs = new Map(items.map(i => [i.vrg_id, searchBlobOf(i)]));
  const vendors = createVendorGate(doc);

  const brands = [...new Set(base.map(i => i.marka_gyarto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu'));
  let tree = categories.buildTree(items);

  function remerge(vrgId) {
    const i = base.findIndex(b => b.vrg_id === vrgId);
    if (i < 0) return null;
    const merged = mergeItem(base[i],
      userdata ? userdata.record(vrgId) : null,
      userdata ? userdata.vendorRecord(vrgId) : null);
    items[i] = merged;
    byId.set(vrgId, merged);
    if (merged.legacy_id) byLegacy.set(merged.legacy_id, merged);
    blobs.set(vrgId, searchBlobOf(merged));
    tree = categories.buildTree(items);
    return merged;
  }

  function remergeAll() {
    items = base.map(b => mergeItem(b,
      userdata ? userdata.record(b.vrg_id) : null,
      userdata ? userdata.vendorRecord(b.vrg_id) : null));
    byId.clear(); byLegacy.clear(); blobs.clear();
    for (const it of items) {
      byId.set(it.vrg_id, it);
      if (it.legacy_id) byLegacy.set(it.legacy_id, it);
      blobs.set(it.vrg_id, searchBlobOf(it));
    }
    tree = categories.buildTree(items);
  }

  /** Attach the user's document; every read from now on sees the merged view. */
  function setUserData(ud) {
    userdata = ud;
    remergeAll();
  }

  const SORTS = {
    nev: (a, b) => a.megnevezes.localeCompare(b.megnevezes, 'hu'),
    id: (a, b) => a.vrg_id.localeCompare(b.vrg_id),
    ar: (a, b) => (a.becsult_ar.netto_huf ?? -1) - (b.becsult_ar.netto_huf ?? -1),
    gyakorisag: (a, b) => b.felhasznalas.rendelesek_szama - a.felhasznalas.rendelesek_szama,
    utolso: (a, b) => String(b.felhasznalas.utolso_rendeles || '').localeCompare(String(a.felhasznalas.utolso_rendeles || ''))
  };

  /**
   * query({ text, fo, al, brand, vendor, hasPrice, missing, sort, compare, desc, limit })
   * `vendor` filters to items that vendor carries; it does NOT select a vendor
   * — selection stays an explicit user action through vendors.select().
   * `sort: null` skips sorting, for callers that order the result themselves;
   * `compare` supplies a custom comparator instead of a named sort.
   */
  function query(q) {
    q = q || {};
    const needles = fold(q.text || '').split(/\s+/).filter(Boolean);
    let out = items.filter(it => {
      if (needles.length) {
        const blob = blobs.get(it.vrg_id);
        if (!needles.every(n => blob.includes(n))) return false;
      }
      if (q.fo || q.al) {
        const c = categories.resolve(it);
        if (q.fo && c.fo !== q.fo) return false;
        if (q.al && c.al !== q.al) return false;
      }
      if (q.brand && it.marka_gyarto !== q.brand) return false;
      if (q.vendor && !(it.vendors && it.vendors[q.vendor])) return false;
      if (q.hasPrice === true && it.becsult_ar.netto_huf == null) return false;
      if (q.hasPrice === false && it.becsult_ar.netto_huf != null) return false;
      if (q.kedvenc && !(it.user && it.user.kedvenc)) return false;
      if (q.jeloles && !(it.user && it.user.jeloles === q.jeloles)) return false;
      if (q.megjegyzessel && !(it.user && it.user.megjegyzes)) return false;
      if (q.missing && !isMissing(it, q.missing)) return false;
      return true;
    });
    if (q.sort !== null) {
      out.sort(q.compare || SORTS[q.sort || 'nev'] || SORTS.nev);
      if (q.desc) out.reverse();
    }
    return q.limit ? out.slice(0, q.limit) : out;
  }

  /** Gap reporting — drives the "what still needs collecting" views. */
  function isMissing(it, what) {
    switch (what) {
      case 'kategoria': return !categories.resolve(it).official;
      case 'tomeg': return it.tomeg_kg == null;
      case 'gyarto': return !it.marka_gyarto;
      case 'gyartoi_cikkszam': return !it.gyartoi_cikkszam;
      case 'gyartoi_link': return !it.gyartoi_termek_link;
      case 'ar': return it.becsult_ar.netto_huf == null;
      default: throw new Error('unknown missing-filter: ' + what);
    }
  }

  function stats() {
    const n = items.length;
    const count = f => items.filter(f).length;
    return {
      items: n,
      arral: count(i => i.becsult_ar.netto_huf != null),
      listaarral: count(i => i.vendors.daniella && i.vendors.daniella.listaar_netto_huf != null),
      markaval: count(i => !!i.marka_gyarto),
      gyartoi_cikkszammal: count(i => !!i.gyartoi_cikkszam),
      hivatalos_kategoria: categories.officialCoverage(items),
      tomeggel: count(i => i.tomeg_kg != null),
      gyartoi_linkkel: count(i => !!i.gyartoi_termek_link),
      markak: brands.length,
      kategoriak: tree.reduce((a, t) => a + t.children.length, 0),
      kedvencek: count(i => i.user && i.user.kedvenc),
      megjegyzessel: count(i => i.user && i.user.megjegyzes),
      felulirt: count(i => i.overridden && i.overridden.length)
    };
  }

  return {
    doc, vendors, brands,
    get items() { return items; },
    get tree() { return tree; },
    get: id => byId.get(id) || null,
    getByLegacy: id => byLegacy.get(id) || null,
    setUserData, remerge, remergeAll,
    query, isMissing, stats,
    sortKeys: Object.keys(SORTS)
  };
}

export { createStore, fold };
