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
