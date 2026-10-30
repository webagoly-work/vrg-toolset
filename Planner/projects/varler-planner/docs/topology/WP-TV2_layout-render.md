# WP-TV2: Layout and render (the Pályák and Betáp-fa tabs)

Status: todo · Wave A · Depends: TV1 · Size: M (~200 lines) · Spec: next free · Decisions: Q-TV12 · **⏸ after build**

## Goal
*"A simplified Topology View can be opened, showing every element connected by one common, empty pathway, showing from
left to right and up-to-down the devices upstream, mid, and downstream."*

## Read
- README §2–§3
- `fig/02`, `fig/08`, `fig/09`
- `01_RULES.md` §1
- `08od-wf-uptree.js`: `upRole` :35, `upState` :114, `upUnreached` :115, `UP_COL` :129, and the 🌳 overlay :130 (its
  dashed / solid / red code, to match)
- `05h-rooms.js` :45 `roomOfDevice`; `08od` :110 `upRoomOfDev`

## Build (`src/08tb-tpo-view.js`)
1. **`tpoLayout(G)`** (pure) returns `{nodes: Map id → {x, y, col, lane}, lanes:[{room, y0, y1, name}], w, h}`.
   - **Columns (Q-TV12 A):**
     - col 0 = the board;
     - mids (junctions, door L4s): col = 1 + their depth among mids along the `up` chain (a string's 2nd KD is one
       column further right); a mid with no `up` uses its hop depth on GP;
     - endpoints: col = 1 + the max mid column + their depth below their first mid / door / board on the `up` chain
       (leader = +0, then +1 …). With no `up`: + the GP hop depth from the nearest mid.
   - **Lanes:**
     - one per room (`upRoomOfDev`), ordered by a DFS of the board's shortest-path tree on GP;
     - a door L4 goes in the lane of the face it serves;
     - a mid serving several rooms (a string KD) goes in the room it stands in.
   - **Rows within a lane:**
     - by circuit ref (`cktOfDevice`), then the `up` order;
     - then one barycentre pass (the mean row of the upstream neighbour), a stable sort.
   - Deterministic.
2. **The Pályák tab:**
   - lanes as faint bands;
   - GP edges grey, styled by `surf`: dashed hatching for soft, a double line for előnyben;
   - the symbols from `fig/`, labelled `ref || id`;
   - unreachable anchors with a red ring and a stub.
3. **The Betáp-fa tab:**
   - GP faded to 25 %;
   - one line per `up` edge, child → parent, coloured by the circuit (`cktColor`);
   - **dashed** = javasolt, **solid** = rögzített, **red ring** = bekötetlen (`upState`, `UP_COL`);
   - a link whose walls cannot carry it (the last run's `treeBad` warnings, matched by `ids`) is drawn red with
     `nincs fizikai út`.
4. **Selection sync:**
   - a node click selects the device in the Planner (`selected = {t:'devices', i}` + `drawSoon()`);
   - the inspector shows ref, type, room, circuit, role (`upRole`), state, and the `up` target (`upName`);
   - a blueprint selection highlights the node.
5. **The mini-plan** in the inspector: the selected GP edge's `nodes` (or a `tpoPath`), drawn in the room outline at
   190 × 90. `Mutasd az alaprajzon` closes the view and rings the place with `blShow`.
6. **The checks bar:** `'<n> pont · <m> falszakasz · <k> nem érhető el · <j> javasolt / <r> rögzített betáp'`.

## Tests
1. The 2-room fixture: the board in col 0, the door L4 in col 1, the sockets in col ≥ 2; 2 lanes, the board's first.
2. A string board → KD1 → KD2: KD2's column = KD1's + 1.
3. Determinism: shuffling `data.devices` gives the same layout.
4. The render has one `<g data-id>` per anchor; in Betáp-fa, one `<path data-up>` per `up`, with `stroke-dasharray` for
   javasolt (computed style, not a screenshot; CLAUDE.md "Testing browser apps").
5. Golden identical.

**⏸ after build:** screenshots of the practice flat and a 4-room fixture, both tabs. The user judges the layout; adjust
the column and lane rules before TV9.
