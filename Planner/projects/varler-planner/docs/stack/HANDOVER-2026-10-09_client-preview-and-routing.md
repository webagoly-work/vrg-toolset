# HANDOVER — client preview · CLA test plans · routing workshop

*On-ramp for a fresh session picking up these threads. Written 2026-10-09 at the end of the session
that built them (archived). About five minutes to read. For the Planner codebase itself, read
`docs/PRIMER.md` first — this file covers only these threads.*

---

## 0. Before anything

- **Worktree:** `H:\VRG\Backup\archive\parked\2026-10-24\wt-planner-stack`, branch `planner-stack`, **not pushed** (the
  user pushes). This thread's commits: `1d5569a` (client preview) and `7764b36` (test plans +
  workshop docs).
- **Other sessions share this worktree.** On 2026-10-09 it held another session's *uncommitted*
  view-scale / icon-set round: `src/*` edits, `05z-icons.js`, `spec-56`, `spec-57`, `tools/serve.js`,
  `docs/PRIMER.md`. Run `git status` before committing, and **commit with explicit paths, never
  `git add -A`**.
- **Memory notes** (auto-loaded): `project-client-preview-and-brochure`,
  `project-stack-routing-workshop`, `project-planner-bridge-stack`.
- **Tests need jsdom from the main checkout:**
  `NODE_PATH=H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/node_modules`.
  `npm test` does not build; run `node build.js` first.

## 1. The threads, and where each one stands

| thread | state | where |
|---|---|---|
| **Design system "VRG Title Card"** | done, v3. Direction A (dark-first, Marcellus / Jost / Azeret Mono, one sand accent). v3 dropped the Pince from the stack demo and added the rule that out-of-scope levels ghost | artifact https://claude.ai/artifact/WqPYqR62uexttguVKRUJbP — read `project/README.md`; to change it, `Artifact read` the files, edit, republish (Design System type rules). Copies in `projects/client-preview/src/ds/` |
| **Client preview (WebGL)** | phases 1–2 of 5 done, at the look checkpoint | `projects/client-preview/README.md` (dev loop, module table, phases) · Planner side `src/05y-client-preview.js` (`cpvModel`), `tests/spec-55` |
| **CLA test plans** | v1 + v2 committed | `Calculator/CLA-teszt_v1.vplan.json`, `_v2` · generators `tools/testplans/cla-teszt.js`, `cla-teszt-v2.js` · review sheet `render-plan.js` |
| **Routing workshop** | answered 17 / 17 — next build round can start | `docs/stack/WORKSHOP-001_routing.md` (§7 answers, §6 round plan) |
| **Cluster housings / flush covers** | IDEA-001 later round · IDEA-002 answered, 3 items open | `docs/stack/IDEA-001…`, `IDEA-002…` (§10 answers), `FLUSH-COVERS-001.json` |
| **Tuner copy** | sent to the user | `H:\VRG\Full\inbox\BRIDGE Tuner - WORKSHOP-001.html` — 4 packs: routing, design (140/141 preloaded), rooms (45/47 preloaded), flush covers |

## 2. What was decided (the short list)

**Client preview.**
- **Libraries and placement:** three.js 0.169.0, vendored via `vendor-manifest.json` (npm, sha512); the export lives inside the Planner.
- **CLA upper floor:** imported from the BRIDGE sheet as a ghost (`client-preview/tools/cla-upper-import.js`).
- **Level scope:** in / ghost / skip; a hidden level with geometry ghosts, an empty one is skipped.
- **Cutaway:** walls cut at 1.2 m on in-scope levels.

**Test plans.**
- **Orientation:** CLA turned 180°, because that is how the user describes it. The Planner and the BRIDGE sheets show szoba top-left.
- **Rooms:** exact walls, WC / kamra / lépcső kept.
- **Dedicated circuits:** kitchen + klíma + washing machine.
- **Client endpoints:** the plan's orange Order layer, plus its notes, plus sheet r2. The bathroom LED goes in the walls.
- **Golden path:** two lanes, a CHANNEL lane and the 230 V lighting string, with separate spine penetrations.
- **Portal boxes:** 10 × 10 at the latch-side upper corner, falling back to the hinge side or the other room's face when there is no room.

**Routing answers (WORKSHOP-001 §7).**
- **Method:** build with B, select with A, provision on purpose.
- **Heights:** spine at ceiling − 300; switches at **1100**, with the ≈ 1300 band for smart control.
- **Route types:** mixed by default (MAINS on walls, SELV / data in floor); ceiling a full third type; floor parallel with diagonal per room.
- **Boxes:** **partitioned wherever families meet**.
- **Housings:** full size, plus a smaller-sufficient suggestion.
- **Order:** MAINS → MEDIA → rest → SECURITY.

**Flush covers (IDEA-002 §10).**
- **Decided:** two-tier strategy; Chorus ONE for clusters and Asfora for plain rewires; a second hatch supplier.
- **Open:** hatch sizes.
- **Parked:** the portal box (a placeholder).
- **Locks:** push-open *and* key-on-MAINS kept as variants.

## 3. Next steps, in order

1. **Regenerate the CLA test plans for switches at 1100.** v2's door columns become SWI 1100 ·
   NTL / PAN / THR in the 1300 band. *Ask first:* v1 may hold the user's hand-drawn bronze path.
   Either regenerate only v2, or v1 into a new file. Commands in §4.
2. **Client preview phase 3:** endpoint hover / click lights its circuit to the Elosztó, in its
   `circuit-*` colour.
   - **Model side:** `cpvModel` gains `circuits` from `data.runs` (E3 fill) and `rgBuild` edge
     geometry, with a fallback to 05j circuits.
   - **Test bed:** the user's bronze path (kitchen → Elosztó) in v1.
3. **Client preview phase 4:**
   - Start Tour → top-down overview + summary → Next room by room (camera eases, halo,
     RoomBrief).
   - Then a float back out to the thank-you slide, with **a cég e-mail címe** as selectable
     text.
4. **Client preview phase 5:**
   - A Planner menu action, a per-level scope dialog, and the template injected at the Planner's
     build.
   - **Fonts embedded** (Marcellus / Jost / Azeret Mono): this needs downloads, so ask the user.
5. **Routing round R1–R7** (WORKSHOP-001 §6, adjusted by §7):
   - `ROUTE_RULES` table → W router (foundation-first buy-at-bulk over E2's graph, spine T-boxes)
     → F + C routers → usage sets, installed = used, provisioned `SPARE` → layer selection UI
     → mixed mode by default → IDEA-001 housings.
   - **Acceptance pair:** v2 with every layer above MAINS off must equal routing v1 directly.
6. **Brochure** (BRIDGE, CLA-led, philosophy not manual) — after the viewer.

## 4. Commands

```bash
cd H:/VRG/Backup/archive/parked/2026-10-24/wt-planner-stack/Planner/projects/varler-planner
export NODE_PATH=H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/node_modules
node build.js && node tests/run.js                                  # suite + golden
# test plans (v2 reads v1)
node tools/testplans/cla-teszt.js v1 ../../../Calculator/CLA_vplan_updated.json ../../../Calculator/CLA-teszt_v1.vplan.json
node tools/testplans/cla-teszt.js v2 ../../../Calculator/CLA-teszt_v1.vplan.json ../../../Calculator/CLA-teszt_v2.vplan.json
node tools/testplans/render-plan.js ../../../Calculator/CLA-teszt_v2.vplan.json ../client-preview/dev/v2-plan.html
# client preview
cd ../client-preview
node tools/cla-upper-import.js ../../../Calculator/CLA_vplan_updated.json ../../../Calculator/CLA_vplan_upper-ghost.json
node tools/model-from-vplan.js ../../../Calculator/CLA_vplan_upper-ghost.json dev/cla.model.json
node build.js --model dev/cla.model.json --out dev/cla.html
```

Browser pane: launch configs in `H:\.claude\launch.json` — `client-preview-dev` (port 8139, serves
`projects/client-preview`, opens `dev/cla.html`) and `planner-stack-dist` (8138, the worktree build;
load a plan with `hardResetWorkspace(); applyProjectData(o.project)`). The pane is narrow: judge
plans with `render-plan.js` sheets, not Planner screenshots.

## 5. Traps that cost time in this thread

- **Minified three.js declares `$`, `t`, `S`… at top level.** The build wraps it in its own
  function. A page script that fails to parse fails *silently* in the browser, so `build.js`
  parse-checks it.
- **The browser pane serves `file://` pages as stale `data:` snapshots.** Use the launch-config
  servers.
- **`CLA_vplan_updated.json`'s notes sit 180° rotated** against its walls and devices; map back
  with `(10758 − x, 11130 − y)`. Its devices are fine.
- **Device `side` is stored 1 / 0** (+perp / −perp). Suggestion helpers return ±1, so convert.
  Wall devices sit on the wall *centreline*.
- **Turning a plan 180°:** keep `ang` (0 or π/2) and flip `variant ^= 3`. The renderer hangs the
  hinge from the rect's min corner, not from `ang`.
- **`sugDoor` / `sugDoorPt` (05t) give the latch side** of any door for any room. Reuse them.
- **RBX refs default to the room number** (K19: RBX03, RBX06). The test plan sets RBX01 / RBX02
  explicitly.
- **Tuner answer ids allow no dash:** `R01`, not `Q-R01`.
- **`ELO_RULES.lightPerRbx`** still counts one lighting way per RBX. The user's rule is one
  lighting string through every RBX, so the cabinet calculation has to follow.
- **No fan / ventilation endpoint code** in `EP_CAT`: the extractor is modelled as an LMP output.
  **SECURITY needs an SSC node**, which isn't placed.

## 6. Progress log

| date | what | commit |
|---|---|---|
| 2026-10-07 | Design direction picked (A · Title Card); design system published, v1 | artifact |
| 2026-10-07 | Client preview phase 1 (`cpvModel`, spec-55) and phase 2 (viewer shell); three.js vendored | `1d5569a` |
| 2026-10-09 | Design system v3: Pince removed, out-of-scope levels ghost | artifact |
| 2026-10-09 | CLA test plans v1 (client endpoints) and v2 (every layer), generators and review sheet | `7764b36` |
| 2026-10-09 | WORKSHOP-001 routing method + rulebook; IDEA-001 cluster housings; IDEA-002 flush covers (from a parallel session) | `7764b36` |
| 2026-10-09 | Tuner copy with four packs sent; the user answered routing 17 / 17 and flush covers 6 / 6; answers recorded | `7764b36` |
| 2026-10-09 | This handover written; session archived | uncommitted |
