# WP-TV1: The pálya-gráf (GP)

Status: todo · Wave A · Depends: TV0 · Size: M (~150 lines) · Spec: next free · Decisions: none

## Goal
*"Once the walls create the path between every endpoint, this is the geometrical connection that proves two points can
indeed be connected physically … geometric autorouting only has to verify that device points are connectable, which
creates a one-line connection between points. The lines represent the wall sections between any two points."*

## Read
- `01_RULES.md` §1, §3 (PR-1 … PR-8)
- `08ob-wf-engine.js` `blInput` :41–106 and `blRunRaw` (the prep sequence `geom.load → allowedFromSketch →
  prep.endpoints → applyHeights → portals → portalMembers`)
- `tools/baseline/network.js`:
  - `build` :58–100 (the costs :84–91, `geo` :42);
  - the return `{g, byKey, roomNodes}` :99;
- `tools/baseline/plan.js` §1–§2 (:36–72): the drop keys and the service-point face keys that become `byKey` entries
- `08oe-wf-leaders.js` :22–24 (`ldZoneRun`, `ldNodeOf`): an existing reader of `R.net`; copy its access pattern

## Build (`src/08t-tpo-graph.js`)
1. **`tpoGraph(level)`** returns:

   ```
   {sig,
    anchors: Map id → {id, dev, role:'B'|'M'|'E'|'door', code, room, nodes:[i…]},
    edges: [{a, b, geo, w, nodes:[i…], rooms, walls, cross, surf:'marked'|'pref'|'minus'|'soft'}],
    adj, unreachable: [id], net}
   ```

   - **Source of the network:**
     - when `BL_LAST` is for this level and `blStale(level) === 0`, use `BL_LAST.R.net`;
     - else run the engine's prep only, plus `BL.network.build` with the same anchors `plan()` would use. Never a full
       `plan()`, which is heavy and has side effects on `BL_LAST`.
   - **Anchors (PR-1):**
     - the board and every mid (junctions, RBX, BASE);
     - **each door's L4 on each face**, as role `door`: the derived master of K1;
     - each endpoint at its drop key.
     - Members that share one drop (MERGE 250) share its nodes, joined by zero-length edges.
2. **Contraction (PR-2).**
   - From each anchor's node, run a Dijkstra that **does not expand through another anchor's node**: reaching one
     records an edge and stops that branch.
   - Keep the shortest edge per pair, by `w`. It keeps `geo` (T0-1: geometric metres, never the search weight).
   - `surf` is the worst surface on the path. `cross` = the service point whose crossing edge it uses.
3. **Connectivity (PR-6):** a BFS from the board over the edges; the rest is `unreachable`.
   - Strict pass first (no `soft` edges), then lax.
   - A node reachable only laxly is reachable, with `soft` edges (CK-6).
4. **Cache (PR-8):** on `blInput(level).sig`.
5. **`tpoPath(G, a, b)`:** the shortest anchor path, for the link inspector (TV2) and the ghost line (TV5). Ties break
   by anchor id.

## Tests
1. spec-100's two-room plan (a door, a board, Vezethető all round):
   - the anchors are the board, 2 door faces and each endpoint;
   - the edge into room B carries `cross` = the door.
2. Room B's walls unmarked → still reachable, with `surf:'soft'`. A tilos vstrip over the only latch face → those
   anchors are `unreachable`.
3. The practice flat (`tools/practice/Gyakorlo_lakas_villany.vplan.json`, all ground-floor walls Vezethető, as the
   money-path audit did):
   - every anchor is reachable;
   - the edge count is recorded in the spec.
4. Cache: two calls without a change return `===`; moving a socket gives a new object.
5. `tpoPath` length = the sum of its `geo`.
