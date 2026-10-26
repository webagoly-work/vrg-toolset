# BRIDGE-STD-010 — Ambiance Lights and the Effect Box (FXB)

**Doc:** BRIDGE-STD-010 · **r0.2 — outline, shapes and firmware decided, firmware facts verified** · 2026-10-26 · English
**Origin:** user brief 2026-10-26, expanding BRIDGE-MW-001 §4.6 (light and scenes)
**Built on:** STD-002 §1 · §2 · §3.3 (C05 effect-capable rooms) · §7 (bus A / bus B) · §8 (scenes) · §10 ·
STD-004 §1.2 · §3 (BRIDGE_LINK) · §4 (C2-T) · STD-006 §1.1 (the ladder) · STD-008 §6 (ESP-NOW) ·
STD-007 (the audio and video paths an effect may follow) · MW-001 §1 · §3 (MW-SVC) · §4.8
**Scope:** an ambiance-light subsystem of **eight light sources of any type**, driven by one programmable
controller — the **Effect Box** — that people can script, extend with their own sensors, and use to run
complex light patterns through **one unified model** instead of eight different drivers.

> **This is an outline.** Every section below names what it will contain and the decisions that shape it.
> Numbers marked *(proposed)* are starting values for the review, not settled figures. §2 started with five
> alternative architectures; the 2026-10-26 tuning (clients pick effects · mixed installs · openness first)
> kept three and turned them into one open firmware on three hardware shapes. §11 asks which shapes r1 carries.

---

## 0. Why a separate standard

STD-002 treats ambiance as **one of five layers on bus A**, driven channel by channel from Z2. That is right
for a cove that dims. It does not cover:

- **Mixed sources in one composition.** A pixel strip, a tunable-white cove, a 230 V floor lamp and a
  third-party RGB spot behind the screen should play *one* effect, not four integrations.
- **Effects, not levels.** Chases, waves, breathing, music- and screen-reactive patterns need a frame
  clock, a pixel map and timing that a scene (a set of setpoints, STD-002 §8.1) does not have.
- **Owner programmability.** The user wants to write scripts and attach their own sensors without
  touching the house's safety-relevant control.

The Media Wall makes this concrete: MW-001's tier R already home-runs **every light run to the service
column as its own SELV pair** — that is an eight-channel effect box waiting for its box.

**The standard's one-line rule** *(proposed)*: **the Effect Box may make light beautiful, never make it
necessary.** Nothing the house relies on (egress, notification, safety) is ever an Effect Box output.

---

## 1. Position in BRIDGE

### 1.1 What it is and is not
- **Is:** the controller of the AMBIENT and ACCENT layers (and the bias light) in the **effect-capable
  rooms** of C05 — living and media room — and anywhere else the client buys it.
- **Is not:** an egress driver (bus B stays with the RoomBox and the hardwired latch, STD-002 §7.2), a
  notification output (STD-008 owns that alphabet), a mains switching device (Z1's bistable relays stay
  per lamp, C30).

### 1.2 Bus and reliability class
- Powered from **bus A — convenience**. It may fail freely; the room stays lit by its architectural layer.
- Own fused, current-monitored 24 V branch from the RoomBox or MW-SVC (STD-002 §7.4 rules).

### 1.3 Authority — where effects sit on the ladder (STD-006 §1.1)
| Source | Class | Consequence |
|---|---|---|
| Hardware limiter inside the box (§6) | **P0** | a script cannot exceed it |
| Wall control for the ambiance group | **P2** | always wins; hold-off per STD-006 §1.3 |
| App / voice "play effect X" | P3 | |
| **Effect playback** | **P4 (scene)** | an effect is a scene with a clock |
| Reactive triggers (presence, CEC, music start) | P5 | |
| Circadian background | P6 | effects suspend it, not fight it |

### 1.4 Type code and naming (STD-004 §1.2)
- New three-letter code **`FXB`** — effect box. *(proposed; needs adding to the §1.2 table)*
- Its outputs stay `LNR` / `LMP` endpoints; the channel is an attribute: `…-LNR03 ← FXB01.ch3`.
- Sensors attached to the box are ordinary `SEN` endpoints with `FXB01` as their parent.

---

## 2. Alternative architectures — tuned 2026-10-26

### 2.0 The tuning brief

The user set four criteria on 2026-10-26:

| Criterion | Answer | What it changes |
|---|---|---|
| **Main user** | **clients who pick effects** | the effect library and the picking UI matter more than a script engine; scripting becomes an advanced extra |
| **Install base** | **mixed** — new BRIDGE rooms and retrofits | a wired core *and* a wireless extension are both needed |
| **First priority** | **openness** | community firmware, open protocols, Home Assistant; nothing proprietary on the wire or in the box |
| **Kept** | **A, B, D** | C and E move to §2.5 *considered, rejected*, with what each leaves behind |

**What the tuning found.** Under openness the three survivors stop being rivals. They become **one open
firmware on three hardware shapes**: the firmware is the product the client meets (its app, its effects,
its Home Assistant entity), and the hardware shape is chosen by the tier and the room. A client who starts
with a puck in a rented flat and later buys a BRIDGE media wall sees the same app and the same effects.

**The base is WLED** (FX-Q9 A, decided 2026-10-26): pixel and effect first, with a client app. The facts
below were checked on 2026-10-26 against **WLED `v16.0.1`** (the latest release, 2026-07-07) and the ESP-IDF
LEDC documentation; §2.7 lists them with sources. Like any third-party source, the firmware is vendored
through `vendor-manifest.json`, pinned to that **tag**, with its licence carried along: **EUPL-1.2**
(confirmed). EUPL is a copyleft licence, so a modified WLED we ship must have its source published.
That is no problem for an openness-first product, but VRG's own guard firmware (§2.2) is a separate program
and can carry its own licence.

### 2.1 ALT-A → FXB-Open — the open controller

- **Shape:** one ESP32 board with the open firmware unmodified and eight output card slots.
  - **Chip: the classic ESP32**, not the S3. WLED's PWM outputs are limited by the chip's LEDC hardware:
    **16 on the ESP32, 8 on the S3, 6 on the C3**. Pixel outputs are separate: **16 / 12 / 2**.
  - **So eight channels of any type do not fit one chip if most are analogue.** 16 PWM wires cover, for
    example, 2 × `RGBW` + 2 × `CCT` + 4 × `MONO`. Pixel channels cost no PWM wires. A box where most channels
    are analogue colour is an FXB-Guarded job (§2.2).
  - WLED's analogue types map onto §3.2 one to one: 1 channel = `MONO`, 2 = `CCT`, 3 = `RGB`, 4 = `RGBW`,
    5 = `RGBWW`.
- **Client face:** the firmware's own app and web page, plus a **VRG effect pack**. The pack holds curated,
  named presets per room (Watch, Film, Ambient, Night …) and is installed at handover.
- **Advanced use:** scripting runs **off the box**, through the open API (Home Assistant, Node, Python),
  or as compiled firmware usermods for developers. The box itself is not a programming environment.
- **Open protocols:** HTTP/JSON, MQTT, UDP sync and ESP-NOW sync; **DDP in and out**; E1.31 and Art-Net in.
- **What remains weak:**
  - There is no guard under the firmware. §6's flash cap and fail-state are only as good as its configuration.
  - **Flicker is already met:** WLED's default PWM on the ESP32 is **19 531 Hz**, far above the ≥ 3 kHz rule
    and inside the 10–20 kHz target (STD-002 §3.2). It is set in LED preferences, so commissioning only
    checks that "Normal" is still selected.
  - **The current limiter does not cover PWM.** WLED's automatic brightness limiter works on pixel
    outputs only, per output if that option is enabled. It explicitly does not work on analogue PWM.
    **Every PWM slot therefore needs its own fuse and current limit on the output card**, which §4.2
    already asks for. In FXB-Open this is the only protection the PWM channels have.
  - Remaining mitigations: curated effects only in the client pack; a flash-cap usermod, or accept the gap.
- **Fits:** MW tier C (as a smart controller), tier R once the box is fitted; any room outside C05.

### 2.2 ALT-B → FXB-Guarded — the same firmware, with a guard

- **Shape:** the FXB-Open board **plus an open-source guard co-processor** (RP2040) between the ESP32 and
  the slots.
  - The ESP32 sends frames in **DDP**, which WLED already transmits through a virtual DDP output (RGB or
    RGBW). Over the network that needs no WLED change; over UART or SPI inside the box it needs a small
    transport change *(proposed)*.
  - The guard removes FXB-Open's PWM ceiling: its PWM no longer comes from the ESP32's 16 LEDC channels.
  - The guard renders PWM ≥ 3 kHz and CCR set-points, enforces every §6 limit and runs the fail-state.
- **Change from r0:** the app core no longer runs a bespoke script sandbox. It runs **the same open
  firmware as FXB-Open**, so the client sees no difference. An on-box script sandbox (Lua) becomes an
  optional later addition, not the core of the design.
- **Openness:** VRG publishes the guard firmware under an open licence, together with the frame format.
  Anyone can write a different app core that talks to the guard.
- **Fits:** MW tier B and the C05 effect-capable rooms. **It is the only shape that implements §6 as a
  true P0**, below anything a person or a script can change.

### 2.3 ALT-D → FXB-Puck — the same firmware, one light per node

- **Shape:** a single-output node (ESP32-C3) with one output card, powered from 12 / 24 V or USB.
  - A 230 V lamp stays a `MAINS` request to a relay or dimmer. A puck never switches mains.
- **Chip:** the ESP32-C3. Its 6 PWM channels are enough for one `RGBWW` light (5), and it has 2 pixel outputs.
- **Sync, two modes:**
  - **Wi-Fi (default):** the conductor sends frames to the pucks over DDP, or WLED's UDP sync shares effect
    and settings. Every puck stays on the network, so it remains visible in the app and in Home Assistant.
  - **ESP-NOW (STD-008 §6.1):** WLED v16 sends and receives its sync packets over ESP-NOW broadcast. But a
    follower **only accepts ESP-NOW sync while it is not connected to Wi-Fi**, and the sync is one-way,
    leader to followers. An ESP-NOW puck therefore has no app or Home Assistant of its own, and only the
    leader can be controlled. That suits a puck that should simply follow — a lamp on a sideboard, or
    an outdoor puck beyond the Wi-Fi — not the default.
- **Conductor:** either the FXB-Open or FXB-Guarded box in the same room, or a puck elected leader.
  A pucks-only room needs **no box at all**.
- **Fits:** retrofits, rentals, MW-L5 rail walls, and the **wireless extension of a wired box** —
  which is what a mixed install base asks for (a lamp in the corner joins the media wall's effect).

### 2.4 Comparison, tuned

| | **FXB-Open (A)** | **FXB-Guarded (B)** | **FXB-Puck (D)** |
|---|---|---|---|
| Client picks effects in | the firmware app + VRG pack | **the same** | **the same** |
| Firmware | open, unmodified | open + open guard | open, unmodified |
| Wire protocols | open | open + open frame format | open |
| §6 limits as true P0 | ✗ (config only) | **✓** | ✗ (config only) |
| Autonomy without COMP / network | ✓ | ✓ | per puck ✓, sync ✗ |
| Mixed source types | via cards | **via cards, CCR native** | one type per puck |
| Retrofit, no home-run | ✗ | ✗ | **✓** |
| Parts cost per channel | **lowest** | low-mid | mid (a node per light) |
| Natural tier | C / R | **B** | retrofit + extension |

### 2.5 Considered, rejected

| Alt | Why rejected (2026-10-26) | What stays from it |
|---|---|---|
| **ALT-C DMX-native** | no autonomy; every fixture needs addressing at commissioning; a client cannot pick an effect without show software | **E1.31 / sACN input on every box** as an open "show mode", and a **DMX output card** for exotic fixtures |
| **ALT-E light modular** | large, dear, analogue drift, and built for patching rather than picking | a **physical effect picker**: a rotary knob on the box front and a preset key on the wall panel. Clients choose by touch, not only in an app |

### 2.6 Decided 2026-10-26

- **FX-Q1 A:** the standard carries **all three shapes**: Open (tier C/R), Guarded (tier B), Puck (retrofit and
  extension).
- **FX-Q9 A:** the base firmware is **WLED**, pinned to `v16.0.1`.

r1 is written for this family.

### 2.7 Verified firmware facts (2026-10-26)

| Fact | Value | Source |
|---|---|---|
| WLED release pinned | **v16.0.1**, 2026-07-07 | GitHub API, `wled/WLED` releases/latest |
| Licence | **EUPL-1.2** | `LICENSE` at `main` |
| Hardware PWM (LEDC) channels | **ESP32 16** (2 groups of 8) · **S3 8** · **C3 6** | ESP-IDF LEDC docs per chip |
| WLED analogue outputs | `LEDC_CHANNEL_MAX × LEDC_SPEED_MODE_MAX` → 16 / 8 / 6 | `wled00/const.h` @ v16.0.1 |
| WLED pixel outputs | RMT + I2S → **ESP32 16 · S3 12 · C3 2** | `wled00/const.h` @ v16.0.1 |
| Analogue types | 1 ch (single) · 2 ch (WW + CW) · 3 ch RGB · 4 ch RGBW · 5 ch RGB + WW + CW | `const.h` `TYPE_ANALOG_1CH…5CH` |
| Default PWM frequency | **ESP32 19 531 Hz** (80 MHz APB) · **S3 9 765 Hz** (40 MHz XTAL) · selectable in LED preferences | `const.h` `WLED_PWM_FREQ`; ESP-IDF `soc_caps.h`; kno.wled.ge settings |
| Automatic brightness limiter | on by default, PSU limit 3000 mA, optional per-output limit; **not for analogue PWM** | kno.wled.ge settings |
| Real-time inputs | DDP (port 4048) · E1.31 · Art-Net · UDP realtime · TPM2.NET · Hyperion | kno.wled.ge interfaces |
| DDP output | yes — virtual DDP RGB / RGBW bus; E1.31 / Art-Net output types defined but marked unused | `const.h` `TYPE_NET_*`; `udp.cpp` `realtimeBroadcast()` |
| ESP-NOW sync | send and receive, broadcast, one-way; a follower accepts it only while **not** on Wi-Fi | `udp.cpp` `notify()`, `espNowReceiveCB()` |
| Wired DMX output | compile-time `WLED_ENABLE_DMX` (or a `_dmx` build), MAX485 on GPIO2, pin hard-coded | kno.wled.ge DMX output |
| WS2814 | no own type; SK6812 RGBW (`TYPE_SK6812_RGBW`) is the RGBW pixel type | `const.h` |

**Consequences carried into the standard:**
- The **DMX output card** (§4.2) needs a custom WLED build. It is not in the standard binary, so it is a
  Guarded-only card (the guard drives the DMX line) or a special build.
- **WS2814** strips (STD-008's LV pixel) are run as SK6812 RGBW. Channel order is to be checked on the bench.
- There is **no native CCR or 0–10 V output** in WLED. Both are output-card hardware: a CCR driver with a PWM
  dimming input, or a PWM-to-0–10 V converter. The firmware only ever sees PWM.

## 3. The unified light model (all alternatives)

The heart of the standard: one data model so that an effect never knows what hardware it plays on.

### 3.1 The channel
- **Eight logical channels** `ch1…ch8`. A channel = **one light source as the user sees it**
  (a cove, a lamp, a strip), however many wires it needs.
- Each channel declares a **profile** (§3.2), a **geometry** (§3.4) and **limits** (§6).

### 3.2 Source profiles ("any type of light source")
| Profile | Physical | Wires / signal | Notes |
|---|---|---|---|
| `MONO` | single-colour 24 V strip / spot | 1 × PWM or CCR | the workhorse |
| `CCT` | tunable white | 2 × PWM/CCR | STD-002 §5.2 locus lookup in the box |
| `RGB` / `RGBW` / `RGBWW` | colour strip / spot | 3–5 × PWM/CCR | white from white (STD-002 §10) |
| `PIX` | addressable strip (WS2814 / SK6812) | data (+clock) | n pixels, pixel map |
| `ANALOG` | third-party driver | 0–10 V / 1–10 V | curve measured at commissioning |
| `DMX` | DMX fixture or decoder | RS-485, n slots | covers exotic sources |
| `MAINS` | 230 V lamp | **request only** → Z1 relay / dimmer over BRIDGE_LINK | box never switches mains itself |
| `VIRTUAL` | a NTL, a screen, another box | message | for compositions across systems (read-only for NTL: alphabet stays STD-008's) |

### 3.3 The value space
- **Intensity:** perceptual `s` × 1000, exactly as on the wire in STD-002 §2.2 ↔ STD-004 §3.4; the box owns the
  `s³` curve and per-fixture correction.
- **Colour:** one of `CCT + Duv`, `xy`, or `HSV` — converted per profile; a `MONO` channel ignores hue,
  a `CCT` channel clamps to the locus.
- **Pixels:** a per-channel pixel buffer, or a sampled position along the channel's geometry (§3.4).
- **Rule:** effects write *intent*, the profile renders it — the same "intent, never duty" principle.

### 3.4 Geometry and the room map
- Each channel has a shape: point, line (length, direction), ring, or matrix; and a position in room
  coordinates (the Planner already knows them).
- Effects can then be **spatial** — "a wave left to right across the media wall" plays across the
  cove, niches and a lamp in the corner in the right order, whatever their types.

### 3.5 Groups and layers
- Channels group by STD-002 layer (AMBIENT / ACCENT / viewing) so that scenes can still say
  "ACCENT 40 %" and the box obeys.
- Effects stack in **layers with blend modes** (replace, add, multiply, max) and a master per layer.

---

## 4. Hardware outline (written for FXB-Guarded; FXB-Open drops the guard, FXB-Puck keeps one slot)

### 4.1 Form
- DIN-rail enclosure for MW-SVC or RoomBox Z2 on the 18 mm module *(proposed: 9 modules, 162 mm)*;
  passive cooling inside the STD-001-A1 budget.
- Front: status pixel per channel, a local **"ambiance off / default" button** (manual-first in miniature).

### 4.2 Output slots
- **Eight slots, one connector type** *(proposed: 6-pole pluggable terminal — +24 V, GND, 4 signal)*.
- **Output cards** plug per slot: `PWM-4`, `CCR-4`, `PIX` (level-shifted data + clock), `0-10V-2`,
  `DMX`, `REQ` (BRIDGE_LINK request to Z1). The card's ID tells the box the slot's capability.
- Per-slot fuse, current sense, and a slot power budget *(proposed: 4 A @ 24 V per slot, box total 15 A)*.

### 4.3 Inputs and expansion
- **Sensor bus:** 2 × I²C (Qwiic / STEMMA QT connector — the hobby ecosystem for "custom sensors").
- **4 × GPIO / analog** on a screw terminal, 3.3 V / 24 V-tolerant variants.
- **Audio in:** line-level (from the STD-007 Path A/B split) for music-reactive effects.
- **Video sample in** *(option)*: HDMI-passthrough colour sampler for screen-reactive (ambilight-type) mode.
- **Comms:** Ethernet (media VLAN) + Wi-Fi + **BRIDGE_LINK RS-485** + ESP-NOW (for FXB-Pucks and NTLs).

### 4.4 Power
- 24 V in from bus A only; no internal mains. A 230 V source is a `MAINS` request, never a load on the box.

---

## 5. Programming model

### 5.1 Three levels of user
| Level | Who | How |
|---|---|---|
| **Pick** | client | choose effects + colours in the app or on a wall panel |
| **Compose** | power user | node/graph editor: source → effect → mapper → channels; no code |
| **Script** | developer / owner | text scripts in a sandbox |

### 5.2 The effect pipeline
`inputs (time, sensors, audio, video, presence) → effect → mapper (geometry) → layers/blend → limiter → profiles → slots`

### 5.3 Built-in effect library *(to be listed in r1)*
Static, fade, breathe, chase, wave, gradient sweep, sparkle, fire/candle, sunrise/sunset, audio
spectrum, beat pulse, screen-reactive, presence follow ("light walks with you"), slow circadian drift.

### 5.4 The script sandbox — alternatives

> **Tuned 2026-10-26:** since clients pick effects, scripting is an advanced extra. The default is
> **off-box** through the firmware's open API. An on-box sandbox is a later option for FXB-Guarded only.

| Option | For | Against |
|---|---|---|
| **Lua** (or Berry, as in Tasmota) on the app core | tiny, proven on ESP32, easy to teach | another language to support |
| **JavaScript subset** (QuickJS / Espruino) | matches the VRG toolset language | heavier on an ESP32 |
| **WebAssembly** (WAMR) | any language compiles in; strong isolation | toolchain friction for owners |
| **Off-box** (HA, Python over the API) | zero firmware work; **the tuned default** | scripted effects stop with HA / the network; the built-in and preset effects still run on the box |

Common rules whatever the language: fixed tick (*proposed 50 Hz, 100 Hz for PIX*), CPU budget per tick,
watchdog, no direct pin access — scripts see only the §3 model and declared sensors.

### 5.5 The sensor plug-in contract
- A sensor declares: name, unit, rate, range → it appears as an input in the compose editor and in scripts.
- Published to HA / BRIDGE as a normal `SEN` value; presence-grade sensors still go through STD-003 fusion,
  not straight into effects.

### 5.6 Storage and sharing
- Effects as small text files (JSON graph or script + manifest); versioned; export / import between
  boxes and clients; a VRG effect pack as a deliverable.

---

## 6. Limits the script cannot cross (P0 inside the box)

- **Flicker:** PWM ≥ 3 kHz always (STD-002 §3.2); CCR where C05 says so. Effects modulate the *envelope*, never the carrier.
- **Photosensitive safety:** a **flash limiter** in the RT core — no more than 3 large luminance flashes
  per second (WCAG 2.3.1 general threshold), saturated-red flash rule *(to research)*; strobe effects need
  an explicit opt-in per room and still obey the cap.
- **Power and heat:** per-slot current cap, per-strip W/m derating, box thermal derating.
- **Brightness ceilings** per channel (e.g. bias light ≤ the D65 10 % rule of MW-001 §4.6 in Film).
- **Rate of change** at night (no sudden full-white after 22:00 — circadian floor from STD-002 §6).
- **Fail-states:** frame loss → hold last frame *n* s → fade to the room's **default ambient** or off
  *(decision: which)*; boot → default, never a random frame.

---

## 7. Integration

- **Scenes:** every STD-002 / MW-001 scene (Watch, Film, Ambient, Night) maps to an effect or a static
  frame; Film forces the bias light to static D65 and suspends screen-reactive mode.
- **BRIDGE_LINK registers** *(outline)*: active effect ID, master intensity, layer masters, scene ID,
  fault bits, last-command provenance (STD-006 §1.6 "why is this on?").
- **Home Assistant / ESPHome API**, MQTT; **sACN in** as an optional "show mode" input.
- **Multi-box sync:** a shared effect clock (PTP-lite over Ethernet, or the ESP-NOW beacon) so two
  boxes — or a box and its pucks — play one effect seamlessly. *(target skew to be measured)*
- **Media:** audio tap from STD-007, CEC / network screen-state from MW-001 §4.6.
- **Notification:** an NTL event may *duck* the effect (dim it for the alert) but never borrow its channels.

---

## 8. Installation outline

- Home-run per channel to the box (MW-R / MW-B practice), each as its own SELV pair or 4-core for colour.
- Cable by profile: `MONO` 2-core · `CCT` 3-core · `RGBW` 5-core · `PIX` 4-core (power + data + GND,
  data run ≤ *proposed* 5 m before a buffer) — dimensioned in r1 against STD-002 §7.4's 3 % drop.
- Power injection rules for long pixel runs; data and PWM runs kept apart from MAINS (A2 §5).
- Labels: channel number on both ends, profile on the box's channel card.

---

## 9. Commissioning (outline)

- [ ] Each slot's card identified; each channel's profile, geometry and limits entered.
- [ ] Perceptual curve and minimum level measured per channel (STD-002 §2.3).
- [ ] A spatial test pattern runs across all eight in the right order and direction.
- [ ] Flash limiter proven with a test script that tries to strobe.
- [ ] Kill the app core: the RT core holds, then falls to default as specified.
- [ ] Wall control (P2) overrides a running effect and holds for the hold-off.
- [ ] Film scene: bias light static D65 at the MW-001 §6 level.
- [ ] Effects, scripts and sensor manifests backed up and filed against the room in the Planner.

---

## 10. Media Wall tie-in

| MW tier | Effect Box |
|---|---|
| **C — Classic** | none; a smart dimmer per driver |
| **R — Ready** | home-runs already land in MW-SVC → an Effect Box can be fitted later with no wall work |
| **B — BRIDGE** | FXB in MW-SVC on bus A; cove, niches, bias + up to five extra sources (shelf, art, floor lamp via `MAINS`, ceiling, outside) |

Possible new module: **MW-FXP** — a front-panel cut-out in MW-SVC showing the channel pixels and the
local button *(proposal)*. Planner tie-in later: the FXB as a Stack object with eight channel ports.

---

## 11. Decisions wanted (A recommended)

| Ref | Question | A | B | C |
|---|---|---|---|---|
| **FX-Q1** ✓ **A, 2026-10-26** | Shapes the standard carries (§2.6) | **all three: Open (tier C/R) · Guarded (tier B) · Puck (retrofit + extension)** | Guarded + Puck only — every box has the guard | Open + Puck only — no guard chip; §6 limits by configuration |
| **FX-Q9** ✓ **A, 2026-10-26** | Base open firmware | **WLED class: effect-first, client app, pixels + PWM** | ESPHome: Home Assistant-first, YAML, weaker effects | own firmware (against the openness priority) |
| **FX-Q2** | Channel count | **8 logical channels, cards may serve fewer** | 8 physical slots = 8 × 4 PWM wires | expandable by a second box |
| **FX-Q3** | Scripting | **off-box through the open API (HA / Node / Python); on-box Lua later, Guarded only** | Lua / Berry on every box | firmware usermods only |
| **FX-Q4** | 230 V sources | **request-only over BRIDGE_LINK to Z1** | certified DMX dimmer packs (ALT-C) | excluded |
| **FX-Q5** | Fail-state | **fade to the room's default ambient** | fade to off | hold last frame |
| **FX-Q6** | Sensor connector | **Qwiic / STEMMA QT + screw GPIO** | screw terminals only | RJ45 sensor bus |
| **FX-Q7** | Physical effect picker (borrowed from ALT-E) | **rotary knob on the box + preset key on the wall panel** | wall panel only | app only |
| **FX-Q8** | Next deliverable | **r1 of this doc for the chosen ALT** | a bench prototype brief (BOM + firmware split) | the client sheet (HU) |

## 12. Open items

- `FXB` must be added to the STD-004 §1.2 type-code table once accepted.
- The red-flash and pattern rules for photosensitive safety need a source check before r1.
- Sync skew targets (wired and ESP-NOW) need a bench measurement.
- The video sampler (screen-reactive mode) and HDCP: what can legally and technically be sampled.
- Cost per channel for each shape, against MW-001's tier prices.
- ~~Firmware facts in §2 marked *(to verify)*~~ — **checked 2026-10-26, §2.7.** Still open from that check:
  the WS2814 channel order, and whether the ESP32-C3 build uses the 9 765 Hz XTAL default like the S3
  (both are above 3 kHz either way).
- A PWM slot card with its own current limit, because WLED's limiter does not cover PWM (§2.1).
- The VRG effect pack: which presets per room, and how it is installed and updated.
