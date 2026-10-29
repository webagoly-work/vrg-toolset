# GO ROUTE — new wiring features, with the Budakalász job as the basis and a PCB-style autorouter as the model

*You were started with the codephrase **GO ROUTE**. This file is the whole briefing. The user asked for this thread
on 2026-10-29, at the end of the money-path audit session: "I want some additional features with the wiring logic —
ask me about a Budakalász project as a basis for that (and we will need our own program version with some reverse
engineering of the electrical programs that are used for creating PCB lines, I don't know what it is called)".*

Works from a cloud session or from Claude Code on the user's PC. What each can reach is in §4.

## 0. What the user wants, as far as it is known

1. **More wiring features** in the Planner's wireway / wiring engine. Which ones is **not decided yet**: find out
   first (§2), do not guess and build.
2. **The Budakalász project as the basis**: a real job used as the test case and the source of the requirements.
   You know nothing about it yet beyond §4. Ask the user (§2).
3. **Our own version of a PCB autorouter.** The programs the user means are **PCB autorouters**: the part of an EDA
   (electronic design automation) tool that lays the copper traces on a circuit board. Examples:
   - FreeRouting (open source, Java, GPL-3.0; reads and writes the Specctra DSN / SES format);
   - the KiCad and Altium routers, TopoR (topological, any-angle).

   The ideas to borrow fit our problem closely:
   - rip-up-and-reroute (route, find conflicts, tear out the worst nets, route again);
   - negotiated congestion (PathFinder-style costs that rise where many nets compete);
   - net ordering;
   - push-and-shove (moving existing traces aside);
   - layers with vias, which for us are wall faces, ceiling and floor with crossings;
   - design rules (clearances, which for us are mains vs SELV separation and chase limits).

   "Reverse engineering" here should mean **studying the published algorithms and open-source code, then writing our
   own**. It should not mean decompiling commercial programs. Agree this wording with the user in §2.

## 1. Read first, in this order

1. `Planner/projects/varler-planner/docs/workflow/MONEY-PATH-AUDIT_2026-10.md` — the audit this thread follows.
   Most relevant parts:
   - §2.1: the routing pipeline, step by step, with the owning files;
   - §1 and §5: the 18 findings (MP-1 … MP-18). Several are wiring-logic work that a new feature must not make worse:
     - MP-4: ban zones;
     - MP-5: runs through an undrawn wall;
     - MP-12: csillár risers;
     - MP-13: box overfill;
     - MP-14: voltage-drop length;
   - §7: the tests to add first;
   - §8: four open questions (Q1–Q4), still unanswered when this file was written;
   - Appendices A and B: two scripts that reproduce every finding.
2. `Planner/projects/varler-planner/docs/workflow/WIREWAY_AUDIT_2026-10-18.md`. Read:
   - Part 3.5: other wireway methods considered: grid A*, a capacity-aware Steiner trunk, libavoid;
   - Part 3.7: open-source routing code, with licences;
   - Part 4: the dual model, K1, the `up` tree;
   - Parts 5–11: T0–T6 as built.
3. `GO-WIRE.md` (decisions Q1–Q5) and `Planner/projects/varler-planner/tools/baseline/README.md` (the engine's rules).
4. `Planner/projects/varler-planner/docs/PRIMER.md` before any edit to the Planner.

Today's engine has these parts:

| Part | What it does |
|---|---|
| `network.js` | builds the wall graph |
| `plan.js` | fits each link of a fixed tree with Dijkstra; a light congestion term on the home runs (`cfg.congest`) is the only negotiation step |
| `geom.js` | reads the ban / minus / előnyben marks per face |

This is a natural starting point for a PCB-style router. Nets = circuits. Layers = wall faces, ceiling and floor.
Vias = the service-point crossings and ceiling / floor hops.

## 2. Start by asking (numbered A/B/C options, the user's rule)

Ask these before any design or code, in one message:

1. **The Budakalász job:**
   - which one is meant? An earlier session made four drawings for a job named BK2-GAR under `BK2-GAR\job\out`: plot
     plan, lamp spacing, installation, wireless switching;
   - is there a Planner plan (`.vplan.json`) for it?
   - where do its files live?
   - may its counts be quoted in git?
2. **The features:** which wiring features, in the user's words, and what about the Budakalász job made them necessary.
3. **The router ambition:** pick one.
   - A: a better router inside the existing engine. Rip-up-and-reroute and negotiated congestion over the current wall
     graph, keeping K1, the `up` tree and all T0–T6 behaviour.
   - B: a separate PCB-style router module (Specctra-like input / output), with the Planner as one client of it.
   - C: a study first. A research note comparing FreeRouting, TopoR-style any-angle routing, PathFinder and libavoid
     against our constraints, and no code yet.
4. **"Reverse engineering"**: confirm it means studying published algorithms and open-source code, not decompiling
   commercial programs.
5. **Licences**: FreeRouting is GPL-3.0. Copying its code into the single-file Planner would put the Planner under GPL.
   - A: ideas only; we write our own code (recommended);
   - B: run FreeRouting as a separate tool, never bundled;
   - C: accept GPL for a separate tool.
6. **The audit's open questions Q1–Q4** (§8 of the audit), if still unanswered. Q1 decides whether the Planner BOM
   findings matter for pricing.

## 3. Rules for this thread

- Work in the main checkout, branch `main` (CLAUDE.md, GO MAIN). On a cloud session, use the branch the session gives you.
- Vendored code follows `vendor-manifest.json` and `tools/fetch-vendor.js`: pin a tag, keep the copyright notice with
  anything copied (CLAUDE.md "Vendored third-party code").
- The engine (`tools/baseline`) stays pure Node with no `fs` and no DOM: `build.js` bundles it into the Planner.
- Keep `node tests/run.js` green and the 70 golden renders identical unless a change is intended.
  - Baseline at the audit: 110 suites, 3 736 checks.
  - Add the audit's §7 tests where a feature touches them.
- Client data stays out of git. The Budakalász files, the Domoszló fixtures and `Calculator/CLA-baseline/` are local
  only. Quote only counts, metres and code locations.
- Hungarian UI, English code. Every open question goes in as numbered A/B/C options.

## 4. What a cloud session can and cannot reach

- **Can:** the repo; the audit's two repro scripts (save them outside the repo; jsdom via `NODE_PATH`); the practice
  apartment `Planner/projects/varler-planner/tools/practice/` as a non-client test plan.
- **Cannot:** anything on `H:\`. That includes the Budakalász job, the Domoszló fixtures, `_redteam`, `build-dom.js`
  and `Calculator/CLA-baseline/`.
- For work on the real job, either run in Claude Code on the user's PC, or attach the PC's repo folder to the cloud
  session through Remote Control (`list_computer_folders` / `request_computer_folder`).

**Start with:** read §1, then ask §2 in one message, and wait for the answers.
