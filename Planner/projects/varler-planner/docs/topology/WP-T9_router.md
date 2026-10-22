# WP-T9: Router (links → paths on GP)

Status: todo · Wave C · Depends: T1, T3 · Size: M (~150 lines) · Spec: next free · Decisions: Q-T09

## Goal
*"Connections are used to set each circuit's path from the Elosztó downstream."*

Every link of every circuit becomes a concrete sequence of wall sections, and every GP edge learns which circuits run
along it.

## Read
- `01_RULES.md` TR-G5, TR-G7, SR-1, SR-3 (`must`)
- `08p` (T1: `tpoPath`)
- `08pa` (T3: `tpoLinks`)
- `fig/06`

## Build (`src/08p-tpo-graph.js`)
1. **`tpoRoute(level)`** returns `{sig, per: Map ref → {links:[{a, b, k, path:[edgeIdx…], len, ok}]}, load: Map
   edgeIdx → Set(ref), fail:[{ref, a, b}]}`.
   - Each link uses `tpoPath(G, a, b, via)`, where `via` = the link's own `via` + the **kötelező** mids the plain
     shortest path passes within their face stretch (SR-3 `must`, Q-T09 A; one re-route).
   - A link with no path is `ok:false`, goes into `fail`, and adds no load (CK-3 already reports it).
2. **Wire tree per circuit.** The union of the circuit's link paths. A circuit loads an edge once, even if two of its
   links use it. That case is legitimate: a chain hop that runs back along the same wall is two cables, and that count
   is T10's business, so keep `count` per edge as well: `loadN: Map edgeIdx → Map(ref → n)`.
3. **Departure nodes.** Per GP node, compare the circuit sets of its incident loaded edges. A node where some circuit
   enters or leaves a set it shared is a **departure**: `departs: [{node, anchor?, refs}]`. If the node is an anchor
   with a box (the board, a mid, an endpoint), it is ok; otherwise it is open (input to T10).
4. Cache on `sig` + a hash of all `c.topo`.

## Tests
1. Two socket circuits leaving the board along the same wall and splitting at a KD: the shared edges carry both refs,
   there is one departure at the KD, and it is ok.
2. The same circuits with the KD removed: the departure node has no anchor, so it is open.
3. A kötelező KD beside the shared stretch: both paths gain it in `via`; the path length grows by ≤ the detour.
4. A link to an unreachable socket: `fail` has 1 entry and `load` is unchanged by it.
5. Determinism: the same input gives deep-equal output.
