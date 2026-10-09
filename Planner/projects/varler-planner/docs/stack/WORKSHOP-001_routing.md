# WORKSHOP-001 — Routing: layer selection, ghost wireways, wall / floor rules

Status: **r1 · answered 2026-10-09 (17 / 17, §7)** · plan only, nothing built · the next round can start at R1
Test bed: `Calculator/P33-teszt_v1.vplan.json` (client endpoints only, 55) and
`Calculator/P33-teszt_v2.vplan.json` (every layer filled, 124 endpoints + 30 spine T-boxes)
Related: `IDEA-001_cluster-flush-boxes.md` · WP-E1 (ARM) · E2 (route graph) · E3 / E4 (fill)
Answer in the tuner: `_inbox/BRIDGE Tuner - WORKSHOP-001.html`, pack `PLANNER-ROUTE-Q-001` — `M01` is
the method question of §2, `R01`…`R16` are Q-R01…Q-R16 below (the tuner's answer format allows no
dash in an id). The two earlier packs ride along with their recorded answers preloaded.

---

## 0. Words

| user's word | in the Planner today | what it is |
|---|---|---|
| **golden path** | `route:'channel'` paths | connects every hardware node, ends at the terminal RBX. In P33 teszt it has **two lanes**: the CHANNEL lane (Elosztó → BASE → RBX01 → RBX02: data, control, bus B) and the **230 V lane** (Elosztó → RBX01 → RBX02: the lighting string that feeds the boxes), on opposite sides, with separate penetrations of the spine (BUILD-001 T1) |
| **silver path** | `route:'arm'` paths | endpoint → its RBX |
| **bronze path** | today also drawn as ARM, the fill sees `from:'board'` | heavy / dedicated loads straight to the Elosztó, never through a RoomBox (DED, AVP) |
| route · run · pipe | path · `data.runs` · E3 pipe | a drawn line · one cable pull between two boxes · one conduit, box to box |

## 1. The problem, with numbers

v2 places 124 endpoints over 10 layers; **61 are MAINS**. A client who wants no home automation
(plain electrician work) keeps about half of them. Silver paths routed for the full stack then
carry segments that serve nothing: **ghost wireways**. They would be chased, piped and priced for
nothing, or shown as wireways without purpose.

## 2. Three methods

**A — one network for the full stack, prune by selection.** Route every layer at once into one
silver network. For a layer selection, compute runs only for the active endpoints; a segment no
active run uses is dropped.
*Good:* one standard network, stable positions. *Weak:* the network was optimized for 124
endpoints, so a 61-endpoint client inherits its geometry — MAINS chains that detour through
cluster points that exist only for higher layers. Pruning removes the ghosts, not the detours.

**B — layer by layer, foundation first.** Route MAINS (with the bronze paths) first, on the rule
cost model. Each next layer routes on the same graph with a **reuse discount** on segments already
chosen, so it widens an existing chase before cutting a new one, up to the chase's capacity.
*Good:* the MAINS-only network is exactly what MAINS alone would produce, so plain electrician work
has no ghosts by construction. Every higher layer adds only what it needs. *Weak:* order-dependent;
a selection that skips a middle layer (MAINS + SECURITY, no MEDIA) may keep a detour that MEDIA's
segments caused.

**C — my recommendation: build with B, select with A, provision on purpose.**

1. **Construction = B.** Foundation-first, in the stack's role order (open question Q-R12), each layer
   on the shared graph with the reuse discount. The formal name for "prefer widening a path to
   cutting a new one" is **buy-at-bulk network design**: the cost of a segment grows *concavely*
   with the cables it carries. It sits next to the Steiner tree already in E2 (KMB) and fits the
   same graph.
2. **Every segment knows its usage set**: which layers' runs pass through it. That is derived,
   never stored (contract §4).
3. **Installed = used.** A segment is installed if and only if at least one *active* run uses it.
   An unused segment is not in the BOM, not chased, and not drawn as a wireway. It is shown only in
   a separate "reserve" view, faint, as the architectural standard. **No ghosts, by definition.**
4. **Provisioned is a choice, never an accident.** The modular standard ("lay the wireway now, add
   layers later") becomes an explicit state: a would-be-unused segment the user marks *provisioned*
   gets an empty pipe with a draw cord (the catalogue's `SPARE`), and it is priced. Granularity:
   per room, per cluster, or per layer (Q-R10).
5. **Re-route for this selection.** For a selection that is not a prefix of the role order, one
   action recomputes B with only the selected layers. The full-stack network stays the reference.

**Acceptance pair (why the two test plans exist):**
- v2 with every layer above MAINS switched off must give **the same MAINS network and runs** as
  routing v1 directly: no ghost segment, no detour.
- v2 with every layer on must never cut a second chase beside one that still has capacity.

## 3. Route types: wall, floor, mixed

| type | shape | box rule |
|---|---|---|
| **W — wall** | from the endpoint straight **up** to the spine (kábelgerinc) in the upper zone, along the spine, down to the target. A T on the spine gets a kötődoboz | boxes at every T, accessible |
| **F — floor** | from the endpoint straight **down** to a floor channel in the screed, along it, up to the target | **no junction in the floor**: floor runs go box to box, rising in a wall at both ends |
| (**C — ceiling**) | in a suspended ceiling's void (álmennyezet) | only where an álmennyezet exists — see Q-R04 |

**Both W and F are computed in the background for every golden, silver and bronze connection.**
Only one is *active* per connection: a global default, with per-room overrides.

**Mixed mode** = both types enabled, one **primary** and one **secondary**. Auto-routing lays every
run on the primary. The user can then move part of a connection's content to the secondary (for
example the SELV / data family into the floor, MAINS on the walls).

**No double counting**, as a hard invariant:
- each run is realized on **exactly one** type;
- pipes, lengths and boxes are counted from the realized assignment only;
- the unrealized alternative is a plan, never a BOM line.

Data sketch:

```js
link = {from, to, kind:'golden'|'silver'|'bronze',
        real:{W:{segs:[…]}, F:{segs:[…]}},          // both computed, derived
        active:'W'|'F',                              // stored: the user's choice (default from room / global)
        split:null | {W:[runIds], F:[runIds]}}       // stored only in mixed mode; ∪ = all runs, ∩ = ∅
```

## 4. The rulebook — draft, to be tuned by the questions in §5

Sources are named so every rule can be checked. **Figures marked ⚑ must be verified against the
current text before they become defaults.** The rules become a data table (`ROUTE_RULES`),
user-editable like `AFILL_RULE`, not code.

### 4.1 Geometry (both types)
- **R01** In walls, routes run **only horizontally or vertically**. No diagonal chasing. (Hungarian
  textbook rule; the intent of MSZ HD 60364-5-52 for concealed wiring ⚑)
- **R02** Horizontal routes in walls stay inside the **installation zones** of DIN 18015-3:
  - upper zone 15–45 cm below the ceiling (preferred line 30 cm → **2400 at a 2700 ceiling**,
    the kábelgerinc of the HU tradition);
  - lower zone 15–45 cm above the floor;
  - middle zone 90–130 cm, only on worktop walls.
- **R03** Vertical routes run in zones 10–30 cm beside door and window frames and wall corners
  (DIN 18015-3), **or straight above / below an endpoint** (the user's rule: an endpoint's route
  rises straight to the spine).
- **R04** A T where a vertical meets a horizontal gets a **kötődoboz**; so does every change of
  direction that is not a wide bend. Boxes stay accessible, never buried (MSZ HD 60364-5-52 ⚑ ·
  textbook).
- **R05** **Pull-ability:** at most 2 × 90° bends between two boxes (the 33 % fill rule over 10 m
  or two bends is already A2 §1 / `AFILL_RULE`).
- **R06** Walls marked `tartofal`, `szomszed`, `gepeszet`, `kemeny` (`ban`) are **never chased**,
  only penetrated straight. Walls marked `minus` carry a cost penalty.

### 4.2 Floor (F) only
- **R07** Conduits in the screed (aljzatbeton), **parallel to the walls**, 10–15 cm from them ⚑
  (textbook); diagonal only where the user allows it (Q-R03).
- **R08** **No junctions in the floor.** Rise into a wall at both ends. Floor-to-wall transitions at
  an endpoint column or in a corner zone.
- **R09** Never across floor heating (`padlofutes`, ban), never under fixed furniture (`butor`,
  minus), and with minimum screed cover ⚑ (the product's installation rule).
- **R10** Door thresholds are crossed in the floor, in conduit, at right angles.

### 4.3 Families and separation (from A2 §5, already in the fill)
- **R11** Families never share a pipe; MAINS and SELV / data share a route only at ≥ 50 mm or with
  a metal divider, crossing at 90° (A2 §5 · EN 50174-2 ⚑ for the data separation classes).
- **R12** A junction box holds one family, or is a **partitioned** box. This matters for the portal
  boxes and spine T-boxes, which collect several families.
- **R13** SECURITY runs from the SSC in its own pipes, never into a RoomBox (A2 step 13).

### 4.4 Wet rooms (MSZ HD 60364-7-701 ⚑)
- **R14** Through zones 0–2, only wiring for the room's own equipment. Boxes and sockets outside
  zone 2; every circuit behind a 30 mA RCD. Silver paths for other rooms never cross the bathroom.
- **R15** The bathroom is reached from its RBX via the walkway wall (K29), not through the wet
  walls.

### 4.5 Penetrations and fire
- **R16** Count penetrations; one shared penetration per golden lane through a masonry wall (P33:
  one CHANNEL and one 230 V hole through the spine). Slab penetrations are fire-stopped (OTSZ ⚑).

### 4.6 Cost model (what "best" means)
- **R17** The cost of a segment is **concave** in what it carries (buy-at-bulk):
  - a **new chase** costs per metre (chasing + making good);
  - **one more pipe in an existing chase** costs only its pipe and the marginal widening,
    up to a capacity (Q-R07);
  - plus mark penalties, bends and penetrations.
- **R18** Endpoint ideal positions may move by at most a small tolerance to join a cluster or a
  shared vertical (the user's "small compromises toward ideal placement"). The tolerance is per
  layer: MAINS 0, higher layers ± 150 mm ⚑.

### 4.7 Topology (from the catalogue, unchanged)
- **R19** Star or chain per code (`EP_CAT.topo`). Socket strings chain from the closest member to
  the RBX. Board- and SSC-origin runs pass *through* an RBX's position without breaking at it
  (E3 step 4).
- **R20** Door-related endpoints (switch, NTL, portal sensor and control, entry panel, door contact)
  reach the **portal box** first (v1's 10 × 10 at the latch-side upper corner).

## 5. Questions — each has my default; answer only where you differ

| # | question | my default |
|---|---|---|
| Q-R01 | Spine height: a fixed line at ceiling − 300 (2400), or anywhere in the 15–45 cm upper zone? | fixed line, ceiling − 300 |
| Q-R02 | House switch height: your v1 switches use **1300**; the textbook says ≈ 1100 and DIN 105 cm; accessibility 85–110 cm. Which is the standard? | 1300 for P33 (yours), stored as a project setting |
| Q-R03 | Floor routes: strictly parallel to walls, or diagonal across open floor where shorter? | parallel only |
| Q-R04 | Is a third type, ceiling (álmennyezet), wanted now, or only W and F? | W and F now; C when a room has an álmennyezet mark |
| Q-R05 | Default type per room: W everywhere; F where the floor is renewed anyway? Is P33's floor renewed? | W default; F per room when you tick "new screed" |
| Q-R06 | Mixed-mode split granularity: per run, per family, or per cluster? | per family (MAINS on walls, SELV / data in floor) |
| Q-R07 | Chase capacity: how many pipes side by side in one wall chase before a second chase (or trunking)? | 4 × M20 / 3 × M25 ⚑ |
| Q-R08 | May two neighbouring clusters share one vertical riser (within 300 mm)? | yes, if the families allow it (R11) |
| Q-R09 | Doorways: cross over the door at the spine (W), or in the floor at the threshold (F)? | spine in W rooms, threshold in F rooms |
| Q-R10 | Provisioned (empty) conduit: per room to the RBX, per cluster to the spine, or per layer? | per cluster to the spine, when the cluster's `full` housing has room |
| Q-R11 | When a layer is switched off, do its cluster housings stay `full` size? (IDEA-001) | yes for BRIDGE projects; `active` for plain electrician work |
| Q-R12 | Routing order: strict role order (MAINS, LV, BUSB, CONTROL, DATA, SENSOR, HMI, MEDIA, USB, SECURITY), or **MEDIA right after MAINS**? AOC cables need M40 and gentle bends, so they should claim the straight chases first | MAINS → MEDIA → the rest → SECURITY |
| Q-R13 | Portal and spine T-boxes collect several families: partitioned boxes, or one box per family side by side? | one per family; partitioned only for MAINS + one SELV family |
| Q-R14 | Bathroom: may the bathroom's own silver paths enter through its wet walls, or only through the walkway wall with RBX01 (K29)? | walkway wall only |
| Q-R15 | Bronze paths: drawn by hand (as you will for the kitchen test), or auto-routed like silver ones, on the 230 V golden lane where it passes? | auto-routed, preferring the 230 V lane's chases |
| Q-R16 | Endpoint tolerance for clustering (R18): ± 150 mm for higher layers, 0 for MAINS? | yes |

## 6. The next round, once the answers are in

| step | what | size |
|---|---|---|
| R1 | `ROUTE_RULES` table (zones, spine, tolerances, capacities, costs) + per-room route type + project switch height | S |
| R2 | W-type auto-router: graph from walls / zones / marks, foundation-first buy-at-bulk routing over E2's graph, T-boxes at spine junctions (closes F6) | L |
| R3 | F-type auto-router on the same engine (floor channels, wall risers at both ends) | M |
| R4 | Usage sets, installed = used, the "reserve" view, provisioned segments as `SPARE` pipes | M |
| R5 | Layer selection UI + "re-route for this selection" + the acceptance pair as a spec | M |
| R6 | Mixed mode: primary / secondary, family split, the no-double-count invariant in the fill | M |
| R7 | IDEA-001 cluster housings (after R2, because clusters are network nodes) | M |

Phase 3 of the client preview (endpoint → its circuit lit up to the Elosztó) runs in parallel. It
needs only runs, which E3 already produces, and your hand-drawn bronze path in v1.

## 7. Answers — 2026-10-09 (tuner pack `PLANNER-ROUTE-Q-001` r0, 17 / 17)

| # | answer | vs my default | your note → what it means |
|---|---|---|---|
| M01 | **C** — build with B, select with A, provision on purpose | same | — |
| R01 | **A** — spine a fixed line at ceiling − 300 | same | — |
| R02 | **B — switches at 1100** | **changed** (was 1300) | *"the 1300 area can carry smart control, panel, room control, etc."* → a **smart-control band around 1300** (panels, room control, NTL-class indicators) sits above the 1100 switch line in the same column |
| R03 | **C** — floor routes parallel by default, diagonal per room when allowed | **changed** (was parallel only) | a per-room "diagonal allowed" flag |
| R04 | **B — ceiling (C) as a full third type now** | **changed** (was "only with an álmennyezet mark") | *"for lamps, sensors and other layers' devices where it makes sense — otherwise keep smart-option additional flush space to a minimum. With álmennyezet it can even be a main carrier territory of the wireways (like in an office)."* → C carries ceiling-mounted endpoints everywhere; in an álmennyezet room it may carry everything |
| R05 | **C — mixed everywhere by default** | **changed** (was W default) | with R06: **primary W for MAINS, secondary F for SELV / data**, per family; per-room overrides stay |
| R06 | **A** — mixed split per family | same | — |
| R09 | **A** — doors crossed at the spine in W rooms, at the threshold in F rooms | same | under R05 both apply per family: MAINS over the door, SELV / data under the threshold |
| R07 | **A** — chase capacity 4 × M20 / 3 × M25 | same | still ⚑ to verify |
| R08 | **A** — neighbouring clusters may share a riser where families allow | same | — |
| R13 | **B — partitioned boxes wherever families meet** | **changed** (was one box per family) | the IDEA-002 K3 partitioned housing (200 × 200 + divider) becomes the default wherever families meet: portal boxes, spine T-boxes, mixed clusters |
| R16 | **A** — ± 150 mm for higher layers, 0 for MAINS | same | — |
| R10 | **A** — provisioned conduit per cluster, to the spine | same | — |
| R11 | **A** — full-size housings for BRIDGE, active-only for plain work | same, plus | *"but suggest if another size would be sufficient"* → the sizing reports the smallest sufficient housing beside the full-size choice |
| R12 | **A** — MAINS → MEDIA → the rest → SECURITY | same | — |
| R15 | **A** — bronze paths auto-routed, preferring the 230 V lane | same | — |
| R14 | **A** — bathroom paths only through the walkway wall (K29) | same | — |

**Effect on the round plan (§6):**
- R1 carries the switch line (1100) and the smart-control band (≈ 1300) as project settings.
- R3 grows to F **and** C: the ceiling type is no longer conditional on an álmennyezet mark.
- R6's mixed mode is the default from the start rather than an option.
- R7 uses partitioned K3 housings wherever families meet, and reports the smallest sufficient housing.

**Effect on the P33 test plans:**
- `P33-teszt_v1` / `_v2` still place switches at 1300 (the old default).
- R02 moves them to 1100 and turns 1300 into the smart band. v2's door columns then read SWI 1100 · NTL / PAN / THR in the 1300 band.
- Regenerating the two plans is one command each; it waits for your go, because v1 may already carry your hand-drawn bronze path.
