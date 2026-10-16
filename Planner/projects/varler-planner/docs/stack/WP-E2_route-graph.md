# WP-E2 — Route graph and the three connection algorithms

Status: todo · Wave E · Depends: E1 · Size: M (~250 lines, pure functions) · Builder: mid tier — ideal for a cheap model: no UI
Decisions: Q31=A

## Goal
The user asked: *"there is a word for that algorithm, I'm sure."* There are three, one per wiring
topology, all over the routes the user drew (never inventing geometry):
- **home run / star** — each endpoint its own cable from the origin: a **shortest-path tree** (Dijkstra);
- **daisy chain / loop-in** — a socket string, a lamp group, a KNX line: **nearest-neighbour ordering
  by graph distance**, then shortest paths between consecutive members;
- **branching tree** — the minimum tree joining a set of points through a given network: the
  **Steiner tree problem in graphs**, solved approximately with the **KMB heuristic**
  (Kou–Markowsky–Berman). v1's catalogue uses star and chain; Steiner is built and tested for the
  `tree` topology and the branch-box check.

## Read (only these)
- `src/01-schema.js` `devLinks`, `resolveLink` · `src/05u-arms.js` (`n.j` joins) · `src/05r-channel.js` `chnRoutes`

## Build — `05v-graph.js` (prefix `rg`) — pure, no DOM, no `draw()`

### 1. The graph
```js
rgBuild({routes:['arm','channel'], level:null})  // → G
// G.nodes: Map key → {key, kind:'node'|'dev', x,y,h,level, p?,n?, dev?}
//   route node key 'P12/n40' · device terminal key 'D:D7'
// G.adj: Map key → [{to, w, e}]   (undirected: both directions stored)
// e = edge info: {k:'seg',p,a,b} · {k:'join'} · {k:'drop',dev}
```
Edges:
1. consecutive nodes of an included path: `w` = 3D length `hypot(dx,dy,dh)`, `e={k:'seg',p,a,b}`;
2. `n.j` joins: `w = |dh|`, `e={k:'join'}`;
3. device links (`devLinks(d)` → node): `w = glue ? 0 : |node.h − d.h|` (the implicit vertical drop — the
   node sits at route height, the box lower), `e={k:'drop',dev}`;
4. fallback coincidence: two included nodes on the same level with identical `round(x),round(y)` and
   `|dh| ≤ 1` → `w=0`, `e={k:'join'}`. **Never** the old 250 mm union (wiring_pipeline F1).
Edge id: `rgEid(a,b)` = the two keys sorted and joined with `|`.

### 2. Algorithms (deterministic: every tie broken by key string order)
```js
rgDijkstra(G,src)            // {dist:Map, prev:Map} — binary heap
rgPath(prev,src,dst)         // [keys] or null
rgPathEdges(G,keys)          // [{a,b,w,e}] along the key list
rgStar(G,origin,members)     // [{to, keys, len}] one per member; unreachable → {to, keys:null}
rgChain(G,origin,members)    // {order:[origin,m1,m2…], legs:[{from,to,keys,len}], unreached:[]}
                             // nearest-neighbour by graph distance from the current point
rgSteiner(G,terminals)       // KMB: 1) Dijkstra from each terminal; 2) Prim MST on the metric closure
                             // (start at terminals[0]); 3) union of the shortest paths of the MST edges =
                             // subgraph H; 4) Prim MST of H; 5) repeatedly delete non-terminal leaves.
                             // → {edges:[eid], nodes:[keys], cost, branch:[keys with degree ≥ 3]}
rgReach(G,src)               // Set of reachable keys
```
`rgSteiner` with 2 terminals = their shortest path; with unreachable terminals → `{…, unreached:[…]}`
and the tree over the reachable ones.

### 3. Hooks
Expose all on `window` (test hooks block). Nothing else in the app calls this module except E3/E4.

## Tests — `tests/spec-50-route-graph.js` (synthetic graphs built in data, no drawing)
1. Two paths sharing an end node by `j` → one connected component; with the `j` removed → two.
2. A device linked plan-only to a node 2000 mm above it → drop edge weight 2000 (h 300 vs 2300).
3. Coincidence: nodes at the same x,y,h on two paths join; nodes 5 mm apart do NOT.
4. `rgDijkstra` on a square with one diagonal shortcut picks the shortcut; the result is the same on
   ten reruns (determinism).
5. `rgChain` origin O, members at distances 3/1/2 along a line → order O,m(1),m(2),m(3); legs lengths sum
   to the farthest distance.
6. `rgSteiner` on a plus shape (centre C, arms to T1..T3, each 1000) → cost 3000, branch `[C]`.
7. `rgSteiner` on a 3×3 grid (spacing 1000) with terminals at corners (0,0), (2000,0), (0,2000) →
   cost exactly 4000 (the optimum; KMB finds it here), every terminal in `nodes`, every leaf a terminal.
8. Unreachable member in `rgStar` → `keys:null`; `rgChain` lists it in `unreached`.

## Golden
Identical (no rendering).

## Verifier focus
Heap correctness (decrease-key by lazy re-push + stale check). Undirected adjacency both ways. KMB step 5
pruning loop until no non-terminal leaf remains.

## Out of scope
Deciding WHICH members form a group (D4) or what cables they get (E3).
