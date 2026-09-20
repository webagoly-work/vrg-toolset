// Order lists: named selections of catalogue items with quantities.
//
// A list stores only `vrg_id` and a quantity. It never copies a name or a
// price, so a list built today still reads correctly after the catalogue is
// rebuilt and prices have moved — and the same list can be totalled against
// any vendor.

import { estimate, fitsPack } from './pricing.js';

let counter = 0;
function newId() {
  counter += 1;
  return 'l' + Date.now().toString(36) + counter.toString(36);
}

function createLists(opts) {
  const { userdata, store } = opts;

  const doc = () => userdata.doc;
  const all = () => Object.values(doc().lists)
    .sort((a, b) => a.nev.localeCompare(b.nev, 'hu'));

  function get(id) { return doc().lists[id] || null; }
  function activeId() { return doc().activeList; }
  function active() { return get(activeId()); }

  function create(nev) {
    return userdata.mutate(d => {
      const id = newId();
      const now = new Date().toISOString();
      d.lists[id] = {
        id, nev: (nev || '').trim() || 'Új lista',
        created: now, updated: now, megjegyzes: '', sorok: {}
      };
      d.activeList = id;
      return d.lists[id];
    });
  }

  function setActive(id) {
    if (id !== null && !get(id)) return false;
    userdata.mutate(d => { d.activeList = id; });
    return true;
  }

  function rename(id, nev) {
    const clean = (nev || '').trim();
    if (!get(id) || !clean) return false;
    userdata.mutate(d => { d.lists[id].nev = clean; d.lists[id].updated = new Date().toISOString(); });
    return true;
  }

  function remove(id) {
    if (!get(id)) return false;
    userdata.mutate(d => {
      delete d.lists[id];
      if (d.activeList === id) d.activeList = Object.keys(d.lists)[0] || null;
    });
    return true;
  }

  function setListNote(id, text) {
    if (!get(id)) return false;
    userdata.mutate(d => { d.lists[id].megjegyzes = String(text || ''); d.lists[id].updated = new Date().toISOString(); });
    return true;
  }

  function duplicate(id, nev) {
    const src = get(id);
    if (!src) return null;
    return userdata.mutate(d => {
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = newId();
      copy.nev = (nev || '').trim() || src.nev + ' (másolat)';
      copy.created = copy.updated = new Date().toISOString();
      d.lists[copy.id] = copy;
      d.activeList = copy.id;
      return copy;
    });
  }

  /** Merge `fromId` into `intoId`, adding quantities for items in both. */
  function merge(intoId, fromId) {
    const into = get(intoId), from = get(fromId);
    if (!into || !from || intoId === fromId) return null;
    return userdata.mutate(d => {
      const target = d.lists[intoId];
      let added = 0, summed = 0;
      for (const [vid, line] of Object.entries(d.lists[fromId].sorok)) {
        if (target.sorok[vid]) {
          target.sorok[vid].mennyiseg += line.mennyiseg;
          summed++;
        } else {
          target.sorok[vid] = JSON.parse(JSON.stringify(line));
          added++;
        }
      }
      target.updated = new Date().toISOString();
      return { added, summed };
    });
  }

  // -------------------------------------------------------------- lines
  function qty(vrgId, listId) {
    const l = listId ? get(listId) : active();
    if (!l) return 0;
    const line = l.sorok[vrgId];
    return line ? line.mennyiseg : 0;
  }

  /** Set an absolute quantity. Zero or less removes the line. */
  function setQty(vrgId, n, listId) {
    const id = listId || activeId();
    if (!get(id) || !store.get(vrgId)) return false;
    const v = Number(n);
    userdata.mutate(d => {
      const l = d.lists[id];
      if (!Number.isFinite(v) || v <= 0) delete l.sorok[vrgId];
      else l.sorok[vrgId] = Object.assign({}, l.sorok[vrgId], { mennyiseg: v });
      l.updated = new Date().toISOString();
    });
    return true;
  }

  function add(vrgId, n, listId) {
    const id = listId || activeId();
    if (!get(id)) return false;
    return setQty(vrgId, qty(vrgId, id) + (n == null ? 1 : Number(n)), id);
  }

  function setLineNote(vrgId, text, listId) {
    const id = listId || activeId();
    const l = get(id);
    if (!l || !l.sorok[vrgId]) return false;
    userdata.mutate(d => {
      const line = d.lists[id].sorok[vrgId];
      if (text) line.megjegyzes = String(text); else delete line.megjegyzes;
      d.lists[id].updated = new Date().toISOString();
    });
    return true;
  }

  function clearLines(listId) {
    const id = listId || activeId();
    if (!get(id)) return false;
    userdata.mutate(d => { d.lists[id].sorok = {}; d.lists[id].updated = new Date().toISOString(); });
    return true;
  }

  /**
   * The list, resolved against the current catalogue and the selected vendor.
   * An item that has vanished from the catalogue is reported rather than
   * dropped, so a stale list never silently loses lines.
   */
  function rows(listId) {
    const l = listId ? get(listId) : active();
    if (!l) return [];
    const vendorOn = !!store.vendors.selectedId();
    return Object.entries(l.sorok).map(([vid, line]) => {
      const item = store.get(vid);
      if (!item) {
        return { vrg_id: vid, item: null, mennyiseg: line.mennyiseg, megjegyzes: line.megjegyzes || '', hianyzo: true };
      }
      const est = estimate(item);
      const vNet = vendorOn ? store.vendors.read(item, 'v_netto') : null;
      const unit = vNet != null ? vNet : est.netto;
      const packQty = vendorOn ? store.vendors.read(item, 'v_kiszereles_db') : null;
      return {
        vrg_id: vid,
        item,
        mennyiseg: line.mennyiseg,
        megjegyzes: line.megjegyzes || '',
        hianyzo: false,
        egysegar: unit,
        egysegar_forras: vNet != null ? 'vendor' : 'becsles',
        sor_netto: unit == null ? null : Math.round(unit * line.mennyiseg * 100) / 100,
        csomag_mennyiseg: packQty,
        csomag_ok: packQty ? fitsPack(line.mennyiseg, packQty) : true
      };
    }).sort((a, b) => {
      if (!a.item || !b.item) return a.item ? -1 : 1;
      return a.item.megnevezes.localeCompare(b.item.megnevezes, 'hu');
    });
  }

  function totals(listId) {
    const rs = rows(listId);
    let netto = 0, ismeretlen = 0, csomagFigyelmeztetes = 0, darab = 0;
    for (const r of rs) {
      darab += r.mennyiseg;
      if (r.hianyzo || r.sor_netto == null) { ismeretlen++; continue; }
      netto += r.sor_netto;
      if (!r.csomag_ok) csomagFigyelmeztetes++;
    }
    netto = Math.round(netto * 100) / 100;
    return {
      sorok: rs.length,
      osszes_mennyiseg: Math.round(darab * 100) / 100,
      netto,
      brutto: Math.round(netto * 1.27),
      ar_nelkul: ismeretlen,
      hianyzo_tetel: rs.filter(r => r.hianyzo).length,
      csomag_figyelmeztetes: csomagFigyelmeztetes,
      vendor: store.vendors.selectedId()
    };
  }

  function stats() {
    const ls = all();
    return {
      listak: ls.length,
      osszes_sor: ls.reduce((a, l) => a + Object.keys(l.sorok).length, 0)
    };
  }

  return {
    all, get, create, rename, remove, duplicate, merge, setListNote,
    activeId, active, setActive,
    qty, setQty, add, setLineNote, clearLines,
    rows, totals, stats
  };
}

export { createLists };
