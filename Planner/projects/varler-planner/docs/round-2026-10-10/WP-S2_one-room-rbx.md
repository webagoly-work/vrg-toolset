# WP-S2 — One-room RBX (egyszobás kivitel)

Status: todo · Wave S · Depends: — · Size: S (~60 lines) · Spec: 68 · Decision: Q-S03

## Goal
*"Make an option for RBX for a type that is for one room coverage — they are usually one size smaller
compared to the same type it would be if it were a two-room type — smaller design for smaller channel
bundles going to one endpoint roombox."*

## Read
`05p-hardware.js` lines 20–33 (`HW_RB`, `HW_DEF`), 44–55 (`hwSize`), 140–215 (serving pick, hwPlace
tool, `hwHint`), the RBX right-click items (`grep -n "Helyiségek hozzárendelése" src/05p-hardware.js`)
· BRIDGE-ARCH-002 table (RB-S 300 × 400 · RB-M 400 × 500 · RB-L 500 × 600 · RB-H 600 × 600 · RB-O
outdoor · RB-E own family).

## Build
1. The size ladder: `const HW_RB_LADDER=['RB-S','RB-M','RB-L','RB-H'];`
   `hwRbEff(d)` → the class actually built: `d.one && ladder index > 0` → one step down; RB-E, RB-O and
   RB-S (no smaller step) → unchanged, with `d.one` still recorded.
2. `hwSize(d)` for rbx uses `hwRbEff(d)`; every label that shows the class shows it as
   `RB-M·1` when `d.one` (the symbol's short label in 05z — check the RBX short-label test in spec-57,
   PRIMER §5 says that label is protected; extend the test, do not weaken it).
3. **Option** — right-click on an RBX: `☐/☑ Egyszobás kivitel (egy mérettel kisebb)`, plus the same
   checkbox in the RBX inspector card. Q-S03=A: the toggle lives on the placed box only; B: also set
   it automatically at placement when the ghost serves exactly one room.
4. **Suggestion check** (`STK_CHECKS.hw`, info): an RBX whose `hwServes(d).length===1` and not
   `d.one` → `'<ref>: egy helyiséget szolgál ki — egyszobás kivitel (egy mérettel kisebb) elég lehet.'`
   An RBX with `d.one` serving 2+ rooms → warn `'<ref>: egyszobás kivitel, de <n> helyiséget szolgál ki.'`
5. Anything that reads `d.rb` for sizing or BOM (05x cabinet, client preview `cpvModel`, the fill's
   housing hints) must call `hwRbEff(d)` instead — `grep -n "\.rb\b" src/*.js` (8 hits at analysis
   time).

## Tests — `tests/spec-68-one-room-rbx.js`
1. `hwRbEff({type:'rbx',rb:'RB-H',one:true})==='RB-L'`; RB-M → RB-S; RB-S → RB-S; RB-O → RB-O.
2. `hwSize` follows; label `RB-L·1`.
3. Check: single-room RBX without `one` → the info line; with `one` and 2 rooms → the warn line.
4. Golden identical.
