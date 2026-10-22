# WP-T6: Dugalj chain (leader → tail)

Status: todo · Wave B · Depends: T5 · Size: S (~120 lines) · Spec: next free · Decisions: Q-T02, Q-T11, Q-T16

## Goal
*"Set leader–tail string sequences of dugalj devices. Dugalj devices in a room are then usually connected by stringing
up the devices of the same circuit, in an order that connects the first (leader) to the one that horizontally requires
the least movement, taking vertical wireways in and out, creating arcs between two points next to the horizontal
(gerinc) wireway paths, until the last device (tail) is reached."*

## Read
- `01_RULES.md` TR-S (all), CK-9
- `fig/04`
- `08p` (T1: `tpoPath`, edge `len`)
- `08pa` (T3)

## Build (`src/08pc-tpo-edit.js` + `08pa`)
1. **`tpoAutoChain(c, master)`** (pure, `08pa`) applies TR-S3:
   - the leader is the member nearest to `master` by `tpoPath` length;
   - next, repeatedly, the nearest unchained member from the current one;
   - it returns the ordered ids.
   - Members already in fixed `chain` links keep their order. The rest are inserted after the last fixed member, by the
     same rule.
2. **⋯ Lánc tool:**
   - Click the leader. If it has no upstream yet, a `master` link from the circuit's board is offered (TR-S2, the
     classic chain).
   - Each further click on a socket appends a `chain` link (`fix:true`) and assigns the socket to the active circuit if
     it has none. A socket of another circuit asks first.
   - **Enter** = `Kész`. **A** = auto-complete the rest with `tpoAutoChain`, with `fix:false` on those links.
   - Esc ends the tool and keeps what was clicked.
3. **Reorder.**
   - The inspector of a chained socket shows `↑ / ↓` (swap with the neighbour), `Tail legyen`, `Leválasztás a láncról`.
   - Dragging a node along its lane reorders, and the moved links become `fix:true`.
4. **Branching guard (TR-S4, Q-T11 A).** Adding a second `chain` link out of a socket is refused, with the HUD text
   `'Dugaljról nem ágazunk le — tegyél kötődobozt, és abból indíts új ágat (Master).'`
5. **Render:** the chain as a straight row in its lane, leader → tail. On hover the inspector shows each hop's length
   and the walls it follows (from the T1 edge data). That is the "arc" in numbers: `fel 2,15 m · vízszintes 2,40 m ·
   le 2,15 m`.

## Tests
1. `tpoAutoChain` on 4 sockets around a room corner orders them by arc length, not by straight-line distance: build a
   fixture where the two disagree.
2. One fixed link in the middle is kept, and the others flow around it.
3. The tool: leader + 2 clicks + `A` → a 4-member chain with 1 master + 3 chain links; `tpoCheck` gives `[]`.
4. A second chain link out of one socket is refused and the data is unchanged.
