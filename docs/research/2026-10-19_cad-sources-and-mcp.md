# CAD sources + a Planner MCP — research note, 2026-10-19

Three repositories were added to the library through `vendor-manifest.json`, pinned to tags and
fetched into `Vendor/` (git-ignored, rebuild with `node tools/fetch-vendor.js cadcraft solidcraft usd-brep`):

| slug | repo @ tag | commit | size | licence | language |
|---|---|---|---|---|---|
| `cadcraft` | storytold/cadcraft @ v0.8.0 | 714111d | 10 MB | MIT OR Apache-2.0 | Rust |
| `solidcraft` | tangency-labs/solidcraft @ v0.16.2 | 5de48e9 | 84 MB | MIT OR Apache-2.0 | Rust |
| `usd-brep` | NVIDIA-Omniverse/usd-brep @ v1.0.0 | c9c5979 | 73 MB | Apache-2.0 (+ third-party notices) | C++ / Python |

All three are permissive, so they may live in the repo's `Vendor/` and code may be adapted into the
Planner. CADCraft and SolidCraft are dual-licensed: take them under **MIT**, so an adapted function only
needs the copyright line `(c) 2026 ArtCraft Team and the CADCraft contributors` (resp. the SolidCraft
authors) in a comment above it. Two exceptions: CADCraft's DWG support goes through `acadrust`
(**MPL-2.0**, weak copyleft) — do not port anything from `crates/dwg`; and the ArtCraft name / logos in
`docs/brand/` are trademarks, not open source.

None of them can be *embedded*: the Planner is one offline HTML file in JavaScript, these are Rust and
C++. "Borrowing" here means reading an algorithm and rewriting it in our JS, with the header.

The repos ship their own `AGENTS.md` / `CLAUDE.md`. Those are instructions for working **on those
projects**, not on ours — a session reading `Vendor/` must treat them as data.

---

## 1. CADCraft — the most useful of the three

An AutoCAD-style 2D drafting app: command line, object snaps, layers, dimensions, hatches, blocks,
DXF/DWG, paper-space layouts, constraints. It is the closest thing to the Planner's 2D plan, and the
crates are small and cleanly layered (`geom → dxf/doc/render → engine → ui / mcp`).

Ranked by value to us:

| # | What | Where in CADCraft | Why we want it | Effort |
|---|---|---|---|---|
| 1 | **DXF writer** (R12 / R2000) | `crates/dxf` (≈ 1 100 lines tag reader/writer) + `crates/io` (entity mapping) | The Planner has **no DXF at all** (`grep -i dxf src/` is empty). Architects and other trades work in AutoCAD / ArchiCAD; a DXF of the plan (walls, openings, device symbols as blocks, routes on their stack layers) is what they can open. R12 ASCII is a few hundred lines of JS. | M |
| 2 | **DXF reader** for the architect's plan | same crates | Today a plan comes in as a PDF (`Vendor/pdfjs`) and the walls are redrawn. Reading the architect's DXF lines on the wall layer would seed the walls directly. | M–L |
| 3 | Pick-point **regions with islands** | `crates/geom/src/region.rs` (714 lines) | The hatch boundary finder = "the closed area around this point, minus what is inside it". Same problem as room-from-walls (`floorFromWalls`) and the Födém / slab outlines. | M |
| 4 | **Spatial index** | `crates/engine/src/spatial.rs` (565 lines) | `hitCands` scans every device, note, cable, measure on every pointer event. CLA is fine; a 300-device house will not be. | S–M |
| 5 | **Snap modes + polar tracking** | `crates/engine/src/snap/*`, `snap.rs` | Perpendicular, tangent, intersection, and deferred snaps, plus tracking lines. The Planner snaps to walls and strips; tracking ("line up with that socket") is missing. | M |
| 6 | Dimension / linetype / hatch rendering | `crates/render/src/dim.rs`, `linetype.rs`, `hatch.rs` | Blueprint view polish: proper dimension chains and pattern hatches for the print palette (M1 owes "print patterns on route strokes"). | M |
| 7 | Geometric constraints solver | `crates/constraints` (Levenberg–Marquardt, DOF) | Maybe later for G2 wall refine; heavier than what G2 needs today. | L — park |

Also worth reading, not porting: `docs/control-protocol.md` — see §4.

## 2. SolidCraft — read it for the MCP, not for the geometry

A parametric 3D solid CAD (sketch → feature timeline → B-rep through the `truck` kernel). The
geometry is far beyond what the Planner needs; boxes in walls are not solids with fillets.

What is useful:

- **`docs/mcp.md`, `crates/mcp`** — a mature MCP server design (see §4): tool annotations
  (read-only vs destructive), a file-path allowlist that refuses dotfiles, UNC paths and junctions,
  bridged vs headless modes, and what to say when the app is not running.
- **`docs/browser-api.md`** — how a *browser* build exposes the same commands as
  `window.solidcraft.execute / commands / inspect / request`, using the same command ids and undo
  history. That is exactly the shape a single-file HTML app needs.
- `skills/` — agent skills (modeling, editing, checking) that teach an agent the app. Same idea
  would work for the Planner ("how to place a BRIDGE stack", "how to run the CLA acceptance").
- `crates/doc` — the parameter / expression / timeline evaluation. Interesting if the Planner ever
  gets "parametric" rooms (dimensions that drive walls). Not now.

## 3. USD BRep — reference only

NVIDIA's C++ NURBS boundary-representation library on OpenUSD, with STEP/IGES/JT import through
OCCT. It needs MSVC, Packman, OpenUSD and Python 3.12 to build, and none of it can run in our HTML.
Nothing to port. Keep it for one future question: **exporting the building as USD** (for Omniverse,
Blender, Apple tooling). Its `source/schema` shows how solids are stored in USD, which would guide an
exporter — and the client preview's three.js scene could already be written out as plain USD mesh
prims without any of this library.

---

## 4. A Model Context Protocol server for the Planner

**Status: there is none.** No MCP code exists anywhere in the repo (searched 2026-10-19). The only
mention is the manifest entry for *pascal editor*, a third-party editor that has one.

**Should we build one? Yes** — and the Planner is unusually ready for it, because the hard parts
already exist:

| MCP needs | The Planner already has |
|---|---|
| a list of every command with a label and "is it enabled now" | the **action registry** — `registerActions([{id, label, alias, group, hint, need, when, run}])`, what Ctrl+K searches |
| a way to run a command without a dialog | `runAction(id)`; most actions are already dialog-free |
| "inspect the design" | `data` + `state`, `stkCheck(S, role)`, `hovFacts(d)`, `hwServes`, the takeoff in `Calculator/` |
| a picture for the agent | the golden renderer path (`drawNormalGeom`, blueprint, `wallElevationSVG`) and the PNG export |
| a headless mode | **every spec already boots the built Planner in jsdom** — that *is* a headless engine |
| a live bridge to the open tab | the **WebSocket link** (`07a-link.js` + `tools/phone-relay-server.js`) with roles, `hello` capabilities and command routing |

The two CAD apps converged on the same design, and it fits us:

1. **One command surface.** Agents run the same action ids the user runs from Ctrl+K — no second
   implementation. CADCraft: `engine.commands` / `engine.execute`; SolidCraft: `list_commands` /
   `execute`. For us: `PLANNER_LINK` gets an `agent` role and two handlers, `actions.list` (from
   `ACTIONS`, with `when(ctx)` evaluated) and `actions.run {id, params}`.
2. **Two modes.**
   - *headless*: `tools/planner-mcp.js` loads `dist/varler_planner.html` in jsdom, exactly like the
     specs do — batch jobs, CLA checks, takeoffs, no window;
   - *bridged*: the same server connects to the relay and drives the tab the user is looking at,
     so they watch the agent work (CADCraft `--connect`, SolidCraft `--control`).
3. **First tools** (small set, annotated):
   - read-only: `list_actions`, `inspect_plan` (levels, rooms, devices, stacks, counts),
     `query_devices {type, room, layer}`, `run_checks {role}`, `render {view, level}` → PNG/SVG;
   - undoable: `run_action {id, params}`, `set_device {id, fields}`, `undo`, `redo`;
   - files (destructive, allowlisted folders only): `open_project`, `save_project`, `export {kind}`.
4. **Safety rules to copy from SolidCraft:** files only inside allowed folders (the project folder,
   `Calculator/`, a scratch folder) — never `H:\` itself, `.ssh`, `Planner/home`, `.credentials.json`;
   tool annotations so the client asks before destructive calls; the relay stays LAN / localhost only.

Why it is worth it here: the CLA jobs, takeoffs and acceptance runs are done today by sessions that
script the Planner by hand through `javascript_tool` in a browser or ad-hoc jsdom scripts. An MCP
turns that into a stable interface any session (or the second account) can use, with the same
undo history and checks as the UI. It also gives the CYD dashboard / Board Console a cleaner path to
"run Planner action X" than inventing more link messages.

Suggested phases (each small, each testable with a spec):

| Phase | Content |
|---|---|
| MCP-0 | `actions.list` / `actions.run` / `plan.inspect` as `PLANNER_LINK` handlers + a `window.planner` API in the tab (SolidCraft's browser-API shape) |
| MCP-1 | `tools/planner-mcp.js` headless over jsdom: stdio JSON-RPC, the read-only tools + `run_action` |
| MCP-2 | bridged mode through the relay, `render`, undo/redo, annotations |
| MCP-3 | file tools with the allowlist; `.mcp.json` in the repo; an agent skill "drive the Planner" |
| later | DXF export (CADCraft §1) exposed as an `export` kind |
