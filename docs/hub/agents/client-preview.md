# Client Preview — agent init
*For a Claude Code session that will work on Client Preview. Read this, then the files in §3.*

## 1. What it is
An offline, single-file 3D page a client opens to explore their plan: spin and zoom the building,
click a room for its halo and room card. Hungarian first, English switch, dark and light themes.

## 2. Where
- `Planner/projects/client-preview/`: `src/` (concatenated in filename order into one module),
  `build.js`, `tools/`. Planner side: `05y-client-preview.js` (`cpvModel()`).
- three.js from `Vendor/three` (`node tools/fetch-vendor.js three` once, from the repo root).

## 3. Read first
1. `Planner/projects/client-preview/README.md`
2. `Planner/projects/varler-planner/docs/stack/HANDOVER-2026-10-09_client-preview-and-routing.md`

## 4. Build / test / check
```bash
cd Planner/projects/client-preview
node build.js                                          # dist/client-preview.template.html
node build.js --model dev/cla.model.json --out dev/cla.html
```
The model comes from `tools/model-from-vplan.js` (README "Dev loop").

## 5. Rules and traps
- The look is the VRG Title Card design system; `src/ds/` is a copy: edit the design system and
  re-copy, never the copy (README).
- The model JSON is the whole contract: the Planner never ships three.js, the page never sees
  Planner state (README).
- `dev/` holds client plans and is gitignored (README).

## 6. Current state
- 2026-10-07 Client preview: preview model in the Planner, WebGL viewer shell (look checkpoint)
- Phases 1–2 done; 3 interaction, 4 tour, 5 export open (README "Phases"). Decision files: none.

## 7. Do not touch
- `src/ds/` by hand; `dev/` client plans (README).

Forrás: Planner/projects/client-preview/README.md, git log main, 2026-10-22
