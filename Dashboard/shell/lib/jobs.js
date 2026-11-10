// jobs.js — the one job queue in main (WP-09). Long work (copy, mail fetch, download) runs here, never in the page.
//   const jobs = createJobs({ emit: (type, data) => ... });
//   const id = jobs.create({ kind: 'copy', hu: 'Másolás', run: async ctx => { ctx.progress(1, 3); if (ctx.cancelled) return; ... } });
// States: queued → running → done | failed | cancelled. Concurrency: 2 per kind, 4 overall. The last 50 finished jobs are kept in memory.
// Events (emit): 'update' {job, state, done, total, hu, kind, err?} and 'ask' {job, question, choices}.
// ctx: progress(done, total, hu?) · ask(question) → Promise<choice> · cancelled (flag) · job (id).
'use strict';

const PER_KIND = 2, OVERALL = 4, KEEP = 50;
const FINAL = new Set(['done', 'failed', 'cancelled']);

function createJobs({ emit = () => {}, perKind = PER_KIND, overall = OVERALL, keep = KEEP } = {}) {
  const jobs = new Map();                                           // id → record, in creation order
  let seq = 0;

  const snap = j => {
    const s = { job: j.id, kind: j.kind, state: j.state, done: j.done, total: j.total, hu: j.hu };
    if (j.err) s.err = j.err;
    return s;
  };
  const fire = (type, data) => { try { emit(type, data); } catch (e) {} };
  const update = j => fire('update', snap(j));

  function trim() {
    const fin = [...jobs.values()].filter(j => FINAL.has(j.state));
    for (const j of fin.slice(0, Math.max(0, fin.length - keep))) jobs.delete(j.id);
  }

  function settle(j, state, err) {
    j.state = state;
    if (err) j.err = err;
    if (j.pending) { const p = j.pending; j.pending = null; p.resolve('cancel'); }
    update(j);
    j.finish(snap(j));
    trim();
    pump();
  }

  function pump() {
    const all = [...jobs.values()];
    let running = all.filter(j => j.state === 'running');
    for (const j of all) {
      if (running.length >= overall) break;
      if (j.state !== 'queued') continue;
      if (running.filter(r => r.kind === j.kind).length >= perKind) continue;
      start(j);
      running = all.filter(r => r.state === 'running');
    }
  }

  function start(j) {
    j.state = 'running';
    update(j);
    const ctx = {
      job: j.id,
      get cancelled() { return j.cancelled; },
      progress(done, total, hu) {
        if (j.state !== 'running') return;
        if (Number.isFinite(done)) j.done = done;
        if (Number.isFinite(total)) j.total = total;
        if (typeof hu === 'string') j.hu = hu;
        update(j);
      },
      ask(question) {
        if (j.cancelled) return Promise.resolve('cancel');
        if (j.sticky !== undefined) return Promise.resolve(j.sticky);
        const q = question && typeof question === 'object' ? question : { hu: String(question) };
        const choices = Array.isArray(q.choices) ? q.choices.map(String) : [];
        return new Promise(resolve => {
          j.pending = { resolve, choices };
          fire('ask', { job: j.id, question: String(q.hu || q.question || ''), choices });
        });
      },
    };
    Promise.resolve().then(() => j.run(ctx)).then(
      () => settle(j, j.cancelled ? 'cancelled' : 'done'),
      e => settle(j, j.cancelled ? 'cancelled' : 'failed', String(e && e.message || e)),
    );
  }

  function create({ kind, hu, steps, run }) {
    if (typeof run !== 'function') throw new Error('jobs: run missing');
    const id = 'j' + (++seq);
    let finish; const done = new Promise(r => { finish = r; });
    const j = { id, kind: String(kind || 'job'), hu: String(hu || ''), state: 'queued', done: 0, total: Number.isFinite(steps) ? steps : 0, run, cancelled: false, pending: null, sticky: undefined, err: '', finish, whenDone: done };
    jobs.set(id, j);
    update(j);
    pump();
    return id;
  }

  function cancel(id) {
    const j = jobs.get(id);
    if (!j || FINAL.has(j.state)) return { ok: false, err: 'not-found', hu: 'Nincs ilyen futó feladat.' };
    j.cancelled = true;
    if (j.state === 'queued') settle(j, 'cancelled');
    else if (j.pending) { const p = j.pending; j.pending = null; p.resolve('cancel'); }
    return { ok: true };
  }

  function answer(id, choice, all) {
    const j = jobs.get(id);
    if (!j || !j.pending) return { ok: false, err: 'not-found', hu: 'Nincs megválaszolandó kérdés.' };
    if (j.pending.choices.length && !j.pending.choices.includes(choice)) return { ok: false, err: 'bad-request', hu: 'Érvénytelen választás.' };
    const p = j.pending; j.pending = null;
    if (all === true && choice !== 'cancel') j.sticky = choice;
    p.resolve(choice);
    return { ok: true };
  }

  const list = () => [...jobs.values()].map(snap);
  const get = id => { const j = jobs.get(id); return j ? snap(j) : null; };
  const whenDone = id => { const j = jobs.get(id); return j ? j.whenDone : Promise.resolve(null); };

  return { create, cancel, answer, list, get, whenDone };
}

module.exports = { createJobs, PER_KIND, OVERALL, KEEP };
