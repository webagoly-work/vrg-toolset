# BRIDGE-STD-005 — Network and RF

**Doc:** BRIDGE-STD-005 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §4.2/§10.4/§10.8 · BRIDGE-STD-004 §2
**Closes:** U12 RF and channel plan · resolves **D2** · corrects the RoomBox switch power path
**Scope:** the DATA gear tier and the radio spectrum plan. Addressing and VLANs are STD-004 §2.

> **Regulatory note.** Sub-GHz duty cycles and 5 GHz channel availability below follow EU/ETSI
> practice. Verify against the current ETSI EN 300 220 and national allocations before relying on
> them commercially — the numbers move.

---

## 1. A correction to the switch power path

ARCH-002 §8.5 places a **PoE-powered switch** in RoomBox zone Z3, which then serves the ceiling
AP, the panel and the camera. Worked through against real loads, that does not close.

**What a RoomBox actually has to inject downstream:**

| Class | Downstream PoE load | Total |
|---|---|---|
| RB-S | panel 13 W | **13 W** |
| RB-M | AP 20 W + panel 13 W | **33 W** |
| RB-L | 2 × AP 20 W + panel 13 W + camera 10 W | **≈ 63 W** |
| RB-H | as RB-L, plus the next room's uplink | **≈ 63 W + passthrough** |

Sixty-three watts cannot arrive through a single PoE input without 802.3bt gear at both ends and
a very large budget at NET — to power a switch that is sitting 300 mm from a 150 W supply.

**Correction.** The room switch is **powered from the RoomBox's own SELV rail and injects PoE
downstream.** Specify a switch with a wide DC input (12–57 V) so it runs from the 24 V rail
directly; failing that, add a 24 → 48 V boost converter in Z2 sized to the injection budget.

**ARCH-002 §8.5's intent survives intact.** PoE from NET remains as an *independent power path*
for the sub-controller and the RF zone — a genuinely valuable second supply that does not depend
on the room's own 230 V circuit. It simply does not also carry the switch and everything behind it.

This is consistent with STD-001 §2.6, where RB-L's 70 W thermal budget already allowed ~9 W for a
switch injecting ~40 W. Raise that allowance to **~12 W for RB-L/RB-H** at a full 63 W injection.

---

## 2. Network topology and switch sizing (resolves D2)

```
  ONT / modem ──► NET switch (16-port, managed, PoE+) ──┬── COMP        (trunk: 10, 20, 99)
                        │  SFP uplink to MEDIA           ├── MEDIA       (10, 20, 30)
                        │                                ├── NVR         (30)
                        │                                └── RoomBox 1…n (trunk per room)
                        │
                   VLANs 10/20/30/40/50/99 per STD-004 §2.2

  RoomBox:  C1 uplink ──► room switch (24 V local, PoE-injecting) ──┬── ceiling AP ×1–2
                                                                     ├── touch panel
                                                                     ├── camera
                                                                     ├── room Ethernet points
                                                                     └── downstream RoomBox (chain)
```

**D2 — 16-port, and the PoE budget is modest.** Because the room switches run on local DC, NET's
PoE only serves the independent backup path to each sub-controller (5–8 W) plus anything hung
directly off NET.

| | Value |
|---|---|
| NET switch | **16-port managed, PoE+ (802.3at)**, ≥ 2 SFP uplinks |
| NET PoE budget | **≥ 90 W** — not the 250 W a passthrough design would need |
| Port count, 7-room house | 7 room uplinks + ONT + COMP + MEDIA + NVR + 2 spare = **13 of 16** |
| Room switch | 5–8 port, **wide DC input 12–57 V**, PoE+ injection sized per §1 |
| Uplink | 1 Gb minimum; 2.5 Gb or SFP to MEDIA where the full pack is taken |

ARCH-002's note that 8 ports covers only about five rooms is right, and 16 leaves the spare
capacity that makes a chain addition painless. The expansion-switch option is rejected: a second
switch adds a hop, a second failure point and a second management surface for no gain.

**VLAN delivery.** Each RoomBox uplink is a **trunk** carrying VLAN 20 (IoT + Audio) and 30
(Cameras) tagged, with 20 as the native VLAN for the room switch's own management. Trusted (10)
reaches only panels that need it. Security (50) **never traverses a RoomBox** — it rides the
SECURITY layer to the provider's own equipment, per ARCH-002 §12.4.

---

## 3. The 2.4 GHz problem

ARCH-001 §8.3 flagged 2.4 GHz contention as a risk. ARCH-002 then stacked WiFi, BLE, Zigbee,
Thread and a 2.4 GHz HID gateway into every RoomBox, and STD-003 added UWB and WiFi CSI. The band
is 2400–2483.5 MHz and it now has five tenants.

### 3.1 What has to coexist

| Tenant | Occupancy |
|---|---|
| WiFi 2.4 | 20 MHz channels; only 1, 6, 11 are non-overlapping |
| Zigbee (802.15.4) | 2 MHz channels, 5 MHz spacing: ch *n* centre = 2405 + 5(*n* − 11), ch 11–26 |
| Thread (802.15.4) | same channel set as Zigbee — **they compete for the same slots** |
| BLE | frequency-hopping across the band; advertising fixed at **2402, 2426, 2480 MHz** |
| 2.4 GHz HID | proprietary frequency-hopping. Unplannable |

### 3.2 The allocation

**The decisive move: confine WiFi 2.4 to channel 1 only, house-wide, at 20 MHz.**

Every AP is wired-backhauled to a PoE room switch, so there is no mesh backhaul competing for
air, and 5 GHz carries all real client traffic. The 2.4 radio exists for legacy IoT that cannot do
5 GHz. Putting every AP on channel 1 rather than spreading across 1/6/11 surrenders 2.4 GHz
capacity nobody needs and **frees 2425–2483 MHz entirely for 802.15.4.**

```
  2400 ────────────────────────────────────────────────────────── 2483.5 MHz
       │ WiFi ch1 (2402–2422) │        free for 802.15.4         │
       ▲                      ▲         ▲              ▲         ▲
    BLE adv 37             BLE adv 38  Thread ch20   Zigbee ch25  BLE adv 39
      2402                    2426       2450          2475        2480
```

| Service | Channel | Centre | Rationale |
|---|---|---|---|
| **WiFi 2.4** | **1** only | 2412 | one channel house-wide, 20 MHz, reduced power |
| **Thread** | **20** | 2450 | clear of WiFi ch1 and of all three BLE advertising channels |
| **Zigbee** | **25** | 2475 | 25 MHz from Thread; clear of BLE adv 39 at 2480 by its full width |
| **ESP-NOW** *(notification swarm)* | **1** | 2412 | STD-008 §6.1. Shares WiFi's single channel deliberately — one crowded channel beats two |
| BLE | hops | — | cannot be planned, only accommodated — hence keeping 802.15.4 off 2402/2426/2480 |
| 2.4 GHz HID | hops | — | separate the gateway antenna physically; accept occasional retries |

> **The notification layer rides channel 1 with WiFi, and that is the right answer rather than a
> compromise.** ESP-NOW is connectionless and its traffic is tiny — a few frames per event, from
> perhaps fifteen nodes. Putting it on channel 1 keeps **2425–2483 MHz entirely clear for
> 802.15.4**, which is what the whole §3.2 plan exists to protect. Giving the swarm its own channel
> would cost Thread or Zigbee their clearance to save airtime nobody needs.
>
> One consequence for commissioning: **re-measure Zigbee and Thread link quality with the swarm
> active** (§6), since this is new 2.4 GHz traffic that the r1 plan did not anticipate.

**Do not use Zigbee channel 26.** Its centre is 2480 MHz, exactly BLE advertising channel 39, and
it is power-limited on many radios besides.

### 3.3 5 GHz

| | Value |
|---|---|
| Channel width | **40 MHz.** Not 80, and never 160 — with more than three APs, wide channels overlap more than they gain |
| Preferred channels | **36 / 44** from the DFS-free indoor band (5150–5250 MHz) |
| Additional | 52 / 60 / 100 / 108 where more non-overlapping cells are needed, accepting DFS |
| Power | reduced to **50–75 %** so cells do not bleed into each other |
| Density | one AP per room for RB-L, otherwise roughly one per 60–80 m² |
| Roaming | enable **802.11k / v / r** |

**Roaming matters less here than it looks.** Snapcast clients, panels and cameras are all wired,
so only personal devices roam. The audio-follow layer in STD-003 §5 never depends on WiFi
handover.

### 3.4 UWB — a relief

UWB operates at 6–8.5 GHz (channel 5 ≈ 6489.6 MHz, channel 9 ≈ 7987.2 MHz). It does not touch
2.4 or 5 GHz at all. The positioning layer of STD-003 §7 adds **no** load to the congested band —
worth knowing before anyone decides UWB is too expensive to justify.

### 3.5 WiFi CSI

CSI extraction consumes no extra spectrum — it reads channel state from traffic already present.
But it needs **traffic to read**, so a CSI node and its reference transmitter must exchange frames
continuously, which does add airtime on WiFi channel 1. Budget it as one low-rate station per
sensing pair and keep it on 2.4 ch1 with the other legacy IoT, never on 5 GHz.

---

## 4. Sub-GHz

| Band | Duty cycle | Power | Use in BRIDGE |
|---|---|---|---|
| 433.05–434.79 MHz | ~10 % | 10 mW ERP | legacy remotes, shutters, cheap sensors; Site Pager's nRF905 |
| 868.0–868.6 MHz | **1 %** | 25 mW ERP | **LoRa / Meshtastic — BASE only**, per ARCH-002 §10.8 |
| 868.7–869.2 MHz | 0.1 % | 25 mW | avoid |
| 869.4–869.65 MHz | 10 % | 500 mW | long-range outdoor links if ever needed |

**The 1 % duty cycle is the binding constraint on 868 MHz**: 36 seconds of transmission per hour,
per device. A LoRa packet at SF7/125 kHz is roughly 50 ms, so about **720 packets per hour** —
ample for telemetry and gateway reporting, and nowhere near enough for a control loop. **Nothing
time-critical may depend on 868 MHz.** This is the regulatory reason behind ARCH-002's rule that
LoRa is a BASE-only protocol, and it is worth recording as a reason rather than a rule.

**Antenna separation.** The sub-GHz transceiver, the 2.4 GHz HID gateway and the 802.15.4 radios
all live in Z4 (STD-001 §2.3). Keep ≥ 50 mm between antennas, ≥ 20 mm from any metal, and none
crossing the partition into Z1.

---

## 5. Protocol topology

| Network | Coordinator | Routers | Rule |
|---|---|---|---|
| **Zigbee** | one coordinator — at NET, or in the consumer unit in the centralised variant | one router per RoomBox Z4 | **one network, one channel (25), one coordinator.** Never two Zigbee networks in one house |
| **Thread** | **border routers at BASE plus selected rooms (F05)**; the S3+H2 pair in other RoomBoxes runs as a plain router | every mains-powered Thread device routes | one Thread network, one channel (20). Several border routers on one network is correct; **all of them is not** — each adds mDNS and SRP chatter, so spread redundancy without flooding. Two at BASE, one at RoomBox 1 is the reference |
| **Matter** | commissioned to the fabric; transport is Thread or WiFi | — | a device's transport is an implementation detail; the fabric is what matters |
| **BLE** | ESPHome Bluetooth **proxies**, per ARCH-001 §4.1 and **D11** | one per RoomBox plus corner nodes | proxies, not SIG Mesh — HA-native and sufficient |

**Protocol masters attach to the network, never by USB to COMP** — ARCH-002 §4.2's key rule, and
the thing that lets the BASE layers be physically split without redesign.

---

## 6. Commissioning — DATA and RF (continues U8)

**Cabling**

- [ ] Certify every Cat6A permanent link to Class E_A — not a continuity test, a certification
      with a tester, and keep the results.
- [ ] Verify conduit C1's second Cat6A is present, terminated and labelled as spare.
- [ ] Confirm MEDIA uplinks run at the negotiated rate, not a fallback rate.

**Switching and VLANs**

- [ ] Verify each RoomBox trunk carries exactly the intended tagged VLANs and no others.
- [ ] Verify Cameras (30) and Security (50) cannot reach the internet, and that nothing reaches
      them except the NVR and COMP on named ports.
- [ ] Verify Guest (40) is isolated from every other VLAN.
- [ ] Measure the **actual PoE draw per room switch** against §1 and confirm headroom.
- [ ] Confirm the room switch runs from the local rail, and that pulling NET's PoE does **not**
      drop the room switch.
- [ ] Confirm pulling the room's 230 V circuit **does** leave the sub-controller alive on the
      independent PoE path.

**Radio**

- [ ] Survey 2.4 GHz and confirm every AP is on channel 1 at the intended reduced power.
- [ ] Confirm Thread is on channel 20 and Zigbee on channel 25 — and that neither has silently
      migrated after a coordinator restart.
- [ ] Map Zigbee LQI and Thread link quality from every room; identify any node with a single
      parent and no alternate route.
- [ ] 5 GHz: confirm 40 MHz width, intended channels, and that adjacent cells overlap at roughly
      −67 dBm rather than deeply.
- [ ] Confirm 802.11k/v/r are enabled and that a phone roams between two APs without dropping a
      call.
- [ ] Measure 868 MHz airtime over an hour and confirm it is under 1 % per device.
- [ ] Verify antenna separations in Z4, and that no antenna crosses the partition.
- [ ] With the HID gateway active, re-check Zigbee and Thread link quality — the HID dongle is the
      one tenant that cannot be planned around and must be measured.

---

## 7. Open items

| Ref | Open |
|---|---|
| **D1** | Room list — AP density, port count and the Zigbee/Thread route map all need it |
| **U22** | P33's switch and AP schedule, which turns §2 from a sizing rule into a bill of materials. **No camera schedule** — D15 fits none, though positions are provisioned (STD-001 §4.1) |
| — | The §4 duty cycles and §3.3 channel availability need checking against current ETSI and national allocation before any commercial use |
| — | Whether the Zigbee coordinator sits at NET or in the consumer unit follows from **C2** per house (F06), not from this document |

**Closed in r2:** F01 F02 F03 F04 F05 F06 F07 F08 F09 F10 · **D3** by STD-007 §7 (full pack, so the
MEDIA uplink is 2.5 Gb or SFP+) · the Thread border-router count by F05. **F04 adds a note to
STD-001 §4.2:** the cabinet provisions 2–3 dedicated circuits for the system itself, at least one
through a remotely operable breaker.
