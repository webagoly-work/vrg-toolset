# VRG Kisokos — the sources

The offline work handbook. The concept and the scope map are in `docs/kisokos/README.md`.
This folder holds the data the Kisokos is made of; everything else (the Stack's K layer, the 3D
page, the cheat sheets) is generated from it.

```
Kisokos/
  map.json                    the core, 8 axes × 2 poles × 4 rings of term nodes, the 9 volumes,
                              and the knowledge bases outside the Kisokos with their place
  kisokos.js                  the loader + checker (check · md · stats); the Stack reads through it
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
  vilagitotestek/             volume vt, Világítótestek (families 1, 2, 6 so far; scope: docs/kisokos/vilagitotestek.md)
    lampak.json               25 fixture types: mounting, light source, protection, photometry, distribution,
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

`check` exits 1 on any problem. `md` rewrites every volume's cheat sheet (and the line drawings); run it
after every card change and commit the generated files with the cards.

A line's `bands` is a list of `[fmin, fmax]` in Hz (several for a line on separate bands, like the mobile
network or fibre wavelengths; `[]` for DC). The wavelength is computed, never typed. `waveform` picks the
glyph: sine · dc · manchester · baseband · diff · carrier · ofdm · light.

`stack.js kisokos` refreshes `Stack/out/kisokos-data.js` for the 3D page (START R → S
does this and opens the page; a full `stack.js build` also does it).
