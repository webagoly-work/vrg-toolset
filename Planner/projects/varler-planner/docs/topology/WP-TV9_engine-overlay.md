# WP-TV9: The engine's run, mapped onto the view

Status: todo · Wave A · Depends: TV1 · Size: M (~140 lines) · Spec: next free · Decisions: none

## Goal
*"Connections are used to set each circuit's path from the Elosztó downstream."*

The engine already fits each link into the walls (GO WIRE T2). This WP makes the view show **that** result on the
topological lines. It is not a second router.

## Read
- `01_RULES.md` SR-1, SR-7
- `tools/baseline/plan.js`:
  - the return :600 (`net, SP, drops, channel, boxes, legs, C, warn, spans, checks, unreached, report`);
  - the trunk and dist legs carry `pts` (network node indices) :419, :478; the special legs (drop, ceil, floor) carry
    `poly` only;
- `08ob` `blRun`, `BL_LAST`, `blStale`
- `08t` (TV1: GP edges keep their network `nodes`)

## Build (`src/08t-tpo-graph.js`)
1. **`tpoOverlay(level)`** returns
   `{fresh, byEdge: Map edgeIdx → [{leg, circ:[…], pipes:[{cond, circ, fill}]}], byAnchor: Map id → {box, fill}, legsOf:
   Map circ → [legIdx]}`.
   - **`fresh`** = `BL_LAST` exists for this level and `blStale(level) === 0`.
     - When not fresh, the result is empty and the tabs say `'elavult — futtasd újra: ⚒ Pályák'`.
     - It never calls `blRun` itself; a button in the tab does, on the user's click.
   - **Mapping (exact):**
     - a leg with `pts` covers every GP edge whose `nodes` run is a contiguous part of `pts`, in either direction;
     - a leg that spans several GP edges is split across them.
   - **Mapping (vertical and special legs):**
     - drop / ceil / floor / riser legs attach to the anchor at their end (`to` / `from` refs);
     - they are drawn as a short stub in the view, not along an edge.
   - **Boxes** (`R.boxes`) attach to the anchor on their node; generated boxes with no anchor become **virtual mids**
     (`gen:'bl'`, drawn hollow).
2. **Coverage check:** every leg with `pts` must map completely. An unmapped stretch is a TV bug, reported in the
   checks bar as `'TV: <n> szakasz nem illeszthető'`; the spec asserts it is 0.
3. **Per circuit:** `legsOf` drives TV10's highlighting and TV11's playback.

## Tests
1. spec-100's plan after `blRun`: every dist and trunk leg is mapped; the summed `geo` per circuit = the engine's leg
   lengths (±1 mm).
2. The practice flat (all walls Vezethető, Planner defaults): coverage 100 %, and the box count on anchors + virtual
   mids = `R.boxes.length`.
3. After moving a socket, `fresh` is false and `byEdge` is empty; nothing recomputes.
4. Determinism: two runs give deep-equal overlays.
