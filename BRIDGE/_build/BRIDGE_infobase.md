# BRIDGE — System Information Base

**Working substrate, not a deliverable.** Compiled 2026-10-02 from the 100-file corpus in
`H:/Dev-VRG/VRG-DE/BRIDGE/` (September sweep + `BRIDGEcomp.zip` merge). Language: English.
Purpose: a single analytic surface from which the *BRIDGE System Reference* — layered guide
plus subsystem catalogue — is written. Every uncertainty carries an ID so it can be resolved
by reference.

---

## Part 0 — Corpus, authority and status

### 0.1 Documents that define the system

| Doc | Rev / date | Scale it describes | Status |
|---|---|---|---|
| **BRIDGE-ARCH-001** *Shadow Layer & Unit Fleet Primer* | r2 · 2026-05-27 | Retrofit into a finished home | Doctrine, partly contradicted — see **C1** |
| **BRIDGE Smart Switch** | r1 · 2026-05-27 | Control-authority topologies (ζ/η) | **Authoritative** for switching; supersedes ARCH-A1 |
| **BRIDGE-ARCH-A1** *Parallel Control Topologies* | — | Same ground as Smart Switch | **Superseded** by Smart Switch r1 — see **C4** |
| **BRIDGE SELV 12/24V Telepítési Standard** | Varler Group | Wired SELV signal/power layer | Authoritative for SELV craft; naming collision — **C1** |
| **— Melléklet 1/A** *Kiállás-könyvtár* | — | Stub/outlet library, install methods | Authoritative; new from BRIDGEcomp |
| **BRIDGE-DN · Elosztószekrény** | r1 · 2026-07-11 | One real 48-module consumer unit | **Built/ordered** — the only costed artefact |
| **BRIDGE-ARCH-002** *Alapozó Architektúra Terv* (HU) | r1 · 2026-09-21 | Full new-build infrastructure | **Current architectural authority** |
| **BRIDGE-ARCH-002** (EN original) | — | — | **MISSING** — authoritative language per the HU text |
| `RoomBox_synopsys.md` | — | — | **Not a spec** — the user brief that generated ARCH-002 |
| **P33_BRIDGE_Inline_Architecture** | — | First application of ARCH-002 | Superseded as architecture, live as a case |

### 0.2 Gaps, corrected

The September README listed five missing files and "four of seven Smart-Switch figures." Two
of those claims are now resolved:

- **All seven switch topologies are figured.** The three SVGs are multi-panel sheets:
  `peer-figures.svg` → Single + Dual · `peer-figures-2.svg` → Multi + Cross + End ·
  `gate-figures.svg` → Gate Switch + Smart Cut Switch. Nothing is lost; the inventory
  assumed one file per figure.
- **`BRIDGE_DN_Build_Diagrams.html` is recovered** from BRIDGEcomp (17 KB, the original named
  in the ARCH-002 inventory — distinct from the 2.5 MB `B_DN_Build_Diagrams_BRIDGE.html`).

Still missing, and recoverable only from chat history: the **English ARCH-002**,
`BRIDGE_DN_Balanced_DNE_DNU.md`, `VAULT-buildtree-entry.md`, `vault-buildtree-snippet.js`,
`HID-DECK-concept.md`.

### 0.3 Adjacent, referenced but not absorbed

**Site Pager** (2026-10-01/02) — carried ESP32-S3-Zero + nRF905 pager, *Source → Core →
Indicator*, v1→v1.4, with an ESP-01S relay module on XT60. Lives only as SVGs in `Downloads`.
Decision 2026-10-02: reference, do not absorb.

---

## Part 1 — The multi-layer topology

Six independent axes. A complete description of any part of BRIDGE is a coordinate in all six.

### Axis 1 — Deployment scenario *(the unreconciled fork — see C1)*

| | Scenario | Backbone doctrine | Governing doc |
|---|---|---|---|
| **S-A** | **Shadow** — retrofit a finished home | *No new backbone.* Mains-tap spaces; everything beyond the power point is wireless | ARCH-001 |
| **S-B** | **SELV net** — light retrofit | A modest wired SELV 12/24 V signal+power layer in conduit, star to zone distributors | SELV Standard + 1/A |
| **S-C** | **Full infrastructure** — new build / gut renovation | Ten parallel conduit families, BASE → CHANNEL → ROOMBOX → ARM | ARCH-002 |

S-A and S-C are doctrinally opposed. S-B sits between them and uses S-A's vocabulary for
S-C's kind of object. No document states that these are three scenarios rather than three
successive answers to one question.

### Axis 2 — Physical hierarchy (spatial containment)

```
L0  SERVICE ENTRY ....... Betáp · Elosztószekrény · internet entry        } entry group
L1  BASE ................ NET (top) · COMP (eye level) · MEDIA (bottom)
      ├─ PANEL LINK ..... data-only run, COMP ↔ cabinet metering space
      └─ LAYER TIE ...... reproduces BASE-internal links when layers are split
L2  CHANNEL ............. spine, BASE → RoomBox — physical chain, logical star
L3  ROOMBOX ............. room node · Z1 MAINS · Z2 LV&CONTROL · Z3 DATA/MEDIA/USB
                          Z4 RF · Z5 SENSOR · ZI internal · ZT pass-through (+KNX)
L4  ARM ................. dedicated (one endpoint) or bus (strung junction boxes)
L5  ENDPOINT ............ 19 catalogued types + UEP (universal endpoint position)

  parallel:  SSC ── SECURITY CHANNEL ── security point (per RoomBox) ── star ARMs
```

**Invariants.** BASE always reaches RoomBox 1 directly. Beyond a RoomBox, *everything* is
reached only from that RoomBox. Power from the cabinet, signal from BASE, low voltage made
locally in each RoomBox. Big loads bypass RoomBoxes entirely.

**RoomBox size classes.** RB-S 300×400×90 · RB-M 400×500×110 · RB-L 500×600×110 ·
RB-H 600×600×120 (central/chain) · RB-O 400×500×150 IP65 (outdoor, also carries 24 VAC for
irrigation valves).

**Placement — the L-pattern.** RoomBox on an interior wall near corner 1; ARM A covers that
wall, ARM B the adjacent interior wall — two walls, three corners. The three corners are
simultaneously the minimum anchor geometry for 2D trilateration (Axis 4, emergent layer).
Adjacent RoomBoxes are offset, never back-to-back. Bottom edge ≥ +1.90 m — but see **U9**.

### Axis 3 — Conduit / signal layers (ten; never share a conduit)

| Layer | Carries | Originates | Drawing colour | Per-RoomBox conduit |
|---|---|---|---|---|
| MAINS | 230 VAC circuits | Elosztószekrény | amber | M25 per circuit group |
| LV | SELV 24 / 12 / 5 VDC | RoomBox (made locally) | steel blue | — |
| CONTROL | BRIDGE_LINK, RS-485-class | COMP | magenta | **C3** M20 |
| DATA | Ethernet / PoE | NET | teal | **C1** M25 |
| MEDIA & AUDIO | HDMI-class video, line/speaker audio | MEDIA | violet | **C2** M40 |
| USB | USB extension points | RoomBox | light teal | — |
| KNX *(optional)* | KNX TP bus | KNX PSU | green | **C5** M20 |
| SENSOR | sensor bus + power | RoomBox | yellow | — |
| RF | *not a conduit* — a coverage plan served by DATA/LV | RoomBox nodes | dashed | — |
| SECURITY | external provider's alarm wiring | SSC | red | own conduits |

Plus **C4 SPARE** M25, empty with draw cord.

**Conduit discipline.** ≤ two 90° bends between pull points; pull box every ~15 m; bend
radius ≥ 8× cable OD (Cat6A ≈ 65–75 mm); ≤ 40 % fill on day one; draw cord in *every*
conduit including occupied ones; both ends labelled `<project>-R<room>-C<n>`; photographed
before closing.

**BRIDGE_LINK pair allocation** (Cat6A S/FTP): pair 1 RS-485 A/B · pair 2 second RS-485 or
CAN · pair 3 life signal / interlock · pair 4 reference ground + spare. No power on
BRIDGE_LINK; shield earthed at the BASE end only.

### Axis 4 — Compute and logic (the T-ladder)

| Tier | Role | Where it lives |
|---|---|---|
| **T7** | Operator / agentic interface — voice, LLM, external | above the hub *(the planned AI agent attaches here)* |
| **T6** | Adaptive / predictive — occupancy modelling, anomaly, energy | 1 logical, off-COMP |
| **T5** | **Coordination hub** — HA, state, scenes, logic, UI | COMP |
| **T4** | Sensor fleet (optional) | Z5 + sensor ARMs |
| **T3** | Manual-first actuation — bistable + kinetic/momentary | Z1 / luminaire |
| **T2** | Integrated devices — existing smart, then legacy. *The main event* | throughout |
| **T1** | Base comms gateways — WiFi + BLE proxy; others on demand | Z4 + NET |

**The load-bearing rule.** COMP coordinates and never computes. On COMP: Home Assistant,
MQTT, Zigbee2MQTT / Z-Wave JS / Matter server, ESPHome, Node-RED, firewall, AdGuard.
**Never on COMP:** transcoding, library serving, camera recording, bulk backup, local LLM,
rendering. Those go to MEDIA (full pack) or a dedicated compute node.

**Protocol masters attach to the network, not to COMP by USB** — so NET ↔ COMP stays pure
Ethernet and the layers can be split without redesign. LoRa is a BASE-only protocol; it never
appears in a RoomBox.

**RoomBox sub-controller** (ESP32 class, optionally Pi class): watches every relay and input,
runs local automations, and **holds last state if COMP or the link drops.**

**Emergent wireless layer** — capabilities no single node provides: room-level presence from
BLE RSSI; tag tracking; device location by WiFi+BLE fusion; device-free presence by WiFi CSI;
decimetre positioning with UWB anchors in the three L-pattern corners; confidence-weighted
occupancy fusion. Designed for, never assumed.

### Axis 5 — Control authority (the one true invariant across S-A/S-B/S-C)

Two actors cannot share one load: RF in parallel can only *add* power, RF in series can only
*subtract* and can block the manual. So **every smart switch routes the load through a
bistable memory element**; the load follows the memory, and both manual and RF feed it.
Manual-first then means exactly two things: every manual transition is guaranteed to land,
and on loss of the wireless part the circuit degrades to a clean manual state.

| Family | RF authority | Members | Rest behaviour |
|---|---|---|---|
| **Peer (ζ)** | Full peer — RF permanently powered from the shadow tap | Single · Dual · Multi · Cross · End | RF rests → manual group keeps control |
| **Gate (η)** | Gated — a manual switch decides whether RF has any authority | Gate Switch (sockets) · Smart Cut Switch (lamps) | Gate OFF → socket stays **live**; Cut OFF → manual-only |

The protected guarantee differs by load type: for a **lamp** it is "off means off"; for a
**socket** it is "stays live" — never cut a socket out from under whatever is plugged in.

**The maintained-switch problem.** "Flip the 101 down = off" and "RF can turn on after a
manual off" are jointly satisfiable *only* with a momentary (HU 100) or kinetic/EnOcean
switch, where each press is an unambiguous edge with no stale position. With a maintained 101
you must choose *follow-position* (manual absolute, RF cannot override a held-off switch) or
*edge-toggle* (RF near-equal, but switch position desyncs from lamp state). Recommended
default: momentary or kinetic at control points.

### Axis 6 — Power spine

```
Elosztószekrény ─┬─ BASE NET+COMP   (own MCB · 30 mA RCD · T2 SPD in cabinet, T3 at BASE)
                 ├─ BASE MEDIA      (own circuit)
                 ├─ each RoomBox    (lighting/control + sockets)
                 ├─ SSC ×2          (panel/PSU · sounder/communicator — labelled SECURITY)
                 └─ big loads direct (oven, hob, dishwasher, washer, water heater, EV)

RoomBox:  230 VAC → 24 VDC main SELV rail (safety-isolated PSU; 60 W, 100–150 W for RB-L/H)
                  → 24→12 VDC adjustable rail   → 24→5 VDC internal rail
          PoE from NET = independent power path for controller + RF
          optional LiFePO4 / supercap buffer to ride out mains loss
          every SELV branch leaving the box: individually fused and current-monitored

COMP:     12 V UPS chain, LiFePO4 in-wall, four-source redundancy inherited from OmniComm
```

**SELV electrical rules** (MSZ HD 60364-4-41 / -4-43 / -5-52 §528, MSZ EN 50173, OTSZ
54/2014 BM). SELV is the default class; a deliberately ground-referenced branch (e.g. a
continuity-based touch loop) is **PELV** and must be marked as such; FELV is to be avoided by
using only SELV-rated supplies. **12 V and 24 V stay electrically separate** — separate
supply, separate fuse branch — even inside a shared box; mixing them is the classic way to
destroy endpoint devices. Size conductors to ≤ 3 % drop (12 V, 3 % = ΔU 0.36 V → 0.75 mm²
≈ 17 m @ 0.5 A, 1.5 mm² ≈ 33 m, 2.5 mm² ≈ 56 m; 24 V roughly doubles the reach). Shielded
twisted pair for RS-485/1-Wire, **shield earthed at one point only**. Spare Cat pairs may
carry BRIDGE signals if labelled as not part of the IT network. Beyond 15–20 m unshielded,
expect edge degradation — shield or repeat. Shared box with 230 V only behind an internal
partition; shared conduit only with a sheath certified ≥ 4 kV. Separate from Cat/PoE for EMI,
not for safety: a few cm when parallel, cross at right angles. Every branch gets overcurrent
protection sized to the conductor, per branch, in the central BRIDGE distributor.

**Stub-out doctrine (Melléklet 1/A).** Every wall position gets the *same* element: flush box
of uniform size and depth, one SELV power pair, one signal/bus pair, one empty ≥ Ø16 mm spare
conduit with draw cord, blank plate until the final module is chosen, star-wired to the
nearest zone distributor — never daisy-chained, so any one point can be changed alone.
Direct plastering without conduit is the single biggest risk to a modular system and is to be
avoided.

### 1.7 The one built artefact — BRIDGE-DN

ABB Mistral41W, 48 modules (4×12), 320×636 mm, IP41, clear RF-transparent door (the SLZB
antenna works behind it). 14 circuits + 1 spare. Feed: HLAK terminals → 2P main switch →
T2 SPD → 25/2 30 mA class-A RCD → comb busbars. **V2 fills all 48 modules** — the BRIDGE
core sits on row 4: HDR-60-5 → RPi 5 → USB hub + SLZB-MR3U, with Shelly Pro 3EM metering
(CTs on oven, water heater, BRIDGE) and a Shelly Pro 2 switching lighting circuits, plus an
RC snubber (100 kΩ + 10 µF MKP) for the pushbutton control circuit. K5 (C10 2P) is wired in
V1 already to feed the core later.

---

## Part 2 — The fog register

Three classes: **C** contradictions that must be resolved before writing, **D** decisions the
documents themselves declare open, **U** gaps no document names but the system needs to work.

### C — Contradictions

| ID | Issue |
|---|---|
| **C1** | ~~"Shadow Layer" names two opposed things.~~ **RESOLVED 2026-10-02.** S-A / S-B / S-C are declared **three deployment scales**, not three competing answers. **S-C is the reference design** the catalogue describes; S-A and S-B are documented reduced variants with stated omissions. The control-authority model (bistable element, manual-first, ζ/η) is named as the **invariant across all three**. Open sub-task: decide whether the term "Shadow Layer" is retired, or reserved for S-A only. |
| **C2** | ~~Centralised hub vs distributed node.~~ **RESOLVED 2026-10-02.** **Both topologies are permanent**, selected by dwelling size: small homes centralise (intelligence in the consumer unit, as BRIDGE-DN), large homes distribute (BASE + per-RoomBox sub-controllers). Open sub-task **C2-T**: define the crossover threshold and criteria, and what the centralised variant gives up — chiefly local autonomy and last-state hold. |
| **C3** | **PANEL LINK has no physical home.** ARCH-002 §6 requires either a free DIN row or a measuring gallery. BRIDGE-DN V2 fills 48/48 modules — a DIN socket no longer fits, and the doc says further expansion needs a second enclosure. Variant B (gallery) or a second cabinet must be chosen. |
| **C4** | ~~Supersession chain is inconsistent.~~ **PROPOSED 2026-10-02, awaiting a nod.** Smart Switch r1 is dated the same day as ARCH-A1 and states explicitly that it supersedes it, so **ARCH-A1 is superseded** and ARCH-002's listing of it as a live sibling is simply stale. Authority chain: **ARCH-001** (doctrine, S-A) → **ARCH-002** (architecture, S-C) → **Smart Switch r1** (control authority, supersedes ARCH-A1) → **STD-001…006** (dimensioned standards). ARCH-A1 and P33-BRIDGE-ARCH-01 are retained as history, marked superseded, never cited as current. |
| **C5** | ~~"OmniComm" is overloaded.~~ **PROPOSED 2026-10-02, awaiting a nod.** Use **OmniComm** for the **CM5 hardware line only** — the carrier board, the hub build spec, the spectrum and wiring drawings. **Retire it as a name for the hub itself**; the hub is BRIDGE, running on COMP. ARCH-001's "the HA hub, Omnicomm" is then read as historical. This keeps every existing OmniComm filename meaningful and removes the collision. |

### D — Declared open decisions

**From ARCH-002 §15** — D1 room list and RoomBox class per room, and which rooms are direct
vs chained · D2 16-port vs 8-port + expansion switch in NET · D3 MEDIA pack (basic vs full)
and media-server hardware class · D4 COMP platform: Pi 5 vs CM5 carrier · D5 BRIDGE_LINK
protocol: ESPHome over RS-485 vs Modbus RTU vs CAN · D6 KNX yes/no and DALI-2 yes/no ·
D7 speaker layout per room class, ceiling vs wall · D8 PANEL LINK variant A vs B ·
D9 SSC position and provider requirements *(must be agreed with a provider before walls
close)* · D10 touch-panel family, fingerprint module, room-level user roles.

**From ARCH-001 §8.4 / §9** — D11 BLE "mesh" meaning: ESPHome Bluetooth proxies
*(recommended)* vs SIG Bluetooth Mesh · D12 default switch type at control points: adopt
momentary/kinetic? · D13 where the manual-first relay physically lives · D14 box envelope
dimension *(blocks INST-001)* · D15 HA OS vs Supervised vs Container · D16 native API vs
MQTT as the fleet-registration standard · D17 personal or client-facing *(raises the bar on
repeatability, documentation, compliance)* · D18 target property: the INST-001 family house
or a generalised template.

**From Smart Switch §5** — D19 per-fixture rest-state policy, i.e. which contact is N.C. and
therefore which state survives wireless power loss · D20 Gate Switch default N.C. vs N.O.
per socket, live-by-default vs off-by-default · D21 the bistable element's physical home:
shadow space at the switch vs at the luminaire.

### U — Undeclared gaps the system needs closed

| ID | Gap | Why it blocks |
|---|---|---|
| **U1** | **No addressing or naming scheme.** Conduits have a label format; devices, HA entities, RS-485 addresses, VLAN IDs and the IP plan do not. | The Planner and HA will diverge on day one. Probably shares a namespace with the existing Planner room-numbering work. |
| **U2** | **BRIDGE_LINK is named, not specified.** No frame format, baud, address space, poll cycle, timeout or last-state semantics; "life signal / interlock" on pair 3 is undefined. | §10.3 promises local autonomy and last-state hold with nothing behind it. Blocks D5. |
| **U3** | **No scene/state arbitration model.** Manual-first is solved at the *circuit* level by the bistable. Nothing defines precedence when a scene, a presence rule, a schedule and a manual edge collide — no priority ladder, no hold-off window. | This is where a smart home actually annoys people. |
| **U4** | **Lighting is wired but not photometric.** Conduits, relays, dimmers, 24 V PWM strips, "DALI-2 if any" — but no dimming curve, minimum stable level, flicker limit, CCT range, tunable-white strategy, CRI/TM-30 target, colour-mixing maths, Duv tolerance, or circadian schedule. | The highest-value layer in a home, and the least specified. |
| **U5** | **Presence fusion has weights in name only.** Function #32 promises confidence-weighted occupancy with per-sensor weights; no weight table, decay constant, hysteresis, room-transition logic or mmWave false-positive handling. | Blocks the entire emergent layer from being more than a claim. |
| **U6** | **Thermal budget exists only for BASE** (70–110 W). RoomBox carries a 60–150 W PSU in a wall cavity with Z5 "thermally separated" — no dissipation budget, no maximum ambient, no derating. | RB-L/RB-H are the risk cases. |
| **U7** | **Audio is explicitly unworked** — the brief says so in as many words. Snapcast + ESP32 Class-D is proposed; no latency budget, sync tolerance, impedance/power, amp class per room, or eARC-vs-TOSLINK choice. | Blocks D7. |
| **U8** | **No commissioning plan outside SELV.** The SELV standard has a handover checklist; DATA, CONTROL, MEDIA and RF have none — no link test, no RS-485 termination verification, no RF survey method, no as-built capture format. | Nothing can be signed off. |
| **U9** | **Two mounting-height systems.** SELV Standard: 300 / 1100 / 1300–1400 / 2700 mm. ARCH-002: switch +1.05, sockets +0.30 and +1.10, RoomBox bottom ≥ +1.90, thermostat +1.50. | Drawings will contradict each other. |
| **U10** | **No failure-mode matrix.** Rule 13 guarantees manual control through COMP/network/CHANNEL loss. Undefined: PoE panels, the sub-controller, presence sensing and the security interface during a mains outage — the buffer that would cover it is "optional." | Manual-first is proven for lamps only. |
| **U11** | **Security data model undefined.** The boundary is clean (dry contacts, or the provider's IP module on a dedicated VLAN) but what BRIDGE *does* with arm/alarm/fault, and the EN 50131 grade target, are not stated. | Blocks D9. |
| **U12** | **No RF frequency or channel plan.** ARCH-001 §8.3 flags 2.4 GHz contention as a risk; ARCH-002 then stacks WiFi + BLE + Zigbee + Thread + 2.4 GHz HID in every RoomBox. No channel allocation, coexistence plan, or 433/868 duty-cycle budget. | The emergent layer and the device fleet both depend on it. |

### U (continued) — from the user's brief of 2026-10-02

These were raised directly rather than inferred from the corpus. Two of them — **U16** and
**U24** — describe elements the existing documents have **no concept of at all**.

| ID | Gap | Note |
|---|---|---|
| **U13** | **CHANNEL pathway and wiring buildup.** Conduit sizes, bend and fill rules exist; the actual *buildup* does not — no construction section, no bundle cross-section, no installation sequence, no transition detail at walls, ceilings and floor zones. | Turns Axis 3 from a table into something an installer can execute. |
| **U14** | **RoomBox exact modular layout, standardised, with measurements.** Only outer envelopes (RB-S…RB-O) and zone *names* Z1–Z5/ZI/ZT exist. Missing: an internal modular grid, DIN/rail provision, measured zone boundaries, component placement, partition construction, cable-entry positions, service clearances and door/front arrangement. | The single most load-bearing physical gap. Everything in the room hangs off it. |
| **U15** | **Room path layout and composition, RoomBox → endpoints.** The L-pattern gives placement principle only. Missing: a standard ARM composition per room class — which endpoints exist, in what order, on which ARM, with what bundle per ARM. | Needed before any room can be drawn twice the same way. |
| **U16** | **"Edge RoomBox" — a new element.** Named in the brief; absent from every document. Its role, position, reduced or extended function set, size class and relationship to RB-O (outdoor) are all undefined. | Must be defined before the hierarchy in Axis 2 is final. |
| **U17** | **Secondary 24 V lighting system.** A *parallel* lighting network with five stated purposes: built-in, ambience, secondary control network, emergency, and auxiliary power. ARCH-002 carries LV ambient lighting as one line item in the endpoint catalogue — this is a system, with its own topology, control path, fallback behaviour and (for the emergency purpose) autonomy requirement. | Emergency lighting carries its own duty-to-operate; it cannot inherit the convenience layer's reliability. |
| **U18** | **The per-room layer buildup order.** The brief gives an ordered stack — normal circuits (socket, lighting) → automation → data (Cat, KNX) → control (microcontroller, wired to BASE) → control panel → network → sensor → media (HDMI, USB 3.2, audio) → security (door, window, bidirectional device spot). This is a *sequence of definition and installation*, and it adds **Automation** and **Control Panel** as layers in their own right. | Must be reconciled with Axis 3's ten conduit families — they are different cuts through the same material, and the catalogue needs both. |
| **U19** | **Audio that follows the occupant.** Music tracking a person between rooms. Requires Snapcast zone handoff, a presence-trigger threshold with hysteresis, a latency and sync budget, and a rule for what happens with two occupants in different rooms. | Depends on U5/U23 being real rather than nominal. |
| **U20** | **RGB and light-level ambience scene model.** Distinct from U4's photometry: the scene *semantics* — what a scene is, how it composes across fixtures and layers, how level and colour interact, how scenes arbitrate against U3. | |
| **U21** | **Secondary lighting device and installation catalogue.** A comprehensive design catalogue — coves, niches, under-cabinet, skirting and step, stair, wardrobe, mirror, art and display, plinth, handrail, outdoor grazing — each with mounting, optic, driver, dimming and colour logic. | This is where gaffer practice and colour theory earn their place. |
| **U22** | **Exact hardware composition of BRIDGE P33.** `P33_BRIDGE_Inline_Architecture.md` exists as an architecture sketch; a concrete, costed hardware composition for the actual property does not. | The second buildable artefact after BRIDGE-DN. |
| **U23** | **Composite presence stack — eight modalities now named.** WiFi CSI · WiFi RSSI · **BLE AoA** · directional PIR · PIR + mmWave dual · acoustic source localisation · tagged-object location via multi-node · WiFi heatmap. Each needs a capability, hardware and accuracy entry, plus the fusion model still owed by U5. **Three carry hardware constraints that change the design** — see the flags below. | Supersedes U5 in scope; U5 remains as the fusion-algorithm gap. |
| **U24** | **Identity and verification architecture — entirely new.** Primary: PIN on a 4×3 matrix, secondary password. Remote reset by mail/ping to the user's own server. Secondary: offline biometric on a trusted phone, paired to the system. **"Trinity items"** — phone, keychain and wallet, each carrying a readable tag, so identity confidence is multi-factor and carried rather than entered. Plus a behavioural ML profile from logged movement and activity. Goal: **independent confirmation of user presence.** ARCH-002 gestures at this only via a fingerprint module (§10.11) and room-level roles (D10). | Needs a confidence model, an enrolment and revocation path, a privacy boundary for the behavioural profile, and a defined failure mode when confidence is low. |

**Hardware-reality flags on U23**, which should be settled before the stack is drawn:

- **BLE AoA is not available on ESP32.** Bluetooth direction finding (AoA/AoD, BT 5.1+) needs a
  multi-antenna array and controller support that ESP32/C6/H2 do not provide. Real options are
  **UWB anchors** — which ARCH-002 already contemplates in the three L-pattern corners, at
  decimetre accuracy — **BLE RSSI multilateration** at room/zone accuracy, or **dedicated AoA
  locator hardware**. The L-pattern geometry is already correct for all three.
- **Acoustic source localisation needs a microphone array** with known geometry and TDOA
  processing. A single mic per room yields level and keyword only, not direction.
- **WiFi heatmap** is a commissioning and survey artefact, not a live modality — unless what is
  meant is a continuously maintained RSSI surface, which is a different and larger build.

---

## Part 2b — Closure log

**Session of 2026-10-02.** Six standards written into `05_standards/`.

| Doc | Closes | Resolves |
|---|---|---|
| **STD-001** Physical Standardisation | U6 · U9 · U13 · U14 · U15 · U16 · U18 | C3 *(via RB-E/T)* |
| **STD-002** Light and Scene | U4 · U17 · U20 · U21 · U3 *(lighting slice)* | informs D6 |
| **STD-003** Presence and Identity | U5 · U19 · U23 · U24 | informs D7 |
| **STD-004** Naming and Control Backbone | **U1** · **U2** | **D5** · **C2-T** |
| **STD-005** Network and RF | **U12** | **D2** |
| **STD-006** Arbitration, Failure, Security | **U3** *(general)* · **U10** · **U11** | — |
| **STD-007** Media and Audio | **U7** · **U8** *(last test-plan gap)* | refines D7 · informs D3 |

**Resolved by decision:** C1 · C2 · C2-T · D17 · D2 · D5.
**Proposed, awaiting a nod:** C4 · C5 *(see the C table)*.
**Corrected:** the "four missing SVG figures" never existed as separate files — all seven switch
topologies are figured across three multi-panel sheets.

### Corrections this work produced

Writing the standards falsified three things that looked fine on paper. Recorded because each one
would otherwise have been built.

1. **B21 — layer-in-name ARM references fail.** A door-frame ARM carries SENSOR *and* LV; a switch
   ARM carries MAINS *and* CONTROL. Multi-layer ARMs have no single layer to name. STD-004 §1 uses
   a flat `R03.A2` with layers as an attribute. This reverses my own tuner recommendation.
2. **The RoomBox switch cannot be PoE-powered.** RB-L must inject ≈63 W downstream (2 APs, panel,
   camera) — impossible through one PoE input without 802.3bt at both ends, to power a switch
   sitting 300 mm from a 150 W supply. STD-005 §1 runs it from the local 24 V rail instead.
   ARCH-002 §8.5's PoE path survives as the sub-controller's *independent backup* supply.
3. **A central bus B pack beats per-room packs.** With the battery in the RoomBox, one room's 230 V
   circuit failure kills that room's PSU *and* its egress light — exactly where a fault just
   happened. Independent support for **C17 = B**, reached from the failure matrix rather than from
   convenience.
4. **One audio path cannot serve both music and television.** Snapcast's 800 ms buffer is invisible
   for music and roughly twenty times the ~45 ms lip-sync threshold for a picture, and shrinking it
   below ~200 ms destroys the sync robustness that justified Snapcast in the first place. STD-007
   §1 splits Path A (distributed, 800 ms) from Path B (local, < 20 ms, never touches the server).
   STD-003 §5 was incomplete, not wrong — it specified the transport and left the budget open.
5. **A 5.1 amplifier bay does not fit a RoomBox.** Six channels dissipate ~9 W typical and ~30 W
   peak against RB-L's 70 W ceiling that already carries 41 W; RB-M cannot take it at all.
   Multichannel moves to a dedicated AV position at the media wall. This is better architecture
   than the compromise it replaces — a 5.1 processor wants eARC, switching and real heatsinking;
   a follow-me pair wants to be invisible and cheap.

### Still outstanding

| Ref | Blocked on |
|---|---|
| **D1** room list + RoomBox class per room | **you.** Gates more than anything else: STD-001 §4 is a template, STD-003's zone graph is an illustration, STD-002 scene values are unfillable, STD-004 address allocation has no room numbers, STD-005 cannot size AP density, STD-007 cannot schedule screens or measure cable runs |
| **U22** P33 hardware composition → `P33-BUILD-001` | D1 |
| AV position envelope | needs an enclosure spec in **STD-001 r2** — ventilation, a 230 V circuit, an HDMI/eARC path. It is not a RoomBox class |
| Snapcast server placement | on MEDIA it shares fate with transcoding; the follow-me layer dies when a transcode saturates the box. **Test under load before committing** |
| D3 · D4 · D6–D16 · D18–D21 | the tuner, or D1 |

**U8 is closed.** Every layer now has a commissioning plan: 001 §8 physical · 002 §11 light ·
003 §8 presence · 004 §5 control · 005 §6 data and RF · 006 §4 system and security · 007 §8 media
and audio.

**Next, once the tuner comes back:** apply the answers across 001–006, then `P33-BUILD-001` as the
first real test of the whole set. One open architectural question worth settling early — whether
the §1 arbiter of STD-006 lives inside Home Assistant or as its own small service. A tier model
that specific is awkward to express in HA automations alone.

---

## Part 3 — Reading order for the Reference

Guide half, by layer: **1** principles and the three scenarios · **2** service entry and the
cabinet · **3** power spine · **4** SELV and the stub-out library · **5** conduit layers and
discipline · **6** CHANNEL and placement geometry · **7** the RoomBox and its zones ·
**8** ARMs and the endpoint catalogue · **9** control authority (ζ/η) · **10** compute and
protocol · **11** sensing, presence and the emergent layer · **12** light and scene ·
**13** audio and media · **14** security · **15** commissioning and handover.

Catalogue half, by subsystem: Elosztószekrény / BRIDGE-DN · BASE-NET · BASE-COMP ·
BASE-MEDIA · PANEL LINK · LAYER TIE · CHANNEL · RoomBox RB-S/M/L/H/O · ARM types ·
endpoint types ×19 + UEP · smart-switch families ×7 · SSC and security layer ·
field devices · adjacent: ESPBLOK, Site Pager, VRG BuildTree.
