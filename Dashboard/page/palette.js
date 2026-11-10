// palette.js — the command palette overlay of the frame page (WP-08). Classic script; needs window.VRGPaletteLib (shell/lib/palette.js).
//   VRGPalette.open() · close() · isOpen() · setKeymap({ palette: 'Ctrl+Shift+P', ... })
// While it is open main hides the web views (they cannot be drawn under an overlay): vrg.layout.palette({ open: true }) → hideAll,
// vrg.layout.palette({ open: false }) → showAll. Enter runs the row through vrg.layout.run(id); main re-resolves the id.
(function () {
  'use strict';
  const lib = window.VRGPaletteLib;
  const vrg = window.vrg;
  const KIND = { start: 'Indítás', pane: 'Panel', term: 'Terminál', root: 'Mappa', preset: 'Előbeállítás', web: 'Weboldal' };
  const MAX_ROWS = 50;
  let keymap = { ...lib.DEFAULT_KEYMAP };
  let box = null, input = null, list = null, status = null;
  let items = [], recent = [], shown = [], sel = 0, was = null;

  function build() {
    box = document.createElement('div');
    box.dataset.role = 'palette'; box.hidden = true;
    input = document.createElement('input');
    input.type = 'text'; input.dataset.role = 'palette-input'; input.placeholder = 'Parancs keresése…'; input.title = 'Search commands';
    input.autocomplete = 'off'; input.spellcheck = false;
    list = document.createElement('ul'); list.dataset.role = 'palette-list';
    status = document.createElement('div'); status.dataset.role = 'palette-status';
    box.append(input, list, status);
    document.body.append(box);
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    });
    list.addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) pick(shown.findIndex(x => x.id === li.dataset.id)); });
    box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
  }

  function render() {
    shown = lib.search(items, input.value, recent).slice(0, MAX_ROWS);
    if (sel >= shown.length) sel = Math.max(0, shown.length - 1);
    list.replaceChildren(...shown.map((it, i) => {
      const li = document.createElement('li');
      li.dataset.id = it.id; li.dataset.kind = it.kind; li.dataset.sel = i === sel ? '1' : '0'; li.title = it.en;
      const k = document.createElement('span'); k.className = 'k'; k.textContent = KIND[it.kind] || it.kind;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = it.hu;
      li.append(n, k);
      return li;
    }));
    status.textContent = shown.length ? '' : 'Nincs találat';
    status.title = shown.length ? '' : 'No results';
    const cur = list.querySelector('[data-sel="1"]'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function move(d) {
    if (!shown.length) return;
    sel = (sel + d + shown.length) % shown.length;
    render();
  }

  async function pick(i) {
    const it = shown[i];
    if (!it) return;
    const r = await vrg.layout.run(it.id);
    if (r && r.ok === false) { status.textContent = r.hu || 'Nem sikerült.'; status.title = r.en || ''; return; }   // stays open, shows why
    close();
  }

  async function open() {
    if (!vrg || (box && !box.hidden)) return;
    if (!box) build();
    was = document.activeElement;
    box.hidden = false;                                      // the overlay first, then main hides the views
    input.value = ''; sel = 0; items = []; recent = []; render();
    input.focus();
    const r = await vrg.layout.palette({ open: true });
    if (!box || box.hidden) { vrg.layout.palette({ open: false }); return; }   // closed while the call was in flight
    if (r && r.ok !== false && Array.isArray(r.items)) { items = r.items; recent = r.recent || []; }
    render();
    input.focus();
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    vrg.layout.palette({ open: false });                     // showAll
    if (was && was.focus && document.contains(was)) was.focus();
    was = null;
  }

  document.addEventListener('keydown', e => {
    if (lib.matchKey(keymap.palette, e)) { e.preventDefault(); e.stopPropagation(); box && !box.hidden ? close() : open(); }
  }, true);

  window.VRGPalette = {
    open, close, isOpen: () => !!box && !box.hidden,
    setKeymap(k) { if (k && typeof k.palette === 'string') keymap = { ...keymap, ...k }; },
  };
})();
