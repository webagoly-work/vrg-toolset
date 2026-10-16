# WP-D2 — Room needs: per-layer checklists that drive the fill-up

Status: todo · Wave D · Depends: D1, B3 · Size: M (~240 lines) · Builder: mid tier
Decisions: Q27=A · Q28=A

## Goal
*"Each Room has a checklist that contains the needs for every layer separately, starting in order …
active layers require that layer type's device/endpoint needs to be selected (Lights? Check. Switches?
Check. Power socket? Check. Other dedicated device? Check — some ticks next to the most common and
logical options based on the room) … expecting a minimum of one device point per type within it to be
considered done — and the needs check can begin for the next layer."*

## Read (only these)
- `01_CATALOGUES.md §8` (`NEED_KINDS`, `NEED_DEFAULTS`, derived ticks) · `§2` (roles)
- `src/05s-endpoints.js` (`epOfRole`, `epEntry`) · `src/05h-rooms.js` (`roomOfDevice`, `roomMembers`)
- `src/05n-marks.js` (`mrkOpeningTags`, `mrkDoorRooms`) · `src/05o-traces.js` (trace tags)
- `src/05d-shell.js` the inspector part (`grep -n "function renderInspector" -A30`) — where room fields render

## Build — `05t-needs.js` (prefix `need`)

### 1. Model
```js
needFold(s)               // lower-case, accents removed (á→a … ő→o, ű→u)
needKind(rm)              // rm.kind || first NEED_KINDS whose re matches needFold(rm.name) → k
needDefaults(rm)          // role → [codes]: start from NEED_DEFAULTS['*'], the kind's entries REPLACE
                          // per role; then add DERIVED ticks (§8 list) with flag derived:true
needOf(rm,role)           // {<code>:true} — rm.needs[role] if the user ever saved that role, else defaults
needSet(rm,role,code,on)  // pushUndo(['floors']) for a data.floors room; writes rm.needs[role] as a full
                          // object so later default changes never silently alter a saved room
needHave(roomId,role,code)// count of devices in the room (roomOfDevice) with that code on that role's layer
                          // ('sys:RF' codes are techs: "have" = rfRoomCover ≥ 0.9 when C3 exists, else null)
needStatus(rm,role)       // 'off' (role layer hidden or role not in the stack) · 'empty' (nothing ticked) ·
                          // 'open' (some ticked code has 0) · 'done' (every ticked code ≥ 1)
needRoomSummary(rm)       // [{role,status,missing:[codes]}] in STK_ROLES order, sys:* roles only
needNextRole(rm)          // first role whose status is 'open' — the "next layer" for this room
```
Building rooms (`ROOMSB`) are objects in `B.rooms` — `needs` and `kind` persist there exactly as on
`data.floors` (saved through `sessionObj`). They are **not in any undo snapshot** (an existing
limitation: room-sheet edits on them are not undoable either). Do not extend undo for this WP; after a
`needSet` on a building room show HUD `'Épületmodell-helyiség: ez a módosítás nem vonható vissza.'`
and list it in the report as follow-up.

### 2. Gating [Q27=A: soft]
Never blocks. The stage rail badge of a `sys:*` stage counts rooms whose earlier roles are not done;
the inspector shows `Előző réteg nincs kész: <role>` as an info line.

### 3. UI — the room checklist
When a room is selected (inspector) **or** right-clicked (`STK_CTX` on empty floor inside a room while a
stack is active → `Helyiség igényei…`), show/open:
```
NAPPALI (1.04) · Nappali ▾                       ← kind select (NEED_KINDS)
Erősáram        ✓ Lámpa (2)  ✓ Kapcsoló (1)  ✓ Dugalj (0!)  ☐ Dedikált  ☐ Redőny ⚙   [open]
Törpefesz. A    ✓ LED-vonal (0!)  ✓ Univerzális végpont (1)                           [open]
…
```
One line per `sys:*` role of the stack, in order; one checkbox per `epOfRole(role)` code (unique codes)
with the count in brackets, `!` when ticked and 0, `⚙` on derived ticks; the role status as a chip.
RF row: one checkbox per `RF_TECH` key with its coverage %. In the inspector, the ACTIVE stage's
role is expanded, the others collapsed to their status chip.

### 4. Checks — `STK_CHECKS['sys:<X>']` for every sys role
Per room: `warn` status `open` → `'<szám> <név>: hiányzik <codes>'` · `info` status `empty`.

### 5. Export seam
`needReport(stackId)` → `[{room:{id,num,name,kind}, roles:[{role,status,need:{code:have}}]}]` (pure JSON).
Action `need.export` (`Igénylista exportálása (JSON)`) downloads it.

## Tests — `tests/spec-46-needs.js`
1. `needKind({name:'Fürdőszoba'})==='furdo'`; `{name:'ÉTKEZŐ'}`→`etkezo`; `rm.kind` overrides.
2. `needDefaults` of a WC: MAINS `[LMP,SWI]` (no SOC), MEDIA `[]`.
3. Derived: a window of the room tagged `redony` → SHU appears with `derived:true`; a door tagged `p2` →
   POR on CONTROL and SENSOR.
4. With 1 LMP and 1 SWI in a ticked MAINS [LMP,SWI,SOC] room → `open`, missing `['SOC']`; add a SOC → `done`.
5. A device of code SOC on the wrong role layer does not count.
6. `needSet` persists `rm.needs` as a full object; undo restores the previous state.
7. `needNextRole` returns the first open role in STK_ROLES order.
8. `needReport` is plain JSON and lists every room of the stack's levels.

## Golden
Identical.

## Browser-only checks (for the human)
The checklist is quick to tick on a laptop and on a phone-width inspector.

## Verifier focus
Defaults vs saved: a room the user never touched follows `NEED_DEFAULTS` changes; a saved room never
does. Counting only devices on the role's layer.

## Out of scope
Where to place things (D3). Wiring (E-wave).
