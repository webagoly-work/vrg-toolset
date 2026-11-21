# VRG Térkép — Térkép-feed (F): the nearest useful places around you

*WP M55, built 2026-11-21: N1 of the navigation line (N1 feed, N2 own routing, N3 traffic and guidance).
Decisions D-129 … D-132 in `docs/mobile/DECISIONS.md`.*

## What it does

- **F** (or the **Feed** button) opens a list of up to six places, one per category, in the order you
  chose. Each card shows the nearest place of its category: name, kind, **straight-line distance** and a
  **rough ETA** (🚗 Autó / 🚶 Gyalog in the header).
- Every place gets an icon on the map and a dashed **ghost line** from your position to it.
- **Tap** a card or an icon: the map frames you and that place. **Hold** it (or right-click on the PC):
  it is **selected**. The others hide, a solid line joins you and it (the "spider"), and the card offers
  **Navigáció** (today: the phone's navigation app, or OpenStreetMap's directions on the PC) and
  **✕ Vissza**.
- The list follows you: it is recalculated after 25 m or 30 s of movement. A selected place stays the
  target while you move, with its distance and ETA updated.
- **⚙**: switch categories on or off (at most six), set **Otthon** (your position or the map's centre),
  add your own **Daniella** or **Szerelvénybolt** where OSM lacks one. Your own pins are kept in this
  browser's storage only. On the phone that is the phone. They are never sent anywhere (VRG Mobile D-31).
- `?feed=1` opens it.

## Categories (lib/feed.js)

| Card | Default | OSM |
|---|---|---|
| 🏠 Otthon | on | your own pin only |
| ⚡ Daniella | on | `name` or `brand` contains "Daniella" (a shop), plus your own pins |
| 🔧 Szerelvény, barkács | on | `shop` = electrical, hardware, doityourself, trade, tools, lighting |
| 🛒 Élelmiszerbolt | on | `shop` = supermarket, convenience (Aldi, Spar, Lidl, Penny, CBA …) |
| 🍽 Étkezés | on | `amenity` = restaurant, fast_food, food_court |
| 🏥 Kórház, orvos | on | `amenity` / `healthcare` = hospital, clinic, doctors |
| 🧰 Kínai bolt | off | `shop` = variety_store (the Asian general stores) |
| 🚻 Nyilvános WC | off | `amenity` = toilets, not `access` private / no / customers |
| 🚏 Megálló | off | bus stops, tram stops, stations and halts, bus stations (BKK live departures: later, D-132) |

## Data

`Map/tools/build-pois.js` reads the Hungary OSM extract the map already downloads
(`Map/data/src/hungary-latest.osm.pbf`) in two passes, so a shop drawn as a building outline gets a point
too, and writes `Map/data/pois.json` (compact; one point per name and category within 40 m, so a stop's two
poles are one). `node Map/tools/fetch-data.js --only=osm,pois` builds it; START M's first run does all
parts. The PC serves it at `/data/pois.json`. VRG Mobile keeps the copy it reads through the relay, so
the feed works offline on site after one paired opening. `Map/tools/osm-pbf.js` is the shared .pbf
reader. Relations (multipolygons) are not read.

## Limits

- **ETAs are straight-line estimates.** Distance × 1.35 at 28 km/h by car (+1 min), × 1.25 at 4.8 km/h on
  foot. Real routing is N2 (D-129 A: our own offline road network). No traffic until N3 (D-130).
- OSM's coverage decides what is found: not every Daniella or toilet is mapped (add your own pins).
- On the PC the position is the browser's (often Wi-Fi based, or none: then the map's centre is used, and
  the header says "a térkép közepétől").
- Without `pois.json` (no OSM extract on the PC, or a phone never paired) only your own pins show.

## Tests

`Map/test/feed.test.js`: the categories and OSM matching, the six-slot rule, distance and ETA, the feed
with own pins, and build-pois on a real .pbf written by `Map/test/pbf-writer.js`. `Map/test/feed-page.test.js`:
the layer in headless Chromium with the real MapLibre, a faked GPS and invented places: the six cards,
icons and ghost lines, Otthon, the six-slot refusal, hold to select (the spider), right-click on an icon,
tap without selecting, following the position, closing.
