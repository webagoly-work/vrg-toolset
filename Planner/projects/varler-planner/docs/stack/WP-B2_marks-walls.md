# WP-B2 — Marking layer: walls, sides, vertical and horizontal strips

Status: todo · Wave B · Depends: B1 · Size: L (~330 lines) · Builder: upper-mid tier
Decisions: Q14=A · Q15=A · Q20 (tag list) · Q09=A

## Goal
The user's words: *"walls: set them with different tags … select walls or wall sides to tag them
with a + or a −, indicating whether it is a preferred or an avoidable area … Cycle the options when
using this tool from whole wall tag to wall side tag, to vertical zone (a default 300 mm wide strip
on the wall), to horizontal zone (same strip but horizontal across the wall) — with an RCO on one
horizontal zone to extend it to the whole room."*
Marks are **constraints and intentions** that later layers read: wall materials feed the RF model
(C3), strips attract placement (D3), `ban` marks raise warnings on routes (E3).

## Read (only these)
- `00_CONTRACT.md §3.2` (mark kinds) · `01_CATALOGUES.md §3` (MRK_POL, MRK_TAGS wall/side/vstrip/hstrip, MRK_DEF)
- `src/03-geometry.js` lines 44–62 (`snapWall`, `wallInfo`) · `src/05h-rooms.js` lines 20–45
  (`ROOM_PROBE`, `deviceHostWall`, `deviceRoomPoint`) — the face/room logic you mirror
- `src/06-wall-editor.js`: `grep -n "function renderWallView" -A30` — find where the elevation SVG
  string is assembled and the `WV` fields that give the current wall and side
- `src/05m-stack.js` hooks (`STK_SCENE`, `STK_OVERLAY`, `STK_TOOLS`, `STK_CTX`, `STK_WV`, `VALIDATORS`, `STK_CHECKS`)

## Build — `05n-marks.js` (prefix `mrk`)

### 1. Data helpers
```js
mrkList()                       // data.marks (lazy, pattern cktList)
mrkLayer()                      // the active stack's 'mark' layer id, else state.activeLayer
mrkWallById(level,id)           // WALLS[level].find(r=>r.id===id) — never cache the rect (CONTRACT: walls rebuild on undo)
mrkWallLen(r) · mrkWallH(r,level)          // centreline length; r.h || LH[level]
mrkU(r,x,y)                     // mm along the centreline from seg[0], clamped 0…len
mrkFacePt(r,side,u,off)         // plan point on the face of `side`, `off` mm further out (off=0 → on the face)
mrkFaceRanges(r,side,poly)      // [[u0,u1]…] where the face looks into poly: sample every 100 mm at
                                // mrkFacePt(r,side,u,ROOM_PROBE) → pointInPoly; merge contiguous samples
mrkRoomOfFace(level,r,side,u)   // allRooms entry whose poly holds mrkFacePt(r,side,u,ROOM_PROBE), topmost wins
mrkVAbs([a,b],r,level)          // tag band → absolute [v0,v1]: if a<0 BOTH count from the ceiling
                                // (H=mrkWallH): [H+a,H+b] — cove [-300,0] → [H-300,H]; else [a,b] as is
mrkAt(level,wallId,side,u,v)    // every mark covering that point: wall · side (same side) · vstrip (u in range) ·
                                // hstrip (v in range) · hband (room of this face, v in range)
                                // → [{m, kind, pol, tags}] — THE query later WPs use
mrkWallTags(wallId)             // union of tags of kind 'wall' marks on that wall
```

### 2. The tool — `STK_TOOLS` entry `{k:'mrkWall'}`
State: `MRK_T={on:false, mode:'wall'|'side'|'vstrip'|'hstrip', pol:'plus', tags:[]}` (the brush).
- Start: action `mark.wall` (group `Jelölés`, label `Fal jelölése`, icon `▥`, key **`j`** [Q14=A] —
  verify free first, CONTRACT §4). Pressing `j` while on cycles the mode
  wall → side → vstrip → hstrip → wall; `Shift+j` cycles back. The mode name shows in `#modeHint`:
  `Jelölés: teljes fal` · `falfelület (oldal)` · `függőleges sáv` · `vízszintes sáv`.
- `+` / `-` / `0` keys set the brush polarity plus / minus / none; `x` sets ban. HUD confirms.
- Hover (overlay): the wall under the pointer (`snapWall`-like nearest wall within 16 px) is
  highlighted per mode — whole rect · the face line on the pointer's side · a 300 mm segment on the
  face centred at the pointer · the whole face dashed with the brush tag's height band as text.
- Click: if the brush has tags and **Shift** is held → create with the brush, no dialog. Otherwise
  open the tag picker (§3), then create. Geometry per mode:
  `wall`: `{wall}` · `side`: `{wall,side}` · `vstrip`: `{wall,side,u0:u-150,u1:u+150}` snapped to 50 mm,
  clamped to the wall · `hstrip`: `{wall,side,v0,v1}` from the first picked tag's `v` (fallback 150–450).
  Drag in `vstrip` mode (down→move→up along the wall) sets `u0…u1` instead (min 100 mm).
- One `wall` mark per wall per layer: a second wall-mode click on a marked wall edits that mark.
- Every create/edit = `pushUndo(['marks'])`. `Esc` stops the tool.

### 3. Tag picker — `mrkPicker(kind, mark|null, onOk)`
`openModal('Jelölés — <kind label>', …)`: polarity radios (four, MRK_POL labels with their symbol),
checkbox list of `MRK_TAGS[kind]` (radio behaviour inside a `grp`), a `Megjegyzés` text input, and for
`hstrip` two number inputs `alsó / felső (mm)` prefilled from the first ticked tag's `v`.
Picking a tag whose `pol` differs from the current radio sets the radio to the tag's `pol` (the user
can change it back). Remember the result as the new brush.
Kind labels: wall `Teljes fal` · side `Falfelület` · vstrip `Függőleges sáv` · hstrip `Vízszintes sáv`
· hband `Körbefutó sáv`.

### 4. Right-click on a mark — `STK_CTX` entry
`mrkHit(e)` → nearest mark within 10 px (screen) of its drawn geometry, on visible mark sub-layers.
Items: `Címkék szerkesztése…` · `Polaritás: + előnyös` / `− kerülendő` / `⛔ tilos` / `· semleges`
(one item each) · for **hstrip**: `Kiterjesztés a teljes helyiségre` → replace by
`{kind:'hband', room:<room id of mrkRoomOfFace at the strip's mid u>, v0, v1, pol, tags}` (HUD if no room) ·
for **hband**: `Visszaalakítás erre a falra` (the clicked face only) · `Törlés`.

### 5. Drawing — `STK_SCENE` (plan) and `STK_WV` (Wall View)
Visibility: `layerShows(m,'mark')`; opacity: `lyrWrap(m,'mark',svg)`. Colour = `MRK_POL[m.pol].c`.
Plan, at `dz(level, 0)` for walls (the floor plane — marks are about the wall, not its height):
- wall: rect outline 2 px + fill-opacity .12 over the wall rect; badge with the first tag's `n` truncated to 14 chars at the midpoint
- side: 3 px line on the face; L-forma tag adds a small `L` at the face's end nearest another `lforma` side mark
- vstrip: 6 px band on the face, `u0…u1`, offset 3 px into the room
- hstrip: dashed 2 px face line + text `↕ 150–450`
- hband: the same as hstrip, on every `mrkFaceRanges` range of every wall face of that room
Wall View (one guarded line at the end of the elevation SVG assembly in `06-wall-editor.js`:
`if(typeof stkHookSvg==='function')s+=stkHookSvg(STK_WV);` — use that function's own string
variable name): marks of the open wall and side as rectangles in elevation mm — vstrip full height
`u0…u1`, hstrip/hband full length `v0…v1`, wall/side a 4 px frame; fill-opacity .18, label top-left.

### 6. Validation and checks
`VALIDATORS.push(…)`: `mark.dangling` (warn) — wall id or room id not found. `STK_CHECKS.mark`:
`info` when the stack has no wall marks yet (`'Még nincs falcímke — a tartófalak és a tilos zónák
a későbbi rétegeket vezetik.'`).

### 7. Actions (group `Jelölés`)
`mark.wall` (above) · `mark.list` — modal table of marks of the active stack: kind, wall/room, tags,
polarity; click a row selects the mark (sets the HUD and pans to it if `centerOn` exists — otherwise
just HUD).

## Tests — `tests/spec-36-marks-walls.js`
Fixture: room 4000×3000 drawn on centrelines with four 100 mm walls, one interior partition.
1. `mrkFaceRanges` of the left wall's inner face against the room = one range covering its length (±100).
2. A vstrip created by a simulated click at u=1000 is `{u0:850,u1:1150}` snapped; on a 600 mm wall
   near its end it is clamped inside 0…len.
3. hstrip from tag `kapcsolo` gets `v0:950,v1:1250`; `cove` on a 2700 wall gets `2400…2700`.
4. `mrkAt(level,wallId,side,1000,1100)` returns the vstrip and the kapcsolo hstrip, not a strip on the other side.
5. Extend-to-room turns the hstrip into one hband; `mrkAt` on another wall face of that room at that
   height now finds it; on the partition's far side (other room) it does not.
6. `mrkWallTags` returns `['tartofal']` after tagging; polarity default from the tag = `ban`.
7. The `j` key cycles the four modes and back with Shift; `Esc` turns the tool off.
8. Scene contains a mark element when the mark layer is visible and none when `cats.mark=false`.
9. Undo removes a created mark; `validate()` reports `mark.dangling` after the wall is deleted.

## Golden
Identical (fixtures have no marks).

## Browser-only checks (for the human)
Hover highlight follows the pointer; marks align with walls in every view style; Wall View shows strips.

## Verifier focus
No wall rect held across an undo (look up by id each time). `side` sign convention = `wallInfo(r).perp`.
Picker radio/grp behaviour. Every new SVG element goes through `lyrWrap`.

## Out of scope
Door/window tags and floor/ceiling marks (B3). Traces (B4).
