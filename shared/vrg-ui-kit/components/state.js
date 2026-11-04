/* VRG UI Kit — components/state.js — build empty / loading / error blocks (state.css draws them).
     VK.state.create({kind:'empty'|'loading'|'error', size:'inline'|'panel', icon:'folder', code:'[ÜRES] // 0 ELEM',
                      title, text, action: 'registry.action.id' | {label, run, icon}, secondary: same, loader:'ring'})
   The primary action renders as a primary .vk-btn; a registry id renders that action's label/icon and runs it.
   error → role="alert"; loading → role="status" + aria-busy; empty → plain group.
   Depends on: core.js, button.css. Optional: loader.js (loading mark), actions.js (action ids). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.state) return;

  var DEF = {
    empty: { icon: 'folder', code: '[ÜRES] // 0 ELEM', title: 'Nincs megjeleníthető elem' },
    loading: { icon: 'loader', code: '[TÖLT] // FOLYAMATBAN', title: 'Betöltés…' },
    error: { icon: 'error', code: '[HIBA]', title: 'Valami nem sikerült' }
  };

  function button(a, primary) {
    if (!a) return null;
    var act = typeof a === 'string' ? (VK.actions && VK.actions.get(a)) : a;
    if (!act) return null;
    var b = VK.el('button.vk-btn', { type: 'button', 'data-variant': primary ? 'primary' : null, 'data-action': act.id || null },
      [act.icon ? VK.icon(act.icon) : null, act.label]);
    b.addEventListener('click', function () { if (typeof a === 'string') VK.actions.run(a); else if (act.run) act.run(); });
    if (typeof a === 'string' && VK.actions && !VK.actions.enabled(act)) b.disabled = true;
    return b;
  }

  function create(o) {
    o = o || {};
    var kind = DEF[o.kind] ? o.kind : 'empty', d = DEF[kind];
    var s = VK.el('div.vk-state', { 'data-kind': kind, 'data-size': o.size === 'panel' ? 'panel' : null });
    if (kind === 'error') s.setAttribute('role', 'alert');
    if (kind === 'loading') { s.setAttribute('role', 'status'); s.setAttribute('aria-busy', 'true'); }
    var mark = VK.el('div.vk-state__mark', { 'aria-hidden': 'true' });
    if (kind === 'loading' && VK.loader) mark.appendChild(VK.loader.create(o.loader || 'ring', { decorative: true, size: o.size === 'panel' ? 'lg' : 'md' }));
    else mark.appendChild(VK.icon(o.icon || d.icon));
    var body = VK.el('div.vk-state__body', null, [
      VK.el('p.vk-state__code', { text: o.code || d.code }),
      VK.el('p.vk-state__title', { text: o.title || d.title }),
      o.text ? VK.el('p.vk-state__text', { text: o.text }) : null]);
    VK.append(s, [mark, body]);
    var acts = [button(o.action, true), button(o.secondary, false)].filter(Boolean);
    if (acts.length) s.appendChild(VK.el('div.vk-state__actions', null, acts));
    return s;
  }

  VK.state = { create: create, DEFAULTS: DEF };
})(typeof window !== 'undefined' ? window : globalThis);
