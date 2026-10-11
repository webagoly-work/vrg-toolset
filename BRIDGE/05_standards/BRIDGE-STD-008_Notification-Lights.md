# BRIDGE-STD-008 — Notification Lights

**Doc:** BRIDGE-STD-008 · r1 · 2026-10-05 · English
**Origin:** user brief, round-2 answer **D17**
**Parent:** BRIDGE-STD-002 §7 (assured bus) · STD-003 §2 (portals) · STD-006 §1 (arbitration) ·
SELV Melléklet 1/A (stub-out library)
**Scope:** a universal low-level visual output layer — what a unit is, what it can say, where it
goes, how it is powered and how it talks.

> **Why this earns a standard rather than a product note.** A panel tells you things when you walk
> to it. This layer tells you things where you already are. Once an output exists in every room and
> at every doorway, almost anything the house needs to communicate can be expressed through it, and
> the alternative — a screen in every room — is an order of magnitude more expensive, more intrusive
> and worse at glanceable information. It also closes two gaps that were already open: **STD-006
> §1.2 requires a safety override to announce itself**, and this is a cheaper and more pervasive
> announcer than a panel; and **STD-002 §7 wants egress wayfinding**, which the same hardware
> provides on the same assured bus.

---

## 1. The unit

### 1.1 Form

Four RGBW pixels on a short aluminium profile behind an opal diffuser, sized to a standard
Hungarian flush box.

```
        ┌──────── ≈ 67 mm ────────┐          one süllyesztett szerelvénydoboz diameter
        ┌───────────────────────────┐
        │  ◍    ◍    ◍    ◍         │        4 × RGBW, addressable
        └───────────────────────────┘        8–10 mm aluminium profile, opal diffuser
               flush to plaster               reads as a white line when off
```

**The geometry is self-consistent, which is a good sign.** A 60 LED/m addressable RGBW strip puts a
pixel every 16.7 mm, so **four pixels occupy 67 mm — one box diameter.** Nothing has to be designed
around; the standard density and the standard box already agree.

| | Value |
|---|---|
| Pixels | **4, individually addressable RGBW** |
| LED | **WS2814** (12 V) for LV variants — 4-wire addressable RGBW, tolerant of voltage drop · **SK6812** (5 V) for USB and portable variants |
| Profile | 8–10 mm aluminium, ~70 mm, opal diffuser, flush to the finished surface |
| Appearance off | a thin white line on white plaster. Near-invisible, which is the point |
| Peak draw | ~1.6 W all pixels full white · **typical notification use < 0.2 W** |

### 1.2 Why four addressable pixels and not one light

Four pixels is the difference between a lamp and a language. It gives four independent dimensions
to encode with, from one cheap part:

| Dimension | Carries |
|---|---|
| **Hue** | category — what kind of thing happened |
| **Pixels lit, 1–4** | magnitude, count or progress |
| **Position and sweep** | direction — which way to go, or which side it concerns |
| **Rhythm** | urgency |

A single RGBW light has only hue and rhythm. Adding position and magnitude for the cost of three
more diodes is the best value in the whole subsystem.

### 1.3 Variants

| Code | Form | Input | Comms | Use |
|---|---|---|---|---|
| **NL-F/L** | flush, in a szerelvénydoboz | **24 V** from the RoomBox LV rail or the assured bus | wireless, USB-data fallback | **the default** in new work |
| **NL-F/A** | flush | **230 VAC**, local AC-DC module | wireless | where no LV rail reaches — retrofit, S-A scenario |
| **NL-P** | portable | **USB-A plug** + 18650 | wireless only | desk, bedside, workshop, anywhere temporary |
| **NL-S** | surface profile | USB or 24 V | wireless | retrofit where no box can be sunk |

**NL-F/L is the reference.** It needs nothing the stub-out library does not already provide: the
Melléklet 1/A element is a flush box with a SELV pair, a signal pair and a spare conduit — which is
exactly an NL-F/L's requirement. **No new pathway is introduced anywhere in this standard.**

---

## 2. The alphabet

A signalling layer is only useful if its vocabulary is small, fixed and never improvised. Seven
categories, and one of them is reserved.

| Hue | Category | Examples |
|---|---|---|
| **White**, very low | orientation | night marker, "the system is alive", egress wayfinding |
| **Amber** | attention, not urgent | reminder, delivery, laundry finished, filter due |
| **Cyan** | information | someone at the door, a message, a call |
| **Green** | confirmed | identity accepted, armed, all clear, task complete |
| **Violet** | occupancy | room in use, do not disturb, follow-me audio active here |
| **Blue** | environment | window open, air quality, temperature out of band |
| **Red** | **fault and alarm — reserved** | and nothing else, ever |

> **Red is reserved and the reservation is the whole point.** A layer that signals a finished
> dishwasher in red has destroyed its own emergency vocabulary. Nothing routine is ever red.

**Rhythm**

| Pattern | Meaning |
|---|---|
| steady | a state that persists |
| slow breathe, ~2 s | ambient, ongoing, no action needed |
| single pulse | an event just happened |
| fast blink, ~2 Hz | needs action now |
| sweep along the four pixels | direction — go this way, or this side |

**Two rules that keep it readable**

- **One category per unit at a time.** Precedence follows STD-006 §1.1 — safety outranks everything,
  and a P1 state suppresses the rest rather than queueing behind it.
- **Brightness follows the room's scene.** At night an NL runs at 1–2 %, like the egress layer in
  STD-002 §6, not at the level it would use at midday. A notification that wakes someone is a
  failure regardless of what it was trying to say.

---

## 3. Placement doctrine

The brief sets the requirement precisely: an occupant should **always be in front of one when
stationary, and pass one when moving between rooms.** That resolves into three classes.

| Class | Where | Height | Rationale |
|---|---|---|---|
| **NL-ST** stationary-facing | in the line of sight from habitual positions — facing the sofa, the bed, the desk, the kitchen work position | **1100–1200 mm**, seated eye level | the "always in front of one" half of the requirement |
| **NL-TR** transit | **beside every portal**, on the latch side | **1100 mm**, the Melléklet 1/A switch band | the "pass one between rooms" half |
| **NL-ND** node | beside the Bridge Computer, and inside or beside every RoomBox | at the unit | system state: link, autonomy, fault, assured bus active |

### 3.1 NL-TR co-locates with portals, and that is the significant finding

STD-003 §2 puts a **portal** at every significant doorway, and STD-001 §4 already allocates a
**door frame point ARM** to every room. The entry-zone pattern in Melléklet 1/A already puts a
multi-point beside the door at 1100 mm.

So an NL-TR needs **no conduit, no box and no height that is not already specified.** It shares the
stub-out with the portal and the door multi-point. The transit layer is, physically, free.

### 3.2 Heights reuse existing bands

Nothing new enters the height schedule. NL-ST and NL-TR both sit in the **1100 mm** band that the
SELV standard already defines for switch-type controls and wall panels, which is also seated eye
level. NL-ND sits at its host unit.

---

## 4. Power

| Variant | Normal supply | On mains loss |
|---|---|---|
| **NL-F/L** | 24 V convenience bus | **continues on the assured bus** where connected — see §5 |
| **NL-F/A** | local AC-DC from a 230 V circuit | dead, unless paired with a local emergency DC module |
| **NL-P** | 18650, topped by USB | continues — **days** of intermittent use per charge |
| **NL-S** | USB or 24 V | per its input |

**NL-P runtime.** An 18650 at ~2500 mAh holds about 9 Wh. Notification use averages well under
0.2 W, but the radio dominates: an ESP32-C3 cycling between light sleep and ESP-NOW wake draws on
the order of 10–20 mA average, giving **several days to a fortnight** depending on duty. USB keeps
it topped indefinitely, and **USB supplies power only by default** — the unit talks wirelessly even
when plugged in.

**The clipped-box pattern**, from the brief's later design logic: a flush NL beside a second
szerelvénydoboz clipped to it holding a local AC-DC module and a small emergency DC cell. That makes
an NL-F/A self-sufficient through a blackout without an assured bus reaching it — the standard
emergency-luminaire pattern, at a fraction of the size.

---

## 5. The emergency role — why this subsystem pays for itself

Put an **NL-TR at every portal, on the assured bus, with the hardwired latch of STD-002 §7.2
behind it**, and the white channel at 5 % along a route becomes exactly the egress wayfinding that
standard asks for.

```
   mains fails
        │
        ├── assured bus takes over            (STD-002 §7.1, no switching gap)
        ├── hardwired latching relay fires    (no controller in the path)
        └── every NL-TR → white, 5 %, steady  → a lit route to the door
```

This is the strongest argument for the whole layer. A notification system is a convenience; a
**wayfinding system that works with the power out and the controller dead** is a safety feature, and
it is the same hardware on the same bus. The same caveat as STD-002 applies without exception:
**this is supplementary.** Where statutory emergency lighting applies it is certified luminaires to
EN 1838 and EN 60598-2-22 on their own supply, and an NL never substitutes for one.

---

## 6. Communications

### 6.1 Primary — ESP-NOW

| | |
|---|---|
| Transport | **ESP-NOW**, 2.4 GHz, **channel 1** to stay inside the STD-005 §3.2 plan |
| Why | connectionless, 1–3 ms latency, no AP association, encrypted peer links — and critically **it works when WiFi and the network are down**, which a layer that must announce "mains failed" has to do |
| Gateway | one **ESP-NOW ↔ MQTT bridge**, at the BASE beside COMP, where an NL-ND sits anyway. Optionally one per RoomBox for range |
| Peer limit | encrypted peers are limited per node, so the swarm is **star-per-gateway**, not a flat mesh. For ~15 units, one gateway plus two relays is ample |

### 6.2 Fallbacks, honestly rated

| Option | Verdict |
|---|---|
| **USB data network** | Real but narrow. Running USB-over-Cat6A to a flush 1.6 W device is a great deal of cable for the job. **Its genuine value is power and commissioning, not routine comms** — and it is the right answer for an NL-ND beside a RoomBox, where USB is extended to Z3 already |
| **Dedicated WiFi sub-network** | Works, costs an association per unit and dies with the AP. ESP-NOW is strictly better here |
| **Sub-GHz** | 868 MHz carries a **1 % duty cycle — 36 s per hour per device**, which is generous for a layer that fires a few times an hour and useless for anything continuous. 433 MHz at ~10 % is more comfortable. Worth it only for an **outbuilding** beyond 2.4 GHz range |

### 6.3 What it must do when it cannot hear the house

An output layer that goes blank on a link failure is worse than no layer. **An NL that loses its
gateway for more than 30 s shows a slow white breathe** — "alive, not connected" — rather than going
dark or holding a stale notification. This mirrors the autonomy semantics in STD-004 §3.8: hold a
defined, honest state rather than a misleading one.

---

## 7. Integration

| Standard | Integration |
|---|---|
| **STD-002 §6** | brightness follows the room's circadian level; the night level governs |
| **STD-002 §7.2** | the assured bus and the hardwired egress latch drive the emergency state |
| **STD-003 §2** | NL-TR shares the portal stub-out. **Nothing new in the fabric** |
| **STD-003 §4** | identity feedback — green pulse on a T2/T3 accept, amber on a low-confidence hold |
| **STD-004 §3.4** | an NL-ND reflects the node's status bitfield: link, autonomy, fault, bus B |
| **STD-006 §1.2** | **satisfies the announcement requirement** for a safety override, in the room where the override is happening |
| **STD-006 §1.5** | shows a two-person conflict as a held state instead of silently picking a winner |
| **STD-007 §1.3** | violet on the unit in a room where follow-me audio is active |

---

## 8. The reference dwelling

For the three-RoomBox layout, ~15 units:

| Class | Count | Positions |
|---|---|---|
| NL-ND | **4** | BASE beside the Computer · RoomBox 1, 2, 3 |
| NL-TR | **≈7** | entry · hall↔living · hall↔kitchen · living↔bedroom · bathroom · WC · spájz |
| NL-ST | **≈4** | facing the sofa · facing the bed · facing the desk · facing the kitchen work position |

### 8.1 Per-unit bill of materials, NL-F/L

| Item | Note |
|---|---|
| 67 mm of 60/m **WS2814 RGBW** addressable strip | 4 pixels |
| Aluminium profile 8–10 mm × ~70 mm + **opal** diffuser | opal, not clear — clear shows four dots instead of one line |
| **ESP32-C3** | WiFi, BLE and ESP-NOW; small and cheap |
| 24 → 12 V buck | sized for 2 W, so trivial |
| Faceplate adapter | to the szerelvénydoboz |

Everything is a stock part and the assembly is a strip cut, a profile, a board and a buck.
**Fifteen of these is a modest afternoon's soldering**, which is what makes the layer realistic at
all — a comparable commercial product per room is not.

---

## 9. Commissioning

- [ ] Verify the opal diffuser reads as **one line, not four dots**, at 1 m and at full output.
- [ ] Verify the unit is near-invisible against the finished wall when off. If it is not, the
      diffuser or the trim is wrong.
- [ ] Verify each unit's brightness tracks the room's night level, and that **nothing exceeds the
      bedroom night level in a bedroom**.
- [ ] Walk every route and confirm the "always in front of one, pass one between rooms" requirement
      actually holds from each habitual position — **sit on the sofa and look.**
- [ ] Verify red appears for fault and alarm only, by auditing what can emit it.
- [ ] Drop the gateway and confirm every unit falls to the **slow white breathe** within 30 s, not
      to dark and not to a stale state.
- [ ] Drop mains and confirm every NL-TR goes **white at 5 %** via the hardwired latch, with no
      controller in the path.
- [ ] Verify ESP-NOW operates on channel 1 and re-measure Zigbee and Thread link quality with the
      swarm active (STD-005 §6).
- [ ] Confirm a safety override in a room lights that room's unit — the STD-006 §1.2 requirement.

---

## 10. Open items

| Ref | Open |
|---|---|
| **Hue set** | Seven categories in §2 are my proposal, not your brief. The reservation of red is the one I would defend hardest; the rest is adjustable |
| **Pixel count** | Four is from the brief and it works. A six-pixel variant would give finer magnitude at the same cost per unit — worth considering for NL-ND where system state is richer |
| **Portable interaction** | The brief's **pendant** (round-2 note on D28: four buttons, four RGBW indicators) is the same vocabulary in a carried device, and overlaps **Site Pager**. All three want one indicator language. Worth unifying before any is built |
| **Gateway redundancy** | One gateway is a single point of failure for the whole layer. Two, with the second at RoomBox 1, costs almost nothing |
| **NL-ST positions** | Depend on furniture layout, which depends on D1 and on the actual plan |
| — | Whether an NL-ND belongs **inside** the RoomBox behind the RF window, or **beside** it on the wall. Inside is tidier; beside is visible with the door shut, which is the point of a status indicator |
