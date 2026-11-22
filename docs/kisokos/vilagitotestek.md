# Lámpák és világítótestek — Kisokos catalogue (idea, 2026-11-22)

A dedicated compendium of every type and kind of light fixture, from the basic ceiling lamp to the
niche ones. It becomes its own Kisokos volume, **vt · Világítótestek** (planned in `Kisokos/map.json`;
no cards yet). One card = one *type* of fixture, not one product: products come later from the
Készlet (Inventory) and from datasheets, and point back at their type.

Status: **started** (2026-11-22). Families 1, 2 and 6 are in `Kisokos/vilagitotestek/lampak.json` (25 draft type
cards), families 3, 4 and 7 in `rejtett-butor-kulteri.json` (24), family 8 in `biztonsagi.json` (8, with its rules
as the first Előírások cards in `Kisokos/eloirasok/`), each with a generated light-distribution drawing (`Kisokos/lib/lampa-svg.js`, `vilagitotestek/svg/`) and the
cheat sheet `vilagitotestek/KISOKOS.md`. This file is the scope, the card format and the order to build in.

## 1. Why a separate volume

Light fixtures are the most common thing a residential electrician mounts, wires and is asked about.
They sit across the Kisokos's other volumes: the Eszköztár lists devices, but a fixture also needs its
fixing (Rögzítéstechnika: csillárkampó, gipszkarton, födém), its control line (Kommunikációs vonalak:
DALI, 1–10 V, Zigbee) and its rules (Előírások: fürdőszobai zónák, vészvilágítás). A volume of its own
keeps one card per type with links out to all of those.

## 2. The types, from basic to niche

The order is the build order too: the families a flat has first, the specialist ones last.

| # | Family | Types (each one a card) |
|---|---|---|
| 1 | **Mennyezeti** (ceiling) | mennyezeti lámpa / plafonlámpa, LED-korong („ufó”), búrás mennyezeti lámpa, csillár, függeszték, LED-panel álmennyezetbe (600 × 600 raszter, keret nélküli), süllyesztett downlight és beépíthető spot, mélysugárzó, felületre szerelt spot, sínrendszer és sínspot (230 V, 48 V mágneses), világító felület / feszített fényes mennyezet |
| 2 | **Fali** (wall) | falikar, fali búra, olvasó falikar, tükörvilágítás, képvilágító, falba süllyesztett lépcső- és orientációs fény, fali fényvető (wall washer) |
| 3 | **Rejtett és vonali** | LED-szalag alumínium profilban, LED neon flex, rejtett (indirekt) világítás gipszkarton párkányban, trimless (keret nélkül bevakolt) profil és spot, árnyékfuga-világítás |
| 4 | **Bútor és beépített** | konyhai pult alatti lámpa, szekrény- és polcvilágítás, fiókvilágítás, ágyvilágítás, mozgásérzékelős gardróbfény |
| 5 | **Dugaszolós** (plug-in) | állólámpa, asztali és íróasztali lámpa, éjjeli lámpa; a fali kapcsolt aljzat mint „világítási kör” |
| 6 | **Nedves helyiség** | fürdőszobai mennyezeti és tükörlámpa (zónák szerint), zuhanyspot, páramentes lámpatest (garázs, pince, műhely), szaunavilágítás |
| 7 | **Kültéri** | homlokzati falikar, mozgásérzékelős reflektor, kerti oszloplámpa (bollard), leszúrható kerti spot, földbe süllyesztett lámpa (inground), lépcső- és lábazatvilágítás, homlokzat-megvilágító, medencevilágítás, napelemes kerti lámpa, kapuoszloplámpa |
| 8 | **Biztonsági és jelző** | menekülési útirány-jelző, kijáratjelző, tartalékvilágítás; önálló akkumulátoros és központi akkumulátoros rendszer; orientációs éjszakai fény |
| 9 | **Kereskedelmi és ipari** | irodai lámpatest (alacsony káprázás, UGR), csarnokvilágító (high bay), LED-fénycső és armatúra, üzletvilágítás sínen, polcvilágító (retail), parkolóházi lámpatest |
| 10 | **Niche** | növénynevelő (grow light), akváriumi, UV-C fertőtlenítő, robbanásbiztos (Ex), színpadi és mozgófejes, száloptikás csillagos mennyezet, napfénycső (fénycsatorna), HCL / hangolható fehér (human-centric), sütő- és hűtővilágítás, vizsgáló- és műtőlámpa, jelzőfény (toronyfény) |

## 3. The card (kind `lampa`)

The common head (id, title, aka, place, terms HU/EN/DE, shop, reviewed) plus:

- `family` (1–10 above) · `mounting` (mennyezet, fal, süllyesztett, függesztett, sín, padló/föld, bútor, dugaszolós)
- `sources` — what light source it takes: integrált LED, E27 / E14 / GU10 / G9 / GU5.3 foglalat, LED-cső (T8), modul
- `protection` — IP (por és víz), IK (ütés), érintésvédelmi osztály (I, II, III)
- `photometry` — typical ranges: fényáram (lm), teljesítmény (W), fényhasznosítás (lm/W), színhőmérséklet (K),
  színvisszaadás (CRI / Ra), sugárzási szög, káprázás (UGR) where it matters
- `control` — kapcsolt, fázishasításos dimmer (élvezérelt és fázisvégi), 1–10 V, DALI, Zigbee / Wi-Fi / Thread,
  mozgás- és fényérzékelő; links to the Kommunikációs vonalak cards
- `install` — doboz és rögzítés (links to Rögzítéstechnika: csillárkampó, gipszkarton, üreges födém), driver helye,
  hőelvezetés és beépítési mélység, tűzvédelmi jelölés, a vezeték bekötése (sorkapocs, Wago)
- `rules` — MSZ EN 60598 (lámpatestek), fürdőszobai zónák (MSZ HD 60364-7-701), vészvilágítás (MSZ EN 1838,
  MSZ EN 60598-2-22), kültéren IP; summaries and references only
- `symbol` — the Rajztár symbol id, so the Planner and the drawings use the same sign
- `rooms` — where it is typical (nappali, konyha, fürdő, folyosó, kert …) and what it is good and bad at
- `traps` · `related`

A card may carry a small generated drawing like the line cards: the light distribution (sugárzási
karakterisztika) as a polar curve, so a downlight, a wall washer and a pendant compare at a glance.

## 4. Links to what exists

- **Kisokos:** Rögzítéstechnika (fixing), Kommunikációs vonalak (control), Előírások (rules); in the 3D
  view the volume sits in the core, leaning to the *Mélység → Alkalmazás* entry point (Rendszerek a lakásban),
  with the niche families (9, 10) gravitating to *Rokon szakmák → Ipari és kereskedelmi*.
- **Rajztár:** the drawing symbols of the fixtures.
- **Készlet / Inventory:** stocked fixtures with prices point at their type card.
- **Planner:** a placed fixture can open its type card.

## 5. Order

1. ✅ Families 1, 2, 6 (ceiling, wall, wet rooms): 25 cards (2026-11-22).
2. ✅ Families 3, 4, 7 (hidden, furniture, outdoor): 24 cards (2026-11-22).
3. ✅ Family 8 (emergency): 8 cards, plus 7 Előírások summary cards (MSZ EN 1838, 50172, 60598-2-22, 50171,
   62034, ISO 7010, OTSZ/TvMI) that the lamp cards link through `norms` (2026-11-22).
4. Families 5, 9, 10: completeness.
5. ✅ The light-distribution drawing: generic per type (`distribution: { type, angle }`), built with step 1.

## 6. Decisions (2026-11-22, the Founder: "go with your proposals")

VT1–VT3 = the proposals below: plug-in lamps in, briefly; types now, products later from Inventory; a generic
light-distribution drawing per type, real LDT / IES files only once a product card exists.

### The questions as they were asked

- **VT1** Plug-in lamps (family 5): in the catalogue as types, or left out because nothing is installed?
  Proposal: in, briefly, because clients ask.
- **VT2** Products: only types now, and products from Inventory later? Proposal: yes.
- **VT3** The light-distribution drawing: generic per type, or from real LDT / IES files of chosen products?
  Proposal: generic first; real files when a product card exists.

## 7. DevLog entry (paste into `notes/devlog/lines.js` on H:)

`notes/devlog/` is outside git, so this line could not be added from the cloud session. Fields as the
Stack reads them (`Stack/lib/layers.js` devlog()); put it in the lane where the Kisokos lives, and if the
Kisokos itself has no line yet, add that first and keep `from` pointing at it.

```js
{ id: 'kisokos-vilagitotest', name: 'Kisokos · Lámpák és világítótestek', lane: '<the Kisokos lane>',
  status: 'active', from: ['kisokos'],
  brief: 'Dedicated catalogue of every light fixture type, from the basic ceiling lamp to the niche ones: one card per type, with fixing, control, rules and the Rajztár symbol linked.',
  milestones: [['11-22', 'idea recorded: docs/kisokos/vilagitotestek.md; volume vt planned in Kisokos/map.json'],
               ['11-22', 'VT1–VT3 answered (proposals); families 1, 2, 6: 25 type cards with generic light-distribution drawings'],
               ['11-22', 'families 3, 4, 7: 24 more type cards (49 in all); uplight and upward-asymmetric distributions'],
               ['11-22', 'family 8: 8 emergency types (57 in all) + the first 7 Előírások cards, linked by norms']],
  remaining: ['Founder review of the 57 cards and the 7 Előírások cards', 'families 5, 9, 10'],
  nextStep: 'Review the emergency cards against the current editions, then families 5, 9, 10 (plug-in, commercial and industrial, niche).',
  notes: ['Types, not products; products come from Inventory and point at their type.'],
  feeds: [['kisokos']] },
```
