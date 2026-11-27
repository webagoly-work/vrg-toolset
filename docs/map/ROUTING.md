# VRG Térkép — our own offline routing (N2)

*WP M56, built 2026-11-21: N2 of the navigation line (D-129 A: our own offline road network; D-130: no
traffic yet). It routes the Térkép-feed's places (`docs/map/FEED.md`); turn-by-turn guidance and traffic
are N3.*

## What it does

- **In the Térkép-feed**, each card's time and distance become **road** values ("260 m úton") wherever a
  road leads there, computed one after the other in the background. A place with no road within 400 m
  keeps the straight-line estimate ("légvonal").
- **Holding a place** (the spider) plans the route on our road network, by car or on foot as the header
  says. It is drawn in the place's colour instead of the straight line, and the map frames it. As you
  move, the card counts down what is left. If you leave the route by more than 45 m, it is planned again
  (at most every 8 s).
- **Navigáció appban** still hands the place to the phone's navigation app (or OSM directions on the PC)
  for spoken guidance until N3.
- Nothing is sent anywhere: the network is a file on the PC, kept on the phone, and the route is computed
  in the page.

## How

- `Map/tools/build-roads.js` reads the Hungary OSM extract in two passes (the ways, then their nodes) and
  writes `Map/data/roads.bin`. It keeps every way a car or a pedestrian can use. Tracks, bridleways,
  construction and proposals are left out, and so is `access=private/no`. Pedestrians stay off motorways,
  trunks and cycle paths (unless `foot` allows them).
  - Junctions and way ends are the graph's nodes. Each stretch between two of them is an edge with its
    length, a car speed and car-forward / car-backward / foot flags (one-ways, roundabouts, motorways).
    Its shape is simplified to 4 m.
  - Car speed is 85 % of `maxspeed` (HU:urban 50, HU:rural 90, HU:motorway 130), else a typical speed for
    the road class (`SPEED` in `lib/route.js`: residential 28, primary 60, motorway 110 …). On foot
    everything is 4.8 km/h, steps 2.5.
  - The file is varint-coded and deflated.
  - `node Map/tools/fetch-data.js --only=osm,roads` builds it (a few minutes, up to 8 GB of Node memory).
- `Map/lib/route.js` (also Node) decodes it into typed arrays and snaps to the nearest junction the mode
  may use. It runs A* by travel time, with the straight line at 130 km/h (or walking pace) as the
  estimate, so the answer is the quickest route on this network. The search yields to the page every
  40 000 steps.
- `Map/lib/route-layer.js` loads the file once (the browser's `DecompressionStream`), plans and draws.
- VRG Mobile keeps `roads.bin` like the address index and the feed's points (public ODbL data), after one
  paired opening of the map.

## Measured here (cloud session)

- On a synthetic 700 × 700 city grid (490 000 junctions, 980 000 edges): decoding 0.16 s; a 7 km route
  3 ms; a 230 km route 0.2 s (Node). Hungary has more junctions than that. The real file size, memory and
  timings are measured on the PC when `roads.bin` is first built (Geofabrik is blocked in the cloud).

## Limits

- **No traffic** (D-130) and no turn costs or traffic lights: car times are on the optimistic side in
  towns. No turn restrictions yet (`restriction=*` relations are not read). No ferries.
- Snapping is to the nearest junction, not the nearest point of a road. In a long street the route may
  start or end at the block's corner; the walk there is counted.
- The whole network loads into memory. On an older phone, check the first opening's time.

## Tests

`Map/test/route.test.js`, on an invented network written as a real .pbf:
- the way rules;
- the file (junctions only, a way split at a junction, a track left out, a bend kept);
- by car the faster primary, on foot the shorter street;
- a one-way (round by car, straight on foot);
- a motorway pedestrians cannot use, and a footway cars cannot;
- snapping, and both ends snapped to one junction;
- following a route;
- async = sync;
- the inflate path.

`Map/test/feed-page.test.js` checks the road distances on the cards, the drawn route round a corner and
the countdown in headless Chromium.
