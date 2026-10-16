# WP-C4 — BASE placement: units, combinations, guideline highlights

Status: todo · Wave C · Depends: C1 · Size: S–M (~180 lines) · Builder: mid tier
Decisions: Q24=A

## Goal
*"After that comes the Base placement (selectable in combinations, all three separately or the whole
Base as a unit — with highlights of associated guidelines regarding certain units and combinations
with their relative placement."* BASE = NET (comms) · COMP (coordinator) · MEDIA (storage, streams).

## Read (only these)
- `01_CATALOGUES.md §10` (`HW_BASE_UNITS`, `HW_BASE_SIZE`, `HW_BASE_RULES`)
- `src/05p-hardware.js` (placement tool, `hwSyncObj`, `hwSymbol`) · `src/06-wall-editor.js` `ROOM_ENV`
  (`grep -n "const ROOM_ENV" -A8`) — which env keys are wet

## Build — `05p-hardware.js`

### 1. Record [Q24=A]
`{type:'base', units:['NET','COMP','MEDIA'], level,x,y,h:900,side,layer:stkLayer(S,'base').id, ref:'BASE'}`
One device per placed group. `units` is any non-empty subset; the three may be split across up to
three devices (the STD-001 "LAYER TIE" case: a split BASE). Each unit may appear in only one device.
Generated object: `HW_BASE_SIZE` scaled by unit count (height × n/3, min 600), units drawn as stacked
bands coloured by `HW_BASE_UNITS[u].c`.

### 2. Placement
Action `hw.base` (`BASE elhelyezése`, group `Hardver`) opens a mini picker first:
`[✓] NET  [✓] COMP  [✓] MEDIA` (units already placed elsewhere are disabled with their ref) — then
the C1 placement tool runs with this ghost. Strip preference: `vstrip` tag `base`.

### 3. Guideline highlights (overlay while placing BASE, and while a BASE is selected)
For each rule in `HW_BASE_RULES` compute `{ok, msg}` for the ghost position (`hwBaseRule(k,pos,units)`):
| k | test | highlight |
|---|---|---|
| `dry` | room env not wet | wet rooms red hatch |
| `board` | straight distance to the nearest board ≤ `mm` | ring of radius `mm` around each board, green .06 |
| `entry` | NET in units → distance to the nearest `entry` ≤ `mm` | ring around entries, blue .06 |
| `column` | other BASE devices holding the remaining units within `mm` | dashed line to them, amber when far |
| `centre` | distance to the level's room-area centroid ≤ 20 % of the level bbox diagonal | small ⌖ at the centroid |
| `strip` | inside a `base` vstrip | the strips glow green |
| `cat6a` | (needs C5 routes) every RBX's channel route length ≤ 90 m | skip until routes exist |
Ghost border colour = worst severity (`error` red · `warn` amber · ok green). A panel line in
`#modeHint` lists failing rules' `n` text, worst first. Placement is never blocked.

### 4. Checks — `STK_CHECKS.base`
`error` no BASE · `warn` a unit missing from every BASE device · each failing rule at its `sev` for
placed BASE devices.

## Tests — `tests/spec-43-base.js`
1. Picking NET+COMP creates one device with those units; the picker then offers only MEDIA.
2. A BASE in a room with a wet env → `dry` rule error; moved to a dry room → ok.
3. `board` rule: 7 m from the board ok, 9 m warn (mm 8000).
4. Split BASE: NET+COMP here, MEDIA 1.5 m away → `column` warn; 0.8 m → ok.
5. Checks list `warn` "MEDIA hiányzik" when only NET+COMP are placed.

## Golden
Identical.

## Browser-only checks (for the human)
Rings and hatches read as guidance, not clutter.

## Verifier focus
Unit uniqueness across devices (no unit in two BASE devices, including after copy/duplicate).

## Out of scope
Cabinet contents for the BASE system circuits (E5).
