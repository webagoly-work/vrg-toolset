# WP-T10: Csőközösség (runs, departures, conduits)

Status: todo · Wave C · Depends: T9 · Size: M (~180 lines) · Spec: next free · Decisions: Q-T07, Q-T08, Q-T10, Q-T15 · **⏸ after build**

## Goal
*"Parallel circuits travelling on the same path calculate their overall conduit needs regarding size and count, so that
they can share a conduit, with regard to where these circuits need to depart (which requires a Kötődoboz; users can
place them, and they act as preferred or mandatory points)."*

## Read
- `01_RULES.md` SR-2 … SR-8, CK-7, CK-12
- `fig/06`
- `tools/baseline/rules.js` 81–131 (`BOX`, `CABLES`, `CONDUITS`, `FILL`, `sizeConduit`, `IZ`, `groupK`, `mcbAmps`,
  `cableMm2`, `loadedCores`)
- `tools/baseline/plan.js` §9 `pack` / `nMaxOf` (≈ lines 250–275): **reuse this logic, do not re-derive it**. If it is
  not reachable from outside `plan()`, lift `pack` + `nMaxOf` into `rules.js` as `packPipes(cables, per, cfg, circuits)`
  and make plan.js call it. The CLA parity spec-98 must stay byte-identical.
- `08p` (T9)

## Build (`src/08pd-tpo-share.js`)
1. **Cables per circuit per edge.** The circuit's cable from its preset (`CPR_CAT.cab`, E5 F5), or for switching
   links `tpoCores` (T3). The count comes from T9's `loadN`.
2. **Runs (SR-2):** maximal GP edge chains with an identical `{ref → cables}` map. They break at every departure, every
   box, and after more than 3 corners (SR-6 → a pull box).
3. **Preferred KD (SR-3 `pref`, Q-T08 A):** for each open departure, look for a `pref` mid on the shared stretch within
   600 mm ⚑. If one is found, add it to the leaving circuit's `via` and re-route once (T9). The departure moves into the
   box.
4. **Still-open departures** → CK-7 plus a suggested KD at the node (`gen:'tpo'`, `jb:'kot'`, `size:'100x100'`, the
   height of the band). They go into `tpoTable` (Q-T10 A). Alkalmaz places the ticked ones as real devices, in one
   undo step (`['devices']`).
5. **Pipes per run (SR-4):** `packPipes` over the run's cables, with `ownPipe` circuits kept apart. Then
   `sizeConduit(cables, len)`, then the capacity check In ≤ Iz·k(n) → CK-12. This applies to **distribution runs as
   well** (Q-T15 A).
6. **The share table** (the Csövek tab's inspector, and exportable as CSV):
   - columns: `Szakasz · hossz · körök · kábelek · csövek (n × méret, töltés %) · k · ✓/⚠`;
   - a totals line: metres per conduit size, the count per size, and the number of boxes added.
7. **The Csövek tab render:**
   - line weight = the number of pipes on the run;
   - a label per run of `n × Mxx`;
   - departures as rings: green when in a box, red when open (`fig/06`).

## Tests
1. 3 circuits A1 (1,5 mm² / 13 A), A2 (2,5 / 16 A), V1 (1,5 / 10 A, `ownPipe`) on one 3 m run → `A2+A1 → 1 × M32
   (32 %)`, `V1 → 1 × M20`. These are the `fig/06` numbers; they come from `sizeConduit` and must match it.
2. A departure 400 mm from a `pref` KD → moved into the KD, with no CK-7. At 900 mm it stays open, and CK-7 gives one
   suggested KD.
3. Alkalmaz on the suggestion → one new junction with `gen:'tpo'`; the next run has no open departure.
4. `packPipes`, lifted: spec-98's CLA parity is still byte-identical.
5. More than 3 corners on a run → a pull box in the run list, as E5-Q4 B does.

**⏸ after build:** run the CLA planner file with the T8 seed. Put the share table next to the E5 Pályák result:
circuits per stretch, pipe counts and sizes. Every difference is listed with the rule that causes it (Q-T02 arcs and
Q-T15 distribution sharing are the expected ones). The user decides before T12 changes the engine.
