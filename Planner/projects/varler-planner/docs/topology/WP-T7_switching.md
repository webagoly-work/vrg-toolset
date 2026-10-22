# WP-T7: Switching logic (chain or star)

Status: todo · Wave B · Depends: T5 · Size: M (~170 lines) · Spec: next free · Decisions: Q-T05, Q-T06

## Goal
*"Set light and switch point logic: from the leader switch toward the next switch, or the star topology. The leader
switch is connected to the circuit's other switches, reaching from switch to switch directly (leader → second … tail
switch → lamp or lamps) or via a common point (an additional kötődoboz at crosspoints, but more likely the room's wall
crossing point, the pre-Portal point; in that case a star topology is preferred). Wiring between switches depends on how
many switches there are and what switch logic they perform. The phase wire reconnects to its 3-wire wiring to travel to
the lamps."*

## Read
- `01_RULES.md` TR-L, TR-W, CK-10
- `fig/05`
- `08l-wf-switches.js`: `lswGroup`, `lswLegsOf`, `lswChain`, `lswType`, `lswSuggest`
- `08n` `jbMeet`
- `08pa` (T3: `tpoGroups`, `tpoCores`)

## Build (`src/08pc-tpo-edit.js`)
1. **Selecting a group:** a click on a lamp or switch node of the active circuit selects its group (`tpoGroups`). The
   left panel's Kapcsolás box is enabled: `Lánc | Csillag`, `hub: <mid> (változtat…)`, the switch list in chain order,
   and the derived types.
2. **Lánc (chain)**, TR-L1:
   - writes `master → leader switch`, `sw` links in the order shown, `tail → first lamp`, and `lamp → lamp`
     (nearest-first, TR-L5);
   - the order can be changed with ↑ / ↓ in the panel; the leader is the switch nearest to the master unless `swHead`
     is set (E5 / 08ob rule).
3. **Csillag (star):**
   - pick the hub. The default is TR-L3's master if that is the switch's portal box, otherwise a click on any mid.
   - writes `master → hub` (feed, or nothing when hub = master), `hub → each switch` (`sw`) and `hub → first lamp`, then
     lamp → lamp.
4. **The suggestion per group** (used by T8, shown here as `✨` in the box), TR-L4 (Q-T06 A): star when ≥ 2 switches
   of the group sit in or next to the same door's portal slots, chain otherwise.
5. **Cores on hover:** each switching link shows `tpoCores` (e.g. `T1·T2·N·PE · NYM-J 4×1,5`), with a ⚑ marker until the
   checkpoint T3 answers are in.
6. **Types:** after any change, `lswType` / `lswRetypeAll` is run so the blueprint symbols (105 / 106 / 107) follow. A
   `typeFix` switch keeps its type, and CK-10 warns if it no longer fits.
7. `c.topo.groups[]` keeps `{grp, logic, hub, order}`. Switching a group between chain and star replaces only that
   group's links (`fix:true`).

## Tests
1. 1 switch + 2 lamps, chain: links `master→S`, `S→L1`, `L1→L2`; type 101; cores 3 / 3 / 3.
2. 3 switches, chain: types 106 / 107 / 106; the sw links' cores are 4 and 4 (TR-W3).
3. The same group as a star on PB1: `master→PB1`, 3 × `PB1→S`, `PB1→L1`; cores 4 / 5 / 4 and the lamp 3.
4. The suggestion: 2 switches in the slots of one door → star; 2 switches on different doors → chain.
5. Toggling chain ↔ star changes only that group's links; the other groups are untouched (deep-equal).
