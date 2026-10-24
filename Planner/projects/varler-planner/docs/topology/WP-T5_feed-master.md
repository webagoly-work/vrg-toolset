# WP-T5: Feed and master tools, KD roles

Status: todo · Wave B · Depends: T4 · Size: M (~150 lines) · Spec: next free · Decisions: Q-T03, Q-T07, Q-T09

## Goal
*"Set Elosztó–dedicated endpoint pairs, set Elosztó–midpoint / Kötődoboz pairs, Elosztó–kötőpont–kötőpont string
circuits, set Master–leader connections. Kötődoboz: users can place them, and they act as preferred or mandatory
points."*

## Read
- `01_RULES.md` TR-G4 (the kind table), TR-D, TR-S1–S2, TR-H, SR-3
- `fig/03`
- `08pa` (T3: `tpoSet`, `tpoCheck`)
- `08n-wf-boxes.js` 45–60 (`jbServicePoints`, `jbMeet`)
- `05j` `cktAssign`, `cktSetDedicated`

## Build (`src/08pc-tpo-edit.js`, toolbar tools; one link = one undo step, `fix:true`)
1. **⤳ Betáp** (feed). Click the source (the board or a mid), then the target:
   - board → DED endpoint: the active circuit becomes dedicated (`cktSetDedicated`) and the endpoint is assigned. If
     the circuit already has another member, ask first.
   - board → mid, or mid → mid: a `feed` link. Chained clicks continue the string (mid → mid → mid; Esc ends), which is
     the V1 string (TR-H1). For a `vil` circuit, the first string click sets `c.ownPipe = true` (Q-T07 A).
   - A target already fed in this circuit → the link is replaced (TR-G1), with a HUD note.
2. **⇢ Master.** Click a mid (or the board), then an endpoint: a `master` link, and the endpoint becomes the leader of
   its chain or group. A socket master on a mid is allowed (Q-T03 A); the HUD notes `'a(z) <doboz> a szoba
   mini-Elosztója'`.
3. **The link ghost:** while picking, the candidate link is drawn from the first click to the hovered node. It is green
   when `tpoPath` exists, red with `nincs fizikai út` otherwise. The click is still allowed (TR-G5: the geometry is the
   authority; the user may fix the walls afterwards).
4. **▣ KD role:** on a mid node, cycle `átmenő → preferált → kötelező` (`d.tpoRole`). There is also a context menu with
   the same three, and the symbol follows `fig/06` (dashed ring / `!`). This is a device edit, so it is undoable with
   `['devices']`.
5. **Link context menu** (right click on a link): `Törlés`, `Rögzítve` (toggle `fix`),
   `Útvonal ezen át: <mid>…` (`via`), `Mutasd az alaprajzon`.
6. Canvas render for the Kapcsolatok tab:
   - the links of all circuits in their colour over the faded GP;
   - the active circuit on top and thicker;
   - `feed` solid, `master` with an arrowhead, a DED home run dashed (`fig/02`).

## Tests
1. Betáp board → DED on circuit A3: A3 is dedicated, has 1 member and one `feed` link with `fix:true`; `tpoCheck` gives
   `[]`.
2. Betáp board → KD1 → KD2 → KD3 on V1: 3 feed links and `ownPipe:true`; CK-5 fires for KD3 (a leaf mid) until a master
   link leaves it.
3. Master KD1 → S1 on A1, with the classic link board → S1 present: replaced, one upstream (CK-4 stays silent).
4. A link to an unreachable socket is stored and CK-3 lists it.
5. The KD role cycle writes `tpoRole` and undo restores it.
