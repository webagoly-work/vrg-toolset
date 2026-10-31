# Vezetékezés és útvonal — agent init
*For a Claude Code session on wiring, the router or the Topology View. Read this, then the files in §3.*
**Felelős:** Arnold, Design Division · **Indító:** GO ROUTE

## 1. What it is
A line of work inside the Planner, not a program of its own: more wiring features, our own PCB-style
autorouter, and the Topology View. Nets are circuits, layers are wall faces, ceiling and floor, vias
are crossings and hops. The Topology View is the netlist in front of the router.

## 2. Where
- Engine parts: `network.js` wall graph, `plan.js` fits each link of a fixed tree with Dijkstra,
  `geom.js` reads the ban, minus and előnyben marks (GO-ROUTE.md §1).
- Pack: `Planner/projects/varler-planner/docs/topology/`. Audits: `docs/workflow/` in the same project.
- Engine rules: `Planner/projects/varler-planner/tools/baseline/README.md`.

## 3. Read first
1. `GO-ROUTE.md`, and ask its §2 questions before any design or code
2. `Planner/projects/varler-planner/docs/workflow/MONEY-PATH-AUDIT_2026-10.md`
3. `Planner/projects/varler-planner/docs/workflow/WIREWAY_AUDIT_2026-10-18.md`
4. `Planner/projects/varler-planner/docs/topology/02_ENGINE_GAPS.md` — G1–G8
5. `Planner/projects/varler-planner/docs/PRIMER.md` before any Planner edit

## 4. Build / test / check
As in `planner.md`. Golden renders must stay byte-identical.

## 5. Rules and traps
- Which features is not decided: find out first, do not guess and build (GO-ROUTE.md §0).
- "Reverse engineering" means published algorithms and open-source code, never decompiling commercial
  programs. Agree the wording with the user (GO-ROUTE.md §0).
- FreeRouting is GPL-3.0: copying its code would put the Planner under GPL (GO-ROUTE.md §2).
- Findings MP-4, MP-5, MP-12, MP-13, MP-14 must not get worse (GO-ROUTE.md §1).
- Keep K1, the `up` tree and T0–T6 behaviour unless the user picks otherwise (GO-ROUTE.md §2).
- Electrical rules come from tested calculations; a qualified person signs off (Council charter §3).

## 6. Current state
- git 2026-10-30 e654103 GO files consolidated, new GO MAIN, CLAUDE.md codephrases; anonymiser re-run
- git 2026-10-30 3932351 Re-root: rewrite old paths to H:\VRG\Full
- git 2026-10-29 f67895f GO ROUTE + Topology View r2: the TV pack rebased on the GO WIRE up-tree and filed und
- Not started: waits on the user's §2 answers (GO-MAIN.md §4).
- Recommended first gaps G7 → G1 → G4. Topology View Wave A recommended before the router (GO-ROUTE.md §2).
- Decision files: `Planner/projects/varler-planner/docs/topology/TOPO-Q-001.json`.

## 7. Do not touch
- Job data for BK2: its counts stay out of Git until the user allows it (GO-ROUTE.md §2).

Forrás: GO-ROUTE.md, GO-MAIN.md, git log main, 2026-10-31
