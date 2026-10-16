# WP-R5 — Marker pen (Jelölő toll) on a wall-line network

*Added 2026-10-15 from the user's review. Replaces the click-to-select mechanics of R2 (Vezethető fal) and R3 (Szabályok)
with one drawing tool. Status: **BUILT 2026-10-15** — answers R5-Q1…Q5 = A; src/08ia-wf-marker.js, tests/spec-96 (23 checks), verified with a real
pointer drag in Edge.*

## Goal (user)

> "Wall selection is janky … instead of a section-selecting click, it is a tool like Helyiség-toll, but a jelölő
> toll / marker. On a wall, hold and drag to draw lines of different types. … As walls are not touching with their
> middle lines, the wall selector marker always tries to select the whole long wall through rooms, where it should stop
> and mark only one wall of one room at a time. … Rewrite the wall line mechanic so that connecting walls have their
> middle lines in contact, while the walls' side lines also touch or cross each other: that way, a continuous path is
> created between every wall. Marker tools thus can snap to middle or wall side lines (only a little snapping), but lock
> it on a continuous path."

Measured on the example house (2026-10-15 render): every whole-wall and face mark runs the full length of its wall box,
across 2–4 rooms. Partitions stop at the through-wall's face (Create Walls F3: "the through-wall owns junctions"), so
neither the centrelines nor the faces of two walls ever meet.

## 1. The wall-line network (falvonal-háló) — derived, never stored

`wlnNet(level)` builds it from `WALLS[level]`, cached by the scene version, the same way `shellModelKey` caches checks.

1. **Lines per wall box** `r`: the centreline `C` (from `wallInfo(r).seg`), the thickness `t`, and two face lines at
   ±t/2.
2. **Junctions.** For every pair of boxes that touch or overlap (ε = 5 mm):
   - **T** (an end of `b` touches the side of `a`): node `N` = `C_b`'s line ∩ `C_a`'s line. `C_b` is extended to `N`
     (+ t_a / 2) and `C_a` is split at `N`.
   - **L** (the ends of `a` and `b` meet): `N` = the intersection of the two lines, and both are extended to it.
   - **X** (the walls cross): both are split at the crossing.
3. **Centre edges** are the centreline pieces between nodes. The centrelines now meet: the user's "middle lines in
   contact".
4. **Face edges** are each centre edge's two faces, trimmed or extended to where they meet the faces of the walls at
   their end nodes. At a corner the inner faces meet at the inner corner and the outer faces at the outer corner, so the
   side lines "touch or cross".
5. **Every face edge knows its room:** the room polygon that holds a point 100 mm in front of the face's midpoint.
   One face edge = **one wall of one room**.
6. **Every edge maps back to stored data** as `{wall: r.id, side?, u0, u1}`. That is exactly what the existing mark
   kinds hold (`wall` / `wspan` for the centre, `side` / `vstrip` for a face).

   So **no data change**: old marks stay valid, and every later layer (routing, E2 reach lines, E5 engine) reads marks as
   before.

**Why derived instead of re-cutting the stored wall boxes:**
- the boxes feed the renders (70 goldens), the wall editor, Create Walls, openings, and marks keyed by wall id + u;
- re-cutting them would change wall ids and every mark's `u`;
- the network gives the continuous paths without moving a single wall. (R5-Q1 offers the re-cut as option B.)

## 2. The tool

- **Entry:**
  - Szabályok becomes the pen's ink list: pick an ink (Vezethető fal, L-forma, Külső fal, Kerülendő, Tilos, …), and the
    pen is live;
  - 🖊 Jelölő toll in phase 3;
  - key `J`, which takes over the old J generic marker's key; the generic J brush stays reachable as an ink called
    "Egyéni címke…".
- **Snapping** (the user: "only a little snapping"): 8 screen px. The ink decides which net it snaps to (R5-Q3 ★A):
  - **whole-wall inks → the centre net:** Vezethető fal, Külső fal, Kémény, Gépészet;
  - **face inks → the face net:** L-forma, Kerülendő, Tilos, Vizes, Média, Munkalap, Fűtőtest, Bútor;
  - **zone inks → a rectangle on the floor**, as today.
- **Press + drag:**
  - the press snaps to the nearest point on the ink's net;
  - while dragging, the path is the shortest walk along the net from the press point to the net point nearest the
    cursor, so it turns corners and crosses junctions as the cursor goes;
  - if the cursor leaves the net by more than 3 × snap, the path is **locked** at its last end (the user's "lock it on a
    continuous path");
  - the ghost is the ink's own look (05n `MRK_STYLE`).
- **Release:** the path is split per wall box into one mark per `{wall, side, u0, u1}`, in one undo step.
- **Click without a drag** (R5-Q2 ★A): marks exactly one edge, that room's wall between two junctions. A click on the
  same ink again removes it.
- **Erase:** the same drag with Alt held (or with the ink "Radír") removes that ink along the path.
- **Esc** ends the tool (T1).
- **Status bar:** `Jelölő toll: <ink>`.

## 3. Also in R5 (from the same review)

- Mennyezeti út and Padló út move into phase 3 next to Jelölések (T3 phase table). Their tool stays as built in E2.
- The colour coding is **done** (2026-10-15, 05n `MRK_STYLE`):
  - only Vezethető fal is green, and "preferred" polarity is blue;
  - L-forma is light blue;
  - Belső fal became **Külső fal** (grey);
  - Közlekedő is an opaque purple tint;
  - Kémény / strang are off-black brown;
  - Padlófűtés is a striped tint;
  - Fűtőtest is a white zig-zag with a black contour.

## 4. Tests (spec at build time)

1. **T-junction:** a 6000 mm through-wall with two partitions abutting it from one side.
   - The net has 3 centre edges on the through-wall and the partitions' centre edges end ON its centreline (distance
     0).
   - Each partition gets 2 face edges, each with a room.
2. **L-corner:** the inner faces meet at the inner corner (distance 0), and the outer faces at the outer corner.
3. **One wall of one room:** a click on the through-wall's face inside room A makes one `vstrip` whose `u` range is
   exactly that room's span. Room B is untouched.
4. **A drag around a corner** makes two marks (one per wall box) whose ends meet at the corner.
5. **The lock:** a drag that leaves the net by 3 × snap keeps the last end; moving back resumes.
6. Old marks still draw and still feed `rwlAllowed`.
7. Golden 70/70 (no fixture has marks drawn by the pen).

## Built — notes

- **Network:** `wlnNet` (cached per level by a wall + room signature); `wlnNearest` / `wlnRoute` (Dijkstra on the
  net) / `wlnUnit` / `wlnRanges`.
- **Pen:** `mkpStart(ink)`, `mkpApply` (one undo step; merges with the marks already there, or cuts them).
- **Inks:** `RB_PRESETS` of kind route / wall / side. Zones and openings keep the R3 tool.
- **Marks written:** whole-wall inks → `wspan` (05n now draws it and `mrkAt` reads it); face inks → `vstrip` `{side, u0, u1}`.
- The R2 drag tool and its `RWL` state were removed; `rwlToolStart` = `mkpStart('vezetheto')`.
- **Not done:** the J key still starts the generic marker (05n). Re-mapping J to the pen is a one-line change if wanted.

## R5-Q — decisions (all A)

1. **R5-Q1, the network:**
   - A) derived from the stored walls, nothing stored changes **(recommended)**;
   - B) re-cut the stored wall boxes at every junction (new wall ids, marks migrated).
2. **R5-Q2, a click without a drag:**
   - A) marks that one room's wall between two junctions **(recommended)**;
   - B) does nothing; only drags draw.
3. **R5-Q3, which line the pen snaps to:**
   - A) the ink decides: whole-wall inks → centre, face inks → face **(recommended)**;
   - B) the nearest line, whichever kind;
   - C) a key toggles centre / face.
4. **R5-Q4, crossing a junction while dragging:**
   - A) the path follows the cursor through corners and junctions **(recommended)**;
   - B) it stops at a junction unless Shift is held.
5. **R5-Q5, existing whole-wall marks that run through several rooms:**
   - A) keep them as they are **(recommended)**;
   - B) split them per room once, on load.
