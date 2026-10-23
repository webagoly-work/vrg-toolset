# WP-E3 — Dobozok: Elosztó, portal boxes, pre-RBX kötődoboz, "box for this switching"

Status: todo · Wave E · Depends: O2, E1, R2 · Size: M (~180 lines) · Spec: next free · Decisions: E06 answered (szobadoboz) · Q-E08 open

## Goal
*"Users place the Elosztó, box locations for Portals and other pre-RBX kötődoboz (pre, if only the Erősáram layer is
built), 10×10 or 15×10 minimal. These are the automatic preferred spots for channel lines to go through a wall to reach
another room, and they provide the spaces where a room's lamps and switches are connected (lamps and switches linked
together will make their connection in the room's RBX or Portal box, unless the user specified otherwise). A group of
linked lamps and switches gets the option to create a Kötődoboz for this switching, which automatically puts a flush
box at the expected point of the mennyezet."*

## Read
`05p-hardware.js` 20–60 (`HW_DEF`, `hwSize`, the RBX ladder), 140–215 (`hwPlace` tool, serving) · `06a-portals.js`
(`ptOf`, the L4 slot = the portal's MAINS box) · `tools/baseline/rules.js` 81–90 (`BOX`) and plan.js service points
(wall crossings only at service points) · `05r-channel.js:36` (`CHN_RANK`) · WP-E1 (groups, `ctl`).

## Build
1. Box types (`jb`): `portal` (the L4 slot box, 2-gang 142 × 71 — created when the first MAINS thing links to the
   door), `pre-rbx` = the **szobadoboz** (step 5),
   `switching` (wall box for one lamp↔switch group), `ceiling` (⌀ 80 lamp box). Placed with the Device tool's `box`
   type + a `jb` field; the E0 bar 4.3 has the four buttons.
2. **Service points** = the Elosztó, every `portal` box, every `pre-rbx`, RBX, BASE. `jbServicePoints(level)` is the
   list E5 reads: **a wall is crossed only at a service point** (the CLA rule).
3. **Meeting box per group** (`jbMeet(group)`): the group's lamps and switches meet in the room's RBX / `pre-rbx` if one
   serves the room, else the door portal box of the switch, unless the user set `meet` on the group. Shown on the
   group's inspector: `Találkozás: P2 portáldoboz (L4)`.
4. Action on a selected group: `Kötődoboz ehhez a kapcsoláshoz` → a `ceiling` box at the group's lamp centroid snapped
   to the ceiling reach line if one exists (E2), else the lamp nearest the switch; sets the group's `meet` to it.
5. **Szobadoboz (RBX-0)** — the user's answer to Q-E06 (2026-10-14): a lower-level RBX, "pre-evolution". Bigger than a
   10×10, smaller than RB-S; size Q-E08 = C: **150×150 for one function, 200×200 for two or more** (crossing / feed / switching), `jb:'pre-rbx'`, `size` overridable. Functions: **faláttörés** (it is a service
   point), **szoba betáplálás** (the room's feed arrives here), **lámpa ↔ kapcsoló összekötés** (`jbMeet` prefers it).
   **Not** socket distribution: `jbMeet` never returns it for sockets, and E5 runs socket circuits as classic chains
   Elosztó → first room socket → … → last. Later layers upgrade it in place to an RBX (same id, position, links).

## Tests
1. A door with a switch in L1 → `jbServicePoints` contains that door's portal box at L4 (h 2450).
2. A szobadoboz with sockets in its room: `jbMeet` for a socket → null (classic chain), for a lamp group → the szobadoboz.
3. `jbMeet` for a group in a room with a `pre-rbx` → that box; with none → the switch's portal box.
4. `Kötődoboz ehhez a kapcsoláshoz` on a 2-lamp group → one `ceiling` box at the centroid, group `meet` = its id.
