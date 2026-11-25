// VRG Stack — the live client every Stack page shares (S5, research/STRINGS-PLAN.md §3.1 ③ and §3.2).
//
//   StackLive.on(event, fn)     'changed' {generated, layers, build} after a build · 'live' {state, layers, msg}
//   StackLive.reloadOn(layers)  reload this page (its #hash, so its selection, is kept) when a build changed one of
//                               these layers; never while a dialog is open or something is being typed: then later
//   StackLive.select(ids) / onSelect(fn)   the selection bus (BroadcastChannel 'vrg-stack', storage-event fallback)
//
// A small badge in the corner says whether the page is live: ● élő (served by serve.js and connected), ○ (no server).
// From file:// and in the phone bundle nothing connects and the page works as before (it says so in the badge title).
// The layer pages call reloadOn with their layer; a page with no call just shows the badge.
(function (root) {
  'use strict';
  const PAGE_LAYERS = { 'metro.html': ['L', 'E'], 'decisions.html': ['Q', 'E'], 'lineage.html': ['I', 'E'], 'control.html': ['A', 'E'], 'commits.html': ['R'], 'runs.html': ['U', 'E'] };
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  const subs = { changed: [], live: [], select: [] };
  const served = /^https?:$/.test(location.protocol) && !root.STACK_BUNDLE;
  let es = null, badge = null, want = null, waiting = false, noteUntil = 0;

  function mkBadge() {
    if (badge || !document.body) return;
    badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:11px Consolas,ui-monospace,monospace;color:#95a0a8;background:rgba(14,24,32,.9);border:1px solid rgba(232,240,246,.15);padding:2px 7px;cursor:default;pointer-events:auto';
    document.body.appendChild(badge);
    say(served ? '○ élő' : '', served ? 'Kapcsolódás a szerverhez… · connecting' : '');
    if (!served) badge.style.display = 'none';
    let note = null; try { note = sessionStorage.getItem('vrg-live-note'); sessionStorage.removeItem('vrg-live-note'); } catch (e) { note = null; }
    if (note) { noteUntil = Date.now() + 4000; say('↻ ' + note, 'Az oldal friss adatot töltött be egy build után · reloaded after a build'); setTimeout(() => { if (!waiting) say(es && es.readyState === 1 ? '● élő' : '○ élő'); }, 4000); }
  }
  function say(text, title) { if (!badge) return; badge.textContent = text; if (title != null) badge.title = title; badge.style.color = /^●|^↻/.test(text) ? '#93d3e6' : /hiba|!/.test(text) ? '#e4877d' : '#95a0a8'; }

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

  function connect() {
    if (!served || es || typeof EventSource !== 'function') return;
    es = new EventSource('/api/events');
    es.onopen = () => { if (!waiting && Date.now() > noteUntil) say('● élő', 'A szerver jelez, ha egy build elkészült; ez az oldal akkor frissül · live'); };
    es.onerror = () => { if (!waiting) say('○ élő', 'Nincs kapcsolat a szerverrel (node serve.js) · no server'); };
    es.addEventListener('changed', ev => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) {} subs.changed.forEach(f => f(d)); maybeReload(d); });
    es.addEventListener('live', ev => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) {} subs.live.forEach(f => f(d));
      if (d.state === 'building') say('◌ épül: ' + (d.layers || []).join(' '), d.full ? 'Teljes build: ' + (d.why || '') : 'Élő build · live build');
      if (d.state === 'error') say('! ' + (d.layers || []).join(' ') + ' hiba', d.msg || ''); });
  }

  // the selection bus (§3.1 ③): BroadcastChannel, or storage events where there is none
  let bc = null; try { bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vrg-stack') : null; } catch (e) { bc = null; }
  const fromBus = d => { if (d && d.type === 'select' && d.from !== page) subs.select.forEach(f => f(d.ids || [], d)); };
  if (bc) bc.addEventListener('message', ev => fromBus(ev.data));
  else addEventListener('storage', ev => { if (ev.key === 'vrg-stack-select' && ev.newValue) { try { fromBus(JSON.parse(ev.newValue)); } catch (e) {} } });

  root.StackLive = {
    served,
    on(ev, fn) { (subs[ev] || (subs[ev] = [])).push(fn); connect(); },
    reloadOn(layers) { want = [].concat(layers || PAGE_LAYERS[page] || []); connect(); },
    select(ids, extra) { const d = Object.assign({ type: 'select', from: page, ids: [].concat(ids || []), at: Date.now() }, extra || {});
      if (bc) bc.postMessage(d); else try { localStorage.setItem('vrg-stack-select', JSON.stringify(d)); } catch (e) {} },
    onSelect(fn) { subs.select.push(fn); },
  };
  const start = () => { mkBadge(); if (PAGE_LAYERS[page]) root.StackLive.reloadOn(PAGE_LAYERS[page]); else connect(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof self !== 'undefined' ? self : this);
