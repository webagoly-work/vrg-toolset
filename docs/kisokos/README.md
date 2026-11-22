# VRG Kisokos — idea (2026-11-21)

An offline, ever-growing work handbook: an encyclopaedia of everything a residential electrician
meets, with **Villanyszerelés (lakossági, a mérő után)** at the centre and the rest of the
knowledge laid out along axes around it. It fills the empty **Atlas** slot of the Tudásbázis
(TUD) group in `docs/hub/02_BUSINESS-TOPOLOGY.md`.

Interactive map and samples: <https://claude.ai/artifact/VAYKEg72w1ABa8hTqyy9Q3>
(archived as `Archive` item `vrg-kisokos`).

Status: **started** (2026-11-21). The sources live in `Kisokos/` (see its README); the Stack has a
dedicated layer for them, **K · Kisokos**, shown in 3D by `Stack/kisokos.html` (START R → S). The first
volume, Rögzítéstechnika, has 53 draft cards; the second, Kommunikációs vonalak (2026-11-22), has 27
draft line cards, each with the same generated one-pager drawing (`Kisokos/kommunikacios-vonalak/svg/`).

## 1. The topology: 8 axes, 4 rings

Every topic has a place: **axis**, **pole**, **ring**. The two poles of an axis sit opposite each
other on the map. The ring is the distance from daily work: **1** = needed on the job tomorrow,
**2** = professional background, **3** = the neighbouring field, **4** = the horizon of the field.

| # | Axis | Question | Pole A (ring 1 → 4) | Pole B (ring 1 → 4) |
|---|------|----------|---------------------|---------------------|
| 1 | Mélység | how theoretical? | **Elmélet**: villamosságtan → elektromágnesség → anyagfizika → kvantum-határ (QED, szupravezetés, spintronika) | **Alkalmazás**: szerelési gyakorlat → rendszerek a lakásban → ügyféligény → üzemeltetés |
| 2 | Tudásút | which learning path? | **Akadémiai ág**: BSc alapok → MSc szakirány → doktori kutatás → kutatási front | **Szakképzési ág**: kezdő → szakmunkás → mester/tervező → szakértő (érintésvédelem, villámvédelem) |
| 3 | Értéklánc | where does the material come from and go? | **Nyersanyag felé**: nagykereskedés → gyártás → feldolgozás → bányászat | **Végfelhasználó felé**: átadás → használat → bővítés/felújítás → bontás, újrahasznosítás |
| 4 | Lépték | how big a piece? | **Mikro**: szerelvény → alkatrész → anyag → elektron, atom | **Makro**: áramkör, helyiség → lakás → épület, társasház → ország, kontinens |
| 5 | Rokon szakmák | who else works with electromagnetism? | **Erősáram**: ipari/kereskedelmi → elosztás → átvitel → termelés | **Gyengeáram**: biztonságtechnika → épületautomatizálás → távközlés → elektronika, mikrochip |
| 6 | Általános–specifikus | from principle to part number | **Általános**: szakmai szabályok → műszaki elvek → méretezés → természettörvények | **Specifikus**: termékcsalád → gyártói rendszer → típus és adatlap → a mi munkánk (Planner, job folder) |
| 7 | Hagyományos–modern | which era's solution? | **Hagyományos**: mai hagyományos → régi lakások (Al vezeték, TN-C) → örökölt rendszerek → a villamosítás története | **Modern**: okos szerelvények → okosotthon-rendszerek → energiamenedzsment → ami jön (DC lakáshálózat, félvezetős megszakító, V2H) |
| 8 | Építkezés | who shares the site? | **Szerkezet**: kőműves → szárazépítő → ács, tetőfedő, bádogos → földmunka, alapozás | **Gépészet, befejezés**: víz-gáz-fűtés → burkoló → festő → asztalos, konyhabútor |

The user's "upstream / equal / downstream" maps onto axes 1, 3 and 5: upstream knowledge is
axis 1 A, the upstream supply chain is axis 3 A, and "equal" (the other slices of the
electromagnetism pie, and the other slices of the energy sector) is axis 5.

## 2. Volumes (kötetek)

The axes say *where* a topic sits; a volume says *in what form* it is in the Kisokos. A topic can
be in several volumes.

| id | Volume | Content | Sources |
|----|--------|---------|---------|
| tk | Tankönyv | the full electrician syllabus by level, beginner to master/designer | own writing, open textbooks, references to owned textbooks |
| al | Alapok és kutatás | physics above the trade, up to the research front | OpenStax (CC BY), LibreTexts, MIT OCW, arXiv |
| sz | Szakmatérkép | sectors and value chain, mine to recycling | own writing, industry sources |
| ez | Eszköztár | ever-growing catalogue: traditional and modern devices, smart, automation, energy | Inventory, CoreRef, datasheets |
| ts | Társszakmák | neighbouring trades: workflow, needs, interference points, order on site | own experience, trade descriptions |
| rg | Rögzítéstechnika | one card per material: drilling, bit, anchor, screw, load, traps, search terms | manufacturer catalogues, own experience |
| kv | Kommunikációs vonalak | one-pagers on one shared frequency / wavelength scale | standards summaries, open sources |
| el | Előírások | which standard / rule covers what; own summary + reference only | summaries only |
| vt | Világítótestek | every light fixture type, ceiling lamp to niche (planned 2026-11-22, `vilagitotestek.md`) | types from catalogues; products from Inventory |
| sx | Szótár | cross-cutting: every term in HU · EN · DE with synonyms (tipli = dübel) and shop type | own collection |

## 3. Card formats

Every page is a markdown file; cards share a JSON schema so the map, the search and the mobile
view are generated from them. Each card carries its map position.

```jsonc
// common head on every card
{ "id": "rg.porotherm", "kind": "material", "title": "Üreges kerámia falazóblokk",
  "axis": 8, "pole": "A", "ring": 1, "volumes": ["rg"],
  "terms": { "hu": [], "en": [], "de": [] }, "sources": [], "reviewed": null }
```

**Material (Rögzítéstechnika)** — `recognise` (dust colour, sound, how the bit behaves),
`drill` { `hammer`: true/false, `bit` }, `anchors` { `light`, `medium`, `heavy` }, `screw`,
`traps[]`, `terms` HU/EN/DE, `shop` (DIY store vs fixing-specialist vs wholesaler).
Planned materials: beton, vasbeton, üreges födémpanel, tömör tégla, üreges kerámia falazóblokk,
pórusbeton, mészhomoktégla, salakblokk, vályog, terméskő, gipszkarton, gipszrost, OSB és fa,
trapézlemez, szendvicspanel, ETICS homlokzat, csempe és járólap, üveg.

**Line (Kommunikációs vonalak)** — `how`, `medium`, `signal` + `waveform` (one of: sine, dc, manchester,
baseband, diff, carrier, ofdm, light), `bands` [[f_min, f_max], …] in Hz (the wavelength is computed,
λ = c/f; `[]` = DC), `topology`, `power`, `cable`, `standard`, `install[]`, `related[]`, `rate`, `distance`, `connector`, `home` (where it appears in a flat). Every line is drawn
on the same log scale, 1 Hz to 1 PHz, with the wavelength underneath. Seed list: 50 Hz mains
(reference), 0–10 V / 4–20 mA, DALI, KNX TP, RS-485/Modbus, narrowband PLC (CENELEC A), VDSL2,
broadband PLC, Ethernet Cat5e–6A, coax TV, coax SAT IF, 868 MHz (Z-Wave, LoRa), 2.4 GHz
(Wi-Fi, Zigbee, Thread, BLE), Wi-Fi 5 and 6 GHz, single-mode and multimode fibre.

**Trade (Társszakmák)** — `workflow[]`, `tools[]`, `needsFromUs`, `weNeedFromThem`,
`interference[]`, `sequenceStep`. The site sequence itself is one list (alapozás → falazás → tető
→ gépészet durva → **villany durva** → szárazépítés → vakolás → burkolás → festés → bútor →
**villany finom, mérés, átadás**), each step with "what the electrician must have done by then"
and "what goes wrong if not".

**Device (Eszköztár)** — `category`, `era` (axis 7), `protocols[]`, `symbol` (Rajztár id),
`inventoryRef`, `corerefRef`, `datasheets[]`.

## 4. Sources and rights

- **Free to store verbatim**: OpenStax University Physics (CC BY), LibreTexts, MIT OpenCourseWare,
  Wikipedia offline (Kiwix ZIM), arXiv abstracts. Licence and attribution travel with the text,
  as for `Vendor/`.
- **Manufacturer datasheets and catalogues**: downloaded for own use, with source and date.
  Large files go to `Shared`, not into git.
- **Standards (MSZ, EN) and textbooks**: copyrighted. Only our own summary plus the reference goes
  in; the full text stays with the purchased copy.

## 5. Links to what exists

- **CoreRef** (ESPHome / Home Assistant offline reference) → the smart part of Eszköztár.
- **Inventory** (`Inventory/data/vrg-inventory.json`) → device cards with price and supplier.
- **Rajztár** (`shared/rajztar`) → the drawing symbol on each device card.
- **Planner** → the far end of the "Specifikus" pole: the concrete job.
- **VRG Stack** → indexes the cards so `stack_search` finds them.

## 6. Suggested order

1. Rögzítéstechnika: about 20 material cards. Finite, useful at once.
2. Kommunikációs vonalak: about 17 one-pagers on the shared scale.
3. Társszakmák: 10 trade cards and the site sequence.
4. Eszköztár: continuous; starts from Inventory and CoreRef.
5. Tankönyv and Alapok: the longest work, level by level.

## 7. Open questions

- **K1 Where does it live?** Proposal: text and cards in the repo (`Kisokos/`), large files
  (PDFs, ZIM) in `Shared`, referenced by path.
- **K2 Language?** Proposal: text in Hungarian, search terms HU/EN/DE, open source material in its
  original language.
- **K3 The full offline Wikipedia (Kiwix)?** Proposal: the Hungarian edition whole, from the
  English one only the electrical and construction topics.
- **K4 A client-facing variant?** If clients ever see parts (e.g. a smart-device comparison), that
  part uses the Varler look, not Mélyvíz.
- **K5 Who writes it?** Proposal: an agent gathers sources and drafts, the Founder reviews, and only
  reviewed cards are marked `reviewed`. For Rögzítéstechnika the Founder's site experience rules.

## 8. Decisions (2026-11-21, the Founder: "go with your proposals")

- **K1 = proposal.** Text and cards in the repo (`Kisokos/`); large files (PDF, Kiwix ZIM) in `Shared`,
  referenced by path.
- **K2 = proposal.** Hungarian text; search terms HU · EN · DE; free sources in their own language.
- **K3 = proposal.** The Hungarian Wikipedia ZIM whole, from the English one only the electrical and
  construction topics. Not downloaded yet: it is a multi-gigabyte fetch for the H: session, into `Shared`.
- **K4 = proposal.** A client-facing part, if one ever comes, uses the Varler look.
- **K5 = proposal.** An agent drafts and sources, the Founder reviews; only reviewed cards carry a
  `reviewed` date.
- **The Kisokos lives on the Stack on its own layer** (K). Its 3D view is a digital shadow of `Kisokos/`:
  the core as a sphere, the axes through it, 1 cube = 1 KB of knowledge.

## 9. Not yet done

- The idea is not yet in the idea timeline (`notes/idea-timeline/data.js`, outside git): add it in
  the H: session so the Stack's I layer shows it.
- Every Rögzítéstechnika and Kommunikációs vonalak card waits for the Founder's review.
- `Stack/layers.html` (the exploded layer planes) does not draw K yet.
- The other volumes have term nodes but no cards.
- **Világítótestek (vt)**: families 1–4, 6, 7 drafted (49 cards); families 5, 8, 9, 10 to come (`vilagitotestek.md`).
  Its DevLog line is written out there, ready to paste into `notes/devlog/lines.js` on H:.
