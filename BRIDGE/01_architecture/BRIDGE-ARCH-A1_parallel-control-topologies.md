# BRIDGE — Parallel Manual + Wireless Control: Bistable Switch Topology Survey

**Doc:** BRIDGE-ARCH-A1 / r1 · DRAFT · 2026-05-27
**Status:** Theoretical exploration · no law/code constraints · pure electricity + switch logic.
**Parent:** BRIDGE-ARCH-001 §5 (Control Doctrine).

---

## 0. Scope & Rules

- **No standards/code compliance** — we explore freely.
- **Physical + bistable user-facing element required** (bistable in the perceived sense; the switch may either be strictly bistable or be "seemingly" bistable, i.e., maintained-position with downstream edge logic).
- **Goals:**
  - **(R1) Manual-first.** Every manual transition forces the lamp to the corresponding state, guaranteed to land.
  - **(R2) Close-to-equal wireless reach.** RF can act between manual events; ideally including "RF turns lamp on after a manual off."
  - **(R3) No predefined ordering.** Wireless is at most a peer, never a master.
- Note on the user's reminder: **switch *function* depends on wiring**, not just device part number. A 106 (SPDT / two-way) wired with one output unused becomes a 101 (SPST). A 107 (cross) wired between two 106s yields multi-point staircase logic. Topology is half the answer.

---

## 1. The Topological Dilemma (why simple cases fail)

Consider the lamp as a load on a power line. The manual switch and the RF actuator are two "actors" trying to influence the load. There are only three primitive topologies:

| Topology | Behavior | Verdict |
|---|---|---|
| RF in **parallel** with the manual switch | RF can only **add** power (close the circuit when switch is open). Cannot subtract. | RF can turn on when manual is off, but cannot turn off when manual is on. **Asymmetric.** |
| RF in **series** with the manual switch / load | RF can only **subtract** power (open the circuit). Cannot add. | RF can turn off when manual is on, but cannot turn on when manual is off. **Violates manual-first** (RF can block manual on). |
| RF and switch **both in series-parallel hybrid** | Either RF or switch can independently complete or break the circuit. | Manual-first violated again (the series part can block manual). |

> **The unavoidable conclusion:** no purely combinational two-actor topology gives the desired behavior. We must introduce a **third element — a bistable state/memory device** — that *both* actors drive as peers. The lamp follows the state element, not directly either actor. This shifts the problem from "wire two actors to one load" to "feed two actors into one memory."

This is why the answer space is dominated by **impulse relays, latching relays, flip-flops, and motorized switches** — all *memory devices*, just realized in different technologies.

---

## 2. Commercially Available Bistable Lamp Switches (the input vocabulary)

Catalog of physical, bistable (or seemingly-bistable) switches available as commercial lamp controls. Hungarian numbering (100, 101, etc.) given where I'm confident.

### 2.1 Strictly bistable (two maintained positions)
| # | Type | Notes |
|---|---|---|
| S1 | **SPST maintained (HU 101)** — rocker, toggle, slide | The standard wall switch. Two positions held by detent. |
| S2 | **DPST maintained (HU 102)** | Switches both L and N. Two-pole version of S1. |
| S3 | **SPDT / two-way (HU 106)** | One common, two outputs. The traveler element of staircase circuits. Can be wired as S1 (unused leg). |
| S4 | **Cross / intermediate (HU 107)** | Used between two S3s. Internally a DPDT in cross-wire. Two positions: "straight" or "crossed." |
| S5 | **Two-circuit / chandelier switch** | Two ganged SPST poles selecting between independent lamp groups. |
| S6 | **Dual SPST in one face (sorolt)** | Two separate S1s in one wall plate. |
| S7 | **In-line cord rocker / foot switch** | SPST maintained on the lamp cord. |
| S8 | **Smart wall switch (rocker face)** | Internally a radio + relay; user sees a maintained rocker. |
| S9 | **Key switch** | Bistable, requires a key to actuate. Lock-out flavor. |
| S10 | **Mercury tilt switch** | Bistable by orientation; niche / hazardous. |

### 2.2 Alternate-action bistable (one button, two states)
| # | Type | Notes |
|---|---|---|
| S11 | **Push-push button** ("push-on / push-off") | Internal mechanical cam alternates state with each press. Common in floor lamps, desk lamps, inline cord. Single button, bistable appearance. |
| S12 | **Pull-chain switch** | Internal ratchet advances one position per pull. Bistable (off/on) or polystable (off/low/med/high in fan lamps). |
| S13 | **Touch lamp control** | Capacitive sensing; internal latch holds state. Bistable or polystable. *Strictly an electronic latch behind a momentary input — included here because the user experience is bistable.* |

### 2.3 Polystable / multi-position bistable
| # | Type | Notes |
|---|---|---|
| S14 | **Rotary selector** (knob, multi-position with detents) | Common on chandelier lamps, fan lamps, classic table lamps (off/low/med/high). Each position maintained. |
| S15 | **HOA (Hand–Off–Auto) rotary** | Industrial 3-position selector. Each position maintained. **Particularly relevant** — see §4.γ. |
| S16 | **Dimmer with detented off** | Rotary or slide dimmer with a click-off position. Bistable in the on/off sense, continuous within on. |

### 2.4 Not bistable, but worth naming as edge-input sources for downstream bistable elements
- **Momentary pushbutton (HU 100, "nyomó")** — the canonical input to an impulse relay.
- **Kinetic / piezo / EnOcean self-powered switch** — energy-harvesting momentary press; no wiring, no battery; transmits a wireless telegram per press.
- **Microswitch / limit switch** — momentary contact for mechanical sensing.
- **Capacitive touch (raw)** — momentary; needs downstream latch.

These are excluded from "bistable" per the user constraint, but appear repeatedly in §4 because **every bistable downstream logic element accepts momentary edge inputs**, and a maintained switch can be turned into an edge source by a simple state-change detector — making the bistable wall plate compatible with all impulse-relay-style topologies.

---

## 3. Bistable State/Memory Elements (the third element)

These are the *memory* devices that decouple actors from each other and from the load. Each accepts input from any number of peer actors and drives the load from a held state.

| # | Element | How it remembers state | Inputs accepted |
|---|---|---|---|
| L1 | **Impulse / latching / staircase relay** (Eltako S12-100, Finder 26-series, Hager EPN510, ABB E290, Schneider iTL, etc.) | Mechanical latch toggled by a coil pulse. State held without power. | Any momentary pulse — from buttons, from edge detectors fed by maintained switches, or from RF dry contact. |
| L2 | **SR (set/reset) latching relay — two separate coils** (Finder 22/26 with SR variants, industrial bistable relays) | Two distinct coil pulses: one for SET (on), one for RESET (off). State held without power. | Distinct ON and OFF pulses. Manual and RF can each issue either. |
| L3 | **Polarized (magnetic-latching) relay** | Coil polarity determines latch direction. | Polarity-direction pulses. |
| L4 | **T flip-flop (electronic)** | Edge on T input toggles output Q. | Any clock-edge source. |
| L5 | **SR latch / D flip-flop (electronic)** | Discrete logic; can implement any combination. | Explicit S, R, or clocked-D commands. |
| L6 | **Mechanical detent / over-center spring** (the guts of any maintained switch) | Mechanical bistability. | Physical force on the actuator. |
| L7 | **Permanent-magnet bistable latch** | Magnet held in one of two stable positions. | Mechanical or electromagnetic force on the magnet. |
| L8 | **Motorized mechanical switch / robot finger** (SwitchBot, motorized circuit breakers, motorized contactor operators) | The switch's own mechanical detent. | Both human hands and an electric actuator drive the *same* mechanism. |
| L9 | **Hydraulic / pneumatic bistable valve** | Spool valve with detents. | Mechanical lever and/or solenoid pilot. (Theoretical analog of L7/L8.) |

> The defining property of L1–L9: **the lamp follows the state element**, not the switch directly. Once you've adopted this, both manual and RF become peer inputs into the same memory — and "manual-first" becomes a matter of guaranteeing manual inputs *land*, not of preventing RF from acting.

---

## 4. Solution Families

Each family pairs switches from §2 with a state element from §3. Manual-first guarantee, RF reach, and failure modes assessed for each.

### α. Edge-driven impulse relay (S1/S3-as-S1/S11/S12 → L1)
- **Wiring:** Maintained switch (S1/S3-as-S1/S7/S8) feeds an *edge detector* (mechanical contact closure → short pulse, or simply use the switch in a circuit that produces a pulse on each transition). Pulse drives L1's coil. RF dry contact paralleled on the same coil line. L1 controls the lamp.
- **Variant:** Replace the maintained switch with a **push-push S11** (already an alternating-action mechanical bistable; each press produces a pulse). Or a pull-chain S12.
- **Behavior:** Every manual transition (or push) → one toggle. RF command → one toggle. **All actors are peers; last toggle wins.**
- **Manual-first (R1):** Each manual transition is guaranteed to flip state, because the pulse always reaches L1's coil and L1 is permanently powered. Wireless cannot block a pulse. ✅
- **RF reach (R2):** Full — RF can flip state any time. ✅
- **Caveat (the desync mental model):** with a maintained switch, "switch position up" does not necessarily mean "lamp on" — the lamp state is independent of the rocker's physical position. This is the same mental model as classic staircase lighting (any flip = toggle). **The lamp itself is the bistable indicator the user reads, not the rocker.** Acceptable per the "even seemingly bistable" relaxation, but worth declaring.
- **Failure modes:** L1 mechanical latch is robust; coil burnout is the typical end-of-life. RF failure is benign (manual continues to work).
- **Commercial:** Eltako, Finder, Hager, ABB, Schneider all sell L1; bistable wall plates and push-push buttons widely available.

### β. SR latch with explicit ON / OFF inputs (S6 dual-SPST / S15 / dual-pushbutton → L2 / L5)
- **Wiring:** Two distinct manual inputs (e.g., two pushbuttons, or a 3-position center-off momentary toggle: up = ON pulse, down = OFF pulse, center = idle). One drives L2's SET coil, the other RESET. RF can also issue SET or RESET commands.
- **Behavior:** Manual ON button → forces lamp on. Manual OFF button → forces lamp off. RF ON → forces on. RF OFF → forces off.
- **Manual-first (R1):** A manual SET or RESET pulse forces the corresponding state. Wireless cannot block it. ✅
- **RF reach (R2):** Full — RF can also force either state at any time. ✅
- **No desync:** Each command is unambiguous; state is the result of the last explicit command.
- **Switch form:** the wall plate can be a 3-position momentary toggle (returns to center) — a *physically bistable* idle state with two transient action positions. Or two side-by-side buttons. Or even a rocker rigged so up/down each produce a distinct dedicated pulse.
- **Commercial:** SR latching relays exist (Finder, ABB). 3-position momentary toggles are industrial parts (used in HVAC, cranes). Less common in domestic lighting but freely available.

### γ. HOA (Hand–Off–Auto) rotary — explicit delegation (S15 → direct load + RF gate)
- **Wiring:** A 3-position rotary selector (S15). Position OFF → cuts load (or sets latch to off). Position ON → forces load on. Position AUTO → load is controlled by the RF actuator (downstream L1/L2 etc.).
- **Behavior:** The user explicitly delegates authority by selecting the mode. OFF and ON are absolute manual; AUTO is full RF.
- **Manual-first (R1):** Trivially yes — RF only acts when the user has chosen AUTO. ✅
- **RF reach (R2):** Full when in AUTO; zero otherwise. Conditional rather than parallel — strictly less than "close-to-equal," because outside AUTO RF has no reach. ⚠
- **Strength:** **Most honest solution.** Makes the manual/wireless authority tension *explicit and user-choosable* moment to moment. No surprises.
- **Weakness:** Cognitive load — user has to think about modes. Less invisible than impulse-relay setups.
- **Commercial:** HOA switches are standard industrial / HVAC parts (Allen-Bradley, Schneider, Siemens).

### δ. Motorized physical switch — one bistable element, two operators (S1/S2/S11 + L8)
- **Wiring:** A standard maintained switch (S1, S2, S11). An electromechanical actuator (small motor, solenoid, or stick-on "robot finger" like a SwitchBot Bot) is attached to physically flip the switch under RF command.
- **Behavior:** The physical switch *is* the state. Both the user's hand and the actuator drive the same mechanical detent.
- **Manual-first (R1):** Absolute and unfalsifiable — the user can always physically move the switch. ✅✅
- **RF reach (R2):** Full — actuator can flip from any state to any other state, including turning on after a manual off. ✅
- **Strength:** Conceptually pure. No abstract "state" exists — the switch position **is** the state, always observable, always touchable. No desync ever.
- **Weaknesses:** Speed (motor/solenoid actuation takes ~hundreds of ms), noise, mechanical wear, aesthetics (a finger device on the wall is conspicuous).
- **Commercial:** SwitchBot Bot (battery-powered finger, $20–30, well-known). Motorized circuit-breaker operators (industrial). Motorized contactors. Hidden behind a wall plate, a small solenoid could drive a toggle bat invisibly — a custom build but trivially feasible.

### ε. Decoupled maintained switch + always-powered relay (S1/S3-as-S1/S8 → L4/L5 in firmware)
- **Wiring:** Already specified as the BRIDGE-ARCH-001 §5.4 pattern. Switch wired as a sensed *input* to a permanently-powered relay (fed from a parallel mains tap); relay controls the load.
- **Mode 1 — Follow-position:** Relay output = switch position. Manual absolute, but RF cannot override a held position. R2 partially fails.
- **Mode 2 — Edge-toggle:** Each switch transition toggles the relay; RF can also toggle. R2 holds, but switch position can desync from lamp state.
- **This is α in firmware form** rather than via an electromechanical L1. Same trade-offs as α, just realized in a smart relay.

### ζ. Two-way + virtual intermediate (S3 × 2 + RF as virtual S4)
- **Wiring:** Classic staircase: two SPDT (S3) switches in series with travelers; the lamp follows the XOR of switch positions. Add an RF actuator wired as a *virtual cross switch (S4)* in the traveler lines — i.e., a relay that either passes the travelers straight through or crosses them.
- **Behavior:** Lamp state = XOR(switch1, switch2, RF-cross-bit). Every actor is a peer toggle. **Symmetric peer network.**
- **Manual-first (R1):** Every manual flip toggles state. Guaranteed. ✅
- **RF reach (R2):** RF toggles by flipping its cross-bit. ✅
- **Caveat:** RF actuator sits **in series** in the traveler lines. A failure mode of "stuck in crossed" or "stuck in straight" reduces the system to a classic two-switch staircase — *manual operation continues unaffected*. So the series placement is acceptable provided the RF device's failure is benign (open-on-fail would kill the lamp; bypass-on-fail is graceful — design choice).
- **Strength:** Mathematically elegant; the system is a pure XOR network where any actor (manual or RF) is a peer.
- **Weakness:** Same XOR mental model as α — switch position doesn't directly equal lamp state.

### η. Multi-pole maintained with one pole as "RF enable" (S2 / S5 / S6 in a custom wiring)
- **Wiring:** A two-pole maintained switch where pole 1 controls the lamp circuit directly (manual absolute) and pole 2 controls **power to the RF actuator's coil**. When the user flips off, both lamp and RF actuator die.
- **Behavior:** Manual fully supreme in both directions. RF has zero reach when manual is off (because the actuator itself loses power).
- **Manual-first (R1):** Yes, trivially. ✅
- **RF reach (R2):** Asymmetric — RF can only act while manual permits (manual is "on"). When manual is off, RF cannot turn it on. ⚠
- **Strength:** Maximally conservative; matches "if the only way to keep manual-first is to cut out the wireless device, so be it" from the parent doc.
- **Weakness:** Strictly less than close-to-equal.

### θ. Latching relay with priority-encoded inputs (L2 + firmware preemption)
- **Wiring:** L2 with a small microcontroller mediating inputs. Manual edge → immediate SET or RESET command, plus a brief "RF-inhibit" window (e.g., 5 seconds). RF commands during the window are dropped.
- **Behavior:** Manual command lands; the system pauses RF briefly so the user isn't immediately "undone" by an automation.
- **Manual-first (R1):** ✅, with a UX-friendly grace window.
- **RF reach (R2):** ✅, after the window.
- **Use case:** Where automations are aggressive and the user wants a "leave me alone for a moment" guarantee. Pure UX layer atop α/β/ε.

### ι. Magnetic-latch + dual driver (L7 + manual lever + electromagnet)
- **Wiring:** A magnet held in two stable positions by detent geometry. Manual lever moves the magnet; an RF-driven electromagnet can also push it. A reed switch reads position and drives the lamp.
- **Behavior:** Like δ at smaller scale — one physical bistable, two operators.
- **Strength:** Silent, no moving parts visible.
- **Weakness:** Custom build; no off-the-shelf product matches exactly.

### κ. Hydraulic / pneumatic bistable (S-anything + L9)
- Theoretical for a residential lamp; included for completeness. Industrial parallel-control problems are routinely solved this way (spool valves with detents, driven by manual levers and solenoid pilots).

---

## 5. Comparison Matrix

| Solution | Switch type(s) | Manual-first (R1) | RF turn-off when manual on (R2a) | RF turn-on when manual off (R2b) | Position-state desync? | Failure mode | Practical? |
|---|---|---|---|---|---|---|---|
| **α — Impulse relay (edge-driven)** | S1/S3-as-S1/S7/S8/S11/S12 | ✅ | ✅ | ✅ | Yes (XOR mental model) | Benign (manual still works on most failures) | **High** |
| **β — SR latch (explicit ON/OFF)** | Dual button, 3-pos momentary | ✅ | ✅ | ✅ | **No** | Benign | **High** |
| **γ — HOA rotary** | S15 | ✅✅ | Only in AUTO | Only in AUTO | No (modal) | Benign | High |
| **δ — Motorized switch** | S1/S2/S11 + L8 | ✅✅ (absolute) | ✅ | ✅ | **No** (physical = state) | Motor failure → manual still works | Medium (aesthetic/noise) |
| **ε — Smart relay (decoupled)** | S1/S3-as-S1 + firmware | ✅ | ✅ | Mode-dependent | Mode-dependent | Power loss → behavior depends on relay default | **High** |
| **ζ — 2×S3 + RF virtual cross** | S3 × 2 + RF | ✅ | ✅ | ✅ | Yes (XOR) | Designable to be benign | Medium |
| **η — Multi-pole with RF-enable** | S2/S5/S6 | ✅✅ | ✅ | ❌ | No | Manual always controls | High (conservative) |
| **θ — Latch + UX preemption** | Anything + MCU | ✅ | ✅ | ✅ (after window) | As underlying | Benign | High |
| **ι — Magnetic latch dual driver** | Custom | ✅✅ | ✅ | ✅ | No | Custom | Low (no COTS) |

---

## 6. Headline Recommendations (philosophy-aligned)

Three solutions stand out, each for a different philosophical emphasis:

1. **For "true peer" parallel control with broad commercial support: α (Impulse relay, edge-driven).** A mature, off-the-shelf, decades-proven solution from staircase lighting. The lamp's state is the bistable; the rocker is just a pulse source. Manual and RF are genuine peers. Mental model is "any action toggles," which is well understood. **Best general-purpose default.**

2. **For unambiguous explicit commands and no desync: β (SR latch with ON/OFF pulses).** Adds a small ergonomic ask (the user thinks in ON vs. OFF rather than "toggle"), but eliminates the position-state mental model entirely. Best when the user values predictability over invisibility.

3. **For absolute physical truth and zero abstraction: δ (Motorized physical switch).** The switch position *is* the state. Manual-first is unfalsifiable. RF is a true peer. The downside is mechanical — speed, noise, aesthetics. SwitchBot Bot is the off-the-shelf reference; a hidden-solenoid version behind a wall plate is feasible as a custom build. **Most literal answer to the requirement.**

For the **BRIDGE Shadow Layer** specifically (per ARCH-001 tenets — non-invasive, modular, discreet, user-friendly), the layered recommendation is:
- **Default at control points:** α with a maintained rocker (S1) or push-push (S11) wall plate, driving an impulse relay (L1) located in the Shadow Layer space adjacent to the load's switch. RF actuator parallels its dry contact on the L1 coil line.
- **Where users dislike position desync:** β with a 3-position momentary toggle.
- **Where conservative manual supremacy is preferred (e.g., a child's room, a critical fixture):** η.
- **Where retrofitting is impossible:** δ via SwitchBot or equivalent finger device.

---

## 7. Theoretical / Exotic Extensions

- **Diode-OR with manual inhibit line.** Classical logic; manual press can hardware-disable the RF channel via an opto-isolated inhibit line. Pure-logic refinement of η.
- **Capacitor-coupled "manual veto" latch.** A manual press charges a capacitor that holds an inhibit signal active for N seconds, suppressing RF commands. Analog implementation of θ.
- **Multi-actor XOR network.** Generalization of ζ to N actors — every actor is a peer toggle bit in a chain; lamp = XOR of all bits. The "intermediate" element scales arbitrarily.
- **State held in mechanical position of the lamp itself.** A motorized lamp socket that physically rotates to "on" or "off" mechanical positions — silly for incandescent, possibly elegant for theatrical fixtures.
- **Quantum / time-sliced peering.** Round-robin arbitration where each actor gets a time window to assert state; manual wins on contested slots. (Pure exercise; no practical advantage.)
- **Optical bistability.** A photoswitch held by self-illumination feedback (a latching opto-circuit). Manual breaks the loop; RF re-establishes it. Niche but conceptually clean.

---

## 8. Open Questions to Steer the Next Step

1. **Which of α / β / γ / δ matches your intent best as the BRIDGE default?** I'd lean α for general use, with δ (SwitchBot-style) as the retrofit fallback for legacy 101s the user doesn't want to rewire.
2. **Is the position-state desync (XOR mental model) acceptable?** If yes, α is the simplest and cheapest. If no, β is the answer at modest ergonomic cost.
3. **Do you want HOA (γ) available as a *user-selectable* per-room option** — i.e., some rooms get explicit Hand/Off/Auto delegation while others use invisible α? This would be a "trust-tier" feature for sensitive rooms.
4. **Where exactly does the bistable state element (L1) live physically?** My default: in the Shadow Layer space adjacent to the load's switch, taking parallel mains from the Shadow tap, so the impulse relay is always powered and the switch is decoupled. Confirm.
