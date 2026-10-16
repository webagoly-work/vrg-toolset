# WP-D3 — Placement suggestions from Phase 1 data

Status: todo · Wave D · Depends: D1, D2, B5, C3 (coverageGap only) · Size: L (~300 lines) · Builder: upper-mid tier
Decisions: Q30 (suggestion strength)

## Goal
*"Layer by layer the user fills up the room, guided by the checklists — Phase one information about
the rooms helps highlighting suggested placement/locations of every layer's devices (either points on
the wall/ceiling/floor or horizontal/vertical stripes indicating sections/height zones)."*
Suggestions are **overlay hints + soft snapping**, never automatic placement.

## Read (only these)
- `01_CATALOGUES.md §11` (`SUG_RULES`) · `src/05n-marks.js` (`mrkAt`, `mrkFaceRanges`, `mrkRoomOfFace`,
  `mrkOpeningTags`, `mrkDoorRooms`, `mrkRoomZones`) · `src/05o-traces.js` (`trcList`, `trcApproach`)
- `src/05q-rf.js` `rfGrid` · `src/05s-endpoints.js` the placement tool (you add one hook line)
- `src/04-render.js` lines 131–170 (door `variant` bits — hinge side)

## Build — `05t-needs.js` (prefix `sug`)

### 1. Anchor functions — each returns hints `[{kind:'pt'|'band'|'strip', …, why}]`
`pt`: `{x,y,h,level,wall?,side?}` · `band`: `{wall,side,u0,u1,v0,v1}` · `strip`: `{wall,side,u0,u1}` (full height).
| anchor | rule (`r` = the SUG_RULES entry, `R` = room) |
|---|---|
| `doorHandle` | for each door of R: the handle jamb = the jamb opposite the hinge (`variant&2` → hinge at far jamb, `ang` gives the jamb axis); point on R's face of the host wall, `r.off` mm beyond the jamb away from the opening, at `r.h` |
| `hband` | for each face of R with a `+` side mark or an hstrip/hband tagged `dugalj`: band at that tag's v (else 150–450); faces tagged `lforma` first (`why:'L-forma'`) |
| `roomCentre` | area centroid of R at ceiling h; plus the centre line of every `lampasor` pstrip in R |
| `farCorner` | the polygon vertex of R farthest from the mean of R's door centres, moved 300 mm inward along the corner bisector, at `r.h` |
| `doorLintel` | doors of R tagged `p2`/`p3`: door centre on R's face at `r.h` |
| `doorFlank` | doors of R tagged `portal`/`bejarat`/`lepcso`: handle side, `r.off` beyond the jamb, at `r.h` |
| `windowTop` | windows of R tagged `redony`/`arnyekolo`: window centre on R's face, head height + `r.off` (head = the opening's top if the record has one, else `LH[level]−300`) |
| `innerWall` | the longest face of R with no window, not tagged `homlokzat`/`radiator`: its middle at `r.h` |
| `ceilingPair` | two ceiling points: if a side of R is tagged `media`, on a line parallel to it at 1/3 of the room depth, at 1/4 and 3/4 of its length; else along R's long axis at 1/4 and 3/4 |
| `coverageGap` | centroid of R's cells NOT covered by `wifi` in `rfGrid` (C3); none uncovered → no hint; no C3 → `roomCentre` |
| `hstripTag` | every hstrip/hband in R with tag `r.tag` → its band |
| `traceTag` | traces in R tagged `r.tag`: every 1500 mm along the trace, the nearest wall face within 1000 mm → point at `r.h` |
| `vstripTag` | every vstrip in R (or on the level for RBX) with tag `r.tag` → strip |
| `avoid` | every `ban`/`minus` mark in R → red/amber translucent covers (shown for every code) |
```js
sugFor(code,role,roomId)   // hints from every SUG_RULES entry matching code (and role when given) + 'avoid'
sugAt(code,role,x,y,level) // the room under the point → sugFor
```

### 2. Overlay (`STK_OVERLAY`) while the endpoint tool (D1) or the RBX tool (C1) is placing
Points: 6 px ring + crosshair in the code's role colour, opacity .7, label = `why` (or the rule `n`)
on hover only. Bands/strips: translucent rect on the face (plan: 4 px band on the face; Wall View via
`STK_WV`: real rect). `avoid` covers: red .12 / amber .08. Show hints only for the room under the pointer
and its neighbours (keeps the plan readable).

### 3. Soft snap — one guarded line in D1's (and C1's) ghost update
`if(typeof sugSnap==='function')g=sugSnap(g,code,role);` where `sugSnap`: a point hint within 300 mm
(plan) → move the ghost onto it; a band on the ghost's face → keep x,y, set h to the band's middle;
holding **Alt** disables snapping (Alt is already the fine key — check it is free while placing; if not,
use **Shift** and report).
The ghost ring colour shows `mrkAt` under it: green `plus` · amber `minus` · red `ban`.

### 4. Suggestion strength [Q30=A]
`state.sugOn` (default true) — action `sug.toggle` (`Javaslatok be / ki`, group `Végpont`).

## Tests — `tests/spec-47-suggestions.js`
Fixture: 4000×3000 room, door on the bottom wall (hinge at start jamb, `variant 0`), window on the top
wall tagged `redony`, left wall inner face tagged `lforma` + `media`, a trace tagged `ejszakai`.
1. `doorHandle` for SWI: one point on the room's face, at h 1100, 150 mm beyond the FAR jamb; with
   `variant 2` it moves to beyond the START jamb.
2. `windowTop` for SHU: point above the window centre.
3. `ceilingPair` for SPK: the media wall is the left wall (x = 0, length 3000), the depth from it is
   4000 → points (1333, 750) and (1333, 2250) at ceiling height (±1 mm).
4. `farCorner` for SEN is the corner diagonally opposite the door, 300 mm in.
5. `traceTag`: night trace 3000 mm long along the right wall → 2–3 points at h 300 on the right face.
6. `hband` for SOC lists the `lforma` face first.
7. `sugSnap` moves a ghost 200 mm from a point hint onto it; 400 mm away it does not; Alt held → no snap.
8. `avoid`: a `tartofal` wall produces a red cover in the overlay when placing any code.

## Golden
Identical.

## Browser-only checks (for the human)
Hints helpful, not noisy; snapping does not fight the user; Wall View bands align.

## Verifier focus
Hinge/handle geometry against the door renderer's convention (bit1). The overlay limited to the room
under the pointer. No hint ever creates a device.

## Out of scope
Automatic placement. Scoring rooms. RBX/BASE rules (C1/C4 have their own).
