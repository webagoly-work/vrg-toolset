# IDEA-002 — The flush-cover standard (RBX, cluster boxes, solo boxes)

Status: **research + collection, 2026-10-09** · side research, nothing scheduled · the product half of
[IDEA-001](IDEA-001_cluster-flush-boxes.md) · feeds the `FLUSH_BOXES` table named in IDEA-001 §4 ·
machine-readable collection: `FLUSH-COVERS-001.json`

> *"…what form factor standard products should we use beyond the standard süllyesztett
> szerelvénydoboz… nail down what products should be used to standardize the outer looks of the
> different flush mounted items, namely the RBX type, but I want to create multiple standard options
> for housing and covering the cluster device flush boxes (two or three sizes to house different
> number of clusters), the normal single szerelvénydoboz housings also need covering options/ideas
> that gives them and every type of flush mount space types a nice, discreet, simple look that
> visually feels in standard to each other."*
> — the user, 2026-10-09

**Reading of "the four zones":** the placement rule's device zones — **low 200–500**, **medium
800–1400**, **high 1900–2500**, **ceiling**. Floor is excluded (pathways only), which leaves exactly
four. Every option below also carries a price band, so the collection still works if price zones
were meant.

---

## 1. The problem, stated precisely

IDEA-001 sizes the holes. This document decides what the wall *looks like* once they are closed.

The range is the whole problem: the smallest flush item is a **Ø68 box behind an 83 × 83 mm plate**,
the largest is **RB-H at 600 × 600 × 120 mm**. That is a 7:1 linear span and a 50:1 area span. No
single product family covers it — switch-plate ranges stop at 6–8 positions, and flush distribution
enclosures start where switch plates stop. So "visually in standard with each other" cannot mean
*the same product everywhere*. It has to mean **one shared geometry rule that two product families
both obey.**

The second trap: a consumer-unit door *reads as a consumer unit*. Putting a Hager or Tracon board
door at +1.9 m in a living room announces "fuse box", which is the opposite of discreet — even though
dimensionally it is the best fit for an RBX. The discreet answer at RBX scale is not a nicer door, it
is **no door**: a paintable plaster-flush hatch, where the visible surface is the wall itself.

## 2. The standard: two ladders and one alignment rule

**Ladder D (device) — 83 mm module.** Everything that carries a visible device or blank. One switch
series governs it; positions grow horizontally. Available sizes are whatever that series' frames
offer (1…6 in Asfora, 1…8 modules in Gewiss Chorus ONE, 1…2×8 in Legrand Mosaic).

**Ladder H (hatch) — 100 mm step: 200, 300, 400, 500, 600.** Everything that is a *space*, not a
device: RBX, portal boxes, spine T-boxes, media voids, partitioned MAINS+SELV clusters. This ladder
is not invented — it is the stock size ladder of the Hungarian revíziós-ajtó trade (200×200, 300×300,
400×400, 500×500, 600×600 are catalogue items at every supplier found), and 200 × 200 is *also* a
stock flush junction-box size. **200 × 200 is the keystone**: the only size that exists as both a box
and a hatch, so it is where the two ladders meet.

**The alignment rule** is what actually makes it look deliberate: within a column, every housing
shares one vertical centreline, and every hatch edge sits on the 100 mm grid measured from the same
datum as the device plates. Two different product families, one set of edges.

Stated as a rule for the catalogue:

> Every flush housing is either a **Ladder D plate** (one switch series, 1–8 positions) or a
> **Ladder H hatch** (200/300/400/500/600, or a custom size that is a multiple of 100 mm).
> Nothing else. Mixed columns align on one centreline.

## 3. Three strategies

| | **A — Trade** | **B — Invisible** | **C — Two-tier** (recommended) |
|---|---|---|---|
| Low + medium | switch-series frames | switch-series frames | switch-series frames, one series only |
| High (RBX, portal) | flat-door flush board (Tracon EDSSN / ABB UK600 / Hager FWU) | paintable GK-insert hatch | paintable GK-insert hatch |
| Ceiling | Kaiser lamp boxes + spring lids | GK-insert hatch + plaster-flush blanks | Kaiser lamp boxes + GK-insert hatch |
| Unifying device | same white, same flat face | the shadow gap (≈1–1.5 mm) | the 100 mm grid + shared centreline |
| Honest verdict | cheapest, fastest, reads as "technical" | most discreet, most trade coordination | discreet where it matters, standard parts where it does not |
| Risk | RBX door reads as a fuse box | needs plasterboard or plastered masonry; tile needs the tileable variant | two supply channels (see §7) |

**Recommendation: C.** The visible design lives in the low and medium zones, where devices are and
where people look. The high zone and the ceiling disappear. The reason this is not a compromise:
the high zone is *service access*, not *user interface* — it should be findable by a technician and
invisible to everyone else, which is exactly what a push-open painted hatch is.

**Where A still wins:** a utility room, a kamra, a garage, RB-O outdoors. Use A there deliberately,
not by default.

## 4. The four-zone matrix

### Zone 1 — LOW (200–500 mm): sockets, leak sensors, floor-adjacent feeds

| option | housing | cover | band |
|---|---|---|---|
| L1 | Ø68 standard box (47 or 61 mm inner depth) | series frame + device, or vakfedél | ~1.5–2 k Ft |
| L2 | Kopos KPL 64-50/2–5 LD gang strip (138/209/280/351 × 68, GK) | 2–5-gang series frame | 2–6 k Ft |
| L3 | Kaiser 9252-22 / 9253-22 / 9254-22 (2/3/4-gang, GK) | same | mid |
| L4 | Gewiss 503-type box (GW16503, 3 modules) | Chorus **ONE** single plate, 1–8 modules | 1.6 k Ft box + plate |
| L5 | Legrand Mosaic flush box 2×4 (078872L) | Mosaic frame 2×4 … 2×8 | 8.6 k + 4.7–12 k Ft |
| L6 (UEP / reserve) | deep box, 60–65 mm, smart-up ready | **plaster-flush blank** — Dietzel HWD/TD 65 (001162), tapétázható | low |

### Zone 2 — MEDIUM (800–1400 mm): switches, panels, thermostats, worktop clusters

Same families as Zone 1 — this is the zone where the visible series choice is actually *seen*, so the
series decision (§5) is really a Zone-2 decision. Two additions:

| option | housing | cover | band |
|---|---|---|---|
| M1 | 6-gang horizontal strip | Asfora horizontal frame up to 6 (e.g. 3-gang EPH5800321) | low |
| M2 | **partitioned cluster**: 200×200 flush box (JANGAR JG-2179, 200×200×63 IP30; or KOPP 356104007, 200×200×80) | 200 × 200 GK-insert hatch — *the keystone size* | 8–10 k Ft |

M2 is the answer to IDEA-001 open question 3 (one partitioned housing vs two side by side): one
200 × 200 box with a divider, one 200 × 200 hatch, MAINS and SELV in separate compartments, and the
cover is on Ladder H so it matches the RBX above it.

### Zone 3 — HIGH (1900–2500 mm): RBX, portal boxes, spine T-boxes, SSC

**Primary (strategy B/C) — paintable GK-insert hatch.** Alu frame, 12.5/15/25 mm GKBi insert, two
self-closing latches, push-open, ~1.5 mm gap, ~1 mm visible joint after filling and painting.

| RBX class | inner need (ARCH-002 §8.4) | hatch (Ladder H) | stock? |
|---|---|---|---|
| RB-S | 300 × 400 × 90 | 300 × 400 (or 400 × 400 stock) | custom / stock |
| RB-M | 400 × 500 × 110 | 400 × 500 (or 500 × 500 stock) | custom / stock |
| RB-L | 500 × 600 × 110 | 500 × 600 (or 600 × 600 stock) | custom / stock |
| RB-H | 600 × 600 × 120 | **600 × 600 — stock everywhere** | stock |
| portal box | 100 × 100 | 200 × 200 if it must open after painting; otherwise the box's own lid | stock |

Prices, Prowallz gross, GK-insert: 30 × 30 **8 255 Ft** · 40 × 40 **8 890** · 50 × 50 **10 160** ·
60 × 60 **12 700** · 60 × 100 **19 050** · 60 × 120 **26 670**. Impregnated +0.6–1.3 k, fire-rated
+1.3–2.5 k. Custom size by phone/email, 2–9 days.

**Alternative (strategy A) — flat-door flush enclosure.** Verified size ladders:

| family | sizes H × W × D (mm) | door | note |
|---|---|---|---|
| **Tracon EDSSN** (white, *sík ajtó*, no NPE) | 180×220×88 · 240×305×80 · 395×305×85 · 480×440×90 · 655×440×90 · 860×440×95 | flat white, IP40 | **width caps at 440** — cannot reach RB-L/RB-H width; EDSS- = smoked door |
| **ABB UK600 Media / Combi** | niche 480/605/730/855 × 367 × 95; outer e.g. 622×384×97, 872×384×97 | RAL 9016 white or RAL 7016 anthracite | flush, hollow-wall and flammable-wall approved; Media = low-voltage, Combi = both |
| **Hager univers FWU süllyesztett** | FWU42D 703×603×125 · FWU52S 853×603×125 · FWU62S 1003×603×125; **FW42US2 703×603×110, teli ajtó** | RAL 9010, IP30, class II | the only family found that reaches **603 mm width at 110–115 mm depth** — the natural RB-H fit; GK mounting kit exists |
| Hager Volta VU multimédia | 3-row 630.5×348×98 · 5-row 880.5×348×98 | white plastic or metal | too narrow for RB-M and up |
| Legrand Practibox S | 1–4 rows × 4/6/8/12/18 | white or smoked | separate brick (650 °C) / GK (850 °C) variants — pick by wall |
| Tehnoplast THP-U36-3-1-EP-PL | base 325×568×90, media bay 250×220×70 | white metal | purpose-built media bay, but the bay is small |

Two depth warnings. Flush boards are **80–98 mm deep**; RB-M/L need **110** and RB-H **120**, so only
the Hager FWU family (110–125) actually satisfies ARCH-002 §8.4 without a chase. And Hager is
RAL 9010 while ABB is RAL 9016 — **not the same white**; do not mix them on one wall.

### Zone 4 — CEILING: lamps, sensors, APs, speakers, smoke/CO, T-box access

| option | housing | cover | note |
|---|---|---|---|
| C1 | Kaiser ThermoX 9300-22 universal lamp box, 90 mm deep, 7–40 mm panel | mineral-wool front plate included, two front-part types, fit from above or below | the general-purpose choice |
| C2 | Kaiser ThermoX 9300-03 (Ø82) | 3-part kit: box + transformer-opening closer + **reversible front plate** | |
| C3 | Kaiser 9320-10 (Ø74, 70 mm, airtight, screwless) / 9320-11 (Ø74, 95 mm, ≤9 W) | **lid not included** — order separately | airtight; halogen-free |
| C4 | Kaiser 9063-50 GK ceiling lamp connection box Ø68, M5 thread | no lid — pair with a plaster-flush blank | at Daniella |
| C5 (blank / reserve) | any Ø65–68 ceiling box | **Dietzel HWD/TD 65** plaster-flush round lid, tapétázható; or T 303 05 (Ø68) / T 303 06 (Ø88) spring lids | the ceiling equivalent of L6 |
| C6 (access) | ceiling T-box / service void | GK-insert hatch 150×150 or 200×200 (plastic GK0114, white steel GK0063, or GK-insert) | same Ladder H family as Zone 3 |

## 5. The one series decision (Zone 1 + 2)

Three candidates, all stocked by Daniella:

| series | positions in one plate | plate geometry (verified) | look | band |
|---|---|---|---|---|
| **Schneider Asfora** — current panelkocka standard | horizontal to **6**, vertical to **3** | vakfedél EPH5600121 **83 × 83 × 35**, IP20, claws 51–80 mm | the familiar budget domestic look | 1.5–2 k Ft/pos |
| **Gewiss Chorus / ChoruSmart** | **ONE** single plate 1, 2, 3, 4, 6, 8 modules; Italian-standard supports 3/4/6/7 | 6-module "large" plate **202 mm** wide (GW16109TB); box GW16503 3-module | one uninterrupted plate over a whole cluster — the cleanest cluster look found | box 1 626 Ft; 4-gang Chorus One frame GW16128VT 8 659 Ft |
| **Legrand Mosaic** | 1, 2, 2×2, 3×2, 4×2, 2×4, 3×4, 2×6, **2×8** | 2-module plate **82 × 82**; 6-module horizontal frame **83 × 225 × 40** | technical/office; best when the cluster is data/USB-heavy | box 2×4 8 585 Ft; 2×8 frame 11 619–12 146 Ft; 2-module blank 1 505 Ft |

**For clusters specifically, Gewiss Chorus ONE is the strongest.** The Italian 3/4/6/7-module logic is
*built for* one plate over many functions, which is precisely the cluster-point idea — whereas Asfora
and Mosaic read as several frames ganged together even when they are one part. Asfora stays the
right answer for plain panelkocka rewires (it is already the standard, and 6 horizontal positions
covers most clusters).

**Not resolved:** whether Asfora's blank fits a Sedna Design multi-gang frame. The search found no
confirmation either way — check the Schneider catalogue before relying on it.

## 6. The cluster box sizes (answering "two or three sizes")

Three, mapped to IDEA-001's demand model:

| | demand it covers | housing | cover | Ladder |
|---|---|---|---|---|
| **K1 — small** | 2–3 gangs, one compartment, standard depth | Kopos KPL 64-50/2LD (138×68) or /3LD (209×68) | 2–3-position series plate | D |
| **K2 — medium** | 4–6 gangs, one compartment, smart-up depth | Kopos KPL 64-50/4LD (280×68) or /5LD (351×68); Kaiser 9254-22 | Chorus ONE 6- or 8-module plate, Mosaic 2×6/2×8, or Asfora 6 horizontal | D |
| **K3 — partitioned** | any gang count **plus** MAINS/SELV separation, or a module stack behind the devices | 200×200 flush box with divider (JANGAR JG-2179 200×200×63 · KOPP 356104007 200×200×80 · Kopos KO 125/1L 152×152×64 · Kaiser 1096-31 159×159 brick · Kaiser 1296-02 180×180×84 / 1297-02 250×220×82 concrete, both with előlap) | 200 × 200 GK-insert hatch, **or** a series plate on a sub-frame | H |

K3 is the bridge: it is the first size on Ladder H, so a K3 cluster in the medium zone and an RB-S
hatch in the high zone above it are visibly the same object at two sizes.

## 7. Vendor channel — and this is the real finding

**Strategy C needs two supply channels, and only one of them is Daniella.**

| vendor | what for | order-in | in-person point |
|---|---|---|---|
| **Daniella Villamosság** (daniella.hu) | Kaiser, Gewiss, Legrand, Hager, Schneider, Kopos; the boxes, the plates, the flush boards | yes — wholesale + retail webshops, phone, email | **yes, ~45 telephely nationwide**, személyes átvétel or courier; Daniella Helloszerszám shop 1173 Bp, Csomafalva u. 2, +36 20/320-68-82 |
| **Ultima Kft.** — Kaiser's HU representative | the full Kaiser range, incl. items the webshops do not list | yes (ultima.hu, kaiserdobozok.hu) | **yes** — 1172 Budapest, Rétifarkas u. 6 |
| **Tracon** (shop.traconelectric.com) | EDSSN flat-door flush boards | yes, plus a wide partner-shop network (Haluxvill, Hejővill, Vilszershop, Audaxshop, Lakitech…) | via partners — verify per shop |
| **Schrack Technik** (schrack.hu) | süllyesztett média elosztó, 4-row, RAL 9003 | yes | branch network — verify |
| **Sonepar Hungary** (shop.sonepar.hu) | ABB UK600 | yes | verify |
| **TÉTÉNY-KER 87 Kft.** — FF System F3 | GK-insert hatches, stock 200–600 square + custom; locks SN / FS / PZ / Z | yes, quote by form or +36 1 439 1251 | **yes** — 1185 Budapest, Üllői út 626 |
| **Prowallz Kft.** (reviziosajtoarak.hu, prowallz.hu) | GK-insert hatches with published prices; custom 2–9 days | yes, phone/email: +36 30 958 2915 | **yes — Nagytarcsa**; stock in Budapest and outside it (no street address published) |
| **Primavent** | SzAH / SzAP / SzAHl / SzFH — airtight (EN 1026 class 4), impregnated, tileable, EI60, magnetic push lock, removable-leaf; 400×400 … 800×800 | yes, configured to order | verify |
| Lambda, Arkibau, Ventilatorom, Dalap, Kemi-Ker, Buildox, Profilvasker, Kispál Tüzép, Mestervagyok, Bau92, Bauhaus | the commodity 20×20–60×60 hatch ladder, plastic and white-steel ceiling hatches | yes | mostly yes (építőanyag / szakáruház) — verify per site |
| Mentavill, Elektrikstore, Elektroprofishop, Lumenet, 16amper, Onlinevill, Villamossag.com, 1Vill, E-mile, Celon, DL1, Villamossági Diszkont, Anro Díszléc | price cross-checks, odd Kaiser and Gewiss codes | yes | varies — verify |

**Consequence to decide:** the hatch is a drywall/ventilation-trade item, not an electrical-trade
item. Daniella will not supply it. If one-channel purchasing matters more than the discreet look,
that argues for strategy A (everything from Daniella). If the look matters more, accept Prowallz or
TÉTÉNY-KER as a second supplier — both have an in-person point, so neither forces courier-only.

## 8. The collection ruleset (how to judge the next candidate)

Mirrors the rules used for the git collections — availability and provenance first, taste second:

1. **Is it actually orderable in Hungary?** A German catalogue number with no HU distributor is
   reference-only, never a standard.
2. **Is there an in-person point?** A product you can collect survives a schedule slip; a
   courier-only product does not. Recorded per vendor, not per product.
3. **Does it sit on Ladder D or Ladder H?** An off-grid size breaks the only thing that makes the
   family look intentional. Off-grid → reference-only.
4. **Does the published depth satisfy the ARCH-002 §8.4 class it claims to serve?** Most flush boards
   fail this at 80–98 mm; say so rather than quietly accepting a chase.
5. **Is the white specified?** RAL 9010 vs 9016 vs 9003 are three different whites. An unspecified
   white cannot enter the standard.
6. **Wall type declared?** Brick / concrete / hollow-wall variants are different article numbers
   (Practibox's 650 °C vs 850 °C is the clearest case). A product without a declared wall type is
   not yet a choice.
7. **Price band recorded, with its date and gross/net basis.** Shop prices here varied by up to 20 %
   for the same code.

Priority, as in `vendor-manifest.json`: **1** = take now · **2** = next round · **3** = know it
exists.

## 9. What I could not verify

- **Gewiss Chorus plate widths for 3, 4 and 7 modules.** Only the 6-module large plate (202 mm) came
  back. Ladder D's exact arithmetic needs these from the Gewiss datasheets.
- **Asfora frame pitch and multi-gang outer dimensions.** Only the 83 × 83 blank is confirmed.
- **Asfora blank in a Sedna Design frame** — no confirmation either way.
- **Tracon EDSSN-12/1**: catalogue says 240 × 305 × 80, a shop says 200 × 256 × 66. **EDSSN-18/4**:
  860 vs 855 mm. Hager FWU62S niche: 957 × 565 vs 952 × 560. Use manufacturer datasheets.
- **A true 100 × 100 flush box** does not seem to exist. Closest: Kaiser 9195-91 (107 × 107 × 45, 2
  circuits) and Kopos KO 110/L NA (116 × 116 × 45, IP30, lid V 110 L + divider P 110 L). The portal
  box in P33 v1 is drawn as 10 × 10 — either accept 107 or 116, or move it to Ladder H at 200.
- **RB-O (outdoor, IP65)** was out of scope — no flush IP65 cover family researched.
- **Tile-plane hatches** (magnetic, frameless, adjustable feet) exist and are the most invisible
  option, but no Hungarian vendor with published sizes and prices was pinned down. Relevant for a
  bathroom RBX (RB-E/W at P33's R08).

## 10. Open questions for the user

1. **Strategy A, B or C?** Everything else follows from this.
2. **Series for Zones 1–2:** keep Asfora (already the standard), or move BRIDGE-grade work to Gewiss
   Chorus ONE for the cluster plates?
3. **Second supplier acceptable?** Prowallz / TÉTÉNY-KER for hatches, or Daniella-only?
4. **Hatch ladder: stock-only or custom?** Stock squares (400/500/600) are cheaper and immediate but
   waste wall area against RB-S/M/L's rectangles; custom matches the RBX exactly at 2–9 days.
5. **Portal box:** accept 107 or 116 mm as "10 × 10", or promote it to a 200 Ladder-H hatch?
6. **Lock type on hatches:** push-open (nothing visible, anyone can open) or key/cylinder (PZ/FS —
   visible keyway, but the RBX is a MAINS-bearing enclosure at reachable height)? This one has a
   safety dimension, not only a visual one.

### Answers — 2026-10-09 (tuner pack `PLANNER-FLUSH-Q-001` r0, 6 / 6)

| # | answer | note |
|---|---|---|
| 1 | **C — two-tier** | one switch series low and medium; paintable push-open hatches high and ceiling |
| 2 | **Chorus ONE for BRIDGE cluster plates, Asfora for plain rewires** | |
| 3 | **Yes — a second supplier** (Prowallz or TÉTÉNY-KER 87) for the hatches | |
| 4 | *open — discuss* | stock vs custom hatch sizes still to be settled |
| 5 | *open, parked* | *"leave it for now, as it is a placeholder for a later dev idea"* — the P33 test plans keep the 10 × 10 placeholder |
| 6 | *open, both kept* | *"in light of the options available, 1 and 3 for more options"* — the standard offers **push-open** and **key on MAINS-bearing hatches (RBX), push-open elsewhere** as two variants; keyed-everywhere is dropped |

Routing answer R13 (WORKSHOP-001 §7) makes the **K3 partitioned housing** the default wherever
conduit families meet, which raises its weight in this standard.

---

## Sources

Access hatches: [Prowallz / reviziosajtoarak.hu](https://reviziosajtoarak.hu/gipszkarton-betetes-revizios-ajto/) ·
[FF System F3 — TÉTÉNY-KER 87](https://catalog.ffsystembau.hu/revizios-ajtok/f3-rendszer-gipszkarton-betetes-revizios-ajtok.html) ·
[Primavent SzAH 700×700](https://primavent.hu/burkolhato-revizios-ajto-gipszkarton-falba-szah-700x700x12-5-gkbi-us-magneszar-keretbe-agyazott-burkolat-82-mm/) ·
[Primavent légtömör SzAHl 600×600](https://primavent.hu/legtomor-gipszkartom-betetes-szereloajto-szahl-600x600x12-5-gkb-us-gipszkarton-falba-magneses-nyomozar/) ·
[Lambda Alu-Eco 600×600](https://lambdawebaruhaz.hu/revizios-ajto-gipszkarton-betettel-alu-star-600x600-mm-495) ·
[prowallz.hu árak](https://prowallz.hu/gipszkarton-betetes-revizios-ajto-arak/) ·
[gipszkartonarak.hu](https://gipszkartonarak.hu/revizios-ajtok-es-arak/) ·
[Kemi-Ker 400×400](https://webshop.kemiker.hu/termekkategoria/gipszkarton/szereloajtok-szellozoracsok/060303-4040-revizios-ajto-impregnalt-gipszkarton-betettel-400x400-mm-profi) ·
[Bauhaus szerelőajtó](https://www.bauhaus.hu/epitoanyag-felujitas/szarazepiteszet/szereloajto.html) ·
[mestervagyok fehér acél GK0063](https://www.mestervagyok.hu/gipszkarton-almennyezet/gipszkartonozas-femprofilok-kiegeszitok/kiegeszitok-elvedok-csavarok/szerelonyilas-feher-acel-lemezbol-revizios-ajto-gipszkarton-szerkezetekbe-feher-gk0063-02020.html) ·
[mestervagyok műanyag GK0114](https://www.mestervagyok.hu/gipszkarton-almennyezet/gipszkartonozas-femprofilok-kiegeszitok/kiegeszitok-elvedok-csavarok/muanyag-szerelonyilas-revizios-ajto-feher-gk0114-01515.html) ·
[burkolatszintezo.hu — beépítés, mágneses rendszer](https://burkolatszintezo.hu/gipszkarton-revizios-ajto-beepitese)

Flush boards: [Tracon EDSSN-18/2 480×440×90](https://shop.traconelectric.com/product/EDSSN182/Sullyesztett-elosztodoboz--feher-sik-ajtoval--NPE-nelkul-218-36-modul--IP40--HWD48044090-mm) ·
[Tracon EDSSN-8/1](https://shop.traconelectric.com/product/EDSSN81/Sullyesztett-elosztodoboz--feher-sik-ajtoval--NPE-nelkul-18-8-modul--IP40--HWD18022088mm) ·
[Tracon EDSS-12/3 545×305×85](https://shop.traconelectric.com/product/EDSS123/Sullyesztett-elosztodoboz--fustszinu-sik-ajtoval--NPE-nelkul-312-36-modul--IP40--HWD54530585-mm) ·
[Tracon kategória](https://shop.traconelectric.com/categories/05_09_04/Sullyesztett-elosztodoboz--sik-ajtoval) ·
[ABB UK600](https://new.abb.com/low-voltage/products/enclosures/consumer-units/uk600) ·
[ABB UK600 niche táblázat (PDF)](https://library.e.abb.com/public/c2412c9afc7f4a748545f72dfa5d48e5/210429%20UK600_Anlage%20AA_BB%20(EN).pdf) ·
[ABB UK663CW](https://new.abb.com/products/2CPX031401R9999/uk663cw) ·
[Hager univers süllyesztett](https://www.hager.hu/termekeink/elosztoszekrenyek/fali-elosztok/univers-suellyesztett-eloszto/467.htm) ·
[Hager FWU62S](https://hager.com/intl-en/catalogue/information/fwu62s-fw-flush-encl-6-rows-144-modules) ·
[Hager fali elosztók (PDF)](https://www.hager.hu/files/download/0/766_1/0/02_Fali%20elosztok.pdf) ·
[Hager Volta multimédia VU48NW — Daniella](https://daniella.hu/hager-volta-multimedia-eloszto-fem-ajtoval-sullyesztett-4-soros-szerelolappal-dugaljja-vu48nw-keszlet-erejeig-id-hgrvu48nw) ·
[Legrand Practibox S (PDF)](https://assets.legrand.com/webf/hu/hu_hu_practiboxs-elosztoszekreny.pdf) ·
[Schrack süllyesztett média elosztó](https://www.schrack.hu/shop/suellyesztett-media-eloszto-4-soros-teglafalba-bk085734-k.html) ·
[Tehnoplast média lakáselosztó](https://www.onlinevill.hu/media-lakaseloszto-sullyesztett-1x12-modulos-ip30-eloszto-szekreny-tehnoplast-thp-u36-3-1-ep-pl)

Boxes: [Daniella — süllyesztett kötődobozok és fedelek](https://daniella.hu/installacio-technika/szerelveny-es-koetodobozok/suellyesztett-koetodobozok-es-fedelek) ·
[Kaiser HU (Ultima)](https://www.kaiserdobozok.hu/) ·
[Kaiser téglafalba helyezhető kötődobozok](https://elektrikstore.hu/spl/175188/Kaiser-teglafalba-helyezheto-kotodobozok) ·
[Kopos KO 110/L NA](https://www.16amper.hu/kopos-gipszkarton-sullyesztett-kotodoboz-fedellel-v-110-l-es-valaszfallal-p-110-l-ko-110l-na) ·
[Kopos / Kaiser GK gang boxes](https://elektrikstore.hu/spl/559673/Sullyesztett-szerelvenydobozok-gipszkartonfalhoz) ·
[JANGAR JG-2179 200×200×63](https://1000volt.hu/shop/kotodoboz-sullyesztett-csavaros-fedel-200x200x60mm-ip30/) ·
[KOPP 356104007 200×200×80](https://www.schonvill.avasweb.eu/?t=114043) ·
[ANRO GK szerelvénydobozok](https://www.anrodiszlec.hu/product_info.php/products_id/22694)

Device plates: [Asfora vakfedél EPH5600121](https://shop.haluxvill.hu/kapcsolok-es-dugaljak/schneider-electric-asfora/81675-eph5600121-asfora-vakfedel-kerettel-feher) ·
[Asfora vakfedél (méretek)](https://www.onlinevill.hu/schneider-asfora-vakfedel-kerettel-feher-eph5600121) ·
[Gewiss ChorusMart ONE plates](https://www.gewiss.com/ww/en/series/serie.1000000.1000031.chorusmart---domestic-range-one-plates) ·
[Gewiss GW16109TB 6 modules 202 mm](https://www.gewiss.com/ww/en/products/product.1000000.1000031.GW16109TB) ·
[Gewiss GW16807N 7-module support](https://www.gewiss.com/ww/en/products/product.1000000.1000039.GW16807N) ·
[Gewiss GW16503 box — Daniella](https://daniella.hu/gewiss-chorus-szerelveny-doboz-3-modulos-szurke-ip40-gw16503-id-gewgw16503) ·
[Gewiss Chorus One GW16128VT — Daniella](https://daniella.hu/gewiss-chorus-one-titanium-vizszintes-4-es-keret-2+2+2+2mod.-gw16128vt-id-gewgw16128vt) ·
[Legrand Mosaic 2×4 flush box 078872L](https://legrandaruhaz.hu/legrand-program-mosaic-sullyesztett-doboz-2x4-modulos-feher-078872l) ·
[Legrand Mosaic 6-module frame 080286 (83×225×40)](https://www.domeashop.com/en/mosaic-accessories/5115-frame-mosaic-for-6-modules-assembly-horizontal-depth-40mm-legrand-080286-3245060802868.html) ·
[Legrand Mosaic keretek](https://legrandaruhaz.hu/program-mosaic-keret) ·
[Dietzel HWD/TD 65 vakolatsíkba kerek fedél](https://www.e-mile.hu/installaciotechnika/kotodoboz-es-szerelvenydoboz/muanyag-sullyesztett-kotodoboz-szerelvenydoboz/gipszkarton-szerelvenydoboz-fedel-vakolatsikba-kerek-65mm-dobozatmerohoz-feher-hwd-td-65-dietzel-univ001162/) ·
[OBO vakfedél kerek nyíláshoz](https://www.obo.hu/termekek/epuletinstallaciok/szerelvenybeepito-egysegek/tartozekok/vakfedelek/vakfedel-kerek-nyilas-lezarasahoz.html)

Ceiling: [Kaiser ThermoX 9300-22](https://shop.borosesfiai.hu/kaiser-9300-22-univerzalis-lampadoboz-thermox-5559) ·
[Kaiser ThermoX 9300-03 (Ø82)](https://www.mentavill.hu/termek/kaiser-thermox-lampadoboz-atm82mm-41114) ·
[Kaiser 9320-10 (Ø74, légtömör LED)](https://elektrikstore.hu/Kaiser-9320-10-ThermoX-74-mm-atmeroju-legtomor-LED) ·
[Kaiser 9320-11](https://www.ultima.hu/Kaiser-932011) ·
[Kaiser 9063-50 — Daniella](https://daniella.hu/gipszkarton-doboz-mennyezeti-lampa-csatlakozodoboz-m5-menettel-9063-50-kaiser-id-kai906350) ·
[ThermoX lámpadobozok (Ultima)](https://www.kaiserdobozok.hu/webaruhaz/115-thermox-lampadobozok-es-tavtarto-almennyezetbe/118/thermox-82-es-lampadoboz-)

Vendors: [Daniella — ~45 telephely, személyes átvétel (Árukereső)](https://www.arukereso.hu/stores/helloszerszam-hu-s87922/) ·
[Daniella családi cég (Világgazdaság)](https://www.vg.hu/vilaggazdasag-magyar-gazdasag/2025/08/daniella-villamossag-magyar-csaladi-ceg-hadnagy-erno) ·
[Ultima Kft. — Kaiser képviselet](https://www.ultima.hu/webaruhaz/7-kaiser) ·
[Sonepar Hungary](https://shop.sonepar.hu/catalog/hu-hu/products/abb-elosztoszekreny-1400x1300x215mm-ip43-5-5a-gt89384-GT89384) ·
[Mentavill](https://www.mentavill.hu/termek/termek-170230) ·
[Elektrikstore](https://elektrikstore.hu/KIEMELT-TOP-termekek-sullyesztett-multimedia-kiseloszto-szekrenyek)
