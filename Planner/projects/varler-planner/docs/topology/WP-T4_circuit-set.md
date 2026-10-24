# WP-T4: Körkészlet (the circuit set panel)

Status: todo · Wave B · Depends: T3 · Size: S (~110 lines) · Spec: next free · Decisions: none

## Goal
*"Create (or choose from a preset of) the list of the circuits that will be used: a common set, like NV4 as an
example of a possible common circuit type, counting only 2 Klíma devices and a custom one if it is needed."*

## Read
- `08o-cpr.js`: `CPR_CAT`, `cprRows`, `cprExpect`, `cprActivate`, `cprLoadSample`, `CPR_SAMPLE_NV4`, `cprImport`,
  `cprExport`, `cprAddCustom`, `cprDialog`
- `round-2026-10-10/WP-M2_circuit-presets.md` §Build 2 (sets, duplicate keys, `expect:[1,2]` on klíma)
- `08oa-wf-eloplan.js` 48 (`elpSuggest`), 90 (`elpApply`), 101 (`elpUnassigned`)
- `05j` `cktCreate`, `cktColor`

## Build (`src/08pc-tpo-edit.js`, the left panel)
1. **Set picker** `Készlet: ▾`:
   - `Projekt` (the active circuits);
   - `NV4 minta`;
   - `Alap (1. szint)`;
   - `Fájlból…`, which uses M2's import.
   - Choosing a set does **not** create circuits. It shows the set's rows with a count per key (klíma: 2, from
     `cprExpect` or the number of rows with that key) and a ☑ per row. **Alkalmaz** activates the ticked rows through
     M2's own `cprActivate`, as one undo step.
2. **Circuit list**, one row per `data.circuits` on this level's board:
   - a colour dot, `ref name`, the pattern (`tpoPattern`), `members / expected`, and a status from `cktStatus`
     (`vár` when there are no members);
   - a click makes it the **active circuit**, `state.tpo.cur`. The tools T5–T7 write into it, and its tree is
     highlighted on the canvas.
3. `＋ Saját kör…` opens M2's custom row (`cprAddCustom`). `＋ a katalógusból…` opens the M2 preset picker. There is no new dialog.
4. **Kör nélkül (n):** the list from `elpUnassigned()` for this level. A click selects the node. Dragging a row onto a
   circuit row calls `cktAssign`. `🧮 Áramkörök javaslata` runs E4's `elpDialog` unchanged.
5. **The Kapcsolás box** (the Lánc / Csillag toggle and the hub label) needs a selected group. It is filled in T7 and
   disabled until then.

## Tests
1. Load NV4 → the rows show `szobakor ×3` and `klima ×3`. Untick one klíma and Alkalmaz → 2 klíma circuits are active.
2. The active circuit is set by a row click and survives a re-render.
3. Dragging an unassigned socket onto A1 → `cktOfDevice(socket) === A1`, in one undo step.
4. With no circuits: the panel shows `Nincs áramkör — válassz készletet vagy futtasd a javaslatot.`
