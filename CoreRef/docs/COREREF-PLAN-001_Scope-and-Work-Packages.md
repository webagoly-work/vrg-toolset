# COREREF-PLAN-001 — Scope, catalogues and work packages

r1 · 2026-10-09 · follows Phase 0 (see `PHASE-0-REPORT.md`)

Everything below is either **[V]** verified this session, **[D]** a declared decision, or
**[C]** a candidate that a work package must verify before it is used. Nothing unmarked
should be treated as checked. Brand and vendor names in §6 and §8 are **[C] by default**:
they are my recall of the market, not a survey, and recall is exactly what goes stale.

---

## 1. What CoreRef is and is not

CoreRef is the **alignment spine**. It holds what upstream says, pinned to a release, so
that every other VRG database can be checked against it and a refresh can report what
changed. It is not a product catalogue (that is Inventory), not a bill of materials (that
is BuildTree), and not a design standard (that is `BRIDGE/05_standards`).

Four layers, built in order:

| layer | holds | status |
|---|---|---|
| **L1 core** | ESPHome components + config schema; HA brands, integrations, discovery | **done, Phase 0** |
| **L2 technology** | every comms/bus/sensing technology BRIDGE may use, with its own device database | WP-2 |
| **L3 physical** | mounting form factors; what fits where | WP-3 (draft in §5) |
| **L4 market** | brands by tier, brandless spec checklists, vendors by zone, prices | WP-4…WP-6 |

L1 is the only layer that is purely harvested. L2–L4 are **ours**: harvested facts plus
our own judgement, which is the part that has value and the part no upstream provides.

---

## 2. Phase 0 result [V]

ESPHome **2026.9.1**, HA core **2026.10.0**, harvested 2026-10-09.

- 746 ESPHome components · 40,805 config vars · 5,599 with upstream docs text + doc URL
- 1,254 HA brands · 1,541 integrations · 895 discovery fingerprints
- `CoreRef/data` 5.71 MB · `coreref.sqlite` 11.34 MB — **the entire permissive layer is
  under 20 MB**, so shipping it on every install is a non-issue
- 37 ESPHome components publish no schema (base/helper components: `mcp23x17_base`,
  `bmp280`, `const`, `custom`, `sensirion_common` …) — expected, recorded, not an error

Two honest findings:

- **The schema is structure, not explanation.** Only 5,599 of 40,805 config vars carry
  docs text. The prose on esphome.io is still where the *why* lives — which makes the
  CC-BY-NC-SA routing decision load-bearing, not academic.
- **LVGL dominates.** 23,875 of the config vars are the LVGL display DSL. Any "size of
  ESPHome" figure must say whether LVGL is in or out.

---

## 3. Technology register (L2) — the lineup

Each technology gets an ID, a one-paragraph general description written into the DB, a
BRIDGE stance, and — where one exists — a **device database** to harvest. The stance
values are: **core** (BRIDGE depends on it), **supported** (integrate on request),
**bridged** (reachable only through a gateway), **avoid** (named so we can say why).

### 3.1 Radio / wireless

| id | technology | stance | device database to harvest | licence |
|---|---|---|---|---|
| TECH-R01 | **Zigbee 3.0** | core | `zigbee-herdsman-converters` ~3,500 devices / 415 vendors **[V]**; Blakadder Zigbee DB; ZHA quirks | package MIT, Z2M app GPL-3.0 **[V]** — per-file check needed |
| TECH-R02 | **Z-Wave / Z-Wave LR** | supported | `node-zwave-js` `packages/config/config/devices/<mfr-hex>/*.json`; upstream of it is the Z-Wave Alliance product DB **[V] format, [C] licence** | **must verify** |
| TECH-R03 | **Thread** | core | OpenThread; vendor Border Router list | — |
| TECH-R04 | **Matter** | core | **CSA Distributed Compliance Ledger** — the authoritative certified-device list with VID/PID **[C], high value** | **must verify** |
| TECH-R05 | **BLE** | core | HA `bluetooth.py` 238 rules **[V]**; Theengs decoder device DB; BTHome spec | Theengs **[C]** |
| TECH-R06 | **Wi-Fi 2.4/5 GHz** | core | — (per-chip, not per-device) | — |
| TECH-R07 | **ESP-NOW** | core (STD-008) | — | — |
| TECH-R08 | **Sub-GHz 433/868** | supported | **rtl_433** decoders (~250 device protocols) **[C]**; our own nRF905 pager work | **must verify** |
| TECH-R09 | **IR** | supported | ESPHome `remote_base` protocol list **[V, in L1]**; Broadlink/Tuya IR code DBs **[C]** | **must verify** |
| TECH-R10 | **RF 433 remotes** | supported | ESPHome `remote_receiver` protocols **[V, in L1]** | — |
| TECH-R11 | **EnOcean** | bridged | EEP profile list | **[C]** |
| TECH-R12 | **DECT ULE / proprietary clouds** | avoid | — | — |

ESPHome ships a native **`zigbee`** component in 2026.9.1 (`ieee802154_vendor_oui`,
`on_join`, `power_source`) **[V]** — an ESP32-C6/H2 can be a Zigbee *end device*, not just
a Wi-Fi node. That changes what the bare-module category in §7 can offer and deserves its
own evaluation.

### 3.2 Wired buses

| id | technology | stance | notes |
|---|---|---|---|
| TECH-W01 | **Ethernet + PoE** | core | STD-005 owns switch sizing |
| TECH-W02 | **RS-485 / Modbus RTU** | core | no central device DB; per-vendor register maps — our own catalogue |
| TECH-W03 | **DALI / DALI-2** | supported | DiiA registered-product list **[C]**; STD-002 reserves C5 |
| TECH-W04 | **0–10 V / 1–10 V** | supported | analog dimming fallback |
| TECH-W05 | **PWM / constant-current LED** | core | flicker per IEEE 1789 (STD-002) |
| TECH-W06 | **1-Wire** | supported | `dallas_temp` in L1 |
| TECH-W07 | **I²C / SPI / UART** | core | module-level, feeds §7 |
| TECH-W08 | **CAN / TWAI** | supported | ESPHome `canbus` |
| TECH-W09 | **DMX512 / Art-Net** | supported | effect lighting only |
| TECH-W10 | **OpenTherm** | supported | ESPHome `opentherm` (443 config vars **[V]**) |
| TECH-W11 | **KNX** | bridged | ETS product DB is proprietary — link-out only, never harvested |
| TECH-W12 | **BRIDGE_LINK** | core | ours; STD-004 defines it |

### 3.3 Sensing, access, energy, media

| id | group | members | note |
|---|---|---|---|
| TECH-S01 | mmWave presence | LD2410 / LD2412 / LD2450 / LD24xx **[V, all in L1]** | STD-003 fusion inputs |
| TECH-S02 | PIR, ToF, light, contact | — | |
| TECH-S03 | environment | CO₂, VOC, PM, temp/RH (SGP40, SCD4x, BME280 family **[V]**) | |
| TECH-S04 | load / pressure | bed and chair sensing (STD-001 reserved envelope) | |
| TECH-A01 | identity | RFID/NFC, Wiegand, fingerprint | STD-003 Trinity tiers |
| TECH-A02 | intercom | SIP, doorbell | |
| TECH-A03 | life safety | smoke/CO to EN 14604, water leak | third-party alarm boundary, STD-006 |
| TECH-E01 | metering | DSMR/P1 **[V]**, CT clamps, Modbus meters | |
| TECH-E02 | generation | inverters, SunSpec | |
| TECH-M01 | audio | Snapcast, AirPlay, Chromecast, A2DP | STD-007 |
| TECH-M02 | video | HDMI-CEC, eARC, TOSLINK | STD-007 |
| TECH-I01 | transport | MQTT, ESPHome native API, HA WebSocket | |

**WP-2 writes the general description for every row above into the DB** — one screen each:
what it is, how it carries data, its range/latency/power envelope, where it fails, what it
costs, and why BRIDGE takes the stance it takes. That is the deliverable, not this table.

---

## 4. Device-database harvest order (WP-2)

Harvest in this order, each with a licence check **before** any bytes land in the repo:

1. Zigbee (`zigbee-herdsman-converters`) — biggest win, ~3,500 devices
2. Z-Wave (`node-zwave-js`) — second biggest, manufacturer/product-ID keyed
3. Matter (CSA DCL) — authoritative, VID/PID, certification-backed
4. BLE (Theengs) and sub-GHz (rtl_433) — covers the cheap sensor flood
5. **Blakadder Tasmota templates** — see §9, this is the brandless-device key

Each becomes a table with the same shape: `vendor, model, ids, capabilities, source_id,
source_url, licence_class`. The `licence_class` column is what lets the client decide at
render time whether it may show the row or only link to it.

---

## 5. Mounting form factors (L3 draft) [D, needs reconciliation]

The procurement view of the physical standard: **product search happens by form factor
first, brand second.** A product that does not fit a declared space is not a candidate,
whatever it costs. This must be reconciled against `BRIDGE-STD-001` §1–§4 and `-A2` before
it is promoted — STD-001 already owns the RoomBox interior and the 18 mm module, and this
table must not contradict it.

| id | space | envelope | medium | what BRIDGE puts there |
|---|---|---|---|---|
| **FF-01** | flush endpoint, single **szerelvénydoboz** | Ø60–68, depth 40/45/60 | drywall + masonry | switch node, notification light (STD-008), sensor endpoint |
| **FF-02** | **Ø80 kötődoboz** | Ø80, depth 40–55 | ceiling, wall | ARM node, luminaire feed point |
| **FF-03** | **100×100 kötődoboz** | 100×100, depth 45–70 | wall, ceiling | small cluster, PSU + node, sub-distribution |
| **FF-04** | **multi-gang szerelvénydoboz, one interior** | 3-gang single cavity (KOPOS KPL 64-50/3LD class) | drywall | the user's cited case: node + PSU + terminals sharing one volume |
| **FF-05** | **cluster / stack point** | RoomBox interior, 18 mm module, 110 mm depth | purpose-built | RBX contents per STD-001 |
| **FF-06** | **BRX carrier** | ours | — | BRIDGE module on its own carrier |
| **FF-07** | **DIN rail** | 17.5 mm per module, 1M/2M/4M | cabinet | RCBO, PSU, relay, gateway |
| **FF-08** | **in-luminaire / driver cavity** | Ø55–70 recess, or fixture void | ceiling | LED driver, inline dimmer |
| **FF-09** | **surface IP enclosure** | 80×80 … 160×120, IP55–65, glanded | outdoor, terasz, kamra | outdoor node, gate controller |
| **FF-10** | **furniture / joinery cavity** | free | BASE joinery, media wall | hidden node, amplifier, media controller |
| **FF-11** | **modular wall-plate insert** | 45×45 / 2× 22.5×45 keystone | any frame system | display, reader, keystone module |
| **FF-12** | **inline in conduit** | fits M20–M40 draw | conduit run | inline sensor, repeater, splice node |
| **FF-13** | **bare PCB / potted module** | none — we define the shell | anywhere | **the custom-assembly category, §7** |
| **FF-14** | **ceiling plenum / suspended void** | free, but thermally dead | false ceiling | PSU, controller, radar above plasterboard |
| **FF-15** | **floor box / skirting duct** | per system | floor | power + data outlet, media feed |
| **FF-16** | **panel cut-out** | 23.5 / 35 mm hole, or display aperture | cabinet door, wall plate | CYD-class display, indicator, Ø22 button |
| **FF-17** | **pole / gate mount** | IP65 + UV, glanded | boundary | gate, letterbox, driveway |

**Six of these were not in the brief** — FF-08, FF-11, FF-12, FF-14, FF-15, FF-16 (and
FF-17 only implicitly). FF-11 and FF-16 matter most: a 45×45 insert and a display cut-out
are the two places a BRIDGE endpoint becomes visible to the client, so they are the two
where product choice is an aesthetic decision, not only a technical one.

Three attributes must ride on every form factor, because they decide fit more often than
the outline does:

- **depth class** — 40/45/60/68 mm is the single most common reason a module does not fit
- **mounting medium** — drywall (KPL-class) against masonry (KP-class) is a different box
  and a different depth, for the same nominal diameter
- **thermal headroom** — STD-001-A1 already proves a sealed box cannot shed much; a
  product's dissipation has to be checked against the space, not just its size

---

## 6. Brand catalogue (L4, WP-4) — tier model [D], members [C]

Three tiers, one rule: **tier is assigned by what the device does for us, not by price.**

**Tier A — local-first, ESPHome/HA-native, specifiable without reservation.**
Anchors I am confident of: Shelly (incl. Qubino Wave), Athom, SmartWise (Hungarian,
ESPHome-friendly), Sonoff/ITEAD where reflashable, Aqara, IKEA, Philips Hue, Zooz,
Fibaro, Heltun, Ubiquiti (network), Reolink with Frigate, Sonos/WiiM (audio), and the
DIY board houses M5Stack / Olimex / Waveshare / LilyGO / Seeed. **All [C] until the
WP-4 pass confirms current Hungarian availability.**

**Tier B — cheaper alternatives, accepted with a named caveat.**
Moes, Zemismart, Girier, Avatto, Lonsonho, Tongou, BSEED, Immax Neo, Tesla Smart, Nedis,
Gosund/Blitzwolf. Every Tier B entry must carry its caveat explicitly: cloud dependency,
chipset lottery (a model number can silently change from ESP to a Tuya/Beken part),
missing neutral, uncertified mains section, or no reflash path.

**Tier C — brandless.** No brand column at all; specified by §7's checklist.

Separate from all three: the **electrical-trade brands** that own the FF-01…FF-07 spaces —
Legrand, Schneider, Hager, ABB, Elko EP, GAO, Kopos/Kopp for boxes. These are not smart
brands; they define the envelope the smart part must live inside, and Inventory already
knows some of them through the Daniella vendor block.

**The chipset-lottery problem is the reason this catalogue has to exist.** A brand name no
longer predicts a chip. So each brand row needs: model, radio chip, reflashable (yes/no/
how), certification, and the date that was last checked.

---

## 7. Brandless specification checklist (L4, WP-4) — the edge-case category

This is the category "other products could now offer, but we do": a bare ESP32 module
assembled to a request. Specifying it needs a checklist, not a brand.

**Generic, every device:**
chipset and variant (ESP32-C3/C6/S3/H2/P4 — C6/H2 for 802.15.4, S3 for displays/PSRAM) ·
flash and PSRAM size · exposed GPIO count and which are strapping or input-only · antenna
(PCB trace against external, and whether it survives a metal box) · supply topology and
input range · standby draw · mains isolation, creepage and clearance · relay rating
resistive against inductive, and zero-cross detection for dimming · neutral requirement ·
terminal type and conductor size · operating temperature and dissipation against the FF
thermal headroom · dimensions against the FF envelope · programming access (serial header,
USB, OTA) · firmware openness (ESPHome/Tasmota support, today) · certification route
(CE, EN 60669 for switches, EN 62368 for supplies, IP per IEC 60529) · flicker per
IEEE 1789 for anything that dims.

**Per device type, the additional ones that actually decide it:**

| type | what to check beyond the generic list |
|---|---|
| dimmer | leading/trailing edge · minimum load · zero-cross · flicker at 1 % · neutral |
| relay module | contact rating per load class · inrush · channel isolation · latching against monostable |
| mmWave presence | frequency band and licence class · detection zones · min/max range · update rate · the configuration interface (UART against proprietary) |
| environment sensor | sensor part number, not "CO₂" — a real NDIR against an eCO₂ guess · calibration · self-heating |
| thermostat / valve | actuator force and stroke · valve thread · battery life · open-window logic |
| shutter / motor | motor type · limit learning · interlock on reversal · position feedback |
| LED driver | constant current against voltage · dimming interface · flicker · PSU efficiency at 10 % |
| power meter | true RMS against assumed PF · CT ratio · accuracy class · bidirectional |
| camera | stream protocol (RTSP/ONVIF, not "app") · substream for Frigate · local recording · PoE |
| lock / access | fail-safe against fail-secure · mechanical override · credential type · EN class |
| display node | panel interface · touch controller · brightness/backlight control · the FF-16 cut-out |

---

## 8. Sourcing / vendor analysis (L4, WP-5) — method [D], candidates [C]

**Segment model first, names second.** A vendor's segment predicts its price, minimum
order, documentation quality and lead time better than its country does:

| segment | character | what it is right for |
|---|---|---|
| **authorised distributor** | datasheet-backed, lifecycle data, no MOQ but priced for it | the one part that must be genuine and traceable |
| **maker shop** | breakout and dev boards, tutorials, small stock | prototyping, one-off modules |
| **surplus / bargain** | deep but erratic stock, thin data, excellent price | passives, connectors, enclosures, anything we can verify ourselves |
| **module reseller** | Chinese-sourced modules relabelled, fast local delivery | ESP modules, sensors, relays in ones and tens |
| **electrical wholesale** | boxes, conduit, rail gear, trade pricing with an account | FF-01…FF-07 hardware, the Daniella channel |
| **mail-order catalogue (EU)** | huge range, good data, shipping and VAT friction | anything the local zones do not stock |

**Zone candidates to verify [C] — this is recall, not a survey:**

- **Zone 1 Budapest:** HESTORE, ChipCAD, Lomex, Tavir — plus the electrical wholesalers
  already known through Inventory.
- **Zone 2 Pest megye:** expect almost nothing physical; mostly webshops with pickup.
- **Zone 3 Hungary:** RS Components HU, Farnell HU, the Hungarian arms of the EU catalogues.
- **Zone 4 Europe:** TME (PL), Mouser, DigiKey, Farnell, Reichelt (DE), Botland (PL),
  BerryBase / Eckstein / AZ-Delivery (DE), Pollin (DE), Pimoroni (UK, post-Brexit duty).
- **Zone 5, proposed [D]:** LCSC / direct China. Not asked for, but it is where the module
  reseller segment actually buys, so leaving it out makes every price comparison look
  wrong by a factor.

**Price comparison needs a fixed basket, or it is noise.** WP-5 defines ~15 reference
parts (one ESP32-C3 module, one C6, one 16 A relay module, one mmWave unit, one Ø80 box,
one DIN PSU, …), then quotes each vendor on the *same* part, normalised to **net + VAT +
shipping + lead time + MOQ**, with the quote date recorded. Without that normalisation a
cheap unit price with €20 shipping reads as the winner. Inventory already learnt this the
hard way with Daniella's partner-discounted net prices, and the same rule applies here.

---

## 9. Other things worth including — my additions

Ranked by what they would actually unlock:

1. **Blakadder Tasmota template database** [C] — ~5,000 devices mapped to chip and GPIO
   function. This is the single most valuable addition on this list: it is the only
   systematic answer to "what is actually inside this brandless device", which is exactly
   the gap §6 and §7 are working around.
2. **HACS default repository index** + **ESPHome external components** — where core and
   stock ESPHome stop, these are what a request gets solved with. Without them CoreRef
   will claim a device cannot be integrated when it can.
3. **"Works with Home Assistant" certified list** and `quality_scale` (already harvested)
   — an official, citable "prefers" signal to put in front of a client.
4. **Breaking-change feed** — HA release notes and the ESPHome changelog, parsed per
   release. This is the alarm half of the alignment job: the diff says *what* changed, the
   feed says *whether it was deliberate*.
5. **ESP32 variant matrix** — C3/C6/S3/H2/P4 against radio, PSRAM, flash, power, price.
   §7 cannot be used without it.
6. **Power budget catalogue** — DIN PSUs, DC-DC, PoE splitters, 24 V bus loading. STD-002's
   convenience/assured buses need the numbers in a table.
7. **Compliance layer** — EN 60669, EN 62368, IEC 60529, IEEE 1789, EN 14604 and the
   Hungarian wiring regulation. What a product must satisfy to be *specifiable*, not just
   functional. Also what protects us when a client asks why the cheap part was refused.
8. **Flashability matrix** — which commercial device can take ESPHome/Tasmota and by what
   route, with the date checked. Routes close over time (Tuya-Convert is dead, cloudcutter
   is version-bound), so an undated entry is worse than none.
9. **Hungarian terminology glossary** — szerelvénydoboz / kötődoboz / sorolható / gipszkarton
   against falazott. Needed for the UI, and needed to search Hungarian vendor sites at all.
10. **Price-history snapshots** — dated quotes so Inventory can trend rather than overwrite.
11. **Interop warning register** — Zigbee binding quirks, Thread border-router vendor lock,
    Matter bridge entity limits. The things that cost a site visit.
12. **Lifecycle / EOL** — ESP8266 is legacy, parts go EOL mid-project. One column, saves a
    redesign.

---

## 10. Work packages

| wp | scope | depends on | size |
|---|---|---|---|
| **WP-1** | Phase 0 harvest: ESPHome + HA core, licence routing, provenance | — | **done** |
| **WP-2** | Technology register L2: §3 descriptions + §4 device DB harvest with per-source licence checks | WP-1 | large, splittable per technology |
| **WP-3** | Form factors L3: reconcile §5 against STD-001/-A2, promote to a BRIDGE standard | §5 review | small |
| **WP-4** | Brands + brandless checklists L4: §6 tiers with verified availability, §7 per-type sheets | WP-3 | large |
| **WP-5** | Sourcing: §8 vendor survey in four (five) zones, basket pricing | WP-4 basket parts | large, time-sensitive |
| **WP-6** | Reader app: single-file HTML, Hungarian, offline FTS, link-out, licence-aware rendering | WP-1 | medium |
| **WP-7** | Refresh + diff: re-harvest, compare `artifact` sha256s, emit the "mi változott" report, flag affected Inventory/BuildTree rows | WP-1 | medium |

**WP-7 is the one that justifies the project.** Without it CoreRef is a snapshot that
starts rotting on 2026-10-10.

Dependency note: WP-5 is the only package whose output expires. Everything else can be
built once and refreshed; prices and local availability need a date stamp and a re-run
policy, so WP-5 should be last and should define its own refresh interval.

---

## 11. Decision pack

| id | decision | why it blocks |
|---|---|---|
| **D-01** | Promote §5 to a BRIDGE standard (new STD-009? or an annex to STD-001)? | FF codes get cited everywhere downstream; the number must be stable before WP-4 |
| **D-02** | Which technologies in §3 are actually in scope for BRIDGE v1 — all, or core+supported only? | WP-2 size swings by a factor of three |
| **D-03** | Zone 5 (direct China) in or out of the price comparison? | leaving it out makes Zone 1–4 prices look competitive when they are not |
| **D-04** | Does the client-side reader show Tier B/C products at all, or only what we specify? | changes the licence-aware rendering rules in WP-6 |
| **D-05** | Refresh cadence — monthly with upstream releases, or per project? | WP-7 design, and whether an installed copy ever updates itself |
| **D-06** | Hungarian text: write per technology (§3) first, or per component (L1) first? | the translation effort is the biggest single cost in the whole plan |
