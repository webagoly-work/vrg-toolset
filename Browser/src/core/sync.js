// sync.js — the store and the master links (T1, BRW-Q01: the VRG Asztal's web.json is the master of vrg.web-links v1).
//   desktop  vrg-app://browser/__vrg/links   (main answers: Dashboard/shell/lib/applinks.js, the pane's own history included)
//   served   /api/links                      (Browser/serve.js: reads web.json, writes an inbox the Asztal absorbs)
//   mobile, file, web: no master here; links move by file (vrg.web-links v1) until T7.
// pull(): GET → store.adoptMaster(links, 0). push(): POST the outbox → store.adoptMaster(links, n sent). Boot pulls; a change
// pushes after a short pause; while the page is visible it pulls every 20 s (the pane's browsing shows up). Pure apart from
// the fetch and timers handed in.
//   const s = VB.sync.create({ store, kind, fetch, timers }); s.start(); s.status() → { mode, ok, at, hu }
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.sync) return;

  const ENDPOINT = { desktop: '/__vrg/links', served: '/api/links' };
  const BATCH = 500;

  function create(o) {
    const st = o.store, fetchFn = o.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    const url = ENDPOINT[o.kind] || null;
    const T = o.timers || { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id), every: (f, ms) => setInterval(f, ms) };
    const visible = o.visible || (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
    let state = { mode: url ? 'master' : 'local', ok: null, at: 0, hu: url ? 'kapcsolódás…' : 'csak ezen az eszközön' };
    let busy = null, again = false, pushTimer = null;
    const listeners = new Set();
    const set = s => { state = Object.assign({}, state, s); for (const f of listeners) { try { f(state); } catch (e) {} } };

    async function call(method, ops) {
      const init = { method, cache: 'no-store', credentials: 'same-origin' };
      if (method === 'POST') { init.headers = { 'content-type': 'application/json' }; init.body = JSON.stringify({ ops }); }
      const r = await fetchFn(url, init);
      const j = await r.json();
      if (!r.ok || j.ok === false) throw Object.assign(new Error(j.hu || 'HTTP ' + r.status), { hu: j.hu, code: j.code });
      return j;
    }
    // one exchange at a time; a change while one runs asks for one more
    async function run() {
      if (!url || !fetchFn) return state;
      if (busy) { again = true; return busy; }
      busy = (async () => {
        try {
          const out = st.isSynced() ? st.outbox().slice(0, BATCH) : [];
          const j = out.length ? await call('POST', out) : await call('GET');
          st.adoptMaster(j, out.length);
          // the first contact may have queued what the master lacked: send it now
          if (st.outbox().length && !again) again = true;
          set({ ok: true, at: Date.now(), hu: o.kind === 'desktop' ? 'az Asztal könyvjelzőivel együtt' : 'az Asztal könyvjelzőivel együtt (a helyi szerveren át)' });
        } catch (e) {
          set({ ok: false, at: Date.now(), hu: e.code === 'no-master' ? 'ezen a gépen nincs VRG Asztal adat' : 'az Asztal nem érhető el; a változások várnak' });
        } finally {
          busy = null;
          if (again) { again = false; T.set(run, 50); }
        }
        return state;
      })();
      return busy;
    }
    function start() {
      if (!url) return api;
      st.on(w => { if (w === 'outbox') { if (pushTimer) T.clear(pushTimer); pushTimer = T.set(run, 800); } });
      run();
      T.every(() => { if (visible()) run(); }, 20000);
      return api;
    }
    const api = { start, run, status: () => Object.assign({}, state), onChange(f) { listeners.add(f); return () => listeners.delete(f); }, endpoint: url };
    return api;
  }

  const api = { create, ENDPOINT };
  VB.sync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
