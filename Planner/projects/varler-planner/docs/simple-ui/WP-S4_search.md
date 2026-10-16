# WP-S4 — Search (the ⌘K half)

**Goal:** the user asked for "a healthy mix of ⌘K and the Wheel Selection". Typing jumps straight to any feature; the
column shows the hits in the same four slots, with Back.

**Read:**
- design §2 (the search line), §4 (the search column);
- 02_MENU-TREE §4;
- `src/05c-actions.js`: `fold`, `paletteScore`, and how `paletteOpen` ranks (use the same scoring, don't write a new
  one).

## Build (in `src/11t-sm-menu.js`)

1. **`smSearchIndex()`:**
   - entries `{a|fn, n, i, kind, path}` for every curated leaf and every generated leaf of `rules` and `endpoints`,
     with `path` = the labels from the root (`Épület / Nyílászárók`);
   - plus every `ACTIONS` id not already in it, with `path` = the action's `group`.

   Build it on each `smOpen('search')` (it's cheap: about 300 entries).
2. **`smSearch(q)`** returns the entries:
   - score = `paletteScore(q, n)` when that is > 0;
   - otherwise `paletteScore(q, n+' '+(action.label||'')+' '+(action.alias||'')+' '+path) - 500`.

     The name match must outrank a path match. Without the −500, "kapcs" puts `Javaslat` (path `…/ Kapcsolás`) above
     `Kapcsolások`, because `paletteScore` prefers shorter texts.
   - drop zero scores;
   - sort: enabled first, then by score descending, then by label ascending (hu-HU).
3. **Search state:** `SM.q` (a string or `null`), `SM.res` (the list), `SM.win` (window start), `SM.focus`.
   - The column shows `SM.res.slice(win, win+4)` + `◂ Vissza`.
   - The breadcrumb is replaced by `⌕ <q>▏` on the left and `<win+1>–<win+n> / <total>` on the right.
   - Zero hits → one disabled slot, `Nincs találat`.
   - Line 2 of each hit = its `path`.
4. **Keys** (extending S2's handler):
   - while browsing, a printable key without mod → `SM.q=key` and search;
   - in search:
     - printable keys append, including digits;
     - Backspace deletes; on an empty query it goes back to browse at the same level;
     - Esc or ← → back to browse;
     - ↑ / ↓ move focus, and past slot 4 the window scrolls by 1 (`win` changes, the focus stays at 4);
     - Enter activates as in S2 (the leaf kind decides close or stay).
5. **Ctrl+K (⌘K)**, a capture listener in simple mode only: `smOpen('search')` with an empty query, then
   `preventDefault` + `stopImmediatePropagation`. **The palette (05c) must not open** in simple mode, but still opens
   in normal mode.
6. **The dial** shows `⌕` in the core while searching (extend `smDialState`).

## Tests — `tests/spec-s4-sm-search.js` (real tree from S3)

1. `smSearch('ajto')[0].a==='wf.door'`.
2. `smSearch('vizes')[0].a==='wf.rule.vizes'`, path `Épület / Szabályok / Szabálykészlet / Egyéb területek`.
3. `smSearch('kapcs')[0].a==='wf.switches'`.
4. `smSearch('zzqx')` → `[]`; the rendered column is `Nincs találat` (disabled) + `Vissza`.
5. A legacy action is found: `smSearch('kabel')` contains `mode.cable`.
6. Typing `l`, `a`, `m` while browsing at the root → `SM.q==='lam'`; Backspace ×3 → browse at the root.
7. `smSearch('vegpont')` has more than 4 hits:
   - ↓ ×5 from slot 1 → `SM.win===1`;
   - the right of the line reads `2–5 / <total>`.
8. Ctrl+K in simple mode → `SM.open && SM.q===''`, and `#palette` is not visible. Ctrl+K in normal mode → the palette
   opens (`paletteIsOpen()`).
9. A disabled hit sorts after an enabled hit of equal score. Use two test actions with the same label, one `when:()=>false`.

## Out of scope

Fuzzy weighting changes, and search history. ("Legutóbbi" is a later idea; don't add it.)
