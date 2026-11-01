/* Local-first state: settings plus up to three presets. The active preset is the live page
   selection, so every edit saves at once. All keys start with vc.; export and erase cover those
   and the job records in core/db.js. */
export const STATE_KEY = 'vc.state.v1';
export const PREFIX = 'vc.';
export const MAX_PRESETS = 3;
export const NAME_MAX = 24;
export const DENSITIES = ['glance', 'standard', 'dense'];
export const DEFAULT_PAGES = ['job', 'measure', 'checklist', 'calc', 'cheat'];
export const UNDO_MS = 10000;

const clone = (v) => JSON.parse(JSON.stringify(v));

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function freshState(defaultName) {
  return {
    v: 1,
    settings: { lang: 'hu', density: 'standard', glove: false, sunlight: false, activeJob: null },
    presets: [{ id: 'p1', name: defaultName, pages: DEFAULT_PAGES.slice(), pageSettings: {} }],
    active: 'p1',
  };
}

export const cleanName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');
export const validName = (name) => { const n = cleanName(name); return n.length > 0 && n.length <= NAME_MAX; };

/* A damaged or older save must not stop the app from opening. */
function sanitize(raw, known, defaultName) {
  const base = freshState(defaultName);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.presets) || !raw.presets.length) return base;
  const s = raw.settings || {};
  const settings = {
    lang: s.lang === 'en' ? 'en' : 'hu',
    density: DENSITIES.includes(s.density) ? s.density : 'standard',
    glove: !!s.glove,
    sunlight: !!s.sunlight,
    activeJob: typeof s.activeJob === 'string' ? s.activeJob : null,
  };
  const presets = [];
  for (const p of raw.presets.slice(0, MAX_PRESETS)) {
    if (!p || !p.id || presets.some((q) => q.id === p.id)) continue;
    const pages = (Array.isArray(p.pages) ? p.pages : []).filter((id, i, all) => known.includes(id) && all.indexOf(id) === i);
    const pageSettings = p.pageSettings && typeof p.pageSettings === 'object' ? p.pageSettings : {};
    presets.push({ id: String(p.id), name: validName(p.name) ? cleanName(p.name) : defaultName, pages, pageSettings });
  }
  if (!presets.length) return base;
  return { v: 1, settings, presets, active: presets.some((p) => p.id === raw.active) ? raw.active : presets[0].id };
}

export function createStore({ storage, known, defaultName }) {
  let backend = storage;
  let persisted = true;
  try {
    backend = storage ?? globalThis.localStorage;
    if (!backend) throw new Error('no storage');
    backend.getItem(STATE_KEY);
  } catch {
    backend = memoryStorage();
    persisted = false;
  }

  let state;
  try {
    state = sanitize(JSON.parse(backend.getItem(STATE_KEY)), known, defaultName);
  } catch {
    state = freshState(defaultName);
  }

  const listeners = new Set();
  const save = () => {
    try {
      backend.setItem(STATE_KEY, JSON.stringify(state));
      persisted = true;
    } catch {
      persisted = false;
    }
  };
  const commit = (fn) => {
    fn(state);
    save();
    listeners.forEach((l) => l(state));
  };
  const active = () => state.presets.find((p) => p.id === state.active);
  const preset = (id) => state.presets.find((p) => p.id === id);
  const nextId = () => {
    for (let i = 1; ; i++) if (!preset('p' + i)) return 'p' + i;
  };
  const keys = () => {
    const out = [];
    for (let i = 0; i < backend.length; i++) {
      const k = backend.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k);
    }
    return out;
  };

  return {
    get state() { return state; },
    get persisted() { return persisted; },
    active,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    setSetting(key, value) { commit((s) => { s.settings[key] = value; }); },

    /* pages of the active preset */
    enablePage(id) {
      if (!known.includes(id) || active().pages.includes(id)) return false;
      commit(() => { active().pages.push(id); });
      return true;
    },
    disablePage(id) { commit(() => { const p = active(); p.pages = p.pages.filter((x) => x !== id); }); },
    movePage(id, delta) {
      const pages = active().pages;
      const from = pages.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= pages.length) return false;
      commit(() => { pages.splice(to, 0, pages.splice(from, 1)[0]); });
      return true;
    },
    reorderPages(ids) {
      const pages = active().pages;
      if (ids.length !== pages.length || !ids.every((id) => pages.includes(id))) return false;
      commit(() => { active().pages = ids.slice(); });
      return true;
    },

    /* per-page settings of the active preset; they survive disabling the page */
    pageSetting: (id, key) => active().pageSettings[id]?.[key],
    setPageSetting(id, key, value) {
      commit(() => {
        const ps = active().pageSettings;
        ps[id] = { ...ps[id], [key]: value };
      });
    },

    /* presets */
    addPreset(name) {
      if (state.presets.length >= MAX_PRESETS || !validName(name)) return null;
      const id = nextId();
      commit((s) => {
        const copy = clone(active());
        s.presets.push({ ...copy, id, name: cleanName(name) });
        s.active = id;
      });
      return id;
    },
    renamePreset(id, name) {
      if (!preset(id) || !validName(name)) return false;
      commit(() => { preset(id).name = cleanName(name); });
      return true;
    },
    activatePreset(id) {
      if (!preset(id)) return false;
      commit((s) => { s.active = id; });
      return true;
    },
    deletePreset(id) {
      if (state.presets.length <= 1 || !preset(id)) return false;
      commit((s) => {
        s.presets = s.presets.filter((p) => p.id !== id);
        if (s.active === id) s.active = s.presets[0].id;
      });
      return true;
    },

    /* whole-state snapshot, for undo */
    snapshot: () => clone(state),
    restore(snap) { commit((s) => Object.assign(s, clone(snap))); },

    /* data export and erase (landmine L1) */
    exportData(now = new Date()) {
      const data = {};
      for (const k of keys()) {
        const v = backend.getItem(k);
        try { data[k] = JSON.parse(v); } catch { data[k] = v; }
      }
      return { app: 'varler-console', schema: 1, exportedAt: now.toISOString(), data };
    },
    eraseAll() {
      const dump = {};
      for (const k of keys()) { dump[k] = backend.getItem(k); backend.removeItem(k); }
      const lang = state.settings.lang;
      state = freshState(defaultName);
      state.settings.lang = lang;
      listeners.forEach((l) => l(state));
      return dump;
    },
    restoreErased(dump) {
      for (const [k, v] of Object.entries(dump)) backend.setItem(k, v);
      state = sanitize(JSON.parse(dump[STATE_KEY] ?? 'null'), known, defaultName);
      listeners.forEach((l) => l(state));
    },
  };
}
