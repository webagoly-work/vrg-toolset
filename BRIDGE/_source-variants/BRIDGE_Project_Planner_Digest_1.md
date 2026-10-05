# BRIDGE — Project Digest for Planner

Condensed reference across all BRIDGE home-automation threads. Each section is a self-contained summary of one work stream, ordered from the overarching concept down to individual hub builds. Naming note: **BRIDGE** is the umbrella project; the CM5-based **OmniComm Hub** and the **BRIDGE-DN** DIN-rail hub are distinct hardware lines under it.

---

## 0. BRIDGE — the umbrella concept

BRIDGE is a modular home-automation system built around a Home Assistant "brain" plus a distributed "body" of wireless nodes. Two halves:

- **Brain** — a central HA hub (RPi / mini-PC / CM5), the coordinator. Referred to in the fleet model as tier **T5**.
- **Body** — a fleet of ESP32-based modular units (the "Shadow Layer") deployed room by room.

**Ten core design tenets:** non-invasive, manual-controlled-first, modular, future-proof, adaptive, optional, discreet, integrating, user-friendly, cost-effective.

**Control doctrine:** manual physical actions must override wireless commands ("manual-first"), though wireless authority should approach parity where physically possible.

**Power doctrine (Shadow Layer):** "power where used, wireless from there" — each node taps a local mains feed adjacent to existing electrical runs; everything beyond that point is wireless. Integration-first and optionality-first: most positions stay unused or serve as plain sockets until needed.

---

## 1. Shadow Layer / ESP32 unit fleet — "Modular ESP32 home automation"

**Goal:** a fleet of flush-mounted ESP32 units populating standardized empty boxes throughout the home, organized into tiers (Heroes-of-Might-and-Magic unit-ladder metaphor): low tiers numerous/cheap/foundational; high tiers few/expensive and *consume* lower tiers for richer decisions. System is functional at any tier you stop at.

**Physical substrate:** parallel corrugated-flex conduit paths run alongside the existing electrical layout (isolated from mains, like data cabling), reaching flush boxes beside each outlet/switch. Each box provides only a mains-in and space to hide a small AC/DC adapter + one unit — so functions aren't pre-defined; the empty box is the standard.

**Deliverables produced:**
- **BRIDGE-ARCH-001 r2** — unit-fleet primer with the seven-tier ladder and a deployment sequence that diverges from strict tier order (hub early; sensors late and optional).
- **BRIDGE — Smart Switch** doc + seven SVG circuit diagrams (dark HUD aesthetic, color-coded wire roles: amber=live, teal=travellers, magenta=RF coil/control, green=RF-enable, steel=neutral).

**Key technical finding — bistable memory is mandatory.** For parallel manual + wireless switching, pure parallel or series topologies fail; a bistable element (impulse relay, SR latch, motorized switch) is always required. Two solution families:
- **Smart Peer Switch (ζ topology)** — RF constantly powered, equal toggle alongside manual. Variants: Single, Dual, Multi, Cross, End.
- **Smart Gate Switch (η topology)** — RF authority gated by a manual switch. Variants: Gate Switch (sockets) and Smart Cut Switch (manual-only fallback).

Files saved under `BRIDGE_Smart-Switch_*`. Single-switch ζ′ variant confirmed correct.

---

## 2. BRIDGE-DN — DIN-rail hub variant

**Context:** installed in a residential distribution box, Budapest (Király Street), ceiling >3 m. Distribution box mounted ~2.5 m high under the mains; user terminal at chest level (~1.2–1.4 m) reached via an extension trunk.

**Core hardware:**
- Raspberry Pi 5 (8 GB, not 4 GB — Matter Server, Zigbee2MQTT, Z-Wave JS, MQTT, Node-RED all run as separate containers).
- NVMe over PCIe for storage (SD cards die under HA's continuous SQLite writes).
- **MeanWell HDR-60-5** DIN PSU — power path locked as DIN rail PSU, **no PoE**.
- Industrial DIN-rail USB 2.0 hub, rail-powered via terminal block (USB 3.0 hub deemed largely unnecessary — RTL-SDR, LoRa, RS-485 are all USB 2.0; storage is NVMe/PCIe).
- DIN Ethernet switch; Wi-Fi via AP-mode connected over Ethernet.
- Mains on top two DIN rails, BRIDGE core on bottom two rails (correct for heat, noise separation, trunk routing).
- **Gledopto Pro** (GL-C-011P DIN controller + Pro Mini local units) for 24 V constant-voltage Zigbee LED strips.

**Two variants (differ only in where radios live):**
- **BRIDGE-DNE (Ethernet/LAN):** heavy radios networked via **SLZB-MR3U** over ser2net — best RF placement (coordinators live centrally, not trapped in metal), ~4 free USB 2.0 ports; depends on stable wired LAN.
- **BRIDGE-DNU (USB):** everything a USB dongle (dedicated Zigbee + dedicated Thread + Aeotec combo for Z-Wave/backup) — zero network dependency, fully self-contained; 5–6 radios near one box so extension pigtails are mandatory.
- **DNU → DNE is a non-destructive upgrade** (backup/restore coordinator, repoint integration from `/dev/ttyUSBx` to `socket://ip:port`).

**Redundancy scheme (both):** Zigbee ×2, Thread ×2, dedicated BLE, cold-spare Z-Wave.

**Balanced philosophy:** "min-max backbone, solo-purpose insurance" — combo dongles for chip-separated efficiency, but keep the two most failure-critical roles (primary Zigbee coordinator + BLE) on dedicated radios so a combo failure never drops the whole mesh.

**Deliverables:** `BRIDGE_DN_Protocol_Reference.html` (dark-amber, Saira Condensed + JetBrains Mono, #ffb300 on #15181c), `BRIDGE_DN_Core_Hardware.md`, `BRIDGE_DN_Balanced_DNE_DNU.md`, `BRIDGE_DN_Build_Diagrams.html` (6 Mermaid diagrams, Mermaid.js inlined because CDN was blocked).

**Networking principle locked:** one Zigbee coordinator handles all device types from all brands; a second only for congestion tuning at scale. Same one-network model for Z-Wave; Thread uniquely benefits from multiple border routers early for mesh resilience.

---

## 3. OmniComm Hub (CM5) — this conversation

A separate, CM5-based hub line under BRIDGE. Design philosophy: **the hub stays lean and always-on; heavy work is orchestrated, not absorbed** — every power-hungry function goes to a separate node. Two variants: **Hub-P** (all-in-one, all radios in one sealed case) and **Hub-B** (split — a minimal Core plus a PoE-fed "Arm" node near the ceiling, connected by the "Spine" cable run).

### Core platform
- **Raspberry Pi CM5** (4 GB / 32 GB eMMC) on a **Waveshare CM5-DUAL-ETH-4G/5G-BASE** carrier (dual Ethernet GbE + 2.5 GbE, M.2 M-Key for NVMe, M.2 B-Key for 4G/5G, 7–36 V DC input, native PoE header + module).
- Storage: NVMe on M.2 M-Key. Right-sized to **128–250 GB** (HA needs ~50–80 GB with 30-day history; cameras → use a NAS, not the hub SSD). eMMC as boot/recovery fallback.
- 4G LTE + GNSS: **SIM7600G-H-M.2** in the B-Key slot (backup internet, SMS gateway, GPS → stratum-1 NTP).

### Power chain (finalized)
230 VAC → **IEC inlet + EMI filter (FN9244B)** → **MeanWell LRS-35-12** (12 V) → **3S-12V-3A-UPS-M** UPS module → **PTC-fused 12 V distribution board** → branches. 12 V chosen over 24 V (lower buck-converter heat in a sealed case, simplest battery architecture, common peripheral voltage; efficiency and price identical to 24 V).
- **5 V rails:** dedicated **5 V/5 A buck** for the USB radio hub; **MP1584EN** for low-draw aux (fan, LEDs, indicator) only — its ~1.5 A sustained limit is too low for the radio hub.
- **Battery:** external **3S pack + 3S-20A BMS** (pre-built pack preferred over loose cells), **XT60 disconnect**, **LEVEL-BAT-3S** 4-LED gauge. Expand by paralleling matched-voltage packs. A USB QuickCharge power bank **cannot** connect to the 3S UPS module (raw-cell interface vs. sealed USB device — incompatible).
- **Power redundancy:** four independent sources — AC-DC (primary), carrier PoE module (backup), external PoE splitter → 12 V DC-in (second, separate PoE path), UPS battery.

### Wireless radios (all internal; antennas external via SMA bulkheads)
Zigbee/Thread (**ZBDONGLE-E**), Z-Wave 800 (**ZWA010**), EnOcean (**USB300**), RF receive (**RTL-SDR Blog V4**), Wi-Fi 6 AP (**CF-953AX**), Wi-Fi HaLow (**VT-USB-AH-8108**), NFC (**ACR122U**), plus onboard BT/Wi-Fi. Meshtastic added via **MeshAdv-Pi v1.1** SPI HAT on the GPIO header running `meshtasticd` (the uploaded Waveshare SX1262 868M LoRa HAT is a UART/private-protocol module and does **not** work for Meshtastic; leaves I²C free for future Sequent boards).

### Interference / thermal layout (vertical tower)
Three grounded EMI compartments along a convection axis: **Zone A (bottom, cool/quiet)** = sensitive sub-GHz radios (RTL-SDR most isolated) + battery cable entry; **Zone B (middle)** = CM5, USB hubs, SSD, 2.4 GHz radios at the upper edge; **Zone C (top, hot)** = power chain + exhaust. Intake bottom, exhaust top, convection assists the fan. **Single-point star ground:** each cage strapped independently to one chassis stud bonded to mains PE (never daisy-chained). Earthing (safety, PE) and grounding (signal reference) meet at that one point. ESD is a build/service concern (wrist strap, edge-handle boards), not an operational one once the earthed metal case is sealed; optional GDT protectors on any outdoor/window-adjacent antenna line.

### Three buildable sub-assemblies (build order)
1. **Power-chain tray** (Zone C) — verify all output voltages + clean switchover before anything else.
2. **Grounded EMI chassis** — build empty, verify ground continuity (<0.1 Ω to star stud and PE).
3. **Radio tray** (Zone A) — USB hub + dongles + pigtails to SMA bulkheads.

### USB budget (futureproofing)
Two carrier USB 3.2 ports feed two hubs: a **10-port USB 2.0 hub** (6 radios + 2 external USB 2.0 panel jacks for ESP flashing + 2 free internal) and a **7-port USB 3.x hub** (Wi-Fi AP, USB audio interface, 2 external USB 3.x panel, spares). Targets met: ≥2 external USB 2.0, ≥2 external USB 3.x, ≥2 free internal. Meshtastic-on-SPI keeps a USB port free.

### Remote access
**Nabu Casa Cloud** (client-facing, no app/VPN for family) + **Tailscale** (admin: full SSH + LAN, works when HA frontend is down) + **Advanced SSH & Web Terminal**. Three independent paths.

### Software stack
Raspberry Pi OS + Docker; HA (container) as brain; OpenWRT (containerized, independent of HA) for routing; AdGuard, Mosquitto, Zigbee2MQTT, Z-Wave JS UI, ESPHome, Node-RED, InfluxDB + Grafana, Music Assistant + Snapcast.

### Modules mapped (build in this order)
Audio output → **Network core** → Media coordination → Self-hosted notification hub → Wake-on-LAN orchestrator → Backup target → NAS → Off-grid resilience → SMS gateway (4G) → SDR passive sensor suite → Acoustic event detection → Boot redundancy → A/B update safety → Config-as-code → Dead-man's alert → RTC backup cell → Physical buttons → Serial console header → Front-panel status indicator → Internal temp/humidity sensor → Piezo buzzer → Tamper switch → Ferrites + labelled connectors → spare everything.

Growth principle: each new capability is a **network node or a module integrated into the Hub or the Arm** (or a third case) — never a sprawling device cluster.

### Modules designed so far
- **Media coordination / audio:** Music Assistant (library + source ingest) → Snapcast (synced transport) → HA (control). Sources in: streaming, AirPlay/Spotify Connect, Bluetooth, and legacy analog line-in via a USB ADC. Plan reserves case space/cutouts for **optical (TOSLINK) in** and an optional **Class-D amp bay** (line-level out is the base). Room receivers = ESP32 Snapclients wired into existing gear (Esparagus Audio Brick for amplified, ESP32+I²S DAC for line-level). Watch **Sendspin** (Open Home Foundation) as the future ESPHome-native transport; build receivers in ESPHome to keep that path open.
- **Network core:** segmentation is the core value — 4 VLANs (Trusted / IoT+Audio / Cameras / Guest). Managed **PoE** switch = data plane (reliable, survives hub reboots); hub = control plane (DHCP, DNS/AdGuard, VLAN + firewall policy). Staged rollout: (1) segment behind existing router, (2) promote hub to gateway via dual NIC + 4G failover, (3) harden. All ESP audio nodes land on the IoT+Audio VLAN.

---

## Cross-project design constants
- **Aesthetic:** dark-amber HUD (#ffb300 on #15181c), Saira Condensed + JetBrains Mono; SVG diagrams with color-coded wire roles.
- **Suppliers referenced:** hestore.hu, RS Online, webshop.elkoep.hu, daniella.hu, elektrikstore.hu.
- **Working style:** persistent well-structured reference documents; philosophy-grounded decisions locked iteratively before moving on; v1.0 drafts with rework notes before polished output; Hungarian for electrician client work, English for BRIDGE system design.
