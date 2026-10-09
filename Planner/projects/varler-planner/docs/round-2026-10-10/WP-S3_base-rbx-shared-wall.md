# WP-S3 — BASE and an RBX on one wall section

Status: todo · Wave S · Depends: U1, U3 · Size: S (~70 lines) · Spec: 69 · Decision: Q-S04

## Goal
*"Make it so that the BASE and an RBX can share the same space on the same wall section (although it
should be noted that it is to avoid it if all three BASE parts are in one unit)."*

## Reproduce first (README F8)
The model already allows it: `hwGhostAt('rbx', base.level, base.x, base.y)` on P33 v2 returns a valid
ghost at the BASE's spot; vertically BASE (3 units) spans 0–1800 mm, RB-M 1900–2400. So find what
actually blocks the user, in the browser, before writing code:
1. P33 v2, RBX tool (Hardver stage) → hover the BASE's wall segment → is a ghost shown? Click → placed?
2. If placed: are both symbols visible in plan? Can each be clicked / right-clicked / dragged? (the
   likely failure: two symbols on one plan point, one hides the other and `hitTest` returns the same
   one every time).
3. Any check or hint that fires (Stage badge, HUD)?
Write the findings into the report before building; if the block is something else, stop and report.

## Build (for the expected failure)
1. **Plan symbol offset when stacked.** In the hardware symbol provider (05p `hwSymbol` / the
   `STK_DEVSYM` entry), when another hardware device stands within 300 mm in plan on the same wall
   face, draw the higher one (RBX) shifted along the wall by half its width + 40 mm with a thin leader
   to its true point, and label both. Model coordinates stay untouched — this is drawing only.
2. **Clicking** — U3's Alt+click cycling covers the overlap; additionally `hitTest` prefers the
   device whose drawn (offset) symbol is under the cursor.
3. **Rule** in `HW_BASE_RULES`:
   `{k:'shared', sev:'warn', n:'BASE és RBX egy falszakaszon: kerülendő, ha a BASE mindhárom egysége egy oszlopban van (hő, szerviz-hozzáférés).'}`
   — fires when an RBX's wall range (`u ± w/2`) overlaps the BASE's on the same wall **and**
   `hwUnits(base).length===3`; with 1–2 units → `info` `'BASE és RBX egy falszakaszon — rendben.'`
   (Q-S04: warn vs info for the 3-unit case.)
4. Vertical clearance check (info): RBX bottom − BASE top < 100 mm → `'Kevés hely a BASE és az RBX
   között (<n> mm).'` /*r*/

## Tests — `tests/spec-69-base-rbx.js`
1. RBX placed on the BASE's wall at the BASE's u → both exist; the plan symbol strings differ in
   position by the offset; model x/y unchanged.
2. `hwBaseRules(base)` contains `shared` warn with 3 units, info with 2.
3. Clearance: RB-H (1850–2450) over a 3-unit BASE (0–1800) → 50 mm → the info line.
