# BRIDGE-STD-007 — Media and Audio

**Doc:** BRIDGE-STD-007 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §4.4/§10.5/§10.6 · BRIDGE-STD-003 §5 · BRIDGE-STD-001 §2.6
**Closes:** U7 audio latency and impedance detail · **U8** MEDIA commissioning *(the last test-plan
gap)* · refines **D7** · informs **D3**
**Scope:** the MEDIA layer's gear, video distribution, the audio system in engineering detail, the
USB layer, and the commissioning that 001–006 left unwritten.

---

## 1. Two audio paths, not one

STD-003 §5 specified Snapcast for audio that follows an occupant and left the latency budget open.
Working it through produces the most consequential finding in this document: **one audio path
cannot serve both music and television.**

### 1.1 The arithmetic

Snapcast synchronises by timestamp — the server marks each buffer with a playback time, every
client buffers and plays at the scheduled moment. Clients therefore agree with each other to
within their clock-sync accuracy, which on wired Ethernet is a few milliseconds at worst. But the
**absolute** latency equals the buffer, typically **500–1000 ms**.

For music that is invisible. For a picture in the room it is catastrophic. Perceptible lip-sync
error begins around **45 ms** of audio lead and **125 ms** of lag; comfortable viewing wants
±20–40 ms. A 800 ms buffer is an order of magnitude outside that, and shrinking the buffer below
about 200 ms sacrifices the sync robustness that is the entire reason for using Snapcast — while
still leaving you five times over the threshold.

### 1.2 The resolution

| | **Path A — Distributed** | **Path B — Local** |
|---|---|---|
| Carries | music, whole-home audio, follow-me | **TV and any source whose picture is in the room**, voice-assistant response, doorbell, alarm |
| Transport | Snapcast over VLAN 20 | direct to the room's amp, **never touches the server** |
| Buffer | **800 ms** | none |
| Absolute latency | 800 ms — irrelevant | **< 20 ms** end to end |
| Inter-zone sync | **< 5 ms** measured, ≤ 20 ms accepted | not applicable — single room |

> **The rule: a source whose picture is in the room must use Path B.** Only Path B can be
> lip-synced. This is not a tuning preference; it is a consequence of how synchronised
> distribution works.

**Watching the same thing in two rooms** is therefore not "send the audio to both zones." Video
and audio must travel *together* and arrive together — HDMI-over-IP or HDBaseT carrying both, with
matched receivers. Never split a picture from its sound and reunite them over different paths.

### 1.3 Priority and ducking

Path B outranks Path A in the room it occupies.

| Event | Behaviour |
|---|---|
| TV audio starts | Path A **mutes** in that room, does not duck. Two programmes at once is never wanted |
| Doorbell / announcement | Path A **ducks −20 dB** for the announcement plus 1 s, then restores |
| Alarm *(STD-006 §3.2)* | Path A **stops entirely**. Not ducked — stopped |
| Voice assistant response | Path A ducks −20 dB until the response completes |

---

## 2. Amplification — and where it cannot live

### 2.1 The design point

| Parameter | Value |
|---|---|
| Supply | the RoomBox **24 V** rail (STD-001 §2.2, Z2 → Z3) |
| Topology | Class-D, bridge-tied load |
| Speaker impedance | **8 Ω. Not 4 Ω** — see §2.2 |
| Output, continuous | **≈ 25–30 W per channel** into 8 Ω |
| Headroom check | 24 V rail → ≈ 17 V RMS → 17² ⁄ 8 ≈ **36 W** peak into 8 Ω |

**That is ample, and worth demonstrating rather than asserting.** A typical in-ceiling speaker is
86 dB at 1 W / 1 m. At 25 W: 86 + 10·log₁₀(25) ≈ **100 dB at 1 m**, which is about **90 dB** at a
3 m listening position. Loud for a bedroom, generous for a kitchen.

### 2.1a A third speaker method — Bluetooth and USB sticks (H03)

Alongside wired ceiling pairs and the AV position, the design admits **powered speakers joined over
their own Bluetooth**, and **USB-A Bluetooth transmitter sticks** on a RoomBox USB point to feed
them.

**What it is good for.** A speaker that moves — workshop, terrace, a desk that changes rooms, a
guest room pressed into use. No ARM, no flush box, no commitment. It is the right answer for every
position that is not permanent, and it costs a stick.

**What it cannot join.** **Not Path A.** Bluetooth adds 100–200 ms of its own codec and transport
latency on top of Snapcast's 800 ms buffer, and — more fundamentally — **two Bluetooth speakers
cannot be synchronised to each other or to a wired Snapcast client.** So a Bluetooth speaker is
always a **single independent zone**, never part of the follow-me layer and never one half of a
stereo pair across rooms.

| | |
|---|---|
| Transmitter | USB-A BT stick on a RoomBox USB point (§6.1), or the speaker's own pairing |
| Zone behaviour | **independent zone.** Takes a source, does not join the synchronised group |
| Latency | +100–200 ms over Path A. **Never for anything with a picture** (§1.2) |
| Rule | **one Bluetooth zone per room maximum** — two in earshot of each other will drift audibly |

Treat it as a convenience layer that sits beside the architecture rather than inside it. The moment
a position becomes permanent, it earns a wired pair.

### 2.2 Why 8 Ω and not 4 Ω

Four ohms doubles the current for the same voltage swing. In a sealed wall cavity with a 70 W
thermal ceiling (STD-001 §2.6) that is the wrong trade: it halves the amplifier's thermal headroom
to buy output nobody needs, and it makes cable resistance matter twice as much (§3.2). **Specify
8 Ω throughout and the whole chain gets easier.**

### 2.3 The thermal finding — multichannel does not belong in a RoomBox

STD-003 §5.3 noted that the amp bay and the lighting drivers share Z3 and compete for volume and
thermal budget. Quantified:

| Bay | Typical dissipation | Peak | Verdict against STD-001 §2.6 |
|---|---|---|---|
| **2-channel** | 3 W | 10 W | fits any class. RB-S included |
| **6-channel (5.1)** | 9 W | **≈ 30 W** | RB-L's budget is 70 W with 41 W already typical. Peak pushes the ceiling. **RB-M cannot take it at all** |

**Resolution, which refines D7:** the RoomBox hosts the **2-channel distributed pair** — the
follow-me layer, in every room. **Multichannel home cinema is a separate AV position** at the
media wall, fed directly by MEDIA, with its own enclosure, its own ventilation and its own supply.

This is better architecture than the compromise it replaces. A 5.1 processor wants eARC, HDMI
switching and real heatsinking; a follow-me pair wants to be invisible and cheap. Forcing both
into Z3 served neither.

### 2.4 Speaker provision (D7, refined)

**Fitted per H04: living, kitchen, hall and bathroom. Bedroom and study are not in the follow-me
set.**

| Room | Distributed pair (RoomBox) | Multichannel (AV position) |
|---|---|---|
| **Living** | stereo pair, ceiling *(follow-me)* | **5.1 (H05)**, wall/floor front stage, ceiling surround, one subwoofer position. **7.1 variant designed — see below** |
| **Kitchen** | stereo pair, ceiling | — |
| **Hall** | 1 × ceiling, or a stereo pair | — |
| **Bathroom** | 1 × ceiling or stereo, IP-rated | — |
| Bedroom, study | **not fitted** | — |
| WC, pantry | not fitted | — |

> **The bedroom is out and the bathroom is in**, which inverts the usual pattern and is worth
> flagging as deliberate. Two consequences: the quiet-hours rule of §5.2 has much less to do, since
> there is no bedroom speaker to suppress; and a stream following someone stops at the bedroom door.
> Should that prove wrong, a bedroom pair is a dedicated ARM in conduit that already exists — a late
> addition, not a rework.

**The 7.1 variant (H05).** Same front stage and subwoofer; the surround pair moves forward to the
side-wall positions and a **rear pair is added behind the listening position**. What it needs
provisioned now, because it is impossible later: **two further speaker ARMs to the rear wall** and
**two more amplifier channels at the AV position**. Pull the rear ARMs with the rest and cap them —
two cables and two flush boxes, against a wall that would otherwise have to be opened again. The
decision between 5.1 and 7.1 then becomes a processor choice rather than a construction one.

**Ceiling for the follow-me layer everywhere; wall or floor only where someone sits down to
listen.** Ceiling speakers give even coverage and disappear, which is what a whole-home layer
needs. They give poor stereo imaging, which only matters in front of a sofa.

**Note the two independent sets in the living room.** The follow-me pair and the cinema front
stage are different speakers doing different jobs, and trying to make one set do both compromises
the imaging of a front stage and the coverage of an ambient layer.

---

## 3. Speaker cabling

### 3.1 Specification

Dedicated run from the RoomBox to every position — never daisy-chained, never shared.
Two conductors, **1.5–2.5 mm²** per ARCH-002 §10.5, sized by length per §3.2.

### 3.2 Length limits

Cable resistance sits in series with the load, so it both loses power and degrades the amplifier's
damping factor, which is what controls bass. The standard discipline is **loop resistance ≤ 5 % of
speaker impedance** — for 8 Ω that is **≤ 0.4 Ω total loop**, giving about 0.5 dB loss.

| Conductor | Loop resistance | **Maximum run, 8 Ω** |
|---|---|---|
| 1.0 mm² | 0.0356 Ω/m | **11 m** |
| **1.5 mm²** | 0.0238 Ω/m | **17 m** |
| **2.5 mm²** | 0.0148 Ω/m | **27 m** |
| 4.0 mm² | 0.0092 Ω/m | 43 m |

Within a room 1.5 mm² is almost always sufficient; 2.5 mm² covers a large open plan or a run that
doubles back. At 4 Ω every figure in that column halves — a second reason for §2.2.

### 3.3 Discipline

- **Polarity marked at both ends** and verified absolutely, not just consistently (§6).
- Keep speaker cable out of the MAINS conduit entirely; it is a SELV-class signal run.
- Label both ends with the position reference per STD-004 §1 — `R05.SP3`.
- Leave a 300 mm service loop at the RoomBox end, in ZT.

---

## 4. TV audio return — TOSLINK or eARC

| | **TOSLINK (S/PDIF optical)** | **eARC (HDMI 2.1)** |
|---|---|---|
| Capacity | 2 ch PCM, or compressed 5.1 bitstream | up to 37 Mbps — lossless 5.1/7.1, Atmos |
| Isolation | **optical — galvanically isolated, no ground loop** | electrical, can carry a loop |
| Dependency | independent of the HDMI chain | needs a working HDMI 2.1 link at both ends |
| Failure mode | works even if HDMI is down or in use elsewhere | fails with the HDMI link |

**The split follows the amp split:**

- **TOSLINK for the distributed 2-channel path** in every room. Stereo is all that path carries,
  optical isolation removes the commonest source of hum in a whole-home system, and it keeps
  working when the HDMI chain does not.
- **eARC at the AV position only**, where lossless multichannel is the point and an AVR is there
  to receive it.

Both are specified in the ARM to the media wall, per ARCH-002 §10.5 — the choice is which gets
terminated, and running both costs almost nothing now and cannot be added later.

---

## 5. Video distribution

### 5.1 Selection

**AOC direct is the primary transport (H09).** Gaming happens but not competitively (H08), which
means the latency budget is forgiving — but since AOC direct is also the simplest and the
highest-bandwidth option, there is no reason to trade it away.

| Situation | Transport | Why |
|---|---|---|
| **One screen, fixed source — the default here** | **HDMI 2.1 AOC direct** | lowest latency, full 48 Gbps, one link and one HDCP handshake |
| Gaming position | **AOC direct** | H08 is casual rather than competitive, so 50–200 ms would be tolerable — but there is nothing to gain by accepting it |
| Several sources to several screens | HDMI-over-IP on the DATA layer | matrix switching; accept 50–200 ms on compressed. Not the gaming position |
| Long run needing embedded control | HDBaseT | carries IR, RS-232, Ethernet to 100 m |

**MEDIA is direct-line only** — ARCH-002 §7.1 is right that HDMI cannot be cleanly chained because
of repeater and HDCP limits. A CHANNEL may pass *through* a RoomBox as a pass-through cable in ZT,
but never terminate and re-originate.

### 5.2 Two practical cautions

**HDCP is what actually fails.** HDCP 2.3 handshake failures cause more faults in distributed video
than bandwidth ever does, and every additional device in the chain multiplies the risk. Direct AOC
has one link and one handshake. Prefer it wherever the topology allows.

**AOC cables are directional and fragile.** The optical transceiver lives inside the connector, so:
the source end is marked and must be installed at the source; **never pull an AOC by its
connector** — use a pull sock on the cable body; and respect its bend radius, which is tighter than
copper's. This is precisely why conduit C2 is **M40** in STD-001 §3.1 — an AOC connector is larger
than its cable and needs the clearance.

### 5.3 The media-wall cable route (H06)

The problem this solves is mundane and universal: **user-brought devices need to reach the TV
without a visible tangle behind it.** A console, a laptop, a camera, a handheld — each wants HDMI
and power, each arrives and leaves, and the usual result is cables draped across a wall.

**The build.** A **large-diameter inline route** — or a generous **parapet csatorna** with flush
terminations — joining **two flush boxes of 10 × 10 or 15 × 10 cm**, one behind the screen and one
at the furniture position where devices actually sit.

```
   ┌─────────────┐                              ┌─────────────┐
   │  box A      │   large-bore route or        │  box B      │
   │  behind     │═══ parapet trunking ════════ │  at the      │
   │  the screen │   sized to pass a plug       │  furniture   │
   └─────────────┘                              └─────────────┘
         ▲                                            ▲
    screen inputs                          user devices plug in here
```

| | Requirement |
|---|---|
| **Bore** | sized to pass an **assembled HDMI connector**, not just the cable. M50 minimum; M63 or trunking is better, and the AOC caution of §5.2 applies in full — the connector is the limiting dimension |
| Boxes | 10 × 10 or 15 × 10 cm flush, deep enough for a service loop and a plugged connector at a bend |
| Ends | **open and dressed, not glanded.** The whole point is that cables are pulled through by the occupant, repeatedly, without tools |
| What runs in it | user HDMI, USB, and **nothing permanent** — permanent runs use C2 and the AV position |
| Combined with | **the AV position** (§2.3). Box A sits in or beside the AV void, so a user device can reach either the screen directly or the AV processor |

**Why it is worth a named detail rather than being left to site.** It has to be in before the wall
is closed, it cannot be retrofitted, and the bore has to be chosen for a connector rather than a
cable — which is the one dimension people get wrong, because they size it for the HDMI *cable* and
then cannot get the *plug* through.

---

## 6. The USB layer (ARCH-002 §10.6)

### 6.1 Separate power from data

Most endpoints want charging, not a host connection, and conflating the two over-provisions
everything.

**USB data endpoints are fitted at the study/desk and the living-room media wall only (H11).
Everywhere else is charging.**

| Need | Build |
|---|---|
| **USB power only** — bedside, kitchen, hall, bathroom, everywhere not listed below | a **USB-PD module at the endpoint**, fed from the RoomBox's 24 V LV rail. **No data path at all** |
| **USB 2.0 data** — study/desk, media wall (H11) | **USB-over-Cat6A extender pair**, one unit in Z3, one at the endpoint. Good to ~100 m. Also carries the BT transmitter stick of §2.1a |
| **USB 3.x data** | passive is ~2–3 m, so either an **active optical cable** in C2/C4, or a local host |
| Shared device access | **USB-over-IP** on the DATA layer |

### 6.2 The 2.4 GHz HID gateway

ARCH-002 §10.8's HID gateway appears as a USB host to a device in the room, or exposes a vendor
receiver over USB-over-IP. The honest position from ARCH-002 stands: **vendor dongles expect a
direct host, so the method has to be chosen per device.** No single mechanism covers all of them,
and STD-005 §4 notes the dongle is also the one radio tenant that cannot be planned around.

---

## 7. The MEDIA layer itself (informs D3)

**The full pack is taken (H01, resolving D3).** The basic pack is retained below as the documented
alternative, since it remains the right answer for a smaller installation.

| | Basic pack *(alternative)* | **Full pack — specified** |
|---|---|---|
| Storage | 0.5–1 TB SSD, SMB/NFS share, backup target | NVMe system + HDD/SSD library bays + **separate NVR storage** |
| Compute | low-power storage controller | **low-power x86 with a hardware video engine** (N100/N305 class with Quick Sync, or 12th-gen+ i3/i5), 16–32 GB RAM |
| Streaming | direct file access and direct play, **no transcoding** | 4K transcode, several rooms concurrently |
| Services | share, backup | media server, **Snapcast server**, Music Assistant, NVR, backup, optional local inference |
| Uplink | 1 GbE | **2.5 GbE or SFP+** |

**NVR storage must be physically separate from the library.** Camera recording is continuous
sequential writing, twenty-four hours a day, which wears consumer SSDs quickly and fragments a
shared pool. Use surveillance-rated CMR drives for the NVR, and never let it share a volume with
media or backups.

**Both packs carry**, per ARCH-002 §4.4: user-facing front ports (USB, SD, HDMI in, TOSLINK, RCA /
3.5 mm), extensible a few metres from the layer or brought out at a RoomBox; an optional legacy
player bay; and the media control strip and handset dock.

**The load-bearing rule holds.** Transcoding, library serving, camera recording, bulk backup and
any local inference live here or on a dedicated compute node — **never on COMP.**

---

## 8. Commissioning — MEDIA and AUDIO (closes U8)

### 8.1 Video

- [ ] At every screen, confirm the **negotiated** link rate and EDID, not merely that a picture
      appears.
- [ ] Confirm HDCP 2.3 handshakes on every source/screen combination that will actually be used.
- [ ] Confirm 4K HDR passthrough and the colour format at the screen.
- [ ] Confirm each AOC is installed **source-end correct**, and record which end is which.
- [ ] Where HDMI-over-IP is used, **measure** end-to-end latency and confirm it is acceptable for
      the content — and that nothing used for gaming goes through it.
- [ ] Confirm CHANNEL pass-through video cables in ZT are undisturbed and labelled.

### 8.2 Audio — the path separation

- [ ] **Confirm TV audio does not traverse the Snapcast server.** Verify by path, not by ear.
- [ ] **Measure lip-sync offset** at every screen with a clap or sync test; confirm within ±40 ms.
- [ ] Measure **inter-zone skew** at a doorway between two adjacent zones; confirm < 20 ms, and
      expect < 5 ms on wired clients.
- [ ] Confirm Path A mutes — not ducks — when TV audio starts in the same room.
- [ ] Confirm an announcement ducks Path A by −20 dB and restores after 1 s.
- [ ] Confirm an alarm **stops** Path A entirely (STD-006 §3.2).
- [ ] Verify follow-me handoff does not oscillate when standing in a doorway for 60 s
      (STD-003 §8).

### 8.3 Audio — electrical and acoustic

- [ ] **Measure loop resistance** on every speaker run; confirm ≤ 0.4 Ω, and record it.
- [ ] Confirm every speaker's impedance **at the amplifier end**, with the cable in circuit.
- [ ] Verify **absolute** polarity at every position, not merely that pairs match each other.
- [ ] Measure SPL at the listening position at the design output; confirm the §2.1 budget is met
      without the amp clipping.
- [ ] **Measure Z3 temperature after 30 minutes at sustained three-quarter output**, against the
      STD-001 §2.6 budget for the class. This is the test that confirms §2.3's finding on the
      installed hardware.
- [ ] Confirm the multichannel AV position has its own supply and ventilation, and is **not** in
      the RoomBox.

### 8.4 Storage and network

- [ ] Confirm NVR storage is a separate volume on separate physical drives from the library.
- [ ] Confirm the MEDIA uplink negotiates its full rate, and that it is on the intended VLANs
      (STD-004 §2.2).
- [ ] Confirm MEDIA is reachable from Trusted and from COMP, and **not** from Guest.
- [ ] Verify a transcode of the worst-case file the house actually holds, to the worst-case
      client, concurrently with an NVR write.
- [ ] Confirm nothing in the §7 "never on COMP" list is running on COMP.

### 8.5 USB

- [ ] Verify every USB extender at its **full installed cable length**, with the actual device
      class that will be used — not with a test stick.
- [ ] Confirm Type-C power endpoints deliver their rated PD profile from the 24 V rail under load.
- [ ] Confirm the HID gateway method chosen per device actually works with that device's dongle.

---

## 9. Open items

| Ref | Open |
|---|---|
| **H10** | **Where the Snapcast server runs — deliberately left open.** On MEDIA it shares CPU and disk with transcoding and continuous NVR writes, and the symptom of getting it wrong is the follow-me layer stuttering whenever someone else watches something: intermittent, correlated, and unpleasant to diagnose after the fact. **This is a measurement, not an argument.** Run the worst transcode the house will actually see, concurrent with multi-room audio, and listen. If it holds you have saved a node and its maintenance; if it stutters you have learned it before it was load-bearing |
| **H12** | Voice assistant satellites deferred — **reserve the ceiling position and the conduit**, which §6.2 and the SENSOR ARM already provide |
| **D1** | Room list — speaker positions, screen positions and cable lengths all follow from it |
| **U22** | P33's AV schedule: which rooms get screens, which gets the AV position, and the measured cable runs |
| — | The AV position's **envelope** — ventilation, a dedicated 230 V circuit, an HDMI and eARC path. Now recorded in **STD-001 §4.1** as a named position rather than a RoomBox class, but it still wants a drawn enclosure |
| — | 5.1 is specified and the 7.1 provision is pulled (§2.4). The processor choice can wait; **the rear ARMs cannot** |

**Closed in r2:** H01 *(resolving D3)* · H02 H03 H04 H05 H06 H07 H08 H09 H11 · **D7** by §2.3–2.4,
where the amp-bay thermal finding settled it · **U7** and **U8** in r1.
