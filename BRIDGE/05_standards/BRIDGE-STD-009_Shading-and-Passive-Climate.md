# BRIDGE-STD-009 — Shading and Passive Climate

**Doc:** BRIDGE-STD-009 · **r1** · 2026-10-10 · English
**Parent:** BRIDGE-STD-006 §1.1 / §1.3 (ladder, shutter hold-off) · BRIDGE-STD-004 §3 registers
24–31 (shutter channels) · BRIDGE-STD-001-A2 steps 1 and 8 (shutter and sensor ARMs)
**Origin:** feature 4 of the 2026-10-10 proposals, accepted as **K37** ("write it up")
**Scope:** how motorised shutters are used as climate equipment. When they close for heat, when
they open for free heat, how they defer to people, and how they work alongside floor heating,
the klíma and the lighting. P33 is the worked instance in §9.

> **Figures marked *reasoned* are typical values or calculations, not measurements.** The sun
> geometry in §1.2 is calculated for Budapest. The thresholds in §2 are starting values to be tuned
> at commissioning. Glazing areas for P33 are not yet known.

---

## 0. The standard in one page

**An external shutter is the cheapest climate equipment in the house.** It stops solar heat
*before* it reaches the glass. The klíma can only remove that heat afterwards, at a cost. The
motors, the relays and the wall switches are already specified, so this standard adds almost no
hardware. What it adds is **rules**.

Six rules carry it:

1. **Decide by the room's thermal need, not by the calendar.** A room that needs heat opens to the
   sun. A room heading over its comfort limit shades. Everything else stays open for daylight (§2).
2. **Shade before the sun arrives, not after the room is hot.** On a hot day, a façade closes when
   the sun is about to reach it. Waiting for the room temperature to rise means the heat is already
   stored in the floor and walls (§3).
3. **An occupied room is never closed by automation during the day.** `SLIT` at most. A shutter
   that forces the lights on at noon has failed (§2.3).
4. **A person's hand always wins, until the next sunrise or sunset.** This is the hold-off rule that
   already exists in STD-006 §1.3. Nothing new is invented here (§4).
5. **Never use a shutter against floor heating.** In winter the floor anticipates the sun. The
   shutters do not throw the free heat away (§6.1).
6. **Shading is comfort, not safety.** If COMP is down, shutters hold their position and the wall
   switches still work. No RoomBox runs sun logic on its own (§7).

---

## 1. Why shutters, and which façade matters

### 1.1 Where the heat is stopped decides everything

Solar gain through a window is roughly **Q ≈ A × I × g × F꜀**:
- A: glazing area
- I: irradiance on the façade
- g: the glass's solar factor
- F꜀: what the shading lets through

**External** shading stops the radiation outside the glass. **Internal** blinds and curtains stop it
inside the room, where the heat is already in the air, so they help with glare but do little for
temperature. A motorised redőny is external, which is why it is worth automating.

*Reasoned example:* 6 m² of west glazing on a clear summer afternoon, I ≈ 500 W/m², g ≈ 0.5 gives
**≈ 1.5 kW** of gain. With an external shutter at F꜀ ≈ 0.2 it drops to **≈ 0.3 kW**. A klíma
drawing 1.2 kW delivers roughly 3.5 kW of cooling. **Unshaded, that one window takes about 40 % of
the klíma's capacity.**

### 1.2 The sun at 47.5° N

Calculated for Budapest in local clock time (DST in summer). "On the façade" means the sun is above
3° and more than 10° away from the wall's plane. *Beam* is a relative clear-sky exposure (unit beam
× incidence × hours). It ignores the atmosphere, so it flatters low winter sun slightly, but the
ranking holds.

| Façade | 21 Dec | 21 Mar | 21 Jun | 21 Sep | Beam: Dec / Jun |
|---|---|---|---|---|---|
| **East** | 08:00–10:55 | 06:15–11:10 | 05:15–12:00 | 06:50–11:55 | 1.5 / **4.8** |
| **South** | 08:00–15:25 | 06:45–16:55 | 09:30–16:00 | 07:35–17:35 | **6.3** / 2.2 |
| **West** | 12:25–15:25 | 12:35–17:30 | 13:30–20:15 | 13:20–18:20 | 1.5 / **4.8** |
| **North** | — | — | before ~07:00 and after ~18:30, grazing | — | ≈ 0 / small |
| *Noon altitude* | *19°* | *42°* | *66°* | *43°* | |

**Three findings drive the rest:**

- **South regulates itself.** It gets about three times more sun in December than in June, because
  the high summer sun strikes the glass at a steep, mostly reflected angle. A south façade needs
  shading mainly in late summer and early autumn. In winter it is the house's free heater.
- **East and west do the opposite.** They get the most sun in summer, at a low angle that goes
  straight into the room. A partly lowered shutter cannot stop it, because low sun enters through
  the bottom of the window.
- **West is the overheating façade.** Its sun arrives when the outdoor air is at its daily peak and
  the building has been warming all day. East sun arrives into a building that has cooled overnight.
  **If a house has only one façade to automate, it is the west one.**

---

## 2. The decision

### 2.1 Three modes per room, from its thermal need

Each room computes one mode. It comes from the room's own temperature and the forecast. It never
comes from the date, because a sunny March afternoon can overheat a west room while a cold June
morning can want gain.

| Mode | Enter when (*reasoned starting values*) | Leave when | Sun-facing shutters do |
|---|---|---|---|
| **GAIN** | there is heating demand: room < heating setpoint + 0.5 K | room > setpoint + 1.5 K | **open** while the sun is on the façade · close at dusk to insulate |
| **NEUTRAL** | neither of the others | — | **open** for daylight, apart from the glare rule (§6.5) |
| **SHADE** | room > upper comfort − 1 K **and** sun on the façade, **or** pre-emptive per §3 | room < upper comfort − 2 K, or the sun has left the façade | **SLIT** if occupied · **CLOSED** if vacant |

Starting values: heating setpoint 21 °C (bedroom 19 °C), upper comfort 25 °C (bedroom 24 °C at
night). The 1 K hysteresis gaps keep the system from hunting. They are configuration values, not
part of the standard.

**Cloud.** SHADE is entered only when the façade is actually receiving significant sun. Use the
local irradiance if measured (above ≈ 200 W/m² on the façade), otherwise forecast cloud cover below
≈ 60 %. Re-opening after a cloud waits until the façade has been below the threshold for
**20 minutes**. One passing cloud must not move eight motors twice.

### 2.2 Positions

| Position | What it is | Used for |
|---|---|---|
| **OPEN** | fully up | daylight, gain, view |
| **SLIT** | fully down, then reversed for a short calibrated time so the slat gaps open | shading in an occupied room · night ventilation with security |
| **CLOSED** | fully down, slats compressed | shading a vacant room · night insulation · privacy |
| *manual* | anywhere | whatever the person chose |

**SLIT depends on the curtain profile.** Most aluminium roller-shutter slats have light gaps that
open when the curtain is not compressed. Some profiles do not. Check the profile before relying on
SLIT. Without it, an occupied room in SHADE stays OPEN and the klíma does the work. That is a worse
result, but it is the correct one.

**No intermediate "half-down" automatic positions.** For the reason in §1.2, they rarely stop the
sun on east or west façades. They also drift, because a timed position loses accuracy with every
partial move (§5.3). People may set any position. Automation uses three.

### 2.3 Occupancy is the second axis

**Occupied (STD-003 fusion score above the room's threshold):** daytime automation never goes past
SLIT. The first automatic SHADE move of the day in an occupied room gives one **blue pulse**
(STD-008 §2, environment) on the room's NTL. The person then knows why the room went dim and can
override.

**Vacant:** SHADE goes to CLOSED. A vacant room needs no view, and it is where most of the saving
is made.

**House empty** (K35, the leaving check): every room is treated as vacant. On a hot day the whole
sun-facing side goes CLOSED, and the house comes back cool without the klíma having run.

---

## 3. Timing — shade before the sun arrives

Shading a room after it is warm is too late. The heat is already in the walls and the floor
screed, and it keeps coming out for hours. **On hot days a façade closes before the sun reaches it.**

**Pre-emptive SHADE**, per façade:
- **Condition:** forecast maximum ≥ **27 °C** (*reasoned*) **and** the façade's sun-on time per §1.2
  starts within **60 minutes**.
- **Action:** vacant rooms behind that façade go CLOSED. Occupied rooms go SLIT if their temperature
  is already above upper comfort − 2 K. Otherwise they wait for the normal §2.1 trigger.

What that means for each façade:

| Façade | On a hot day | What to watch |
|---|---|---|
| **West** | closes from ~13:00 in summer, the main event | coincides with peak outdoor temperature. Highest value |
| **East** | at dawn, from ~05:00 in summer | do not wake anyone. A bedroom on the east is usually already CLOSED for the night and simply stays closed until the wake rule (§6.6) |
| **South** | late morning to mid-afternoon, mostly July–September | the low autumn sun is the real south problem. Mid-summer is mild |
| **North** | never | — |

**Without a forecast** (no internet, §8.1), the condition falls back to the previous day's measured
outdoor maximum. If there is no outdoor sensor either, it falls back to geometry plus the room's
temperature trend. The fallback is cautious: it shades a little too readily rather than too late.

---

## 4. Where shading sits on the ladder

Every behaviour in this standard is declared to the arbiter (STD-006 §1.0) with a domain, a scope
and a tier. Nothing here is new to the ladder. It fills in the shutter rows.

| Behaviour | Tier | Scope |
|---|---|---|
| Up/down interlock, motor end limits | **P0** | the motor. Hardware, never software |
| Life-safety alarm → raise designated escape-window shutters (§6.7) | **P1** | declared escape windows only |
| Wall switch, group switch, panel | **P2** | that shutter or group |
| App, voice | **P3** | — |
| Scene ("cinema", "night") | **P4** | per scene |
| Occupancy limit (§2.3), wake rule (§6.6) | **P5** | the room |
| Dusk privacy and insulation close, morning open | **P6** | the room |
| GAIN / SHADE / pre-emptive, floor-heating anticipation | **P7** | the room, plus any declared cross-room scope (§9.3) |

**Hold-off is unchanged:** after a manual action a shutter holds **until the next sunrise or sunset,
at most 8 h** (STD-006 §1.3), and nothing releases it early. That rule fits this standard exactly:
a person who opens a shaded window to see the garden keeps their view until the evening.

**Provenance** records every automatic move with its mode and trigger ("SHADE pre-emptive · forecast
29 °C · west sun in 40 min"). That is what answers "why did the shutter close?" (feature 5,
STD-006 §1.6).

---

## 5. Protecting the hardware

### 5.1 Wind

A roller shutter that is fully down sits locked in its guides and tolerates far more wind than one
that is partly down, where the curtain can flutter and pull out of the guides. So, above the
product's wind class (EN 13659):
- **No automatic move into or out of an intermediate position.**
- A shutter that is OPEN or CLOSED stays as it is.
- SLIT counts as "down" and stays.

External venetian blinds and awnings are the opposite: they retract. That case is not in P33 and
will be when the terrace (R12) gets an awning.

### 5.2 Frost

A curtain frozen to the sill or into the guides strains the motor and can tear the slats. **Automatic
moves are inhibited** when the outdoor temperature ≤ **+1 °C** with precipitation in the last
12 h, or ≤ **−3 °C** in any case (*reasoned*). **Manual moves are not inhibited.** They are P2, they
pass through hardware, and the person can see the shutter.

### 5.3 Duty and position

- **Duty.** Tubular motors carry a thermal cut-out and a short rated run time, typically a few
  minutes. Automation is limited to **6 automatic moves per shutter per day** and **30 minutes
  minimum between moves**. Group commands are **staggered by 0.5 s** per motor, which spreads the
  inrush and stops eight motors from starting with one bang.
- **Position.** It is estimated from travel time, timed separately for up and down. The estimate
  resets at every full-travel end stop. Because automation only uses OPEN, SLIT and CLOSED, which are
  end stops or one short reverse from an end stop, the estimate is reset on almost every move.
- **Motor choice.** Use a **wired 230 V tubular motor** with its own end limits and obstacle
  detection, driven by the RoomBox's interlocked relay pair and its wall switch (A2 step 1:
  NYM-J 4 × 1.5, M20). **Not radio-only motors.** A motor that only obeys its own remote cannot take
  the relay pair, so manual-first would move into a proprietary handset.

---

## 6. Working with the rest of the house

### 6.1 Floor heating — anticipate, never fight

A screed floor responds in **hours** (*reasoned* 2–6 h). The sun responds in minutes. Without
coordination, a sunny winter afternoon on a west or south room overshoots: the floor was charged in
the morning, then the sun arrives as well.

**The rule:** when the forecast shows strong sun on a room's façade within the next ~4 h and the
room is in GAIN, **the floor heating lowers that room's target in advance** (*reasoned*: 0.5–1 K
setback). The shutters stay open and harvest the sun. The floor gives way.

**Never close a shutter in winter to correct a floor overshoot.** That throws away the free heat to
hide a control error. The fix belongs in the floor's anticipation.

Both behaviours are P7 and act on different domains, so the ladder never sees them conflict.
Coordinating them is a matter of **one shared forecast input**: the shading service publishes "sun
expected on façade X from t₁ to t₂" and the floor controller reads it. **The floor heating control
itself is a separate document**, waiting on K42 (§10).

### 6.2 Klíma

- **Shading first, klíma second.** The klíma's cooling setpoint sits above the shading trigger, so
  a correctly shaded room often never starts it.
- **Window open → klíma off** in that room after 60 s, using the frame contacts that are already
  specified. Blue on the NTL, logged. Cooling an open window is the most common waste in a
  climate-controlled flat.

### 6.3 Night cooling

On a summer evening, when the outdoor temperature falls **≥ 2 K below** a warm room (above upper
comfort − 1 K), the room's NTL-ST shows **blue, slow breathe**: open a window. Windows in P33 are
manual, so BRIDGE suggests and the person acts. When a frame contact reports the window open, the
shutter goes to **SLIT**: air through, view blocked, and a visible deterrent. The shutter closes
again at the next pre-emptive time.

### 6.4 Daylight and lighting

A shutter closed by automation in a lit room by day is the classic failure of naive shading. §2.3's
occupancy limit (SLIT at most) prevents it. When a room is SLIT and occupied, the light scene is
**not** brought up automatically. The person decides whether it is too dark, through the normal
P2 path.

### 6.5 Screen glare

When the room's screen is on and the sun is low (below ≈ 25°) on a façade that reflects onto the
screen, that window's shutter goes to SLIT for the duration (P5). "Screen on" comes from the media
player's state, or from the AV position's own circuit metering (K36). Which window reflects onto
which screen is set per installation at commissioning.

### 6.6 Bedrooms, dusk and morning

- **Dusk (P6):** at civil dusk, or when the room's lights come on after sunset, all shutters go
  CLOSED, for privacy and insulation. Presence simulation (K35) may vary the time by ±20 min when
  the house is empty.
- **Morning:** living spaces open at sunrise + 30 min unless in SHADE. **Bedrooms do not open on a
  timer.** They open on the **wake rule (P5)**: first sustained movement after the night, or the
  person's alarm time. An east bedroom on a hot day simply stays CLOSED through the dawn sun.

### 6.7 Alarms

- **Intrusion:** shutters unchanged. Moving them tells an intruder something and protects nothing.
- **Life-safety:** shutters on **declared escape and rescue windows** are raised while mains is
  present (P1, announced as STD-006 §1.2 requires).
- **On mains loss, a motorised shutter stays where it is.** If a window is a designated rescue
  opening, its motor needs a manual override, or that window stays manually operable. **Confirm
  with the electrician what OTSZ asks here, in the same conversation as C29** (stair emergency
  luminaires).

---

## 7. Failure

| Lost | Shutters |
|---|---|
| **COMP / the arbiter** | hold their position. **Wall switches work** (relay pair in Z1, P2). No sun logic runs anywhere. **This is deliberate:** shading is P7 comfort, so it gives no room an autonomy requirement (STD-004 §4) |
| **Forecast / internet** | the §3 fallbacks: yesterday's maximum, then geometry plus the temperature trend |
| **Outdoor sensor** | forecast only. Wind and frost protection then come from the forecast and are more cautious |
| **A RoomBox** | its shutters stop wherever they are. A relay held on runs the motor to its own end limit, so nothing is left half-driven |
| **Mains** | everything stays as it is (§6.7) |
| **On reconnect** | COMP **adopts** the actual positions, never reasserts the old ones (STD-004 §3.8) |

---

## 8. Inputs and wiring

### 8.1 Three tiers of weather input

| Tier | Source | Gives | Needs |
|---|---|---|---|
| **1 · Geometry** | sun position, calculated on COMP (HA's `sun` integration) | which façade is lit, when | nothing, always available |
| **2 · Forecast** | a weather integration (e.g. met.no, no key) | max temperature, cloud cover, wind | internet |
| **3 · Local mast** | an ESPHome node outdoors: temperature (shaded), global irradiance or lux, anemometer | measured values, plus wind and frost protection that do not depend on the internet | one sensor ARM |

**Tier 1 + 2 is enough to commission and run.** Tier 3 makes it accurate and independent of the
internet.

**The mast** is an ordinary sensor point: LiYCY 4 × 0.5, **M16** (A2 step 8). Position: open sky
for the irradiance sensor, the temperature probe in a shaded, ventilated screen, never on a sunny
wall.

### 8.2 Per window

- **Shutter ARM:** NYM-J 4 × 1.5, M20 (A2 step 1). One relay pair per motor in Z1, up/down
  interlocked in hardware (STD-006 P0). One shutter channel in STD-004 registers 24–31. **A RoomBox
  carries at most 8.**
- **Frame contact:** already specified per window (STD-001 §4).
- **A wall control per motor or per group.** Manual-first applies to motors as much as to lamps.
  A shutter with no physical control is not allowed.

**This standard adds no conduit beyond the mast's sensor ARM.**

---

## 9. P33 — the worked instance

### 9.1 Two opposite façades

The flat runs through the building, so its glazing sits on **two opposite façades**:

| | Façade A | Façade B |
|---|---|---|
| **Rooms** | R07 szoba · **R06 nappali, double-height glazing with a lower and an upper shutter** · the klíma · R09 above (upper floor) | R02 konyha · R03 étkező · possibly R01 (the plan asks "redőnyház?") |
| **Shutters** | R06 **4+** (lower and upper rows) · R07 **2** · R09 **2** (K03) | R02/R03 per the survey, **≥ 2** · R01 **?** |
| **Box** | RBX06 (R06, R07) · RBX09 (R09, later) | RBX03 |

**The compass bearing is still open (K43).** "The glazing faces right" places it on the drawing; in
the BRIDGE sheets façade A is on the left, and in the 180°-turned frame of the P33 test plans it is
on the right. Shading needs the **compass** direction. Because the façades are opposite, one number
settles both:

| If façade A faces | A (R06, R07, R09) | B (R02, R03) |
|---|---|---|
| **West** | **the overheating façade.** R06's upper shutter is the main lever from ~13:00. R07 shades in the afternoon, no conflict with sleep | east: morning sun into the kitchen. Pre-emptive CLOSED only if R02/R03 are vacant |
| **East** | dawn sun into R07: closed for the night anyway, opens on the wake rule. R06 morning shading | **west: kitchen and dining, the worst room in the flat**, with cooking heat plus afternoon sun. B becomes the priority |
| **South** | **the winter heater**: R06's two-storey glazing in GAIN mode is the largest free heat source in the flat. Summer shading is mild, mostly August–September | north: nothing to do |
| **North** | nothing to do apart from dusk and night | south: winter gain into R03, autumn glare at the table |

### 9.2 The R06 split — the finding

R06's double-height glazing has **two rows of shutters, lower and upper** (the client's plan:
"redőny alsó + felső"). That gives this room something no other room has: **it can shade and keep
its view at the same time.**

- **SHADE, occupied:** **upper CLOSED, lower OPEN or SLIT.** The upper row catches the high sun and
  the hot air that would rise into the void. The lower row keeps the view and the daylight at eye
  level. §2.3's "SLIT at most" applies to the **lower** row only. The upper row has no view to lose.
- **GAIN:** both rows open. The upper glazing sends winter sun deep into the room and onto the back
  wall, where the floor and the masonry spine store it.
- **The upper row is out of reach by hand.** It needs its own wall control. The R06 group switch
  therefore gets three keys: **lower · upper · all** (P2).

### 9.3 The void carries R06's heat into R09

The ~4.5 m void over R06's glazing is open to R09 across the railing (K12). Heat that gets past
R06's upper glazing rises straight into R09's air, under a sloped roof that is already the warmest
surface in the flat.

**So R06's upper shutter is declared with a cross-room scope: R06 and R09.** It enters SHADE when
*either* room needs it. Until R09 is fitted, the void's top temperature comes from **one wireless
temperature sensor** (Zigbee or Thread, battery) placed high on the void wall near the railing.
**No conduit, nothing to build in now.** When RBX09 exists, R09's own sensor takes over.

### 9.4 Channel budget — checked

| Box | Shutters | Of 8 |
|---|---|---|
| RBX06 | R06 4 + R07 2 | **6** — so R06's "4+" can be **at most 6** before RBX06 runs out of channels |
| RBX03 | R02 + R03 (+ R01?) | ≤ 4 expected |
| RBX09 | R09 2 (+ R12 awning later) | 2–3 |

**R03's group control.** The client marked a "redőnyök vezérlő egység" (shutter control unit) on
R03's façade wall. That is a **P2 group switch** wired to RBX03's inputs: all façade-B shutters,
plus individual keys. It is an ordinary SWI endpoint at the 1100 mm switch height.

### 9.5 The mast at P33

Final position: **R12 terrace**, the only place with open sky. Its sensor ARM comes from RBX09 with
the upper floor, so it is provisioned with that work and needs nothing now. **Until then P33 runs
on tiers 1 and 2** (§8.1), which is enough.

### 9.6 Floor heating is coming (K42)

The client will install floor heating, home-controlled. §6.1's anticipation is written for it. **The
control design waits for three facts** (§10). The plan also shows a **new radiator in the kitchen**,
which suggests a hydronic system already exists.

---

## 10. Commissioning

- [ ] Time every shutter **up and down separately**, plus the SLIT reverse time. Record them in the
      node's configuration.
- [ ] **P0:** command up and down together. Only one relay may energise.
- [ ] Each wall control, group key and the R06 **lower / upper / all** keys move the right motors.
- [ ] Hold-off: move by hand at noon. No automatic move until the next sunset.
- [ ] Occupied limit: force SHADE with the room occupied. The shutter stops at SLIT, the NTL pulses
      blue once.
- [ ] Frost and wind inhibit with simulated inputs. Manual still works.
- [ ] Kill COMP. Shutters hold, wall controls work. Restore COMP: positions are adopted, not
      reasserted.
- [ ] **Measure, don't argue:** on the first hot week, log room temperature and klíma energy with
      shading on, then off, on comparable days. *This is the number that sells the feature.*

---

## 11. Open

| | Item | Blocks |
|---|---|---|
| **K43** | **Compass bearing of façade A** — one number, B follows | §9.1's choice of row |
| — | R02 / R03 shutter count · does R01 get one ("redőnyház?") | RBX03's channel count |
| — | Glazing areas per window | the gain estimate per room |
| — | Curtain profile: does it have a SLIT position? | §2.2 for occupied rooms |
| — | Escape and rescue windows, and their manual override (with C29) | §6.7 |
| **K42** | **Floor heating:** hydronic or electric · heat source · manifold (osztó-gyűjtő) position · which rooms | the floor heating control document, and §6.1 |
