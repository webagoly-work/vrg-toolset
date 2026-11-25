# VRG Kisokos — the sources

The offline work handbook. The concept and the scope map are in `docs/kisokos/README.md`.
This folder holds the data the Kisokos is made of; everything else (the Stack's K layer, the 3D
page, the cheat sheets) is generated from it.

```
Kisokos/
  map.json                    the core, 8 axes × 2 poles × 4 rings of term nodes, the 9 volumes,
                              and the knowledge bases outside the Kisokos with their place
  kisokos.js                  the loader + checker (check · md · stats · keszlet); the Stack reads through it
  keszlet.json                Készlet product (vrg_id) → Kisokos card links, with a relation (termék, alkatrész,
                              fényforrás, használja, kiváltja, szabvány); lives here because the Inventory regenerates
  rogzitestechnika/           volume rg, Rögzítéstechnika
    anyagok.json              22 materials: recognise, drilling, anchor by load, screw, traps, terms, shop
    dubelek.json              13 anchor kinds: how it holds, what it goes into, drilling, screw, sizes
    furoszarak.json           10 bits and core cutters: shank, machine mode, materials, sizes
    csavarok.json             5 screw kinds: thread, head, what it goes into
    szerszamok.json           3 tools: rotary hammer, wall scanner, hole cleaning
    KISOKOS.md                GENERATED cheat sheet (node Kisokos/kisokos.js md); do not edit
  kommunikacios-vonalak/      volume kv, Kommunikációs vonalak
    vonalak.json              27 lines (buses, networks, coax, power-line, radio, light): how it works, medium,
                              signal + waveform, bands in Hz, rate, distance, topology, power, cable,
                              connector, standard, where in a flat, installation rules, traps, terms, shop
    svg/                      GENERATED: one one-pager per line + spektrum.svg (all lines on one scale)
    KISOKOS.md                GENERATED cheat sheet with the drawings
  tankonyv/                   volume tk, Tankönyv (curriculum: docs/kisokos/tankonyv.md)
    1-kezdo.json              level 1, 10 lessons: goals, explanation, formulas, worked example, exercises with answers
    2-szakmunkas.json         level 2, lessons 1–15 so far (the safety core, circuits, metering, earthing, special rooms, tests, cables, surge, motors, automation, PV)
    KISOKOS.md                GENERATED: the readable book (answers folded)
  eloirasok/                  volume el, Előírások (23 cards): our own summary + reference per standard or law, never the text
    biztonsagi-vilagitas.json 7 cards: MSZ EN 1838, 50172, 60598-2-22, 50171, 62034, ISO 7010, OTSZ/TvMI
    villamos-szereles.json    6 cards: MSZ HD 60364 and its parts 7-701 fürdő, 7-702 medence, 7-703 szauna,
                              7-714 kültéri világítás, 7-710 orvosi helyiségek
    termekek-es-vilagitas.json 10 cards: MSZ EN 60598, 60570, 61347/62776, 12464-1, 13201, 62471, 60079/ATEX,
                              60335, 60204-1, 60669/HD 60884
    KISOKOS.md                GENERATED summary sheet
  vilagitotestek/             volume vt, Világítótestek (all ten families, 79 types; scope: docs/kisokos/vilagitotestek.md)
    rejtett-butor-kulteri.json 24 fixture types of families 3, 4, 7 (hidden and linear, furniture, outdoor)
    biztonsagi.json           8 emergency lighting types (family 8), linked to their rules by `norms`
    dugaszolos-ipari-niche.json 22 types of families 5, 9, 10 (plug-in, commercial and industrial, niche)
    lampak.json               25 fixture types of families 1, 2, 6: mounting, light source, protection, photometry, distribution,
                              control (+ lines), install (+ fixing), rules, Rajztár symbol, rooms, traps, terms, shop
    svg/                      GENERATED: one light-distribution drawing per type
    KISOKOS.md                GENERATED cheat sheet with the drawings
  lib/vonal-svg.js            the one drawing of a line, used by kisokos.js and by the Stack's 3D page
  lib/lampa-svg.js            the one drawing of a lamp type (generic polar light distribution + key figures)
```

## Rules

- **Text in Hungarian; search terms in HU · EN · DE** on every card (decision K2). The search terms
  are the point: they are what you type into a shop's search box.
- **Every card is a draft until the Founder reviews it** (`reviewed: null`; K5). An agent may draft and
  source cards; only the Founder sets `reviewed` (a date). For Rögzítéstechnika the Founder's site
  experience overrides any source. Load values are never written on a card: the manufacturer's
  datasheet gives them.
- **Ids are stable** (lowercase, hyphens). A link into another volume is written `<volume>.<id>`
  (a lamp's `fixing: ['rg.gipszkarton']`, `lines: ['kv.dali']`). Cards point at each other by id inside their volume
  (`drill.bits`, `anchors.*`, `screws`, `for`, `with`); `check` fails on a dangling one.
- **Place is set by hand, size never.** `place: { core: '8A' }` = core knowledge, leaning to that
  pole's entry point into the core sphere. `place: { term: '5A1', overlap: 0.5 }` = its own thing,
  gravitating to a term node; `overlap` is the share that lies inside the core; `hang: n` lets an
  unrelated blob hang past its node. Size is the card's bytes (`cubeBytes`, 1 KB = 1 cube).
- **Outside knowledge bases** (`map.json → sources`) are read for their size only; the Kisokos never
  copies them. A new base gets a place, a colour and a `why`.
- **Rights** (docs/kisokos §4): free texts may be stored with their licence; standards and textbooks
  only as our own summary plus the reference. Large files (PDF, ZIM) go to `Shared`, not git (K1).

## Commands

```bash
node Kisokos/kisokos.js check
```

```bash
node Kisokos/kisokos.js md
```

```bash
node Stack/stack.js kisokos
```

`node Kisokos/kisokos.js keszlet` reports how many Készlet products are linked and suggests cards for the
unlinked ones by name; `--add` writes the suggestions into `keszlet.json` marked "javaslat" for review.

`check` exits 1 on any problem. `md` rewrites every volume's cheat sheet (and the line drawings); run it
after every card change and commit the generated files with the cards.

A line's `bands` is a list of `[fmin, fmax]` in Hz (several for a line on separate bands, like the mobile
network or fibre wavelengths; `[]` for DC). The wavelength is computed, never typed. `waveform` picks the
glyph: sine · dc · manchester · baseband · diff · carrier · ofdm · light.

`stack.js kisokos` refreshes `Stack/out/kisokos-data.js` for the 3D page (START R → S
does this and opens the page; a full `stack.js build` also does it).
