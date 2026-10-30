# WP-TV4: Körkészlet (the circuit set, and the tray inside the view)

Status: todo · Wave B · Depends: TV3 · Size: S (~110 lines) · Spec: next free · Decisions: none

## Goal
*"Create (or choose from a preset of) the list of the circuits that will be used: a common set, like CLANV4 as an
example of a possible common circuit type, counting only 2 Klíma devices and a custom one if it is needed."*

## Read
- `08o-cpr.js`: `CPR_CAT`, `cprRows`, `cprExpect`, `cprActivate`, `cprLoadSample`, `CPR_SAMPLE_CLANV4`, `cprImport` /
  `cprExport`, `cprAddCustom`, `cprDialog`
- `round-2026-10-10/WP-M2_circuit-presets.md` §Build 2 (sets, duplicate keys, `expect:[1,2]` on klíma)
- `08of-wf-tray.js` (all 60 lines: `trayWaiting`, `trayRows`, `trayApply`)
- `08oa-wf-eloplan.js` :48 `elpSuggest`, :101 `elpUnassigned`

## Build (`src/08tc-tpo-edit.js`, the left panel)
1. **Set picker** `Készlet ▾`:
   - the options are `Projekt` · `CLANV4 minta` · `Alap (1. szint)` · `Fájlból…` (`cprImport`).
   - Choosing a set **does not create circuits**. It lists the set's rows with a count per key (klíma ×2 from
     `cprExpect` or the number of rows) and a ☑ per row.
   - **Alkalmaz** = `cprActivate` per ticked row, as one undo step.
2. **Circuit list** (this level's board):
   - each row: the colour, `ref name`, `tvPattern`, members / expected, and the status (`cktStatus`; `vár` with no
     members);
   - a click sets `state.tpo.cur`. The canvas highlights that circuit's `up` links, and TV5–TV7 tools assign new
     members to it.
3. `＋ Saját kör…` = `cprAddCustom`. `＋ a katalógusból…` = M2's picker. No new dialog.
4. **The tray inside the view** (GO WIRE T4):
   - `⚡ Elosztóra vár: N` (`trayWaiting`), with the same rows (`trayRows`) and `Hozzárendel` (`trayApply`);
   - the endpoints without a circuit that do not reach the board yet are listed under `Kör nélkül (n)`, with the
     reason `'még nincs betápja'`;
   - dragging one onto a circuit row = `cktAssign`, as one undo step.
5. **The Kapcsolás box**: the Lánc / Csillag toggle and the hub. It is disabled until TV7.

## Tests
1. Load CLANV4 → `szobakor ×3`, `klima ×3`. Untick one klíma, Alkalmaz → 2 klíma circuits active, in one undo step.
2. The active circuit survives a re-render.
3. Two sockets whose `up` reaches the board but have no circuit → `⚡ Elosztóra vár: 2`; Hozzárendel → 0, the same
   result as the blueprint's tray (deep-equal of `data.circuits`).
4. No circuits → `Nincs áramkör — válassz készletet, vagy futtasd az Áramkörök javaslatát.`
