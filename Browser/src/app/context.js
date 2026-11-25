// context.js — the VRG Böngésző's shared state: the store, the host and what it can do, the switchable modules, the local
// search index (bookmarks, history, the reading list with its saved text, the PC's VRG servers, the quick links, the
// search engines), opening a URL (Tiszta link → Linkellenőr → history → the host) and the calls to serve.js.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.context) return;

  // the modules a user can switch off in Beállítások come from Browser/modules.json (T8), baked in as VB_DATA.mods.switches:
  // { id, part, hu, desc, on, runs } — runs = the hosts where the module can work at all (all when null). A part left out of
  // the build (build.js --without) brings none of its switches, nav entries or routes.
  const route = (api, path) => Object.keys(api).find(r => path === r || path.startsWith(r + '/') || path.startsWith(r + '?'));

  function create(o) {
    const st = o.store, data = o.data || {}, kind = o.kind;
    const caps = VB.host.caps(kind, st.settings());
    const engines = (data.engines || []).filter(e => e && e.id && e.url);
    const ix = VB.engine.createIndex({ fields: { title: 3, tags: 2, url: 1.2, text: 1 } });
    const listeners = new Set();
    let serverOk = null;                                         // null = not asked yet, true / false = /api/health answered

    const mods = data.mods || { parts: [], switches: [], nav: [], api: null };
    const MODULES = mods.switches;
    const available = id => { const m = MODULES.find(x => x.id === id); return !!m && (!m.runs || m.runs.includes(kind)); };
    const on = id => { const m = MODULES.find(x => x.id === id); return !!m && available(id) && st.moduleOn(id, m.on); };
    const engine = id => engines.find(e => e.id === (id || st.settings().engine)) || engines.find(e => e.default) || engines[0];

    // ---- the local index, rebuilt (debounced) whenever the store changes
    let timer = null;
    function rebuild() {
      ix.clear();
      for (const b of st.bookmarks()) ix.add({ id: 'bm:' + b.id, kind: 'bm', title: b.title, url: b.url, tags: b.tags.concat(b.job ? [b.job] : []), text: b.note, boost: 1.4, ref: b });
      for (const r of st.reading()) ix.add({ id: 'rd:' + r.id, kind: 'rd', title: r.title, url: r.url, tags: r.tags.concat(r.job ? [r.job] : []), text: [r.note, r.excerpt, (r.text || '').replace(/^(#{1,3} |• )/gm, '')].join(' '), boost: 1.2, ref: r });
      const seen = new Set(st.bookmarks().map(b => st.key(b.url)));
      for (const hv of st.history('', 3000)) if (!seen.has(st.key(hv.url))) ix.add({ id: 'hi:' + st.key(hv.url), kind: 'hi', title: hv.title || VB.url.display(hv.url), url: hv.url, tags: [], text: '', boost: 0.6 + Math.min(0.6, hv.count / 20), ref: hv });
      if (on('servers')) for (const s of data.servers || []) ix.add({ id: 'srv:' + s.id, kind: 'srv', title: s.name, url: 'http://localhost:' + s.port + '/', tags: ['vrg', 'szerver', 'helyi', String(s.port)], text: s.hint || '', boost: 1.1, ref: s });
      for (const q of data.quicklinks || []) ix.add({ id: 'ql:' + q.url, kind: 'ql', title: q.hu, url: q.url, tags: [], text: '', boost: 0.9, ref: q });
      if (on('parts')) for (const pt of data.parts || []) ix.add({ id: 'part:' + pt.id, kind: 'part', title: pt.name, url: pt.sheet || '', tags: [pt.id, pt.brand, pt.pn, pt.gtin].filter(Boolean), text: pt.cat, boost: 0.9, ref: pt });
      for (const e of engines) ix.add({ id: 'eng:' + e.id, kind: 'eng', title: e.hu, url: '', tags: (e.bangs || []).map(b => '!' + b).concat(e.bangs || []), text: (data.groups || {})[e.group] || '', boost: 0.8, ref: e });
    }
    st.on(() => { clearTimeout(timer); timer = setTimeout(() => { rebuild(); emit('index'); }, 60); });
    rebuild();

    const emit = what => { for (const f of listeners) { try { f(what); } catch (e) { console.error(e); } } };

    // ---- the server (serve.js): reader, documents, suggestions
    // a route no built part declares is refused, and so is one whose module is switched off (modules.json `api`)
    function refused(path) {
      if (!mods.api) return null;
      const r = route(mods.api, path);
      if (r === undefined) return { ok: false, code: 'module', hu: 'Ezt a kérést egyik rész sem jelentette be (modules.json).' };
      if (mods.api[r] && !on(mods.api[r])) return { ok: false, code: 'off', hu: 'A modul ki van kapcsolva (Beállítások → Modulok).' };
      return null;
    }
    async function api(path, params, ms) {
      if (caps.api === null) return { ok: false, code: 'host', hu: 'Ezen az eszközön nincs helyi szerver.' };
      const no = refused(path);
      if (no) return no;
      const base = caps.api || '';
      const q = new URLSearchParams(params || {}).toString();
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), ms || 15000) : null;
      try {
        const r = await fetch(base + path + (q ? '?' + q : ''), { signal: ctl && ctl.signal, credentials: 'omit', cache: 'no-store' });
        const j = await r.json();
        if (path === '/api/health') serverOk = !!j.ok;
        return j;
      } catch (e) {
        if (path === '/api/health') serverOk = false;
        return { ok: false, code: 'offline', hu: 'A helyi szerver nem fut (START → O → B, vagy node Browser/serve.js).' };
      } finally { if (t) clearTimeout(t); }
    }
    async function post(path, body, ms) {
      if (caps.api === null) return { ok: false, code: 'host', hu: 'Ezen az eszközön nincs helyi szerver.' };
      const no = refused(path);
      if (no) return no;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), ms || 120000) : null;
      try {
        const r = await fetch((caps.api || '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: ctl && ctl.signal, credentials: 'omit', cache: 'no-store' });
        return await r.json();
      } catch (e) { return { ok: false, code: 'offline', hu: 'A helyi szerver nem fut (START → W → B → S, vagy node Browser/serve.js).' }; }
      finally { if (t) clearTimeout(t); }
    }
    async function health() { const j = await api('/api/health', null, 2500); emit('server'); return j; }

    // ---- opening a URL: clean, check, remember, hand to the host
    async function open(url, info) {
      const i = info || {};
      let u = String(url || '');
      if (!VB.url.isWeb(u)) { VB.ui.toast('warn', 'Nem nyitható meg', 'Csak http és https címet nyitok meg.'); return false; }
      if (on('clean')) {
        const c = VB.url.clean(u);
        if (c.removed.length) { u = c.url; if (!i.quiet) VB.ui.toast('info', 'Tiszta link', 'Levéve: ' + c.removed.join(', ')); }
      }
      if (on('linkcheck')) {
        const crit = VB.url.assess(u).filter(w => w.level === 'crit');
        if (crit.length) {
          const go = await VB.ui.dialog('Gyanús cím', VB.ui.h('div.vb-warns', null, VB.ui.h('p.vb-note', null, VB.url.display(u)), crit.map(w => VB.ui.h('div.vb-warn', { 'data-level': w.level }, w.hu))),
            [{ label: 'Mégse', value: false, variant: 'primary' }, { label: 'Megnyitom így is', value: true, variant: 'danger' }]);
          if (!go) return false;
        }
      }
      st.visit({ url: u, title: i.title || '', via: i.via || '' });
      const r = VB.host.open(u, kind);
      if (!r.ok) { VB.ui.toast('error', 'Nem sikerült megnyitni', VB.url.display(u)); return false; }
      if (caps.sameTab && !i.quiet) VB.ui.toast('ok', 'Megnyitva', caps.how.replace(/^./, c => c.toUpperCase()) + ': ' + VB.url.hostOf(u));
      emit('opened');
      return true;
    }
    function search(q, eng, via) {
      const e = eng || engine();
      if (!e) return false;
      const url = VB.url.searchUrl(e, q);
      return open(url, { title: (q ? q + ' — ' : '') + e.hu, via: via || 'search:' + e.id, quiet: true });
    }

    return {
      st, data, kind, caps, engines, MODULES, mods, ix, on, available, engine, api, post, health, open, search, rebuild, refused,
      built: id => mods.parts.some(p => p.id === id),
      serverOk: () => serverOk,
      onChange(f) { listeners.add(f); return () => listeners.delete(f); },
      emit,
    };
  }

  VB.context = { create, route };
})(typeof window !== 'undefined' ? window : globalThis);
