# Domoszló Planner — architecture, UI and workflow review

Baseline measured on the shipped build (409 846 bytes).

| | |
|---|---|
| Total file | 405 706 chars (JS 381 815 · HTML 16 569 · CSS 7 290) |
| JavaScript | 4 150 lines, **415 top-level functions**, 4 555 lines inside functions |
| Global mutable bindings | 26 (`WALLS`, `WV`, `PV`, `draft`, `selected`, `gizDrag`, …) |
| Constant tables | 64 (`DEV`, `DEVKIND`, `DEVICE_CATALOG`, `DEVORDER`, `PLACE_ITEMS`, …) |
| `state` object | 69 keys, flat |
| `draw()` call sites | **232** |
| `pushUndo()` call sites | 81 |
| SVG built by template literal | 613 sites |
| `$('id')` lookups | 506 · `.onclick=` 125 · `.onchange=` 71 · `innerHTML=` 33 |
| UI surface | 20 toolbar groups, 73 buttons, 43 inputs, 9 selects, 13 modes |
| Test suites | 9 files, 478 assertions, all green |

Measured render cost, 120 devices + 60 paths (a small real house): **91 ms per `draw()`** in jsdom, 74 KB of SVG string per frame. A browser will be faster, but this is rebuilt **on every pointermove during a drag**.

---

## 1. What the code gets right

Worth stating before the criticism, because a refactor must not destroy these:

1. **Single-file distribution.** No toolchain, no server, works offline on a phone on site, can be emailed. For a contractor's tool this is a real product feature, not a limitation. Any refactor must still emit exactly one HTML file.
2. **The domain model is genuinely good.** Chases derived from real conduit diameters, running-metre summaries per width×depth, IP by room environment, Valena refs tied to switch type numbers, riser markers where runs leave a plane. This is domain knowledge that a generic CAD tool doesn't have, and it's the actual value of the product.
3. **Deterministic, testable rendering.** Everything is a pure string built from data. That's why 478 jsdom assertions are possible at all. Keep this property.
4. **A consistent editing grammar has emerged**: drag / right-click / Alt-fine / Space-place / warp / save-discard. It was invented incrementally but it is coherent.

---

## 2. Backend: what feature-by-feature growth has left behind

### 2.1 Five overlapping device taxonomies
`DEV` (labels) · `DEVORDER` (tool cycling) · `DEVKIND` (switch/socket variants) · `DEVICE_CATALOG` (manufacturer parts) · `PLACE_ITEMS` (Space palette) · plus `REFPRE` and `LAMP_MOUNT`/`LAMP_FIX`. A socket's identity is currently spread across `type`, `kind`, `devDef` and a free-text `ref`, with different code paths reading different ones.

**Fix:** one `CATALOG` keyed by a single `partId`, with `type` (role in the model) and `kind` (variant) as attributes of the catalogue entry, not of the record. A device record then carries `partId` and nothing else about identity.

### 2.2 Records are open bags with no schema
`data.devices` entries carry at least 25 distinct ad-hoc fields (`lampW`, `lampFix`, `jbShape`, `clip`, `genId`, `link`, `swMap`, `thumb`, `hover`, `boxColor`, `drop`, `mount`…). Nothing declares which are valid, nothing migrates old files, nothing stops two features colliding on a name.

**Fix:** a versioned document schema with `v` and a migration chain (`migrate_1_2`, `migrate_2_3`). Lamp-specific fields move into a namespaced sub-object (`dev.lamp = {...}`), likewise `dev.box`, `dev.link`.

### 2.3 Index references instead of IDs
`dev.link = {pi, ni}`, clip groups by shared string, generated objects by `genId`, `pieceRef` by array index. I have already had to write `wvRelinkAfterPathRemoval()` to repair indices after a splice — that function is a symptom, not a solution. Every new relationship will need its own repair routine.

**Fix:** every record gets a stable `id` at creation; all cross-references are ids; deletion is `byId` and never renumbers anything. This deletes a whole class of latent bugs.

### 2.4 The two surface editors are the same program written twice
| pair | similarity | lines |
|---|---|---|
| `renderWallView` / `renderPlaneView` | 31 % | 149 / 116 |
| `wallElevationSVG` / `planeViewSVG` | 42 % | 112 / 101 |
| `wvListHTML` / `pvListHTML` | 86 % | 14 / 14 |
| `wvCreateDevice` / `pvCreateDevice` | 68 % | 7 / 6 |
| `wvStartPath` / `pvStartPath` | 75 % | 3 / 4 |

**≈316 lines of near-duplicate**, and every future editor feature must be written twice or it silently works in only one of them. I already had to retrofit a shared session layer (`edCur`, `edRender`) after the fact.

**Fix:** a wall elevation and the three plan planes (padló / álmennyezet / mennyezet) are the *same abstraction*: **a projection of the model onto a surface, filtered by a band, with a local 2D coordinate system.** One `SurfaceEditor(projection)` where the projection supplies `{toLocal, fromLocal, band, contextGeometry, caption, keyPrefix}`. Roof planes and section views then cost almost nothing to add later.

### 2.5 Undo is a full deep clone of the project
`snap_()` does `JSON.parse(JSON.stringify(...))` of every collection plus all walls, on **every** mutation — 81 call sites, up to 80 global + 60 per editor session retained. With embedded lamp thumbnails in `data.devices`, each snapshot now carries base64 images.

**Fix:** command objects (`{do, undo, label}`) or at minimum structural sharing — snapshot only the collections a command touches. Bonus: a command log gives a free audit trail ("who moved this socket") and makes the editor save/discard trivial rather than a special case.

### 2.6 Rendering has no scheduler and no layers
232 direct `draw()` calls, each rebuilding the entire scene string from scratch — background, walls, floors, roofs, objects, devices, paths, guides, gizmos, ghosts. There is no dirty tracking, so dragging one socket re-serialises the whole house.

**Fix:** `invalidate('scene'|'overlay'|'ui')` + a rAF-coalesced renderer, and split the output into stable layers (`<g id="scene">`, `<g id="overlay">`) so drags only touch the overlay. This is the single change that buys the most headroom for bigger projects.

### 2.7 UI wiring is imperative and re-bound on every render
506 `$()` lookups, 125 `onclick=`, 71 `onchange=`, 33 `innerHTML=` rewrites. Each editor re-renders by rewriting `modalEl.innerHTML` then re-binding every handler — which is exactly why the sub-dialog bug (`openModal` closing the whole editor) existed and why `bindSegs()` has to be called from two places.

**Fix:** an **action registry**. Declare each capability once:
```js
{ id:'wall.props', label:'Fal tulajdonságai…', icon:'📐', when:sel=>sel.t==='wall',
  run:(ctx)=>…, shortcut:'W' }
```
Toolbars, context menus, the command palette and the keyboard map are then *generated* from one list. The 14 hand-built `ctxMenu` sites and the static toolbar HTML collapse into data.

### 2.8 Persistence is hand-maintained and has already drifted
`sessionObj()` enumerates what to save by hand. I found and fixed one case where room edits were silently not persisted (`B.rooms` was never written back). `DROPC` had to be added to four separate places (save, restore ×2, export).

**Fix:** one `serialize()/deserialize()` pair driven by the schema, with a round-trip test asserting `deserialize(serialize(doc))` deep-equals `doc`.

### 2.9 Magic numbers and domain constants are scattered
`10 mm` snap in 8 places, `68`/`72` box geometry, `120 mm` hit radius, `1500 mm` link search, `40 mm` guide snap, `250 mm` plenum, `0.2` fine factor. These are **domain decisions an electrician will want to change**, not implementation details.

**Fix:** a single `SETTINGS`/`STANDARDS` block at the top — and expose the professionally meaningful ones (box sizes, conduit diameters, chase depths, standard heights, IP by environment) in a **Beállítások / szabványok** panel, since they differ by country and by client.

### 2.10 No i18n seam
2 186 accented characters sit inline in the JS. Identifiers are English, UI strings are Hungarian, mixed in the same expressions. An English version, or even a consistent terminology pass, currently means editing 600+ string literals by hand.

**Fix:** `t('wall.props.title')` + one `hu` dictionary object. Cheap now; effectively impossible at 2×the size.

### 2.11 Remnants to delete
`pathDia()` alias · the `guideOn` Proxy legacy shim · `customG` (unused) · `data.circuits` (**0 references**) · `state.flat` declared twice in the state literal · `hDisp`/`labelRot` leftovers · 41 `window.__` test hooks that exist only because `const` tables aren't reachable from tests (they'd be exports in a module).

---

## 3. Proposed 1.0 architecture

**Distribution stays one file.** Development moves to a source tree plus a 20-line build script that concatenates in order and inlines CSS/HTML. This is the change that most directly serves your context-window goal: I read `src/editor/surface.js` (400 lines), not a 4 000-line wall.

```
src/
  00-standards.js      domain constants: box sizes, conduit ⌀, chase depths,
                       heights, IP by environment, wall presets, door types   (~250)
  01-schema.js         document shape, defaults, migrations, serialize/deserialize (~300)
  02-model.js          id allocation, CRUD, queries (devicesInRoom, pathsOnWall) (~400)
  03-geometry.js       projections, wall basis, polygons, chases, unions        (~450)
  04-commands.js       command objects + undo/redo + session (save/discard)     (~250)
  05-render/
     scene.js          3D/plan/blueprint assembly                              (~700)
     symbols.js        device, opening, note, chase symbols                    (~500)
     surface.js        ONE editor for wall + floor + álmennyezet + ceiling      (~600)
  06-actions.js        action registry (the single source for menus/keys)      (~350)
  07-ui/
     shell.js          layout, stage rail, inspector, palette, status bar      (~600)
     inspector.js      generated property panels from schema                   (~400)
     panels.js         BOM, circuits, documentation                            (~400)
  08-io.js             projects, localStorage, import/export, PNG/PDF          (~300)
  09-boot.js           wiring, defaults, first-run                             (~150)
tests/                 one spec per module, shared fixtures
docs/                  ARCHITECTURE.md · DECISIONS.md · FEATURES.md · CHANGELOG.md
build.js               → dist/domoszlo_planner.html (single file, unchanged UX)
```

### Migration order (each phase ships a working tool)

| Phase | Work | Risk | Verification |
|---|---|---|---|
| **0** | Golden-output tests: freeze current SVG for 6 fixture projects; stamp `VERSION` | none | new baseline |
| **1** | Split into `src/` + build script. **Zero behaviour change** | low | golden output byte-identical |
| **2** | Schema + ids + migration on load; refs become ids | medium | round-trip + old-file load tests |
| **3** | Unify the surface editors into one | medium | both editors' existing suites must pass unchanged |
| **4** | Commands + undo, render scheduler + layers | medium | perf benchmark: drag frame < 8 ms |
| **5** | Action registry → new UI shell | high (visual) | action coverage test: every action reachable |
| **6** | i18n extraction, docs, settings panel, 1.0 stamp | low | string-coverage test |

Phases 1–2 are the ones that pay for themselves immediately in development speed. Phase 5 is where the UI rework below lands.

---

## 4. Front end: a workflow-shaped UI

### The problem, stated plainly
20 collapsible groups, 73 buttons and 13 modes in one scrolling side panel, plus a growing amount of functionality reachable **only** by right-clicking the correct pixel. The panel is organised by *implementation category* (Tools, Layers, Build, Objects, View…), not by *what you are doing*. A new user cannot find the room data sheet, and an experienced one can't remember whether chase depth lives in the wall editor header or the section menu.

### Proposed shell

```
┌───────────────────────────────────────────────────────────────────────┐
│ project ▾   szint ▾   2D│3D│Terv   ⟲ ⟳   ● mentve      ⌘K keresés   ⚙ │
├──────┬──────────────────────────────────────────────┬─────────────────┤
│ ①    │                                              │  INSPECTOR      │
│ Épü- │                                              │  (selection)    │
│ let  │                                              │                 │
│ ②    │                CANVAS                        │  Fal            │
│ Helyi│                                              │  ├ méretek      │
│ ségek│         (split: plan | elevation)            │  ├ magasság     │
│ ③    │                                              │  ├ anyag        │
│ Kiosz│                                              │  └ véset        │
│ tás  │                                              │                 │
│ ④    │                                              │  [adatok] [BOM] │
│ Pá-  │                                              │                 │
│ lyák │                                              │                 │
│ ⑤    ├──────────────────────────────────────────────┴─────────────────┤
│ Doku │ 1100 mm · falhoz köt · finom ki · kijelölve: 3 elem · 4,2 m     │
└──────┴────────────────────────────────────────────────────────────────┘
```

**① Stage rail (left).** Five stages that mirror how the job actually proceeds:

1. **Épület** — walls, openings, floors, roofs, levels
2. **Helyiségek** — room polygons, data sheets, finishes, environment/IP
3. **Kiosztás** — devices, heights, boxes, the Space palette
4. **Pályák** — paths, circuits, chases, switch mapping
5. **Dokumentáció** — BOM, quote, blueprint, plots, exports

Selecting a stage sets a **context**: it pre-selects the relevant tools, turns on the layers that matter, dims the rest of the model, and shows the stage's own checklist ("3 helyiség nincs elnevezve", "2 lámpa nincs áramkörhöz kötve"). This is where the tool starts *guiding* the planning process instead of just hosting features.

**② Inspector (right).** This is the biggest single win. Today, wall properties, room sheet, lamp sheet, note editor, door type, chase settings, device definition and clip are **eight separate modal dialogs**. They become one context-sensitive panel with collapsible sections, generated from the schema, editing live with no OK/Cancel round-trip. Modals are then reserved for genuinely modal operations (open project, export, destructive confirmations).

**③ Command palette (Ctrl/⌘K).** With 415 functions and growing, this is how "every vector of feature accessible if needed" is satisfied without a wall of buttons. Type "véset", "pengefal", "álmennyezet", "kereszt" → the action runs, and the palette teaches the shortcut. It also gives you a place to put rarely-used things without cluttering anything.

**④ Status bar.** Active drawing height, snap mode, fine mode, layer, selection summary, live length/area. Currently these are scattered across a HUD line and per-editor headers.

**⑤ Surface editors become dockable panes,** not full-screen modals. Split the canvas: plan on the left, wall elevation or ceiling plane on the right, both live. This is the natural home for the work already done — and the moment they stop being modals, the save/discard session model can relax into normal undo.

**⑥ Interaction grammar, documented in-app.** Codify what already exists and apply it everywhere:

| input | meaning |
|---|---|
| LMB | select / draw |
| RMB | context actions for what's under the cursor |
| Space | place current palette item |
| ←/→ | cycle palette or variant |
| ↑/↓ | height line |
| Alt | fine (1 mm) |
| Shift | constrain axis *(to add)* |
| Ctrl | snap override / other wall face |
| double-click | edit properties |
| Esc | cancel / step out |

**⑦ Visual language.** One accent colour for interaction; semantic colour reserved for domain meaning (circuits, chases, planes, note kinds) — currently interaction blue and domain blue are the same blue. A single type scale. Minimum 44 px touch targets in the existing mobile mode.

---

## 5. Prompting: how to get more out of each turn

### What you already do well — keep doing it
- **Domain corrections with reasoning.** The switch-numbering message (103 = háromfázisú, 104 = phased-out hotel type, plus "check the Valena serials") was the single highest-value input in the whole batch. It corrected a wrong table *and* gave me a verification route.
- **Intent over implementation.** "Álmennyezet option", "so the visual transition is easier" tells me the *why*, which is what lets me make the dozen small decisions you'd otherwise have to specify.
- **Explicit permission to fill gaps** ("get creative but functional and professional"). That's what produced the riser markers, the IP table and the chase summary.
- **"Take it apart for correct integration."** Asking for sequencing rather than a dump.

### What costs you output quality
- **Large heterogeneous batches.** Eleven unrelated items in one message means I spend a turn on decomposition, and no single turn can finish. Two of those turns were interrupted mid-work by context limits, and the recovery cost real time (once I nearly re-implemented work that was already on disk).
- **No acceptance criteria.** I invent the tests. They're good tests of what *I* built — they cannot check it matches what *you* pictured. "Done when I can drag a door's hinge side and see it flip in the blueprint" is worth ten of my assertions.
- **No priority or effort signal.** I default to thorough. Sometimes you want a rough spike in one turn instead.
- **Untested shipping.** Nine suites pass, but nothing has been confirmed in a real browser: pointer capture, fullscreen sizing, keyboard focus, the hover popup, file upload, canvas downscaling. Every unverified layer raises the cost of the next one.

### A prompt template that would pay for itself
```
GOAL      one sentence, in workflow terms
WHY       where it sits in the planning process
MUST      2–4 concrete requirements
NICE      optional, explicitly droppable
DON'T     what to leave alone
DONE WHEN one or two things you will click to check
SIZE      spike | feature | tranche
```
Real example:
```
GOAL  Mark on the plan where a path leaves the current plane.
WHY   When I plan the ceiling I can't see where drops go down to switches.
MUST  symbol at the exit point; the other end's height in mm; works in all planes
NICE  colour by direction
DON'T touch the chase layer
DONE  open the ceiling plane on Nappali and see ⊙↓1100 at the switch drop
SIZE  feature
```

### Process changes that would raise the ceiling
1. **Ask for a plan first on anything above "feature" size**: *"plan only, no code"* → you approve or reorder → I execute. Cheap, and it catches misread intent before 300 lines exist.
2. **One tranche per message** (1–3 related items). You'll get finished, tested work every time instead of a half-finished batch.
3. **Browser test reports in a fixed shape**: what you did → what you expected → what happened. Three lines beats a paragraph.
4. **Say when a domain fact is a fact.** "In Hungary chase depth is 30/35 mm" is worth more than any amount of my inference, and I can't tell your certainty from phrasing alone.

### Setup changes — this is where your context-window goal is actually solved
1. **Split the source** (Phase 1 above). Then "add X to the lamp sheet" means reading one 400-line file, not 4 000 lines. This is the change with the largest effect on future turn quality.
2. **Move the project's memory into the project.** `docs/ARCHITECTURE.md` (module map + invariants), `docs/DECISIONS.md` (why chases merge, why ids not indices), `docs/FEATURES.md` (what exists, one line each), `CHANGELOG.md`. These live in your repo, survive any model or tool, and I can read *only the relevant section* on demand. My own memory then holds pointers and conventions, not narratives — which is exactly the "walls of text" problem you named.
3. **Keep the test harness in-repo** with a one-line runner and a `TESTS.md` index, so "run the suite" is a single command rather than reconstructed context.
4. **Version and stamp every build** (`1.0.0-rc.3` in the title bar), so bug reports are unambiguous.
5. **Ask for idempotent patches and a diff summary** each turn — you can then see what changed without reading code.

---

## 6. Recommended immediate sequence

1. **Browser verification pass** on what exists. Nothing else should be built on nine unverified layers. One session, structured report.
2. **Phase 0 + 1**: golden tests, then the source split with byte-identical output. Two or three turns, near-zero risk, and everything after it gets cheaper.
3. **Phase 2**: schema, ids, migrations. Removes the bug class that has already cost repair code.
4. **Phase 3**: unify the surface editors. Deletes ~300 duplicate lines and makes the roof/section editors nearly free later.
5. Then the UI shell — by which point the action registry makes it a presentation change rather than a rewrite.

The honest summary: the **domain layer is 1.0-worthy already**; the **plumbing around it is a prototype** that has been extended eleven times. The refactor is not about rewriting what the tool knows — it's about giving that knowledge a structure that can hold the next fifty features without each one costing more than the last.
