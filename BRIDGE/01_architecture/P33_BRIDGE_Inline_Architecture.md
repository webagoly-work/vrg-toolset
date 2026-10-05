# P33 — BRIDGE Inline Network Architecture
### BASE ── ROOM CHANNEL ── ROOM BOX

**Doc:** P33-BRIDGE-ARCH-01 · v1.0 draft · 2026-09-16
**Scope:** new-build-grade renovation, full Home Assistant / BRIDGE control + data network
**Lineage:** BASE core = OmniComm Hub (CM5, Hub-P premium line) · switching logic = BRIDGE-ARCH-A1 (ζ / η bistable topologies) · network core = 4-VLAN segmented PoE design · room nodes = ESP32 Shadow Layer doctrine ("power where used, wireless from there")

> All dimensions are **design envelopes** (clear inner space), not product-locked cut sizes. Verify against chosen enclosures before the wall is opened. 230 V work per MSZ HD 60364; cabling segregation per EN 50174-2; SELV per IEC 60364-4-41.

---

## 0. The idea in one picture

```
                         ┌──────────────────────────────┐
   ISP fibre / coax ────►│  BRIDGE_NET   (comms layer)  │══ PoE Ethernet ═══════════╗
                         ├──────────────────────────────┤                           ║
   dedicated 230 V ─────►│  BRIDGE       (brain + HMI)  │══ BRIDGE_LINK (control) ══╬══╗
   circuit (panel)       ├──────────────────────────────┤                           ║  ║
                         │  LIBRARY      (media/storage)│══ MEDIA (HDMI-class) ═════╬══╬══╗
                         └──────────────────────────────┘                           ║  ║  ║
                                     BASE                                ROOM CHANNEL (star, per room)
                                                                                    ║  ║  ║
   room 230 V circuit ───────────────────────────────────────────────────►┌─────────▼──▼──▼────┐
   (from main panel, separate route)                                      │      ROOM BOX      │
                                                                          │ power · logic · RF │
                                                                          │ sensors · data/AV  │
                                                                          └─────────┬──────────┘
                                                        switches · sockets · lights · blinds · TV · desk · AP · sensors
```

**Three rules everything else follows from:**

1. **Star, not daisy-chain.** Every Room Box gets its own home-run bundle from the BASE. A fault in one room never takes down another.
2. **The BASE sends signal, the panel sends power.** 230 V for a room comes from the main distribution board on its own route. The BASE never feeds 230 V to rooms.
3. **The channel outlives the cable.** Every conduit is sized and routed so today's cable can be pulled out and tomorrow's pulled in without opening a wall.

---

## 1. BASE — the inline wall column

### 1.1 Overall envelope

| Item | Value |
|---|---|
| Outer niche (W × H × D) | **800 × 2100 × 220 mm** (floor +0.50 m → +2.60 m) |
| Clear equipment width | 560 mm main bay + 100 mm power spine + 60 mm air chimney |
| Clear depth | **200 mm** minimum (LIBRARY drives and AV gear drive this) |
| Wall build | 220 mm needs a **pre-wall (előtétfal)** or chased masonry ≥ 25 cm; never thin a load-bearing wall for it |
| Front | three independently hinged service doors, one per layer; touchscreen on a removable bezel |
| Earthing | single star-ground stud bonded to PE; every layer cage strapped individually to it |

### 1.2 Vertical stack and heights (from finished floor)

```
 +2.60 ┌───────────────────────────────────┬─────┬───┐
       │  CABLE HEADER  (conduit landing,   │     │ ▲ │  exhaust fan
 +2.30 │  pull-box, service loops)  H 300   │     │ │ │
       ├───────────────────────────────────┤  P  │ │ │
       │  BRIDGE_NET               H 450    │  O  │ A │
 +1.85 ├───────────────────────────────────┤  W  │ I │
       │  BRIDGE (core + touchscreen)       │  E  │ R │
       │       ▣ screen centre +1.55 m      │  R  │   │
 +1.25 ├───────────────────────────────────┤     │ C │
       │  LIBRARY                  H 600    │  S  │ H │
       │  controller dock top edge +1.15 m  │  P  │ I │
 +0.65 ├───────────────────────────────────┤  I  │ M │
       │  PLINTH (filtered air intake)      │  N  │ │ │
 +0.50 └───────────────────────────────────┴──E──┴───┘
             560 mm                        100    60
```

**Thermal note.** Estimated internal dissipation 70–110 W (NAS, modem, switch electronics, CM5, radios — PoE power itself is dissipated in the rooms). That is too much for passive convection in a sealed niche: filtered intake at the plinth, quiet PWM exhaust at the header, horizontal baffle plates between layers, and the side chimney as the common air path so LIBRARY heat doesn't bake the brain.

### 1.3 Power spine (right-hand 100 mm column, metal-partitioned)

Carries forward the finalized OmniComm power chain, isolated from all three data layers:

230 V dedicated circuit (own MCB + 30 mA RCD in main panel) → local isolator + Type 3 SPD → IEC/EMI filter → MeanWell LRS-35-12 class PSU (upsized to ~100–150 W for the whole column) → 12 V UPS module + battery → PTC-fused 12 V distribution → per-layer branches (5 V bucks local to each layer).

- **Battery recommendation for an in-wall install:** prefer **LiFePO4 (4S, 12.8 V)** over 3S Li-ion — same voltage window, far better thermal behaviour inside a closed wall. This is a deliberate change from the OmniComm Hub desk build.
- The PoE switch gets its own 48–54 V PSU sized to the PoE budget (see 1.4).

### 1.4 BRIDGE_NET — communication layer (top, H 450)

| Module | Envelope (approx.) | Notes |
|---|---|---|
| ISP entry + modem/ONT bay | 250 × 180 × 60 | Hungarian ISPs usually supply their own ONT/router — size the bay for a provider box, or an SFP ONT stick in the switch |
| 8-port managed PoE switch (+ SFP uplink) | 250 × 150 × 45 | data plane; VLANs: Trusted / IoT+Audio / Cameras / Guest. PoE budget ≥ 120 W (≈ 15–25 W per room) |
| Protocol master tray | 300 × 150 × 60 | the **Base-node master** for each spoken protocol (below) |
| Patch field | 560 × 45 | Cat6A keystones, one labelled port per room + spares |
| Antenna bulkheads | top face / header | SMA pigtails out of the metal cage; non-metal header grille |

**Protocol masters (one dedicated hardware per protocol, on USB/UART/SPI to the CM5 to save switch ports):**
Zigbee coordinator ×2 (primary dedicated + backup) · Thread border router ×2 · Z-Wave 800 · BLE (dedicated) · EnOcean · LoRa / Meshtastic (SPI) · sub-GHz RX (RTL-SDR) · RS-485 / Modbus master · KNX IP or TP interface · DALI-2 gateway (if used) · IR/RF learning head for BASE-local gear.
Rooms extend these meshes (routers / repeaters / border routers in each Room Box); the **coordinator role lives only here** — one network per protocol, per the BRIDGE-DN principle.

> ⚠ **Port budget.** 8 ports minus modem uplink, BRIDGE, LIBRARY = **5 rooms maximum**, with zero spares. If P33 has more than ~5 Room Boxes, choose now: a 16-port PoE switch in the same envelope (~330 × 200), or 8-port + second switch on the SFP uplink. Recommendation: plan the bay for 16.

### 1.5 BRIDGE — core layer (middle, H 600)

| Module | Envelope (approx.) | Notes |
|---|---|---|
| Touchscreen 10.1" (DSI) | 260 × 175 × 20 visible | premium HMI, flush bezel, centre at +1.55 m |
| CM5 on Waveshare CM5-DUAL-ETH-4G/5G-BASE | 160 × 120 × 45 | dual GbE (one to modem = gateway mode, one to switch), NVMe 250 GB, SIM7600G-H LTE failover + GNSS |
| USB hub pair (2.0 ×10 / 3.x ×7) | 2 × 130 × 50 × 25 | radios, flashing ports, audio |
| **BRIDGE_LINK controller** | 150 × 100 × 40 | multi-channel **isolated RS-485** card, one channel per room (+2 spare) |
| Front service panel | 560 × 40 strip | 2× USB 2.0, 2× USB 3.x, serial console header, status LED bar, physical buttons |
| RTC cell, buzzer, tamper switch, temp/humidity | small | per the OmniComm module list |

### 1.6 LIBRARY — media and storage layer (bottom, H 600)

| Module | Envelope (approx.) | Notes |
|---|---|---|
| NAS / home server | 2× 2.5" SSD + 2× 3.5" HDD cage: 220 × 150 × 180 | Music Assistant, Jellyfin/Plex, backups, camera NVR storage |
| HDMI distribution | compact 1×N splitter or 4×N matrix, ≤ 180 mm deep | one MEDIA output per room; 19" full-width matrices won't fit — rotate or choose compact |
| Legacy media bay | 150 × 45 slot | slim Blu-ray/DVD drive, USB, SD reader |
| Legacy I/O plate | 560 × 45 strip | TOSLINK in/out, RCA line in/out, 3.5 mm, HDMI in (guest source) |
| Snapcast / audio DAC | 100 × 70 × 30 | synchronised whole-home audio source |
| Media control strip | 250 × 45 | hardware play/pause/skip/volume + small secondary touch strip |
| **Handheld controller dock** | 120 × 200 recess | charging cradle at +1.00…+1.15 m, reachable by children and seated users |

---

## 2. ROOM CHANNEL — the future-proof path

### 2.1 Per-room bundle (home-run, BASE → Room Box)

| Channel | Conduit | Cable today | Future swap |
|---|---|---|---|
| **C1 · NET** | M25 | 2× Cat6A U/FTP (PoE to room switch + 1 spare) | fibre, second PoE feed |
| **C2 · MEDIA** | **M40** | 1× HDMI 2.1 **AOC** (active optical) + 1× Cat6A (HDBaseT / HDMI-over-IP fallback) | GPMI or whatever follows |
| **C3 · LINK** | M20 | 1× Cat6A S/FTP (BRIDGE_LINK control, see 2.3) | CAN / second RS-485 |
| **C4 · SPARE** | M25 | empty + pull cord | coax, fibre, speaker cable |

Plus, **separately from the main panel**: **P · 230 V**, M25, dedicated room circuit (own MCB + 30 mA RCD). Never inside the data bundle.

**Minimum variant** (budget rooms, e.g. storage, WC): C1 + C3 combined in one M32, C2 omitted but C4 laid as M40 so media can be added later.

### 2.2 Routing rules

- **Why M40 for media:** passive HDMI 2.1 copper is only reliable to a few metres; AOC runs 10–50 m but is **directional** and its connector heads must pass through the whole conduit — M40 gives that clearance with bends. Mark the source end.
- **GPMI** is a new standard with limited availability; the conduit is deliberately connector-agnostic so the design doesn't bet on it.
- Max **two 90° bends** between pull points; pull box after that, or every ~15 m.
- Bend radius ≥ **8× cable OD** for Cat6A (≈ 65–75 mm), follow manufacturer minimum for AOC (typically larger).
- Fill ≤ **40 %** of conduit cross-section on day one.
- **Pull cord in every conduit**, including occupied ones.
- Data bundle vs 230 V: parallel runs ≥ 50 mm apart (more for long parallels), cross at 90°, or use a metallic divider — confirm class values in EN 50174-2.
- Route: BASE header → vertical riser → ceiling/floor trunk (data trunk and 230 V trunk on opposite sides of the corridor) → drop to Room Box.
- Label both ends: `P33-R<room>-C<n>`.

### 2.3 BRIDGE_LINK — the dedicated control wire

Independent of the Ethernet switch, so room control survives a network outage, a switch reboot or a VLAN mistake. One Cat6A S/FTP per room, pairs assigned:

| Pair | Function |
|---|---|
| 1 (blue) | RS-485 A/B — ESPHome/Modbus RTU, isolated at both ends |
| 2 (orange) | RS-485 #2 or CAN — redundancy / future bus |
| 3 (green) | heartbeat / interlock line (dead-man alert, safety off) |
| 4 (brown) | reference ground + spare (1-Wire probe, etc.) |

No power over BRIDGE_LINK — each Room Box is powered locally. Termination 120 Ω at both ends; shield grounded at the BASE end only.

---

## 3. ROOM BOX — the room node

### 3.1 Sizes

| Class | Clear inner (W × H × D) | Use |
|---|---|---|
| **RB-S** | 300 × 400 × 90 mm | bath, WC, storage, hallway — no media |
| **RB-M** | 400 × 500 × 110 mm | bedroom, office, kitchen — standard |
| **RB-L** | 500 × 600 × 110 mm | living room, media room, open plan |

Flush-mount, inspection-accessible (junctions must remain reachable), non-metallic front or plastic RF window. Suggested position: near the room entrance, bottom edge ≥ +1.90 m (better RF, out of reach, not behind furniture). Pre-wall or 12 cm+ masonry needed for 110 mm depth.

### 3.2 Internal zoning (RB-M)

```
 ┌──────────────────────────────┬──────────────────┐
 │ Z1  MAINS 230 V   (IP2X)      │ Z3  DATA / MEDIA │
 │ incoming L/N/PE · WAGO 221    │ PoE-PD 5-port    │
 │ relay + dimmer boards         │ switch · Cat6A   │
 │ PSU 230 V → 24 V              │ keystones · HDMI │
 │                   250 × 220   │ splitter · loops │
 ╞══════ reinforced barrier ═════╡      150 × 280   │
 │ Z2  SELV CONTROL + POWER OUT  │                  │
 │ ESP32-S3 main · RS-485 iso    ├──────────────────┤
 │ DC-DC 12 V adj · 5 V · fuses  │ Z4  RF + SENSORS │
 │ WAGO 243 / 2601 outputs       │ C6 · H2 · IR     │
 │                   250 × 180   │ (RF window)      │
 ├───────────────────────────────┴──────────────────┤
 │ Z5  SENSOR WINDOW — thermally baffled, vented     │
 │     temp/RH · CO₂ · VOC · lux · mmWave presence    │
 └───────────────────────────────────────────────────┘   400 × 500
   230 V conduits enter Z1 only · data/media conduits enter Z3 only
```

### 3.3 Module budget (RB-M)

| Zone | Module | Envelope (approx.) |
|---|---|---|
| Z1 | Incoming + outgoing 230 V terminals: **WAGO 221** lever connectors on 221-500 carriers (0.2–4 mm²) | 1 row, 200 × 30 |
| Z1 | Switching board: 6–8 ch **latching relays** (ζ/η topologies — the bistable element lives here) | 140 × 90 × 25 |
| Z1 | 2 ch trailing-edge dimmer module (or DALI-2 / 0–10 V interface) | 90 × 60 × 30 |
| Z1 | **230 VAC → 24 VDC** PSU, 60 W, safety-isolated (e.g. MeanWell HDR-60-24, 3 DIN mod, or IRM-60-24 encapsulated) | 55 × 90 × 55 |
| Z2 | DC-DC **24 → 12 V adjustable** (e.g. DDR-30G-12 class) + **24 → 5 V** 3 A for the box itself | 2 × 20 × 90 |
| Z2 | Per-branch SELV fusing (PTC or mini blade) + output terminals | 100 × 40 |
| Z2 | **ESP32-S3** main controller carrier: isolated RS-485 transceiver, I²C I/O expanders (MCP23017), relay drivers, local status LEDs | 100 × 70 |
| Z2 | SELV signal terminals: **WAGO 243** Micro (0.6–0.8 mm solid), **WAGO 2601/2059** on custom PCBs | 100 × 25 |
| Z3 | PoE-powered 5-port switch (1 in, PoE pass-through to ceiling AP) | 100 × 70 × 25 |
| Z3 | 4× Cat6A keystone patch + HDMI 1×2 splitter + AOC service loop | 150 × 120 |
| Z4 | **ESP32-C6** (Wi-Fi 6 / BLE 5 / 802.15.4 — Zigbee router, BLE proxy) | 30 × 50 |
| Z4 | **ESP32-S3 + ESP32-H2** Thread border router pair (Matter over Thread) | 50 × 50 |
| Z4 | IR blaster + receiver (window-facing) | 25 × 25 |
| Z5 | SHT45 (temp/RH), SCD41 (CO₂), SGP41 (VOC), lux, LD2450 mmWave | 200 × 50 |

### 3.4 Room Box rules

- **Wi-Fi reality check:** an ESP32 is not a room access point and a wall box is a poor Wi-Fi location. The Room Box *feeds* a **PoE ceiling AP** (mesh node) from its switch; the ESP radios handle BLE/Zigbee/Thread/IR.
- **Sensor honesty:** a 24 V PSU and relays warm the box by several °C. Z5 is baffled and vented at the bottom; if temperature accuracy matters, add a remote probe at +1.5 m on the SELV side.
- **Isolation:** relay/dimmer boards must have reinforced isolation between coil/logic (SELV) and contacts (230 V) — ≥ 8 mm creepage class. No bare hobby relay boards in Z1.
- **SELV out to the room:** prefer **24 V** for long runs (LED strips, sensors, blinds motors), 12 V adjustable for local loads, 5 V only inside the box. Size cable for ≤ 3–5 % voltage drop.
- **Autonomy:** the ESP32-S3 holds last state and manual switches keep working with BRIDGE, network and BRIDGE_LINK all down (manual-first doctrine).
- **Heat:** RB-M passive budget ~10–15 W internal loss — vent slots top and bottom of the front cover.

### 3.5 Downstream conduits from the Room Box

| Destination | Conduit | Leaves from |
|---|---|---|
| Wall switch position (ζ/η wiring) | M20 | Z1 |
| Socket group | M25 | Z1 |
| Ceiling light / dimmed circuit | M20 | Z1 |
| Blind / shutter motor | M20 (230 V) or M20 SELV (24 V motor) | Z1 / Z2 |
| SELV devices (LED strip, sensor pods, keypads) | M20 | Z2 |
| TV / media wall | M32 (Cat6A ×2 + HDMI) | Z3 |
| Desk | M25 (Cat6A ×2) | Z3 |
| Ceiling PoE AP / camera | M20 (Cat6A) | Z3 |

230 V conduits leave from Z1; SELV and data from Z2/Z3 on the opposite side of the box — the two families never share or cross a conduit inside the room.

---

## 4. Checklist before the walls close

1. Room Box count confirmed → switch size (8 vs 16) locked.
2. Pre-wall depth at BASE (≥ 220 mm) and every Room Box (≥ 120 mm) confirmed with the builder.
3. Every conduit: pull cord, both ends labelled, photographed with a tape measure in frame.
4. Dedicated 230 V circuits: 1 for BASE, 1 per Room Box, on the panel schedule.
5. Data and 230 V trunks physically separated along the whole route.
6. AOC direction marked; spare Cat6A in the media conduit pulled on day one.
7. BASE ventilation path (plinth intake → header exhaust) not blocked by skirting or ceiling finish.

---

## 5. Open decisions (rework notes for v1.1)

- **Room count and room-class assignment** (S/M/L) for P33.
- **8-port vs 16-port** PoE switch (recommendation: 16).
- **BRIDGE_LINK protocol:** RS-485 ESPHome vs Modbus RTU vs CAN as primary.
- **HDMI distribution:** splitter (same picture everywhere) vs matrix (independent sources per room).
- **KNX / DALI-2:** included as wired backbone, or ESP-only switching?
- **Battery chemistry** in the BASE power spine (LiFePO4 recommended).
- **Dimmer technology** per room (phase-cut vs DALI-2 vs 0–10 V) — depends on the chosen luminaires.
