// quick.js — the quick bar overlay of the frame page (WP-30). Classic script; needs window.VRGQuick (shell/lib/quick.js) and window.VRGPaletteLib.
//   VRGQuickBar.open() · close() · isOpen()
// Opened by the global hotkey (event quick.open from main). Like the palette it hides the web views while it is open. The preview under the
// input is VRGQuick.route() on the palette index; Enter sends the line to main (vrg.search.quick), which runs a command or resolves a URL,
// and the page then opens what is the page's: a browser tab, the search panel, a new chat thread (prompt filled, not sent), the note dialog.
(function () {
  'use strict';
  const lib = window.VRGQuick;
  const vrg = window.vrg;
  let box = null, input = null, preview = null;
  let items = [], history = [], at = -1, draft = '', was = null;

  function build() {
    box = document.createElement('div');
    box.dataset.role = 'quick'; box.hidden = true;
    input = document.createElement('input');
    input.type = 'text'; input.dataset.role = 'quick-input'; input.placeholder = 'Mit keresel?'; input.title = 'What are you looking for?';
    input.maxLength = 500; input.autocomplete = 'off'; input.spellcheck = false;
    preview = document.createElement('div'); preview.dataset.role = 'quick-preview';
    box.append(input, preview);
    document.body.append(box);
    input.addEventListener('input', () => { at = -1; showPreview(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
  }

  function showPreview() {
    const r = lib.route(input.value, { items });
    preview.textContent = lib.PREVIEW[r.kind] || '';
    preview.title = r.kind === 'none' ? '' : r.kind + (r.target ? ' → ' + r.target : '');
  }

  // history: ↑ goes back in time, ↓ forward; past the newest entry the typed line returns
  function step(d) {
    if (d > 0 && at + 1 >= history.length) return;
    if (at < 0) { if (d < 0) return; draft = input.value; }
    at += d;
    input.value = at < 0 ? draft : history[at];
    showPreview();
  }

  async function open() {
    if (!vrg || (box && !box.hidden)) return;
    if (!box) build();
    was = document.activeElement;
    box.hidden = false;
    input.value = ''; at = -1; items = []; showPreview();
    input.focus();
    const [p, h] = await Promise.all([vrg.layout.palette({ open: true }), vrg.search.quick('')]);
    if (!box || box.hidden) { vrg.layout.palette({ open: false }); return; }
    if (p && p.ok !== false && Array.isArray(p.items)) items = p.items;
    if (h && h.ok !== false && Array.isArray(h.history)) history = h.history;
    showPreview();
    input.focus();
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    vrg.layout.palette({ open: false });
    if (was && was.focus && document.contains(was)) was.focus();
    was = null;
  }

  async function submit() {
    const line = input.value.trim();
    if (!line) return;
    const r = await vrg.search.quick(line);
    if (!r || r.ok === false) { preview.textContent = (r && r.hu) || 'Nem sikerült.'; preview.title = (r && r.en) || ''; return; }   // stays open, shows why
    if (Array.isArray(r.history)) history = r.history;
    close();
    await act(r);
  }

  async function act(r) {
    const F = window.VRGFrame;
    if (!F) return;
    if (r.url && r.kind === 'ai' && F.openSide) { F.openSide(r.url); return; }     // narrow right-hand pane (DESK-Q82 B)
    if (r.url) { F.openUrl(r.url); return; }
    if (r.kind === 'code') { F.search(r.text, { only: 'code' }); return; }           // k: the code index only (DESK-Q84 C)
    if (r.kind === 'stack') { F.search(r.text); return; }
    if (r.kind === 'note') { F.note({ text: r.text }); return; }
    if (r.kind === 'chat') {
      if (!(await F.chat())) return;
      const id = F.panes().find(k => k.startsWith('chat'));
      const inst = id && F.pane(id);
      if (inst && inst.input) { inst.input.value = r.text; inst.input.focus(); }       // the prompt waits for Enter in the chat
      return;
    }
    if (r.kind === 'filter' && window.VRGPalette) {
      await window.VRGPalette.open();
      const pin = document.querySelector('[data-role="palette-input"]');
      if (pin) { pin.value = r.text; pin.dispatchEvent(new Event('input')); pin.focus(); }
    }
  }

  if (vrg && vrg.on) vrg.on('quick', 'open', () => open());

  window.VRGQuickBar = { open, close, isOpen: () => !!box && !box.hidden };
})();
