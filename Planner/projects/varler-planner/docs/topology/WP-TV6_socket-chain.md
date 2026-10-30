# WP-TV6: Socket chain on the canvas (leader → tail)

Status: todo · Wave B · Depends: TV5 · Size: S (~100 lines) · Spec: next free · Decisions: Q-TV02, Q-TV11, Q-TV16 · Engine gaps: G6

## Goal
*"Set leader–tail string sequences of dugalj devices … connects the first (leader) to the one that horizontally requires
the least movement, taking vertical wireways in and out, creating arcs … until the last device (tail) is reached."*

## Read
- `01_RULES.md` TR-S (all), CK-9
- `fig/04`
- `08oe-wf-leaders.js`:
  - `ldChains` :26–52 (the order rule, already built);
  - `ldSetLeader` :56;
  - the 📍 tool :63–65;
- `08og-wf-chaintool.js` (all 50 lines): the click semantics to mirror. Do not import its DOM picking; reuse `bflClick`
  if it can take a target object, else factor its rule part out (and report it).

## Build (`src/08tc-tpo-edit.js`)
1. **⋯ Lánc** on the canvas, with the same semantics as ⛓ Betáp-lánc (Q3 = A):
   - the first click is the source;
   - each next click sets `up` = the previously clicked node (`fix`);
   - a click on a node already in the chain, or with Shift, restarts from there; a branch = the same `up`.
   - A socket of another circuit asks first. A socket without a circuit joins the active one (`cktAssign`).
   - Enter / Esc ends. Every link is one undo step.
2. **📍 Leader:** a node's context menu `Vezető dugalj` = `ldSetLeader(id, true)`.
3. **A (auto-complete):** on a chain in progress, the rest of the circuit's room sockets get the `ldChains` order as
   **javasolt** links, through `upFill` with the leader fixed. TV6 does not compute an order of its own.
4. **Reorder:** ↑ / ↓ in the inspector swaps two neighbours' `up`s (two `upSet`s in one undo step, both `fix`).
   Dragging a node along its lane does the same.
5. **Hop details** in the inspector, from the last run when fresh (TV9):
   - `fel <m> · vízszintes <m> · le <m>` for each hop;
   - today the hop is box to box at 2450 with a drop. The **arc** of `fig/04` is G6, shown as `'ív (G6) — még
     leállás-dobozzal'`.

## Tests
1. A leader plus 2 clicks → a 3-socket chain of `up`s (fix); `tvCheck` has no TV row.
2. `A` on a 6-socket room → the other 3 sockets get the `ldChains` order (javasolt), the same as 📍 + ⚙ Betáp-fa
   javaslat on the blueprint (deep-equal of the `up`s).
3. A click on socket 2 again, then a new socket → a branch (two children of socket 2); CK-9 is info.
4. Swapping 2 ↔ 3 → `up`s exchanged, one undo restores both.
