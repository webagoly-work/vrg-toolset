# BRIDGE-E-002 — Briefing on the held-open items

**For:** the 24 items marked *unsure* in round 2.
**Shape of each entry:** what the question actually is · what each choice changes · what I would do.

**Five are already answered elsewhere.** **B04** zone order, **B05** RF column position and **B07**
fill cap are closed by [STD-001-A1 Passive Thermal](../05_standards/BRIDGE-STD-001-A1_Passive-Thermal-Design.md)
— the airflow path decides all three, and each now has a physical reason rather than a convention.
**C23** and **C23B** are handed to [the reference image folders](../06_reference-images/README.md),
because they are decisions you make by looking, not by reading.

That leaves nineteen.

---

## A06 · Label hardware

**What it is.** Thermal transfer uses a heated print head to fuse resin into the label material —
the print is *in* the surface, and survives solvents, UV and abrasion for decades. Laser print in a
clear sleeve is toner on paper behind plastic: fine in a cabinet, but the sleeve yellows and the
paper wicks moisture at the cut ends.

**What changes.** Nothing, for anything you can reach. Everything, for anything you cannot.

**Your note says sleeve now, thermal later — and there is a flaw in that order.** The labels that
most need to survive are the ones applied **before the walls close**, and those are exactly the ones
you can never go back and replace. A conduit label behind plaster has to be legible in 2046.

**Recommend: split by access, not by date.** Thermal transfer for anything buried, plastered over,
or inside a sealed box. Laser-in-sleeve is genuinely fine for cabinet rows, patch panels and
anything behind a door you can open. That costs one spool now and removes the only irreversible
part of the decision.

---

## B02 · Row pitch, 125 or 150 mm

**What it is.** The vertical spacing between DIN rails. 125 mm is the consumer-unit standard: 45 mm
of device face plus 80 mm for wiring and bend radius. 150 mm gives 105 mm of wiring space.

**What changes.** 150 mm makes stiff cable and tight bend radii much easier to work, and costs you a
row in the same envelope — an RB-M at 500 mm internal height takes four rows at 125 and three at 150.
Fewer rows means less gear or a bigger box.

**You said "both, for different cases," which is right. Here is the rule that makes it coherent:
pitch follows what sits on the row.**

| Row contents | Pitch |
|---|---|
| Terminals, compact modules, the sub-controller | **125 mm** |
| **The PSU row** | **150 mm** — it is the deepest, hottest, and has the stiffest cable |
| Any row with full-depth DIN gear fed from both sides | 150 mm |

**Recommend: 125 mm default, 150 mm for the PSU row.** Which means each class gets a stated row map
rather than a uniform pitch. It also interacts with the thermal annex in your favour — a taller box
is a taller chimney.

---

## B09 · A dedicated fibre conduit to each RoomBox

**What it is.** Fibre earns its place for three things: beyond 10 Gb, electrical isolation over long
runs between buildings, and severe EMI. Inside a dwelling, Cat6A carries 10 Gb to 55 m and
10GBASE-T to 100 m.

**What changes.** Almost nothing. Fibre to a RoomBox solves a problem a house does not have — the
room switch uplink is 1 Gb and the devices behind it are a PoE AP and a panel.

**The real fibre case is somewhere else entirely:** if the BASE layers are split and MEDIA ends up
in a different part of the house, the **NET ↔ MEDIA** link may want fibre or 10 GbE. But that is a
**LAYER TIE** conduit, not a RoomBox conduit — a different run with a different justification.

**Recommend: no dedicated fibre.** C4 with a draw cord pulls fibre in an afternoon if you ever need
it, and you now have two spares (C4 M25 + C4b M20) from B08. Reserve the fibre question for the
LAYER TIE instead.

---

## B14 · Cover finish — flush or visible

**What it is.** Flush paintable disappears into the wall. A visible service panel reads as technical
and is findable.

**What changes.** Findability in fifteen years, and nothing else. A flush box in a plastered wall is
genuinely invisible, which is wonderful until someone needs it and the only record is a drawing.

**You asked for both as documented options. The rule: finish follows the space.** Flush in living
spaces — bedroom, living, hall. Visible panel in utility spaces — pantry, garage, plant position —
and anywhere access is frequent.

**Two mitigations make flush safe**, and you have both already: **A07** puts the as-built photographs
in the Planner keyed to the room, which is the only thing that makes a flush box recoverable; and
**STD-008's NL-ND** sits beside the box as a status indicator, which incidentally marks where it is
without looking like equipment. A discreet light is a better find-aid than a panel.

**Recommend: flush in living spaces, visible in utility, as-built record mandatory either way.**

---

## B26 · Conduit cover in screed, 25 or 30 mm

*Correcting myself: I grouped this with the airflow items in the decision record. It is unrelated —
it is a floor coordination question.*

**What it is.** How much screed sits above the conduit, protecting it from screws, drills and point
loads.

**What changes.** 25 mm is the usual minimum and 30 gives margin. But the binding constraint is not
the number — it is **what else is in the screed.** A typical floating floor is 60–70 mm of screed
over insulation. An M25 conduit with 25 mm cover needs 50 mm above the insulation, which fits
comfortably.

**Underfloor heating changes everything.** Its pipes occupy the same zone, and the conduit must run
*below* them — at which point the total depth gets tight very fast, and a 30 mm cover requirement
may simply not be available.

**Recommend: 25 mm as the rule, verified against the actual buildup room by room — and where
underfloor heating is present, the conduit goes in the insulation layer beneath the screed rather
than in the screed at all.** That is the real answer: it is a coordination item with the heating
design, not a dimension to pick.

---

## C01 · Dimming curve — and why it was waiting

**What it is.** All three options exist to make the slider feel linear, and differ only in where the
maths lives. `s³` follows CIE L* lightness and is the most perceptually accurate. Gamma 2.2 is close
and familiar from displays. The DALI logarithmic curve is what DALI gear implements natively, in 254
steps of about +2.8 % each.

**Why it was gated on C20.** If DALI gear is in the system, using its native curve means the gear
and your own PWM channels agree without a per-fixture correction table. If there is no DALI, `s³` is
strictly better and the correction table never needs to exist.

**C20 resolves below to "no DALI for v1."**

**Recommend: `s³` — option A.** Revisit only if DALI is added later, and then only to decide whether
to emulate its curve or correct it.

---

## C10 · Three-channel locus-tracking fixtures

**What it is.** A two-channel tunable white traverses a straight chord in colour space while the
Planckian locus curves, so a wide pair sits below the locus at mid-mix and reads pink. A third
channel — amber, or a third white — lets you pull back onto the curve and widen the range.

**What changes.** It is only worth paying for when one fixture must reach both a very warm and a
very cool extreme.

**Your own C08 answer makes this moot.** You chose the 2700 + 4000 K pair, which stays inside
tolerance across its whole travel, **plus a separate 6500 K channel for night scenes**. That 6500 K
channel is already doing the wide-range job, as an independent scene channel rather than as part of
the white mix — so it never enters the chord and never needs correcting.

**Recommend: nowhere — option D.** The moonlight channel covers the use case more cheaply and more
controllably than a three-channel fixture would.

---

## C11 · Binning tolerance

**What it is.** SDCM — standard deviation of colour matching, in MacAdam ellipse steps. One step is
just detectable to a trained eye in ideal conditions. **Two steps is invisible in practice.** Three
is visible as a step when two fixtures sit side by side on a white surface. Five is visible
generally.

**What changes.** Supply and price. ≤ 2 SDCM is normal for quality product and widely stocked.
≤ 1 SDCM is a specialist order, often with long lead times, a premium, and a single-reel commitment.

**Where it matters is narrower than it sounds.** The eye compares *adjacent* things. On a continuous
cove or under-cabinet run, two segments one bin apart are directly comparable and the step shows. In
separate downlights in a dark ceiling, nobody ever notices.

**Recommend: ≤ 2 SDCM — option A.** The discipline already in STD-002 §9.1 does most of the work for
nothing: **one bin, one reel, one room.** Ordering a continuous run from a single reel removes the
comparison entirely, whatever the bin. And one photograph in `_bad-examples/` of a visible step will
tell you more than this paragraph.

---

## C13 · Which rooms get a colour accent layer

**What it is.** RGBWW fixtures where saturated colour is wanted on top of white.

**What changes.** Cost and complexity per fixture, for a capability that gets used far less than
people expect. In practice colour is used for occasional scene effect in a living or media space,
very low-level night orientation, and outdoor or seasonal work. It is essentially never used in a
kitchen or a bathroom.

**STD-008 changes this answer.** The main honest use of colour in a house is *communicative* — telling
you something. The notification layer now owns that job properly, with a fixed vocabulary, in every
room and at every doorway. So the architectural lighting no longer needs to carry it.

**Recommend: living and media room only.** Everything communicative goes to the notification layer,
where it will be more legible and far cheaper than tinting a cove.

---

## C20 · DALI, with and without — the comparison you asked for

**What DALI-2 DT8 buys.** Individual addressing of every fixture over one bus pair. Dimming and
colour without a dedicated control conductor per fixture. **Lamp-failure reporting** — the fixture
tells you it has failed. Scene storage in the gear itself. One two-core bus for dozens of fixtures
instead of a switched live each.

**What it costs.** A DALI driver premium of roughly €10–25 per fixture; a DALI bus power supply; a
gateway at NET; and real commissioning work — every fixture must be addressed and grouped, and that
is a day's fiddling on a house this size, repeated whenever a fixture is replaced.

**The crossover by fixture count.** Counting the reference dwelling: about **15 controlled mains
fixtures** across the three boxes, plus about **10 low-voltage runs**. DALI would not touch the LV
runs — BRIDGE drives those directly from Z2, more cheaply and with a better curve. So the question is
about 15 points, which sits right at the usual 15–25 crossover. On count alone it is a coin toss.

**But count is not the deciding factor, and here is the argument that settles it.**

> **A DALI driver has no bistable memory element.** The ζ/η manual-first guarantee in the Smart
> Switch standard is implemented *in hardware* — a bistable relay the load follows, fed by both the
> manual switch and the RF side, degrading to a clean manual circuit when the intelligence dies. A
> DALI fixture has none of that. Manual-first on DALI would have to be re-implemented in firmware,
> which is precisely the thing the doctrine exists to avoid.

And **you have already chosen C30 = A**: a bistable relay per lamp in Z1. Which means **you keep the
relay regardless** — so DALI's single largest benefit, replacing per-fixture switching wiring, is
foreclosed before the comparison starts. What remains is "a nicer dimming protocol," and PWM and
0–10 V already provide that.

**Recommend: no DALI in v1 — exactly your instinct.** Treat it as special. Two things keep the door
open at near-zero cost: **the C5 or C4b conduit can carry a DALI pair later**, and the ARCH-002
§4.2 gateway position at NET stays reserved. If fixture count ever doubles, or if lamp-failure
reporting becomes worth real money, it is an addition rather than a rebuild.

---

## D02 · Which openings get P-3

**What it is.** P-3 is a portal plus mmWave plus a thermal array — for openings where crossings are
complex: two people abreast, a wide cased opening with no door, a landing where routes converge.

**What changes.** P-3 resolves simultaneous and ambiguous crossings that P-2's two ToF sensors
confuse. Everywhere else it is money for nothing.

**One opening genuinely needs it: the entry door**, because it is the only edge to the outside and it
**anchors the whole house count.** Every other zone's number is derived from it, so an error there
propagates everywhere.

**Recommend: entry door only — option A.** Add the hall↔living opening only if it is a wide cased
opening rather than a door; a doored opening forces single file and P-2 handles it.

---

## D07 · Sensor–graph disagreement window

**What it is.** How long a room's sensor evidence must contradict the graph's occupant count before
the sensor is believed and the graph corrected.

**What changes.** Short (30 s) recovers quickly from a missed crossing but churns when a sensor is
briefly wrong. Long (120 s) is stable but can leave a room wrongly vacant for two minutes with
someone sitting in it.

**Your other answers decide this one.** You chose **P-1 portals** (direction but no count),
**longer grace periods** and **looser thresholds**. All three mean the graph will be wrong more
often than the drafted design assumed — so recovery speed matters more than stability.

**Recommend: 30 s — option B.** It is the compensating adjustment for D01.

---

## D09 · When a held-open portal merges its two zones

**What it is.** A door standing open makes two rooms one space, and the portal can no longer count
crossings through it. Merging treats them as a single zone until it closes.

**What changes.** Never merging leaves counts drifting whenever a door is open. Merging after two
minutes means that in a normal home — where interior doors stand open most of the time — most of the
house is one merged zone most of the time, which loses all per-room resolution.

**The real insight is that some openings should not be portals at all.** If the hall↔living door is
permanently open or has no door, modelling it as a portal that merges and un-merges is fighting the
building. Draw those two as **one zone from the start**, and put the portals only where doors
actually get closed — bedroom, bathroom, WC, pantry, entry.

**Recommend: 5 minutes — option A, plus a per-opening flag.** Openings that are habitually open are
drawn as single zones in the graph and get no portal. That decision needs the plan, so it lands with
**D1**.

---

## D13 · The bed vital-signs unit

**What it is.** A mmWave radar above the bed reading respiration and heart rate, and ideally 2D
presence, as the foundation for sleep monitoring.

**What the research says.** TI's **IWRL6432** at 60 GHz ships a vital-signs demo in the Radar
Toolbox: **±5 BPM respiration, ±10 BPM heart rate**, over 60–110 BPM, and the accuracy holds only
when the subject is **stationary for 20+ seconds**. Above a bed that condition is satisfied
continuously — this is the one position in the house where the part's main limitation does not apply.

**Three things to know before committing.** ±10 BPM on heart rate is a **trend instrument, not a
clinical one** — it will show that a rate rose overnight, not whether it was 62 or 72. Respiration at
±5 BPM is the more useful of the two signals, and sleep staging leans mostly on respiration anyway.
And **"2D tracking" and "vital signs" may want different silicon**: IWRL6432 is the low-power
vitals part, while **IWR6843AOP** carries the people-tracking and point-cloud demos as well, at
higher cost and power.

**What changes.** Nothing architectural. The ask — a reserved inline space above the bed — costs a
box and a conduit now and is impossible later.

**Recommend: reserve the envelope and the conduit, defer the silicon.** A flush box above the bed
centreline with a SELV pair, a signal pair and a spare conduit — which is simply the Melléklet 1/A
stub-out, already specified. Nothing else is needed until the part is chosen, and by then the
category will have moved.

---

## D14 · Thermal array

**What it is.** An 8×8 or 32×24 grid of thermopile pixels — a very-low-resolution thermal camera.
It gives occupant **count and rough position with no recognisable image**. AMG8833 class is cheap;
MLX90640 gives real resolution for modestly more.

**What changes.** It is the privacy-compatible way to get most of what a camera would give.

**Two of your other answers point straight at it.** **D15** chose no cameras indoors and an
optical-avoidant design — which makes the thermal array the obvious substitute where count or fall
detection matters. And **D12** left the **bathroom without mmWave**, even though RB-3 exists chiefly
to serve it. A thermal array tolerates steam better than most optical sensors and gives fall
detection, which is the one genuinely valuable safety function in a bathroom.

**Recommend: bathroom only — option C.** And note it **partly repairs the D12 gap**: with no mmWave
there, the thermal array becomes the bathroom's primary presence sensor rather than a supplement,
which is a better outcome than the door contact that would otherwise be carrying it alone.

---

## E03 · BRIDGE_LINK baud rate

**What it is.** 38400 gives about 50 ms per node and a 400 ms cycle for eight nodes. 19200 doubles
the cycle to 800 ms and roughly doubles the noise margin. 57600 cuts it to about 270 ms with less
margin.

**What changes.** Less than it looks. **Nothing time-critical rides this bus** — manual switching is
local hardware, and events are latched in the node's ring buffer so a slow cycle delays *reporting*
rather than losing anything. The only visible effect of 800 ms would be slightly laggier follow-me
audio handoff, and even that is dominated by the 8-second confirmation window.

RS-485 at 38400 over Cat6A at domestic distances is unremarkable; the rate becomes marginal in the
hundreds of metres, not the tens.

**Recommend: 38400 — option A.** Drop to 19200 only if commissioning shows CRC errors, which it
should not.

---

## E10 · CAN on pair 2

**What it is.** Pair 2 of the BRIDGE_LINK cable is allocated to a second RS-485 or to CAN. The
question is what to do with it now.

**What changes.** Reserving it costs nothing — you simply do not terminate it. Wiring it now means
terminating and commissioning a bus with no device on it. Dropping it means using pair 2 for a
second RS-485 segment instead.

**CAN's advantages over Modbus are event-driven messaging and multi-master. The event ring already
solves the first**, which is most of why CAN looked attractive.

**Recommend: reserve, install nothing — option A.** And a note worth recording: if you ever run out
of channel capacity (more than eight nodes on one run), **a second RS-485 segment on pair 2 is a far
more likely use than CAN.**

---

## E11 · Three-letter type codes

You said three letters. Here is the set, with the rule that keeps it extensible: **three letters,
uppercase, mnemonic, no collisions, and never abbreviate two things to the same code.**

| Code | | Code | |
|---|---|---|---|
| `LMP` | luminaire | `CAM` | camera |
| `LNR` | linear / LED run | `ACP` | access point |
| `SOC` | socket outlet | `THR` | thermostat |
| `SWI` | wall switch | `SHU` | shutter motor |
| `SEN` | sensor point | `POR` | portal |
| `SPK` | speaker position | `NTL` | **notification light** (STD-008) |
| `PAN` | panel / HMI | `UEP` | universal endpoint |
| `DIS` | zone distributor | `ACT` | actuator, other |

So `CLA.R03.LMP2` and `CLA.R05.NTL1`. **`A` for ARM and `C1…C5` for conduits keep their short forms**
— STD-001 already prints `R<room>-C<n>` on every conduit label, and changing that would invalidate
labels.

---

## H10 · Where the Snapcast server runs

**What it is.** On MEDIA it shares CPU, memory and disk I/O with transcoding and continuous NVR
writes. A dedicated node — a Pi 5 or a small x86 — isolates it for roughly €60–100 and one more
thing to keep patched.

**What changes.** A 4K transcode saturating the box can starve the audio pipeline, and the symptom
is the follow-me layer stuttering or dropping mid-track. It would be intermittent, correlated with
someone else watching something, and genuinely unpleasant to diagnose after the fact.

**Recommend: keep it open deliberately — option C, test under load.** This is the one item I would
rather not decide on paper. The test is cheap and conclusive: run the worst-case transcode the house
will actually see, concurrent with multi-room audio, and listen. If it holds, you have saved the
hardware and the maintenance. If it stutters, you have learned it before it was load-bearing. Either
way the answer is specific to your hardware rather than to a general principle.

---

## What is now closed

Of the 24 held open: **19 have a recommendation above**, **3** (B04, B05, B07) are closed by the
thermal annex, and **2** (C23, C23B) are waiting on photographs rather than on reasoning.

**Four of the nineteen were decided by answers you had already given**, which is worth noticing —
C01 by C20, C10 by C08, C13 by STD-008, and D07 by D01. The set was more interconnected than it
looked, and a few of these were never really separate questions.
