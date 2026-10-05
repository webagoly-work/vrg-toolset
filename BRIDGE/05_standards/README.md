> **Start at [BRIDGE-OUTLINE-001](../BRIDGE-OUTLINE-001_General-Outline.md)** — the general outline
> and the P33 worked instance. New sessions: read [BRIDGE-PRIMER-001](../BRIDGE-PRIMER-001_Session-Handover.md) first.

# BRIDGE Standards — index

> **All of 001–007 are at r2 (2026-10-05)**, applying the round-2 decisions and the open-items
> briefing. STD-008 and the thermal annex are new at r1. The decision record is
> [`_build/BRIDGE-A-002_decisions.md`](../_build/BRIDGE-A-002_decisions.md); the reasoning behind the
> recommendations is [`_build/BRIDGE-E-002_open-items-briefing.md`](../_build/BRIDGE-E-002_open-items-briefing.md).
> **Four figures changed materially in r2** and are worth knowing if you read r1: uniform **110 mm**
> box depth · vent areas **~5× larger** · **no DALI** · presence thresholds **loosened**.

The dimensioned layer beneath BRIDGE-ARCH-002. Where ARCH-002 says *what exists and what connects
to what*, these say *how big, how deep, how bright, how sure, in what order.*

**Authority chain** — ARCH-001 (doctrine, retrofit scenario S-A) → **ARCH-002** (architecture,
reference scenario S-C) → **Smart Switch r1** (control authority; supersedes ARCH-A1) →
**STD-001…006**. ARCH-A1 and P33-BRIDGE-ARCH-01 are history, marked superseded, never cited as
current.

**Scenario.** All six standards describe **S-C**, the full-infrastructure reference design. S-A
(Shadow Layer retrofit) and S-B (SELV net) are reduced variants; the invariant across all three is
the control-authority model — bistable memory element, manual-first, ζ/η families.

---

| Doc | Title | Answers |
|---|---|---|
| **STD-001** | [Physical Standardisation](BRIDGE-STD-001_Physical-Standardisation.md) | RoomBox internal layout on an 18 mm module with a row-pitch rule · uniform 110 mm depth · zone order · CHANNEL bundle and construction · ARM composition per room class · the Edge RoomBox · the per-room buildup sequence · reserved AV and bed-sensor envelopes |
| **— A1** | [Passive Thermal Design](BRIDGE-STD-001-A1_Passive-Thermal-Design.md) | why a chimney above the box cannot work, what free area is actually needed, and where empty pipes genuinely help |
| **STD-002** | [Light and Scene](BRIDGE-STD-002_Light-and-Scene.md) | the five light layers · perceptual dimming · IEEE 1789 flicker · colour, Duv and tunable white · the 24 V convenience/assured buses · the scene model · 17 integrated lighting types |
| **STD-003** | [Presence and Identity](BRIDGE-STD-003_Presence-and-Identity.md) | the portal graph · log-odds sensor fusion with weights and decay · Trinity identity and its tiers · audio that follows |
| **STD-004** | [Naming and Control Backbone](BRIDGE-STD-004_Naming-and-Control-Backbone.md) | the reference scheme · address, VLAN and IP allocation · BRIDGE_LINK as a real protocol · the centralise/distribute rule |
| **STD-005** | [Network and RF](BRIDGE-STD-005_Network-and-RF.md) | switch sizing and the corrected PoE path · the 2.4 GHz channel plan · 5 GHz · sub-GHz duty cycles · protocol topology |
| **STD-006** | [Arbitration, Failure and Security](BRIDGE-STD-006_Arbitration-Failure-Security.md) | the eight-tier precedence ladder · per-domain hold-off · the failure-mode matrix · the third-party alarm boundary |
| **STD-007** | [Media and Audio](BRIDGE-STD-007_Media-and-Audio.md) | the two audio paths and why one cannot serve both · amplifier and speaker engineering · TOSLINK against eARC · video distribution · the USB layer · the MEDIA pack |
| **STD-008** | [Notification Lights](BRIDGE-STD-008_Notification-Lights.md) | a universal visual output layer: four RGBW pixels in a flush box · the signalling alphabet · stationary, transit and node placement · ESP-NOW · and the egress wayfinding it gives for free |

---

## Reading order

**To understand the system:** 001 → 004 → 005 → 006 → 002 → 003 → 007.
Physical first, then how things are named and talk, then the network, then how it behaves, then
the three experience layers.

**To build it:** 001 §6's thirteen-step sequence is the build order. 004 §1 before anything is
labelled. 005 §1 before any switch is bought. 007 §2.3 before the living room's joinery is
designed, because multichannel audio needs a position that is not a RoomBox.

**To commission it:** every standard commissions its own layer — 001 §8 physical, 002 §11 light,
003 §8 presence, 004 §5 control, 005 §6 data and RF, 006 §4 system and security, 007 §8 media and
audio. **Every layer now has a test plan.**

## Cross-references worth knowing

- **002 §2.2 ↔ 004 §3.4** — a dimmer setpoint on the wire is perceptual `s` × 1000. The node owns
  the `s³` curve and the per-fixture correction. The wire carries intent, never duty.
- **003 §2 ↔ 004 §3.5** — the event ring is what lets a 400 ms polled bus carry doorway crossings
  without losing or reordering them.
- **003 §2.4 ↔ 001 §4** — portals need no new pathway; the door-frame ARM is already specified.
- **002 §7.2 ↔ 006 §2** — the hardwired egress latch is the only lighting path with no controller
  in it, and the failure matrix is why.
- **001 §2.6 ↔ 005 §1** — the RB-L thermal budget assumes the room switch is locally powered and
  injecting ≈63 W. Raise its allowance to ~12 W.
- **004 §4 ↔ 006 §2.2** — centralisation is defensible only because manual-first is implemented in
  hardware, and the failure matrix is where that becomes visible.
- **007 §1 ↔ 003 §5** — the follow-me layer and television audio are *different paths*. Snapcast's
  800 ms buffer is invisible for music and twenty times the lip-sync threshold for a picture.
- **007 §2.3 ↔ 001 §2.6** — a 5.1 amplifier bay does not fit the RoomBox thermal budget.
  Multichannel moves to a dedicated AV position; the RoomBox keeps the 2-channel pair.
- **007 §5.2 ↔ 001 §3.1** — conduit C2 is M40 because an HDMI AOC connector is wider than its
  cable and must not be pulled by the connector.
- **008 §3.1 ↔ 003 §2 ↔ Melléklet 1/A** — a transit notification light shares the portal's stub-out
  and the door multi-point's 1100 mm band, so the transit layer needs no new conduit at all.
- **008 §5 ↔ 002 §7.2** — notification lights on the assured bus behind the hardwired latch *are*
  the egress wayfinding layer. Same hardware, same bus, and it works with the controller dead.
- **008 §7 ↔ 006 §1.2** — the announcement a safety override is required to make now has somewhere
  to happen, in the room where the override is happening rather than at a panel down the hall.

## What is not here

`D1` — the room list with a RoomBox class per room — does not exist, and it gates more than
anything else: 001 §4 is a template, 003's zone graph is an illustration, 002's scene values are
unfillable, 004's address allocation has no room numbers to key to, and 005 cannot size AP
density. `P33-BUILD-001`, the project hardware composition, waits on it and will be the first real
test of all six.

Open items live per-document in each §Open items, and in the register at
[`_build/BRIDGE_infobase.md`](../_build/BRIDGE_infobase.md) by ID: **C** contradictions,
**D** declared decisions, **U** gaps.
