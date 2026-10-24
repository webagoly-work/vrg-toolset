# WP-T1: The pálya-gráf (GP)

Status: todo · Wave A · Depends: T0 · Size: M (~160 lines) · Spec: next free · Decisions: none

## Goal
*"Once the walls create the path between every endpoint, this is the geometrical connection that is proof that two
points can indeed be connected physically … geometric autorouting only has to verify that device points are
connectable, which creates a one-line connection between points. The lines represent the wall sections between any two
points."*

## Read
- `01_RULES.md` §1, §3 (PR-1 … PR-8)
- `src/08ob-wf-engine.js`:
  - 41–100 `blInput`;
  - 118–131 `blRunRaw`: copy only its sequence `geom.load → allowedFromSketch → prep.endpoints → applyHeights →
    portals → portalMembers`;
- `tools/baseline/network.js`:
  - 1–15: the model;
  - 51+ `build(G, allowed, anchors)`;
  - the `Graph` shape: `g.N[i]` with `{x, y, s, room, corner, keys}` and `g.adj[i]` with `{to, w, kind}`, where
    `kind ∈ face · soft · cross · over · floor · …`; confirm the exact names in the file;
- `tools/baseline/plan.js` §1–§2 (drops, service-point anchors): where an endpoint's anchor key comes from.

## Build (`src/08p-tpo-graph.js`)
1. `tpoGraph(level)` returns
   `{sig, anchors: Map id → {id, dev, role:'B'|'M'|'E', code, room, node}, edges: [{a, b, len, nodes:[i…], rooms, walls,
   cross, soft}], adj: Map id → [{to, e}], unreachable: [id], net: g}`.
   - Run the engine's own preparation (the same calls as `blRunRaw`, no `plan()`), then `BL.network.build`.
   - Each anchor is the network node its key landed on (PR-1). Several devices on one node (MERGE 250) share the node;
     each device is still its own anchor, and they are joined by zero-length edges.
2. **Contraction (PR-2).**
   - From each anchor node, run a Dijkstra that **does not expand through another anchor node**: reaching one records
     an edge and stops that branch.
   - Keep the shortest path per anchor pair, and drop duplicates (`a < b` by id).
   - `soft` = the path uses a `soft` edge; `cross` = it uses a `cross` / `over` edge (record the service point).
3. **Connectivity (PR-6).** A BFS from the board anchor over `edges` marks the rest; the leftovers are `unreachable`.
4. **Cache (PR-8)** on `blInput(level).sig`. `tpoGraph` returns the cached object while the hash is unchanged.
5. `tpoPath(G, a, b, via)` is the router's primitive, used by T9: the shortest anchor-to-anchor path over `edges`
   through `via` in order, plus its total `len` and its underlying network node list. Ties break by anchor id.

## Tests
1. A 2-room fixture (one door with a portal box, 3 sockets in room B, the board in room A, Vezethető fal on all faces):
   7 anchors. Every socket is reachable, and the edge from the board side into room B passes the portal (`cross` =
   the portal's id).
2. The same fixture with room B's walls unmarked: the sockets are still reachable, and their edges are `soft:true`.
3. Remove the door: room B's anchors are `unreachable`.
4. Cache: two calls with no change return the same object (`===`); moving one socket returns a new one.
5. `tpoPath` from the board to the far socket equals the sum of its edges and passes the portal anchor.
6. On the P33 planner file (local, skipped when absent): every anchor whose device the E5 run wires is reachable.
