# VRG Stack (Rétegverem): read this first

*The multilayer database of the VRG work. All the maps are joined into one network: features, ideas, decisions, DevLog, agents, what agents actually did, git, code and documents. The layers are stacked top to bottom and linked vertically by shared keys and entity pillars. v1 was built 2026-11-04 and v2 (the machinery) on 2026-11-06. It sits outside the repo on purpose: it quotes client jobs, like DevLog does.*

## For an agent: ask before you read

```
cd H:\VRG\Full\notes\stack
..\..\tools\node\node.exe stack.js q "<words>" [--layer F,L,A] [--budget 900]   ranked hits (words + meaning) + their links to other layers
..\..\tools\node\node.exe stack.js node <id>                                    one node; links read as sentences, grouped by layer
..\..\tools\node\node.exe stack.js path <id> <id> [--time]                      how two things connect (--time: forward in time only)
..\..\tools\node\node.exe stack.js ent [<pillar>]                               the same thing across layers
..\..\tools\node\node.exe stack.js session [<sid8>]                             a recorded session, step by step
..\..\tools\node\node.exe stack.js drift | health | patterns | proposals        the reports
```

Cheapest first:
1. `out/codec/L0.txt` (one screen).
2. `stack.js q`.
3. `stack.js node`.
4. Only then a source file, or `Planner_VRG_U100/tools/vrg-ctx.js q` for exact lines.

Or use the MCP server (`mcp/server.js`, tools `stack_search`, `stack_node`, `stack_path`, `stack_pillar`, `stack_session`, `stack_report`, and resources `stack://codec/L0` …). It is registered at user scope (2026-11-06), so every Claude Code session on this machine sees it; `claude mcp get vrg-stack` checks it.

Never load `out/stack.json` whole. Ids look like:

| Id | What it is |
|---|---|
| `F:p9` | a feature |
| `L:views` | a DevLog line |
| `L:s0969dff9` | a session |
| `U:run.0969dff9` | what that session did |
| `R:5ee8b1e` | a commit |
| `C:Planner/src` | a code folder |
| `G:docs/solomon/README.md` | a document |
| `Q:HUB-Q3` | a decision |
| `E:planner` | a pillar |

## For the Founder

- **Search page:** `stack-search.html` (works from file://), or `node serve.js` → http://localhost:8806.
- **Replay page (Visszajátszás):** `replay.html`. Pick a session, then press play (space), step with ← →, or drag the timeline.
  - Left: every step.
  - Middle: the files as they are reached. Blue means read, warm means written, red means an error, ✓ means committed.
  - Right: the stack nodes the step lights up. They fade as the session moves on.
- **Connectome page (Konnektóm):** `connectome.html` (2026-11-07, reworked the same day). The stack as a brain, placed by function in its parts (`brain.js`, BR-Q1): the cerebrum's cortex in two hemispheres (frontal = plans, ideas, pillars, briefs; parietal + motor strip = code; temporal = memory, documents; occipital = apps, features), the diencephalon (thalamus = DevLog lines, hypothalamus = decisions, house rules, schedules), the mesencephalon (superior colliculi = signals and days, inferior colliculi = the sessions), the cerebellum (agents, tools, generators) and the brainstem (pons = runs, newest on top; medulla = commits). **Részek** shows the parts' outlines and names. One **2 KB node** = 2 KB on disk; a file's nodes grow as a patch, a string or a tree, joined by a thin web (**Háló**), and heavy lobes get a thicker grey matter. Every 12, 24, 48, 120, 220 and 400 KB of a file's continuous string is an **axiom** with its own **neuron** connector (**Axiómák**); when firing reaches a node, its axioms' neurons light up and a tracer line joins them to the run's last lit neuron. The stack's own edges are off by default (**Élek**). The newest recorded sessions replay as firing. It re-reads `out/connectome-data.js` every 60 s. Through `node serve.js`, **Frissítés** regenerates that file and **Újraépítés** runs the full build. Link to a node with `connectome.html#sel=<id>`.
- **Holo page:** `orb.html` (2026-11-07, research/ORB-PLAN.md). The same data in four forms (buttons, keys 1–4, G cycles); with **⟳ Átmenet** on, every change passes through the Mag shell. **Polip** (inverted octopus): the origin is the centre of the base, each DevLog line an arm, newest at the tip; active lines reach up, parked ones droop; decisions are the suckers. **Gömb** (holo orb): each line a ring in its own plane. **Föld** (hologram Earth, `#earth`): every 2 KB node is a dot on land (Natural Earth 1:110m mask, `earth-land.js`, made by `tools/make-earth-land.js`), every line a country with a ring at its capital, a triangle mesh over the globe, the coastline in light, bundles as arcs. **Mag** (`#core`): the breathing Jarvis particle shell with filaments (it wobbles with the firing, the inside does not), the brain inside (brain.js parts), runs and commits as two inner shell layers, and each active line's path out to its **entry point** on the surface (hover / click). **Őrség** = the lock (L, `#lock`): locked, the triangle mesh flies in and snaps onto the shell, its cross points glow faintly and the inside shrinks into a small amber orb; open, the mesh pieces hover outside, greyed, turning with the sphere. Links between lines are bundled (457 bundles); click a line in the list to isolate it. Links: `#orb`, `#earth`, `#core`, `#lock`, `#line=L:city`, `#sel=<id>`. The older Őrség hatching look (HO-Q5) is parked in the code.
- **Ötletfolyam (lineage river):** `lineage.html` (2026-11-09), the I layer in time. Each idea is a stream from its date to its last offspring; branches split off where a new idea starts, merges join; width = how many ideas lie downstream; the springs (ringed) are the inferred needs. Dormant ideas are grey, inferred links dashed. The scrubber (play, ← →) shows the river up to a day; click an idea for what it became (features, DevLog lines, commits, memory, code, linking into the Konnektóm) and where it came from. − / + zoom, `/` search, Esc clears. Links: `#sel=p7`, `#t=2026-10-01`. Data: `out/lineage-data.js` (every build, or `stack.js lineage`). START → R → 8.
- **Layers page (Rétegek):** `layers.html` (2026-11-07). The ten layers as an exploded isometric stack: each a horizontal plane laid out by its own links, the planes far enough apart not to cover each other (**Távolság** in ⚙ Nézet changes it), the cross-layer links as vertical connectors between them. Click a dot for its links grouped by layer; click a layer name to show only it and its connectors, right-click to hide it. Shift / right drag or Shift+wheel slides along the stack, double-click = the isometric home. `#full #crisp`.
- **Phone (VRG Mobile, WP M17):** both pages have touch gestures (`touch.js`: one finger orbits, pinch zooms, twist turns, two fingers up / down tilt, tap picks, double tap resets, long press selects; on Holo a two-finger swipe changes the form and a long press on empty space toggles the Őrség lock). `Planner_VRG_U100/Mobile/stack/publish-stack.js --push` (START → R → T) bundles them into self-contained pages on the `stack-pages` branch, where the app's **Rétegverem** feature reads them. Re-run it after a rebuild to update the phone.
- **Rebuild** after any change: `..\..\tools\node\node.exe stack.js build`. It takes about 6 s when little changed, and about 30 s the first time or after `--rerecord`. `build.js` still works too.
- **Is it healthy?** `stack.js doctor` checks everything; `stack.js doctor --fix` repairs and rebuilds.
- **Reports in `out/`:**

  | File | What it says |
  |---|---|
  | `HEALTH.md` | each stage, and the five checks |
  | `STATUS.md` | counts, plus the four metrics next to the previous build |
  | `DRIFT.md` | what is unfinished or quiet |
  | `PATTERNS.md` | how sessions move |
  | `PROPOSALS.md` | cards for you; nothing in it is applied |

> **Lives in the repo** since 2026-11-07: `Planner_VRG_U100/Stack` (`out/` and `data/` stay out of git). The old `H:\VRG\Full\notes\stack` is a stale copy until `tools/link-notes.ps1` replaces it with a link.

## Files

| File | What |
|---|---|
| `ARCHITECTURE.md` | **how the code is built**: the three folders, the pipeline, self-healing, where each feature lives, how to extend it |
| `RULES.md` | Rules of the Subject: multilayer networks, the twelve rules, "Huffman for agents" |
| `LAYERS.md` | the charter: each layer's rules, sources, joins and page |
| `ROADMAP.md` · `DECISIONS.md` | what comes next · STK-Q1 … Q17 |
| `research/TERMS.md` | the research-terms report the v2 choices came from |
| `stack.js` | the one command (CLI) |
| `config.js` | every path and tunable |
| `entities.js` | **by hand**: the 31 pillars |
| `schema/` | the link registry with its verbs, and the record shapes with their checks |
| `lib/` | one module per job (see ARCHITECTURE.md) |
| `mcp/server.js` | MCP server, stdio, no dependencies |
| `neurons.js` · `research/NEURON-CODES.md` | axiom neuron addresses (gate letter + 2-char file family + 3-char run) and the 13 gate kinds; `node stack.js neuron <addr>` |
| `stack-search.html` · `replay.html` · `connectome.html` · `orb.html` · `layers.html` · `lineage.html` · `brain.js` · `touch.js` · `earth-land.js` · `serve.js` | the pages (serve.js also has `POST /api/connectome` and `POST /api/build` for the connectome page) |
| `test/` | `..\..\..\tools\node\node.exe --test test/stack.test.js` |
| `out/` | derived; delete freely, `stack.js build` makes it again |
| `data/` | history (event log, metrics, daily snapshots); **keep it**, it cannot be rebuilt |

## House rules

- A source changes only by its own tool or by hand. The stack is read-only, following the Solomon rule.
- A new app or program gets a pillar in `entities.js` and a row in `notes/features/data.js` on the day it gets a folder.
- A new relation needs its verbs in `schema/links.js` first; HEALTH.md flags any it does not know.
- A new DECISIONS file format: add its namespace to `NS_BY_FILE` in `lib/layers.js`, rebuild, and check `out/codec/L2-Q.txt`.
