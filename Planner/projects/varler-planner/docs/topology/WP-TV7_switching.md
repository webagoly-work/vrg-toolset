# WP-TV7: Switching logic (chain or star), written as `up`

Status: todo · Wave B · Depends: TV5 · Size: M (~150 lines) · Spec: next free · Decisions: Q-TV05, Q-TV06, Q-TV17 · Engine gaps: G3

## Goal
*"Set light and switch point logic: from the leader switch toward the next switch, or the star topology … via a common
point (most likely the room's wall crossing point, the pre-Portal point; in that case a star topology is preferred) …
The phase wire reconnects to its 3-wire wiring to travel to the lamps."*

## Read
- `01_RULES.md` TR-L, TR-W, CK-10
- `fig/05`
- `08l-wf-switches.js`: `lswGroup`, `lswLink`, `lswLegsOf`, `lswChain`, `lswType`, `lswRetypeAll`, `lswSuggest`
- `08n` `jbMeet`, `lamp.meet` (E3)
- `tools/baseline/plan.js` :255–300: how the engine routes a unit today (switch boxes fed from their SP, travellers
  switch → switch, the lamp leg from the head or the meet box)
- `02_ENGINE_GAPS.md` G3

## Build (`src/08tc-tpo-edit.js`)
1. **Select a group:** a click on a lamp or switch of the active circuit → `tvGroups` (TV3). The Kapcsolás box shows:
   - `Lánc | Csillag` (the logic read from `up`);
   - the hub;
   - the switches in order with their `lswType`;
   - the meeting box (`lamp.meet` / `jbMeet`).
2. **Lánc** (TR-L1). One undo step, all `fix`:
   - the head switch's `up` = the master (`jbMeet`, else the room's door L4);
   - each next switch's `up` = the previous switch;
   - the first lamp's `up` = the tail switch; lamp → lamp nearest first.
   - The order is changed with ↑ / ↓; `swHead` follows the first switch.
3. **Csillag:**
   - pick the hub (default: the door L4 / szobadoboz where ≥ 2 switches stand, TR-L4);
   - every switch's `up` = the hub; the first lamp's `up` = the hub; `lamp.meet` = the hub.
   - ⚑ CK-14 G3: the engine still routes travellers switch → switch, but it **does** honour `meet`, so the lamp leg
     already leaves the hub.
4. **Types:** after a change, `lswRetypeAll` runs, so the symbols follow (105 / 106 / 107). A `typeFix` keeps its type
   and CK-10 warns.
5. **Hover cores:** each link shows `tvCores` (TR-W3) and, from the last run, the engine's cable on that leg. When they
   differ: `'motor: NYM-J 4×1,5 · szabály: 5×1,5 (G3)'`.
6. **✨ per group** (used by TV8): star when ≥ 2 switches of the group are at one door's slots, chain otherwise
   (Q-TV06 A).

## Tests
1. 1 switch + 2 lamps, chain → S.up = master, L1.up = S, L2.up = L1; type 101.
2. 3 switches, chain → 106 / 107 / 106; the `up` chain S1 ← S2 ← S3; the lamps on S3.
3. The same group as a star on the door L4 → all switches on the L4, `lamp.meet` = the L4; `tvGroups` reads `'star'`;
   CK-14 G3 present.
4. The suggestion: 2 switches at one door → star; at two doors → chain.
5. Toggling chain ↔ star changes only that group's `up`s and `meet` (deep-equal elsewhere).
