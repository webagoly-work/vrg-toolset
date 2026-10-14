# WP-E5 — Finish Erősáram: the P33 engine in the Planner (Pályák → Vezetékek)

Status: todo · Wave E · Depends: R2, R4, E1–E4 · Size: L (~300 lines of glue; the engine itself is reused) · Spec: next
free · Decisions: Q-E05, Q-E07 · **⏸ after build: P33 acceptance**

## Goal
*"After this we are ready to finish the Erősáram layer (redőny control is on a different layer from now on) — based on
this information the program calculates and fills out first the wireways, then with another button the whole wiring of
that device / room-wide / house-wide."*

## Read
`tools/baseline/README.md` (the rules), `run.js` (the pipeline order), `geom.js`, `prep.js`, `network.js`, `plan.js`
(504 lines), `emit.js` (how a result becomes vplan paths/devices) · `build.js` (how src is concatenated) · `05w-fill.js`
(the Planner's own fill — what stays) · WP-R2/R4/E1/E3 query functions.

## Build
1. **Bundle, don't port** (Q-E05 A): `build.js` wraps each `tools/baseline/{rules,geom,prep,network,plan}.js` in a
   CommonJS shim (`const BL=(function(){const M={};function require(n){…}… return M;})();`) inserted after `06a`. One
   engine for the CLI and the Planner. `rules.js` reads `PT_SLOTS` / `STD_H` when it runs in the page (and its own
   copies under Node until they are removed).
2. **Input adapter** `blInput(level)` → the engine's sketch shape, built from Planner data instead of sketch heuristics:
   allowed walls = `rwlAllowed` (R2), ceiling reach = E2 marks, service points = `jbServicePoints` (E3), lamp→switch =
   `sw.ctl` (E1), circuits = `data.circuits` (E4), heights = `stdPick` (R4), worktop / island / wet = R3 marks, the
   `p33.config` items that have no Planner data yet → `data.blConfig` (empty by default).
3. Button 1 **`Pályák kiszámítása`** (step 4.5): runs geom → network → plan up to conduits; writes paths (`route:
   'channel'` trunk 2600 / dist 2450), boxes (drop, corner, end) and conduit sizes on the **Erősáram** layers, tagged
   `gen:'bl'` (a re-run replaces only `gen:'bl'` items). Result table: `16 kör · 289 csőszakasz · 26 sarokdoboz …`
   + the engine's warnings (unmarked wall used ×4 cost, etc.).
4. Button 2 **`Vezetékek`** with scope `Eszköz | Helyiség | Ház`: cables per circuit through the conduits (`countCables`
   / `mergeCables`), cable types from `CIRCUIT_CABLE` / `SWITCH_LEG`. Scope device = the selected endpoint's leg only.
5. **Socket circuits are classic chains** (E06 answer): Elosztó → first room socket → … → last, never through the
   szobadoboz; lighting and switch legs meet in the szobadoboz / portal box (E3 `jbMeet`).
6. Redőny (`SHU`) endpoints are skipped with the note `'redőnyvezérlés: külön rétegen'` (Q-E07 decides which).
7. **Acceptance (⏸):** P33 redrawn with the WF tools (or the v1 sketch converted: sketch lines → `wspan` via R2's test
   converter, `p33.config` → marks / `blConfig`) → buttons 1 + 2 → compare with
   `Calculator/P33-baseline/v1_2026-10-12/kimenet`: circuits 16, endpoints 111, conduit legs, box counts, cable metres
   (±1 %). Differences listed, not hidden.

## Tests
1. The bundled engine and `node tools/baseline/run.js` give identical `plan` output on the P33 v1 sketch (deep-equal of
   the plan object).
2. `blInput` on a 2-room fixture: allowed walls = its `vezetheto` marks only.
3. Re-run replaces `gen:'bl'` items and keeps hand-drawn paths.
4. Scope `Helyiség` cables only that room's legs.
