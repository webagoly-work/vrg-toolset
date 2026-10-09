# IDEA-001 — Cluster points and flush-box sizing

Status: **idea, written down 2026-10-09 for a later round** · not scheduled · depends on the routing
round (WORKSHOP-001) · test bed: `Calculator/P33-teszt_v2.vplan.json`

> **Product side done:** [IDEA-002](IDEA-002_flush-cover-standard.md) +
> `FLUSH-COVERS-001.json` (2026-10-09) carry the real-product catalogue this doc assumes in §3.4
> and §4 — the K1/K2/K3 cluster housing classes, the RB-S…RB-H cover mapping, and answers to open
> questions 3 and 5 below.

> *"…standardize flush mounted locations that work as multi-layer cluster points, and depending on
> their needs derived from which layers they should create flush housing space, calculate the
> required size of those flush mount boxes so that they could satisfy the needs of the clusters.
> This could streamline how many flush space needs to be created in every room — endpoints that are
> far apart get their dedicated flush mount (süllyesztett szerelvénydoboz) space at their location…
> In the end, we covered every endpoint in every room, with endpoint smart-up fallback redundancy,
> and cluster points for smart functions to minimize flush mount endpoint count creation."*
> — the user, 2026-10-09

---

## 1. The idea in one paragraph

A BRIDGE stack places every layer's endpoint where it is *ideal for that layer*. Left alone, that
gives one flush box per endpoint, which is expensive to chase and ugly on the wall. But the placement
rules already pull endpoints together: a foundational device makes its vertical zone the preferred
zone for other layers, and door-related devices gather at the portal. So most endpoints fall into
**clusters**. A cluster gets **one standardized flush housing sized for everything that may ever
live there**. An endpoint too far from any cluster gets its **own** flush box, deep enough for a
wireless smart module later. The result covers every endpoint in every room with two things at
once: a **smart-up path at each endpoint** (a module can always be fitted where the device is) and
**few, well-equipped cluster points** for the smart functions.

## 2. Terms

| term | meaning |
|---|---|
| **cluster point** (klaszterpont) | one flush location on one wall face holding endpoints of one or more layers; one vertical riser, one spine T above it |
| **cluster** | the endpoints a cluster point serves: same wall face, same column (within the grouping distance), compatible zones |
| **solo point** | an endpoint no cluster absorbs; it keeps its own flush box |
| **housing** | what is built into the wall at a point: one multi-gang box, a partitioned box, or a set of boxes side by side |
| **smart-up space** | the extra depth / volume that lets a wireless endpoint module (relay, dimmer, sensor bridge) sit behind a device later |
| **demand** | what a point must hold: gangs, depth, compartments, from the layers it serves |

## 3. How it would work

1. **Group** wall endpoints per face into columns: same wall face, along-wall gap ≤ *g* (v2 used
   600 mm for the spine T-boxes; the cluster rule likely wants smaller, ≈ 250–300 mm, one box
   width plus a gap). Ceiling and floor endpoints are not clustered with wall points.
2. **Zone-check** each column: endpoints in the low (200–500), medium (800–1400) and high
   (1900–2500) zones may share a column but not a housing — a column is a vertical stack of
   housings, one per occupied zone. (P33 v2's door columns are exactly this: SWI 1300 + NTL 1150
   in the medium housing, POR + portal box in the high one.)
3. **Demand per housing** = Σ over its endpoints of the catalogue's per-code need:
   - gangs (a switch 1, a double socket 2, a touch panel its back box, an NTL 1, a THR 1…);
   - depth: standard (≈ 40 mm) or **deep / smart-up** (≈ 60–65 mm) when the endpoint is marked
     smart-up ready;
   - **compartments**: MAINS and SELV / data never share a compartment (A2 §5, EN 50174-2
     segregation) → a partitioned multi-box, or two housings side by side.
4. **Pick the housing** from a catalogue of real flush products (1–5-gang strips, partitioned
   multi-boxes, 10 × 10 / 15 × 15 junction-size boxes, media back boxes) — the smallest that holds
   the demand, with a **sizing policy**:
   - `active` — sized for the layers the client takes now;
   - `full` — sized for every layer of the stack (the "architectural reserve": a client who adds
     layers later never chases again). **Likely default for BRIDGE work.**
5. **Solo points**: an endpoint further than *g* from every cluster gets a single deep box
   (smart-up ready) at its own position.
6. **Report** per room: housings by type and count, solo points, total flush boxes vs the naive
   one-per-endpoint count. This is the saving the idea promises, made visible.

## 4. Where it plugs in

- **Routing (WORKSHOP-001):** a cluster point is one network node. Its riser is one vertical to
  the spine T. Silver runs end at the cluster point, not at each device, which shortens the network
  and makes the wall-based route type naturally clustered.
- **Layer selection:** with the `full` policy the housings do not change when layers are switched
  off; only their contents (and the runs) do. With `active` they shrink. Either way the decision is
  explicit, not a side effect.
- **Fill (E3) and cabinet (E5):** unchanged. Housings are a new BOM line group, not a new circuit
  rule.
- **Catalogue:** `EP_CAT` gains per-code `gang`, `depth`, `smartUp` defaults; a new `FLUSH_BOXES`
  table holds the products. Both are data, user-editable like `AFILL_CONDUITS`.

## 5. Open questions (for when it is scheduled)

1. Grouping distance *g* for a housing, and whether a cluster may span two adjacent wall faces at a
   corner (an L-forma corner is the natural place for a cluster).
2. Which codes are **smart-up ready by default** (every SWI and SOC? every lamp position?), and
   whether ceiling lamp points count (a ceiling box can hold a module too).
3. One partitioned housing vs two housings side by side for MAINS + SELV in the same column — the
   product range decides, and so does how the client wants the wall to look.
4. Sizing policy default: `full` everywhere, or `full` only in rooms on the client's "maybe later"
   list.
5. Does a portal box (v1's 10 × 10 at the door's upper corner) count as the high housing of the
   door column, or stay a pure junction box?
6. Media walls (K33) are their own housing type (back boxes behind a screen, the AV void): cluster
   them by the same rule, or keep them hand-designed?
