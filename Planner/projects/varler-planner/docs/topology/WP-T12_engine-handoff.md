# WP-T12: Engine hand-off (Pályák / Vezetékek follow the topology)

Status: todo · Wave C · Depends: T10 (+ its ⏸ answers) · Size: L (~250 lines across engine + adapter) · Spec: next free · Decisions: Q-T01, Q-T02, Q-T15 · **⏸ after build: CLA parity**

## Goal
*"This should be the basis of the autowiring."*

The E5 buttons stop inferring what the user has now said explicitly.

## Read
- `workflow/E5_ENGINE_REVIEW.md` §1 (the pipeline table), §8–§9
- `tools/baseline/plan.js`:
  - §2 service points;
  - §7 distribution (the per-circuit union of shortest paths);
  - inferLamps (509);
  - circuits (566);
  - §9 legs;
- `08ob-wf-engine.js` 41–100 (`blInput`), 101–115 (`blSwitchGroups`)
- `tools/baseline/README.md`: "this folder holds pure modules only"
- `01_RULES.md` SR-8

## Build
1. **The adapter (`08ob` `blInput`):** for circuits with a `topo`, pass `cfg.topo = {ref → {links, groups, ownPipe}}`
   with device ids mapped to engine endpoint ids. Circuits without `topo` are passed exactly as today.
2. **The engine (`plan.js`), Q-T01 A: one engine.** When `cfg.topo[ref]` exists, that circuit:
   - **skips** the service-point assignment (§7), the lamp inference (inferLamps) and the union-of-shortest-paths
     distribution;
   - **routes each link** on the same face graph from its `a` drop / box to its `b` drop / box. A chain hop is socket box
     to socket box with no leállás box (Q-T02 A, TR-S5);
   - **feeds the result into §9 unchanged**: the loads per edge → legs → `pack` → `sizeConduit` → `cableChecks`, with
     distribution pipes shared per run (Q-T15 A) and `ownPipe` kept apart;
   - keeps the heights, the trunk rules and the boxes at service points as they are (SR-8).
   - Circuits without `cfg.topo` go through the old code path, byte for byte.
3. **The Vezetékek scope buttons** work unchanged, because they read the legs.
4. **The diff table** (`tpoTable`, read-only): after Pályák with a topology, list the legs / boxes / pipes / metres
   that differ from a run without `cfg.topo`, per circuit, with the rule that caused each difference.
5. **Docs:** add one line to `tools/baseline/README.md` ("`cfg.topo`: explicit links from the Topology View") and a
   row to E5_ENGINE_REVIEW §4 (the topology replaces `socketPlan` / `switchGroups` / the inference).

## Tests
1. **Parity:** the CLA planner file with **no** `topo` → spec-98 stays identical (167 / 167 legs, 97 / 97 boxes).
2. **Seed parity:** the CLA file with T8's seed **constrained to what the engine already does**, i.e. classic chains in
   the engine's own drop order and groups as `blSwitchGroups`. The circuits, boxes at service points and the trunk are
   identical. The legs differ only where Q-T02 / Q-T15 change a rule, and each difference is listed.
3. One hand edit (A7's chain order reversed) → only A7's legs and the runs it shares change.
4. A circuit with a `fail` link → the engine warns `'<kör>: link fizikai út nélkül — kihagyva'` and still runs the rest.
5. The CLI: `node tools/baseline/run.js` with a `topo` in the config gives the same plan as the page (the bundle rule).

**⏸ after build:** the user looks at CLA under the seeded topology, then makes one hand edit, and approves the diff
table before this becomes the default path for circuits with a topology.
