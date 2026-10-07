# Architecture

**Read this first.** It tells you which file to open, so you don't have to read 4 000 lines to change one thing.

## Shape of the project

```
src/                 the source — 12 modules, concatenated in filename order
  shell.html         markup + CSS, with /*__SRC__*/ where the script goes
  00-core.js  …  11-boot.js
build.js             src/ → dist/varler_planner.html   (one self-contained file)
dist/                the built app: open it in a browser, that's the whole product
tests/               595 assertions + 70 golden renders
docs/                this file, DECISIONS.md, and the feature backlog
```

```bash
node build.js          # build
node build.js --check  # build and diff against a reference file
node tests/run.js      # everything
```

## The one rule that matters

**The modules share a single scope.** `build.js` concatenates them into one `<script>` — there are no imports and no module boundaries at runtime. A function defined in `03-render.js` is visible in `09-lamps.js` and vice versa.

Consequences:

1. **Order is load-bearing.** `const` and `let` at the top of a module are in a temporal dead zone until that point in the concatenation. Moving a module earlier can break it silently at startup. If you reorder, run the tests.
2. **Names are global.** A new top-level `function draw2()` collides with any other `draw2`
   anywhere. Grep before naming — this has already bitten once: a new `const SC` for undo scopes
   collided with `SC`, the plan scale factor in `00-core.js`, and the whole app failed to boot.
   `node build.js && node --check` on the extracted script catches it immediately.
3. **Splitting further is free.** Cut a module in two at a top-level statement boundary, name the halves so they sort in the same place, rebuild, run `node build.js --check` against the previous `dist/`. If it's identical, the split was pure.

This is deliberate for now: it made the split from a single file provably safe (the first build was byte-identical to the file it replaced). Real module boundaries with explicit exports come with the schema work.

## Module map

| file | ~lines | what lives here |
|---|---|---|
| `00-core.js` | 114 | isometric projection maths, level table (`LH`, `ORD`, `DROPC`), the building model, example house geometry |
| `00b-i18n.js` | 60 | **the translation seam** — `t(key, hu)`, the hu/en dictionaries, `setLang` |
| `01-schema.js` | 110 | **document schema** — ids, migrations, reference resolution, connectivity graph, validation |
| `02-state.js` | 168 | the `state` object, layer system, circuits sidebar, legacy shims |
| `03-geometry.js` | 249 | geometry helpers, fine mode (Alt), snapping, wall geometry and the wall property sheet |
| `04-render.js` | 772 | the entire draw pipeline: normal 3D, blueprint plan and iso, whiteout, device and opening symbols, ghosts, raised-element badges |
| `05-totals.js` | 215 | totals, BOM, auto-numbering, wire and switch reports |
| `05c-actions.js` | 250 | the action registry, the ⌘K palette and the status bar |
| `05e-settings.js` | 90 | **the standards panel** — every domain number in one dialog |
| `05d-shell.js` | 190 | **the workflow shell** — stage rail and contextual inspector, generated from the registry |
 **the action registry**, the ⌘K palette and the status bar |
| `05h-rooms.js` | 80 | **room membership** — which room each device belongs to (wall devices by the face they look into), per-room type/count breakdown |
| `05j-circuits.js` | 250 | **circuit end points** — `data.circuits` (name, colour, dedikált, kismegszakító, member device ids), `K` pick mode, plan rings, per-layer device tint, the Áramkörök stage, JSON export for the Inventory / Elosztó tool |
| `05k-room-auto.js` | 230 | **room-wide Wall View automation** — Sorolás: rows of boxes on one wall face become 72 mm clip groups; Pálya-kötés: route nodes sitting on a box (in plan, ≤25 mm) become plan-only links, per route layer and device layer, stacked boxes decided by height. Both per room or all rooms, previewed, one undo step. While drawing: Device tool + Shift places the box in the nearest same-type row (72 mm, clipped); a Path tool node put down on a box snaps onto it and becomes its link when the path is finished (`placeSnap`, used by `08-interaction.js`) |
| `05l-layers.js` | 408 | **layer model v2 + layer panel** (BRIDGE Stack, WP-A1–A3) — the 16 sub-layer categories (`LAYER_CATS` itself sits in `02-state.js`), v1→v2 migration, per-category opacity (`lyrOp` / `lyrWrap` / `lyrFaces`), `lyrPushUndo` (layers + stacks in undo, opt-in via the `__layers` scope marker); `renderLayers` (vertical sub-layer rows, hold-drag), `lyrSwapCat` / `lyrMoveCat`, `lyrDuplicate` / `lyrMerge*` / `lyrLink` / lock (`lyrLockHit` is called from `hitTest`) |
| `05m-stack.js` | 259 | **BRIDGE Stack** (WP-B1) — `stacks` (session global) over ordinary layers carrying `L.stack`/`L.role`; `STK_ROLES`, wizard `stack.create`, adopt/dissolve, the stack stage rail (`shellStages()` in 05d), construct checks, and the shared hooks later stack work packages plug into: `STK_SCENE` / `STK_OVERLAY` (04 `draw()`), `STK_TOOLS` (08 pointer + keys), `STK_CTX` (10 right-click), `STK_WV` / `STK_PV`, `STK_CHECKS`; `VALIDATORS` lives in 01-schema |
| `05n-marks.js` | 639 | **marking layer** (BRIDGE Stack, WP-B2/B3) — `data.marks`: wall / side / vstrip / hstrip / hband marks, door and window tags, floor and ceiling strips and zones; `mrkAt()` is the query later layers use; tools `mrkWall` (J) and `mrkPlane` (G / Tab) through `STK_TOOLS`, drawing through `STK_SCENE` / `STK_OVERLAY` / `STK_WV` / `STK_PV`, right-click through `STK_CTX`; tag tables `MRK_TAGS` |
| `05o-traces.js` | 318 | **movement traces + portal graph** (BRIDGE Stack, WP-B4/B5) — `data.traces`: 45° line / freehand / smoothed freehand modes of the plane tool (RDP + end-fixed Chaikin), door snapping; `prtGraph(level)` is a pure derived JSON (doors as nodes, line of sight, A* over the 500 mm grid, trace encoding in each door frame, heat map) with two default-off overlays and a JSON export |
| `05p-hardware.js` | 366 | **hardware nodes** (BRIDGE Stack, WP-C1/C2/C4) — device types `rbx` `base` `meter` `entry` `ssc` (+ the existing `board`) placed on a wall FACE by the `hwPlace` tool (vstrip attraction, ban warning); their 3D boxes are DERIVED at draw time (`STK_BOXES`), never stored; RBX room serving with one owner per room (manual > faced > behind the wall), pick mode, coverage ghost; BASE units, guideline rules and highlights |
| `05q-rf.js` | 142 | **radio coverage** (WP-C3) — simplified COST-231 multi-wall model on the 500 mm grid; wall loss from the Marking layer's material tags, else from thickness; memoised on a basis string; the RF view, settings, per-RBX radios, coverage checks |
| `05r-channel.js` | 148 | **channel topology** (WP-C5) — routes between hardware nodes are ordinary paths drawn with the Path tool while `CHN_T` is on (`route:'channel'`, `rule`); the carrier is derived from the two end types; names `A~B`, `/b` for parallels; `chnTree` (shortest channel paths from BASE, physical chain) and `chnLenToBase`; `CHN_PATH_HOOKS` is the finishPath hook E1 shares |
| `05s-endpoints.js` | 301 | **endpoints** (WP-D1/D4) — `EP_CAT`: BRIDGE type codes per system role with variants that fix the cables and own conduits (STD-001-A2); LMP/SWI/SOC stay classic light/switch/socket, every other code is type `ep`; an endpoint always lands on its code's role layer; `epCables`; circuits reused from 05j with implicit defaults; BRIDGE control groups `sw.ctl` (the switch is an RBX input — no switch-to-lamp wire); `epGroupsFor(room, role)` is the fill's input |
| `05t-needs.js` | 309 | **room needs + placement suggestions** (WP-D2/D3) — room kind from Rendeltetés, then name; per-layer checklists with defaults + ticks derived from the Marking layer; a saved layer is a full object; status off/empty/open/done; overview, dialog, checks, `needReport`; `SUG_ANCHORS` (door handle side, window head, far corner, media-wall pair, night-trace leg lights, coverage gap…) as overlay hints + soft snap (Alt = free) |
| `05u-arms.js` | 123 | **ARM routes + stack view** (WP-E1) — paths with `route:'arm'` drawn by the Path tool while `ARM_T` is on; an end within 150 mm of another route branches from it through an explicit join `n.j={p,n}` (its segment is split when needed); `state.stkView` fades every non-stack layer to 30 % through `lyrOp`; ARM refs `A<n>` per room; ban-wall and unreached-endpoint checks |
| `05v-graph.js` | 116 | **route graph** (WP-E2) — pure: explicit edges only (route segments, joins, device links with their vertical drop, ≤ 1 mm coincidence); Dijkstra (binary heap), daisy chain by graph distance, Steiner tree by KMB, tree legs; deterministic by key order |
| `05w-fill.js` | 306 | **auto-fill** (WP-E3/E4) — a pipe only starts and ends at a box: one pipe per run leg, merged only for the same family between the same two boxes; sizing by STD-001-A2 (1.4 × OD single, 40 % / 33 % fill, plug minimums); `data.runs` + `sec.cont.auto` entries owned by `src`, manual kept, basis for staleness; share / ban / overfill warnings; the CHANNEL bundle with chain accumulation, MAINS feed packing (M32 bins, M25 minimum), the security trunk; report and export |
| `05x-cabinet.js` | 133 | **Elosztószekrény** (WP-E5) — ways from the channel topology (system, RBX lighting, RBX socket circuits, big loads), RCBO per way or grouped RCDs, feed + SPD + bell, rows and spare modules, greedy phase balance; `vrg-cabinet` v1 export wrapping `vrg-circuits`; reproduces P33 (24 ways, 29 / 34 modules) |
| `05b-editor-core.js` | 130 | **the editor surface layer** — one pointer/drag/warp/menu implementation, driven by a projection |
| `06-wall-editor.js` | 850 | wall elevation editor — chase model, notes, action rail, session, links, coordinate list, **wall projection** |
| `07-plane-editor.js` | 364 | floor / álmennyezet / ceiling plane editor, **plane projection** |
| `08-interaction.js` | 463 | pointer and keyboard handling, gizmo, format painter, touch gestures |
| `09-menus.js` | 118 | hit-test, context menus, modal helper, room / wall / opening actions |
| `10-lamps.js` | 400 | lamp data sheet, generated objects, hover preview |
| `11-controls.js` | 167 | sidebar controls, projects, panels, persistence |
| `12-boot.js` | 440 | startup wiring |

**Where do I put a new feature?** By subject, not by size. A new door type goes in `04-render.js` next to the other door symbols; a new editor action goes in `06-` or `07-`; a new standard or catalogue table goes in `00-core.js` for now (it gets its own module later).

## Data model

```js
data = {v, seq, devices, paths, cables, openings, floors, objects, roofs,
        notes, measures, wallNotes, noteHide}
WALLS[level]  SLAB[level]  GHOST[level]  ROOMSB[level]  ROOFS[level]  SNAP[level]
```

**Every record carries an `id`** (`D7`, `P3`, path nodes `n12`), issued from `data.seq` — a
per-document counter that only moves forward, so an id is never reused. `ensureIds()` is
idempotent and runs wherever a document is snapshotted, saved or loaded, rather than at every
creation site. `data.v` is the schema version; `migrate()` upgrades older files on load.
Because `ensureIds()` only fills in *missing* ids, **every copy must go through
`copyRecord(coll, rec)`**, which drops the id (and, for a device, its links and clip row) — a
plain `JSON.parse(JSON.stringify(x))` or `Object.assign({}, x)` copy keeps the original's id,
which is how NV4 ended up with three sockets called `D131`. Files saved before that fix are
mended on load by `repairDupIds()` (called from `migrate()`, no version step): the first record
keeps the id, the rest get fresh ones, and a Behúzás entry moves to a copy only when that is
unambiguous; anything else stays with the first and is reported (`idRepairReport()`, console, HUD).

**Cross-references are ids, not indices.** `dev.link = {p:'P3', n:'n12'}`; resolve with
`linkTarget(dev)`, which returns `null` when either end is gone. Deleting anything is therefore
safe: a dangling reference resolves to nothing and `pruneLinks()` tidies up. This replaced the
old index-repair code, which had to renumber every reference after a splice.

Two derived, never-stored layers sit on top:

- **`connectivity()`** → `{terminals, segments, at}`. Terminals are devices; segments are drawn
  spans between two node ids, carrying conduit ⌀, length and circuit; `at` maps each path node
  to the terminals sitting on it (by link, or by coincidence). This is the seam the Rendezés
  editor and the cable-occupancy layer will build on. Geometry stays the single source of truth.
- **`validate()`** → `[{sev, code, msg, ref}]`. `sev` is `error` / `warn` / `info`. Current rules:
  dangling link, stub path, section-count mismatch, duplicate id, unknown level. Add rules here,
  not scattered through the UI.

Still true and still important: anything that clears the workspace must clear *everything* — see
`hardResetWorkspace`; a partial list caused real data bleed between projects.

## Language

`t(key, hu)` returns the active language's string, falling back to **the Hungarian text passed in**
— never to a bare key. So converting a literal is a local edit (`'Fal'` → `t('insp.wall','Fal')`)
and a half-translated build still reads correctly in Hungarian.

Covered so far: the stage rail, the inspector, the status bar and the palette chrome. The old side
panel and the dialogs are still Hungarian literals; each is a one-line change when someone gets to
it. Action labels carry an `alias` of English search words, which is what makes ⌘K work in either
language today.

## Standards

`05e-settings.js` puts every domain number in one dialog: chase factor with the resulting widths,
box pad and pocket depth, szerelvénydoboz and clip spacing, board mounting height, drop-ceiling
plenum, the standard height table, the IP-by-environment table, and the wall presets. These are
professional decisions that vary by country and by client — they belong in front of the user, not
buried in `00-core.js`. The editable ones live in `state` and persist with the project.

## Actions

Every capability is declared once in `05c-actions.js`:

```js
{id, label, group, icon?, hint?, alias?, need?, keys?, when?(ctx), run(ctx)}
```

`when(ctx)` decides whether it is offered right now; `run(ctx)` does the work. The context comes
from `actionCtx()` — mode, level, selection type, whether an editor is open. Three consumers read
the same list today: the **⌘K palette**, the **keyboard map** (`actionForKey`), and the **status
bar**. The stage rail and the inspector will read it too, and 1.1's Súgó tool wants only a `help`
key adding to each entry.

Two rules that keep it useful:

- **An action that isn't registered is a feature nobody can find.** New capability → new entry,
  even if it also has a button.
- **Disabled actions still appear in the palette**, dimmed, with `need` explaining what to select
  first. Hiding them is how a tool becomes folklore.

Search ranks by *where* the match landed — name, then alias, then group, then hint — so an action
named after a word beats one that merely mentions it. It folds Hungarian accents (`veset` finds
`Véset`) and accepts English aliases, which is also the seam for the coming translation.

## The shell

`05d-shell.js` renders two panels over the stage, both **generated from the action registry**:

- **Stage rail** (left) — the five stages of the job: Épület → Helyiségek → Kiosztás → Pályák →
  Dokumentáció. Each stage owns a set of action groups, a one-line description, and a `check()`
  that returns its own checklist (unnamed rooms, devices with no ref, unlinked devices, validation
  errors). Warnings show as a badge on the rail.
- **Inspector** (right) — what's selected, a few live-editable fields for the common types, and
  every action that applies. Deeper property sheets stay as actions opening the existing dialogs,
  so each sheet has exactly one implementation.

`state.shell = false` hides both; nothing else depends on them. A new action appears in the
inspector automatically if its `group` belongs to a stage or to a selection type — there is no
list of buttons to maintain.

**The shell is chrome, not drawing.** A test asserts the scene layer is byte-identical with the
shell on and off.

## Surfaces and projections

A wall elevation and the three plan planes are the same abstraction: **a projection of the model
onto a surface with 2D local coordinates in millimetres.** `05b-editor-core.js` owns everything
that isn't the drawing — pointer handling, dragging, section drag, warp, path drawing, note
editing, context-menu routing, soft re-render — and each editor supplies a descriptor:

```js
edBindSurface(E, svgEl, {
  kind, local(ev)→{u,v}, clamp, data(), nodeUV(node),
  setDev, setNode, setNote, setOpening?,   // writers in surface mm
  addNode, soft(el), full(), menu(ev,u,v), badge?
});
```

Adding a new surface (a roof plane, a section, the 1.1 Rendezés graph) means writing a
descriptor and a renderer — not another editor. Two consequences already visible: `setOpening`
exists only on the wall (a plane has no openings to slide), and `badge:false` on the plane
because a top view has no height to read out.

`edMount(E)` returns the container the editor renders into — the modal today, a separate window
when 1.1 needs one. Don't reach for `modalEl` directly in editor code.

## Invariants worth knowing before you edit

- **The viewport has two layers and repaints only what changed.** `draw()` builds a *scene*
  string (the drawing) and an *overlay* string (rubber bands, ghosts, gizmo, marquee, drag
  badges), and `paintLayers()` assigns each only if it differs from last time. Assigning
  `innerHTML` makes the browser parse SVG, and that parse — not building the string — is the
  cost: measured at 120 devices, an idle redraw went from ~117 ms to ~5 ms and an overlay-only
  change to ~4 ms. A change to the model still repaints the scene (~50 ms in jsdom); making
  *that* cheaper needs per-item DOM updates, which is a later job.
- **`updateTotals()` only runs when the scene string changed.** Totals derive from the model, so
  a camera move or a hover can't affect them.
- **`drawSoon()`** is the rAF-coalesced draw, used by the pointermove handlers. `draw()` itself
  stays synchronous, so the other ~200 call sites and every test behave as before.
- **Undo snapshots can be scoped.** `pushUndo(['paths'])` clones only that collection and the
  entry remembers its scope, so `applySnap` restores exactly what it captured. Editor drags use
  `edDragScope(kind)`: a node or section drag snapshots `['paths']` (7 KB in a project whose full
  snapshot is 168 KB), a device drag `['devices','paths']`, a note drag `['wallNotes']`. An
  unscoped `pushUndo()` still captures everything, including the walls.
- Add a new collection → add it to `UKEYS` **and** to `IDPRE` in `01-schema.js`, or it won't
  undo, save, clear or get ids.
- **Both editors share one session layer.** `edCur()` returns whichever of `WV` / `PV` is open; `wvPush` / `wvUndo` / `wvCloseEditor` / `wvOpenModal` all act on it. Editor edits never touch the global undo stack until the session is saved.
- **`Esc` never discards.** It steps out one level (finish path → clear warp → clear selection → leave fullscreen). Closing is only via the Mentés / Elvetés buttons. This was a real bug; don't reintroduce it.
- **Never replace an `<svg>` element mid-drag** — it holds the pointer capture. Replace its children instead (`edInner()` strips the outer tag). This bug appeared twice, once per editor; the shared layer now makes it impossible to get wrong in only one of them.
- **Text with a halo is drawn twice** (stroke pass, then fill), not with `paint-order`, because exporters ignore it.
- **Chases merge via `clipPath`**, not `mask` — clipPath children union by spec and are far better supported.
- **A wall hit is `{t:'wall', ref:<rect>}`**, not `data[t][i]` like every other piece. `pieceRef`
  handles it; your code probably should too. Walls now carry an `id` (`W12`) for exactly this
  reason: `applySnap` rebuilds every wall object, so anything holding a reference — the selection,
  a gizmo drag — would otherwise keep editing an orphan. `reselectAfterSnap()` re-resolves by id
  after every restore. **Never hold a wall reference across an undo.**

## Testing

`tests/golden.js` renders 70 outputs from 6 fixture projects and hashes them. During any restructuring those hashes must not move — a single `CHANGED` line means the change wasn't pure. See `tests/README.md`.

What the tests cannot see: pointer capture, real layout, keyboard focus, canvas export, printing, touch. Those live in `browser_verification_checklist.md` and need a human.
