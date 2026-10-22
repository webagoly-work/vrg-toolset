# BRIDGE-STD-001 · Annex A2 — Layer Wiring Reference

**Doc:** BRIDGE-STD-001-A2 · r1 · 2026-10-06 · English
**Role:** the per-layer companion to STD-001 §3 (the CHANNEL) and §6 (the buildup order). For every
layer: what it carries, the cable for each common need, and the wireway that cable needs on its own.
Then which layers may share a *route* — never a conduit.

> **What is measured and what is not.** Conduit inner diameters and cable outer diameters below are
> **typical catalogue values, reasoned rather than measured**. Makers differ by a millimetre or two,
> and on a 16 mm conduit that is the whole margin. **Check the datasheet of the conduit and cable
> actually bought before fixing a size.** The rules in §1 are what to check them against.

---

## 0. The two rules this annex obeys

1. **One layer, one conduit.** The ten conduit families never share a conduit (STD-001 §3.1). The
   SELV standard allows 230 V into a shared conduit only with a sheath certified to ≥ 4 kV; BRIDGE
   does not use that exception.
2. **Layers may share a route.** A chase, a ceiling void, a screed trench, a tray or a
   multi-compartment trunking can carry several layers — **each in its own conduit, or its own
   fixed compartment**. That is what "same physical wireway, separate wireway" means throughout
   this annex. §5 says which pairs may share a route and on what terms.

Several **circuits of the same layer** may share one conduit sized for them — MAINS's "M25 per
circuit group" is that case. It is not layer mixing.

---

## 1. Sizing rules

| Rule | Value | Source |
|---|---|---|
| One cable in a conduit | conduit **ID ≥ 1.4 × cable OD** | reasoned — the pullability margin |
| Several cables | total cable cross-section **≤ 40 %** of the conduit's internal area; **≤ 33 %** on runs with two bends or over 10 m | STD-001 §3.4 (40 %); 33 % reasoned |
| Bends | **≤ two 90°** between pull points | STD-001 §3.3 |
| Bend radius, data and media | **≥ 8 × cable OD** — a sweep, never an elbow | STD-001 §3.3 (B27) |
| Draw cord | in **every** conduit, occupied or empty | STD-001 §3.3 |
| Labels | both ends, `P<project>-R<room>-C<n>` or the ARM reference | STD-001 §3.3, STD-004 §1 |
| When in doubt | **size up one step** — the conduit is the part that can never be changed | — |

---

## 2. The wireway kit

| Wireway | HU | Standard | Where it belongs |
|---|---|---|---|
| Flexible corrugated conduit | **gégecső**, flexibilis védőcső | EN 61386-22 | in walls, screed and ceilings. Light grade (≈ 320 N) in walls, medium (≈ 750 N) in screed |
| Rigid PVC conduit | **merev védőcső** | EN 61386-21 | exposed runs, ceiling voids, long straight pulls. Bends by sweep |
| Surface trunking | **kábelcsatorna** | EN 50085-2-1 | retrofit and visible runs — mini 20 × 10 up to 60 × 40 |
| Dado / parapet trunking | **parapet csatorna** | EN 50085-2-1 | media walls and desks. **2–3 compartments with fixed dividers — each compartment is a separate wireway** |
| Floor trunking | **padlócsatorna** | EN 50085-2-2 | islands and floor outlets where screed conduit is not possible |
| Cable tray | **kábeltálca** | EN 61537 | ceiling voids, BASE joinery, cabinets — with a fixed divider between 230 V and SELV |
| Flush boxes | **szerelvénydoboz** Ø68, deep (≈ 60 mm) for UEPs · **10 × 10 / 15 × 10** for media | EN 60670 | one box per layer; a shared box only behind an internal partition |

### 2.1 Conduit sizes — typical inner diameters

| Size | Flexible, light (mm) | Rigid, medium (mm) | One cable up to OD (flex) | Usable area at 40 % (flex) |
|---|---|---|---|---|
| **M16** | ≈ 10.7 | ≈ 13 | ≈ 7.6 mm | ≈ 36 mm² |
| **M20** | ≈ 14.1 | ≈ 17 | ≈ 10 mm | ≈ 62 mm² |
| **M25** | ≈ 18.3 | ≈ 21 | ≈ 13 mm | ≈ 105 mm² |
| **M32** | ≈ 24.3 | ≈ 28 | ≈ 17 mm | ≈ 185 mm² |
| **M40** | ≈ 31.2 | ≈ 35 | ≈ 22 mm | ≈ 305 mm² |
| **M50** | ≈ 39.6 | ≈ 44 | ≈ 28 mm | ≈ 490 mm² |
| **M63** | ≈ 52.6 | ≈ 56 | ≈ 37 mm | ≈ 870 mm² |

**Every size in this annex is given for flexible conduit**, the worst case. Rigid conduit of the
same nominal size has more room.

### 2.2 Cable outer diameters — typical

| Cable | OD (mm) | | Cable | OD (mm) |
|---|---|---|---|---|
| NYM-J (MBCu) 3 × 1.5 | 8.5–9 | | H05VV-F 2 × 1.5 | ≈ 7.5 |
| NYM-J 3 × 2.5 | 9.5–10.5 | | H05VV-F 2 × 2.5 | ≈ 9 |
| NYM-J 4 × 1.5 | 9.5–10 | | J-Y(St)Y 2 × 2 × 0.8 | ≈ 5.5 |
| NYM-J 5 × 2.5 | 11–12 | | J-Y(St)Y 4 × 2 × 0.8 | ≈ 7 |
| NYM-J 3 × 6 | 12.5–13.5 | | LiYCY 4 × 0.5 | ≈ 6 |
| NYM-J 5 × 4 | 13–14 | | YCYM 2 × 2 × 0.8 (KNX) | ≈ 5.5 |
| NYM-J 5 × 6 | 15–16 | | Cat6A U/FTP · S/FTP | ≈ 7.5 · 8 (slim ≈ 6) |
| H07V-U single 1.5 · 2.5 · 6 | 3.0 · 3.6 · 4.8 | | HDMI AOC | ≈ 4.5 — **the plug is the limit** |
| Speaker 2 × 1.5 · 2 × 2.5 · 4 × 2.5 | 6.5 · 7.5 · 10 | | RG6 coax | ≈ 6.9 |
| Alarm 4 × 0.22 + 2 × 0.5, screened | ≈ 5.5 | | Fibre, simplex | ≈ 3 |

---

## 3. The layers, in buildup order

The order is STD-001 §6's thirteen steps, dependency-ordered: **step 1 alone is a working,
code-compliant manual installation**, and every later step adds to it without disturbing it.
Three of the thirteen — actuation, network, RF — are gear tiers, not conduit families, so they
have no wireway of their own.

### Step 1 · MAINS — 230 V

**What.** Lighting, socket and big-load circuits, from the Elosztószekrény. Room circuits go to
RoomBox Z1; big loads go direct to the appliance, never through a RoomBox. **Own route, on the
opposite side of a corridor from the CHANNEL.**

| Need | Cable | Own wireway |
|---|---|---|
| Lighting circuit, cabinet → RoomBox | NYM-J 3 × 1.5 · *or* H07V-U singles 3 × 1.5 | M20 · *singles:* M16 |
| Socket circuit, S04 style (1.5 mm²) | NYM-J 3 × 1.5 | M20 |
| Two S04 socket circuits on one route | 2 × NYM-J 3 × 1.5 · *or* 6 × H07V-U 1.5 singles | M32 · *singles:* M20 |
| Conventional socket circuit (2.5 mm²) | NYM-J 3 × 2.5 | M25 *(M20 only if the datasheet OD ≤ 10)* |
| Lamp ARM, RoomBox → luminaire, switched | NYM-J 3 × 1.5 | M20 |
| Shutter motor ARM | NYM-J 4 × 1.5 — L up · L down · N · PE | M20 |
| Big load, single-phase 16 A — oven, dishwasher, washing machine, bojler, klíma, AV | NYM-J 3 × 2.5 | M25 |
| Induction hob, single-phase 32 A | NYM-J 3 × 6 | M32 |
| Induction hob 2L + 2N, or three-phase | NYM-J 5 × 2.5 | M25 *(M32 if the datasheet OD exceeds 13)* |
| Sub-board feeder, three-phase | NYM-J 5 × 6 | M32 |
| Klíma indoor ↔ outdoor | maker's 4 × 1.5 (L · N · PE · comms) | M20, on the refrigerant route |

**Sharing.** Mains-to-mains in one conduit is allowed and sized above. **With any SELV layer:
never the same conduit, preferably not the same route.** Where they must run together, keep
≥ 50 mm apart in parallel, or put a fixed metal divider in the tray or trunking; cross at 90°.
A flush box is shared only behind an internal partition.

### Step 2 · LV — SELV 24 / 12 / 5 V, bus A (convenience)

**What.** Made in each RoomBox. Built-in light, ambience, general auxiliary power. **Fails with
mains, by design.** 12 V and 24 V are separate supplies, separate fuses and **separate conduits**.

| Need | Cable | Own wireway |
|---|---|---|
| LED run, short (≤ 5 m, ≤ 2 A) | H05VV-F 2 × 1.5 | M20 *(M16 marginal at OD 7.5)* |
| LED cove, long or centre-fed (≤ 5 A) — size to ≤ 3 % drop, STD-002 §7 | H05VV-F 2 × 2.5 | M20 |
| UEP / stub-out SELV pair (Melléklet 1/A) | 2 × 1.5 | M16 **+ an empty M16 spare beside it** |
| USB-C charging point (PD module fed from LV) | 2 × 1.5 | M16 |

### Step 2b · Bus B — assured 24 V

**What.** From the central LiFePO4 pack (in CLA, R05). Secondary control, egress, step and
handrail light, essential sensors, **NTL-TR notification lights**. Survives mains loss; the
hardwired latch lights egress with no controller in the path.

| Need | Cable | Own wireway |
|---|---|---|
| Pack → each RoomBox | 2 × 2.5 (2 × 1.5 on short runs) | **C4b M20** in the CHANNEL (K25) |
| RoomBox → egress, step, handrail, NTL-TR | 2 × 1.5 | M16 |

**Sharing.** Same route as bus A, **never the same conduit** — a fault on convenience wiring must
not reach the assured bus. That separation is the whole point of having two buses.

### Step 3 · Actuation — gear, not a conduit

Bistable relays, dimmers and shutter interlocks (ζ/η) live in Z1. **Their wiring belongs to other
layers**: the switched lamp feed is a MAINS lamp ARM, and the human's switch is an input.

| Switch input variant | Cable | Own wireway |
|---|---|---|
| SELV pushbutton → bistable input | J-Y(St)Y 2 × 2 × 0.8 | M16, beside the lamp's MAINS conduit on the same ARM route |
| 230 V pushbutton (RC-snubbed, as BRIDGE-DN) | NYM-J 3 × 1.5 | inside the MAINS family |

**This is why ARM names carry no layer (B21):** a switch ARM is a MAINS conduit and a CONTROL
conduit on one route.

### Step 4 · CONTROL — BRIDGE_LINK

| Need | Cable | Own wireway |
|---|---|---|
| COMP → RoomBox | 1 × Cat6A S/FTP — pair 1 RS-485 · pair 2 spare RS-485 / CAN · pair 3 life signal · pair 4 ref + spare | **C3 M20** in the CHANNEL |
| Local RS-485 to a portal, keypad or door-frame point | J-Y(St)Y 2 × 2 × 0.8 · *or* Cat6A S/FTP | M16 · *Cat6A:* M20 |

Shield earthed at the BASE end only (STD-001 §3.1).

### Step 5 · DATA — Ethernet and PoE

| Need | Cable | Own wireway |
|---|---|---|
| NET → RoomBox, uplink + spare | 2 × Cat6A U/FTP | **C1 M25** in the CHANNEL |
| AP, panel, camera or single Ethernet point | 1 × Cat6A | M20 *(M16 only for slim Cat6A ≤ 6.5 mm in rigid conduit)* |
| Double point — desk, media wall | 2 × Cat6A | M25 |
| Camera position, provisioned (D15) | 1 × Cat6A + an LV spare | M20 + M16 |

### Step 6 · Network — gear, not a conduit

Switches, APs, VLANs and addressing ride on DATA. No wireway of their own.

### Step 7 · KNX — if taken

| Need | Cable | Own wireway |
|---|---|---|
| KNX trunk | YCYM 2 × 2 × 0.8, green, KNX-certified | **C5 M20** in the CHANNEL |
| Room line | the same | M16, line or tree — never a loop |

**In CLA KNX is not taken.** C5 is installed empty, and it holds the **DALI reservation** (K25).

### Step 8 · SENSOR

| Need | Cable | Own wireway |
|---|---|---|
| Sensor point — mmWave, CO₂, PIR — power pair + data pair | LiYCY 4 × 0.5 · *or* J-Y(St)Y 2 × 2 × 0.8 | M16 |
| Portal P-2 / P-3 at the door frame — ToF pair, contact, mmWave | LiYCY 6 × 0.25 · *or* Cat6A S/FTP | M16 · *Cat6A:* M20 |
| Leak detector at floor level | LiYY 2 × 0.5 | M16 |
| Thermal array (bathroom primary) | Cat6A, or LiYCY 4 × 0.25 | M20 · M16 |
| Bed vital-signs stub (D13) | SELV pair + signal pair | **two M16** — one per layer — plus a spare |

### Step 9 · RF — a coverage plan, not a conduit

Radios live in the Z4 column. The only cable is an external antenna lead, if one is ever needed:
low-loss coax ≈ 5 mm, kept inside the Z4 column.

### Step 10 · HMI — an endpoint class

| Need | Cable | Own wireway |
|---|---|---|
| Touch panel | Cat6A, PoE (DATA) + an LV pair | M20 + M16, same route |
| Entry multi-point — keypad, fingerprint, NFC | Cat6A S/FTP · *or* J-Y(St)Y 4 × 2 × 0.8 (RS-485 + 24 V) | M20 · M16 |

### Step 11 · MEDIA & AUDIO

| Need | Cable | Own wireway |
|---|---|---|
| MEDIA → RoomBox | HDMI AOC + Cat6A (HDBaseT) | **C2 M40** — sized for the AOC plug (STD-007 §5.2) |
| Media-wall route, screen box ↔ furniture box | user cables, pulled repeatedly | **M50 minimum**, M63 or a 2-compartment parapet csatorna, ends open (STD-007 §5.3) |
| AV position → screen, ≤ 3 m | passive HDMI 2.1 | M32 |
| AV position → screen, longer | AOC with detachable heads · fixed-head AOC | M25 · M40 |
| Speaker, ≤ 17 m | 2 × 1.5 | M16 |
| Speaker, ≤ 27 m | 2 × 2.5 | M20 |
| Stereo pair on one cable | 4 × 2.5 | M25 |
| Subwoofer, line level | screened line cable, or a Cat6A balun | M20 |
| Through a partition to a second screen | — | **M40 sleeve**, offset from the other side's boxes |
| Antenna TV, if any | RG6 | M20 |

### Step 12 · USB

| Need | Cable | Own wireway |
|---|---|---|
| USB 2.0 data point — desk, media wall | USB-over-Cat6A extender pair | M20, **labelled USB, not on the IT network** |
| USB 3.x at the media wall | active optical USB, small heads | M25 |
| Charging only | an LV pair, Step 2 | M16 |

### Step 13 · SECURITY — third party

**Own conduits, parallel to the CHANNEL, never through a RoomBox.** The provider's IP module sits
on VLAN 50 and nowhere else. Star-wired from each RoomBox's security point.

| Need | Cable | Own wireway |
|---|---|---|
| Detector or contact | alarm 4 × 0.22 + 2 × 0.5, screened | M16 each |
| Keypad or bus device | provider's 4-core bus | M16 |
| Siren, outdoor | 2 × 0.75 + 2 × 0.22, screened | M16 |
| SSC → security point | provider's trunk, several cables | M25 |

### NOTIFICATION (STD-008)

**Shares the portal's stub-out box, not its conduit.** NTL-TR runs on bus B (Step 2b): a 2 × 1.5
pair in its own M16, plus an optional data pair in a second M16.

---

## 4. Wireway per layer, at a glance

| Layer | CHANNEL conduit | Typical room wireway | Shares a route with |
|---|---|---|---|
| MAINS | — never | M20 lighting/sockets · M25 big loads · M32 single-phase hob, feeder | MAINS only |
| LV bus A | — made in the box | M16 / M20 | all SELV and data |
| Bus B | **C4b M20** | M16 | all SELV and data, never in bus A's conduit |
| CONTROL | **C3 M20** | M16 / M20 | all SELV and data |
| DATA | **C1 M25** | M20 / M25 | all SELV and data |
| KNX | **C5 M20** | M16 | all SELV and data |
| SENSOR | — | M16 | all SELV and data |
| MEDIA & AUDIO | **C2 M40** | M16–M25 · M40 sleeves · M50–M63 media route | all SELV and data |
| USB | — | M20 / M25 | all SELV and data |
| SECURITY | — own conduits | M16 · M25 trunk | runs parallel to the CHANNEL only |
| *spare* | **C4 M25** | M16 spare at every stub | — |

---

## 5. Sharing a route — the matrix

**Same route, separate conduits** is the normal case. The rows below say where even that needs
care.

| | MAINS | SELV power (bus A · bus B · NTL) | Signal & data (CONTROL · DATA · KNX · SENSOR · MEDIA · USB) | SECURITY |
|---|---|---|---|---|
| **MAINS** | **same conduit allowed**, sized as a group | **avoid the route**; if forced, ≥ 50 mm or a fixed divider, cross at 90° | **avoid the route**; same rule | **avoid the route** |
| **SELV power** | — | same route; **bus A and bus B in separate conduits**; 12 V and 24 V in separate conduits | same route; a few cm from unscreened data in long parallel runs | same route, separate conduits |
| **Signal & data** | — | — | **same route freely**, each in its own conduit — the CHANNEL bundle is the model | same route, separate conduits |
| **SECURITY** | — | — | — | provider's own conduits; **never into a RoomBox** |

**In a multi-compartment parapet csatorna**, a compartment counts as a separate wireway. A
three-compartment trunking can carry MAINS · DATA · MEDIA, provided **the MAINS compartment has a
fixed divider** and its own outlets. This is the cleanest way to build the media-wall route
where conduit is impractical.

---

## 6. Worked example — a media wall on a thin partition (CLA R06, K33)

The R06 media wall stands on a decoupled build-out in front of the R06 / R07 partition. Every
layer reaching it travels **in the build-out's cavity, each in its own conduit**:

| Layer | Wireway |
|---|---|
| MAINS — the AV position's own circuit (NYM-J 3 × 2.5) + the R06 socket circuit (NYM-J 3 × 1.5) | M25 + M20, kept to one side of the cavity |
| MEDIA — C2's onward run from RBX06 (HDMI AOC + Cat6A) | M40 |
| Media-wall route, screen box ↔ furniture box | M63, or a 2-compartment parapet csatorna |
| DATA — screen + AV processor (2 × Cat6A) | M25 |
| AUDIO — front L · C · R (2 × 1.5 each) | 3 × M16 |
| Subwoofer line | M20 to the floor position |
| USB 3.x | M25 |
| Through-partition sleeve to the R07 unit | M40, offset ≥ 300 mm from every R06 box |

MAINS on one side of the cavity, everything else on the other, crossing only at 90° — the
corridor rule of STD-001 §3.3, applied inside a wall.
