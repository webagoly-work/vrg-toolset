# WP-TV8: ✨ Javaslat and accept, in the view

Status: todo · Wave B · Depends: TV3–TV7 · Size: S (~90 lines) · Spec: next free · Decisions: Q-TV06, Q-TV07

## Goal
The view never opens empty on a plan that has endpoints. The suggestions that exist are gathered into **one** table, and
the user only corrects.

## Read
- `01_RULES.md` §8
- `08od` `upSuggest` :63, `upFill` :96, `upAcceptRoom` :107
- `08oe` `ldMasters` :75, `ldPlaceMasters` :91
- `08of` `trayRows`
- `08oa` `elpDialog` :101–120 (the table pattern for `tpoTable`)
- `09-menus.js` :103 `openModal`

## Build (`src/08ta-tpo-model.js`)
1. **`tpoTable(title, rows, cols, onApply)`.** The one approval table of this pack: ☑ per row, a "Miért?" column (the
   rule id + a short text), Alkalmaz. TV10 reuses it.
2. **✨ Javaslat** (toolbar) opens it with four sections:
   - **Betáp-fa:** every node `upSuggest` would change. Rows = `ref · javasolt forrás · miért (upSuggest's why)`.
     Rögzített rows are not listed.
   - **Szobadoboz-mesterek:** `ldMasters`' rows, pre-ticked as GO WIRE pre-ticks them.
   - **Kapcsolási csoportok:** groups whose logic is `'none'` or `'mixed'`, with the TV7 suggestion (star / chain).
   - **Áramkörök:** `trayRows` for what already reaches the board.
3. **Alkalmaz:**
   - order: masters (`ldPlaceMasters`), then `upFill({run})`, then the group writer (TV7), then `trayApply`;
   - all in **one undo step** (`pushUndo(['devices', 'circuits'])` once; each call with `noUndo` where it takes it);
   - re-run the engine only once at the end (`blRun`), as `upFill` already does.
4. **Elfogadom mind** on a lane header = `upAcceptRoom(roomId)`.
5. **First open:** if the level has endpoints and no `up` at all, the view offers ✨ once (a HUD button, never
   automatic).

## Tests
1. The practice flat with no `up` → the table lists one row per node; Alkalmaz → `upCheck` gives no loop or "source
   gone" row, the tray is 0, and one undo restores everything (deep-equal).
2. A rögzített link is not in the table and survives Alkalmaz.
3. Idempotent: ✨ right after Alkalmaz lists 0 Betáp-fa rows.
4. The masters section matches `ldMasters` exactly (same rooms, same ticks).
