// A project: a job, the requirements imported from its Planner drawing, and
// the order list that answers them.
//
// The project owns a list rather than duplicating it, so every list feature —
// quantities, notes, totals, export, QR — works on a project's list unchanged.

let counter = 0;
function newId() {
  counter += 1;
  return 'pr' + Date.now().toString(36) + counter.toString(36);
}

function createProjects(opts) {
  const { userdata, lists } = opts;

  const doc = () => userdata.doc;
  const all = () => Object.values(doc().projects || {})
    .sort((a, b) => a.nev.localeCompare(b.nev, 'hu'));

  const get = id => (doc().projects || {})[id] || null;
  const activeId = () => doc().activeProject;
  const active = () => get(activeId());

  function create(fields) {
    return userdata.mutate(d => {
      const id = newId();
      const f = fields || {};
      d.projects[id] = {
        id,
        nev: String(f.nev || '').trim() || 'Új projekt',
        cim: String(f.cim || ''),
        datum: String(f.datum || new Date().toISOString().slice(0, 10)),
        megjegyzes: String(f.megjegyzes || ''),
        listaId: f.listaId || null,
        terv: f.terv || null
      };
      d.activeProject = id;
      return d.projects[id];
    });
  }

  function setActive(id) {
    if (id !== null && !get(id)) return false;
    userdata.mutate(d => { d.activeProject = id; });
    return true;
  }

  function update(id, patch) {
    if (!get(id)) return false;
    userdata.mutate(d => {
      const p = d.projects[id];
      for (const k of ['nev', 'cim', 'datum', 'megjegyzes']) {
        if (patch[k] !== undefined) p[k] = String(patch[k]);
      }
      if (patch.terv !== undefined) p.terv = patch.terv;
      if (patch.listaId !== undefined) p.listaId = patch.listaId;
    });
    return true;
  }

  function remove(id, alsoList) {
    const p = get(id);
    if (!p) return false;
    const listId = p.listaId;
    userdata.mutate(d => {
      delete d.projects[id];
      if (d.activeProject === id) d.activeProject = Object.keys(d.projects)[0] || null;
    });
    if (alsoList && listId) lists.remove(listId);
    return true;
  }

  /** Every project needs somewhere to put items; make one on demand. */
  function ensureList(id) {
    const p = get(id);
    if (!p) return null;
    if (p.listaId && lists.get(p.listaId)) return lists.get(p.listaId);
    const l = lists.create(p.nev);
    update(id, { listaId: l.id });
    return l;
  }

  /** The project's list, made active so every other panel follows along. */
  function focus(id) {
    const p = get(id);
    if (!p) return null;
    setActive(id);
    const l = ensureList(id);
    if (l) lists.setActive(l.id);
    return l;
  }

  function rows(id) {
    const p = get(id || activeId());
    if (!p || !p.listaId) return [];
    return lists.rows(p.listaId);
  }

  function stats() {
    const ps = all();
    return {
      projektek: ps.length,
      tervvel: ps.filter(p => p.terv && p.terv.igenyek && p.terv.igenyek.length).length
    };
  }

  return { all, get, create, update, remove, setActive, activeId, active, ensureList, focus, rows, stats };
}

export { createProjects };
