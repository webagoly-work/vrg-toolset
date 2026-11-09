# VRG Stack: the layers, their rules, and their pages

*The charter. Each layer keeps its own natural rules. This file says what those rules are, where each layer's data comes from, and which human page shows it. Counts are from the v1 build on 2026-11-04; `out/STATUS.md` has the current numbers.*

```
          ┌──────────────────────────────────────────────┐   pillars (E): the vertical
  F  ──── │ Featured · Kirakat         what you can use   │◄─ dashed lines through every
  I  ──── │ Ideas · Ötletfa            why it exists      │   layer, one per real thing:
  Q  ──── │ Decisions · Döntések       what was asked     │   Planner, BRIDGE, Kapu,
  L  ──── │ DevLog · Fejl. vonalak     how work moves     │   Gömb, Council … (31)
  A  ──── │ Agentic · Ügynöki gerinc   what agents read   │  ◄── the central layer
  U  ──── │ Runtime · Futás            what agents did    │   (v2: recorded sessions)
  R  ──── │ DevRepo · Repó             what was committed │
  C  ──── │ Code · Kód                 where it lives     │
  G  ──── │ Data Globe · Adatgömb      the raw text       │
  Z  ──── │ Codec · Tömörített réteg   the stack, folded  │
          └──────────────────────────────────────────────┘
```

Top = closest to the user (input and output). Bottom = closest to the raw material. The agentic backbone sits in the middle because both directions pass through it: a request comes down from F and is answered by agents that read A, then work in R, C and G.

---

## 1. Layer ↔ page pairs (the horizontal views)

Every layer should have **one interactive page** where a person sees that layer in its own order. ✅ means the page exists, ◐ means the layer is shown somewhere but not as its own view, and ✗ means there is no page yet.

| Layer | Its page today | State | The page it should have |
|---|---|---|---|
| **F Featured** | VRG Desktop Dashboard (`notes/dashboard`) | ✅ | — (D5+ continues there) |
| **I Ideas** | Ötletfolyam, `Stack/lineage.html` (2026-11-09; the MindMap view of `VRG_idea_timeline.mindmap.json` stays) | ✅ | — (lineage river: time scrubber, ideas branch and merge, dormant ones greyed, springs = the inferred needs, click opens what it became) |
| **Q Decisions** | none; the questions sit in 13 Markdown files | ✗ | **Döntésnapló** (decision inbox): every open question in one list, A/B/C buttons, the answer written back to its file with the date (with approval) |
| **L DevLog** | `DEVLOG.md` board + MindMap with `VRG_devlog.mindmap.json` | ◐ | **Vonaltérkép** (metro map): lines as tracks, sessions as stations, quiet stretches in red, "continue this line" button |
| **A Agentic** | Vezérlőterem, `Stack/control.html` (2026-11-09; the Varler Console live trace, Console/, START W, still shows the *running* agents) | ✅ | — (the Council as a flow with lanes, each agent's tools, briefs and memory one click away; start anatomy per GO codephrase; briefs from `brief-state.js --check`; memory freshness; module map; schedules; usage per day) |
| **U Futás** | `replay.html` (Visszajátszás): one session step by step, files and stack glow | ◐ | the live Control Room view once hooks feed it |
| **R DevRepo** | MindMap with `VRG_devrep.mindmap.json` | ◐ | **Commit-pixel** (the mirrored git grid you showed): one pixel per day, colour = commits, click opens that day's commits and the lines they belong to |
| **C Code** | Kódváros (CodeCity) | ✅ | — |
| **G Data Globe** | Gömb (`Solomon/dist/vrg-solomon.html`, START T) | ✅ | — |
| **Z Codec** | — | n/a | machine layer; `stack.js` reads it |
| **The stack itself** | `stack-search.html` (Rétegverem): flat, layer rows | ◐ | **Stacked view** (your first two pictures): isometric planes, one per layer, nodes on each, vertical lines lit for the selection. Later the neural view: activation during agent sessions |

**Missing pages, by value:** Döntésnapló (it unblocks lines), Commit-pixel (cheap, and you designed it), Stacked view (the hub of everything), Vonaltérkép. (Vezérlőterem built 2026-11-09.) Which one comes first is STK-Q4.

---

## 2. Each layer's natural rules

### F · Featured (Kirakat): 105 nodes
- **Is:** what a user can open or use, ranked by how real it is: ① in use, ② built, ③ in development, ④ planned, ⑤ idea.
- **Order:** hierarchy (tier × lane). There is no time axis, because a feature's *state* matters, not its birthday.
- **Edges:** `part`, `launch`, `grows`, `feeds`, `uses`, `look`.
- **Source:** `notes/features/data.js` → `features.json`.
- **Rule:** a tier changes only by hand, when you say so. Drift report §4 flags tier-3 items with no activity below them.
- **Weak spot:** features rarely name paths or commits, so their vertical links are mostly `alike` (name match) and pillars.

### I · Ideas (Ötletfa): 129 nodes
- **Is:** why things exist, as dated ideas with lineage.
- **Order:** time. Links only point forward in time, so the graph is a DAG.
- **Node types:** built, document, inferred, dormant, question.
- **Edges:** `dev`, `fork`, `merge`, `trig`, `feed`, `meth`, `look` (a `?` means inferred).
- **Source:** `notes/idea-timeline/data.js`. The evidence column (commits, doc paths, `mem:`) supplies the vertical links.

### Q · Decisions (Döntések): 119 decisions in 13 files
- **Is:** every question asked in a DECISIONS file, and whether it has an answer.
- **Order:** namespace (SOL, HUB, MCP, D-V, R1018, KIT …), then number.
- **States:** `answered`, `default A` (the file says "Unanswered = A" or "took every open question at its recommended answer"), `open≈`.
- **Source:** every tracked `*DECISIONS*.md` plus `Varler_Workflow_Kit/DECISIONS_L1-L18.md`, parsed loosely.
- **Rule:** the parser is ≈. Any file with a new format needs a line in `NS_BY_FILE` (lib/layers.js).
- **Gap:** questions that live only in chats and memory (OMCT-Q…, REA-Q…, MW-Q…, CH-Q…) have no file, so they appear only as mentions. One questions file per line would fix that.

### L · DevLog (Fejlesztési vonalak): 50 lines + 138 sessions
- **Is:** the work process. A line is a thematic thread with a state and a next step. A session is a Claude conversation that moved a line.
- **Order:** lines in lanes, sessions by time inside their line.
- **Edges:** `fork`, `next`, `feeds`, `absorbed-by`, `overruled-by`, `on-line`.
- **Source:** `notes/devlog/lines.js` (by hand) + `sessions.json` (harvest.js, from transcripts).
- **Rule:** a line must say when it ends and where the work went. Drift report §2 lists open lines, quietest first.

### A · Agentic backbone (Ügynöki gerinc): 183 nodes
- **Is:** what agents read and run on: memory, CLAUDE.md house rules, agents, briefs, GO codephrases, council docs, workflow docs, agent tools, the Workflow Kit, scheduled tasks, the map generators.
- **Order:** by kind. Memory `[[links]]` and brief owner lines make it a graph.
- **Source:** the memory folder, `.claude/agents`, `docs/hub/agents`, `GO-*.md`, `docs/go-archive`, `CLAUDE.md` files, `docs/council`, `docs/workflow`, `tools/*.js`, `Varler_Workflow_Kit`, `~/.claude/scheduled-tasks`.
- **Rule:** this layer is where a new session starts. It must stay short, current and linked downward. A memory note with no vertical link is either about something outside every layer or out of date.
- **Missing:** usage (tokens per session and day), MCP servers, plugins and skills, settings, hooks. These belong in the Futás layer (proposed).

### U · Futás (Runtime): 179 runs + 43 days (v2)
- **Is:** what agents actually did. A run is one recorded session (steps, tools, tokens, commits, the nodes it touched); a day groups the runs.
- **Order:** time.
- **Edges:** `on-day`, `ran` (to the DevLog session), `touched` (to any node, weighted by how many steps touched it).
- **Source:** `out/recordings`, made by `lib/record.js` from the transcript archive.
- **Rule:** a run never says more than its transcript; the recording is rebuilt when the transcript changes.

### R · DevRepo (Repó): 349 commits
- **Is:** what was committed, when, on which branch, and which files it touched.
- **Order:** time + branch (the commit DAG).
- **Edges:** `parent`, `merged-in`. The DevRep TL;DR marks session starts.
- **Source:** `git log --all` of Planner_VRG_U100 + `notes/devrep/notes.js`.
- **Rule:** never rewritten. A commit's files are its downward links (to C and G).

### C · Code (Kód): 186 folders
- **Is:** the repository as a tree of modules and folders, with size and last change.
- **Order:** containment.
- **Edges:** `contains`.
- **Source:** `git ls-files`. Heavy folders (Vendor, dist, lib, assets …) are one node each.
- **Rule:** a file is not a node. A mention of a file lands on its folder here, or on the document itself in G.
- **Missing:** imports (which file requires which).

### G · Data Globe (Adatgömb): 11 sections + 385 documents + 32 signals
- **Is:** the raw text. Every tracked document, grouped by Solomon's sections, with Solomon's signals.
- **Order:** sections (islands). Documents cite each other (`ref:p`).
- **Source:** `Solomon/data/signals.json` (its docs list) and the documents themselves.
- **Rule:** the Solomon ladder applies: the script finds, Caleb judges, the Founder rules. Nothing writes to a document.

### Z · Codec (Tömörített réteg): 10 packs + codebook
- **Is:** the whole stack folded for agents: L0 (one screen), L1 (pillars), L2 (one line per node, per layer), with L3 node cards and L4 source lines on demand.
- **Source:** generated from all layers above. It never has its own facts.

### E · Pillars (Oszlopok): 31, the vertical axis
- **Is:** one real thing across all layers. `entities.js` defines each pillar by its words, paths and explicit ids.
- **Rule:** words must be specific. "hub" would catch GitHub, and "stack" would catch the Planner BRIDGE Stack. A new app gets a pillar the day it gets a folder.

---

## 3. How the layers are joined (vertical links)

| Kind | Made when | Example |
|---|---|---|
| `ref:p` | a node's text names a path another node owns (deepest folder wins) | a session's touched files → `C:Planner/src` |
| `ref:c` | a 7+ hex word is a real commit | DevLog milestone "pushed d342aef" → `R:d342aef` |
| `ref:s` | an 8-hex word is a real session id | a memory note's originSessionId |
| `ref:m` | `[[slug]]` or `mem:slug` | the idea timeline's evidence `mem:feedback-…` |
| `ref:q` | a decision id (`HUB-Q3`, `D-V9-6`) | a memory note says "D-V9-6 1C 2C built" |
| `ref:go` | `GO NAME` | a line's next step "Run GO LOGO" → `A:go.LOGO` |
| `same` | two nodes own the same key | `Q:file.docs_solomon…` = `G:docs/solomon/DECISIONS.md` |
| `alike` | best title match between F, I, L and A (Dice ≥ 0.6, or ≥ 0.45 with two shared words) | `F:p9 Views…` ↔ `L:views Planner Views…` |
| `pillar` | the node belongs to a pillar | `L:views` → `E:planner` |

The densest pairs are G→C, R→G, R→C and L→C, meaning documents, commits and sessions all land on the code tree. The thinnest are F→G, I→G and C→G, meaning features and ideas rarely name their documents. That is the first place to add explicit links (a `doc:` column in features/data.js would fix most of it).
