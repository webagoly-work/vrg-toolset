# GO CLA — the CLA job thread (base layer, data layer, v1 + v2 budget plans)

*You were started with the codephrase **GO CLA**. This file is the whole briefing. It replaces GO V2 and GO ADAT
(2026-10-30, originals in `docs/go-archive/`: read them for the detail, but their paths are old). "CLA" is the
neutral code of this client job; the real code is only in the local `tools/anonymise.map.json`. Client data never
goes into git and never leaves this PC.*

## 1. Where things are now

| What | Where |
|---|---|
| The engine | `Planner/projects/varler-planner/tools/baseline/` (`cla.config.js`, `README.md`) |
| Job folders (ajánlat + költségvetési tervezet, v1 + v2) | `H:\VRG\Full\jobs\`, the two folders named by the real code. They hold `V2_FELADAT.md`, `START_*.md`, `job\offer.json`, `job\WORKLOG_*.md` |
| BRIDGE job files | `H:\VRG\Full\BRIDGE\07_*` (never in git), standards in the repo's `BRIDGE/` |
| **The frozen baselines v1 + v2** | **only** in `H:\VRG\Backup\archive\parked\2026-10-24\wt-planner-stack\Calculator\`. GO WIRE, GO V2 and spec-98 expect `Calculator/CLA-baseline/` in the repo folder, where it no longer is. Bring a copy back before any step that needs them, and keep it out of git |
| The Tuner | `H:\VRG\Full\BRIDGE\_tuner\bridge-tuner.html` (answers as `ID=key ~ note`) |

Old paths in the archived files: `H:\Dev-VRG\VRG-DE\…` → `H:\VRG\Full\jobs\…`; the `planner-stack` worktree → the main
checkout, branch `main`.

## 2. State

- **v1 done and delivered** (2026-10-12): Költségvetési Tervezet VG-2026-CLA-01.
- **v2 done and delivered** (2026-10-12): phase A quantities + phase B pricing. GO V2 has nothing left to run.
- **Base layer + data layer** built; the engine rules are in `tools/baseline/README.md`.

## 3. Open

1. **ADATRETEG-Q-002** (N01–N05): small design questions. v1 and v2 were made with the recommended answers.
2. **ADATRETEG-Q-001** (D01–D09, L01–L08, R01–R12): check with the user whether the answers ever came; GO ADAT stopped
   waiting for them.
3. The findings of the old-plan comparison, listed in `docs/go-archive/GO-ADAT.md` (LED3 vs RBX03, the stair opening
   and the backbone, D12/D13 notes swapped, no island extractor point, L16 at 300 mm, the living-room shutter).
4. CLA acceptance step B: the user redraws the plan with the workflow tools.
5. F15 v1 D339 unwired: fix at the next pricing (Q13 = B).
6. The CLA-ADD-001 extras are in **GO PLANNER**, item 6.

Say which of these the user wants, and stop: there is no default next step.

## 4. Rules

- Every image: all numbers legible, nothing overlapping (`labels.js`); look at the PNG before sending.
- Never write „ajánlat" on a client document: „Költségvetési Tervezet". Clean 5 000-step prices, material deposit clause.
- Never delete anything without asking. Never commit unasked, never push.
- Big requests in phases, with questions in between, as numbered A/B/C options.
