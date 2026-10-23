# WP-M1 — Erősáram split: Dedikált · Dugalj · Világítás

Status: todo · answered 2026-10-10 (M01–M05 = A, M04 + print palette) · Wave M · Depends: S1 (Info rows) ·
Size: L (~250 lines + test updates) · Spec: 72

## Goal
*"Instead of one Erősáram layer in the stack, separate them to dedicated / power socket / világítás
(which is lamps and switches together, because I may only connect them together first, and later to
an RBX) — make a slight difference in colour for each of the four, namely barna for dedicated, vörös
for power socket circuits, light red for lamps and orange for switches."*

Three layers, four colours: the lighting layer carries two device colours (lamp light red, switch
orange). Q-M01 B (one layer, coloured sub-layers) is the cheap alternative — build this WP only if
Q-M01 = A (default).

## Spec
**MATERIAL §4** — roles, colours, `EP_CODE_COL`, icons, the code → role table, `MNS_ROLES` /
`mnsIs`, the per-file reference counts, the `NEED_DEFAULTS` split and the 4-step migration.

## Build
1. `STK_ROLES`, `STK_ICONS`, `STK_COL` (05m) — the three rows replace `sys:MAINS`; keep a
   **read-only alias**: `stkRole('sys:MAINS')` returns a synthetic `{k:'sys:MAINS', n:'Erősáram',
   alias:MNS_ROLES}` so old saved plans and old links still resolve while migrating.
2. `EP_CAT` roles (05s) per the table; `EP_ROLE_COL` stays derived from `STK_COL`; the symbol colour
   lookup checks `EP_CODE_COL[role][code]` first (SWI orange inside sys:LIGHT).
3. Every `'sys:MAINS'` comparison in 05m / 05s / 05t / 05w / 05x: union via `MNS_ROLES` or per-role
   keys — one by one, each with a reason in the commit-free report. `STK_CHECKS['sys:MAINS']` (05x
   line 91, the cabinet check) → registered on `sys:DED` only (it is about ways and modules; one
   registration is enough — say so in a comment). `STK_GROUPS['+sys:MAINS']` → all three.
4. **Migration** (MATERIAL §4 steps 1–4) in the load path, idempotent, tested twice in a row. It runs
   before `renderLayers`. No undo entry (load-time).
5. **Fill and cabinet unchanged by design** — the three roles keep `fam:'MAINS'`. Prove it: E5's
   cabinet on the stack e2e fixture (spec-54) yields the same ways and modules before and after (CLA:
   24 ways, 29 / 34 modules).
6. CHANGELOG line: a plan saved after this opens in an older build with the three new roles shown as
   plain layers.
7. **Grey-safe print palette** (answer M04, MATERIAL §4b): `STK_PRINT` next to `STK_COL` (05m);
   `stkPrintCol(role, code)` used by every role-colour lookup **while** `prnActive()` is true — set
   around `exportPNG(true)` and on `beforeprint` / cleared on `afterprint` (redraw both times);
   route strokes and symbol outlines get the pattern's dasharray; a small legend (used roles only) is
   added to the printed / exported sheet. Toggle `state.printPal` (View panel + action
   `doc.printPalette`, default on). Screen rendering untouched → golden identical.

## Tests — `tests/spec-72-mains-split.js` + updates
1. A stack created now has `sys:DED`, `sys:SOC`, `sys:LIGHT` in that order, no `sys:MAINS`.
2. Migration: a saved stack with one `sys:MAINS` layer holding DED, SOC, LMP, SWI, SHU and a classic
   `socket` → three layers; the old id is now `sys:SOC` with SOC + the classic socket; DED on DED;
   LMP, SWI, SHU on LIGHT; `rm.needs['sys:MAINS']` split; running the migration again changes nothing.
3. Colours: SWI symbol uses `#f08c2e`, LMP (MAINS variant) `#ef7b72`, SOC `#c62828`, DED `#6d4c41`.
4. `epCircuits(room)` returns the same circuits as before the split for the spec-46 fixture.
5. spec-54 (stack e2e) and spec-53 (cabinet): identical numbers.
5b. Print palette: every phase-2 role has a unique `(L, p)` pair in `STK_PRINT`; the four Erősáram
   entries differ by ≥ 15 L*; with `prnActive()` a SWI symbol uses `#d87817`, without it `#f08c2e`;
   `exportPNG(true)` leaves `prnActive()` false afterwards (also on error).
6. **Existing specs that reference `sys:MAINS`** (35, 45, 46, 49, 51, 52, 53, 54, 57 — 54 references at
   analysis time): update each failing assertion to the new role **after reading what it protects**
   (PRIMER §5: a failing spec is a specification). List every changed assertion in the report.

## Verifier focus
A device that changes layer must keep its id, links, circuit membership and clip group; the
migration must not run on a plan with no stack; colour contrast of SWI orange vs LV amber on the
white-out and client-preview renders.
