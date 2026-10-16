# WP-F4 — Padló létrehozása (Create Floors) + room-type tint

Status: todo · Wave F · Depends: F3 (works without it) · Size: S (~70 lines) · Spec: next free · Decisions: —

## Goal
*"Another button can be clicked to Create Floors — which fills the inner areas of the walls with floors (Foundation in
Prison Sim). Floors can have a slight discolouration based on what room they will be when set — intuitive colour
coding, toggle on/off."*

## Read
`03-geometry.js:352` (`createRoom` floor record) · `04-render.js` floor fill (grep `fl.fill`) · `00-core.js:163`
(`ROOMS` hues) · `05t-needs.js:18` (`NEED_KINDS`, `needKind`) · MATERIAL §2.

## Build
1. Button `▦ Padló létrehozása` (action `wf.floors`, group `Helyiség`): every `stage:'outline'` room on the active level
   → `stage:'floor'`. With `clear:true` the poly is already the inner face; without it (Q-F01 B) the poly is offset
   inward by `t/2` per edge (walls known from F3) — `wfwInset(poly, level)`.
2. Fill colour: `fl.fill` if the user set one; else `state.floorTint` → the kind's hue (`ROOMS` where the kind maps:
   nappali → NAGYSZOBA, halo → HALO, konyha → KONYHA, kamra → KAMRA, kozlekedo → CORR, gepeszet → GARAZS) at 35 %
   mix with `#e9e5da`; other kinds and no kind → `#e9e5da` (today's default). Multi-type rooms: the first kind.
3. Toggle `Helyiségtípus színezés` in the view settings (synced like the other `state` checkboxes, 11-controls.js ≈ 225).
4. HUD `'Padló létrehozva: 6 helyiség, 54,30 m²'`.

## Tests
1. Two outline rooms → button → both `stage:'floor'`, total area as the sum of the clear polys.
2. A room with `kinds:['konyha']`, tint on → fill = 35 % mix of `#cfe4c9` and `#e9e5da` (exact hex in the spec).
3. Tint off → `#e9e5da`. A user fill wins over both.
4. Golden identical (fixtures have no `stage`/`kinds`).
