# Decisions

Why things are the way they are, so nobody "fixes" them back.

---

### The product is one HTML file

No toolchain, no server, works offline, can be emailed or opened from a USB stick on site. That is a feature, not a limitation. Development happens in `src/`, but `dist/varler_planner.html` must always remain a single self-contained file.

### The split was done as pure text, in place

Phase 1 reordered nothing. The first build was byte-identical to the file it replaced, proven by `node build.js --check`. Reordering top-level `const`/`let` across modules can break startup silently, so purity was the whole point of the exercise. Real module boundaries with exports come with the schema work, when the tests can catch the difference.

### Chases merge with `clipPath`, not `mask`

`clipPath` children union by specification, and support is far better. `mask` was tried first and silently ignored by an exporter. The union *outline* is computed by sampling each polygon edge and dropping the pieces that fall inside another chase — a real polygon-union library would be heavier than the problem deserves.

### Haloed text is drawn twice

`paint-order="stroke"` is not honoured by every renderer; where it isn't, the white halo covers the fill and the text disappears. So halo text is a stroke pass followed by a fill pass. Verified in a browser: worth keeping.

### Fine mode damps the pointer, not the drags

Holding Alt (or F) scales the *client point* by 0.2 before anything else sees it. Every drag, ghost and snap inherits slow movement for free, instead of 30 drag handlers each needing their own fine-mode branch.

### One surface layer, many projections

The pointer/drag/warp/menu code existed twice, and the two copies had already drifted: the wall
editor had rAF-throttled soft rendering and note dblclick, the plane editor didn't. Rather than
copy the missing halves across, both now call one `edBindSurface` and supply a projection
descriptor. The drawing stays per-surface — that is what a projection *is* — but nothing else does.

The test that keeps this honest: `startDrag` may be defined exactly once in the built file.

### Editors are a shared session, not two implementations

`edCur()` returns whichever editor is open; push/undo/close/modal all act on it. Menus are built by `*Items()` functions that feed both the right-click menu and the right-hand action rail, so an option can never exist in one and not the other. This is a small preview of the action registry the UI phase will introduce.

### `Esc` never discards

It steps out one level: finish path → clear warp → clear selection → leave fullscreen → nothing. Closing an editor is only via Mentés / Elvetés. The old behaviour silently threw away a whole editing session and was reported as "Esc reverts my finished paths".

### Clearing the workspace clears *everything*

`hardResetWorkspace()` exists because the old clearing code listed five collections by hand, and the list never grew as features did. Paths, floors, objects, roofs and notes survived into new projects. Any new collection must be added to `UKEYS`, which drives undo, save and clearing together.

### Behind-the-wall detection uses face normals, not depth comparison

A device is drawn as "behind" when its mounting face points away from the camera, plus a segment-versus-rectangle test against every other wall. The old depth comparison flickered when a wall was near edge-on, and treated the two faces of one wall as two blockers that cancelled out. One wall is enough; several must not cancel.

### Never replace an `<svg>` element during a drag

It holds the pointer capture. Replacing it kills the drag the moment the cursor leaves the element, and the browser starts selecting text instead. Replace the children. This bug appeared twice, once per editor.

### Supplier codes are not part of the catalogue

Type designation, cores, mm², RE/RM and outer diameter are universal; `gyártói cikkszám` differs between distributors for the same cable. Hard-coding one supplier's SKU would make every BOM silently point at one webshop. Supplier codes belong in a per-distributor mapping the user fills.

### The translation fallback is the Hungarian text, not the key

`t('insp.wall','Fal')` returns 'Fal' when there is no translation. The alternative — falling back to
the key — turns every un-translated string into `insp.wall` on screen, which makes partial
translation unusable and therefore makes nobody start. This way the seam can be introduced one
literal at a time with no visible intermediate state.

### The palette shows disabled actions

The first version filtered the palette to what was currently possible, which is tidy and wrong: if
"Lámpa adatlap" only exists after you've selected a lamp, nobody discovers it. Disabled entries are
listed dimmed with a `need` line saying what to select. The palette is the index of the program,
not a menu of the moment.

### Search ranks by field, not by one blob of text

Concatenating label + group + hint and scoring that made "lámpa" rank the *device tool* first,
because its hint mentions lamps. Each field is scored separately and weighted — name 1.0, alias
0.95, group 0.7, hint 0.6 — so the action named after a word wins. Matching folds Hungarian accents
and accepts English aliases; those aliases are also the first foothold for the EN translation.

### Two layers, not a virtual DOM

The measurement that decided this: at 120 devices a full redraw was ~117 ms, of which ~107 ms was
the browser parsing the SVG string, not JavaScript building it. So the fix isn't faster string
building — it's assigning less often. Scene and overlay are separate `<g>` elements, each
re-assigned only when its own string changed. No diffing, no framework, no per-node bookkeeping:
two string comparisons per frame.

The boundary matters more than the mechanism. My first attempt split at `drawGuides()`, which put
devices, paths and labels in the *overlay* — the overlay came out at 58 KB and the scene at 4 KB,
and nothing got faster. The real boundary is where transient chrome begins: rubber bands, ghosts,
gizmo, marquee, drag badges.

### Undo is scoped to what a command can touch

A full snapshot deep-clones every collection, including base64 lamp photos. Dragging a path node
cannot possibly change a device, so it snapshots `['paths']` — 7 KB instead of 168 KB in a project
with photos. The entry carries its own scope so restoring it touches only those collections; a
plain `pushUndo()` still captures everything. This is the cheap half of a command system: the
scope is the honest declaration of what a command writes.

### Ids are counter-issued, not random

`data.seq` is a per-document counter; ids read `D7`, `P3`, `n12`. Random or time-based ids would have made the golden test useless — every run would hash differently — and they are harder to talk about in a bug report. The counter only moves forward, including across undo, so an id is never reused and a stale reference can never silently rebind to a new record.

### The connectivity graph is derived, never stored

`connectivity()` computes terminals and segments from the geometry on demand. Storing it would create a second source of truth that has to be kept in sync with every drag. When the 1.1 occupancy layer arrives, *runs* (wires pulled through an ordered list of segments) will be stored, because they are not derivable — but the graph they sit on stays derived.

### Backtracking is an occupancy rule, not a geometry rule

Retracing an existing run adds no new geometry; it adds wires to the run that is already there. One conduit carrying more wires, not two conduits. This is why occupancy has to be modelled separately from the drawn polyline.

### Validation lives in one function

`validate()` returns issues with a severity, a code and a reference. Rules go there, never inline in the UI, so the same check can drive a sidebar list, a printed report and a test.

### Known weakness: `draw()` has no scheduler

232 call sites, full scene rebuild each time, ~90 ms at 120 devices, running on every pointermove during a drag. The fix is layers plus a rAF-coalesced `invalidate()`, planned but not done. Don't add work inside `draw()` without measuring.

### The blueprint is drawn in paper millimetres, at a scale

Line weights and text used to be set in screen units: a wall outline came out ~27 mm thick on the
building and a room label ~255 mm tall, so nothing next to them could read as being to scale — the
plan looked like a sketch no matter how carefully it was drawn. The blueprint now has a drawing
scale (`state.bpScale`, default M 1:50) and every weight and text size is a **paper** millimetre
converted through it (`bpSW`/`bpFS`/`bpG`), ISO pens: 0.5 wall, 0.35 general, 0.25 thin, 0.13 hatch.
`state.bpFine` multiplies on top, because screen and paper do not read the same and that is taste,
not standard. Model-space constants tuned at 1:50 (tick length, dimension offsets) go through
`bpG()` so they stay paper-constant when the scale changes. Only the blueprint works this way; the
normal and whiteout views keep their screen-space weights, which is what makes them readable while
modelling.

### Merging walls is a rendering decision, never a stored one

Walls overlap at every corner and butt end to end along a run, so drawing each rectangle's own
outline leaves the seams that make a finished plan look chopped up. `rectsUnionSegs()` keeps only
the edge pieces whose *outside* is not inside another wall, and the body is filled first with no
outline of its own — so the contour is drawn once, around the union, and corners close symmetrically.
Nothing is merged in the data: the walls stay separate records, individually selectable, editable
and deletable, and a plan that is merged on screen still has the same nine walls underneath. In 3D
the same rule culls faces buried inside another wall. The blueprint always merges (an official plan
has no seams); other views get a toggle, because while modelling it helps to see where one wall ends.

### A floor is a polygon, and the enclosed-room fill stops at the inner faces

The floor tool draws point after point with a live Terület/Kerület and closes on its first point —
the measure-tool gesture people already know — instead of the old two-click rectangle, which could
not describe an L-shaped room at all. The one-click fill floods the cell grid cut by the wall edges
from the clicked point: if the flood reaches the margin ring the space is not closed and it refuses
rather than laying a floor over half the drawing. The outline it returns follows the **inner faces**
of the walls, so the area is the net floor area of the room. (`createRoom` still frames its walls on
the outline it is given, which is a centreline; the two conventions differ by half a wall on each
side and the fill is the one that matches what a floor covering actually costs.)

### An alternative input device drives the adapters, not the handlers

`PLANNER_INPUT` *replays* — `press()` dispatches a real `pointerdown` on the stage, `heightStep()`
dispatches a real `ArrowUp`. It does not call the placement, snapping or drag code directly.

That looks indirect until you count what the direct version would cost: the stage's pointer
handlers are ~200 lines of mode-specific placement and snapping, and the keyboard handler already
decides, per mode, whether `ArrowUp` means "step the drawing height" or "tilt the camera". Calling
past all that means writing a second copy of it, and a second copy is a thing that drifts. The
precedent was already set by `camUndo()`, which dispatches Ctrl+Z rather than calling `doUndo()`,
precisely so it inherits the "an editor owns its own history" check.

Two things fall out of it for free, and they are the reason the gamepad module is as small as it
is: mapping A to `pointerdown`/`pointerup` rather than to "place an item" makes **click, drag and
gizmo-drag all work with no controller-specific code at all**; and the D-pad becomes exactly the
arrow keys, which is also the one rule a new user has to learn.

### The free cursor and the fixed reticle are one mechanism

A thumb cursor and a centre reticle look like two modes, and building them as two modes means two
sets of edge cases. They are the same thing with one number: the cursor roams inside a box centred
on the stage and pushing past the edge drags the camera; a box of `0` collapses to a reticle pinned
at screen centre with the world moving under it. Selection modes use `0.55`, drawing modes `0`.

Both numbers are settings, so "which model do I prefer" is a slider rather than a rewrite — and
there is no second code path to keep working.

### The controller cannot be precise, and does not need to be

`cableSnap()` and `wallPointSnap()` already snap to walls, nodes and the standard height table. The
stick only has to get close. Sticky targeting is layered on top for selection: pressing A with
nothing directly under the reticle hit-tests a ring around it and clicks the nearest target instead.

It runs **on press, not per frame** — a per-frame magnetic pull costs a hit-test sweep every 16 ms
and, worse, makes the cursor feel like it is fighting your thumb. A low-rate scan tints the reticle
instead, so the stickiness is visible before you commit to it. Radius `0` turns it off.

### Controller settings live outside `state`

`sessionObj()` serialises the whole `state` object into every saved project. A per-PC input
preference has no business travelling inside a client's plan file and reappearing on someone else's
machine, so the controller config has its own `localStorage` key — the same reasoning that keeps
`villanyterv_mobile` out of the document, applied consistently.

### Controller mode is switched on by hand

Chrome does not expose a pad until a button is pressed, so "plug it in and it lights up" was never
on offer — `gamepadconnected` fires on the first press, not on the plug. Given that, auto-enabling
would mean an app that changes how it behaves because something got nudged on the desk. A detected
pad puts a line in the HUD saying how to turn it on, and stops there.

### The wheel's top ring does not move, and its sub-rings grey things out

Two instincts fight here. A radial menu *feels* like it should be contextual — show me what I can
do right now. But muscle memory is most of what makes a controller fast, and muscle memory cannot
learn a ring whose sectors swap places between openings. So the top ring is built from every
registered group in a fixed canonical order and is identical in every context.

The sub-rings then follow the registry's existing rule and show everything in the group, greying out
what cannot run right now, with A on a greyed entry reporting its `need` instead of swallowing the
press. Hiding them would make the wheel contextual again by the back door.

The honest cost: eight sectors of twelve is not every action. That is fine, because the wheel is the
*speed* surface and ⌘K is the complete one — but two things keep it from becoming a lie. Every
action is still assigned to a sector, so nothing is silently unclassified (a test asserts
`sum(sector.full) === ACTIONS.length` in both wheel modes), and when a ring overflows it fills with
the runnable entries first, so a cut can never cost you something you could have run.

`Szerkesztő` deliberately has no sector: those actions exist only while an editor is open, and while
an editor is open the driver stands down entirely. Giving them a slice would push a useful group
over the cap to buy nothing.
