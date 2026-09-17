# Wiring pipeline — design

*Status: design agreed 2026-09-16, slice S1 in progress. Supersedes R1/R2 of `1.1_backlog.md`
(a read-only Rendezés editor over coincidence-derived connectivity). Read with `DECISIONS.md`,
which this document extends rather than overrides.*

The planner stops being "a drawing with circuits painted on it" and becomes a pipeline: each
stage takes the stage below as input and adds one kind of truth.

| # | layer | nature | holds |
|---|---|---|---|
| 6 | Labels & BOM | derived, freezable | codes down to the wire, material lists, lengths |
| 5 | Containment | derived + override | Védőcső / Csatorna per span — the sizing plugin |
| 4 | Wiring | authored, auto-assisted | circuits, runs — Behúzás stages 1–4 |
| 3 | Routes | authored | ghost routes between terminals, cut into spans |
| 2 | Identity | authored | név, ref, dedikált, cable requirement |
| 1 | Geometry | authored | devices, rooms, walls — the first source of truth |

A layer references only layers below it, and only by id.

---

## 1. Where we start from — routing engine v1

A partial pipeline already exists. It works, and most of its *ideas* survive; its *foundations*
do not.

**What exists and is kept (as behaviour):**
- `D.req` — required conductors on a device (count, mm² or data kind, name, sorszám, colours).
- Behúzás — `routeDevice(i, mode)` in `10-lamps.js`: Dijkstra over path vertices to the nearest
  board, to the next box (`next`) or to a picked device (`pick`).
- Gating — a kötődoboz `accept` list and a section `allow` list decide whether a circuit is tapped
  or passes through (`passing`, drawn lighter).
- Switch terminal tables (`SWITCH_TYPES`), `swType` / `swMap`, manual `D.wires`.
- The elosztó tábla (MCB, ΔU), cable list, wire list, switch report, BOM with waste %.

**Five structural faults the pipeline has to remove:**

| | fault | where | consequence |
|---|---|---|---|
| F1 | Topology by coincidence | `buildGraph()` unions vertices within 250 mm; `anchorNode()` takes the nearest vertex at *any* distance | a device 3 m from a path is "connected" to it; two paths 20 cm apart silently merge |
| F2 | Index references | `sec.circuits[].dev`, `swMap` values, `switchPick.di` | delete a device and its wiring re-points at its neighbour — violates the id invariant in `CLAUDE.md` |
| F3 | Circuit identity is a copied string | every section carries its own copy keyed `num\|name`; `editCircuit` propagates edits | renaming is a sync job; a circuit that "gets its name first" has nowhere to live before it touches a section |
| F4 | Two geometry stores | `data.paths` and `data.cables` are both drawn polylines | two lengths for one run; the BOM adds both |
| F5 | Route and containment conflated | `sec.build` is both "a path exists" and "it is gégecső" | a pathway cannot exist before its conduit is decided |

**Found while auditing — fix in S6, not blind:** `SWITCH_TYPES` (`02-state.js`) and `DEVKIND`
(`05-totals.js`) disagree. `SWITCH_TYPES` says 103 = csillár, 105 = váltó, 106 = kettős váltó,
108 = redőny; `DEVKIND` says 103 = háromfázisú, 105 = csillár, 106 = váltó, 108 = kettős váltó.
The Behúzás scheme list agreed for stage 3 (100, 101, 102, 105, 106, 107, 106+6, 107+7) follows
`DEVKIND`. Changing `SWITCH_TYPES` terminal ids invalidates stored `swMap` keys, so it needs a
migration, not an edit.

---

## 2. Vocabulary

| term | meaning |
|---|---|
| **terminal** | a device a wire can start, end or be joined in: device, kötődoboz, szerelvénydoboz, Elosztószekrény |
| **route** | a drawn polyline (`data.paths` record). Geometry only; says nothing about conduit |
| **segment** | one piece of a route between two consecutive nodes — `sections[i]` |
| **span** | a maximal chain of segments between two *terminal nodes* (or route ends). **The unit that is named, sized and labelled.** Contents are constant along a span because nothing can join or leave between two boxes |
| **circuit** | a named electrical circuit: name first, breaker position later, cable spec, voltage class, dedikált flag |
| **run** | one pull of a cable/wire set for a circuit, from terminal to terminal, through an ordered list of segments |
| **containment** | Védőcső / Csatorna on a span: type, size, count, süllyesztett / falon kívül |

A node is a **terminal node** when a terminal is linked to it (`dev.link`) or — legacy only —
coincides with it.

---

## 3. Decisions

1. **One geometry store.** Routes are `data.paths`. The ghost tool draws a route with no
   containment; the Védőcső / Csatorna tools assign containment to existing spans, or draw a route
   and assign in one step. `data.cables` stops being drawable (S2) and is migrated (S3).
2. **Connection is explicit.** A route end placed on a terminal links it (`dev.link`). Coincidence
   remains only as a fallback for pre-S2 drawings, and `validate()` reports each such join as
   `info` so it can be confirmed.
3. **Suggestion and override are stored apart.** Every derived value has the shape
   `{auto, manual, basis}`. Recomputing writes `auto` only. `basis` is a hash of the inputs `auto`
   was computed from; a `manual` value whose basis no longer matches is flagged
   `warn: kézi érték, a bemenet azóta változott`.
4. **Codes are derived refs over stable ids, and freeze once issued.** A label printed and stuck on
   site cannot change when a room is renumbered. Issuing (*kiadva*) snapshots the codes; after that a
   re-derivation that would change one is reported, not applied.
5. **Wires belong to circuits, not to spans.** A span only knows which runs pass through it.
6. **Lengths are approximations.** On site a run differs by 30–70 cm from any drawing. Length =
   Σ span length (3D, as `sectionLen` already computes) + slack per termination + waste %. Slack is
   a rule setting (default 0.5 m per end), not a constant. All length outputs are labelled
   *tájékoztató*.
7. **Parallel routes between the same two terminals are legal** (rare in practice). The second one
   gets a `/b` suffix.

---

## 4. Schema

### v2 — S1 (this slice)
Index references become ids. No new collections, no rendering change.
- `sec.circuits[].dev` : device index → device id
- `D.swMap[term]` : device index → device id
- readers resolve by id and still accept a number, so a half-migrated document cannot crash

### v3 — S3
```js
data.circuits = [{
  id: 'A7',                 // IDPRE 'A' (áramkör)
  name: 'Konyha dugalj',    // required, set first
  breaker: null,            // 'F12' — assigned later, drives the circuit code
  col: 'kek',
  cable: {cores: 3, mm2: 2.5} | {data: 'UTP'},
  dedicated: false,
  voltage: 'LV' | 'ELV',
  board: 'D2'               // Elosztószekrény device id
}]
data.runs = [{
  id: 'H14',                // IDPRE 'H' (húzás)
  circuit: 'A7',
  from: 'D2', to: 'D9',     // terminal ids
  via: [{p:'P3', a:'n12', b:'n13'}, …],   // ordered segments, by node ids
  stage: 1 | 2 | 3 | 4 | 'manual',
  basis: 'h:…'
}]
section.cont = {auto:[…], manual:[…] | null, basis:'h:…'}   // containment, per segment
```
Both collections go into `UKEYS` **and** `IDPRE`. A run whose segment no longer exists (a node was
inserted, a route deleted) is `error: megszakadt húzás` and can be re-pulled.

---

## 5. Naming

Project code comes from the project settings (`state.bp.proj`, e.g. `P33`); room codes from the
room-numbering feature (`05h-rooms.js`, in progress).

| thing | code | rule |
|---|---|---|
| terminal | `P33-1.02-D1` | room template `{szám}-{típus}{n}` with project prefix |
| board | `P33-EL1` | above rooms |
| span | `K3~D1`, parallel `K3~D1/b` | endpoint refs; the board-side end first when known, else natural sort |
| pipe | `K3~D1.2` | second pipe in the span |
| circuit | `EL1-F12` once a breaker is set, else its name | breaker label is what is looked for on site |
| wire | `F12-L1`, `F12-N`, `F12-PE`, `F12-S1` | circuit + conductor role |
| wire at a box | `F12-L1 @ K3` | same wire, where it is cut |

---

## 6. Behúzás stages

All four are graph queries over explicit routes plus a template. None is a new data model.

1. **Dedikált** — a device with `dedicated` gets a direct run to its board: shortest span path by
   length. The cable comes from the device-kind catalogue (e.g. főzőlap → 5×2.5).
2. **Manual multi** — select terminals; the span tree covering them gets the same cable on every
   in-between span (a string of room sockets on one circuit).
3. **Switch schemes** — 100, 101, 102, 105, 106, 107, 106+6, 107+7. Each scheme is a template
   declaring terminal roles and conductors per leg; only schemes whose roles fit the selection
   counts are offered. A selected kötődoboz is a waypoint; a Kapcsoló marked **Betáp oldal**
   resolves which end is the feed when more than one routing exists.
4. **ELV / LV** — voltage class on the circuit. Consumed by layer 5: two classes never share a
   pipe. The existing `boxlv` (LV szerelvénydoboz, leválasztva) is the terminal-side half of this.

Existing gating (`accept`, `allow`, `passing`) carries over as constraints on stages 1–3.

---

## 7. Containment sizing plugin

A pure function with a versioned JSON rule set:

```js
sizeSpan(span, runs, rules) → { auto:[{type, size, count, fill}], accessories:[…], why:[…] }
```

`rules` holds: cable outer diameters, containment size standards (Ø mm for cső, mm × mm for
csatorna), inner usable area, fill ratio, separation classes, the falon kívül accessory rule
(bilincs every N mm, sized to the pipe; the user's practice is 150–200 mm) and `slackPerEnd`.
Export and import of that JSON *is* the preset system. `why` makes each suggestion auditable, e.g.
`2×Ø20: 3×NYM-J 3×2.5, telítettség 34% > 33%`.

The starting values are the user's practice, not the code's. S4 ships the rule editor with an
empty-but-valid preset and a clearly marked *ellenőrizendő* example.

---

## 8. Migration from v1 (S3)

| v1 | becomes |
|---|---|
| `sec.circuits[]` (from Behúzás) | a circuit per `num\|name` key + one run per routed device, rebuilt from the sections that carry it |
| `sec.circuit` (manual, per section) | a circuit + a `stage:'manual'` run over that segment |
| `D.req` | the device's cable requirement (layer 2) |
| `sec.build` | `section.cont.manual` |
| `data.cables` | a route plus a manual run, flagged `info` for review |
| `accept` / `allow` | unchanged, read by Behúzás |

---

## 9. Build slices

Vertical slices, so the whole chain works for one case as early as possible.

| slice | content | status |
|---|---|---|
| **S1** | this document · schema v2 (ids) · spans + span naming (derived, no UI) | in progress |
| S2 | ghost route tool · explicit route-end links · route `validate()` (unlinked device, no route to board, coincidence joins) · `data.cables` no longer drawable | |
| S3 | schema v3 circuits + runs · v1 migration · stage 1 dedikált Behúzás | |
| S4 | sizing plugin v0 + rule editor · Path → Védőcső / Csatorna rename · per-span containment | |
| S5 | stage 2 manual multi wiring | |
| S6 | switch numbering reconciled · stage 3 switch schemes | |
| S7 | stage 4 ELV separation | |
| S8 | codes · issue / freeze · BOM and lists from runs · wire labels | |
| S9 | Rendezés projection (terminals, spans, circuit layers) | |

After S4, device → route → wire → pipe works end to end for dedikált circuits.
