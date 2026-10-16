# WP-G2 — Wall refine (Falak finomítása)

Status: todo ⏸ dry-run on P33 before applying · Wave G · Depends: U1 (`hitOk`) · Size: M (~200 lines) ·
Spec: 66 · Decisions: Q-G02, Q-G03

## Goal
*"A function for wall fine-tuned auto placement: RCO on a wall, K control or RCO on the Alap layer box
to 'refine walls' — every two-wall connection (L, T or X) is fine-tuned at the end points so they
become perfectly aligned with each other, creating perfect squares at the connection points viewed
from top down (elegant, clean, professional)."*

"K control" = **Ctrl+K**, the command palette — so the function must be a registry action.

## Spec
**MATERIAL §6** — junction search, the L / T / X rules, collinear pairs, guards, the bookkeeping list
and the spec-66 fixture with expected numbers. Follow it exactly; the bookkeeping is where silent
damage happens (README F9: wall notes are keyed by wall coordinates, marks by distance from the wall
start).

## Build — new code in `03-geometry.js` (geometry) + entry points
1. `wrfPlan(level, {layer?})` → `{junctions:[{type,a,b,moves:[{id,end,from,to}]}], collinear:[…],
   skipped:[{ids,why}]}` — pure, no mutation.
2. `wrfApply(plan)` — one `pushUndo()`, then the moves, then bookkeeping 1–5 in MATERIAL §6 order
   (old wall keys computed before the first mutation).
3. `wrfDialog(level, layer?)` — the dry-run dialog: counts per type, the largest move in mm, the
   skipped list; overlay preview of the junction squares while open (an `STK_OVERLAY`-style hook is
   not available outside the stack — add the preview to the general overlay in `draw()` behind a
   module variable `WRF_PREVIEW`); "Alkalmaz" / "Mégse".
4. Entry points:
   - wall right-click (`10-lamps.js` ≈ line 444): `📐 Falak finomítása (ez a szint)…`;
   - action `walls.refine` — `Falak finomítása`, group `Szerkezet`, alias
     `fal sarok illesztes refine walls corners finomitas` (Ctrl+K finds it);
   - layer right-click on `L0` and on a `construct`-role layer: `📐 Falak finomítása ezen a rétegen…`
     — add it in `lyrLayerMenu` (05l line 433) directly (S1 adds the stack-role items; this one is
     not stack-only).
5. Only walls that are visible and unlocked take part (`hitOk` + not `L.lock`); a locked wall that
   touches a junction makes the junction "skipped: zárolt".

## Tests — `tests/spec-66-wall-refine.js`
1. The MATERIAL §6 fixture → the exact expected coordinates, counts L 2 · T 2 · X 0, the two corner
   overlaps exactly 100 × 100, D face-to-face with A and C. Second fixture: the centreline wall E →
   100 / 3000.
2. Q-G02=C variant (pass the option) → D.y0=0, D.y1=3100. Q-G02=B (nearest form) on a centreline
   T → the tie resolves to the butt joint.
2b. One end in two junctions (a three-wall meeting) → moved once, to the nearer partner, and listed
   as `többszörös csomópont`.
2c. Fractional input (`x0=3900.4`) → after apply every coordinate of the level is a whole mm, and a
   second `wrfPlan` returns zero moves.
3. A mark (vstrip `u0=500,u1=900`) on wall B and a wall note (`u=700`) on B: after apply B.y0 moved
   20 → 0, so the mark is `u0=520,u1=920` and the note `u=720` **and** its `wallKey` is the new key;
   `noteHide` re-keyed likewise.
4. A collinear pair with a 12 mm band offset is aligned; one with 60 mm is reported, untouched.
5. Guard: an end that would move 500 mm on a 100 mm wall is skipped and listed.
6. Undo restores every wall, mark, note and key exactly (deep-equal against a snapshot).
7. Running `wrfPlan` again after apply → zero moves (idempotent).

## ⏸ Checkpoint
Run the dry-run on `Calculator/P33-teszt_v2.vplan.json` in the browser pane and report: junction
counts by type, the largest move, the skipped list. The analysis prototype (MATERIAL §6) measured
**27 junctions (12 L, 15 T), 33 moves, max 308 mm, two multi-junction ends** with the default rules —
your numbers should match within the effect of the rounding pre-pass; a big difference means a rule
was read differently. Do not apply to the user's real plans — the user decides.
