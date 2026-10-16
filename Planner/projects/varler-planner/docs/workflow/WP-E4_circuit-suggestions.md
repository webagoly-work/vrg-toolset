# WP-E4 — Click the Elosztó → suggested circuits

Status: **BUILT 2026-10-15** (src/08oa-wf-eloplan.js, tests/spec-97, 19 checks; a real click on the Elosztó verified in Edge) · Wave E · Depends: **R1010 M2 (circuit presets — not built yet)**, E3 · Size: M (~170 lines) · Spec: next
free · Decisions: Q-E04

## Goal
*"Then is the first opportunity for users to create the circuits by clicking on the Elosztó — the program makes a list of
suggested circuits (based on our usual policy and what endpoints have been put down). Users select the ones they see fit
from the list, maybe adding a few more to complete the set."*

## Read
R1010 `WP-M2_circuit-presets.md` (the preset catalogue `eloPresets`, `data.circuits[].preset`, `rooms`) · `05j-circuits.js`
28–60 (`cktCreate`, `cktAssign`) · `05x-cabinet.js` 15–45 (`ELO_RULES`, `eloLoadKw`) · `tools/baseline/plan.js` (grep
`socketPlan`, `lightZones` — the P33 assignment) · MATERIAL §6.

## Build
1. LMB on the Elosztó in phase Villamosság / step 4.4 (or its menu `Áramkörök javaslata`) → `eloSuggest(boardId)` →
   rows per MATERIAL §6: `{ref:'A2', name, preset, members:[ids], mm2, mcb, why}`. Members are real endpoints already
   placed; DED rows one per DED endpoint; socket rows by room (bedroom separate, large rooms 2, kitchen worktop own,
   wet own); lighting per Q-E04.
2. `wfTable` with ☑ per row, editable name, and a final row `＋ Saját áramkör` (opens M2's preset picker). Alkalmaz →
   `cktCreate` + `cktAssign` for ticked rows; existing circuits are kept and their members not moved (rows that would
   move a member are shown greyed with `'már az A5 körben'`).
3. After Alkalmaz: HUD `'14 áramkör létrehozva · 3 végpont kör nélkül'` and the unassigned list.
4. Re-running suggests only for endpoints still without a circuit.

## Tests
1. A fixture: 2 bedrooms (4 sockets each), kitchen (5 worktop sockets + főzőlap DED + sütő DED), bath (2), living 32 m²
   (10 sockets), 12 lamps → rows: 2 DED · 2 bedroom · 1 kitchen · 1 wet · 2 living · lighting per Q-E04 A = 2 (V1, V2)
   → 10 rows (exact names in the spec).
2. Unticking a row leaves its endpoints unassigned and listed.
3. P33 v1 sketch → the suggestion matches the approved 16 circuits (A2–A15, V1, V2) in member sets (the spec reads them
   from `Calculator/P33-baseline/v1_2026-10-12/kimenet`).

## Built — notes

- **Entry points:**
  - a click on the Elosztó in phase Villamosság, with nothing else running and at least one endpoint without a circuit;
  - the Elosztó right-click menu (🧮 Áramkörök javaslata…);
  - the phase-4 button;
  - the action circuit.suggest (⌘K).
- **Policy as built:**
  - large = over 20 m² with at least 4 sockets, or over 8 sockets; a large room gets ceil(n / 8) circuits, at least 2,
    split along the room's perimeter;
  - small rooms pool by adjacency (outlines within 450 mm) up to 8 sockets;
  - the worktop = hVar pult or a kitchen socket at 900–1300 mm;
  - a DED's preset comes from hVar, var, or a word in its name, else a generic 16 A;
  - V2 = halo, gyerek, furdo; a lamp follows its switch's zone.
- **Test 3** (the P33 cross-check) is not a spec: P33's approved socket plan is hand-configured (p33.config.js
  socketPlan), and the client data is not in the repo.
