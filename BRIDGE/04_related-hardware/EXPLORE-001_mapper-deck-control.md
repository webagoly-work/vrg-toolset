# EXPLORE-001 — Cable core mapper, HID DECK, BRIDGE CONTROL wall unit

*Exploration, 2026-10-12. Three base ideas from the BuildTree variant round, each pushed outward:
what it grows into, what to add, where it could pivot, and where it stops. Nothing here is decided
or built. Parts marked **owned** are in BuildTree today; **missing** means a purchase or fabrication.*

---

## 0. The finding that ties the three together

Taken separately they look like a test tool, a gadget and a product. Lined up, they cover the
**whole life of an installation**, and the Planner sits at the start of it:

```
 PLAN                 BUILD / VERIFY              COMMISSION                 OPERATE
 Planner  ──────────► Cable core mapper ────────► HID DECK as site console ─► BRIDGE CONTROL
 circuits, runs,      "is what was pulled         flash, configure, test      the wall unit the
 endpoints, rooms      what was drawn?"            every node on site          client actually touches
       ▲                     │                            │                          │
       └──── as-built ───────┴────── node registry ───────┴──── live state ──────────┘
```

The return arrow is the valuable part. Today the Planner is a one-way design tool. With the mapper
writing **measured runs** back, the deck writing **commissioned node IDs** back, and the CONTROL
units reporting **live state**, the Planner file becomes the as-built record of the house. That is
something an electrician can hand over and a client can keep — and it reuses the naming scheme
STD-004 already fixed (`P33.R03.LU2`).

Recommendation: develop the three as **one programme with a shared spine** (device bus, L0
envelope, Planner IDs), not as three hobby builds. Sections 1–3 explore each; section 4 lists the
shared pieces; section 5 gives a build order.

---

## 1. Cable core mapper — "CoreMap" (placeholder)

### 1.1 Base idea
Two units, one per cable end, linked by ESP-NOW. The near end drives each core in turn, the far end
reports where it arrives. Output: an A→B core table. Owned: 2× C3 Zero, 2× PCF8575, CD74HC4067,
CYD, 18650 + TP4056.

### 1.2 Enhancement ladder

| Level | Adds | How | Parts |
|---|---|---|---|
| **M1 Wiremap** | open, short, crossed cores | digital drive/read on PCF8575 | owned |
| **M2 Fault classes** | core-to-core short vs. open vs. high-resistance joint | analog read via the mux: drive a known current, read the drop | owned + resistors |
| **M3 Resistance → length / cross-section** | loop resistance per core; length from ρ = 0.0172 Ω·mm²/m | constant-current source (~100 mA) + ADS1115. A 20 m 1.5 mm² core is ~0.23 Ω → 23 mV at 100 mA: measurable with a 16-bit ADC, not with the ESP's own ADC | **missing:** ADS1115, precision shunt |
| **M4 Single-ended length** | length of an *open* cable from one end only | core-to-core capacitance by RC charge time, calibrated per cable type (pF/m). Rough (±10–15 %), but needs no far-end unit at all | owned |
| **M5 Passive ID plugs** | identify *which room* a run goes to, many runs at once | see 1.3 — the big one | resistors + plug bodies |
| **M6 Data / SELV mode** | RJ45 T568A/B wiremap, shield, PoE presence | keystone adapter on the same PCF8575 front end; checks the STD-001 CHANNEL bundle C1…C5 order | **missing:** RJ45 keystones |
| **M7 Tone tracer** | find a cable inside a wall | inject an audio tone on one core with the **LM386** (owned), trace with an inductive probe (coil + second LM386) | coil (missing) |

### 1.3 The pivot worth most: passive ID plugs ("room tags")
Professional network testers ship numbered "office ID" remotes. The cheap version needs **no
electronics at the far end**: each plug is a resistor of a distinct value across two cores (or a
resistor ladder across several). From the distribution board, the master measures the resistance
and knows which plug — therefore which room box — that run ends in.

- Drop a plug into every room box during first-fix, walk to the Elosztó, scan every run in one pass.
- The result is a **run → room table**, which is exactly what the Planner's endpoints / room
  auto-snap work needs as ground truth. Each plug carries the Planner endpoint code on its label.
- 16 plugs × 1 % resistors cost almost nothing; the master is the only electronics.

This turns the mapper from "which core is which" into **as-built documentation of the whole
installation**, done in minutes.

### 1.4 Planner tie-in
- Export `kind: cable.map` (L0 envelope): run ID, from/to endpoint, core table, measured R, length
  estimate, date, unit serial.
- The Planner shows a **measured** badge on a run and flags drift: drawn 18 m, measured 26 m;
  drawn 5 cores, found 3 continuous.
- Feeds the cost model too — measured lengths are better takeoff than drawn ones for the next job.

### 1.5 Other pivots
- **Commissioning kit**: mapper + Modbus meter reader + the deck (section 2) in one case = the
  "Átadási készlet" for every BRIDGE handover.
- **Rental / product for other electricians**: the passive-plug kit is the part others would buy.
  Would need a proper enclosure, input protection and a clear "not a voltage tester" label.
- **Permanent "smart terminal strip"**: a mapper front end left in the BRIDGE consumer unit that
  self-tests SELV runs at night and reports a broken core before a client notices (pairs with the
  STD-004 pair-3 fault line idea).

### 1.6 Hard limits — say them on the device
- **Dead cable only.** Add a front-end guard: series resistor + PTC + TVS per input, and a
  "voltage present → refuse to drive" check. That protects the tool; it does **not** make it a
  voltage tester.
- **Not an insulation-resistance tester.** IR needs 250/500 V DC from a proper instrument, and the
  Hungarian handover measurement record still needs calibrated instruments and a qualified
  signature. The mapper documents topology; it does not replace the MSZ HD 60364-6 measurements.

---

## 2. HID DECK — from macropad to engineer's console

### 2.1 Base idea
BASE + SCREEN + GRIP, as in `HID-DECK-concept.md`: one composite HID to the PC, ESP-NOW between
units, BLE fallback. Stage 1 is the S3-Zero knob pad with its web page.

### 2.2 Enhancements that make it *yours* rather than a generic Stream Deck
1. **Claude Code pad.** Keys for approve / reject / continue, a push-to-talk dictation key, and a
   status LED fed by Claude Code **hooks** (Notification / Stop hooks run a one-line
   `curl http://vrg-knobs.local/led?state=waiting`). You see from across the room whether a session
   is waiting for you. Smallest build here with a daily payoff.
2. **Planner console.** Encoders on camera orbit/zoom, a layer key per Planner layer, the
   joystick as pan, the TM1638 showing the active tool. The Planner reads the device's `/state`
   over HTTP, so it works from `file://` with no secure-context problem.
3. **Phone photo trigger on site.** A BLE HID "volume up" press fires the phone camera shutter.
   The GRIP in a pocket takes tagged site photos (the GRIP also sends the current Planner room/run
   to the laptop, so the photo lands in the right folder).
4. **Feedback, not just input.** LEDs, OLED and a vibration tick driven by the PC: active app,
   mute state, build status, Planner validation errors.
5. **Profiles as data.** `hid.profile` JSON edited in `vrg-hid-profile.html`, pushed over HTTP to
   the device's own API — again no WebHID, so no secure-context blocker.

### 2.3 Pivots
- **A. Site console (merges with section 1).** The BASE goes into a site case: flasher (USB-A host
  + firmware images), mapper master, Modbus reader, Zigbee/Thread sniffer (CC2531, C6). The GRIP
  is the remote you hold while standing at a distribution board. This is the **commissioning
  role** in the lifecycle diagram, and probably where the deck earns real money.
- **B. Modular deck.** Snap-on modules (encoder module, key module, screen module) on a magnetic
  pogo bus carrying 5 V + I²C. Each module is just I/O (PCF8575 / encoder / OLED) with an address;
  the BASE enumerates what is attached. You already own enough modules for three or four tiles.
- **C. 3D-mouse puck for the Planner.** Joystick + twist encoder + push = 4–5 axes in one puck.
  Not 3Dconnexion-compatible (their protocol is proprietary), but the Planner does not need it to
  be — it reads the puck directly.
- **D. One-handed / accessibility controller.** The GRIP as a full one-hand keyboard with chord
  input (reference 16 in the concept doc). Niche, but it is what makes the GRIP more than a remote.
- **E. BRIDGE house remote.** The GRIP talks MQTT/ESP-NOW to BRIDGE as a universal scene remote;
  the SCREEN becomes a roaming wall panel. Overlaps with section 3 — see 3.5.

### 2.4 Where it should stop
The concept doc already lists seven open decisions. The risk is building the BASE compute core
first. Keep the order: knob pad → Claude Code / Planner console → GRIP over ESP-NOW → site case.
Decide pivot A vs. B before any enclosure work; they want different shells.

---

## 3. BRIDGE CONTROL wall unit

### 3.1 Base idea
Encoder + OLED + presence + temperature in a flush box; drives light, shading, scenes. In the
catalogue this is the **sys:CONTROL** category that replaced HMI (PAN/THR).

### 3.2 First correction to the variant as written
The BuildTree variant listed a 230 V → 5 V in-box module as missing. **Don't.** STD-008 already
solved this for notification lights: **NL-F/L takes 24 V from the RoomBox LV rail or the assured
bus**, through the portal stub-out. A CONTROL unit on the same 24 V SELV feed needs no certified
mains PSU in the wall box, keeps the faceplate SELV, and inherits the assured-bus behaviour.

### 3.3 The control model has to respect manual-first
STD-006: the human's physical action always lands on what it governs, and **the manual path never
traverses BRIDGE_LINK**. So the wall unit cannot be "a screen that asks the server". Two options:

| Model | How a press reaches the light | Survives controller loss | Fits |
|---|---|---|---|
| **CONTROL-L (local)** | wired to its RoomBox sub-controller; the RoomBox switches the load | yes — the RoomBox keeps local rules | S-B / S-C, new work — **recommended default** |
| **CONTROL-W (wireless)** | ESP-NOW ch 1 to the RoomBox, with the existing wall switch kept as fallback | yes, via the kept switch | S-A retrofit |

Either way the encoder press is a P2 manual action and must work with COMP, network and Wi-Fi down.

### 3.4 Feature ladder

| Level | Feature | Notes |
|---|---|---|
| **C0** | Rotary dimmer with a clear grammar | rotate = level (perceptual `duty = s³`, STD-002); press = toggle; long press = scene menu; double press = room off; **rotate while pressed = colour temperature** inside the 2700–4000 K window |
| **C1** | Context on the OLED | scene name, room temperature, what the last automation did and why (STD-006: overrides must announce themselves) |
| **C2** | Calm display | dark until a hand approaches: ToF (VL6180X) or radar wakes it. No glowing panel in a bedroom at night |
| **C3** | Touchless action | wave over the ToF = toggle (kitchen, dirty hands) |
| **C4** | Notification ring | the STD-008 four-pixel alphabet around the knob: hue = category, red only for fault/alarm |
| **C5** | Identity at the entrance unit | NFC tap for a Trinity tag; PIN on the 4×3 keypad (U24). Tap = carried factor only — **T3 still needs one active factor**, so a tap alone never unlocks anything |
| **C6** | Haptics | detents and an end-stop buzz in firmware (vibration motor owned); a real haptic knob (BLDC) is a later option |

### 3.5 The pivot worth most: the Portal Panel
STD-008 puts an **NL-TR beside every portal**, on the latch side, at **1100 mm**, sharing the portal
stub-out. STD-003 puts **dual ToF above every portal** for crossing direction and count. The wall
switch traditionally sits in the same place.

So merge them: **one faceplate per doorway = switch (CONTROL) + notification light (NL-TR) + the
portal's crossing sensor link.** One box, one 24 V feed, one bus address, already in the height
schedule. Benefits:
- Fewer devices and boxes per room; nothing new in the conduit plan.
- The panel *knows* someone just crossed, so it can wake, show the room's scene and offer the
  likely action first.
- In egress mode it becomes the white 5 % wayfinding light STD-008 §5 already specifies.

This is a strong candidate for the **BRIDGE signature device** — the thing a client sees at every
door — and it falls straight out of standards already written.

### 3.6 Other pivots
- **Retrofit stick-on (S-A).** A battery CONTROL-W that mounts over an existing switch plate:
  C3/C6 in deep sleep, ESP-NOW, 18650 or AAA. The entry product for houses without BRIDGE wiring.
- **Bedside / desk version.** The same firmware in the knob-pad body — which is how the HID DECK
  and CONTROL share code (section 4).
- **Thread/Matter edition.** C6 version that joins Apple/Google/HA homes directly; lets BRIDGE
  panels sell into homes that will never have a BRIDGE controller.
- **Planner-generated configuration.** The Planner already places sys:CONTROL devices with room
  and circuit references. Generate each unit's config (ESPHome YAML or a JSON profile) **from the
  Planner file**: room, loads, scenes, neighbours. Commissioning becomes "flash and scan", which
  is section 2's site console doing its job.

### 3.7 Constraints to check early
- **Insert format.** Decide whether the faceplate targets a commercial frame series (so it sits in
  a row with ordinary switches) or a BRIDGE-own plate. Check which series the clients actually use
  before designing a single part.
- **Depth.** OLED + encoder + MCU + ToF + pixel ring must fit a standard 60 mm box *with* the 24 V
  terminal block. Mock it up with owned parts first.
- **Certification, if sold.** SELV-only keeps it out of the low-voltage directive, but EMC and the
  radio directive still apply; use pre-certified radio modules (the ESP modules themselves) to keep
  that manageable.

---

## 4. Shared spine (build once, use three times)

| Piece | Used by | Status |
|---|---|---|
| Device HTTP API + mDNS + WiFiManager + OTA | deck, CONTROL, mapper master | outlined in chat 2026-10-12 |
| ESP-NOW link library (pairing, fixed channel 1, struct packets) | all three | channel 1 already fixed by STD-005 |
| L0 envelope kinds: `cable.map`, `hid.profile`, `node.registry`, `control.config` | Planner import/export | new kinds to register |
| Planner IDs (`P33.R03.LU2`) carried by every device and every measurement | all three | STD-004 |
| Input grammar (rotate / press / long / double / rotate-while-pressed) | deck + CONTROL | define once |
| STD-008 pixel alphabet | deck status LEDs + CONTROL ring | exists |

---

## 5. Suggested order (each step uses owned parts and leaves something useful)

1. **Knob pad + Claude Code status LED** — S3-Zero, encoders, web API. Proves the spine.
2. **Mapper M1 → M5** — two C3 Zeros, PCF8575s, then the resistor ID plugs. First real job use.
3. **CONTROL C0–C2 on the bench** — S3-Zero + OLED+EC11 + VL6180X on 24 V via the SJV-4W,
   talking to a stand-in RoomBox (a second ESP). Settles the grammar and the box depth.
4. **Planner round-trip** — import `cable.map`, show measured runs; export `control.config`.
5. **Portal Panel mock-up** — CONTROL + four-pixel ring + ToF in one 60 mm box.
6. **Site console case** — BASE + mapper master + flasher + Modbus reader.

## 6. Open questions for the user

- **Q1.** Which leads: the Portal Panel (product), the mapper with ID plugs (trade tool), or the
  Claude Code / Planner console (daily-use)?
- **Q2.** Mapper scope: power cables only, or SELV/data (RJ45, CHANNEL bundles) from the start?
- **Q3.** CONTROL default: local wired (CONTROL-L) for new work and wireless only for retrofit — agree?
- **Q4.** Faceplate: commercial frame series (which one?) or a BRIDGE-own plate?
- **Q5.** Is the deck's future the site console (pivot A) or the modular desk deck (pivot B)?
