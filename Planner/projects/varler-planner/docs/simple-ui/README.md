# Simplified UI (SUI) — build pack

*Planned 2026-10-15 in the main session. Built by a **parallel session** while the main session does the UI tidy
(T1–T4, `docs/ui-tidy/UI-AUDIT.md`). Read order for a builder: this README → `00_CONTRACT.md` → the WP file → only the
sections of `01_DESIGN.md` / `02_MENU-TREE.md` that the WP names.*

## 1. The idea, in the user's words, and what it became

> "an additional Mode for the UI, where a toggle lets users change between the Normal (currently developing) and the
> Simplified UI. This simplified version would clear the whole screen, leaving only an empty canvas and show one
> interactive feature as a corner left symbol of a circle with only a quarter of it showing in the corner. That will be
> the menu … a healthy mix of ⌘K and the Wheel Selection, to show four/five vertical icons that outline a classic
> (video game-like) menu points system with every feature integrated to branch out as sub menus (5 vertical buttons
> max, last one always Back, clicking on a menu point erases current menu buttons to show the sub menu with those same
> buttons (with a light greyish blue background, UI buttons design as in Matrix, where we see the Zion control interface)"

The menu combines the ⌘K palette and the selection wheel. It takes three things from each.

| From the wheel (and the gamepad wheel, 08b) | From ⌘K (05c palette) |
|---|---|
| one level at a time, few choices, the same spot every time | **type to jump**: any letter while the menu is open turns the column into search results |
| muscle memory: Back is always in the slot next to the dial | every registered action is reachable, so nothing is lost by hiding the panels |
| works with D-pad / A / B and with touch | disabled actions stay visible, dimmed, with their reason |

The name used in the UI and the code:
- **Egyszerű felület** (the mode, prefix `sm`);
- **Normál felület** (everything else);
- the corner control is the **tárcsa** (dial);
- the column is the **menü**.

## 2. Map

| File | What |
|---|---|
| `00_CONTRACT.md` | where to work, file ownership vs the parallel T-session, the chrome-hide rule, globals, test loop, report |
| `01_DESIGN.md` | layout numbers, interaction model, visual tokens (Zion-inspired), motion, states, a11y |
| `02_MENU-TREE.md` | the curated tree with action ids, generators, new actions to register, the coverage rule |
| `mock/sm-mock.html` | static look mock-up of the four states (idle, root, submenu, search) and the running tool. The S6 tokens come from here |
| `WP-S0 … WP-S7` | one work package each |
| `SUI-Q-001.json` | decisions, recommended option first |
| `PROMPTS.md` | build / verify / status prompts (TASK sandwich) |

## 3. Order and dependencies

| WP | Title | Depends on | ⏸ |
|---|---|---|---|
| S0 | Mode switch + clear screen | — | |
| S1 | The dial (quarter circle) | S0 | |
| S2 | Menu engine (column, Back, paging, keys) | S1 | |
| S3 | Menu tree + generators + new actions | S2 | |
| S4 | Search (the ⌘K half) | S3 | |
| S6 | Visual pass (Zion style) | S2 (S3 for real content) | ⏸ look checkpoint |
| S5 | Tool feedback in the dial | S2, **T1 (main session)** with a fallback until then | |
| S7 | Sheets, gamepad, touch | S3, S5 | ⏸ hardware check |

S5 runs after S6 on purpose: by then T1 (`toolCurrent()`) has usually landed. If it hasn't, S5 uses the fallback in its WP.

## 4. Status

| WP | Status | Spec | Note |
|---|---|---|---|
| S0 | — | | |
| S1 | — | | |
| S2 | — | | |
| S3 | — | | |
| S4 | — | | |
| S5 | — | | |
| S6 | — | | |
| S7 | — | | |

## 5. Answers

- S06 → **B**: the toggle key is **F2** (user, 2026-10-15). Everything else: the ★ recommended option until answered.
- T1 has **landed** (2026-10-15, src/05cb-toolctl.js, spec-95): `toolCurrent / toolStop / toolStart / toolOnChange` exist, so S5 needs no
  fallback table. Keep the `typeof toolCurrent==='function'` guard anyway.

- **T2 + T3 landed** (2026-10-15):
  - the fixed frame: phases, tools and the context panel on the left, the inspector and tabs on the right. All of it is
    inside `.side`, so simple mode hides it with the `.side` rule.
  - `#stageRail`, `#wfBar` and `#toolbarRow` no longer exist.
  - **Already registered — S3 must NOT register them again:** wf.roomType, wf.stairs, wf.layer.SOC, wf.layer.LIGHT
    (label „Világítás réteg”) and wf.layer.DED. The action wf.bar is gone.

## 6. Session log

- 2026-10-15: pack written (main session). UI tidy answers in the same message: T1–T4, legacy drawer, fixed layout,
  tidy before E4.
