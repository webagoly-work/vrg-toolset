# GO SUI — Egyszerű felület (Simplified UI) chapter

*Written 2026-10-19. This chapter belongs to the user's **secondary account**, the same way V8b–h and GO WIRE did.
The main account does not work in this worktree.*

## Where

- Worktree: `H:\Dev-VRG\VRG-DE\wt-planner-sui\Planner\projects\varler-planner`
- Branch `planner-sui`, cut from **main 2447365** (Födém / Igénylista / Házimozi). planner-stack's wireway T0–T6 is
  **not** here. Their menu entries get added when planner-stack is merged into main, not before.
- Baseline at the cut: 98 suites, 3445 checks, golden 70/70, check-globals OK.
- Tests: `export NODE_PATH=H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules`, then
  `node build.js && node tools/check-globals.js && node tests/run.js`.

## What

The pack in `docs/simple-ui/`: README → 00_CONTRACT → one WP at a time. Order S0 S1 S2 S3 S4 S6 ⏸ S5 S7 ⏸.

## Decisions (all answered — README §5, SUI-Q-001.json r2)

| | |
|---|---|
| S01 | **A + C**: bottom-left by default, with bottom-right as a mirror setting (`ui.dialSide`, `localStorage['villanyterv_ui_side']`, `body.sm-right`) |
| S02 | 88 px dial |
| S03 | Épület · Villamosság · Eszközök · Rendszer |
| S04 | hint pill fades after 6 s |
| S05 | right-click menus only; the root stays fixed |
| S06 | **F2** toggles |
| S07 | toggles keep the menu open; tools and actions close it |
| S08 | Bahnschrift SemiCondensed |
| S09 | the view does not change on entry |
| S10 | dialogs keep the normal look |

## Things that changed since the pack was written (2026-10-15)

- T1–T8 are on main. `toolCurrent / toolStop / toolStart / toolOnChange` exist (`src/05cb-toolctl.js`), so S5 needs
  no fallback. The parallel T-session is finished, so nobody else edits this worktree.
- Main gained modules the tree does not list yet: Födém (08p), Igénylista (08q), Házimozi (08r*). S3 should give them
  Épület / Villamosság leaves through their existing actions, and say so in its report.
- No module uses `data-chrome` yet. S0's chrome-hide CSS must be checked against every floating panel on main
  (Mozi elemek, Igénylista dialog, the CYD dash-link if it is present).

## Rules

The user commits. Never stash. Stop at every ⏸. Questions go in chat too, as numbered A/B/C options.

## Prompt

```
TASK: build the Simplified UI pack, WP by WP (S0 S1 S2 S3 S4 S6 S5 S7), stopping at every ⏸.
READ FIRST: GO-SUI.md · docs/PRIMER.md §0–§5 · docs/simple-ui/README.md · 00_CONTRACT.md, then per WP only its file.
First: git status. Report dirty files before touching anything.
END — build the SUI pack, stopping at every ⏸.
```
