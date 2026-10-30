# Topology View: what the engine cannot follow yet (G1–G8)

*The Topology View lets the user say things the engine (`tools/baseline/plan.js`) does not route yet. Each gap below is
one of those things. Each is a candidate **wiring feature for GO ROUTE** (`GO-ROUTE.md` §2 question 2, §5).*

*Read at `main` + GO ROUTE, 2026-10-29. Line numbers are `tools/baseline/plan.js` unless named otherwise.*

The rule while a gap is open:
- The view **lets the user draw it**, stores it in `d.up`, and shows a CK line `'a motor még nem követi (G<n>)'`.
- The engine **falls back to today's rule** for that link, and its warning names the fallback.
- Nothing is silently dropped (the GO WIRE guard rails).

| Gap | The user's words | What the engine does today | Code | Rule it would satisfy |
|---|---|---|---|---|
| **G1** A plain **kötődoboz** as a tree node | "a kötődoboz … splits wireways … serves as a mini-Elosztó for that room" | Only a **szobadoboz**, RBX or BASE is a service point (`spDevs` :19). A member whose `up` is a plain KD (`jb:'kot'`) finds no SP in `fromTree` (:131), so it **falls back to the nearest service point**. No warning says so. | :19, :120–133 | TR-S2, TR-H1, SR-3 |
| **G2** The **V1 house string** Elosztó → KD → KD → … in its own conduit | "house-wide single circuits like V1 … touching certain Kötődoboz, stringing them up … in their own (often dedicated) conduit" | The home runs are **one channel per service point from the board** (`routeChannels` :194). A hub whose `up` is another hub is not chained, so every hub gets its own home run. There is no `ownPipe`, so packing (:363) may put V1 with others. | :194–205, :363 | TR-H1–H4, SR-4 |
| **G3** **Switching topology** as chosen: chain or star | "leader switch → second switch … tail switch → lamp, or via a common point … a star topology is preferred" | Every switch box is **fed from its service point**. The travellers run switch box → switch box in `u.switches` order (:274–277), and the lamp leg leaves the **head** switch box or the meeting box (`mu`, :280–283). A true star (every switch on the hub, travellers through the hub) is not routed. The csillár riser is 3-core (MP-12). | :255–300 | TR-L1, TR-L4, TR-W2–W4 |
| **G4** **Departures only in a box**; preferred and mandatory KDs | "where these circuits need to depart (which requires Kötődoboz …) preferred or mandatory points" | Boxes come from drops, service points, pull and end rules (§8 :311–341). A circuit leaving a shared stretch **mid-wall** gets no box and no message. The pipes are per circuit in the distribution, so the case is hidden. | §8, §9 :343–419 | SR-2, SR-3, CK-7, CK-13 |
| **G5** **Distribution sharing** | "parallel travelling circuits on the same path … share a conduit" | Trunk pipes are packed by capacity (`pack` :363). In the distribution there is **one pipe per circuit** (:412–419, E5 rule). | :363, :412 | SR-4 (Q-TV15) |
| **G6** The **chain hop as an arc**, socket box to socket box | "vertical wireways going in and going out, creating arcs … next to the horizontal (gerinc) path" | Every wall drop gets a **2-gang leállás box** at the distribution height. Room runs go box to box, then a drop to the device (§8, `addDrop`). | §1, §8 | TR-S5 (Q-TV02) |
| **G7** **Playback** of how the routes were made | "show in quick flashes how routing is set by the engine … circuit by circuit" | The run returns only the result (`R.legs`, `R.spans`). There is no record of the order the links were searched in, nor of the congestion passes. | `routeChannels`, §7 | TV11 |
| **G8** **Negotiated congestion / rip-up** | GO ROUTE: "a PCB-style autorouter" | There is one congestion term on the home runs (`cfg.congest`, :194; the Planner uses 0,05), in a single pass. Room runs have no negotiation at all. | :194–205 | — (GO ROUTE's router core) |

## G1: A plain kötődoboz as a tree node

**Build.**
- `spDevs` takes `jb:'kot'` **as a node, not as a crossing**:
  - it gets `faces` like a szobadoboz;
  - the wall graph keeps "a wall is crossed only at a service point" (PR-3), so a KD never adds a `cross` edge;
  - its role is **hub without crossing** (`sp.cross = false`).
- `fromTree` accepts it as a feed.
- `routeChannels` routes the KD's home run like a szobadoboz's.

**Tests.**
1. A socket whose `up` is a KD in its room is fed from the KD's face, with the home run board → KD.
2. A KD on a wall whose other side is another room: no crossing edge at it.
3. A KD with no `up` → its members fall back, with the warning `'<KD>: nincs betápja — a tagjai a legközelebbi szervizpontból'`.

**Decision:** Q-TV18.

## G2: The house string and its own conduit

**Build.**
- A hub (szobadoboz or G1 KD) whose `up` is another hub gets its home run **from that hub**, not from the board. The
  string is board → H1 → H2 …, and a circuit fed at H2 rides H1's channel, then H1 → H2.
- `c.ownPipe` (05j circuit record, read by `blInput` into `cfg.circuits`) excludes the circuit from packing (`pack`
  takes it alone).

**Tests.**
1. V1 with three KDs in a string: the trunk has board→KD1, KD1→KD2 and KD2→KD3 legs and no board→KD3 leg.
2. `ownPipe` on V1: on every shared stretch V1 is alone in its pipe; the chase count still includes it.

**Decision:** Q-TV07.

## G3: Chain or star switching

The data needs no new field (README §2):
- **Star:** the group's switches and lamps all have `up` = the same hub.
- **Chain:** each switch's `up` is the previous switch, and the lamps' `up` is the tail switch.

**Build:**
- In `L.units`, derive the logic from `up`.
- **Star:** the travellers run hub → each switch (cores per TR-W3: 4 / 5 / 4), the lamp leg hub → lamps, and the hub is
  the meeting box.
- **Chain:** as today, but the lamp leg leaves the **tail** (the last switch whose `up` chain reaches the master) when
  the `up` says so, not always the head.
- MP-12: a csillár feeding ceiling lamps gets a 4-core riser to the first lamp.

**Tests:**
1. Each TR-W3 row: chain and star, with 1, 2 and 3 switches.
2. A group with mixed `up`s → the warning `'<csoport>: sem lánc, sem csillag — a mai szabály szerint'`, and today's
   routing.

**Decisions:** Q-TV05, Q-TV06.

## G4: Departures and KD roles

**Build:**
- After §7, per circuit, walk its loaded edges. A node where the circuit set changes and no box stands is a
  **departure**.
- With a `tpoRole:'pref'` KD on the shared stretch within `cfg.prefPull` (600 mm), the leaving circuit's last search is
  repeated with that KD as a via node. Otherwise, a box `kind:'depart'` is placed (2-gang, distribution height) and
  listed in `R.report.depart`.
- `tpoRole:'must'`: every path that passes its face stretch enters it (a pipe event, as an RBX is).

**Tests:**
1. Two circuits splitting mid-wall → one `depart` box.
2. A pref KD 400 mm away → the split moves into it and no `depart` box is placed.
3. A must KD → the pipes are cut there.

**Decisions:** Q-TV08, Q-TV09, Q-TV10.

## G5: Distribution sharing

**Build:**
- The distribution legs (:412–419) group the runs of different circuits on the same node sequence (they already do,
  `dgroups`), then call `pack` across the circuits instead of per circuit.
- `ownPipe` and dedicated home runs stay alone.

**Tests:**
1. The fig/06 run: A2+A1 → M32, V1 → M20.
2. The practice flat before and after: the pipe count per size, with the difference listed.

**Decision:** Q-TV15.

## G6: The arc hop

**Build:**
- A wall drop whose members are all chain links of **one** socket circuit (each `up` = the previous socket), with no
  branch and no other member, gets **no leállás box**.
- Its room run starts and ends at the device boxes: a riser up, along, and down. The metres are the same path plus
  2 × (distribution height − device height) per hop.

**Tests:**
1. A 4-socket chain: 0 leállás boxes, and 3 hops each with 2 risers.
2. A socket sharing its drop with a switch keeps its box.

**Decision:** Q-TV02.

## G7: A run log for the playback

**Build:**
- `R.log = [{pass, circ, kind:'feed' | 'room' | 'trav' | 'lamp' | 'ceil', from, to, nodes:[…], cost}]`, appended
  where `P()` and `routeChannels` commit a path, in commit order.
- When G8 adds passes, each pass appends its rip-ups as `{pass, circ, rip:true, nodes}`.
- It is not stored in the document; it lives in `BL_LAST` only.

**Test:** the practice flat. Every leg's node list appears in `R.log`, in a stable order (spec: deep-equal over two
runs).

## G8: Negotiated congestion (GO ROUTE)

This is the router core GO ROUTE §0.3 asks about. It is not specified here. The Topology View only needs two things
from it:
- the passes in `R.log` (G7);
- the same `R.legs` shape, so TV9–TV11 work unchanged.

## Order, if the user picks all of them

```
G7 (log, tiny) → G1 (KD node) → G2 (string) → G4 (departures) → G5 (sharing) → G3 (switching) → G6 (arc) → G8 (router)
```

- G1 comes before G2 and G4, which both need a KD to be a node.
- G5 comes after G4: sharing is only honest once departures are in boxes.
- G3 and G6 change cable counts per box, so they come after the box rules.

**Every G-item has to hold three things:**
- spec-98's CLI ↔ bundle parity;
- the practice flat as a **quantity golden** (money-path audit §7.8);
- each changed metre listed in its report.
