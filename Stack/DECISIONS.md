# VRG Stack: decisions

Answer in one line, e.g. `STK-Q1 A, STK-Q2 C, …`. **A** is the recommendation.

**STK-Q1: Where does the stack live?**
- **A** stays in `H:\VRG\Full\notes\stack`, outside the repo, like the other maps (client codes allowed, nothing anonymised)
- B moves into the repo with anonymised output
- C code in the repo, data outside

**STK-Q2: How do agents find it?**
- **A** both: now, one line in the root `CLAUDE.md` and in the DevLog session briefs ("ask `stack.js` first; read `out/codec/L0.txt`"); in v2, an MCP server `vrg-stack` with `stack_q`, `stack_node`, `stack_path`
- B only the CLAUDE.md line
- C only the MCP server

**STK-Q3: When does it rebuild?**
- **A** by hand, as one more line in the DevLog morning pass (`MORNING.md`), like the other maps
- B automatically: a session-end hook runs `build.js --quiet` (about 2 s)
- C a scheduled task

**STK-Q4: Which missing page comes first?**
- **A** Döntésnapló: every open question in one list, answer by button, written back with approval
- B Commit-pixel: the mirrored git grid
- C Stacked view: the isometric layers, all in one
- D Vonaltérkép: the DevLog metro map

**STK-Q5: Which new layer comes first?**
- **A** Futás (runtime + usage: sessions per day, tokens, which nodes an agent touched). It is the prerequisite for the neural view
- B Munkák (jobs, quotes, deliveries)
- C Eszközök (boards, ports, firmware)
- D Látvány (look + assets)

**STK-Q6: How do pillars grow?**
- **A** by hand in `entities.js`, with the build suggesting candidates (clusters that cross three or more layers) for you to confirm
- B by hand only
- C automatic

**STK-Q7: A true Huffman file?**
- **A** no; the codebook plus folding levels is the agent-side compression (Huffman saves bytes, not tokens)
- B also a Huffman-packed archive of all transcripts, for storage only

---

## Answered 2026-11-06 (from research/TERMS.md §11 and §22)

| Id | Question | Answer | What was done |
|---|---|---|---|
| STK-Q8 | Keep session recordings? | **A** | `cleanupPeriodDays: 3650` set in user settings (backup `settings.json.bak-2026-11-06`); every build copies transcripts + file history into `_admin/recordings` (first copy: 4 102 files, 1.1 GB) |
| STK-Q9 | Where does the recorder get its steps? | **A** after the fact | `lib/record.js`: transcripts + subagent transcripts + git commits; no hooks |
| STK-Q10 | Which replay first? | **A** own page | `replay.html` (Visszajátszás) |
| STK-Q11 | Community detection? | **A** Louvain | same algorithm in own code (`lib/louvain.js`), because the graphology package would need a download; swappable |
| STK-Q12 | Meaning search model? | **B** bge-m3 | provider in `lib/embed.js` via a local Ollama; **off until Ollama + `ollama pull bge-m3` are installed** (not done: it is a program install and a 1.2 GB download) |
| STK-Q13 | Self-maintenance order? | **A** | observability (`lib/health.js`, HEALTH.md, `doctor`) → propose-only helper (PROPOSALS.md); link prediction not started |
| STK-Q14 | Metrics every build? | **A** | STATUS.md shows each metric next to the previous build; history in `data/metrics.jsonl` |
| STK-Q15 | Sun / shadow study? | **A** own line later | not built; a BRIDGE/Planner line of its own (ROADMAP "Its own sessions") |
| STK-Q16 | Organisation system? | **A** PARA tags | derived from states (`lib/enrich.js`), shown on node cards and in STATUS.md |
| STK-Q17 | Concept-map verbs? | **A** per link type | `schema/links.js`: Hungarian + English verb and back-verb per relation; node cards read links as sentences |

STK-Q1 … Q7 above are still unanswered; the code follows their A where it had to choose (stays outside the repo, rebuild by hand, pillars by hand with suggestions). The MCP server was registered at user scope on 2026-11-06, at the Founder's go-ahead. That covers the C half of STK-Q2. The A half was written on 2026-11-06, again at the Founder's go-ahead. It is a section "Ask the VRG Stack before reading files" in the repo's root `CLAUDE.md` (not committed yet) plus a house-rule line in the DevLog session-brief template (`notes/devlog/build.js`), which reaches the `sessions/*/CLAUDE.md` briefs at the next morning pass. So STK-Q2 is now in effect as A, both halves.

## Konnektóm (connectome page), 2026-11-07

Asked as a clickable form; the Founder answered "All A".

| Id | Question | Answer | What was done |
|---|---|---|---|
| CN-Q1 | Size of one neuron? | **A** 2 KB | the typical memory note is 2 151 B and the typical brief 2 098 B; a record-only node (300–500 B) is 1 neuron |
| CN-Q2 | Code layer C (78 MB)? | **A** text files only | binaries (PDF, KiCad, images, archives …) skipped: 12 800 neurons instead of 38 600; a cap of 1 024 neurons per item is a safety net only (4 items reach it) |
| CN-Q3 | Where does the page live? | **A** `notes/stack/connectome.html` | data in `out/connectome-data.js`, written by every build and by `stack.js connectome`; serve.js regenerates it on demand |
| CN-Q4 | What fires in the stem? | **A** recordings + event log | the newest 14 recorded runs replay step by step; what the last build added pulses |
| CN-Q5 | Kind of view? | **A** 3D brain | plain WebGL2 in the page (Three.js would need ES modules, which do not load from file://) |

## Holo order (orb.html), 2026-11-07

Plan: `research/ORB-PLAN.md`. The answers came back through the clickable form.

| Id | Question | Answer | What was done |
|---|---|---|---|
| HO-Q1 | What is one main pathway? | **A** DevLog lines | 50 lines; each node gets a primary line by score (+4 linked to the line, +2 to one of its sessions, +1 touched by such a session's run, +0.5 through a pillar), and a second line when that one scores at least half as much; 1 585 of 2 068 nodes (≈ 92 % of the mass) are on a line |
| HO-Q2 | Which view first? | **C** both | one page, two shapes, ⇄ morphs between them |
| HO-Q3 | Animal for the inverted view? | **A** octopus | the origin is the centre of the base, one arm per line; tier by state (active + recurring in front and tall, waiting, then parked / ended drooping); the newest work is at the tip; decisions are the suckers; nodes without a line sit in the mantle |
| HO-Q4 | Edges? | **A** bundled per pathway | 457 bundles between lines through the origin; a node's own edges only when it is selected |
| HO-Q5 | Nightwatch? | **Night's Watch (GoT)**, asked again 2026-11-07 | the Watch has no charge, only a plain black shield; in pen heraldry black (sable) is crossed hatching. Built as the **Őrség** look: Petra Sancta hatching per line state, gold dots for active work, the Wall at 7 / 14 / 30 days quiet with a watch list. Own drawing, no show artwork |
| HO-Q6 | Where? | **A** `orb.html` | shares `out/connectome-data.js`; START → R Rétegverem 5 (server) / 6 (file) |
| HO-Q7 | Őrség, second round (2026-11-07) | the hatching look dropped for now; Őrség = **the lock** | the Earth hologram's triangle mesh is the lock on the Jarvis sphere: open = chunks hover outside, greyed; locked = they fly back and snap on, the cross points glow, the inside shrinks to a small amber orb. The hatching code stays, switched off |
| HO-Q8 | Earth + Jarvis (2026-11-07) | **both** a fourth form and the transit | Föld = hologram Earth (pathways as countries); Mag = the three designs crossed (Jarvis shell outside, brain inside with inner shell layers instead of the stem, entry points on the surface); ⟳ Átmenet routes every change through Mag. References only: the Sketchfab "Earth Hologram style HUD" model (tkkjee) and ethanplusai/jarvis's orb; no asset or code taken |

## Brain parts + axioms (connectome.html), 2026-11-07

| Id | Question | Answer | What was done |
|---|---|---|---|
| BR-Q1 | Where does each part of the stack sit in the brain? | mapped by function (my proposal, change it any time in `lib/connectome.js` `regionOf`) | frontal = I, E, F plans, briefs, codephrases, council · parietal + motor strip = C code · temporal = memory notes, G documents (higher auditory centre) · occipital = F apps, features (higher visual centre) · thalamus = L lines · hypothalamus = Q decisions, house rules, schedules · superior colliculi = G signals, U days (lower visual centre) · inferior colliculi = L sessions, R session starts (lower auditory centre) · cerebellum = agents, tools, generators, workflow kit · pons = U runs · medulla = R commits, merges. Cortex communities are split between the hemispheres to balance them |
| BR-Q2 | What is a "neuron" now? | the user's words: the 2 KB unit is a **node**, the axiom connector is a **neuron** | a file's 2 KB nodes grow as patch / string / tree (`brain.js grow`), joined by a thin web; every 12, 24, 48, 120, 220, 400 KB of continuous data is an axiom with its own neuron; tracer lines join neurons of activated axioms (fading after 45 s). 6 430 neurons on the 2026-11-07 data |

## Third round (2026-11-07): the repo, the coherence shell, the Jarvis core, neuron codes

| Id | Question | Answer | What was done |
|---|---|---|---|
| ST-Q1 | Where does the stack live? | the user: in the toolset repo | moved to `Stack/` in Planner_VRG_U100 (`out/`, `data/` are not committed). START `{stack}`, the MCP registration (`~/.claude.json`), CLAUDE.md and publish-stack.js point there. The old `H:\VRG\Full\notes\stack` stays as a stale copy until `Stack\tools\link-notes.ps1` turns it into a link (it is held open by running Claude sessions' MCP servers) |
| HO-Q9 | Gömb: readable text + a coherence indicator | the Jarvis wobble sphere just under the outer sphere | `coherence()` in orb.html: every pathway gets a trouble score (a live line gone quiet, its unlinked members, waiting) and each shell particle takes the score of the rings below it; calm slow waves where coherent, harder waves, warm colour and a slow stepped glitch where trouble grows. The line card shows "koherencia". The page's faint text colours were raised |
| HO-Q10 | Mag: not a brain shape | a Jarvis-style sphere | `magCore()`: mirror-symmetric on a cube / octahedron frame; cortex at the 8 cube corners (parietal = cloud / thin-shell patchwork, temporal = holed shell, frontal = half-disks, occipital = rings), cerebellum spread as two thin patchy shells, colliculi as crossed rings and half-disks, thalamus disks, hypothalamus the middle cloud, small files as mini clusters in the gaps, bridges between the layers, broken great circles as the mechanical frame |
| HO-Q11 | Blur and orbs | both as toggles (⚙ Nézet) | ◉ Éles pontok (P): hard little discs; ϟ Impulzus (I): firing as thin jagged electric streaks instead of light orbs. Both pages, remembered per viewer |
| HO-Q12 | Janky header, full screen | one row + a ⚙ Nézet menu; ⛶ full screen | both pages; F / Esc; in the VRG App the same button hides the app bar and the system bars (`VRGApp.fullscreen`) |
| NC-Q0 | Neuron addresses | 6 chars: gate letter + 2-char file family + 3-char run | `neurons.js`, `out/neurons.json`, `node stack.js neuron <addr>`, the Konnektóm card; 13 gate kinds (r f m g x t a d n h c s e). Design and the open NC-Q1…Q4: `research/NEURON-CODES.md` |
| LV-Q1 | One more basic view: the layers exploded | an isometric stack of horizontal planes, far enough apart not to cover each other, vertical connectors between them | `layers.html` (Rétegek): orthographic isometric camera; each layer laid out by its own links (force layout, repulsion only inside a layer, community pull), linked nodes across layers pulled gently above each other so the connectors trace multilayer strings; connectors drawn with MAX blending (no white glare). Click a layer = solo, right-click = hide; card lists a node's links by layer. START R → 7, phone page `stack/retegek.html` |

## Ötletfolyam (lineage.html, layer I), 2026-11-09

Page 1 of the 2026-11-09 Stack page run. The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P1 | File and name | A `lineage.html` "Ötletfolyam" · B `otletfolyam.html` · C a view inside `layers.html` | **A**: English file names like the other pages, Hungarian title; START → R → 8 |
| STK-P2 | What is a spring (source of the river)? | A only the "Need: …" nodes (11) · B every root (25) · C inferred ideas that are a "Need: …" or have no parent (15) | **C**: the need nodes plus the inferred roots ("Electrical installation work", "From the hobby electronics", "Born for the DM1 house" …); built or documented roots are not springs, they are only shown as "own start" |
| STK-P3 | Shape of one idea | A a dot with links (a DAG drawing) · B a Sankey of flows · C a stream from its date to its last offspring, branches leave the stream just before the child | **C**: reads as a river and keeps every date exact; a leaf gets a short fading tail (5 days, dormant 2); a merge gets a small hollow diamond where it joins |
| STK-P4 | Width | A the source's own rank · B PageRank · C downstream reach (distinct descendants) | **C**, square-root scaled, 2–9 px for streams; a branch takes its child's width. "Utódok" in the card is the same number |
| STK-P5 | Layout and the phone | A time top→bottom on the phone · B left→right everywhere, the river in its own scroll box · C a list on the phone | **B**: the 11 source lanes are bands; inside a lane ideas are packed greedily into tracks by measured label width, so labels never overlap; on the phone the river scrolls inside its box (9 px/day), the card sits below, the page itself never scrolls sideways |
| STK-P6 | Scrubber | A hide ideas after the date · B grey them (ghosts) · C both, switchable | **A**: "reveal up to a date" literally; streams are cut at the playhead; the VRG UI Kit scrubber (play, steps, keys, reduced motion = steps instead of a glide); the view follows the playhead; `#t=YYYY-MM-DD` |
| STK-P7 | What the click shows | A the vertical links flat · B grouped by layer in stack order, pillars apart · C only F | **B**: F, L, Q, A, R, C, G (each links to `connectome.html#sel=<id>`), name matches (`alike`) in italics marked "≈ név"; then the direct children, the parents and the springs upstream; the river keeps the idea's ancestors and descendants lit (siblings dimmed) |
| STK-P8 | Data path | A read `out/stack.json` in the page · B a module that takes the built graph plus the I source for what the stack clips (full fate, evidence, the ~ date mark, lane names) | **B**: `lib/lineage.js` → `out/lineage-data.js` (≈ 70 KB), optional stage `lineage` after `connectome`; `stack.js lineage` rewrites it alone; backward-in-time links are counted and shown in the card (0 today) |
| STK-P9 | Look and themes | A Mélyvíz dark only like the other Stack pages · B kit themes Mélyvíz + Papír, auto by the system, a button to pin one | **B**: link kinds take kit tokens (dev = water teal, fork info, merge idea, trig warm, feed ok, meth warn, look magenta); inferred links dashed; dormant grey and italic; the kit is linked from `../shared/vrg-ui-kit` (not inlined); `serve.js` now also maps `/shared/` so `../shared/…` links work through the server too (this also fixes the Mélyvíz link of `layers.html`, `connectome.html`, `orb.html` there) |
| STK-P10 | Where it was built | A the main checkout (the run's rule) · B this session's worktree branch | **B**, forced: the session's harness refuses writes to the main checkout from a worktree session. Built and committed on `claude/stack-pages-build-prompt-9ef89d`; the branch needs a merge into `main` (only `launcher/vrg-menu.json` may meet a neighbouring change there) |

## Vezérlőterem (control.html, layer A), 2026-11-09

Page 2 of the 2026-11-09 Stack page run. The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P11 | File and name | A `control.html` "Vezérlőterem" · B `vezerloterem.html` · C a tab in `replay.html` | **A**: English file name like the other pages, Hungarian title; START → R → 9; links `#sel=agent:arnold`, `#sel=go:MAIN`, `#sel=day:<date>` |
| STK-P12 | Shape of the Council flow | A a force graph of the A layer · B the Kit Gyár spine (one line of stops) · C lanes left → right: Alapító, Irányítóterem, Tanács, Szerződők, Munkások, filled from `docs/council/ROSTER.md` + `.claude/agents/*.md` | **C**: it is the call chain the charter describes. Shapes from Kit Gyár (square = start, octagon = where it is decided, circle = runs a package, dashed square = one narrow task); wires: Founder → Bernard → seats (dashed to the vacant Stubbs / Lee), seats with the Agent tool → contractors and workers, Bernard → Theresa ("serves Bernard"), Felix → workers. A click lights the node's wires and dims the rest; the side panel carries tools (with what each lets it read or do), briefs, memory and stack links |
| STK-P13 | How the build gets brief state | A `require('tools/brief-state.js')` · B run it with `--check` as a child process and parse its `HIBA id: …` lines · C re-implement the check | **B**: requiring it runs its top level, and without `--check` in `process.argv` that **rewrites the briefs**; re-implementing would drift from the tool. ≈ 2 s per build; the page shows the command, exit code and summary, and says plainly when it did not run |
| STK-P14 | When is something stale or quiet? | A colour only · B fixed thresholds with a mark and a word | **B**: agent quiet after 14 days with no recorded use; memory fresh ≤ 14, ripe ≤ 30, old > 30 days (frontmatter `modified`, else file time); a live GO file nobody changed or named for 21 days is quiet; a brief is stale or broken when `brief-state --check` says so. Every state has a glyph + word (⚠ elavult, ✕ hibás, ◌ csendes / nincs rögzített futás, ⌀ nincs függőleges kapocs, ⏳ régi, ○ üres szék). "Used" = launched as a subagent (archive `subagents/*.meta.json`, agentType only) or a recorded run read the agent's file. Today no council agent shows a recorded run: the archive has only general-purpose / Explore / statusline subagents, and a main session started with `claude --agent …` is not named in the transcript, so most agents carry "nincs rögzített futás" — true to the record, not a judgement |
| STK-P15 | Usage per day: by session start or by step | A a session's whole tokens on its start day (the U `day` nodes) · B every step on the day it ran (read from `out/recordings/*.jsonl`) | **B**: long sessions span days (one ran 10-30 → 11-07); A piled it all on its first day. 60 days, four measures (new tokens = in + out + cache write; cache read; steps; runs); days after the last recorded step are hatched "nincs felvétel", not zero. A day opens its runs, each linking to `replay.html#<sid>` |
| STK-P16 | What is shown of memory and settings | A full memory bodies · B the one-line description, clipped to 160 chars · C names only | **B**: enough to judge freshness, nothing more; no settings values, tokens or credentials are read. Schedules take only cron / enabled / last-run from the desktop app's `scheduled-tasks.json` where it exists on disk (found today for `solomon-intern`: Monday 07:40 local, enabled); a task with no such file still shows its SKILL.md |
| STK-P17 | "Memory with no vertical link" | A the stack's `deg.v` (counts U `touched` and pillars) · B only links to F, I, Q, L, R, C, G | **B**: a run reading a note is use, not a link, and a pillar is not a layer; 2 of 93 notes are suspicious today. Seen on the way: `lib/layers.js` reads memory type with `/type:\s*(\w+)/`, which matches `node_type: memory` first, so 81 notes are kind `memory/memory`; this page parses the indented `type:` itself. Left for a person (other pages key on the kind) |
| STK-P18 | The Kit Gyár "stop anatomy" here | A leave it out · B one start per GO codephrase: question = the GO file and its CLAUDE.md line, the read chain CLAUDE.md → GO file → briefs → owner, herd = owner department / Konnektóm / layers, left-out box = stale briefs, old or unlinked memory naming it, a quiet GO file | **B**: a session's start is this layer's "stop"; the box turns green ("minden friss") when nothing is stale. Built in the worktree like page 1 (STK-P10) |

## Commit-pixel (commits.html, layer R), 2026-11-09

Page 3 of the 2026-11-09 Stack page run. The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P19 | File, name and data shape | A `commits.html` "Commit-pixel" · B `commitpixel.html` · C a view in `layers.html` | **A**: English file name like the other pages; START → R → 0; `lib/commitpixel.js` → `out/commits-data.js`, optional stage `commits` after `control`, `stack.js commits`. Compact: string tables (branches, areas, pillars, relations, linked nodes) and one array per commit, a link is one integer (node × 16 + relation). 215 KB for 440 commits and 3 515 links; the page draws in ≈ 7 ms, a filter re-colours in ≈ 0.2 ms |
| STK-P20 | Where do the facts the stack drops come from (time of day, full refs, full parents, files)? | A the stack only (no time, refs clipped to 60 chars, folders only) · B add them to the public R nodes in `stack.json` (a schema change for every reader) · C one `git log --all` + `git for-each-ref` inside the stage | **C**: `stack.json` stays as it is; the stack's R nodes remain the set and supply titles, TL;DR, kind, pillars and every vertical link. If git fails the page still opens: areas from the commit's C links, one unknown lane, and the page says so |
| STK-P21 | Which branch is a commit on? | A ref names at the tips only · B `git name-rev` (nearest ref, often a tag or a later branch) · C first-parent chains claimed by the tips: main first, live branches before archived ones (`archive/<date>/<branch>` tags), oldest tip first; then the second parent of a merge claims its chain under the name in the merge message; the rest "(névtelen ág · <merge>)" | **C**: a commit belongs to the line of work whose first-parent history it is on, which is how a person reads a branch. Today 60 lanes, none unknown (secacc, planner-stack, dev-all … come back from the archive tags) |
| STK-P22 | Colour steps | A fixed bounds (the kit heatgrid's 1/3/6/10) · B quartiles of what the filter shows · C quartiles of all busy days, fixed while filtering | **C**: today 1–2, 3–9, 10–17, 18+; a colour always means the same number of commits, so a filtered grid reads as "less", not re-scaled. Not by colour alone: the count is in the tooltip, the readout (`aria-live`) and the panel; a dot marks a merge day; today is framed |
| STK-P23 | Grid renderer and span | A the kit's `VK.heatgrid` (DOM cells, `setData` rebuilds everything, whole calendar years, no hook for lanes) · B our own SVG in the kit's tokens (`--vk-heat-0…4`), drawn once | **B**: the filter only swaps one class per cell; a resize or the lane toggle redraws. The span is the first commit's week → today's week as one strip that scrolls inside its own box (with 8 weeks of history a year wrap is not needed; the year is written at the first month and at every January; colliding month labels are skipped). Cell 14–34 px to fit the box. Keyboard: ← → week, ↑ ↓ day, PageUp/PageDown the previous/next day with commits, Enter |
| STK-P24 | Branches and merges | A only a mark per day · B lanes under the grid on the same x axis (each week column split in 7), forks grey, merges warm, label after each lane's last commit | **B** + the merge-day dot in the grid. Branches with 1–2 commits (51 today, mostly `desktop-os/WP-*`) share one "egyéb ágak" row until "Minden ág" is pressed; a click on a lane filters by that branch |
| STK-P25 | Area, filter and the day panel | A area = C folder · B area = top-level folder of the touched files | **B** (root files are "(gyökér)"), filter = pillar ∧ area ∧ branch, in the link (`#d=…&c=…&p=…&a=…&b=…`). The day opens its commits by time (TL;DR, merge, ref marks; with a filter the matching ones first), a commit opens parents, children, mentions, files, pillars and its links; the day lists DevLog lines with their sessions under them, runs (→ `replay.html`), ideas, decisions, the agentic layer, folders and documents (→ Konnektóm). Built in the worktree like pages 1–2 (STK-P10) |

## Döntésnapló (decisions.html, layer Q), 2026-11-09

Page 4 of the 2026-11-09 Stack page run (second run). The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P26 | File, name and data path | A `decisions.html` "Döntésnapló" · B `dontesnaplo.html` · C a view in `stack-search.html` | **A**: English file name like the other pages, Hungarian title; START → R → N. `lib/decisions.js` → `out/decisions-data.js` (≈ 250 KB), optional stage `decisions` after `commits`; `stack.js decisions` rewrites it alone (it then re-reads the layers and the join itself, ≈ 1.5 s). The build hands the stage the Q layer's own nodes (they keep the parser's line number, which `stack.json` drops) and the join's nodes (their unresolved `q:` mentions) |
| STK-P27 | What does a question "block", and how are the open ones ranked? | A every link counts the same · B a weight: each DevLog line by its state (active, waiting, recurring 3; parked 2; ended, absorbed, personal 1) + its sessions ½ each (folded under their line) + features 3 + briefs, live GO files, agents, CLAUDE.md 2 + other agentic files 1 + the file's own "Blocks H2" note 1 · C only the file's "Blocks" note | **B**: a quiet line or a passing session should not outrank a live one. The weight is on every card ("súly") with its formula in the tooltip; other orders: namespace and number, or oldest first. Today 19 of the 46 unanswered questions are linked from anything; HUB-Q1 leads (8). Links to I, Q, R, U, C, G are listed as "említi", not counted |
| STK-P28 | How is the parser's ≈ shown? | A show its state as fact · B correct it in this module · C show its state as it is, and mark "≈ kétes" with the evidence where the file's own text disagrees | **C**: the page must not quietly differ from the rest of the stack. "Kétes" when another line of the same file names the id with "answered", "in effect" or "= X"; when an `…a`/`…b` sub-item sits under an answered parent; or when an answered item shows no answer anywhere. The panel shows the file's other lines naming the id and the whole entry, so a person can judge |
| STK-P29 | The date of a question | A the file's time · B `git blame` of its line · C the first date found in the item's own line, then the nearest heading above it, then the item's text; then `git blame` of the line (in the file's own repo); then the file's time | **C**, and the panel says which one it is ("a sorából", "a fejlécből", "git blame" …). The Workflow Kit is not a git repo, so its file falls back to headings and file time |
| STK-P30 | Which unanswered questions get buttons? | A only `open≈` · B `open≈` and `default A` | **B**, in two sections: "Unanswered = A" means the work went ahead on A, not that anyone answered; the Founder may still want B. Answered ones are read-only, folded by namespace (one collapsed list, then one fold per namespace) |
| STK-P31 | Options "as written in its file" | A the letter only · B the option text verbatim (markdown kept), read from bullets (`- **A** …`, `- B … · C …`), inline lists on the question line (`A **300 mm** · B 250 · C 200`) and option tables (`| L-1 | Proposal | A ★ | B | C |`) | **B**: a run counts only when it starts at A and steps one letter at a time. Recommended = what an option's own note says ("A (recommended)", ★), else the one bold letter (when every letter is bold, as in the Views file, boldness says nothing), else the file's "A = recommended". For the Kit file the question row of the option table is used, not the answers table the parser met first |
| STK-P32 | What the A/B/C buttons copy | A a one-line "answer X with B" · B a full prompt in the Thread Board's style | **B**: the decision id and question; the file as an absolute path, plus the repo root and the repo-relative path; the line; the option's exact text (not just its letter); the date the button is pressed (computed in the page); the ≈ state; then: check it is still open, write it in the file's own format with that date, keep the options, update what it unblocks (each DevLog line with `notes/devlog/lines.js`, each brief or memory note by absolute path, each feature, the file's own "Blocks" note), ask before changing code that follows another option, rebuild the stack, report in five lines, never commit or push unasked. "Egyéni válasz" copies the same prompt with the typed text (empty = a toast, nothing copied). Clipboard with the `execCommand` fallback and the select-and-Ctrl+C box, as on the Thread Board |
| STK-P33 | The questions with no file | A a count · B every id with every node that names it, by layer, plus the first document line that asks it · C B plus a prompt | **C**: 112 ids today (OMCT, REA, MW, CH, E5, E6, FX, HK, KG …). Most do have a text, just not in a DECISIONS file, so the line shown is the one that asks it (the id at the start of a line), documents first, then memory notes. The prompt finds the question and proposes a DECISIONS file for it, and asks before writing anything |
| STK-P34 | Layout on the phone | A the side panel stacked below the list, as on the other pages · B a full-screen sheet with "← Vissza a listához" | **B**: the list is about 270 rows, so a panel below it would be far away. Desktop keeps the side panel. `j` / `k` walk the list, `/` searches, Esc closes the panel, then clears the filter |
| STK-P35 | Where it was built | A the main checkout · B this session's worktree branch | **B**, forced like STK-P10: the harness refuses writes to the main checkout from a worktree session. Built and committed on `claude/vrg-stack-layer-pages-0b92dd` for the coordinator to cherry-pick |

**What the Q parser (`lib/layers.js` `decisions()`) gets wrong, seen while building this page.** Left as it is: other pages read the same layer.

- Five of the 14 files yield no decision. Two have none to give (`Planner/projects/varler-planner/docs/DECISIONS.md` is a rationale file, `docs/city/wp/p00-decisions.md` a stub). Three use formats it does not know: `docs/mobile/DECISIONS.md` (`- **D-1 · App identity** (2026-10-29: **A**)`), `docs/city/homeland/06-decisions.md` (`| CITY-D34 TMOG | **B** … |`) and `BRIDGE/_build/BRIDGE-A-002_decisions.md` (`| **D01** | … |`). Ids with `-D` or a bare `Dnn` are not decision ids to it.
- `D-V5-2a` and `D-V5-2b` read as open≈, but they are sub-items of `## D-V5-2 · … — answered 2026-10-14`. The section rule only looks at `answer` in a heading that is not itself an item.
- `Stack/DECISIONS.md` line 58 says "STK-Q1 … Q7 above are still unanswered; the code follows their A" and that STK-Q2 "is now in effect as A". The parser reads STK-Q1 as answered and STK-Q2…Q7 as open≈; neither "follows their A" nor "in effect" is a default-A or answered rule.
- KIT-L1…L18: the first line that names an id wins, which is the answers table, so the node title is the answer ("KIT-L1 — A") and the question row is never read.
- Ids with a letter other than Q (`STK-P1`…, `CITY-D34`, `D-1`) are never decisions, so this run's own STK-P decisions are not in the Q layer. Inline sub-answers ("**Q10b = A**" inside HUB-Q10) are not items either; HUB-Q10b therefore shows up as a mention with no file.
- LAYERS.md §2 still says 119 decisions in 13 files; the build now reads 158 in 14 (8 open≈, 38 default A, 112 answered).

## Vonaltérkép (metro.html, layer L), 2026-11-09

Page 5 of the 2026-11-09 Stack page run (second run). The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P36 | File, name and data path | A `metro.html` "Vonaltérkép" · B `vonalterkep.html` · C a view inside the Thread Board | **A**: English file name like the other pages, Hungarian title; START → R → M. `lib/metro.js` → `out/metro-data.js` (≈ 430 KB), optional stage `metro` after `decisions`; `stack.js metro` rewrites it alone from `out/stack.json`. The Thread Board stays the L row's first page (START F); the L row in LAYERS.md §1 names both |
| STK-P37 | Where the line ↔ line relations come from | A re-read `lines.js` · B the graph's L ↔ L links | **B** for the map (fork, next, feeds, absorbed-by, overruled-by as the stack holds them, so the page cannot differ from the rest of the stack); the reasons ("why") are read from `lines.js`, which the graph drops |
| STK-P38 | What a station is, and when | A one per session, at its start · B one per session × line, timed by that session's own prompts on that line, sliced exactly as `notes/devlog/build.js` does (a desktop fork's replayed prompts dropped, ASSIGN `null` = noise, unassigned → "Unsorted sessions") | **B**: ASSIGN splits some sessions across lines, and a station must sit where the line was really moved. A session on several lines is drawn as an interchange (a thin link between its stations). Stations closer than one mark merge into one pill with a count (time is never shifted to make room); a click lists them |
| STK-P39 | The quiet threshold | A 5 days, as the Thread Board and DevLog (`STALE_DAYS`) · B 7 days · C a fixed number with no control | **A**, adjustable in the header (**Csend**: 3 / 5 / 7 / 10 / 14 / 21, `&q=` in the link). A gap between two stations longer than it is red, dashed and labelled "csend N n" where it fits (any line state). After the last station: active and waiting lines get a red dashed tail to today with a ⚠ mark and a "⚠ N n csend" badge by the name (the Thread Board's rule); parked, recurring and personal lines get a dotted tail; ended, absorbed and overruled lines get a terminus bar and "→ where the work went". Red is never a lane colour, so red only ever means quiet, and it never stands alone (dash + ⚠ + word) |
| STK-P40 | The DevLog harvest is older than the stack (sessions.json 11-01; 52 recorded runs since) | A hide it · B show the harvest date as a dotted line, say under the quiet list that part of the quiet is only apparent, and put the later recorded runs on their own bottom track "Aratás után · még nincs vonalon", each opening its replay | **B**: the page must not claim lines are quiet when the work just has not been filed yet, and must not guess which line a run belongs to (that is `lines.js` ASSIGN's job, by hand) |
| STK-P41 | What "Folytatás" copies | A the Thread Board's item prompt verbatim, for the line's thread · B the same shape, line-centred | **B**, keeping the board's wording line by line: "Fresh start on one open VRG item." · Item = the line name + its next step · Thread (the first `threads.js` thread naming the line; others as "Also on thread") · Codephrase · "DevLog line: … Its next step" · "Line brief: …\sessions\<line>\CLAUDE.md" · Read first · Still open on this thread · the four "How to work" bullets. Only the last bullet changes: it asks for the one-line change in `lines.js` (status and nextStep) instead of `threads.js`, since the item is the line, not a thread chip. The prompt text is shown under the button |
| STK-P42 | Lines with no brief, and lines that are not open | A copy the path anyway · B the button only for active / waiting / parked / recurring lines; the brief line only when `sessions/<line>/CLAUDE.md` exists, otherwise the panel says the file is missing and the prompt leaves it out | **B**. An ended / absorbed / overruled line shows "Végállomás" and buttons to the line(s) its work went to; a personal line and the Unsorted pseudo-line get no prompt (today every open line has its folder, so the missing-brief note is a code path only) |
| STK-P43 | Order of tracks | A lanes in `lines.js` order, lines inside a lane by their first event (fork, station or milestone) · B by state · C by last activity | **A**: the charter's "lines in lanes, sessions by time inside their line"; forks then flow downwards inside a lane. The quiet ranking lives in the list above the map, not in the track order |
| STK-P44 | Feeds connectors | A on · B off by default, a legend toggle | **B**: 11 feeds lines cross most of the map and say "uses its output", not a hand-over; fork, next and absorbed-by / overruled-by are on. All four have toggles; a selected line dims everything not on it |
| STK-P45 | Where it was built | A the main checkout · B this session's worktree branch | **B**, forced like STK-P10 and STK-P35: the harness refuses writes to the main checkout from a worktree session. Built and committed on `claude/vrg-stack-layer-pages-0b92dd` for the coordinator to cherry-pick |

## Futásnapló (runs.html, layer U), 2026-11-09

Page 6 of the 2026-11-09 Stack page run (second run). The Founder was away; each choice below was made by the builder and can be changed.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P46 | File, name and data path | A `runs.html` "Futásnapló" · B `futasnaplo.html` · C a list view inside `replay.html` | **A**: English file name like the other pages, Hungarian title; START → R → F. `replay.html` stays the step-by-step view under it, linked from every run. `lib/runs.js` → `out/runs-data.js` (≈ 650 KB), optional stage `runs` after `metro`; `stack.js runs` rewrites it alone from `out/stack.json` and the recordings (≈ 0.7 s) |
| STK-P47 | Which clock: the day boundaries and the time-of-day axis | A UTC days and a UTC axis, as the U layer's `U:day` nodes and the Vezérlőterem (STK-P15) count · B local days and axis, as the Vonaltérkép draws stations · C UTC days with a local axis | **A**: the coordinator asked for the same day totals as the Vezérlőterem, and C would put a 00:30 local step on the day before the one it is drawn on. The per-day totals are computed with the Vezérlőterem's exact rule (each step on the UTC day of its own time stamp; a run with no recording file on its start day) and were checked against `out/control-data.js`: 54 days, 0 differences. The axis says "UTC, helyi = UTC+1"; the panel gives every time in both. Switching both pages to local time would be one change in each module, never one alone |
| STK-P48 | What the bar colour says | A the place · B only named agents vs the rest · C how the run was started, from the transcript's own fields | **C**, six kinds read from the first 256 KB of the archived transcript: named agent (`agentSetting` other than `claude`, e.g. bernard, caleb) · scheduled (`turnOrigin` scheduled) · started by a program or another session (`sdk-cli`, or `turnOrigin` sdk / peer with no human turn) · terminal (`cli`) · desktop app (`claude-desktop`) · unknown. Today 142 desktop, 35 program, 18 terminal, 7 unknown, 4 agent, 2 scheduled. The place is already the row, so colouring by it would say nothing new. The recorder is untouched (no VERSION bump, no re-record) |
| STK-P49 | What a bar's length is | A one bar from first to last step · B the run's active stretches: steps closer than 30 min form one bar, longer pauses are a dotted line | **B**: one run lasted 523 hours on the wall clock with 6 h 39 min of activity; A would paint it as three weeks of work. The panel gives active time, wall time and the number of stretches |
| STK-P50 | Rows | A one row per place (worktree or checkout), sub-tracks for parallel runs · B one row per DevLog line · C both, with a switch | **C**, place by default (**Sor**, `&g=line`). The re-root's old paths of the repo (`H:/cwebuser/…`, `H:/Dev-VRG/…`) are the same checkout; the desktop scratch workspaces are one row; each `.claude/worktrees/<name>` is its own row (⑂). A run keeps one track for all its pieces that day; tracks are packed greedily, with room kept for an outside badge; rows keep one order on every day (busiest place first) so they do not jump. On the phone the row name sits above its tracks instead of in a column |
| STK-P51 | A run over midnight, or over several days (one ran 09-22 → 10-14, one 10-30 → 11-09) | A draw it only on its start day · B cut it at midnight: on every day it has steps, its pieces that day, with ‹ / › at the day's edge and a dotted line to it when it goes on before / after; days with no step of it show nothing (it was idle) · C draw it on every day between start and end | **B**: it matches the totals (a run counts on each day it has steps), and C would fill idle days with a line that did nothing. The list marks a cut time with ‹ ›, the panel lists the run's days with their steps, and a click on one moves there |
| STK-P52 | Live recording (`data/live`) | A nothing until hooks exist · B a build-time reader: when `data/live/` exists, count each `<sid8>.jsonl` (steps, first and last time, top tools), one green line with the newest sessions; when it does not, one line saying live recording is not on yet (ROADMAP 2.5) · C B plus polling from the page | **B**. ROADMAP 2.5 / 5 and ARCHITECTURE §4 say only "a PostToolUse hook appends steps in the checkStep shape to `data/live/<sid8>.jsonl`; record.js merges them in", so that is the assumed shape and nothing more is read from it. No polling: a `file://` page cannot list a folder, and the merge into the recordings is the recorder's job. No hook was installed |
| STK-P53 | Size: thickness or badge, steps or tokens | A thickness = the run's total steps · B thickness and number = its steps on the shown day (log scale, 4–18 px), tokens in the tooltip, the list and the panel · C tokens | **B**: the bar is drawn on one day, so it shows that day's work, the same unit as the day's totals. Tokens are not drawn: they are dominated by cache reads (often 100× the output), which would make every long session look the same. The number sits inside the bar when it fits, otherwise just after it (the packing keeps that room), otherwise it is only in the tooltip |
| STK-P54 | The replay link | A always `replay.html#<sid8>` · B only when the replay page holds that run | **B**: `replay.html` silently opens the newest session for an id it does not hold (it keeps runs with ≥ 3 steps). The module reads `out/replay/index.js`; a run it lacks gets a greyed "nincs visszajátszás". Checked: `replay.html#995bdec6` from this page opens 995bdec6 |
| STK-P55 | What can be copied | A nothing · B the session id, `claude --resume <sid>`, `cd <Stack> + stack.js session <sid8>`, and the run's file list | **B**, with the Thread Board's clipboard → `execCommand` → select-and-Ctrl+C fallback and a toast. No prompt is offered: a run is a record, not an open item (the Vonaltérkép's Folytatás covers its line) |
| STK-P56 | Where it was built | A the main checkout · B this session's worktree branch | **B**, forced like STK-P10, STK-P35 and STK-P45: the harness refuses writes to the main checkout from a worktree session. Built and committed on `claude/vrg-stack-layer-pages-0b92dd` for the coordinator to cherry-pick |

## Answered 2026-11-10: Stack Strings, the live twin and the viewer (research/STRINGS-PLAN.md §8)

Asked in one round in the session that built S1 + S2.

| Id | Question | Answer | What follows |
|---|---|---|---|
| STK-Q18 | Name of the selection trail | **A** Füzér / Stack String | `lib/strings.js`, `stack.js string`, MCP `stack_string`; Hungarian UI says Füzér |
| STK-Q19 | Threads and pillars | **A** threads become pillars | one list in `entities.js`; each pillar may carry an `area` and the board's hand fields (S2) |
| STK-Q20 | Is the board's six-step status kept by hand? | **B** computed only | no hand-status field on pillars; the string's class (§1.3) is the status. The `s` field of `threads.js` is not carried over, so there are no status-drift cards; the "looks done" check on T items (S3) stays |
| STK-Q21 | Write-back scope for the first release | **A** threads + lines + decisions answers, with diff approval | S6 editors in that order; nothing commits |
| STK-Q22 | Default detail in the Viewer | **A** Auto (Fine on desktop, Normál on phone) | thresholds measured in S9 before they are fixed |
| STK-Q23 | G in the layer text | **A** whole documents | ≈ 4.6 MB of `.md` text in `out/layertext/G.bin` (S8) |
| STK-Q24 | Order of new layers | **A** T → N → P → K → J, then STK-Q5's | S3 builds T; S11+ the rest |
| STK-Q25 | `layers.html` | **A** replaced by the Viewer under the same key | when S9 lands |

## Stack Strings S1 + S2 (builder's choices), 2026-11-10

Made while building S1 and S2 of research/STRINGS-PLAN.md. Each can be changed in `config.js` or `entities.json`.

| Id | Question | Options A/B/C | Chosen + why |
|---|---|---|---|
| STK-P57 | Class order: the plan lists Orphan last | A as listed · B Orphan before In build | **B**: with A, code nobody registered that was touched this week reads "In build" and never reaches the orphan list, which is the list check-start's "never heard of" wants |
| STK-P58 | The plan's In build (≤ 14 days) and Built, quiet (≥ 30 days) leave a gap | A a third class for 15–29 days · B quiet starts where In build ends · C keep the gap (falls to Loose) | **B**: one threshold, `inBuildDays` 14. **Loose** is kept for shapes no rule describes (R without C, Q alone …) |
| STK-P59 | Hub damping strength | A activation's (hub 24, d^0.5) · B hub 16, (16 / d)^1 | **B**: with A, a seed next to `docs/city/README.md` (132 vertical links) still pulled in 70 of its neighbours. Seeds and pillars are never damped: a hub's own string is large, and a pillar is the definition of "the same thing" |
| STK-P60 | "F tier ≤ 2" for Program: which F nodes count | A any F member · B members scoring ≥ 0.5 | **B**: a far F node at depth 2 is not evidence that the thing itself is in use. Result today: Planner is Program; Kapu and Gömb are In build because their F rows are tier 3 |
| STK-P61 | Where the threads' hand data lives | A all of it in `entities.json` · B the mapping (area, thread) in `entities.json`, the board's hand fields (note, read, go, done, not-yet, lines) stay in `notes/devlog/threads.js` until S4 | **B**: those fields quote job codes and job paths, and `entities.json` is committed. The build reads each thread's lines from threads.js, so the Past jobs pillar gets its lines without a code in git. A test checks `entities.json` against `tools/anonymise.map.json` |
| STK-P62 | Pillar file format | A keep the JS rows · B `entities.json`, one pillar per line, `entities.js` a two-line reader | **B**: the S6 gateway edits data, not code (§9); one line per pillar keeps a diff to one line. `lib/pillars.js` still reads the old rows |
