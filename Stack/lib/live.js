// VRG Stack — the live client every Stack page shares (S5, research/STRINGS-PLAN.md §3.1 ③ and §3.2).
//
//   StackLive.on(event, fn)     'changed' {generated, layers, build} after a build · 'live' {state, layers, msg}
//   StackLive.reloadOn(layers)  reload this page (its #hash, so its selection, is kept) when a build changed one of
//                               these layers; never while a dialog is open or something is being typed: then later
//   StackLive.select(ids) / onSelect(fn)   the selection bus (BroadcastChannel 'vrg-stack', storage-event fallback)
//
// The page contract (S7, §3.1): a layer page calls
//   StackLive.contract({ layer, data, items, select, getSelection })
//     data          its out/<page>-data.js object, which carries { build: {no, generated, kind}, schema }
//     items()       → [[element, [node ids]], …]  what of this page can light up for a node (asked again after renders)
//     select(id)    show that node of this layer the page's own way; getSelection() → [node ids]
// and gets window.STACK_PAGE = { layer, select, highlight(ids, mode), getSelection, build }. When the user selects
// something the page calls StackLive.selected([node ids]); the bus carries `select` and then `string` (the node's
// Stack String, lib/strings.js, computed by the sender from out/stack-data.js, loaded on the first selection). Every
// other open page lights the string's members in its own vocabulary (ice: this is "you") and dims the rest; the badge
// shows the string and an ✕. The badge also carries the build stamp (#N HH:MM) and turns amber when a newer build is
// known (from the server, or out/build-stamp.js re-read every 60 s from file://).
//
// A small badge in the corner says whether the page is live: ● élő (served by serve.js and connected), ○ (no server).
// From file:// and in the phone bundle nothing connects and the page works as before (it says so in the badge title).
// The layer pages call reloadOn with their layer; a page with no call just shows the badge.
(function (root) {
  'use strict';
  const PAGE_LAYERS = { 'metro.html': ['L', 'E'], 'decisions.html': ['Q', 'E'], 'lineage.html': ['I', 'E'], 'control.html': ['A', 'E'], 'commits.html': ['R'], 'runs.html': ['U', 'E'], 'board.html': ['E', 'T', 'L', 'F'] };
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  const subs = { changed: [], live: [], select: [], status: [] };
  const served = /^https?:$/.test(location.protocol) && !root.STACK_BUNDLE;
  let es = null, badge = null, want = null, waiting = false, noteUntil = 0;
  let contract = null, hl = null, latest = null, userActed = false, lastSeq = 0;
  const STATE = { text: '', title: '' };

  function mkBadge() {
    if (badge || !document.body) return;
    const css = document.createElement('style');
    css.textContent = '.stk-hit{filter:drop-shadow(0 0 2px #93d3e6) drop-shadow(0 0 4px rgba(147,211,230,.75));opacity:1!important}.stk-dim{opacity:.26!important;transition:opacity .2s}';
    document.head.appendChild(css);
    badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:11px Consolas,ui-monospace,monospace;color:#95a0a8;background:rgba(14,24,32,.9);border:1px solid rgba(232,240,246,.15);padding:2px 7px;cursor:default;pointer-events:auto';
    document.body.appendChild(badge);
    say(served ? '○ élő' : '', served ? 'Kapcsolódás a szerverhez… · connecting' : 'Fájlból nyitva: nincs élő frissítés; a build-bélyeg percenként frissül · from file: no live updates');
    if (!served && !contract) badge.style.display = 'none';
    let note = null; try { note = sessionStorage.getItem('vrg-live-note'); sessionStorage.removeItem('vrg-live-note'); } catch (e) { note = null; }
    if (note) { noteUntil = Date.now() + 4000; say('↻ ' + note, 'Az oldal friss adatot töltött be egy build után · reloaded after a build'); setTimeout(() => { if (!waiting) say(es && es.readyState === 1 ? '● élő' : '○ élő'); }, 4000); }
  }
  function stamp() {
    const b = contract && contract.data && contract.data.build;
    if (!b || !b.no) return { text: '', stale: false };
    const hm = String(b.generated || '').slice(11, 16), stale = !!(latest && latest.no > b.no);
    return { text: ` · #${b.no} ${hm}${stale ? ` → #${latest.no}` : ''}`, stale };
  }
  function say(text, title) {
    if (title != null) STATE.title = title;
    if (text != null) STATE.text = text;
    if (!badge) return;
    const st = stamp();
    badge.innerHTML = '';
    const main = document.createElement('span'); main.textContent = STATE.text + st.text; badge.appendChild(main);
    badge.title = STATE.title + (st.stale ? '\nÚjabb build van (#' + latest.no + '): kattints az újratöltéshez · a newer build exists: click to reload' : st.text ? '\nAz oldal adata: build' + st.text.replace(' · ', ' ') : '');
    badge.style.color = st.stale ? '#e8a873' : /^●|^↻/.test(STATE.text) ? '#93d3e6' : /hiba|!/.test(STATE.text) ? '#e4877d' : '#95a0a8';
    badge.style.borderColor = st.stale ? '#e8a873' : 'rgba(232,240,246,.15)';
    if (st.stale && !waiting) { badge.style.cursor = 'pointer'; badge.onclick = () => reloadNow([], ''); }
    if (hl && hl.n != null) {
      const chip = document.createElement('span');
      chip.style.cssText = 'margin-left:8px;color:#93d3e6';
      chip.textContent = `┃ ${hl.title} · ${hl.n} itt `;
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'A füzér kiemelésének törlése · clear the string';
      x.style.cssText = 'font:inherit;background:none;border:0;color:#95a0a8;cursor:pointer;padding:0 2px';
      x.onclick = e => { e.stopPropagation(); highlight([], 'clear'); };
      chip.appendChild(x); badge.appendChild(chip);
    }
  }

  function busy() {
    const a = document.activeElement;
    if (document.querySelector('.se-back')) return true;                     // the write gateway's dialog is open
    return !!(a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|)$/.test(a.type || ''))) && a.value);
  }
  function reloadNow(layers, ms) {
    try { sessionStorage.setItem('vrg-live-note', `${layers.join(' ')} frissült${ms ? ' · ' + ms : ''}`); } catch (e) {}
    location.reload();
  }
  function maybeReload(d) {
    if (!want) return;
    const hit = (d.layers || []).filter(l => want.includes(l));
    if (!hit.length) return;
    if (!busy()) return reloadNow(hit);
    if (waiting) return;
    waiting = true; say('↻ friss adat vár', 'Egy build új adatot hozott; kattints a betöltéshez (a gépelés nem vész el, amíg nem kattintasz) · new data: click to load');
    badge.style.cursor = 'pointer'; badge.onclick = () => reloadNow(hit);
  }

  // ONE server connection for all the Stack tabs of this browser: a browser keeps at most six connections to a
  // server, and six pages holding their own event stream would leave none for loading anything. The tab holding the
  // Web Lock 'vrg-stack-sse' opens /api/events and relays every event on the bus; when it closes, another takes over.
  let started = false, online = false;
  function onSse(event, d) {
    if (event === 'status') { online = !!d.ok; subs.status.forEach(f => f(online)); if (!waiting && (online ? Date.now() > noteUntil : true)) say(online ? '● élő' : '○ élő', online ? 'A szerver jelez, ha egy build elkészült; ez az oldal akkor frissül · live' : 'Nincs kapcsolat a szerverrel (node serve.js) · no server'); return; }
    if (event === 'changed') { subs.changed.forEach(f => f(d)); if (d.no) latest = { no: d.no, generated: d.generated }; if (!waiting) say(online ? '● élő' : '○ élő'); maybeReload(d); }
    if (event === 'live') { subs.live.forEach(f => f(d));
      if (d.state === 'building') say('◌ épül: ' + (d.layers || []).join(' '), d.full ? 'Teljes build: ' + (d.why || '') : 'Élő build · live build');
      if (d.state === 'error') say('! ' + (d.layers || []).join(' ') + ' hiba', d.msg || ''); }
  }
  function relay(event, d) { onSse(event, d); if (bc) try { bc.postMessage({ type: 'sse', from: page, event, data: d }); } catch (e) {} }
  function openStream() {
    es = new EventSource('/api/events');
    es.onopen = () => relay('status', { ok: true });
    es.onerror = () => relay('status', { ok: false });
    for (const ev of ['changed', 'live']) es.addEventListener(ev, e => { let d = {}; try { d = JSON.parse(e.data); } catch (x) {} relay(ev, d); });
    setInterval(() => { if (bc) try { bc.postMessage({ type: 'sse', from: page, event: 'status', data: { ok: es.readyState === 1 } }); } catch (e) {} }, 8000);
  }
  function connect() {
    if (!served || started || typeof EventSource !== 'function') return;
    started = true;
    if (bc && navigator.locks && navigator.locks.request) {
      navigator.locks.request('vrg-stack-sse', () => new Promise(() => openStream()));   // held while this tab lives
      try { bc.postMessage({ type: 'sse-ask', from: page }); } catch (e) {}
    } else openStream();
  }

  // the selection bus (§3.1 ③): BroadcastChannel, or storage events where there is none
  let bc = null; try { bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vrg-stack') : null; } catch (e) { bc = null; }
  const fromBus = d => {
    if (!d) return;
    if (d.type === 'sse') { onSse(d.event, d.data || {}); return; }
    if (d.type === 'sse-ask') { if (es && bc) try { bc.postMessage({ type: 'sse', from: page, event: 'status', data: { ok: es.readyState === 1 } }); } catch (e) {} return; }
    if (d.from === page) return;
    if (d.type === 'select') { subs.select.forEach(f => f(d.ids || [], d)); onSelectMsg(d); }
    if (d.type === 'string') onStringMsg(d);
    if (d.type === 'changed' && d.no) { latest = { no: d.no, generated: d.generated }; say(); }
  };
  if (bc) bc.addEventListener('message', ev => fromBus(ev.data));
  else addEventListener('storage', ev => { if (ev.key === 'vrg-stack-select' && ev.newValue) { try { fromBus(JSON.parse(ev.newValue)); } catch (e) {} } });

  /* ---- strings: computed from out/stack-data.js with lib/strings.js, both loaded on the first need */
  let graphP = null;
  const load = src => new Promise(ok => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(true); s.onerror = () => ok(false); document.head.appendChild(s); });
  function graph() {
    if (!graphP) graphP = (async () => {
      if (!root.StackLayers) await load('schema/layers.js');
      if (!root.StackStrings) await load('lib/strings.js');
      if (!root.STACK && !root.STACK_BUNDLE) await load('out/stack-data.js');
      if (!root.STACK || !root.StackStrings) return null;
      return StackStrings.prepare(STACK.nodes, STACK.edges.map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e));
    })();
    return graphP;
  }
  async function stringOf(ids) {
    const ix = await graph(); if (!ix) return null;
    const m = new Map();
    for (const id of ids) { const s = StackStrings.string(ix, id); if (s) for (const x of s.members) m.set(x.id, Math.max(m.get(x.id) || 0, x.score)); }
    if (!m.size) return null;
    const title = ids.map(id => { const n = ix.byId.get(id); return !n ? id : n.layer === 'Q' && n.kind === 'decision' ? id.slice(2) : String(n.title || id); }).join(', ');
    return { members: [...m].map(([id, sc]) => [id, Math.round(sc * 1000) / 1000]), title: title.length > 40 ? title.slice(0, 39) + '…' : title };
  }
  function post(d) { if (bc) bc.postMessage(d); else try { localStorage.setItem('vrg-stack-select', JSON.stringify(d)); } catch (e) {} }

  // another page selected something: wait a moment for its string; compute it here only if none comes
  let pendingSel = null;
  function onSelectMsg(d) {
    clearTimeout(pendingSel);
    if (!(d.ids || []).length) { highlight([], 'clear'); return; }
    const seq = d.seq;
    pendingSel = setTimeout(async () => { if (lastSeq === seq) return; const s = await stringOf(d.ids); if (s && lastSeq !== seq) highlight(s.members.map(x => x[0]), 'string', s.title); }, 2500);   // the sender's own string usually comes first
  }
  function onStringMsg(d) { lastSeq = d.seq; clearTimeout(pendingSel); highlight((d.members || []).map(x => x[0]), 'string', d.title || ''); }

  function highlight(ids, mode, title) {
    const set = new Set(ids || []);
    hl = set.size ? { ids: set, mode: mode || 'string', title: title || ids[0], n: 0 } : null;
    apply(); say();
  }
  let applying = 0;
  function apply() {
    if (!contract || !contract.items) return 0;
    let n = 0;
    for (const [el, ids] of contract.items() || []) {
      if (!el || !el.classList) continue;
      const hit = !!hl && (ids || []).some(i => hl.ids.has(i));
      if (hit) n++;
      el.classList.toggle('stk-hit', hit); el.classList.toggle('stk-dim', !!hl && !hit);
    }
    if (hl) hl.n = n;
    return n;
  }
  // pages re-render: put the highlight back after any change of the DOM (classes only, so no loop)
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => { if (!hl || applying) return; applying = requestAnimationFrame(() => { applying = 0; const before = hl.n; apply(); if (hl && hl.n !== before) say(); }); }) : null;
  addEventListener('pointerdown', () => { userActed = true; }, true);
  addEventListener('keydown', () => { userActed = true; }, true);

  root.StackLive = {
    contract(o) {
      contract = o || {};
      root.STACK_PAGE = {
        layer: contract.layer, build: contract.data && contract.data.build, schema: contract.data && contract.data.schema,
        select: id => contract.select && contract.select(id),
        highlight: (ids, mode) => highlight(ids, mode),
        getSelection: () => (contract.getSelection ? contract.getSelection() : []) || [],
      };
      if (badge) { badge.style.display = ''; say(); }
      if (mo && document.body) mo.observe(document.body, { childList: true, subtree: true });
      if (!served) setInterval(() => load('out/build-stamp.js?t=' + Date.now()).then(() => { const b = root.STACK_BUILD; if (b && b.no) { latest = b; say(); } }), 60000);
      return root.STACK_PAGE;
    },
    // the page's own selection changed by the user: the other pages light its string
    async selected(ids) {
      if (!userActed) return;
      const list = [].concat(ids || []).filter(Boolean), seq = page + ':' + Date.now();
      post({ type: 'select', from: page, ids: list, seq, at: Date.now() });
      if (!list.length) return;
      const s = await stringOf(list);
      if (s) post({ type: 'string', from: page, seed: list, members: s.members, title: s.title, seq, at: Date.now() });
    },
    served,
    on(ev, fn) { (subs[ev] || (subs[ev] = [])).push(fn); connect(); if (ev === 'status' && started) fn(online); return () => { const l = subs[ev]; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; },
    reloadOn(layers) { want = [].concat(layers || PAGE_LAYERS[page] || []); connect(); },
    select(ids, extra) { const d = Object.assign({ type: 'select', from: page, ids: [].concat(ids || []), at: Date.now() }, extra || {});
      if (bc) bc.postMessage(d); else try { localStorage.setItem('vrg-stack-select', JSON.stringify(d)); } catch (e) {} },
    onSelect(fn) { subs.select.push(fn); },
  };
  const start = () => { if (PAGE_LAYERS[page]) { mkBadge(); root.StackLive.reloadOn(PAGE_LAYERS[page]); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof self !== 'undefined' ? self : this);
