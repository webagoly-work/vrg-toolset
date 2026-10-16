# Client preview (ügyfél-előnézet)

An offline, single-file 3D page a client opens to explore their plan: spin and zoom the building,
click a room for its halo and room card, and (coming) follow a circuit from an endpoint to the
Elosztó and take the guided tour. Hungarian first, English switch, dark and light themes.

The look is the **VRG Title Card** design system
(https://claude.ai/artifact/WqPYqR62uexttguVKRUJbP). `src/ds/` is a copy of its tokens and
component CSS; edit the design system, then re-copy, never the copy.

## How the pieces fit

```
Planner (05y-client-preview.js)  cpvModel()  ->  model JSON (kind 'vrg-client-preview')
client-preview/build.js          src/ + Vendor/three  ->  one HTML page, model embedded
```

The Planner never ships three.js and the page never sees Planner state: the model is the whole
contract. Levels carry a scope — `in` (the work), `ghost` (part of the building, outside the
work: faint, not clickable) or `skip`. Default: shown level in, hidden level with geometry ghost,
empty level skipped.

## Build

```bash
node build.js                                          # dist/client-preview.template.html (no model)
node build.js --model dev/p33.model.json --out dev/p33.html
```

three.js comes from `Vendor/three` (npm three@0.169.0, sha512-checked): from the repo root run
`node tools/fetch-vendor.js three` once. The build wraps three in its own function scope (its
minified top-level names would collide with ours), rewrites the `examples/jsm/lines` imports, and
parses the result before writing — a page script that fails to parse fails silently in a browser.

## Dev loop with a real plan

```bash
# 1. P33 only has the ground floor; add the upper floor from the BRIDGE sheet as a ghost
node tools/p33-upper-import.js ../../../Calculator/P33_vplan_updated.json ../../../Calculator/P33_vplan_upper-ghost.json
# 2. the model, exactly as the Planner will export it (boots the built Planner in jsdom)
NODE_PATH=<a node_modules with jsdom> node tools/model-from-vplan.js ../../../Calculator/P33_vplan_upper-ghost.json dev/p33.model.json
# 3. the page
node build.js --model dev/p33.model.json --out dev/p33.html
```

`dev/` holds client plans and is gitignored. In the browser console `window.__cpv` exposes the
model, scene, orbit and halo state for checks.

## Source modules (`src/`, concatenated in filename order into one module)

| File | What |
|---|---|
| `10-util.js` | token colours, i18n, Hungarian number format, polygon centroid and offset |
| `20-model.js` | read the embedded model, room order and names, level display heights |
| `30-scene.js` | slabs, walls cut away at 1.2 m and split around doors and windows, devices, the ghost level |
| `40-orbit.js` | orbit camera: drag, right/shift-drag pan, wheel and pinch zoom, arrow keys; eased |
| `50-halo.js` | the room halo (wash, glow, line, ring), depth test off, 400 ms fade |
| `60-ui.js` | level tags, the room card, legend, language |
| `90-boot.js` | renderer, render-on-demand loop, picking, theme switch, drop-a-model dev path |

## Phases

1. Preview model in the Planner — done (`cpvModel`, spec-55).
2. Viewer shell — done, at the look checkpoint.
3. Interaction: endpoint hover/click lights its circuit to the Elosztó (needs stack data in the plan).
4. Tour: Start Tour, overview, room by room, thank-you slide.
5. Export from the Planner; fonts embedded so the page is fully offline.
