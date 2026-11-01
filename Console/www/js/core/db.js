/* Job data, one IndexedDB store of records keyed collection/id. Settings stay in store.js.
   Export and erase cover this store too (landmine L1). If IndexedDB is blocked the app keeps
   working from memory and says so. */
const NAME = 'vc-data';
const STORE = 'records';

export function memoryAdapter() {
  const map = new Map();
  return {
    persistent: false,
    all: async () => [...map.values()],
    put: async (rec) => { map.set(rec.key, rec); },
    del: async (key) => { map.delete(key); },
    clear: async () => { map.clear(); },
  };
}

function idbAdapter(factory) {
  const open = new Promise((resolve, reject) => {
    const req = factory.open(NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async (mode, fn) => {
    const db = await open;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    persistent: true,
    all: () => run('readonly', (s) => s.getAll()),
    put: (rec) => run('readwrite', (s) => s.put(rec)),
    del: (key) => run('readwrite', (s) => s.delete(key)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
}

export const defaultAdapter = () => {
  try {
    return globalThis.indexedDB ? idbAdapter(globalThis.indexedDB) : memoryAdapter();
  } catch {
    return memoryAdapter();
  }
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const keyOf = (coll, id) => coll + '/' + id;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export function createDb(adapter = defaultAdapter(), now = () => Date.now()) {
  const inColl = (coll) => (r) => r.key.startsWith(coll + '/');
  const strip = ({ key, ...rest }) => rest;
  return {
    get persistent() { return adapter.persistent; },
    async list(coll, filter) {
      const rows = (await adapter.all()).filter(inColl(coll)).map(strip);
      rows.sort((a, b) => a.createdAt - b.createdAt);
      return filter ? rows.filter(filter) : rows;
    },
    async get(coll, id) {
      const hit = (await adapter.all()).find((r) => r.key === keyOf(coll, id));
      return hit ? strip(hit) : null;
    },
    async put(coll, obj) {
      const t = now();
      const rec = { ...obj, id: obj.id ?? newId(), createdAt: obj.createdAt ?? t, updatedAt: t };
      await adapter.put({ ...rec, key: keyOf(coll, rec.id) });
      return rec;
    },
    del: (coll, id) => adapter.del(keyOf(coll, id)),
    /* undo restores a record exactly as it was */
    restore: (coll, rec) => adapter.put({ ...rec, key: keyOf(coll, rec.id) }),
    dump: () => adapter.all(),
    async load(records) { for (const r of records) await adapter.put(r); },
    clear: () => adapter.clear(),
    /* JSON-safe copy of everything. cleanBlob runs on each photo first, so a file that leaves
       the device carries no EXIF or GPS (L2). */
    async exportAll(cleanBlob = async (b) => b) {
      const out = [];
      for (const r of await adapter.all()) {
        const copy = { ...r };
        for (const [k, v] of Object.entries(copy)) {
          if (typeof Blob !== 'undefined' && v instanceof Blob) copy[k] = await blobToDataUrl(await cleanBlob(v));
        }
        out.push(copy);
      }
      return out;
    },
  };
}
