# Classical electrical plan: review of an interior designer's method vs the Planner

*2026-11-06. Source: Instagram carousel by @meginteriormentor ("Electrical plan, step by step", 10 slides,
posted 2026-06-01): https://www.instagram.com/p/DZC3u2ijxMK/. The source images are not ours and are not kept in the repo.
This note only summarises them and works out what they mean for us.*

**Why now.** The user's direction (2026-11-06): **the Planner's first implementation is classical electrical work.** BRIDGE
uses the same Planner, but for other purposes and later. A classical plan is where the Planner can hold nearly all the
information. This review looks at how a working interior designer documents a classical plan, and at what the Planner
should produce, accept and check because of it.

---

## 1. What the post shows

The author is an interior designer who runs a mentoring account. The project is a renovated apartment. The plan
labels are Polish ("okno wym. … hp …"), the callouts are English, and it was drawn in ArchiCAD. The 10 slides:

| Slide | Content |
|---|---|
| 1 | Cover |
| 2 | The finished plan (full sheet, ~45 callouts at the margins) |
| 3 | **Step 1: Legend.** It must fit the country, use symbols contractors know, and describe every symbol. "One legend doesn't fit all projects." |
| 4 | **Step 2: Furniture background.** The furniture layout is copied from the functional plan and turned light grey, so it stays visible without taking over, and sockets and lights can be placed against it. |
| 5 | **Step 3: Copy the existing points** (sockets, switches, lights) from the inventory/developer plan. You need to see what exists, what stays, and what is modified or removed. |
| 6 | **Step 4: Design.** Kept points are black, new and changed points are red, unneeded points are removed. **Lighting first**, then sockets and switches. |
| 7 | **Step 5: Control logic ("crucial").** Which lights are connected, how they are controlled, and from where. Letters go on lighting points and on switches. Choose single, two-way or multi-way switches and main-switch scenarios. "Real planning, not guessing." |
| 8 | **Step 6: Dimensions and heights.** Every point is dimensioned from a wall corner to its axis and has a height. There are standard heights for the whole apartment, and **only deviations are written on the plan**. **Step 8: Notes**: what changed, plus special instructions. Clear notes mean fewer calls from contractors. (There is no Step 7; the numbering skips it.) |
| 9 | **Think beyond sockets:** AC units, speakers, kitchen appliances, built-in equipment. If it needs power, it goes on the plan. |
| 10 | Summary: visible, measured, described. Offers the DWG legend for a comment. |

The caption makes the main point: **lighting design comes first.** Decide what kind of light each room needs, where it
goes, the mood, and how the client lives there. The technical side follows from that. "Every socket should have a
reason, every switch a logical place, every light point an intention."

## 2. Close reading of the plan (slide 2, at full resolution)

What the drawing actually does, beyond what the slides say:

1. **Control labels are room number + letter.** In bedroom 5 the lamps are tagged `5c`, and the switch beside the bed
   is tagged `5a,5b`. In the kitchen and living room the groups run `1a…1f`. A switch lists every group it controls,
   and a lamp shows the one group it belongs to. The contractor can wire the room from the labels alone, with no
   wiring lines drawn. Outdoor/terrace points are tagged `ext.1`, `ext.2`.
2. **Height on each point:** `H=40 / 60 / 90 / 110 / 120 / 135 / 150 / 180 / 210 / 220 / 271`. In practice many
   points carry one, even though the slide says only deviations should.
3. **Dimensions in red, in cm, from the nearest wall corner or face to the box axis.** This is done per point, not as
   chains along the building.
4. **Multiplicity marks** (`x2`) beside socket symbols, and grouped symbols (`3|3|3`) for multi-gang frames.
5. **Callouts sit at the sheet margin with long leaders.** They use a small, repeated vocabulary of change types:
   - *Set location without changes* (keep)
   - *Set location without changes – double socket instead of single* (upgrade in place)
   - *Set – change of location* / *… + one new switch* (relocate, sometimes with an addition)
   - *Ceiling lamp – change of location* / *Ceiling lamp – new* / *New wall lamp over the bed*
   - *Switches – different combination, location without changes* (rewire logic, box stays)
   - *Preparation for an electric heater – heater built-in*, *Speakers – preparation for installation*
   - *Cable 1 m long from the floor to install sockets on the side of the island*, *… hood and micro on the island*
   - *New cable for LED stripe under the cabinets – sensor*, *… in the shower shelves – hermetic cover*
   - *2 new spots inside the suspended ceiling*, *Cable for LED light on the suspended ceiling shelf*
   - *Electric box – without location change – preferably hidden in the cabinet*
   - *2× single hermetic socket + double switch*
6. **Wet rooms** get hermetic (IP44) sockets, a mirror light and electric heater preparation, and the bathroom switches
   are placed outside.
7. **What the sheet does not have:** circuits, protection (MCB/RCD), cable routes or chases, the board schedule,
   quantities, and any check. It is a **design-intent and change sheet for the contractor.** Everything technical is
   left to the electrician.

### Her legend (slide 3), mapped to our Hungarian codes

Her switch names are the US terms, and one description is unclear. This is the mapping for our knowledge base
(the codes are never renumbered):

| Her term | What she describes | HU / our code |
|---|---|---|
| Single pole switch | on/off for one light | 101 egypólusú |
| Double pole switch | "controls two separate circuits" = a two-gang switch | **105 csillár** (not a true double-pole) |
| Three-way switch | one light from two places | **106 váltó** |
| Four-way switch | used with three-way switches, three or more places | **107 kereszt** |
| Three-way double | two-gang three-way | **108 dupla váltó** |
| Four-way double | two-gang four-way | (two 107s; no single code) |
| Dimmer, smart switch, motion sensor switch, main switch, curtain controller, smart-home controller, thermostat, video intercom/alarm | — | our endpoint catalogue (05s), mostly present |
| Single / double (one frame) / double (two frames) / hermetic / floor box / 400 V / USB-C / USB+C+standard / internet / TV / telecom box | — | sockets and Gyengeáram codes, mostly present |

---

## 3. Her steps vs the Planner, one by one

| # | Her step | Planner today | Gap |
|---|---|---|---|
| 1 | Country legend with descriptions | Printed legend (`05z` `view.legend`; `06c` sheet legend lists only roles present). Villany Stack legend (round 2026-10-22). | No one-line **description** per symbol; no **HU code** column (101/105/106…); no named legend profile (HU MSZ vs other). Small. |
| 2 | Furniture as a grey background | Furniture is drawn as a bare footprint with no fill (`04-render.js` ~653, "context, not content"). | Same idea, already there. The real gap is **getting** the furniture: an interior designer sends DWG/PDF, and we have no DXF/DWG import (see `2026-10-19_cad-sources-and-mcp.md`). |
| 3 | Copy the existing points | `exist` layer **Meglévő / bontás** with `keep · remove · replace`, marks, a check, and Bontás/Ellenőrzés BOM rows (`08s-villany.js` V3). | **No "relocate" state.** "Change of location" is her most common callout. Today it is remove + new, which loses the link between the old and new point, the arrow on the print, and the cost difference (cable extended, chase patched). |
| 4 | Keep black · new red · removed gone. Lighting first. | Keep = grey ring, remove = **red** cross, replace = orange square. | **The colours clash:** in her convention red means *new*; in ours red means *demolish*. An interior designer or contractor reading our sheet could misread it. Lighting-first: E1 Kapcsolások already makes switches *from* lamps, which is the same logic. |
| 5 | Control letters on lamps + switches | Legs `d.grp` (G1, G2…), `sw.ctl`, switch type derived from the links (101/105/106/107/108), "Kapcsolások javaslata" (`08l`). | The logic is **there but not printed.** No `5a`/`5b,5c` labels on the plan, and the group ids are global (G7), not per room. No "main switch scenario" (központi lekapcsolás) in the Villany Stack. **Biggest value for the least work.** |
| 6 | Dimension every point; standard heights; print only deviations | `STD_H` with the cascade room → kind → project → built-in, plus a "everything at standard height" check (`08j`). Plan dimension chains only for walls and openings at the outer box (`06e`). | **No per-point dimensions** (wall corner → axis) and **no `H=` on non-standard points** in the print. No table of standard heights on the sheet. This is the main gap in the drawing. |
| 8 | Notes | Notes tool with icons, sizes and a list panel (`10b-notes.js`). | Notes are free text. Her callouts are a **fixed vocabulary** that can be derived from data (ex state + flags). We could generate them automatically at the margins with leaders (labels.js keeps them apart). |
| 9 | Beyond sockets: AC, speakers, appliances, built-ins | Dedikált körök, Igények (`08q`), Okos előkészítés layer, kitchen and cinema items. | No **"Előkészítés / kábelvég"** point: purpose, tail length ("1 m from the floor"), what it serves (heater, speaker, hood on the island, LED in a shelf). CLA-ADD-001 lists "provisioned terminal points" but they are not packed. |

## 4. Where we are already ahead (and should stay)

Her method ends where ours gets technical: circuits and protection (V7 Áramkörök és védelem), routes and chases, the
board, quantities, demolition BOM rows, bathroom zones (MSZ HD 60364-7-701), and checks. The Workflow Kit then turns
that into pricing.

So for classical work the Planner should **produce her sheet as one output**, the "Villamos elrendezési / változási
terv", and keep the deeper sheets behind it. Her sheet is also what we will **receive** from interior designers on joint
jobs. That makes it an input format too.

## 5. What not to copy

- **Density.** Her red dimensions cross symbols in places, and long leaders cross the plan. Our legible-sheets rule
  (`tools/baseline/labels.js`) stays.
- **Meaning carried by colour alone.** Red/black disappears in a black-and-white print. Our state marks
  (ring, cross, square) already carry the meaning in shape, which is better. Keep the shapes and offer her colours
  only as a print preset.
- **US switch terms.** Map them to our codes (table in §2). Never adopt them.
- **Heights on every point.** That contradicts her own rule. Print `H=` only where the height differs from the standard.

## 6. What to integrate: proposed work packages

| WP | What | Size | Notes |
|---|---|---|---|
| **CE-1** | **Control-group labels**: room number + letter on lamps (`5c`) and switches (`5a,5b`), derived from `grp`/`ctl` and the room number; printed through the apPlacer; outdoor = `K1…` (kültér) | S | Data already exists (`08l`); this is a rendering pass. |
| **CE-2** | **Per-point dimensions + `H=` on deviations**: nearest wall corner → box axis, cm; `H=` only when ≠ STD_H; a standard-heights table on the sheet | M | Its own sheet option ("Kiviteli méretezés"), so the overview plan stays clean. |
| **CE-3** | **Relocate state "Áthelyezendő"** on the `exist` layer, linked to its new point; arrow on the print; BOM row "Áthelyezés" (cable extension + chase patch) | M | Also "upgrade in place" (single → double), which today is a replace. |
| **CE-4** | **Change callouts from data**: HU vocabulary (Megmarad · Áthelyezés · Új · Csere: dupla az egyes helyett · Előkészítés · Kábelvég …), placed at the margin with leaders, no overlaps | M | Needs CE-3 for the relocate text. |
| **CE-5** | **Print preset "Belsőépítész konvenció"**: keep = black, new/changed = accent, removed = crossed out; the shapes stay | S | Fixes the red clash on shared sheets. |
| **CE-6** | **Előkészítés / kábelvég point**: purpose, tail length, height, served appliance | S–M | Fold it into the CLA-ADD-001 "provisioned terminal points". |
| **CE-7** | **Legend with descriptions and HU codes**; legend profile per country (HU first) | S | |
| **CE-8** | **Lighting role per lamp**: általános / funkcionális / hangulat / dekor. The suggestion engine uses it to propose groups (letters) and switch places. This is her "lighting first" made into data. | M | |
| **CE-9** | **Furniture underlay import** (PDF/image now, DXF later), greyed | L | Waits on the CAD/DXF research. |
| **CE-10** | **Központi lekapcsolás** (main-switch scenario) in the Villany Stack | S | |

Suggested first round: **CE-1 + CE-5 + CE-7** (small, all printing, all visible on the Gyakorló lakás), then
**CE-2**, then the renovation pair **CE-3 + CE-4**.

## 7. Knowledge-base additions (no code)

- The EN→HU switch mapping in §2 goes into the Workflow Kit glossary.
- The classical deliverable set, in order: 1 Jelkulcs · 2 Meglévő/bontási terv · 3 Világítási koncepció + kapcsolási
  logika (letters) · 4 Dugaljak és fogyasztók with heights and dimensions · 5 Változások/megjegyzések · then the
  technical sheets (Áramkörök és védelem, Nyomvonal, Elosztó, BOM).
- A metric worth keeping, from her: **"fewer calls from contractors."** Count site questions per job as a quality signal.

## 8. Answers (2026-11-06)

| Q | Answer | Meaning |
|---|---|---|
| CE-Q1 | **B** | Switch globally: black = keep, red = new/changed. Our *remove* mark moves off red (a crossed-out symbol in a neutral ink); *replace* keeps a shape mark. CE-5 shrinks from a preset to the new default. |
| CE-Q2 | **B** | One letter series per floor (A, B, C…), not room number + letter. Overflow after Z: AA, AB… |
| CE-Q3 | **A** | New `exist` state **Áthelyezendő**, linked to its new point, arrow on the print, own BOM row. |
| CE-Q4 | **A + B as an option** | Automatic per-point dimensions + `H=` on the Kiviteli sheet by default; a sheet switch puts them on every plan print too. |
| CE-Q5 | **rethink** | Re-scoped together with the new document style and the Refined render: see `2026-11-06_varler-document-style.md` §7. |
| CE-Q6 | **B** | Lighting role later, with the suggestion engine. |

## 8a. The original questions

- **CE-Q1, colour convention.** A: keep our shapes and colours, add the designer preset (CE-5). · B: switch globally
  to black = keep, red = new. · C: leave it as it is.
- **CE-Q2, group label scheme.** A: room number + letter (`5a`). · B: one letter series per floor (A, B, C…). ·
  C: the circuit number plus a letter.
- **CE-Q3, relocate.** A: a new `exist` state "Áthelyezendő" linked to the new point. · B: remove + new with only a
  link. · C: no change.
- **CE-Q4, per-point dimensions.** A: automatic, only on a "Kiviteli" sheet option. · B: on every plan print. ·
  C: manual dimensioning tool only.
- **CE-Q5, first round.** A: CE-1 + CE-5 + CE-7. · B: CE-3 + CE-4 (renovation first). · C: pack everything as one
  round-2026-11 build pack first.
- **CE-Q6, lighting role (CE-8).** A: add it now as a lamp field. · B: later, with the suggestion engine.
