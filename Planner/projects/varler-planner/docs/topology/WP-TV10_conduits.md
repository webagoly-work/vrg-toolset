# WP-TV10: The Csövek tab (sharing, pipes, departures)

Status: todo · Wave A · Depends: TV9 · Size: M (~150 lines) · Spec: next free · Decisions: Q-TV08, Q-TV10, Q-TV15 · **⏸ after build** · Engine gaps: G4, G5

## Goal
*"Parallel circuits travelling on the same path calculate their overall conduit needs regarding size and count, so that
they can share a conduit, with regard to where these circuits need to depart (which requires a Kötődoboz)."*

## Read
- `01_RULES.md` SR-2 … SR-7, CK-7, CK-12, CK-13
- `fig/06`
- `08t` `tpoOverlay` (TV9)
- `tools/baseline/plan.js`:
  - `pathReport` :606 (busiest chases, box fill with passing pipes, crossings);
  - `cableChecks` :673;
- `08ob` `blReportHtml`: the 🔎 report the tab must agree with
- money-path audit MP-13 (the overfill warning counts legs; the report counts pipes)

## Build (`src/08td-tpo-share.js`)
1. **Stretches.** Per GP edge from `tpoOverlay`:
   - the circuits;
   - the pipes as `n × size` (from the legs' `pipes`) and the fill;
   - the per-pipe k, and the Iz check rows that name the circuit (`R.checks`).
   - Adjacent edges with the same pipe set merge into one **run**.
2. **Departures, computed from R** (the engine does not report them yet, G4):
   - at each GP node, compare the circuit sets of its loaded edges;
   - a change with no box on that anchor is **open**;
   - a `tpoRole:'pref'` KD within 600 mm along the run is shown as `'ide húzná (G4)'`.
   - Open departures are CK-7 rows. Today they are expected wherever two circuits share a stretch and split mid-wall,
     which is the case G4 fixes.
3. **Missing-box suggestions (Q-TV10 A):**
   - the open departures go into `tpoTable`;
   - Alkalmaz places a `jb:'kot'` junction (`gen:'tpo'`, 100 × 100, distribution height) at each ticked spot with
     `tpoRole:'pref'`, as one undo step.
   - Until G4 they are honoured only as user boxes; CK-13 says so.
4. **The share table** (the inspector, exportable as CSV): `Szakasz · hossz · körök · csövek (n × méret, töltés %) · k
   · ✓/⚠ · doboz-kitöltés`.
   - A totals line: metres per conduit size, count per size, the boxes.
   - Every number comes from R, so it equals 🔎 Pálya-ellenőrzés.
5. **The tab render:**
   - line weight = the pipe count; a label `n × Mxx` per run;
   - departures as rings: green = in a box, red = open;
   - with Q-TV15 B (or before G5), distribution stretches show `'körönként külön cső (G5)'`.

## Tests
1. The fig/06 case built as a plan:
   - the trunk stretch shows the engine's packing (`A2+A1 → M32`, `V1 → M20`), equal to `R.legs`;
   - the mid-wall split is an open departure (CK-7) until a KD is placed there.
2. The practice flat:
   - the table's totals per conduit size = the engine's (takeoff-style sums over `R.legs`);
   - the busiest stretch = `pathReport`'s busiest chase.
3. The pref KD at 400 mm → `'ide húzná (G4)'`; at 900 mm → nothing.
4. Alkalmaz on 2 suggestions → 2 junctions, `gen:'tpo'`, one undo.

**⏸ after build:** the practice flat's Csövek tab next to its 🔎 report, number for number, plus the list of open
departures. Those are the evidence for picking G4 / G5 in GO ROUTE.
