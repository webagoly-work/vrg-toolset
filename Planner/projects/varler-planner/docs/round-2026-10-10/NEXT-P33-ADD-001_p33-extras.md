# NEXT — P33-ADD-001: P33 extras to add to the layer stack (after round 2026-10-10)

Status: **queued — start only after round 2026-10-10 is built (all 16 WPs) and the user has looked at
it.** Analysis, then a short pack (like this round's), then build — the same method. Not analysed in
depth yet: this file is the user's note (2026-10-10, a phone note image) transcribed faithfully, with
a first mapping onto the stack so the next session does not start cold.

## 0. The user's convention

> Items ending with **\*** are **client-requested**. Everything else is **optional**: pre-wired /
> wireway-prepared, bound to the room or the home, but only built after the client confirms.

So every non-\* item is a **provisioned** endpoint: conduit and box in place, device absent, often
hidden behind the wall paint. WORKSHOP-001 §7's "provision on purpose" (`SPARE`) is the existing
concept to build on; IDEA-002's flush-cover standard decides what the hidden box looks like.

## 1. The items (the user's words, lightly tidied), with a first mapping

| # | Room | Item | \* | Layers / codes it touches (first guess) |
|---|---|---|---|---|
| 1 | Nappali | RGB + lux based CCT colour-sensor light control driving the **redőny** (circadian simulation) | | SENSOR new variant (colour / lux: ESPHome `tcs34725`, `as7341`, `veml7700`) · MAINS→LIGHT `SHU` (M1) · automation, not wiring |
| 2 | Fürdő | **Three cavities behind the tiles in the shower area**, each holding a **capacitive-touch SELV "invisible button"**, reached by three arms; pattern e.g. **1 left + 2 right** wall, sides **70–80 cm** apart, at **arm's length** to each other, **≈ elbow height** | **\*** | HMI new code (through-tile touch: ESPHome `mpr121`, `cap1188`, `esp32_touch`) · LV / CONTROL cable per cavity · wet-zone rules ⚑ (MSZ HD 60364-7-701: SELV source outside the zones) |
| 3 | Fürdő | Optional: an **IP-rated SELV display**, flush and inline at **eye level** in the shower — user content, messages from trusted family devices, **intercom / notification board** (doorbell); the capacitive buttons work as a **rotary** (enter · up · down) to drive a menu, even under the shower | | HMI display variant (ESPHome `lvgl`, `ili9xxx`, `mipi_spi`) · DATA + LV · ties to `DBL` (S5) for the doorbell event |
| 4 | Home | Optional, **default inactive but already wired, endpoint hidden behind the paint**: pre-made positions for an **ESPHome controller / panel display terminal** next to **every portal**, in the **kitchen**, and next to the **nightstand switches** — flush space with **DC LV power in + a data line**, for a flush or a surface-box touchscreen later | | HMI `PAN` new variant `prep` (provisioned, hidden) · LV + DATA · the ≈1300 smart band (WORKSHOP §7) · needs a "provisioned / hidden" endpoint state in the model |
| 5 | Home | **Lábfény** (foot-level light) in a horizontal zone on selected wall sections, built in **two versions: either whole sections light up …** | | LV `LNR` new variant · a horizontal wall strip in Jelölés (`hstrip` mark) · **the note is cut off here — ask for the second version** |
| 6 | Konyha + étkező, fürdő (optional: nappali, háló) | **Central heating with floor-heating areas** | | Jelölés: floor zones that **forbid floor routing** (WORKSHOP route type F runs SELV/data in the floor — conflict!) · HMI `THR` per zone · SENSOR floor probe (ESPHome `dallas_temp`) · ask: hydronic loops or electric mats? |
| 7 | Konyha / étkező | The **island** has a **heavy-load circuit** and a **downdraft ventilator** on top | | MAINS→DED (K20: induction hob, already known) · **no fan / extractor endpoint code exists** (10-09 handover: modelled as an LMP output) → new code |
| 8 | Konyha | Optional: a **phone charger with a built-in phone holder**; also research **wall holders for phones used as room control panels**, using the flush space left for them | | LV `UEP` `usbc` variant · HMI · research |
| 9 | Home | **Research:** cheap options for **ultra-low-current, battery-powered wireless** sensors / devices for spots wired means cannot reach | | research → feeds S5's `zb` variants and SENSOR (ESPHome `deep_sleep`; Zigbee / Thread / Matter end devices) |
| 10 | Home | **Multisensor-based automation of the air extractors** | | SENSOR (humidity / VOC / CO₂: `sht4x`, `bme680`, `sgp4x`, `scd4x`, `ens160`) + the new extractor code from #7 (ESPHome `fan`) |
| 11 | Home | **Research: what "BRIDGE SECURITY" would look like** — *not* the SECURITY stack layer: an **ESPHome / Home Assistant / client-owned fleet** that makes the home a self-controlled system. **Do not base it on the Trinity items** (STD-003 carried identity tags) — they build on top of this base. | | research document first (like IDEA-001/002), then a decision pack |

Component names above were checked against CoreRef (ESPHome 2026.9.1): all exist except a
dedicated "speed_fan" (use `fan` + an output). HA core has `generic_thermostat`, `zha`, `thread`,
`matter`; it has **no** `intercom` integration — the intercom board of #3 is our own design.

## 2. Open questions for the user (ask before the pack)

1. **#5 lábfény** — the note ends at "either whole sections light up …": what is the second version
   (a moving / following light, segments by presence, …)?
2. **#6** — hydronic floor-heating loops from the central heating, or electric mats? (It decides
   whether there is a MAINS circuit per zone, and how hard the floor-routing ban is.)
3. **#11 vs S5** — round 2026-10-10's S5 already turns the SECURITY *layer* into a Home Assistant /
   ESPHome catalogue (with Alap / Prémium tiers). Is BRIDGE SECURITY (a) the system-level design that
   S5's device catalogue serves, (b) something wider (resilience, self-hosting, fleet management,
   local-only control) of which security is one part, or (c) a replacement for S5?
4. **#2** — exact heights: "elbow height" in a shower ≈ 1000–1100 mm for an adult standing; one
   height or per user?
5. **#4** — one terminal position per portal on **both** sides of the door, or the room side only?

## 3. What the stack model is missing for these (known now)

- A **provisioned / hidden endpoint** state (#4, and every non-\* item): counted for conduit and
  boxes, excluded from device BOM, drawn dashed, listed separately for the client
  ("előkészítve, ügyfél-jóváhagyásra vár").
- A **client-requested flag** on endpoints (the user's \*), shown in the symbol and the client preview.
- A **fan / extractor** endpoint code (#7, #10).
- A **through-tile capacitive input** endpoint (#2) and an **IP display** endpoint (#3).
- **Floor zones that forbid floor routing** (#6) — a mark kind or a mark tag the router reads.

## 4. How to run it (after round 2026-10-10)

```
TASK: ANALYSE + PRESET docs/round-2026-10-10/NEXT-P33-ADD-001_p33-extras.md for the Planner stack.
Read it, docs/PRIMER.md, docs/round-2026-10-10/README.md (what was built), docs/stack/README.md,
BRIDGE/BRIDGE-PRIMER-001 (main checkout) and STD-003 for Trinity. Ask the §2 questions first.
Then write a pack in docs/round-p33-add-001/ in the same format (contract, material, WPs, decisions),
research items as IDEA documents. Build nothing.
END — analyse and preset only.
```
