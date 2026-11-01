/* The agent trace inside the Console. Saved sessions are local records, so they take part in export
   and erase like everything else, and they drop off after the retention period. */
import { mountTrace } from '../trace/panel.js';
import { strings as traceStrings } from '../trace/strings.js';

export const manifest = { id: 'tracemini', category: 'dev', permissions: ['bridge'], offline: true, name: { hu: 'Ügynöknyom', en: 'Agent trace' } };

export const strings = traceStrings;

function storage(db) {
  return {
    list: async () => (await db.list('trace')).map((r) => ({ id: r.id, updatedAt: r.updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt),
    load: async (id) => (await db.get('trace', id))?.events ?? [],
    save: (id, events) => db.put('trace', { id, events }),
    async prune(days) {
      const cutoff = Date.now() - days * 864e5;
      for (const r of await db.list('trace')) if (r.updatedAt < cutoff) await db.del('trace', r.id);
    },
  };
}

async function clientNames(db) {
  return (await db.list('job')).flatMap((j) => [j.client, j.contact, j.site]).filter(Boolean);
}

export function mount(root, ctx) {
  let names = [];
  clientNames(ctx.db).then((list) => { names = list; }).catch(() => {});
  return mountTrace(root, {
    get: (key) => ctx.store.pageSetting('tracemini', key),
    set: (key, value) => ctx.store.setPageSetting('tracemini', key, value),
    names: () => names,
    storage: storage(ctx.db),
  });
}
