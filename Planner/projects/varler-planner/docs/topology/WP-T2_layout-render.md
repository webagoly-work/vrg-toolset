# WP-T2: Layout and render (the Pályák tab)

Status: todo · Wave A · Depends: T1 · Size: M (~200 lines) · Spec: next free · Decisions: Q-T12 · **⏸ after build**

## Goal
*"A simplified Topology View can be opened, showing every element connected by one common, empty pathway, showing from
left to right and up-to-down the devices upstream, mid, and downstream."*

## Read
- README §3
- `fig/02`, `fig/08`
- `01_RULES.md` §1 (the symbols)
- `src/08p-tpo-graph.js` (T1)
- `05h-rooms.js` 45 (`roomOfDevice`)
- `10-lamps.js` 356 (`allRooms`)
- `05j` `cktColor`

## Build (`src/08pb-tpo-view.js`)
1. **`tpoLayout(G, topo?)`** returns `{nodes: Map id → {x, y, col, lane}, lanes: [{room, y0, y1, name}], w, h}`. It is a
   pure function.
   - **Columns (Q-T12 A):**
     - col 0 = the board;
     - mids: col = 1 + their depth among mids on the shortest-path tree from the board (a mid reached through another
       mid goes one column further right);
     - endpoints: col = 1 + the max mid column, + the chain position when a topology exists (T3). Before that, + the hop
       depth from the nearest mid.
   - **Lanes:**
     - one per room, in the order a DFS of the board's shortest-path tree first reaches them;
     - mids sit in the lane of the room they serve; a portal box belongs to the room behind the door, away from the
       board;
     - endpoints sit in their room's lane.
   - **Rows inside a lane:** by circuit ref when one exists, else by device id. Then one barycentre pass (each node's row
     = the mean row of its upstream neighbours, stable sort). That keeps it deterministic.
2. **`tpoRender()`, Pályák tab:**
   - the lanes as faint bands with the room name;
   - GP edges as grey lines (straight when the columns are adjacent, a cubic curve otherwise);
   - the symbols from `fig/` with labels = `ref || id`;
   - unreachable anchors outlined red, with a dashed stub.
3. **Selection sync.**
   - A click on a node runs the Planner's own selection of that device (`selected = {t:'devices', i}` + `drawSoon()`)
     and fills the inspector: ref, type, room, circuit, number of GP edges.
   - Selecting a device in the blueprint while the view is open highlights its node.
4. **Mini-plan** in the inspector: the selected edge's `nodes` drawn as a polyline in the room outline, scaled into a
   190 × 90 box. A link click shows its path. A "Mutasd az alaprajzon" button closes the view and flashes the path on
   the canvas through `STK_OVERLAY` (removed after 1.5 s).
5. **The checks bar**, T2 part: `'<n> pont · <m> falszakasz · <k> nem érhető el'`.

## Tests
1. `tpoLayout` on the T1 fixture: the board is in col 0, the portal box in col 1, the sockets in col ≥ 2; there are 2
   lanes, the board's room first.
2. Determinism: two layouts of the same G are deep-equal; shuffling `data.devices` gives the same layout.
3. A click on a node selects that device (`selected.i` → its id).
4. The rendered `#tpoRoot` has one `<g data-id>` per anchor and one `<path data-e>` per edge.
5. Golden identical.

**⏸ after build:** show the user the CLA planner file and a 4-room fixture in the Pályák tab (screenshots). The layout
is judged by eye; adjust the column and lane rules from their remarks before T3.
