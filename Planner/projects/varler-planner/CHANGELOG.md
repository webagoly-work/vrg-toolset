# Changelog

## 1.0.0 — the coherent foundation
Phase 6, and the end of the refactor. Everything built before this is now standing on a structure
that can absorb the next fifty features.

- **Translation seam.** `t(key, hu)` with hu/en dictionaries and a language switch. The fallback is
  always the Hungarian original, so the interface can be translated one string at a time without
  ever showing a key. The stage rail, inspector, status bar and palette chrome already follow the
  language; the rest is a one-line change each.
- **Standards panel** (`⌘,` or the palette): chase factor with the resulting widths, box pad and
  pocket depth, szerelvénydoboz and clip spacing, board mounting height, drop-ceiling plenum, the
  standard height table, IP by environment, and the wall presets — the numbers the drawing and the
  bill of materials are built from, in one place instead of buried in the source.
- Board mounting height and the plenum default are now settings rather than constants.
- **828 assertions across 17 suites, 70 golden renders.**

### What 1.0 means
| | |
|---|---|
| Distribution | one self-contained HTML file, offline, no toolchain |
| Source | 18 modules built by a 60-line script |
| Model | versioned schema, stable ids, migrations, derived connectivity, validation |
| Editors | one surface layer, two projections (wall elevation, three plan planes) |
| Rendering | two layers, repaint only what changed — idle redraw 117 ms → 5 ms |
| History | scoped snapshots — a node drag stores 7 KB, not 168 KB |
| UI | action registry driving a ⌘K palette, a stage rail, an inspector and the keyboard |
| Tests | 828 assertions + 70 golden renders, one command |

## 0.9.7 — Phase 5b: the workflow shell
- **A stage rail** down the left side: Épület → Helyiségek → Kiosztás → Pályák → Dokumentáció, the order the job actually happens in. Each stage shows its own checklist — unnamed rooms, devices without a jelölés, lamps with no adatlap, devices not linked to a path, validation errors — and carries a badge when something needs attention.
- **A contextual inspector** on the right: what you have selected, a few fields you can edit in place (wall thickness/length/height/start, device ref and height, room name/number/ceiling, opening sizes, object dimensions), and every action that applies to it. Deeper sheets still open their dialog, so each property sheet exists once.
- Both panels are **generated from the action registry** — a new action shows up without touching the shell. `state.shell = false` hides them; the old side panel is untouched.
- **Bug found by the new tests:** `applySnap` rebuilds every wall object, so after an undo the selection still pointed at an orphaned rectangle and the gizmo edited nothing. Walls now carry ids and `reselectAfterSnap()` re-resolves the selection after every restore.
- Fixed four actions that referenced button ids that don't exist (PNG, print, export, save).

## 0.9.6 — Phase 5a: action registry, command palette, status bar
- **Every capability is now declared once** in an action registry — 59 actions across nine groups, each with a label, a group, an explanation and a gate that says when it applies.
- **⌘K / Ctrl+K opens a command palette.** Search folds Hungarian accents (`veset` finds `Véset`), accepts English aliases (`undo`, `bom`, `print`), and ranks by where the match landed, so an action named after a word beats one that merely mentions it. Actions you can't run right now are listed dimmed with the reason — that is how you discover a feature exists.
- **The keyboard map is generated from the registry**: V/M/W/B/D/P/C for the tools, Ctrl+K, Ctrl+S, Ctrl+P, and the shortcuts show up in the palette. Tool keys go dead while an editor is open, because the editor owns the keyboard.
- **A status bar** along the bottom reports mode, level, drawing height and guide, wall-snap state, fine mode, the open editor and its dirty flag, selection count, and any validation errors or warnings.
- New action: **Ellenőrzés** lists every issue `validate()` finds.
- All 70 golden renders unchanged.

## 0.9.5 — Phase 4: layered rendering and scoped history
- **The viewport is split into a scene layer and an overlay layer**, each repainted only when its own content changed. Measured at 120 devices and 60 paths: an idle redraw went **117 ms → 5 ms**, and moving a selection marquee, hovering a wall or dragging the gizmo now costs **~4 ms** instead of a full re-parse.
- `updateTotals()` no longer recomputes on camera moves and hovers — only when the drawing actually changed.
- `drawSoon()` coalesces redraws to one per animation frame; the 18 pointermove call sites use it.
- **Undo snapshots are scoped.** A path-node drag stores 7 KB where a full snapshot is 168 KB, because it can't touch devices, lamp photos or walls. Each entry remembers its scope and restores exactly that.
- Every drawing render is byte-identical to 0.9.4.

## 0.9.4 — Phase 3a: one editor surface
- **The two editors now share one pointer layer.** Dragging, section drag, warp, path drawing, note editing, soft re-render and context-menu routing exist once, in `05b-editor-core.js`, driven by a projection descriptor. The wall elevation and the plan planes are two projections of the same editor.
- Behaviour that only one editor had is now in both: rAF-throttled soft rendering, note double-click to edit, note right-click menu, live drag badge.
- `edMount()` gives the editor a mount target instead of reaching for the global modal — the groundwork for opening an editor in its own window.
- Shared hit-testing (`edHitDevice`, `edHitSection`) replaces two near-identical copies.
- All 70 golden renders unchanged.

## 0.9.3 — Phase 2: document schema
- **Every record now has a stable id** (`D7`, `P3`, node `n12`), issued from a per-document counter that never reuses a number.
- **Cross-references are ids, not array indices.** `dev.link={p,n}` resolves through `linkTarget()`, which returns null when either end is gone — so deleting a path can no longer repoint somebody else's reference at a different object. The old index-repair code is gone.
- **Migrations.** `data.v` is the schema version and `migrate()` upgrades older files on load, converting v0 index links to id links while the indices are still meaningful.
- **Connectivity seam** — `connectivity()` derives terminals and segments (node ids, conduit ⌀, length, circuit) from the geometry. Nothing is stored; this is what the Rendezés editor will read.
- **Validation seam** — `validate()` returns issues with severity, code and reference: dangling link, stub path, section-count mismatch, duplicate id, unknown level.
- **Background image can be positioned** (the last open verification bug): the settings dialog now applies live as you type, with X/Y offset, width with kept aspect, rotation, a +90° button, fit-to-drawing, and cancel restores. It is also reachable from the room menu.
- All 64 drawing renders stayed byte-identical through the schema change — only the 6 serialised-project hashes moved, by design.

## 0.9.2 — browser verification round 2
- **Esc no longer discards an editing session.** It steps out one level at a time; closing is only via Mentés / Elvetés.
- **New projects are genuinely empty.** The old clearing code listed five collections by hand; paths, floors, objects, roofs and notes survived into new projects, and the autosave still held the previous one. `hardResetWorkspace()` now clears everything, and undo cannot step into a previous project.
- **Plane editor drags work.** The soft re-render was replacing the `<svg>` that held the pointer capture.
- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y in the main planner.
- Lamp data sheet reachable from the device right-click (it was on the wrong menu branch).
- Bigger riser markers; colour and opacity for the álmennyezet plane.
- New door type: garázskapu (felhúzható redőny).
- Notes can be hidden per wall and per plane, from the editors and from the right-click menus.

## 0.9.1 — browser verification round 1
- Context menu is viewport-fixed, appears above the editor modals and flips at screen edges.
- Floor right-click opens the full room menu instead of a Delete-only stub.
- **Action rail** in both editors: every right-click option also exists as a button.
- Behind-the-wall detection rewritten — face normals plus real occlusion; one wall is enough.
- Raised walls and podiums are marked in the 2D top view.
- Fullscreen actually enlarges the drawing; number inputs release the arrow keys; Alt fine mode survives mid-drag and has an F alias and a lock button.
- Resize handles are single-axis; the floating height display carries the Space item and a size swatch.
- Doors and windows lock to the wall centreline; new "Túloldal nézet" button.

## 0.9.0 — baseline
Everything built before verification began: elevation editor, floor/ceiling/álmennyezet plane editor, chase model with quote summaries, room data sheets, notes, lamps with generated objects, wall properties, door types, placement palette, Z axis on walls/floors/openings.
