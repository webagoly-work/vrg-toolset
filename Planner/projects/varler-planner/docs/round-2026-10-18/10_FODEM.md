# Födém — WP-S1 … S3   (answers S1 B · S2 A · S3 A · S4 B)

User's words: *the floors of the layer can be set (RCO and on tabs associated with Floor creation) to show Födém —
turning the 2d floor into a 3d slab with standard thickness used between each level of residential buildings. The z
is always generated starting downward of the floor level, with its underside technically being the lower level's
mennyezet height — so that it can be used to create paths (like with the old Path tool) between levels (the spot on
the lower level's mennyezet is the lowest reachable point of the above level).*
S1 answer: *only the floor's inner height is counted, with a common-thickness födém added between the two.*

Geometry (level `l`, previous level `p` in `ORD`, födém thickness `t_l` = the slab **under** `l`):

```
LH[l]               = inner (clear) height of l — unchanged meaning for walls: walls stay LH[l] tall
top of slab l       = floorRealZ(l)                 (the floor of l)
underside of slab l = floorRealZ(l) − t_l           (= floorRealZ(p) + LH[p] = the mennyezet of p)
floorRealZ(l)       = floorRealZ(p) + LH[p] + t_l   (the building grows by t per slab)
lowest level        = floorRealZ 0; its slab (S4 B) hangs from 0 down to −t
```

Nothing changes for a file without födém: `t_l = 0` → `floorRealZ`, `floorDispZ`, every wall and every golden render
stay byte-identical.

## WP-S1 — data + switches (module `src/08p-slab.js`, prefix `slb`)

- `SLAB_T_DEFAULT = 300` in 00-core.js next to `DROP_PLENUM`.
- Level data: `data.slabLvl = {basement:{on,t}, ground:{on,t}, upper:{on,t}}` (missing = off). **The level step uses
  the level value** — one common thickness between two levels, as answered. New documents: all on, 300 (S4 B: the
  lowest level too).
- Floor record: `fl.slab = false` hides the slab under that one floor poly (stair hole, void, terrace) — drawing only;
  it does not change the level step (a level cannot have two different floor heights).
- `slbT(level)` (0 when off), `slbUnderside(level)` = `floorRealZ(level) − slbT(level)`.
- Change in 00-core.js: `floorRealZ` / `floorDispZ` add `slbT(k)` for each level up to and including `l` except the
  lowest (whose slab hangs below 0). These two functions are the only place the step is computed → grep every
  `floorRealZ(`, `floorDispZ(`, `dz(` caller once to confirm none adds `LH` by hand (04-render.js `pushRefBuildings`
  does — reference buildings keep their own heights, no slab).
- UI:
  - room/floor RCO (10-lamps.js `roomMenuItems`): `▭ Födém ezen a szinten: be / ki`, `Födém vastagság… (300 mm)`,
    and for one floor `Födém kihagyása e padló alatt` (fl.slab = false).
  - Szintek tab (11-controls.js, next to hBase / hGround / hUpper): per level *Födém alatta* checkbox + `t` input;
    the labels hBase… read **belmagasság** from now on.
  - Create Floors (08d `wfwFloors`): option *Födém minden szintre* (default on).
- Undo: unscoped `pushUndo()` for level changes (every z moves), `pushUndo(['floors'])` for `fl.slab`.
- Engine / tools that assume floor-to-floor = LH: 08ob `cfg.subFeed.slab` (literal 300 → `slbT`), the Alosztó riser
  length (E6), tools/baseline heights — riser and vertical cable lengths grow by `t`.

Tests (`tests/spec-102-slab.js`): LH basement 2500 / ground 2700, ground slab 300 on → `floorRealZ('ground')` 2800,
underside 2500 = basement ceiling; upper slab 300 → `floorRealZ('upper')` 2500+300+2700+300 = 5800; lowest-level slab
spans −300…0; all off → 0 / 2500 / 5200 exactly as today; old fixture → golden unchanged.

## WP-S2 — render

- 3D (04-render.js:106): for each floor poly on a level with a slab (and `fl.slab !== false`) push a prism
  `poly × [fz − t, fz]` (add `pushPrism(faces, poly, z0, z1, …)` — `pushBox` only takes rectangles): top face =
  today's floor face, bottom face, side quads.
- Exploded view: the slab travels with the level above it (it is that level's floor).
- Blueprint / Alaprajz (06e): slab edge at holes drawn dashed *födém éle*; poché unchanged.
- Wall elevation (06-wall-editor): hatched band of the slab above the wall top, label *Födém 300*.
- Plane editor Mennyezet: caption *mennyezet = a felső födém alja, belmagasság 2700 mm*.

⏸ Look on CLA (two levels): slab visible, stair hole reads right, total height = Σ LH + Σ t.

## WP-S3 — paths through the slab

- A path node on level `l` may have `h` down to `−t_l` (today `h` is clamped ≥ 0). `h = −t_l` = the lower level's
  ceiling = **the lowest reachable point of the upper level**.
- Snap: while drawing on `l` over a slab, the cursor offers the slab-underside spot (ring + *födém alja*); it is the
  same world point as `(x, y, LH[p])` on the level below. A node there gets `n.thru = {level:p}`; the lower level and
  its Mennyezet plane show it as a ceiling node.
- Connectivity (`connectivity()`): nodes on adjacent levels with equal world z and xy (±5 mm) are one junction — the
  path between levels. The Jelölés `felszallo` mark is the preferred spot; a crossing elsewhere gives info `slb.thru`
  (*födémáttörés jelölés nélkül*).

Tests: upper node at `h = −300` over a ground room with LH 2700, slab 300 → world z = floorRealZ('upper') − 300 =
ground ceiling node z; connectivity joins them; no slab → `h` clamps to 0 as before.

⏸ Feel: drawing a riser from the upper floor down to the lower ceiling in the 3D view.
