# BRIDGE-STD-003 — Presence and Identity

**Doc:** BRIDGE-STD-003 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §10.9/§11 · *Presence Sensing as a Building-Block System* v1.0 ·
BRIDGE-STD-001
**Closes:** U23 modality stack · U5 fusion model · U24 identity architecture · U19 audio follow
**Scope:** how BRIDGE knows someone is there, which someone, and how sure it is.

> **r2 applies the round-2 decisions, and they move this standard further than any other.** The
> portal default drops to **P-1**, grace periods **lengthen**, thresholds **loosen** — three changes
> that together bias the system toward staying on and **weaken the graph veto**. §2.6 states the
> consequence plainly rather than burying it. Also: **no cameras indoors** but full CCTV
> provisioning · the **bathroom thermal array** becomes a primary sensor, not a supplement · a
> **4-digit PIN with lockout escalation** · recovery by console only for now.

> **The central move.** Instrumenting *doorways* rather than only *rooms* turns occupancy from a
> noisy per-room estimate into a **constrained graph problem** — and a constrained problem is a
> far better one to be solving. Everything in this document follows from that.

---

## 1. Four questions, not one

"Presence sensing" conflates four different questions. No sensor answers more than two of them,
and fusing sensors without knowing which question each one answers is why most systems behave
badly.

| | Question | Answered by |
|---|---|---|
| **Q1** | **Is anyone here?** (device-free) | mmWave · PIR · thermal array · CO₂ · load cell · WiFi CSI |
| **Q2** | **Where exactly?** (within a room) | mmWave zones · ToF · thermal array · UWB · camera |
| **Q3** | **Who is it?** | carried tags (Trinity) · phone · PIN · biometric · camera |
| **Q4** | **How many, and who moved where?** | **portals** · sequential PIR · door contacts |

Q4 is the one almost everyone omits, and it is the one that makes Q1 tractable. A room sensor
asks "do I see someone?" — a fallible question. A portal asks "did someone cross me, and which
way?" — a far more reliable one, because a crossing is a discrete, directional, well-posed event.

---

## 2. The portal model (the user's addition, formalised)

### 2.1 Definition

A **Portal** is a doorway or opening between two zones, instrumented to detect crossings and
their direction. The house becomes a graph: **zones are nodes, portals are edges**, and the
only edge to the outside world is the entry door.

### 2.2 Instrumentation tiers

| Tier | Build | Gives | Where |
|---|---|---|---|
| **P-0** | door contact only | "a crossing probably happened" — no direction | interior doors of low interest, cupboards |
| **P-1** | door contact + two sequential PIRs, or one directional PIR pair | **direction** | **the default (D01)** — most interior doorways |
| **P-2** | door contact + **dual ToF above the opening** | direction + **count** + adult/child/pet discrimination | **selectively (D01)** — where counting genuinely matters |
| **P-3** | P-2 + mmWave in the opening + thermal array | all of the above, robust to abreast crossings | **entry door only (D02)** |

**P-3 goes on the entry door and nowhere else.** It is the only edge to the outside, so it anchors
the whole house count and every other zone's number derives from it — an error there propagates
everywhere. Add the hall↔living opening only if it is a wide cased opening rather than a door; a
doored opening forces single file, which P-2 handles.

### 2.3 P-2 in detail — the one worth building

Two ToF sensors (VL53L1X single-zone, or VL53L5CX 8×8 for profile) at lintel height, looking
**straight down**, spaced along the direction of travel:

```
            lintel ≈ 2050 mm
    ┌─────────●───────●─────────┐     ● = ToF, 200 mm apart
    │        A         B        │       looking down
    │                           │
    │         ↓ person          │     A then B  → inward
    │                           │     B then A  → outward
    │      ▓▓▓▓▓                │     range ≈ 350–600 mm  → adult
    │      ▓▓▓▓▓                │     range ≈ 700–1100 mm → child
    │                           │     range ≈ 1850–1950 mm → pet
    └───────────────────────────┘
```

- **Direction** from the firing order of A and B.
- **Count** from the number of distinct break events — two people in file produce four events.
- **Classification** from the returned range, which is the inverse of the object's height. A cat
  under a 2050 mm sensor returns ~1900 mm; an adult returns ~400 mm. This removes the single most
  common false occupancy source in a home with animals.
- **Speed** from the A→B interval, which separates a walk-through from a lingering in the doorway.

ESP32 + two VL53L1X on I²C, in ESPHome. Modest build, large return.

### 2.4 It needs no new pathway

STD-001 §4 already allocates a **door frame point** ARM in every room, and ARCH-002 §10.11's
entry-zone pattern already puts a light-and-motion combo above the entry door and a multi-point
beside it. **The portal lives in conduit that is already specified.** Melléklet 1/A's stub-out —
SELV pair, signal pair, spare conduit — is exactly what a P-2 portal needs. Nothing in the
physical design has to change to adopt this.

### 2.5 Occupancy as a constrained graph

```
   per-zone counts, maintained by portal events:

   OUTSIDE ──entry──► HALL ──┬──► LIVING ──► KITCHEN
                             ├──► STAIR ──► LANDING ──┬──► BEDROOM
                             │                        └──► BATH
                             └──► STUDY
```

- A directional crossing **decrements the source zone and increments the destination**.
- **House total** is anchored by the entry portal, corroborated by house-level WiFi/phone presence.
- **Per-zone sensors supply evidence that corrects drift** — they are no longer the primary
  source of truth, they are the error-correction term.

**Drift is inevitable.** Two people abreast, a missed crossing, a door left open. So:

| Rule | Behaviour |
|---|---|
| **Sensor–graph disagreement** | if a zone's fusion score (§3) strongly contradicts its graph count for **> 30 s** (D07), trust the sensor and redistribute the difference to the zone with the weakest current evidence |
| **Graph veto** | the graph **may veto a single-sensor assertion** (D06) — see worked example 3. This is what kills mmWave ghosting, and §2.6 explains why it is now weaker |
| **Full reconciliation** | when house count resolves to 0 — no phone, no motion anywhere, no portal event for **T = 30 min** (D08) — reset every zone to 0 |
| **Open-door degradation** | a portal held open > **5 min** (D09) drops to P-0 behaviour and its two zones merge until it closes |

> **The 30-second disagreement window is the compensating adjustment for D01.** With P-1 portals the
> graph carries direction but not count, so it will be wrong more often than the r1 design assumed.
> Recovery speed therefore matters more than stability, and 30 s is the right side of that trade.

**Some openings should not be portals at all.** If an opening is habitually open or has no door —
a hall-to-living cased opening, an open-plan threshold — then modelling it as a portal that merges
and un-merges is fighting the building. **Draw those two spaces as one zone from the start** and put
portals only where doors actually get closed: bedroom, bathroom, WC, pantry, entry. Each opening
carries a **habitually-open flag** in the room schedule, which needs the plan and therefore lands
with D1.

### 2.6 What D01, D10 and D21 do together — stated plainly

Each is defensible alone. Together they tilt the system:

| Change | Effect |
|---|---|
| **D01** P-1 default | the graph has direction but **no count** at most openings |
| **D10** longer grace everywhere | a room stays "occupied" longer after the last evidence |
| **D21** looser thresholds | occupancy is declared on less evidence |

**The system will now produce far more false-occupied than false-vacant** — lights burning in empty
rooms rather than going dark on someone sitting still. **That is probably the right preference for a
home**: being left in the dark is a worse failure than ten wasted minutes, and the irritation
asymmetry is real.

**But it weakens the graph veto**, which was the structural cure for mmWave ghosting, because the
veto depends on a count that a P-1 portal cannot supply. Worked example 3 below still holds where a
P-2 portal exists; where only P-1 does, the veto degrades to "no inward *direction* recorded," which
is weaker evidence.

> **If ghosting appears in commissioning, D01 is the first thing to revisit** — upgrading a handful
> of P-1 portals to P-2 restores the count where it matters, and it is two ToF sensors per doorway
> in conduit that is already there.

---

## 3. The fusion model (U5)

### 3.1 Evidence in log-odds, not a weighted average

Each sensor contributes **points** when it asserts; evidence **decays** toward the prior with its
own time constant. This handles "fast but noisy" and "slow but certain" in one mechanism — PIR
contributes a lot briefly, CO₂ a little for a long time.

Two properties matter and a plain weighted sum lacks both:

- **Asymmetric polarity.** PIR asserts occupancy and **never** asserts vacancy, because it is
  blind to stillness. Encoding that as "0 when idle" rather than a negative is the whole fix for
  the classic lights-go-out-while-reading failure.
- **Per-sensor decay.** A PIR trigger is meaningless after 15 s. A CO₂ rise is meaningful for ten
  minutes.

### 3.2 Weight table

| Sensor | Occupied | Vacant | Decay τ | Note |
|---|---|---|---|---|
| **Load cell / pressure mat** | **+10** | −2 *(own spot only)* | instant | false positives nearly impossible |
| *Camera person-detect* | *+9* | *−4* | *30 s* | **not fitted (D15).** Weight retained for the CCTV-ready case — see §3.6 |
| **Switch or panel interaction** | **+9** | 0 | 120 s | a human physically did something. Very strong, almost never used, nearly free |
| **UWB tag in zone** | +7 | −3 | 10 s | identity **and** position |
| **mmWave presence** (tuned) | +6 | −3 | 60 s | the workhorse |
| **Thermal array blob** | +5 | −2 | 45 s | privacy-safe count and position. **Bathroom only (D14) — and there it is the *primary* sensor, not a supplement** |
| **ToF at a specific spot** (desk, chair) | +5 | −1 | 20 s | narrow but certain |
| **PIR motion** | +4 | **0** | 15 s | **never asserts vacancy** |
| **CO₂ rising trend** | +4 | −3 | **600 s** | the best long-window evidence in the house |
| **BLE tag strongest here** | +3 | −1 | 120 s | identity-bearing — see §4 |
| **Acoustic activity** (classified) | +3 | 0 | 90 s | corroborator only |
| **WiFi CSI movement** | +3 | −1 | 45 s | **experimental** — low weight until validated in situ |
| **Appliance power change** | +3 | 0 | 300 s | someone put the kettle on |
| **Humidity rising** (bath, kitchen) | +2 | 0 | 300 s | activity, not presence |
| **Door contact opened** | +2 *(primer)* | 0 | 10 s | the empty→entering primer |
| **Vibration / footstep** | +2 | 0 | 20 s | pre-arrival signal from an adjacent space |

### 3.3 States and thresholds

**Loosened in r2 (D21)** — easier to declare occupied, harder to declare vacant:

| Score **S** | State | Behaviour |
|---|---|---|
| **S ≥ +4** | **OCCUPIED** | act freely |
| **+1 ≤ S < +4** | **PROBABLY OCCUPIED** | hold current state — **never turn anything off** |
| **−4 < S < +1** | **UNKNOWN** | hold |
| **S ≤ −4** | **VACANT** | release after the grace period below |

Note what the asymmetry does: a single mmWave assertion (+6) now reaches OCCUPIED alone, and
reaching VACANT needs genuine negative evidence from more than one source. That is the intended
bias, and §2.6 is where its cost is recorded.

### 3.4 Vacancy grace by room

The cost of a false vacancy is not uniform, so neither is the grace. **All periods lengthened in
r2 (D10):**

| Room | Grace | Why |
|---|---|---|
| Hall / stair | **3 min** | transient by nature; a wrong call costs little |
| Kitchen | **12 min** | standing still at a worktop |
| Living | **15 min** | reading, television, stillness |
| Study | **30 min** | desk stillness is near-total |
| Bedroom | **45 min** | sleep is stillness; a wrong call is unforgivable |
| Bathroom | **8 min** + **hard interlock** | never release while humidity or water-flow is elevated |

### 3.5 Worked examples

**1 · Living room, someone reading still on the sofa, evening.**
mmWave +6 · CO₂ rising +4 · BLE tag (phone in pocket) +3 · PIR idle **0** · acoustic quiet 0.
**S = +13 → OCCUPIED.** A PIR-only system turned the lights off twenty minutes ago. The whole
model exists for this case.

**2 · Bathroom, shower running, person behind a curtain.**
mmWave degraded by steam, intermittent → +3 effective · humidity rising +2 · acoustic (water) +3
· PIR blocked by curtain 0. **S = +8**, and the portal graph independently holds a count of 1
from the inward crossing six minutes ago, with the hard humidity interlock active.
**→ OCCUPIED.** The graph and the interlock are carrying this, not the radar.

**3 · Kitchen, empty, a fan is moving a curtain — classic mmWave ghost.**
mmWave ghost +6 · CO₂ flat/falling −3 · PIR 0 · acoustic 0 · BLE no tag −1. **S = +2** →
PROBABLY. But the portal graph records **zero inward crossings since the last vacancy, count = 0**,
and the graph vetoes a lone sensor. **→ NOT OCCUPIED.** This is the failure the architecture is
built to prevent, and the veto is what prevents it.

**4 · Bedroom, 03:00, asleep.**
Load cell under the bed +10 · mmWave breathing detection +6 · CO₂ +4 · PIR 0.
**S = +20 → OCCUPIED, unambiguously.** This is the argument for a bed sensor: it converts the
hardest presence case in the house into the easiest.

> **Example 3 is the one r2 weakens.** Where a P-2 portal exists the veto holds exactly as written.
> Where only P-1 does (the new default), the graph can say "no inward *direction* recorded" but
> cannot say "count = 0" — weaker evidence against a confident ghost. §2.6 is where that is accounted
> for, and it is why ghosting in commissioning should send you back to D01 rather than to the weights.

### 3.6 Sensor fit, by room (D12 · D14 · D15 · D16)

| Sensor | Fitted in | Not fitted in |
|---|---|---|
| **mmWave** | living · bedroom · kitchen · hall/stair | study · **bathroom** — see below |
| **Thermal array** | **bathroom only**, as primary | elsewhere |
| **CO₂** | bedroom · kitchen · study | **living** — see below |
| **Camera** | **nowhere indoors.** Positions and conduit provisioned to full CCTV standard, capped and labelled | — |
| **Acoustic** | main rooms, **local classification only** — on-device events, no audio transmitted (D17) | — |
| **Load cell** | bedroom | — |
| **UWB anchors** | entry hall · living · bedroom (D19) | — |
| **WiFi CSI** | **deferred (D18)** — reserve the idea, build the proven layers first | — |

**Two gaps worth naming rather than hiding.**

**The bathroom has no mmWave (D12)**, although RB-3 exists chiefly to serve it. The thermal array
largely repairs this: it tolerates steam better than most optical sensors, gives fall detection —
the one genuinely valuable safety function in a bathroom — and provides count without a
recognisable image, which is the whole reason a camera is unacceptable there. **Promoting it from
supplement to primary is the right response**, and it is why D14's answer matters more than it looks.

**The living room has no CO₂ (D16)**, which is the room where people sit still longest and where a
slow-but-certain signal is worth most. mmWave plus the follow-me audio state plus switch
interactions should carry it. **If false vacancies show up anywhere, this is the room** — and a CO₂
sensor is the cheapest fix available.

---

## 4. Identity (U24)

### 4.1 Two quantities that must never be confused

**Presence confidence** asks whether a person is there (§3). **Identity confidence** asks which
person. A system that conflates them will unlock a door because the dog walked past.

### 4.2 The Trinity principle

Identity normally demands an act — type a PIN, present a finger. Carried tags make it passive,
but a tag proves the *object* is present, not the person. **Three independent carried objects
converging in one place is a much stronger claim than three times one object**, because the
likelihood of all three being separated from their owner together is low — and that
superadditivity is the point.

| Factor | Type | Points | Note |
|---|---|---|---|
| **PIN on the 4×3 matrix** | knowledge, **active** | **+12** | the primary |
| **Password** | knowledge, active | +12 | system and admin actions |
| **Phone biometric, offline, paired** | inherence by proxy, **active** | **+12** | the phone performs the biometric and returns only a signed match. **The biometric never leaves the device** — the same principle ARCH-002 §10.11 applies to its fingerprint module |
| Trinity — phone tag | possession, passive | +3 | |
| Trinity — keychain tag | possession, passive | +3 | |
| Trinity — wallet tag | possession, passive | +3 | |
| **Trinity — 2 of 3 co-located** | possession, passive | **+8** *(not +6)* | superadditive |
| **Trinity — 3 of 3 co-located** | possession, passive | **+14** | |
| Behavioural profile match | inference, passive | +2 · **−4 on mismatch** | **corroborating only, never sufficient** |
| Camera recognition | passive, narrow | +9 | entry and garage only |

### 4.3 Tiers, and what each authorises

| Tier | Points | Authorises |
|---|---|---|
| **T0 Anonymous** | < 4 | everything comfort — light, climate, scenes. **The house stays pleasant to an unidentified person.** |
| **T1 Probable** | 4–9 | personal scenes, media resume, room preferences |
| **T2 Confident** | 10–17 | messages, calendar, personal data on panels, interior door release |
| **T3 Verified** | **≥ 18 and ≥ 1 active factor** | arm/disarm, external door release, system configuration, energy and financial data |

> **The rule that makes Trinity safe:** T3 **always** requires at least one active factor.
> Carried tags alone never reach T3 no matter how many are present, because a stolen bag contains
> all three. Three of three gives +14 — deliberately one point short of T3 on its own.

### 4.4 Enrolment, revocation, recovery

- **Enrolment** requires T3 from an already-enrolled user, or physical access to the COMP console.
- **Each tag** carries an ID, an owner and a revocation flag. Revocation is immediate and logged.
- **A lost item degrades identity, never locks anyone out** — revoke the tag, the remaining
  factors still work, and the user falls to a lower tier rather than being shut out.
- **Tag technology is mixed (D23): BLE beacons on all three Trinity items, with UWB added to the
  keychain.** BLE gives years of battery and works with the ESP32 proxies already in every Z4; the
  UWB tag on the keychain adds decimetre position for the one item most likely to be carried
  deliberately, in the three rooms that have anchors (§7).
- **The PIN is 6 characters' worth of work on a 4-digit secret (D25).** Four digits is 10 000
  combinations and T3 opens exterior doors and disarms the alarm, so **lockout escalation is
  mandatory, not optional**: a rising delay after consecutive failures — 5 s after three, 30 s after
  five, 5 min after seven, and a logged alert. That costs nothing, needs no extra hardware, and
  closes the only real weakness in the identity model. *A 4-digit PIN without escalation should not
  carry T3 authority.*
- **Recovery is console-only (D27).** No remote recovery path exists in v1: restoring access
  requires physical presence at the COMP console. This is deliberately the most conservative
  option — it means you must be at home to recover, and it means **no external host is a dependency
  of getting back into your own house.**
- **Planned for later:** a provisioned, monitored server as the remote-recovery root, and a
  **Remote Access service card** — a device which, when connected, presents a remote technician as a
  local LAN device for near-on-site support. Both are security-sensitive enough to deserve their own
  treatment: the service card in particular is a deliberate hole in the network boundary and needs
  an explicit authorisation, a time limit, and a log. **Neither is in v1.**

### 4.5 Privacy boundary for the behavioural profile

Non-negotiable, because this is the part that would be indefensible if it were done casually:

- Movement and activity logs live on **MEDIA, never COMP** — COMP is a coordinator and this is
  bulk historical data. They **never leave the house**.
- Retention: **90 days raw, aggregates indefinitely** (D26).
- **One planned export, and its conditions (D26).** A later option to send **locally encrypted,
  identity-redacted** data to a server for development purposes. Three conditions make it
  defensible and all three are required: encryption happens **before** anything leaves the house,
  with a key the house holds; redaction removes **identity and precise timing**, not just names, and
  is verified by inspecting the payload rather than trusting the code; and the export is
  **opt-in per dataset and revocable**, defaulting to off. **Guests are never included under any
  circumstances.**
- The profile is **corroborating only**. It may raise confidence; it may **never** be the basis
  for denying access.
- **Guests are never profiled.** An unenrolled person is T0 and remains T0 — no shadow profile.
- An explicit **no-log mode** suspends behavioural logging on demand.

### 4.6 Failure modes

| Condition | Behaviour |
|---|---|
| Low identity confidence | **degrade to T0, never lock out.** The house remains usable |
| COMP down | the PIN matrix works locally — panel and sub-controller hold a cached credential hash and authorise T0–T2 autonomously |
| Reader tampered | log, alert, **do not disable** — a disabled reader is a denial-of-service on the occupant |
| Behavioural mismatch | −4 points and a log entry. Never an alarm, never a lockout |

---

## 5. Audio that follows (U19)

### 5.1 Trigger on the event, not the level

The portal model that fixed presence also fixes handoff, and for the same reason: **handoff wants
a discrete event, not a continuous level.** RSSI-triggered follow-me systems oscillate at zone
boundaries because they chase a noisy scalar. A counted directional crossing does not oscillate.

| Parameter | Value |
|---|---|
| Trigger | directional portal crossing |
| Confirm | destination zone occupancy for **≥ 8 s** *and* source count falls to 0 |
| Crossfade | **2 s**, overlapping — source down while destination comes up |
| Inter-zone sync skew | **≤ 20 ms** — above roughly 30–40 ms, comb filtering is audible in the overlap at a doorway |
| Transport | Snapcast; all clients share one buffer, so sync is inherent to the protocol |
| Client | ESP32 Snapcast client + Class-D amp in **Z3** per STD-001 §2.2 |

### 5.2 Multi-occupant rules

- House count **= 1** → follow freely.
- House count **> 1** → the stream follows its **identified owner** only, which requires **T1 or
  better**. Without identity, the stream does not follow at all; it stays where it was started.
- **Two identified people diverging** → the stream stays with whoever started it. The other room
  is silent until it starts its own. Never split a stream by guessing.
- **Quiet hours begin at 23:00 (D29).** After that the stream does not follow into sleeping areas
  and levels are capped. Since the bedroom carries no pair at all (§5.3), this mostly governs the
  hall.
- **Audio follows by default (D28)**, excluding the bathroom unless explicitly enabled.

### 5.3 Speaker provision — informing D7

**Follow-me pairs are fitted in living, kitchen, hall and bathroom (H04).** Bedroom and study are
**not** in the follow-me set.

| Room | Follow-me pair | Multichannel |
|---|---|---|
| **Living** | stereo pair, 8 Ω, ceiling | **5.1 at a separate AV position** (STD-007 §2.3) — not in the RoomBox |
| **Kitchen** | stereo pair, ceiling | — |
| **Hall** | single or stereo, ceiling | — |
| **Bathroom** | single or stereo, ceiling, IP-rated | — |
| Bedroom, study | **not fitted** | — |

> **The bedroom is out and the bathroom is in, which is worth noting as deliberate.** It inverts
> what most whole-home audio installs do. The consequence is that **the quiet-hours rule below has
> much less to do** — there is no bedroom speaker to suppress — and that a stream following someone
> to bed simply stops at the bedroom door. If that turns out to be wrong, a bedroom pair is a
> dedicated ARM in conduit that already exists, so it remains a late addition rather than a rework.

**Ceiling for the follow-me layer in every room; wall or floor only where seated, directional
listening actually happens.** Ceiling speakers give even coverage and vanish, which is what a
whole-home layer needs; they give poor stereo imaging, which only matters where someone sits
down to listen. Cable per ARCH-002 §10.5 — dedicated 2 × 1.5–2.5 mm² from the RoomBox to every
position.

**Note a conflict for STD-001:** the amp bay and the lighting drivers both live in **Z3** and
compete for the same volume and the same thermal budget. In RB-L and RB-H this is comfortable;
in RB-M with a full 5.1 amp it is not. Either the amp moves to a dedicated position or RB-M with
multichannel audio steps up to RB-L.

---

## 6. Hardware realities to design around

| Claim | Reality |
|---|---|
| **BLE AoA** | **Not available on ESP32.** Bluetooth direction finding (AoA/AoD, BT 5.1+) requires a multi-antenna array and controller support that ESP32/C6/H2 do not provide. Use **UWB** for true angle and position, **BLE RSSI multilateration** for room/zone, or dedicated locator hardware. The L-pattern's three corners are already the correct geometry for all three — **only the radio changes, not the architecture.** |
| **Acoustic source location** | Needs a **microphone array** with known geometry and TDOA processing. One mic per room gives level and wake-word, not direction. Treat room-level acoustic as a corroborator (+3) and defer true localisation. |
| **WiFi heatmap** | A **commissioning and survey artefact**, not a live modality — unless the intent is a continuously maintained RSSI surface, which is a larger build and belongs with the RF channel plan (U12). Recommend: survey artefact now, live surface later. |
| **WiFi CSI** | Research-grade for home use and chipset-dependent. Published multi-room accuracy is high, but it is model-dominated rather than radio-dominated. **Deploy as a parallel experimental signal at low weight (+3)** and raise the weight only after in-situ validation against a known-truth sensor. |
| **mmWave ghosting** | Real and persistent — fans, curtains, reflective surfaces. The §2.5 graph veto is the structural answer; tuning alone is not sufficient. |

---

## 7. Positioning strategy (confirms U23)

**BLE/WiFi RSSI everywhere as the always-on baseline, UWB anchors in the three L-pattern corners
of key rooms only.**

| Room | Positioning |
|---|---|
| **Entry hall, living, bedroom** | **UWB** — three corners, decimetre (D19) |
| Kitchen, study | RSSI + mmWave zones |
| Bath, WC, pantry, stair | RSSI + portal only |

Every room gets portals regardless. Portals are cheap, and they are what makes the rest work.

### 7.1 The follow pendant (D28)

A small **BLE/UWB pendant** a person can carry deliberately, so the system follows them by choice
rather than by inference. It sits alongside the Trinity items but answers a different question:
Trinity raises *identity confidence passively*, while the pendant is an explicit "follow me."

A later version carries **four buttons and four RGBW indicators** — at which point it is the same
vocabulary as a notification light in a carried form, and **it overlaps both STD-008 and Site
Pager.** Three devices are converging on one indicator language and one radio stack.

> **Unify the indicator language before any of the three is built.** Four RGBW pixels, the hue
> categories of STD-008 §2, and the same rhythm set, whether the thing is in a wall, in a pocket, or
> clipped to a belt. Building three dialects would be the expensive mistake here, and it is entirely
> avoidable by writing the vocabulary down once — which STD-008 §2 has now done.

---

## 8. Commissioning

- [ ] Every portal: verify **direction** both ways, 20 crossings each, and log misses.
- [ ] Every P-2 portal: verify adult / child / pet classification against the actual occupants
      and any actual animals.
- [ ] Verify the **graph veto** — walk a known-empty room's mmWave into a ghost state (a fan and
      a curtain) and confirm the zone does not report occupied.
- [ ] Verify **full reconciliation**: leave the house, confirm every zone resets to 0 within 15 min.
- [ ] Tune each mmWave's sensitivity and zones with the room genuinely empty for 30 min; record
      the false-positive rate before accepting it.
- [ ] Verify each room's **vacancy grace** by sitting still for the full period plus 50 %.
- [ ] Bathroom: verify the humidity/water-flow **hard interlock** blocks release during a shower.
- [ ] Identity: verify **T3 cannot be reached by tags alone** — carry all three Trinity items and
      confirm the tier caps below T3.
- [ ] Identity: verify **graceful degradation** — revoke a tag and confirm no lockout.
- [ ] Identity: verify the PIN matrix authorises T0–T2 **with COMP powered down**.
- [ ] Audio: verify handoff does not oscillate when standing in a doorway for 60 s.
- [ ] Audio: measure inter-zone skew at a doorway; confirm **≤ 20 ms**.

---

## 9. Open items

| Ref | Open |
|---|---|
| **D1** | The zone graph cannot be drawn until the room list exists, and **the habitually-open flags of §2.5 need the plan.** §2.5 is a worked illustration, not this house |
| **D13** | The bed vital-signs silicon. Envelope and conduit reserved (STD-001 §4.1); TI IWRL6432 gives ±5 BPM respiration and ±10 BPM heart rate and needs 20 s stationary, which a bed satisfies continuously — but IWR6843AOP is the likelier part if 2D tracking is wanted too. **Reserve, defer** |
| **D10** *(tuner)* | Panel family and PIN matrix hardware — §4 assumes a 4×3 matrix, a cached local hash and the escalation of §4.4; the product must support all three |
| — | Behavioural ML: nothing here specifies the model, only its boundaries and its weight. Deliberate — the boundaries matter more and should be fixed first |
| — | A second occupant's load cell and thermal array raise consent questions a single-occupant design does not. Worth settling before anything is recorded |
| — | The **Remote Access service card** (§4.4) needs its own treatment before it is built. It is a deliberate hole in the network boundary |
| — | §2.6's bias toward staying-on is reasoned, not measured. **The first month of commissioning is the real test**, and D01 is the adjustment if ghosting appears |

**Closed in r2:** D01 D02 D03 D04 D05 D06 D07 D08 D09 D10 D11 D12 D14 D15 D16 D17 D18 D19 D20 D21
D22 D23 D24 D25 D26 D27 D28 D29 D30. **U12** is now STD-005 §3, which also allocates **ESP-NOW on
channel 1** for the notification swarm. **U3**'s general ladder is STD-006 §1. **U1** is STD-004 §1,
and the portal reference is `P33.POR.R02.R03` with direction implied by the order.
