# WP-E1 — Lamps ↔ switches: groups, links to portal slots, derived switch type

Status: todo · Wave E · Depends: O2 (slots), E0 · Size: M (~200 lines) · Spec: next free · Decisions: Q-E02, Q-E03

## Goal
*"Next step is connecting lamps with switches — switches are expected to go into at least one Portal's designated slot,
with additional switches placeable in the room. Switches do not start out with a type — when a lamp is selected it can
be connected to one or multiple designated portal spots or custom placed ones. Selecting multiple lamps gives the
option to connect them together before they are connected to switches (no path yet, just connections)."*

## Read
`05s-endpoints.js` 265–345 (`sw.ctl`, `epCtlOf`, the EP_CTL link tool, the `ep.ctl` check) · `tools/baseline/plan.js`
(grep `switchGroups`, `inferCtl` — the P33 inference: nearest door, wet-room lamps to the dry side, two-way pairs, gang
balancing) · WP-O2 (`ptSlotAt`) · MATERIAL §5 · contract §4 (`wfTable` — built here).

## Build
1. **Group**: select 2+ lamps → action `Lámpák összekötése (egy kapcsolt ág)` → all get the same `grp` (`G` + seq).
   A group draws as thin dotted connector lines between its lamps (overlay only). Ungroup = `Kiválasztás az ágból`.
   A single lamp is its own implicit group.
2. **Link**: select a lamp (or group) → `Kapcsolóhoz rendelés` → the MAINS portal slots (`L1`) of the room's doors light
   up + any existing switch; click one or more → for a slot, a `switch` device is created at the slot (`slot:{door,face,
   k:'L1'}`, layer `sys:LIGHT`, h from R4 / 1100) if none is there; then `sw.ctl` gets every lamp of the group. Click
   elsewhere on a wall = a custom switch spot (free-standing). Esc ends.
3. **Derived type** (`lswType(sw)` → `{var, n, why}`, MATERIAL §5): from the groups on the switch and the other switches
   sharing a group. Written to the existing `sw.swType` (`sw.var` is the electrical variant) on every link change unless `typeFix`. Label `K3 · 106 váltó`. ⚠ Codes per MATERIAL §5 (105 csillár, 106 váltó, 108 dupla váltó) — never renumber.
4. **Suggest** button `Kapcsolások javaslata` (Q-E02 A): runs the P33 inference (port of plan.js's ctl part) for lamps
   with no switch → `wfTable` rows `lámpa(ág) → ajtó / slot · típus · miért` → Alkalmaz.
5. Every lamp group must end on ≥ 1 switch: check `lsw.none` (info) `'<ref>: a lámpának nincs kapcsolója.'`
6. Q-E03: a switch in a slot moves with the door (O2 reseat) — A yes (default), B no.

## Tests
1. 3 lamps grouped → one `grp`; linking the group to door D2's L1 creates one switch with `ctl` = the 3 lamp ids.
2. Second group on the same switch → `swType:'105'` (csillár); same group on a second door's L1 → both `106` (váltó); a third →
   the middle one `107`.
3. `typeFix` survives a re-link.
4. Inference on the P33 v1 sketch gives the same lamp → switch table as `ALAPRETEG.md` (the approved one).
