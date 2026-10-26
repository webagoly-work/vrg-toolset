# Round 2026-10-22 — decisions

## Answered (2026-10-22, in chat)

| # | Question | Answer |
|---|---|---|
| D1 | Meglévő / bontás: own layer or an attribute on every device? | **Own layer.** Its solo view is the demolition sheet. |
| D2 | Gyengeáram: one layer or split (TV/data · doorbell/intercom)? | **One layer; the endpoints decide the purpose.** |
| D3 | Which optional layers are on by default? | **Gyengeáram** only. Kültér, EPH, Okos előkészítés off. |
| D4 | Promotion to BRIDGE: one click or only at creation? | **One click** on an existing Villany Stack. |
| D5 (Q-V05) | Kültér: layer or zone? | **B, zone** (room kind *kültér*, ordinary SOC / LIGHT layers), **plus a suggested 2-pole MCB** for outdoor circuits (V7 suggestion, not forced). |
| D6 (Q-V03) | `exist` (and `sys:BOND`) in BRIDGE too? | **A, yes** — **plus two new layers: Riasztó (cablework only) and Tűzvédelem (cable only, dedicated red wire pairs).** Details Q-V08…Q-V10. |
| D7 (Q-V01) | Gyengeáram colour | **Bright blue.** Clash with BRIDGE blues → Q-V11. |
| D8 (Q-V04) | Meglévő items in the totals | **Removed → a *Bontás* line; not removed → an *Ellenőrzés* line.** Replace → Q-V12. |

## Open (A recommended)

**Q-V02 — `hw` role in a Villany Stack.** Reuse the key with an elec name, or a new key?
- **A** reuse `hw`, shown as *Betáplálás és elosztás*, offering only board · meter · entry (+ new EPH bar and
  earth electrode). The engine already finds the board there; promotion keeps the layer.
- B a new `supply` key; the engine and 05x cabinet learn it; promotion moves the devices to `hw`.


**Q-V06 — What the promotion does with `route`.**
- **A** path kind decides: conduit between fixed points → `channel`, single-line runs to endpoints → `arm`; the
  `route` layer stays as junction-box holder only if it still has boxes, else it is removed.
- B `route` simply becomes `channel`; ARM starts empty.

**Q-V07 — The promotion's Gyengeáram split.**
- **A** devices move by code to their BRIDGE role layer (ETH → Adat / PoE, SCR · AVP · TVA → Média, SMK · DBL →
  Biztonság…); `sys:WEAK` is removed when empty. Same mechanism as the 2026-10-10 Erősáram split (`stkMigrateRoles`).
- B `sys:WEAK` stays in BRIDGE as a layer of its own.

**Q-V08 — Riasztó vs BRIDGE's Biztonságtechnika.** BRIDGE already has `sys:SECURITY` (devices + SSC star).
- **A** Riasztó is the elec-stack face of the same system: new role `sys:ALARM`, cable runs from the alarm panel
  to each detector point, reusing the SECURITY codes (MOT, DWC, GLB, SRN, KPD, PNC) flagged *csak kábelezés* —
  no device material, only box + cable + labour. On promotion its items move to `sys:SECURITY`.
- B an independent layer in both kinds; BRIDGE then has Riasztó and Biztonságtechnika side by side.

**Q-V09 — What moves to Tűzvédelem.** V4 put SMK (smoke detector) on Gyengeáram.
- **A** new role `sys:FIRE`: SMK, a new heat detector, manual call point, sounder — cable only. SMK and COA leave
  the Gyengeáram list. A battery standalone smoke alarm (no cable) stays a Gyengeáram / SECURITY item.
- B Tűzvédelem holds only the cable runs; detector points stay where they are.

**Q-V10 — The fire cable.** "Dedicated red wire pairs".
- **A** default J-Y(St)Y 2×2×0.8 red, own conduit family `FIRE` (never shares a conduit with anything, MAINS
  included); a per-project switch to fire-resistant JE-H(St)H … E30/FE180 when the system needs function
  maintenance.
- B J-Y(St)Y red always; fire-resistant cable not offered.

**Q-V11 — Colours.** Bright blue Gyengeáram sits next to Érzékelők (#2f79c9) and Kezelőfelületek (#5470b0) in
BRIDGE, and the obvious Tűzvédelem red is already Dugaljak (#c62828).
- **A** Gyengeáram bright blue (#1e9bff) on the panel and on every symbol of the layer; on promotion the moved
  items take their BRIDGE layer colour. Tűzvédelem a deep crimson (#8e0f2b) and always drawn with the dash-dot
  pattern on screen too, so it never reads as a socket line. Riasztó keeps the Biztonság grey.
- B you pick the three colours.

**Q-V12 — Cserélendő (replace) in the totals.**
- **A** a *Bontás* line for the old item and the new item counted as material from its design layer (no double
  count — the replace mark only adds the demolition).
- B replace counts as Bontás only; the new item must be drawn separately.

## Answered (2026-10-26, in chat)

The user chose **"Build Villany Stack first"**, which took every open question at its recommended answer:
**Q-V02 A, Q-V06 A, Q-V07 A, Q-V08 A, Q-V09 A, Q-V10 A, Q-V11 A, Q-V12 A.**

Two choices made while building, for the user to confirm:

| # | Choice | Why |
|---|---|---|
| B1 | Meglévő / bontás is **on demand** in a BRIDGE stack (`opt:['bridge']`), always there in a Villany Stack. | Q-V03 A keeps the layer in BRIDGE; making it a default would add a layer to every existing BRIDGE stack and plan. |
| B2 | Each ordinary system's "Elosztó" is a hardware node on Betáplálás és elosztás: **MDB** gyengeáramú elosztó, **TJK** tűzjelző központ, **EPH** fő EPH sín; the riasztóközpont is the existing **SSC**. | Q-V02 A names the hw layer as their home. The earth electrode is not built. |

## Added on the user's request (2026-10-26)

| # | Request | Built as |
|---|---|---|
| U1 | A layer on both stacks for the everyday alarms and detectors of the rooms that need them (konyha, fürdő, kazánház, pince). | `sys:HAZARD` **Veszélyérzékelők**. On by default in a Villany Stack, unticked in the BRIDGE wizard, and kept on promotion. Codes: **GAS** (földgáz high / PB low), **WLK** water leak, **HTA** stand-alone heat alarm, **VLV** motorised shut-off valve, plus **COA** (alt from Biztonság). Room needs: konyha GAS · WLK · HTA, fürdő WLK, gépészet (kazánház, pince) GAS · COA · WLK · VLV. |
| U2 | Switch-sensors: a lamp with one needs no other switch. A normal switch beside it is *Kizárás* or *Szabotázs* (OFF / AUTO, AUTO / ON). | Two SWI variants, **pir** (wall motion switch, 1100) and **pres** (presence sensor with relay, 2200), type `erzekelo`. A normal switch on the same leg is never its váltó partner; it gets a mode (switch RCO): **Kizárás = KI / AUTO**, wired in series before the sensor; **Szabotázs = AUTO / BE**, wired in parallel with the sensor's output. Shown beside the switch; the Világítás check asks for a mode. |

**Answered 2026-10-27: Q-U2 = B — the name stays "Szabotázs" (the user).** The question was: In alarm work *szabotázs* means tamper, so a reader of the
plan may misread it.
- **A** keep **Kizárás** for KI / AUTO, rename AUTO / BE to **Kényszer BE** (forced on).
- B keep *Szabotázs* as asked.
- C another name of your choice.
