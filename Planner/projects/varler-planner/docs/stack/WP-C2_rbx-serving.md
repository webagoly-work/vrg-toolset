# WP-C2 — RBX room serving and the coverage ghost

Status: todo · Wave C · Depends: C1 · Size: M (~220 lines) · Builder: mid tier
Decisions: Q21=A · Q22=A

## Goal
*"The ghost version before placement should show a visual field originating from each side of the
Box, showing how a Room/area gains coverage (direct coverage means that an RBX has been assigned to
one or a pair of rooms, while a toggle wireless cloud could give feedback on wireless coverage) —
every room and area needs to be assigned to an RBX (common-wall rooms get this automatically, but an
RCO on a placed Box makes a connection with additional rooms)."*

## Read (only these)
- `src/05p-hardware.js` (yours, C1) · `src/05n-marks.js`: `mrkRoomOfFace`, `mrkFaceRanges`
- `src/05h-rooms.js` lines 20–45 (`deviceHostWall`)

## Build — `05p-hardware.js`

### 1. Serving
```js
hwAutoServes(d)     // [roomId…]: the room its face looks into, plus — when the host wall is internal —
                    // the room on the wall's other face at the same along-wall position [Q21=A: both faces]
                    // (mrkRoomOfFace(level, hostWall, ±side, u)). Order: front first.
hwServes(d)         // d.serves (manual list) ?? hwAutoServes(d)
hwRoomRbx(roomId)   // [rbx devices whose hwServes includes the room]
hwUnserved(level)   // rooms on the level with no RBX — every room must have exactly one [Q22=A]
hwServePick(d)      // pick mode (STK_TOOLS {k:'hwServe'}): clicks on rooms toggle membership in
                    // d.serves (initialised from hwAutoServes on first toggle); Enter/Esc ends;
                    // pushUndo(['devices']) once at the first toggle
```
A room may be served by one RBX only: toggling a room already served by another RBX asks
`confirm('<szoba> jelenleg: <RBX ref>. Átteszed ide?')` and removes it there (setting that box's
`serves` explicitly).

### 2. RCO on an RBX (`STK_CTX`, extend C1's menu)
`Helyiségek hozzárendelése…` (→ `hwServePick`) · `Automatikus hozzárendelés visszaállítása`
(`delete d.serves`) · one disabled-looking info line per served room `· <szám> <név>` (act: no-op).

### 3. Coverage ghost (overlay, `STK_OVERLAY`)
While the `hwPlace` tool is placing an RBX **and** for the selected RBX:
- **direct coverage**: every room in `hwAutoServes(ghost)` (or `hwServes(selected)`) filled with the
  RBX colour `#3b82c4` at fill-opacity .10 and a .5 px outline;
- **the field**: on each face that has a room, a half-disc of radius `min(3000, room bbox diagonal/2)`
  centred on the box face, built as an SVG path of 24 segments, filled with a radial gradient
  (`<radialGradient id="hwfg">`, .22 → 0) and clipped to that room's polygon (`clipPath`);
- **wireless cloud** toggle `state.hwCloud` (action `hw.cloud`, `Vezeték nélküli lefedettség`):
  when C3 exists, call `rfCoverageSvg([ghostOrSelected])` — else HUD `'A rádiós modell (C3) még nincs kész.'`.
- Unserved rooms on the level get a diagonal hatch (`<pattern>`) at opacity .25 while the hw stage is
  active, so gaps are visible at a glance.

### 4. Checks — `STK_CHECKS.hw`
`warn` per unserved room (`'<szám> <név>: nincs RBX hozzárendelve'`) · `error` a room served by two RBX
(can only arise from hand-edited data) · `info` an RBX serving more than 3 rooms (RB-H territory —
STD-001 says a chain node carrying 2+ rooms' pass-through is RB-H) suggesting the class.

## Tests — `tests/spec-41-rbx-serving.js`
Fixture: two rooms A | B sharing a partition; RBX on the partition facing A.
1. `hwAutoServes` → `[A,B]` (front first); on an outer wall → `[A]`.
2. Pick mode toggling room C adds it; toggling B removes it; `d.serves` explicit afterwards; one undo step.
3. Moving C from another RBX asks (stub `confirm`) and removes it there.
4. `hwUnserved` lists the rooms with no RBX; the hw check reports one warn per room.
5. Overlay during placement contains a `clipPath` per served room and one radial gradient definition.
6. `delete serves` (RCO reset) returns to the automatic pair.

## Golden
Identical.

## Browser-only checks (for the human)
The ghost reads as "this box covers these rooms" before clicking; hatch on unserved rooms not noisy.

## Verifier focus
Back-face room is sampled at the SAME along-wall position (a long partition can border several
rooms on the far side). Gradient/pattern ids defined once per overlay, not per room.

## Out of scope
Signal maths (C3). Chain topology between boxes (C5/E4).
