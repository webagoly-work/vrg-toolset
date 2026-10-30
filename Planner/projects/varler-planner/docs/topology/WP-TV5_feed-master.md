# WP-TV5: Feed and master on the canvas; the string; KD roles

Status: todo · Wave B · Depends: TV4 · Size: M (~140 lines) · Spec: next free · Decisions: Q-TV03, Q-TV07, Q-TV09, Q-TV18 · Engine gaps: G1, G2, G4

## Goal
*"Set Elosztó–dedicated endpoint pairs, set Elosztó–midpoint / Kötődoboz pairs, Elosztó–kötőpont–kötőpont string
circuits, set Master–leader connections. Kötődoboz: users can place them, and they act as preferred or mandatory
points."*

## Read
- `01_RULES.md` TR-G1, TR-G4, TR-D, TR-S1–S2, TR-H, SR-3, CK-13 / CK-14
- `fig/03`, `fig/09`
- `08od` `upSet` :43–54 (every refusal text), `upFix`, `upClear`
- `08og-wf-chaintool.js` `bflClick` :25–32 (how a click becomes a link: source rules, door sides, Shift = start)
- `08n` `jbToolStart('kot')` (placing a KD stays on the blueprint)
- `05j` `cktSetDedicated`, `cktAssign`

## Build (`src/08tc-tpo-edit.js`). Every link is `upSet(child, {id, room?}, {fix:true})`, one undo step
1. **⤳ Betáp**: click the parent (the board, a mid, a door L4 node), then the child.
   - **board → DED:** `upSet`, and with the active circuit dedicated, `cktSetDedicated` + `cktAssign`; ask first if the
     circuit already has a member.
   - **board → mid**, or **mid → mid**: chained clicks continue the string (each click's parent = the previous node),
     Esc ends. On a `vil` circuit the first string link sets `c.ownPipe = true` (Q-TV07 A); ⚑ CK-14 G2 until G2.
   - A refusal from `upSet` goes to the HUD unchanged (its Hungarian reason). Nothing else changes.
2. **⇢ Master:** click a mid / door / board, then an endpoint. The endpoint becomes a leader (`upRole`).
   - A socket leader on a szobadoboz or KD is allowed (Q-TV03 A). The HUD says
     `'<doboz> a szoba mini-Elosztója — a motor: G1 / ldChains-kivétel'`, and CK-14 notes it until G1.
3. **The ghost:** while picking, a line from the first click to the hovered node, green when `tpoPath` exists and red
   otherwise. A red click is still stored (TR-G5): the geometry is the authority, and the user may fix the walls next.
4. **▣ KD role:** on a junction node, cycle `átmenő → preferált → kötelező` (`d.tpoRole`); the context menu offers the
   same three. It is a device edit (`pushUndo(['devices'])`). CK-13 says `'a motor még nem követi (G4)'` until G4.
5. **Link context menu:** `Rögzítés / feloldás` (`upFix`), `Törlés` (`upClear`), `Rajzolt pálya ehhez…` (`viaStart`,
   08oh; it opens the blueprint), `Mutasd az alaprajzon` (`blShow`).
6. **Render** (Betáp-fa tab): the active circuit on top and thicker; feed solid, master with an arrowhead, a DED home
   run dashed (`fig/02`).

## Tests
1. board → DED on A3: `D.up = {id: board, fix:true}`, A3 dedicated with 1 member, no TV check row.
2. board → KD1 → KD2 → KD3 on V1: 3 `up`s, `ownPipe`, CK-5 on KD3 (a dead end) until a master link leaves it, and CK-14
   G2 on each hub → hub link.
3. A loop attempt (KD3 → KD1 while KD1 is fed from KD3's chain) → `upSet`'s `'Hurok: …'` in the HUD, and data
   deep-equal.
4. `tpoRole` cycle and undo.
5. Every link is `fix:true`; a later `upFill` leaves them all (TR-G6).
