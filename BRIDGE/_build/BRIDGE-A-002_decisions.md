# BRIDGE-A-002 — Round 2 decisions

**Source:** `BRIDGE-Q-002 r2`, answered 2026-10-05, **141 / 141**.
**Status:** 117 settled · 24 held open · **16 new design threads opened by the notes.**
This is the authoritative record. Standards 001–007 are revised against it.

---

## 1. What changed in the standards

Only the answers that move something. Everything not listed here confirmed what was drafted.

### STD-001 Physical

| Ref | Decision | Change |
|---|---|---|
| **B01** | Raise every class to **110 mm** minimum | Depth becomes uniform. **RB-S survives as a separate shallow design** for edge cases and special purposes, not as a standard class |
| **B08** | **Two spares, M25 + M20** | Replaces the single M32. Two independent futures rather than one large one. Bundle becomes C1 M25 · C2 M40 · C3 M20 · C4 M25 · C4b M20 · C5 M20 |
| **B10** | Install the **C5 conduit empty** even without KNX | Cheapest time is now. Bundle order still never shifts |
| **B22 + E11** | Typed codes, **three letters** | `LMP` lamp · `SOC` socket · `SWI` switch · `SEN` sensor · `SPK` speaker · `SHU` shutter · `PAN` panel · `CAM` camera · `THR` thermostat · `UEP` universal. Resolves the S-collision by width rather than by cleverness |
| **B24** | Two UEPs minimum, four in RB-L | As drafted |
| **B25** | 15 m, **but up to 22–24 m needs no pull box on a straight run** | Interval becomes bend-count-driven rather than distance-driven. Reworded: a pull point every ~15 m *or* where a third bend would accumulate, extending to ~24 m where the run is straight and unobstructed |
| **A05** | Keep the colour code, **add hatch patterns** | Every layer needs a line style as well as a hue, so a monochrome print reads |
| **A08** | **You install throughout, including mains** | Register shifts: the documents are written for the person holding the tools. See §4 |
| **F04 note** | **2–3 dedicated circuits feed the whole system**, at least one through a remotely operable breaker | Adds to the cabinet schedule in STD-001 §3 and STD-004. Provides redundancy even if only one is used |

### STD-002 Light

| Ref | Decision | Change |
|---|---|---|
| **C08 note** | Keep the 2700 + 4000 K pair, **add a 6500 K channel for night scenes** | A third channel used at very low level reads as moonlight. This is a *scene* channel, not a white-mixing channel, so it does not reopen the chord problem — it sits outside the tunable pair and is driven independently |
| **C15** | Hold-off runs its **full duration** | No early release on vacancy. An override survives you leaving the room |
| **C17** | Central assured pack, **plus an emergency/backup connector slot** | A documented hardpoint for a portable or replacement pack |
| **C09** | Tunable white in **living, bedroom, kitchen, study** | Bathroom fixed-CCT |
| **C06 note** | Ra ≥ 90 stands, **document the Ra ≥ 80 variant and what it costs** | New subsection: what widens, what visibly degrades |
| **C28 note** | Ten scenes, **with the five-core and per-room-custom variants documented** | |

### STD-003 Presence

| Ref | Decision | Change |
|---|---|---|
| **D01** | **P-1 default**, P-2 selectively | **Consequential — see §4.** P-1 gives direction but not count, so the graph holds a weaker constraint |
| **D08** | Reconciliation at **30 min** | |
| **D10** | **All grace periods longer** | |
| **D21** | **Loosen** the state thresholds | |
| **D11** | Apollo R PRO-1, with LD2410/LD2450 and EP1 documented as alternatives | |
| **D12** | mmWave in living, bedroom, kitchen, hall/stair | **Bathroom and study not selected** — see §4 |
| **D15** | **No cameras indoors.** Order of preference: none → entry only → entry+garage+workshop. Optical-avoidant by design, **but provision conduit and positions for a full CCTV installation** | New subsection: camera-ready provisioning without cameras |
| **D16** | CO₂ in bedroom, kitchen, study | **Living not selected** — see §4 |
| **D19** | UWB in entry hall, living, bedroom | |
| **D23** | **Mixed** — BLE on all three Trinity items, UWB added to the keychain | |
| **D25** | **4-digit PIN** | See §4 — I would pair this with lockout escalation |
| **D26 note** | 90 days local, **plus a later option for locally encrypted, identity-redacted export to a development server** | |
| **D27** | Console-only recovery now, **transition to a provisioned server later** | |

### STD-004 / 005 / 006 / 007

| Ref | Decision | Change |
|---|---|---|
| **E06** | Heartbeat loss → autonomy at **5 s** | Was 3 s |
| **G05** | Provenance retention **90 days** | Was 30 |
| **G06** | **The arbiter is its own service**, HA as a client | Architecturally significant and now settled |
| **H01** | **Full MEDIA pack**, basic documented as the alternative | Resolves D3 |
| **H03 note** | Add a third speaker method: **powered Bluetooth speakers, and USB-A Bluetooth Rx/Tx sticks** | New subsection in STD-007 §2 |
| **H04** | Follow-me pairs in **living, kitchen, hall, bathroom** | **Bedroom and study not selected** — see §4 |
| **H05 note** | 5.1 in the living room, **with a 7.1 variant designed** | |
| **H06 note** | Joinery void, **combined with the media-wall cable path** — see thread 13 | |
| **H08** | Gaming occasionally, not competitively | AOC direct stays the default; HDMI-over-IP acceptable outside the gaming position |
| **H11** | USB data at **study/desk and the living media wall** | Everywhere else is charging only |
| **A03** | **Full parallel Hungarian translation** | The largest commitment in this round — see §4 |
| **A07 + E02 + B28** | As-builts, the conduit schedule and the renumber guard all **live in the Planner** | Three Planner work items |

---

## 2. Held open — 24 items

Grouped by what resolves them, because several are the same question wearing different clothes.

**Blocked on the passive-airflow design (thread 2).** `B04` zone order · `B05` RF column position ·
`B07` fill cap · `B26` screed cover. Zone order and vent area cannot be settled before the airflow
path is drawn — the answer to B17 determines all four.

**Blocked on the reference images (thread 4).** `C23` linear lighting types · `C23B` feature and
outdoor types · `C10` three-channel fixtures · `C11` binning · `C13` colour rooms. You asked to be
reminded to task me with the image library; these five wait on it.

**Blocked on the DALI comparison (thread 15).** `C20` and `C01` dimming curve — the curve decision
differs depending on whether DALI gear is in the system.

**Needs one more exchange, no dependency.** `A06` labels *(noted: sleeve now, thermal transfer
later — I will write it that way unless told otherwise)* · `B02` row pitch *(both 125 and 150 "for
different cases" — needs the rule for which case)* · `B09` fibre · `B14` cover finish *(both
variants documented — same treatment as A06)* · `D02` P-3 openings · `D07` disagreement window ·
`D09` open-door merge · `D14` thermal array · `E03` baud · `E10` CAN pair · `H10` Snapcast placement
*(I would keep this open deliberately until it can be tested under load)*.

**Needs its own research.** `D13` the bed sensor — see thread 5.

---

## 3. Sixteen new design threads

| # | Thread | From | Scale |
|---|---|---|---|
| **1** | **Notification Lights** — a universal visual signalling layer | D17 | **A standard of its own. Written: STD-008** |
| **2** | **Passive airflow** — a layout of empty pipes circulating air through a RoomBox by convection alone | B17 | STD-001 r2 §2.6. Gates four open items |
| **3** | **6500 K moonlight channel** — a scene channel outside the tunable pair | C08 | STD-002 r2 §5 |
| **4** | **Reference image library** — example photographs per lighting type, hyperlinked, subfoldered | C23 | New folder + index. **You asked to be reminded** |
| **5** | **Bed vital-signs unit** — an inline space above the bed for TI mmWave | D13 | Research done, see below. Needs an envelope in STD-001 |
| **6** | **CCTV-ready, camera-free** — full provisioning, no cameras fitted | D15 | STD-003 r2 |
| **7** | **Audio triangulation + voice control prep** | D17 | STD-003 r2 §6 |
| **8** | **Redacted development telemetry** — locally encrypted, identity-stripped export | D26 | STD-003 r2 §4.5 |
| **9** | **Remote Access service card** — a device that presents a remote technician as a local LAN device | D27 | New concept note. Security-sensitive |
| **10** | **Follow pendant** — BLE/UWB, later interactive with four buttons and four RGBW indicators | D28 | Overlaps Site Pager and STD-008 |
| **11** | **System mains provisioning** — 2–3 dedicated circuits, one remotely operable | F04 | STD-001 r2 §3 |
| **12** | **Bluetooth and USB speaker integration** | H03 | STD-007 r2 §2 |
| **13** | **Media-wall cable path** — a large-diameter inline route or parapet trunking joining two 10×10 or 15×10 flush boxes, so user devices reach the TV without clutter behind it, sized to pass an HDMI connector | H06 | STD-007 r2 §5 + STD-001 envelope |
| **14** | **7.1 variant** | H05 | STD-007 r2 §2.4 |
| **15** | **DALI with and without** — a real comparison, treated as a special rather than a baseline | C20 | New comparison note. Gates C01 and C20 |
| **16** | **Hungarian parallel set** — every standard in both languages | A03 | Ongoing, large |

### Thread 5 — what the research says

**TI IWRL6432**, 60 GHz, low-power, with a vital-signs demo shipped in the Radar Toolbox at
`source/ti/examples/Medical/IWRL6432_Vital_Signs`. Quoted performance: **±5 BPM respiration,
±10 BPM heart rate, over a 60–110 BPM range**, and the accuracy holds **only when the subject is
stationary for more than ~20 seconds.**

Three conclusions:

- **Above a bed, the stationary requirement is an advantage, not a limitation.** This is the one
  position in the house where the condition is satisfied continuously. The part is well matched to
  the application.
- **±10 BPM on heart rate is a trend instrument, not a clinical one.** It will show that a rate rose
  overnight; it will not tell you it was 62 rather than 72. Respiration at ±5 BPM is the more useful
  of the two signals, and respiration is what sleep staging mostly leans on anyway.
- **"2D presence tracking" and "vital signs" may want different silicon.** IWRL6432 is the low-power
  vital-signs part; the **IWR6843AOP** (antenna-on-package, 60 GHz) carries the people-tracking and
  point-cloud demos as well. For a combined bed unit the 6843 family is the likelier fit, at higher
  power and cost. Worth settling before an envelope is cut into the wall.

The physical ask — a reserved inline space above the bed — costs almost nothing now and is
impossible later, which makes it exactly the kind of provision the architecture exists to make.
**Recommend: reserve the envelope and the conduit, choose the silicon later.**

---

## 4. Six things I want to flag

**1 · A08 — you are installing the mains yourself.** Recorded, and the documents will be written for
the person holding the tools. One practical fact rather than an objection: a fixed 230 V installation
in Hungary still needs a qualified sign-off and a measurement record
(*érintésvédelmi/szabványossági felülvizsgálati jegyzőkönyv*) for insurance and for any later sale,
whoever did the physical work. Worth lining up the certifying electrician early, because they will
want to see the design — and a design this documented is unusually easy to certify.

**2 · A03 — full parallel Hungarian doubles the document set.** Seven standards become fourteen, and
every future revision is two edits. It is the right call if anyone else will ever build from these;
it is expensive if they are only for you. A middle path exists and I will not adopt it without being
asked: translate the four that a contractor actually holds — Physical, Light, Media, and the SELV
standard that already exists in Hungarian — and keep Naming, Network and Behaviour in English, since
their content is protocol and register maps that nobody translates anyway.

**3 · D01 + D10 + D21 together bias the system toward staying on.** Individually each is reasonable.
Combined — portals that give direction but not count, longer grace everywhere, and looser thresholds
— they make false-occupied much more likely than false-vacant. That is a coherent preference, and
probably the right one for a home: being left in the dark is a worse failure than a light burning an
extra ten minutes. But it does weaken the **graph veto**, which was the structural cure for mmWave
ghosting, because a P-1 portal cannot supply the count the veto depends on. **If ghosting shows up
in commissioning, D01 is the first thing to revisit.**

**4 · Three rooms lost a sensor I would have kept.** `D12` leaves **bathroom** without mmWave, yet
RB-3 exists chiefly to serve it and STD-003 specifies a steam-tolerant radar there with a humidity
interlock — without it, bathroom presence rests on a door contact. `D16` leaves **living** without
CO₂, which is the room where people sit still longest and where the slow-but-certain signal is worth
most. `H04` omits **bedroom** from the follow-me pairs while including the bathroom. Each may well be
deliberate; I am flagging them rather than quietly overriding.

**5 · C05 is internally contradictory.** You selected media room and living **and** "none — I do not
film indoors." The note resolves the intent — these are ambient-effect spaces, not filming spaces —
so I will treat **media room and living as CCR-capable for visual effect, without holding them to
camera-grade flicker specification.** Correct me if that is the wrong reading.

**6 · A 4-digit PIN carries T3 authority.** D25 chose four digits without the lockout escalation that
option C bundled in. Four digits is 10 000 combinations, and T3 opens exterior doors and disarms the
alarm. **Recommend adding escalation regardless** — a rising delay after failures costs nothing and
removes the only real weakness in the identity model.
