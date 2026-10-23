# BRIDGE-STD-004 — Naming, Addressing and the Control Backbone

**Doc:** BRIDGE-STD-004 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §7.3/§10.3 · BRIDGE-STD-001 §3.1
**Closes:** U1 naming and addressing · U2 BRIDGE_LINK specification · resolves **D5** ·
writes **C2-T** as a decision rule
**Scope:** what things are called, how they are addressed, and how COMP talks to a RoomBox when
the network is not involved.

> **r2 confirms the scheme.** **B21 = A** (flat ARM reference) and **B22 = B** (typed endpoint
> prefix) were both chosen, so the contingency in r1 is resolved. **E11 made the type codes three
> letters** rather than two — see §1.2. Other r2 changes: heartbeat loss at **5 s**, CAN pair
> **reserved and not wired**, and the Planner renumber guard confirmed as a **hard block**.

---

## 1. The reference scheme (U1)

### 1.1 Shape

```
    CLA  .  R03  .  LMP2
     │       │       │  └─ index within type, 1-based
     │       │       └──── three-letter type code
     │       └──────────── room, two digits, stable, never reused
     └──────────────────── project code
```

| Form | Separator | Used for |
|---|---|---|
| **Canonical** | `.` | `CLA.R03.LMP2` — documents, schedules, the Planner |
| **Label** | `-` | `CLA-R03-LMP2` — printed on hardware; matches STD-001 §3.3's conduit labels |
| **Machine** | `_`, lowercase | `cla_r03_lmp2` — Home Assistant `unique_id`, MQTT topics, filenames |

**Three rules that keep it usable for twenty years.**

1. **Room numbers are stable and never reused.** If a room is demolished, its number dies with
   it. Renumbering invalidates every label, photograph and as-built in the house.
2. **The reference identifies a *position*, not a product.** `R03.LMP2` is "the second luminaire
   position in room 3." Replace the fixture and the reference is unchanged — which is what makes
   the scene model in STD-002 §8.1 survive hardware change.
3. **References are for machines; names are for humans.** Home Assistant carries the reference as
   `unique_id` and a friendly name — "Living ceiling 2" — for display. Never make a person read a
   reference, and never make a machine depend on a name.

### 1.2 Type codes — three letters (E11)

**Three letters, uppercase, mnemonic, no collisions.** Two would have worked; three removes any
future argument and costs two characters on a label. The rule that keeps it extensible: **never
abbreviate two different things to the same code.**

| Code | Element | Code | Element |
|---|---|---|---|
| `RBX` | RoomBox | `SEN` | sensor point |
| `DIS` | zone distributor *(Melléklet 1/A)* | `POR` | portal *(STD-003 §2)* |
| `LMP` | luminaire | `SPK` | speaker position |
| `LNR` | linear / integrated LED run | `CAM` | camera |
| `SOC` | socket outlet | `ACP` | access point |
| `SWI` | wall switch | `PAN` | panel / HMI |
| `SHU` | shutter motor | `THR` | thermostat |
| `NTL` | **notification light** *(STD-008)* | `ACT` | actuator, other |
| `UEP` | universal endpoint position | | |

**Two exceptions keep their short forms, deliberately.** `A` for ARM — `CLA.R03.A2`, flat, with
layers as an attribute rather than in the name (B21) — and `C1…C5` for CHANNEL conduits, because
STD-001 §3.3 already prints `R<room>-C<n>` on every conduit label and changing it would invalidate
labels already in walls.

> **Why `S` needed three letters.** A single letter would have had to serve socket, sensor, speaker,
> switch and shutter — five things, one character. Even at two letters, `SE`/`SP`/`SW`/`SH`/`SO` is
> five near-identical pairs that a tired person misreads at the end of a day's labelling.
> `SOC` `SEN` `SPK` `SWI` `SHU` do not get confused.

### 1.3 Worked examples

| Reference | Means |
|---|---|
| `CLA.R03.C3` | room 3's CONTROL conduit |
| `CLA.R03.A2` | room 3's second ARM — layers recorded as an attribute, not in the name |
| `CLA.R03.LMP2` | second luminaire position in room 3 |
| `CLA.R03.LNR1` | first linear lighting run in room 3 (a cove, say) |
| `CLA.R03.NTL1` | first notification light in room 3 |
| `CLA.R03.UEP1` | first universal endpoint position in room 3 |
| `CLA.POR.R02.R03` | the portal between rooms 2 and 3 — **order implies direction**: R02→R03 is "in" |
| `CLA.RBX03` | room 3's RoomBox. Boxes are keyed to the room, so no index |
| `CLA.DIS03.1` | first zone distributor in room 3 |

### 1.4 Shared namespace with the Planner

The Planner already models rooms by reference rather than id, and devices by id. BRIDGE adopts
the Planner's **room reference as its own `R<nn>`** — one room numbering for both, with the
Planner as the authority. A BRIDGE endpoint reference is then derivable from a Planner device
record, and the Planner's conduit and path work keys to the same `C<n>`.

**The one rule this imposes:** a room may not be renumbered in the Planner once BRIDGE labels
exist in the fabric.

**E02 confirms this as a hard block, not a warning.** The Planner refuses to renumber a room that
carries a `bridgeLabelsIssued` flag, with a deliberate override that requires acknowledging what it
invalidates. A warning is the wrong mechanism here: renumbering invalidates **every printed label,
photograph and as-built in the house**, and the damage is silent and discovered years later. The
Planner also owns the conduit and cable schedule (B28) and the as-built photographs keyed to the
room (A07), so it is the right place for the guard to live — all three depend on the same number.

---

## 2. Address allocation

### 2.1 BRIDGE_LINK (RS-485) node addresses

Modbus permits 1–247; 0 is broadcast and 248–255 are reserved.

| Range | Allocation |
|---|---|
| **1–99** | RoomBox sub-controllers — **address = room number** (E09). `RBX03` is address 3 |
| **100–149** | Edge RoomBoxes and zone nodes that have no room number of their own |
| **150–199** | Non-room nodes: PANEL LINK metering gateway, BASE service node, RB-E/T |
| **200–247** | Spare |
| 0, 248–255 | Reserved — never allocated |

Address equals room number, so no lookup table exists to fall out of date. Uniqueness is
enforced globally even though RS-485 only requires it per channel.

### 2.2 VLANs

ARCH-002 §4.2 names four; a working network needs six.

| VLAN | Name | Carries |
|---|---|---|
| **10** | Trusted | workstations, phones, the COMP management interface |
| **20** | IoT + Audio | ESPHome nodes, Snapcast clients, protocol coordinators, panels |
| **30** | Cameras | cameras and the NVR. No route out |
| **40** | Guest | internet only, isolated from everything |
| **50** | Security | the provider's IP module only *(ARCH-002 §12.4)*. No route out, no route in |
| **99** | Management | switch, AP and PDU management interfaces |

**Inter-VLAN rules.** Trusted reaches everything. IoT reaches the MQTT broker and nothing else
outbound. Cameras and Security reach nothing and nothing reaches them except the NVR and COMP on
named ports. Guest reaches only the internet.

### 2.3 IP plan

`10.<project>.<vlan>.0/24` — the project code lives in the second octet, so two BRIDGE houses
never collide on a VPN.

```
   10.33.10.0/24   Trusted        10.33.40.0/24   Guest
   10.33.20.0/24   IoT + Audio    10.33.50.0/24   Security
   10.33.30.0/24   Cameras        10.33.99.0/24   Management
```

| Host range | Use |
|---|---|
| `.1` | gateway |
| `.2–.9` | infrastructure — switch, AP controller, broker |
| `.10–.99` | static assignments, from the schedule |
| `.100–.199` | DHCP pool |
| `.200–.254` | reserved — temporary, test, commissioning |

Deliberately not room-encoded. Encoding the room in the host octet looks elegant and breaks the
first time a room needs more than its allotment.

---

## 3. BRIDGE_LINK — the specification (U2, resolves D5)

### 3.1 The decision

ARCH-002 §15 offers "ESPHome over RS-485, Modbus RTU, or CAN." The first is not a real option as
written — ESPHome's native API is TCP/IP and has no RS-485 transport. In practice "ESPHome over
RS-485" means an ESPHome node speaking **Modbus RTU** or a custom UART protocol. So the choice is
Modbus RTU against CAN.

| | **Modbus RTU** | **CAN 2.0B / FD** |
|---|---|---|
| Ecosystem | universal — every DIN meter speaks it, and **PANEL LINK is already specified as Modbus** (ARCH-002 §4.3) | nothing off-the-shelf in this domain |
| ESPHome / HA | native both ends — `modbus_controller`, HA Modbus integration | `canbus` exists, lower level, no HA path |
| Model | register map — maps cleanly onto "watch every relay and input" | message-oriented, needs a protocol designed on top |
| Timing | **polled** — latency is the cycle time | event-driven, deterministic, prioritised |
| Errors | CRC only | automatic retransmission, fault confinement, excellent |
| Electrical | robust | more robust |

**Decision: Modbus RTU on pair 1. CAN reserved on pair 2 as the upgrade path** — exactly what
ARCH-002's pair allocation already anticipated.

### 3.2 Why polling is acceptable here — and it would not be in most designs

**The manual path never traverses BRIDGE_LINK.** A wall switch acts on the bistable relay in Z1,
locally, in hardware, per the ζ/η families. BRIDGE_LINK carries *coordination*, not actuation of
the human's intent. So a 400 ms poll cycle costs nothing a person can perceive.

This is manual-first paying a dividend it was not designed for: because the physical path is
guaranteed independently, the digital path is free to be slow, simple and cheap.

### 3.3 Physical and electrical

| Parameter | Value |
|---|---|
| Medium | 1 × Cat6A S/FTP in conduit C3 (M20), per STD-001 §3.1 |
| Pair 1 | RS-485 A/B — Modbus RTU |
| Pair 2 | **reserved, not wired or terminated (E10)** — see below |
| Pair 3 | **life signal / interlock** — see §3.6 |
| Pair 4 | reference ground + spare |
| Baud | **38400**, 8N1, no parity |
| Topology | multidrop; **≤ 8 nodes per channel** (§3.7), ≤ 32 unit loads absolute |
| Termination | 120 Ω at **both physical ends only** |
| Bias | fail-safe bias at the COMP end only |
| Isolation | galvanic at every node — ARCH-002 §4.3 requires it at COMP; this requires it at the RoomBox too |
| Shield | earthed at the **BASE end only**. Do not "improve" this by bonding both ends |
| Power | **none on BRIDGE_LINK** |

### 3.4 Register map

A fixed map, identical on every node, so a node's class is discovered rather than configured.
Unimplemented registers read zero.

**Coils — read/write, commands out**

| Offset | Function |
|---|---|
| 0–15 | lighting relay channels 1–16 |
| 16–23 | socket relay channels 1–8 |
| 24–31 | shutter channels 1–8 *(up/down interlocked in hardware, never in firmware)* |
| 32–47 | general actuator channels |
| 48 | egress latch — asserts the STD-002 §7.2 fallback |
| 49 | identify — flash the box status LED, for commissioning |
| 50–63 | spare |

**Discrete inputs — read-only, physical state in**

| Offset | Function |
|---|---|
| 0–15 | wall switch inputs 1–16 |
| 16–31 | door and window contacts 1–16 |
| 32 | box door / tamper |
| 33 | water ingress |
| 34 | bus B active (running on battery) |
| 35 | autonomy active |
| 36–63 | spare |

**Input registers — read-only, measurement and status**

| Offset | Function |
|---|---|
| 0 | protocol version — currently 1 |
| 1 | node class: 1 RB-S · 2 RB-M · 3 RB-L · 4 RB-H · 5 RB-O · 6 RB-E |
| 2 | uptime, minutes |
| 3 | status bitfield: b0 link ok · b1 autonomy · b2 fault · b3 bus B · b4 over-temperature · b5 branch fault |
| 4–5 | PSU temperature, box air temperature — 0.1 °C signed |
| 6 | box relative humidity, 0.1 % |
| 7 | spare |
| 8–15 | SELV branch currents 1–8, mA |
| 16–31 | sensor values — T, RH, CO₂, VOC, lux, presence score, per node schedule |
| 32–63 | dimmer actual levels, 0–1000 |
| 64–87 | spare |
| **88–127** | **event ring** — 8 slots × 5 registers, see §3.5 |

**Holding registers — read/write, setpoints and policy**

| Offset | Function |
|---|---|
| 0 | heartbeat counter — COMP increments each cycle |
| 1 | link timeout, seconds, before autonomy |
| 2 | autonomy policy: 0 hold last · 1 safe scene · 2 all off |
| 3 | last consumed event sequence — COMP writes it to drain the ring |
| 4–7 | config / reserved |
| 8–39 | dimmer setpoints, **0–1000 = perceptual `s` × 1000** |
| 40–47 | CCT setpoints, Kelvin |
| 48–55 | scene selector per layer: AMBIENT, TASK, ACCENT, PRACTICAL, EGRESS |
| 56–127 | node configuration |

> **The curve lives in the node.** A dimmer setpoint is **perceptual `s`**, not duty. The node
> applies `s³` per STD-002 §2.2 and the per-fixture correction. The wire carries *intent*; the
> node owns the physics. Change a driver and nothing upstream changes.

### 3.5 The event ring — why polling does not lose a doorway crossing

A portal crossing lasts roughly 300 ms. At a 400 ms poll it would be missed or mis-ordered,
which would wreck the STD-003 graph. So **events are latched in the node, not sampled by COMP.**

Eight slots of five registers each, at input registers 88–127:

| +offset | Field |
|---|---|
| 0 | sequence number — increments, wraps; **0 means empty** |
| 1 | event type |
| 2–3 | timestamp, 32-bit ms since node boot |
| 4 | payload — channel, direction, or classification |

| Type | Event | Payload |
|---|---|---|
| 1 | portal crossing **in** | portal index, classification *(adult / child / pet)* |
| 2 | portal crossing **out** | as above |
| 3 | switch edge | input index, new state |
| 4 | contact opened | contact index |
| 5 | contact closed | contact index |
| 6 | tamper | — |
| 7 | water ingress | — |
| 8 | branch fault | branch index |
| 9 | autonomy entered | reason |
| 10 | autonomy exited | duration, seconds |

COMP reads the ring each cycle and writes the highest consumed sequence to holding register 3;
the node may then reuse those slots. **Ring overrun sets status bit b2 and raises a type-8
event** — a lost event is reported, never silently dropped.

This is the mechanism that makes a slow, simple, polled bus adequate for an event-driven sensing
architecture.

### 3.6 Pair 3 — the life signal

ARCH-002 allocates this pair and never says what it carries. It carries two opto-isolated
one-way signals, returning on pair 4's reference ground:

| Conductor | Direction | Function |
|---|---|---|
| 3a | COMP → node | **1 Hz square wave.** Its absence for **> 5 s** (E06) means COMP is gone |
| 3b | node → COMP | **open-collector fault line.** Any node may pull it to flag a fault out-of-band |

**Why this is separate from a Modbus timeout.** A Modbus timeout is ambiguous — a collision, a
bad CRC, one dropped poll. A dead hardware heartbeat is unambiguous and arrives in five seconds
rather than after a retry schedule. The node enters autonomy on the heartbeat, not on the
protocol. And 3b lets a node in trouble be noticed even if it cannot win the bus.

**r2 raised the window from 3 s to 5 s (E06).** Five missed beats rather than three, which buys
margin against a momentary interruption at the cost of two seconds before autonomy engages. Since
autonomy's first act is to **hold last state** — the least disruptive possible response — a slower
trigger costs almost nothing and a spurious one is more annoying than a late one.

### 3.6a CAN on pair 2 — reserved, not wired (E10)

The pair stays allocated and unterminated. Reserving it costs nothing; wiring it now would mean
commissioning a bus with no device on it.

**CAN's advantages over Modbus are event-driven messaging and multi-master, and the event ring
(§3.5) already solves the first** — which was most of why CAN looked attractive. Worth recording
for whoever reads this later: **if channel capacity ever becomes the constraint** (more than eight
nodes on one run, §3.7), **a second RS-485 segment on pair 2 is a far more likely use than CAN.**

### 3.7 Timing budget

At 38400 baud, 8N1, a typical cycle per node is two transactions — discrete inputs plus input
registers including the event ring — around 140 bytes with turnaround, so **≈ 50 ms per node**.

| Nodes per channel | Cycle time | Verdict |
|---|---|---|
| 4 | 200 ms | comfortable |
| **8** | **400 ms** | **the design limit** |
| 16 | 800 ms | event reporting latency becomes noticeable |

**Rule: ≤ 8 nodes per channel.** ARCH-002 §4.3 already specifies one channel per RoomBox plus
spares at COMP, so this is generous in practice — the limit matters only where channels are
consolidated.

### 3.8 Autonomy — what ARCH-002 promises and never specified

| State | Behaviour |
|---|---|
| **Linked** | COMP commands, node executes, node reports. Normal operation. |
| **Autonomy** — heartbeat lost > 3 s, or Modbus silent beyond the configured timeout | Outputs **hold last commanded state** (or the configured policy). Local wall inputs continue to work through the node's own logic. Automations flagged `autonomous` continue — bathroom presence light, leak-to-valve. Anything needing house context is suspended: scenes, cross-room presence, schedules, circadian. The node logs to its event ring and raises a type-9 event. |
| **Reconnect** | COMP reads status, sees the autonomy flag and its duration, **reconciles rather than reasserts.** |

> **COMP must not blindly restore its pre-loss state on reconnect.** A person may have changed
> things by hand during the outage, and overriding that would be the worst possible behaviour
> from a manual-first system. Reconnection reads actual state, adopts it, and applies the
> STD-002 §8.3 manual hold-off as though the change had just been made by hand — because it was.

---

## 4. C2-T — the centralise-versus-distribute rule

The basis is the **autonomy requirement**, not room count.

> **Distribute if any room requires autonomy. Otherwise centralise.**

A room **requires autonomy** if any of these hold:

1. It carries a **safety-relevant local automation** — bathroom presence or egress light,
   leak detection driving a valve, stair egress.
2. Its occupant **cannot readily reach another control point** — a bedroom at night, a bathroom
   with the door shut.
3. Loss of control would **strand a load in a poor state** — a shutter mid-travel, heating
   mid-cycle, a motor energised.
4. It is **beyond one floor or one fire compartment** from the consumer unit, so a fault there is
   plausibly independent of a fault here.

**Consequence.** Almost any dwelling with a bathroom, or with bedrooms on a different floor from
the cabinet, requires distribution. The centralised variant is genuinely for small single-level
flats — which matches the intuition behind choosing a size-based rule in the first place, while
giving a reason instead of a number.

**What the centralised variant gives up:** local autonomy, last-state hold, and independence from
a single point of failure. **What it keeps, and why it is tolerable at all:** the ζ/η bistable
relay is local to the circuit in both variants. Manual control survives the loss of a central hub
regardless. **Centralisation is only defensible because manual-first is implemented in hardware.**

---

## 5. Commissioning — the CONTROL layer (continues U8)

- [ ] Verify **120 Ω termination at both physical ends only**, and nowhere in between.
- [ ] Verify **fail-safe bias at the COMP end only**.
- [ ] Verify the shield is earthed **at BASE only** — measure for continuity to earth at the far
      end and confirm there is none.
- [ ] Confirm galvanic isolation at every node, COMP included.
- [ ] Confirm node address equals room number, and that no address is duplicated.
- [ ] Read input register 0 on every node and confirm the protocol version matches.
- [ ] Read input register 1 and confirm the node class matches the installed RoomBox class.
- [ ] Measure the **actual poll cycle** per channel; confirm ≤ 500 ms and ≤ 8 nodes.
- [ ] **Event ring:** generate 20 rapid events, confirm all 20 arrive in order with sane
      timestamps, and confirm an overrun raises type 8 rather than dropping silently.
- [ ] **Heartbeat:** cut pair 3a, confirm autonomy within 3 s and a type-9 event.
- [ ] **Autonomy:** with COMP down, confirm wall inputs still work, outputs hold last state, and
      `autonomous`-flagged automations still run.
- [ ] **Reconnect:** change a light by hand during an outage, restore COMP, and confirm it
      **adopts** the hand-set state rather than reasserting its own.
- [ ] **Fault line:** pull 3b at a node, confirm COMP reports it.
- [ ] Confirm `identify` (coil 49) flashes the correct box.

---

## 6. Open items

| Ref | Open |
|---|---|
| **D1** | The room list. Address allocation is "address = room number" (E09), which needs the room numbers to exist |
| **U22** | CLA's hardware composition — a project build document, not a standard. Proposed as `CLA-BUILD-001` |
| — | The Planner work the scheme depends on: the **renumber hard block** (§1.4, E02), the **conduit and cable schedule** (B28) and the **as-built photo store** (A07). Three features, one shared room reference |

**Closed in r2:** B21 B22 E01 E02 E03 E04 E05 E06 E07 E08 E09 E10 E11, and the r1 contingency on
the identifier scheme. **U3** is STD-006 §1 · **U12** is STD-005 §3 · **C2-T** is §4 of this
document.
