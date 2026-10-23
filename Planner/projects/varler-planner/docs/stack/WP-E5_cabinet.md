# WP-E5 — Elosztószekrény: ways, protection, modules, phases

Status: todo · Wave E · Depends: E4, D4 · Size: M (~240 lines) · Builder: mid tier
Decisions: Q33=A · Q39=A

## Goal
*"This process also generates the Elosztószekrény's inner module count, RCD type, standard DIN rail
modules like MCB, overvoltage, etc."* Defaults are CLA's settled cabinet (BUILD-001 §14, K31/K32):
one 1-module RCBO per way, three-phase-ready feed, way groups system / RBX lighting / RBX sockets /
big loads. Output is a schedule and a JSON the future DIN-rail tool can read — no drawing.

## Read (only these)
- `01_CATALOGUES.md §12` (`ELO_RULES`) · `src/05j-circuits.js` `mcbParse`, `mcbText`, `mcbModules`,
  `cktExportObj` (the existing `vrg-circuits` v1 export — extend, don't replace)
- `src/05s-endpoints.js` `epCircuits` · `src/05r-channel.js` (`chnGraph`, carriers) · `src/05p-hardware.js`

## Build — `05x-cabinet.js` (prefix `elo`)

### 1. Ways — `eloWays(boardId)` → `[{key, label, kind, mcb, kw, poles, members}]`
Which consumers a board feeds: follow `chnGraph` edges with carrier `mains`/`panel` from the board
(RBX and BASE, SSC) plus every E3 run with `from:'board'` (big loads). Then:
| kind | count | label | mcb (ELO_RULES.mcb) |
|---|---|---|---|
| `sys` | `sys.base` per fed BASE, `sys.ssc` per fed SSC, `sys.pack` once when the stack has any BUSB endpoint | `BASE 1`, `BASE 2`, `SSC 1`… , `B busz akku` | `sys` |
| `light` | `lightPerRbx` per fed RBX | `RBX06 világítás` | `lighting` |
| `socket` | one per socket circuit of the RBX's rooms (`epCircuits`: real 05j circuits + implicit) | the circuit name | its own `mcb` if set, else `socket15`/`socket25` by variant |
| `load` | one per DED / AVP mains run; **hob `hob2l` on a 3-phase board = 2 ways** (2 × 1P+N, B1 §14.4) | device ref + variant name | its own `mcb` if set, else by variant |
`kw` per way from `ELO_RULES.kw` (by variant/kind). A 05j circuit's explicit `mcb` always wins.

### 2. Protection and modules — `eloSchedule(boardId)` → JSON
```js
{board, phase:'1f'|'3f',
 feed:[{n, mod}],                       // ELO_RULES.feed[phase] (+ bell when on)
 ways:[{key, label, kind, mcb:'1C 16A', device:'RCBO 1P+N C16 30 mA A', mod, phase:'L1'|'L2'|'L3'|null, kw}],
 rcd:[{n, mod, ways:[keys]}],           // only when perWay==='rcd'
 totalMod, rows, free, warnings:[…]}
```
- `perWay:'rcbo'` [Q33=A]: each way one RCBO, `rcbo.mod` modules, type `rcbo.type`, `rcbo.ma` —
  no separate RCDs (K31: one earth fault trips one circuit).
- `perWay:'rcd'`: each way an MCB (`mcbModules(mcbParse(mcb))` modules), RCD groups of ≤ `maxWays`
  ways in way order, `rcd.mod` each.
- `totalMod` = Σ feed + Σ ways + Σ rcd; `rows = ceil(totalMod / rowModules)`; `free = rows×rowModules − totalMod`;
  `free < spareMin` → `warn 'elo.spare'` (`'Csak <free> szabad modul — következő sor / nagyobb szekrény.'`).

### 3. Phase balance (3f only) [Q39=A]
Greedy: ways sorted by `kw` desc (ties by key) → each to the phase with the lowest running kW; a
two-way hob takes the two lowest phases. Output per-phase totals; `warn 'elo.phase'` when the max/min
ratio > 1.5. Single-phase: `phase:null` everywhere.

### 4. Checks — `STK_CHECKS['sys:MAINS']` (cabinet view)
`info` a kitchen (`needKind==='konyha'`) with fewer than `socketKitchen` socket circuits (B1 §14.2
S04 trim: worktop A, B + island) · `warn` a big load with no board-origin route (E3 unreached).

### 5. UI and export
Action `elo.schedule` (group `Feltöltés`, `Elosztószekrény összeállítás…`): modal table — feed rows,
then ways grouped by kind (label · MCB · device · modules · phase · kW), then totals
(`34 / 36 modul · 3 sor · 2 szabad`) and warnings; a phase select `1 fázis / 3 fázis` and a
protection select `RCBO soronként / RCD csoportok` that re-run the schedule live (stored in
`state.elo`, defaults from `ELO_RULES`).
Action `elo.export` (`Elosztó exportálása (JSON)`): `{format:'vrg-cabinet', v:1, project:state.bp.proj,
schedule:eloSchedule(id), circuits:cktExportObj()}` — `circuits` keeps the existing `vrg-circuits` v1
payload unchanged inside, so the Inventory and the future Elosztó DIN tool read one file.

## Tests — `tests/spec-53-cabinet.js`
Fixture: CLA-like — BASE (fed by board), SSC, one NTL (so a BUSB endpoint exists → the pack way),
4 RBX each with lights; socket circuits: kitchen 3,
three rooms 1 each, one shared circuit for two rooms, upper floor 1 (= 8); big loads: oven `g16`,
hob `hob2l`, dishwasher, washing machine, bojler, klíma, AV (`AVP`).
1. Ways: sys 5 (BASE 2, pack 1, SSC 2) + light 4 + socket 8 + loads 7 = **24** on single phase —
   matches BUILD-001 §14.3.
2. Single phase, RCBO per way: feed 2 + 2 + bell 1 = 5 → **5 + 24 = 29 modules** (B1 §14.4).
3. Three phase: the hob becomes two ways (25 ways) and the feed 4 + 4 + 1 = 9 → **34 modules**, 3 rows of
   12 → 2 free → no spare warning at `spareMin:2`; at `spareMin:3` → warn.
4. Phase balance: hob halves on two different phases; no phase above 1.5 × the lowest (assert with the
   fixture's `kw` values) — or the warning present.
5. `perWay:'rcd'` with `maxWays:4`: RCD count = ceil(24/4) = 6, modules recomputed.
6. A 05j circuit with `mcb:'1C 13A'` keeps it in its way.
7. Export JSON has `format:'vrg-cabinet'`, `v:1`, and an unchanged `circuits` sub-object.

## Golden
Identical.

## Browser-only checks (for the human)
The modal is readable and the numbers match the user's own CLA cabinet sheet.

## Verifier focus
The CLA reproduction (24 / 29 / 34) is the acceptance test that matters — it ties the rule table to a
settled real design. Kitchen-check wording. No silent rounding of modules.

## Out of scope
Enclosure product choice, busbars, cable glands, the DIN-rail drawing tool itself (separate app idea).
