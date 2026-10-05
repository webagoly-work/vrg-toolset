# BRIDGE — Shadow Layer & Unit Fleet Architecture Primer

**Doc:** BRIDGE-ARCH-001 / r2 · DRAFT · 2026-05-27
**Scope:** The "Shadow Layer" parallel infrastructure and the ESP32/IoT unit fleet that optionally populates it. BRIDGE (the Home Assistant hub on the RPi/mini-PC, "Omnicomm") is **T5** — the existing brain. This primer specs the other half: the distributed body.
**Companion docs:** BRIDGE-INST-001 (flush-box installation plan), ESP32 component survey.

---

## 0. Design Tenets

These ten words are the constitution. Every decision is checked against them, in this order of emphasis:

1. **Non-invasive** — the standard installation is never altered; we build *around* and *alongside* it.
2. **Manual-controlled-first** — the human's physical action always wins; wireless is at most a peer, never a master.
3. **Modular** — units drop in and out independently; nothing is welded to anything.
4. **Future-proof** — the host structure outlives any generation of device placed in it.
5. **Adaptive** — the layer accommodates whatever the user brings home, not a predefined catalog.
6. **Optional** — most capacity stays latent; nothing *must* be populated.
7. **Discreet** — invisible in normal use; no exposed tech, no visual footprint.
8. **Integrating** — the primary job is adopting devices the user already owns, not deploying our own.
9. **User-friendly** — the experience is seamless via the hub; complexity stays hidden.
10. **Cost-effective** — no infrastructure spent on capability that may never be used.

---

## 1. Concept Summary — The Shadow Layer

### 1.1 What it is
The **Shadow Layer** is an *additive* parallel layer that builds on and around today's standard electrical installation — wiring, junction boxes, outlets, switches, conduit pathways, and lamp positions. It applies only where flush-mounted, flex-conduit installation is feasible. It introduces **discreet, inline spaces** at the positions where sensors, gateways, and micro-devices would ideally sit, each sized to hold **an AC/DC adapter plus at least one commercial, mains-plug IoT/smart device**.

It is not a smart-home system you install. It is **latent capacity** — a grid of optional, mostly-empty spaces that grant the user maximum future choice without forcing any decision today.

### 1.2 What it is *for* (integration-first, optionality-first)
The system's primary purpose is **integrating devices the user already brings home and wants to use** — not blanketing the house with our own sensors. Consequently:
- **Most Shadow Layer spaces stay unused**, by design.
- Any space can serve as a **plain mains socket** (adapter compartment simply left empty), so it is never wasted even when no device lives there.
- **Nothing is predefined.** The space is a generic socket; the unit (if any) decides what it becomes, whenever the user decides.

### 1.3 The two halves of BRIDGE
- **Brain — BRIDGE / T5:** the existing Home Assistant hub ("Omnicomm"). Owns state, scenes, logic, UI, history.
- **Body — the fleet (this primer):** distributed gateways, integrated devices, optional sensors, and manual-first actuation, all of which become **good Home Assistant citizens** registered to BRIDGE.

---

## 2. Power Doctrine — Power Where Used, Wireless From There

This is the core architectural correction. **There is no second backbone.**

- Modern homes already carry a low-voltage data backbone (internet/structured cabling). The Shadow Layer is **explicitly not that**, must **not be confused with it**, and must **not repurpose it** — doing so would erode the user's options.
- We also **do not run a second low-voltage backbone**: it hurts cost-effectiveness, complicates architectural planning, and defeats the entire premise of a *wireless* layer.
- Instead: **things are powered where they are used, if they are used — and everything beyond the power point lives wireless.**
- Shadow Layer spaces are therefore placed **next to existing mains runs**, so each becomes an easy **parallel mains-feed tap**. A space provides one thing: a local mains feed, with room for an adapter and a device beside it.

**Implication:** the only "backbone" is the existing mains and the air. This keeps the layer cheap, non-invasive, and genuinely wireless. PoE exists only as a rare exception (§4.4).

---

## 3. Box & Enclosure Doctrine

### 3.1 The space as a contract
Each Shadow Layer space provides: **a parallel mains feed in**, physical room for **a small AC/DC adapter**, and room for **one commercial mains-plug smart/IoT device or one micro-unit** beside it. Sizing is driven by "adapter + a real commercial device must fit," not by any specific module.

### 3.2 Dual-use, latent by default
A space is, at any time, one of: (a) **empty / plain mains socket**, (b) **socket + adapter + device**, or (c) **dedicated micro-unit**. The user moves freely between these states with no rework.

### 3.3 Thermal & covers (not sealed)
Flush spaces are **not sealed** for the sake of heat management. Instead they are closed with:
- **Plastic louver panels** (vented), or
- **Covers opaque to the human eye but transparent to the relevant sensing** (IR / RF / radar / PIR pass-through), with **added vent holes where needed**.

This lets a sensor or gateway operate behind a discreet, decorative face while heat escapes — reconciling *discreet* with thermal safety without trapping adapters in a sealed cavity.

---

## 4. Comms Doctrine

### 4.1 Base fabric: WiFi + Bluetooth mesh
The base gateway system provides **WiFi + Bluetooth mesh** coverage — the most ubiquitous base technologies today — to give immediate, modern, whole-home reach. **Additional gateway types (Thread/Zigbee, sub-GHz, etc.) come later**, added on demand when a brought-home device requires them.

> **Precision note (grey area + suggestion):** For a *seamless HA experience*, "Bluetooth mesh" is most practically realized as a fleet of **ESPHome Bluetooth proxies** — ESP32 nodes that relay BLE advertisements/connections back to BRIDGE, extending BLE coverage across the home and feeding it natively into Home Assistant. True SIG **Bluetooth Mesh** (device-to-device relay) is supported on ESP32 but is *not* natively HA-friendly. Recommend Bluetooth-proxy coverage as the default realization of this requirement; reserve SIG Mesh for specific device-to-device cases. *(Confirm which you intend.)*

### 4.2 The hub comes early
BRIDGE (HA) is stood up **early**, not last, so the seamless experience exists from the start and every subsequent unit has somewhere to register.

### 4.3 Dedicated-silicon protocols stay at the hub
Protocols requiring dedicated silicon (e.g., **Z-Wave**, which needs Silicon Labs 700/800-series chips and is not ESP32-native) **should not be altered if impractical**. The architecture anticipates them being added **on, in, or close to the Hub** — a single coordinator location rather than distributed nodes.

### 4.4 PoE: minimal and hub-centric
PoE is reserved for **only the most important devices**. Where used, they sit **near the Hub**, on a **PoE switch beside the Hub**, with the **shortest possible runs**. The PoE web is kept to an absolute minimum; the rest of the system is mains-powered + wireless.

---

## 5. Control Doctrine — Manual-First

This is the most nuanced and most important behavioral rule.

### 5.1 The rule
Manual, traditional control is **not merely a fallback** for a failed or absent wireless device — **the user's physical action overrides the wireless-controlled state.** A parallel wireless option **can never have higher authority than manual**, but it **should approach equal authority** where physically possible.

### 5.2 Required behavior (worked example)
A lamp is parallel-controlled by a single-pole one-way switch (HU **"101"**) *and* an RF switch:
- RF holds the lamp ON, user flips the 101 **off** → lamp goes **off**, regardless of RF.
- RF turned the lamp off, user pushes the 101 **on** → lamp goes **on**.
- Ideal "close-to-equal": after a manual **off**, the RF can still turn the lamp **on**.

### 5.3 Why a series-connected wireless device is wrong
If the wireless actuator sits **in series** with the load (relay between switch and lamp, powered from the switched line), then turning the manual switch off kills the actuator and the lamp — but the actuator then **cannot turn the load on while the manual is off** (it has no power), and worse, an in-series relay can *hold the load off against* a manual on. **Series placement is to be avoided.** If the *only* way to preserve manual-first is to cut the wireless device out of certain states (so RF cannot act in those states), **that is accepted** — manual-first outranks wireless reach.

### 5.4 Recommended pattern (the "close-to-equal" target)
Achievable when a parallel mains feed is present at the control point:
- Place a **permanently-powered relay** (fed L+N from the parallel Shadow feed, **not** from the switched line) controlling the load.
- Wire the manual switch to the relay's **input/SW terminal as a *sensed* input — decoupled from the load**, never in series with it.
- Because the relay is always powered, **wireless can set state even when the manual is "off"** (close-to-equal), while **every manual transition is guaranteed to land** (manual-first).

> **Grey area + philosophy-grounded suggestion — maintained vs. momentary switch.** The two requirements ("flipping the 101 *off* always means off" **and** "RF can turn on after a manual off") are *jointly and cleanly* satisfiable only with a **momentary / retractive switch** (HU **"100"** pushbutton) or a **kinetic/EnOcean self-powered switch**, where each press is an unambiguous edge with no stale "position" to desync. With a **maintained 101**, you must pick one of two documented behaviors: *follow-position* (manual absolute, but RF cannot override a held-off switch) or *edge-toggle* (RF near-equal, but switch position can fall out of phase with lamp state, so "flip down = off" is not guaranteed). **Per the tenets (non-invasive, manual-first, user-friendly), the recommended default at control points is a momentary or kinetic switch.** Keep existing maintained 101s where replacement isn't warranted, and accept the documented trade-off there.

### 5.5 Load-bearing actuation — local, parallel, self-sufficient
Actuating load-bearing wires is preferably done with **local parallel devices rated for the load**, e.g., **contact / kinetic switches** (kinetic = energy-harvesting; no wiring, no battery — ideal for the manual interface):
- These points **need no conduit** back to the sensor/data side — they are wireless, and the controlled devices draw from their **existing wiring**.
- A wireless actuator should ideally stay powered and able to act **even when the user has switched the fed device off** (battery only if there is no other option) — but this capability is **always secondary to full manual control**.

---

## 6. Tiered Unit Architecture (HoMM ladder)

The conceptual dependency stack. **Note:** *deployment order ≠ tier number* — BRIDGE/T5 is stood up early (see §7).

| Tier | Name | Role | Numerousness | HoMM analog |
|---|---|---|---|---|
| **T1** | **Base Comms Gateways** | WiFi + Bluetooth(-proxy) mesh coverage. Additional-protocol gateways (T1+) added on demand. | Many | Tier 1 — scouts |
| **T2** | **Integrated Devices** | Existing smart/IoT, then legacy devices, adopted via gateways. *The main event.* | Most numerous | Tier 2 — archers |
| **T3** | **Manual-First Actuation** | Parallel, always-powered relays + kinetic/momentary switches on load lines. | As needed | Tier 3 — infantry |
| **T4** | **Sensor Fleet (optional)** | Presence/environment sensors behind sensor-transparent covers, where wanted. | Optional | Tier 4 — cavalry |
| **T5** | **BRIDGE — Coordination Hub** | The existing HA hub. State, scenes, logic, UI. **This is BRIDGE.** Stood up early. | 1 (+ failover) | Tier 5 — champions |
| **T6** | **Adaptive / Predictive** | Occupancy modeling, "hotel-room" sequencing, anomaly/security detection, energy. | 1 logical | Tier 6 — casters |
| **T7** | **Operator / Agentic Interface** | Voice / LLM / external integrations above BRIDGE. | 1 | Tier 7 — titans |

---

## 7. Build Sequence (your stated order)

Deployment follows this sequence, not strict tier order:

1. **Base gateways** — WiFi + Bluetooth(-proxy) mesh coverage.
2. **Stand up BRIDGE (HA hub)** early — seamless experience from day one; everything registers here. *(Steps 1–2 are the foundation pair.)*
3. **Integrate existing smart/IoT devices** via the gateways.
4. **Integrate legacy devices.**
5. **Connect load-bearing lines** to wireless control under the manual-first doctrine (§5).
6. **Deploy sensor fleets** — only where wanted; optional.
7. **Zone edge controllers** — local logic/fallback per zone.
8. **Security measures.**

*Additional-protocol gateways (Thread/Zigbee/sub-GHz) and dedicated-silicon coordinators are added on demand, when a brought-home device needs them — preferably at/near the Hub (§4.3).*

---

## 8. Architectural Analysis

### 8.1 Verdict
**Strongly viable, and now internally consistent.** The "power-where-used, wireless-from-there" doctrine resolves the earlier power tension elegantly: no second backbone, no sealed-adapter heat trap (louver/vented covers handle it), and cost scales with *actual* use rather than provisioned capacity. The integration-first, optionality-first framing is the right center of gravity for a real home. The manual-first doctrine is unusually well-specified and is the system's strongest user-trust feature.

### 8.2 Strengths
- **Optionality without waste** — latent spaces double as plain sockets; nothing provisioned is ever stranded.
- **Genuine non-invasiveness** — standard install untouched; reversible; code-friendly; hands the mains-touching parts to an electrician cleanly.
- **Trust through manual-first** — the system can never "trap" a user; physical action always lands. This is a major adoption advantage, especially if BRIDGE is ever client-facing.
- **Cheap and wireless by default** — mains tap + air; PoE only where it must be.
- **HA-native** — leaning on Home Assistant + ESPHome avoids inventing an orchestration stack.

### 8.3 Risks & weaknesses
- **Manual-first wiring is the hard craft.** §5.4's always-powered, decoupled-switch pattern is correct but is real electrical work at each control point; the maintained-switch desync (§5.4 grey area) needs a standing policy.
- **2.4 GHz load.** WiFi + BLE share the band. Mitigated by: BLE-proxy carrying device traffic, integrating devices on their own native protocols, and keeping the sensor fleet optional/small — but RF planning is still needed.
- **Battery-backed actuators** introduce maintenance; use only when parallel power is impossible, and prefer kinetic (no battery) for switches.
- **Discoverability of latent capacity** — if most boxes look like plain sockets, the user (or a future installer) needs documentation to know what parallel feeds and spaces exist. A per-room map is essential.

### 8.4 Grey areas where I'd like your steer (with suggestions)
1. **BLE "mesh" meaning** — confirm ESPHome Bluetooth-proxy coverage (my recommendation) vs. SIG Bluetooth Mesh. (§4.1)
2. **Standard switch type at control points** — adopt momentary/kinetic as default? (§5.4)
3. **Where the manual-first relay physically lives** — suggestion: in the Shadow space adjacent to the load's switch, where a parallel feed exists, so it is always powered and the switch wires in as a sensed input. Confirm this is the intended home for actuation hardware.
4. **Box envelope spec** — define the physical size target (e.g., deep/multi-gang box fitting a standard EU wall-wart + a plug-in smart device). Needs a concrete dimension to finalize INST-001.

---

## 9. Open Questions / Known Unknowns
- BRIDGE platform specifics — HA OS vs. Supervised vs. Container; native API vs. MQTT as the fleet-registration standard.
- Is BRIDGE **personal or client-facing**? (Prior upsale-questionnaire work suggests possible commercial use → raises the bar on repeatability, documentation, code compliance.)
- Target property for *this* iteration — the INST-001 family house, or a generalized template?
- Confirm INST-001 box positions are now specified for **parallel mains feed** (not any DC bus), per §2.
