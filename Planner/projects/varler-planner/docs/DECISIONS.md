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
