# 06 — Media REA candidates for the Kódváros live workspace / overlay OS

Date: 2026-10-26. Scope: films, series, games, fictional-UI studios and real control rooms whose
*specific* features are worth REA (see → understand → build our own). Looks are re-implemented,
never copied: no assets, no code, no names or logos.

**Feature tags** used below:
`PROC` live processes · `AGENT` Claude agents at work · `GIT` branches/merges/parallel sessions ·
`NET` traffic abroad (ships/planes/trains) · `DEV` USB/Bluetooth devices · `AUD` sound sources/EQ ·
`HW` CPU/RAM/disk · `SRCH` Ctrl+K search · `SEL` multi-select/group actions · `PROG` progress ·
`NAV` navigation between scales (GitWorld → Land → city → building) · `DEL` delete/close.

**Confidence:** items marked *(src)* were checked against a source this session (list at the end);
items marked *(kn)* come from general knowledge of the work and were not re-verified.

---

## 0. The fifteen best picks (start here)

| # | Borrow this | From | Serves | three.js idea |
|---|---|---|---|---|
| 1 | **Grey when fine, colour only when something needs you** | ISA-101 high-performance HMI | all states | Default palette = dim cyan wireframe; saturated colour reserved for "attention / error / your turn". |
| 2 | **Light lines on a figure's body carry its identity colour** | Tron: Legacy (programs' circuitry) | `AGENT` `PROC` | Each agent/process is a low-poly figure with emissive edge lines (`EdgesGeometry` + bloom) in its owner colour. |
| 3 | **The light-cycle wall = a trail you can read afterwards** | Tron (1982) / Legacy | `AGENT` `GIT` | Agent leaves a fading ribbon (`MeshLine`-style strip) along the roads it walked; read = thin, edit = thick. |
| 4 | **Transit lines as the whole interface** | Mini Metro / Mini Motorways | `GIT` `NET` | Branches drawn as coloured metro lines; commits = stations; merge = interchange. |
| 5 | **Info views / lenses** (one button recolours the whole city by one metric) | Cities: Skylines | `HW` `GIT` `PROC` | Shader uniform `lensMode` swaps building colour source: age, churn, owner, CPU, "touched by agent". |
| 6 | **Buildings = websites; size = importance; mostly-similar with a few eye-catchers** | Ralph Breaks the Internet | `NAV` `NET` | Keep the city calm and repetitive; only active/flagged buildings get height boost and signage. |
| 7 | **Clicking lifts you in a cube to the destination** | Ralph Breaks the Internet | `NAV` `SRCH` | Ctrl+K result → a translucent cube forms around the camera and flies it there (camera tween + box shell). |
| 8 | **Pedestals = directories, blocks on top = files, wires between; height = size, colour = age** | Jurassic Park / SGI fsn | `NAV` | Already close to Kódváros; borrow the *colour = age* default and the "fly along the wire" travel. |
| 9 | **Timeline with layers and shaded "something happened here" bands** | Cyberpunk 2077 braindance editor | `GIT` replay `AGENT` | Replay scrubber with stacked lanes (commits / agent edits / builds); shaded bands mark events on hidden lanes too. |
| 10 | **Fixed time windows + decaying markers** ("last hour", circle shrinks and cools) | EVE Online map stats / zKillboard heatmap | `PROC` `NET` `AGENT` | Every event spawns a ring that shrinks and shifts hue over N minutes; a toggle sets the window. |
| 11 | **Physical strips that move between bays = status** | Air-traffic control flight strips | `AGENT` `GIT` sessions | Each job/session = a strip on a rack: "queued / working / waiting for you / done". Moving it *is* the state change. |
| 12 | **Status on the object itself, not on a HUD** (health on the suit's spine) | Dead Space | `PROG` `HW` | Progress bars as segmented light bands on the building/vehicle itself; colour steps at 75/50/25 %. |
| 13 | **Tower that glows when the channel is open** | Tron (1982) I/O tower | `NET` router | Router = a tall beacon; idle = dim/closed colour, traffic = beam pulses upward in the "flowing" colour. |
| 14 | **Production-rate graphs with selectable time scales** | Factorio production statistics | `HW` `NET` `PROC` | Click any construct → small rate graph (5 s … all time); the same point can also show as number or plot (Open MCT idea). |
| 15 | **Breakdown into voxels on destruction** | Tron: Legacy / Ares "derezz" | `DEL` | Closing a program/deleting a file: mesh explodes into instanced cubes that fall and fade (`InstancedMesh`). |

---

## 1. The Tron family — the core visual language

**Trademark flag (important):** "TRON", "TRON: Legacy" and related marks are Disney registrations,
and Disney actively opposes third-party "TRON" filings (it blocked the TRON Foundation partner's
U.S. applications in 2019) *(src)*. **Never use the word Tron, the logo, the disc/cycle silhouettes
or the identity-disc shape in the product, UI copy, filenames visible to users, or marketing.**
Internal research notes may name it. Generic ideas (glowing edge lines on dark glass, grids,
trails, voxel break-up) are not protectable as such; distinctive shapes are a risk. Use our own words:
e.g. *"lefoszlik / dissolve"* rather than "derezz", *"kapu-torony"* rather than "I/O tower".

### Tron (1982) *(src for I/O tower, Recognizer; kn otherwise)*
- **I/O tower** — the place where programs talk to their user; beam is closed-colour when silent,
  flowing-colour when information moves. → `NET`: the **router as a beacon tower** at the Land's
  border; outgoing/incoming traffic pulses up/down the beam. Re-impl: cylinder + additive shader,
  scroll UV speed = throughput, colour = open/closed.
- **Recognizers** — patrol units that converge on a location. → *security/antivirus or CI checks*
  as slow-moving overseer shapes that hover over the district under test. Re-impl: large hollow
  frame mesh that glides to the target district and pulses while a test/lint runs.
- **Programs look like their users** — each program is the user's double. → `AGENT`: an agent
  figure could take the *colour of the session/person who started it*, so "whose agent is this"
  is visible.
- **Light-cycle walls** — trails that persist and block. → `AGENT` path history (see §0 #3).
- **Bit (yes/no companion)** — a tiny shape that only says yes or no by changing form. → a minimal
  **confirm/deny sprite** next to the cursor for permission prompts (two shapes, two colours).

### Tron: Legacy (2010) — GMUNK and team *(src)*
- **"All dark, a stormy world where everything is glass"** — the look-dev rule. → base material:
  near-black, slightly reflective ground, glassy translucent buildings; light comes only from edges.
- **Less greeble, faster reading** — they cut dense detail so each graphic is understood quickly.
  → confirm our anti-noise rule (§5).
- **Holograms light the actors** — UI elements cast light on what is near them. → a selected
  building throws a coloured glow on the ground and neighbours (cheap: projected decal or point
  light with small range).
- **Interface simplified to match soft gestures** — the UI reacts to small, calm motions. → for a
  non-coder: big, forgiving hit areas, slow eased reactions, no twitchy hover states.
- **Restrained depth** — built for medium/wide shots, never jolting. → camera rules: no sudden
  zooms, every jump is a tween ≥ 400 ms.
- **Palette** — light blue as staple, yellow allowed, pink rejected; wider warm range for special
  set pieces. → our tokens: cyan = ours/normal, amber = attention/waiting, red/orange = foreign or
  error, white = selected.
- **Arena scoreboard: bracketed matches, procedurally drawn linework** (built with custom tools by
  GMUNK & Josh Nimoy). → `GIT` parallel sessions as a **bracket**: N sessions converge pairwise into
  merges toward `main`. Re-impl: 2D bracket rendered on a floating glass panel over the city.
- **Identity disc = everything the program is, recording what it saw and did** *(src, fan wiki +
  Disney parks blog)*. → `AGENT` / `NET`: a **disc-like token = the agent's log / transcript**; drop
  it on a building to see what that agent did there. Keep our own shape (e.g. hexagonal chip, not a
  ring disc) for trademark distance.
- **The Grid city & light-lines on vehicles** *(kn)* — vehicles are wireframes extruded on demand.
  → open programs as **temporary constructs that extrude up from the ground** when launched and sink
  back when closed.
- **The Portal** *(kn)* — a single bright opening to the outside world, open only for a time.
  → GitWorld/"abroad" link: the **border gate** that opens while a push/pull/clone is in progress.
- **Derezz** — break into voxels. → `DEL` (§0 #15). Use a gentle version for "closed" and a sharp
  red version only for "crashed".

### Tron: Ares (2025) *(src, ILM interviews)*
- **The Grid "leaks" into the real world** — the main premise and VFX challenge. → the overlay-OS
  phase: constructs that appear *over* the normal desktop. Lesson: keep the same light-line language
  on both sides so the user knows "this is the city speaking".
- **Industrial redesign of a familiar look; retro 1982 look for one sequence** — two eras side by
  side. → a **"retro mode" lens** for history replay: older commits render in a flatter, 8-colour
  style, recent ones in full glass.
- **More graphic voxel break-up** than Legacy. → confirms voxel delete; make it stylised (fewer,
  larger cubes) to read at distance.
- **Wireframe hologram face (built with a facial-capture rig)** → an **agent's "face"** could be a
  sparse wireframe head that only appears when the agent talks to you (question/permission).

### Tron: Uprising (2012 series) *(kn)*
- Flat, high-contrast cel-shaded look with very few colours and heavy black. → proof the language
  survives without expensive rendering: a **low-power mode** (no bloom, flat emissive lines) for
  the overlay OS on weak GPUs.

### Tron 2.0 (2003 game) *(src partial)*
- **Corruption spreading as green, corrosive blobs; infected subroutines unusable until repaired.**
  → failing tests / lint errors as a **creeping tint that spreads along imports** from the broken
  file; the tint retracts when fixed. Re-impl: per-building `corruption` attribute, BFS along import
  roads, animated over seconds.
- **Subroutines as collectable/equippable upgrades in slots** → choosing tools/skills for an agent
  job as **slots on the agent's figure** (`AGENT` "choose agent for a job").

### Tron: Evolution (2010 game) *(kn)*
- Traversal along light-lines and wall-running. → a "ride the import road" camera mode: follow the
  dependency chain from a file outward.

### Tron: Identity (2023, Bithell Games) *(src)*
- **Detective in a repository; repairing ("defragmenting") damaged identity discs as a card puzzle;
  choices with consequences.** Reviewers called the disc puzzle the weakest part. → Lesson: **don't
  gamify maintenance chores** for a non-coder; borrow the *investigation framing* instead: "who
  touched this file and why" as a clue board (people, commits, agent transcripts pinned and linked).

---

## 2. Other "inside the computer" worlds

### Ralph Breaks the Internet (2018) — the most relevant to GitWorld and "abroad" *(src)*
- **Websites are buildings; bigger site = bigger building.** → GitWorld planet: other repos/sites as
  cities, size = stars/size. `NAV`.
- **Unique-everything was rejected — "you don't know which one to look at."** Repeated buildings
  with occasional eye-catchers. → strongest single readability rule for Kódváros.
- **Animated signage tuned down** after tests (timing, brightness, motion were too distracting). →
  limit simultaneous animations; animate only what changed.
- **Net users travel in cubes; a click forms a cube and lifts them to the site.** → §0 #7.
- **Netizens (system workers) deliver email in vans, push shopping carts.** → *our* service workers:
  small vehicles = background jobs (indexer, sync, backup) moving between buildings.
- **Transport mirrors real data transport (electrons in wire, light in fibre); the router and phone
  line are the on-ramp; information is "packaged and sent off".** → exactly the GitWorld transport
  metaphor: trains (internal), planes (small packets), container ships (large downloads).
- **Circuit-board roads with gold inlay; lower levels darker because new sites are built on old
  ones.** → **age as depth**: oldest code sits on the darker lower deck, new code on top. A cheap
  "geology" lens for history.

### Hackers (1995) — "City of Text" *(src)*
- **Uniform translucent towers on a circuit-board ground, file names written on the tower faces.**
  → labels *on* buildings, but avoid its flaw: **transparency shows text from the far side and
  clutters.** Use opaque label faces or billboarded labels.
- **Fly and bank between towers** — exploration is fun. → a free-flight mode for "browsing"; a
  separate snap-to mode for "doing".
- **Search highlights matches in colour and gives a path.** → `SRCH`: Ctrl+K results light up in
  place in the city *and* show the breadcrumb.
- **Attack shown by towers turning red and the palette darkening.** → global "system under
  stress" state = whole-scene grade shift (post-processing), readable at a glance.
- **Critique to heed:** ambiguous pulses ("activity or screensaver?"). → every animation must mean
  one thing and the legend must say what.

### Jurassic Park (1993) — SGI fsn file system navigator *(src)*
- Pedestals = directories (height = data inside), blocks on top = files (height = size, colour =
  age), connected by wires you travel along. Real software, cloned as `fsv` and `fsnav` (open
  source — **don't copy their code; re-implement**). → validates Kódváros' core; borrow **colour =
  age** as the default lens and **wire travel** for `NAV`.
- Lesson from the film: it was slow — never put the 3D view in the path of an urgent action. →
  every urgent action (stop agent, cancel download) must also be one keypress / Ctrl+K away.

### ReBoot (1994) *(src)*
- **Mainframe = a city in a computer, split into named sectors.** → districts with *human names*
  ("Tervező negyed", "Raktár") instead of folder paths for the non-coder; path in a tooltip.
- **Game Cube: when the User starts a game, a cube drops on a random sector and seals it.** →
  `PROC` **heavy jobs (build, test run, render) drop a translucent dome/cube over the district
  they work on**; the district is "busy" until it lifts. Very intuitive "don't touch, working".
- **Binomes (1s and 0s as tiny citizens)** → ambient crowd density = activity level of a district.

### The Matrix / Animatrix *(kn)*
- **Falling-glyph code view**: illegible but instantly signals "raw data". → use only as a
  *transition* texture (entering a building = glyph rain wipe), never as information.
- **Operator watches the raw stream while others are "inside"** → a **split view**: city on one
  side, raw log of the selected agent on the other.

### Ghost in the Shell (1995 / 2017 — Territory Studio worked on 2017) *(src for Territory; kn otherwise)*
- **Net dives as descending through layered translucent planes**; 2017 moved past flat rectangles
  into curved and holographic spaces. → `NAV`: zooming GitWorld → Land → city → building as passing
  through **layer planes** with a brief label ("Belépés: Kódváros").

### Johnny Mnemonic (1995) / Lawnmower Man (1992) *(kn)*
- Gloved navigation of a cyberspace of floating blocks; mostly spectacle. → **low priority**; take
  only the idea of **data as physical cargo carried by a courier** (Johnny carries data in his head)
  → a large download *is* a ship with a visible load bar on its hull.

### Ready Player One (2018) *(kn)*
- Planets as separate worlds you hop between; persistent inventory across worlds. → GitWorld
  hopping: your **selection/clipboard follows you across repos** (shown as a carried item).

### Inside Out (2015) *(src, fan wiki + NPR)*
- **Control room with a screen of "what the world sees" and a console**; memories as **glowing
  orbs replaying their moment on a loop**; at day's end orbs are **flushed up a tube to long-term
  storage.** → `GIT`: commits as orbs that loop a tiny diff preview; **push = orbs sent up a tube to
  GitWorld**; the H: drive / backup as the long-term memory shelves. Colour of an orb = kind of
  change (fix / feature / docs).

### Cells at Work! (2015 manga / 2018 anime) *(kn)*
- Body as a city; workers in uniforms per role; deliveries along vessels; emergency responders.
  → **role uniforms for agents**: reader, editor, tester, reviewer each with a clear silhouette;
  colour = owner, shape = role.

---

## 3. Games — interaction and live-state patterns

### Transport and logistics (highest value for `NET`, `GIT`, `PROC`)
- **Mini Metro / Mini Motorways** *(src for design approach)* — "less is more"; information as
  simple geometric shapes; approachable first, depth later. → `GIT`: **branches as metro lines**,
  commits as stations, merge as an interchange; **parallel sessions = trains on different lines**.
  Shapes for kinds (circle = file, triangle = test, square = config) instead of text.
- **Factorio** *(src)* — production window with 5 s → all-time timescales; rates per item. → `HW`
  `NET`: per-construct **rate graphs** (CPU %, MB/s). Also the general Factorio lesson *(kn)*:
  **belts show flow by moving items** — a stalled belt is visibly stopped. → downloads as items on
  a conveyor; stall = items stop.
- **Satisfactory** *(kn)* — pipes show fill and flow direction. → audio routing and RAM as pipes.
- **Anno (1800 etc.)** *(kn)* — trade routes drawn as dotted lines; ships carry visible cargo; a
  route editor. → `NET`: **ships "abroad" on dotted routes**; cargo stacks = data size. Recurring
  syncs as standing routes.
- **Cities: Skylines** *(src)* — info views overlay a green→red gradient; a modded "routes" view
  shows every vehicle route through a selected road; community warned *red volume ≠ problem*. →
  §0 #5, plus: **click an import road → highlight every file that depends through it.** Show
  *problems*, not raw volume.
- **SimCity advisors** *(kn)* — a few characters who speak up when their domain needs you. → one
  "advisor" per domain (Storage, Network, Git, Agents) that raises a hand with a short sentence.
  Good for the non-coder; keep to 4 at most.
- **Frostpunk** *(kn)* — radial city around one heat source; heat zones; steam showing load. →
  **the PC as a central generator**: CPU/thermal load as a glow radius; "overheating" visible.

### Maps and situational views
- **EVE Online map** *(src)* — statistics modes (jumps/kills/pilots in the last hour), switchable
  "colour by" layers, decaying event markers in kill heatmaps. → §0 #10; also a **mode bar at the
  bottom** of the city view.
- **Elite Dangerous galaxy map** *(src, forum reports)* — route plotting with filters; players got
  burnt by **hidden filters silently changing results**. → lesson: an active filter/lens must
  always be visibly shown (a chip "Lens: CPU ✕").
- **Destiny 2 Director** *(src)* — galaxy map → local map, two scales one key apart; praised as
  "creativity and clarity". → `NAV`: GitWorld ↔ Land ↔ city on one key with a stable layout.
- **Homeworld sensors manager** *(kn)* — zoom-out to a tactical view with simple icons replacing
  the 3D models. → **semantic zoom**: far away, buildings become icons/dots with counts; near,
  full geometry.
- **DEFCON** *(kn)* — vector-line world on black, everything as thin glowing lines and pulses. →
  GitWorld planet view: **thin vector arcs for traffic between Land and abroad**; arc thickness =
  volume.
- **Westworld map table** *(kn)* — a physical relief map that rises from a table. → the Land
  overview as a **tabletop model** you lean over; the city "grows" from the table on open.

### Hacking / systems games
- **Uplink** *(kn)* — world map; you chain bounce nodes and see the trace line closing in. → `NET`:
  show the **path a request takes** (PC → router → ISP → GitHub) as hops on the map, each lighting
  when passed.
- **Hacknet** *(src)* — four panes: terminal, content, clickable network map of discovered nodes,
  RAM bar; discovered nodes stay on the map. → `HW`: **RAM as a visible bar that running things
  occupy as blocks**; `NAV`: places you've visited stay on the map.
- **Hackmud** *(kn)* — pure text; skip for visuals.
- **Watch Dogs ctOS profiler** *(src)* — point at a person → a floating card with name/role/a line
  of trivia. → **hover card** over any building/agent/device: one name, one role, one live number.
  Don't import the surveillance tone.
- **Deus Ex (Human Revolution) hacking** *(kn)* — node graph, capture nodes, a detection trace
  advancing. → visual for **a merge/rebase in progress**: nodes captured one by one; conflict = node
  turns amber.
- **Cyberpunk 2077 braindance** *(src)* — layered timeline (visual/audio/thermal), shaded clue
  bands, free camera in edit mode. → §0 #9. **Netrunning** *(kn)*: quickhack queue with a progress
  sweep per target → **agent job queue** shown as stacked sweeps over targets.
- **Transistor** *(kn)* — "Turn()": freeze time, plan a sequence of actions, then execute. → **group
  actions**: pause the live view, queue actions on selected objects (`SEL`), then "run".

### Rule and puzzle games
- **Baba Is You** *(kn)* — rules are physical word-blocks you push. → **shortcut prompts / standing
  rules as physical tiles** placed in a district ("Agent → only reads here").
- **Opus Magnum / Shenzhen I/O / Zachtronics** *(kn)* — you build a machine, it loops, and you see
  a histogram of cost/speed vs. other players. → for an agent job: **"plan" shown as a small
  machine diagram**; after the run, a compact cost/time chart.
- **Townscaper** *(kn)* — click anywhere, the system decides the shape; no failure states. → onboarding
  tone for the non-coder: **every click yields something sensible**; no dead ends.
- **The Witness** — little to borrow for our features; skip.

---

## 4. Fictional-UI studios and designers — principles worth adopting

- **GMUNK (Tron: Legacy, Oblivion)** *(src)* — dark glass; cut greeble; dot-grid that anchors
  every element; bright unified palette that reads on dark *and* light backgrounds; most graphics
  shot in-camera. → keep a **hidden layout grid** for all floating panels; test palette on both
  the city and the plain desktop (overlay OS).
- **Jayse Hansen (Iron Man HUDs, Avengers)** *(src)* — "all the graphics had a purpose"; text
  relevant to the scene; negative space on glass; without purpose a HUD is circles and random text;
  depth planes placed deliberately; research with real experts. → each panel answers one question;
  put HUD panels on **one or two fixed depth planes** only.
- **Territory Studio (Guardians, Ghost in the Shell, Blade Runner 2049, The Martian)** *(src for
  approach)* — support the story without pulling the eye; rapid prototyping on set. → **prototype
  each new view against a real task the user does**, not as decoration.
- **Perception (Marvel, Black Panther)** *(kn)* — tech built from cultural motifs. → our motif
  could come from the user's own trade (electrical installation: conduits, junction boxes,
  breakers) — a city whose roads look like conduit runs ties Kódváros to the Varler/Planner world.
- **HUDS+GUIS** and **Sci-Fi Interfaces (Chris Noessel)** *(src)* — catalogue + critique. Noessel's
  "works for audiences / works for users" split is the key test: **we must work for the user, not
  an audience.** Book: *Make It So* (Shedroff & Noessel, 2012).
- **Minority Report / Underkoffler's g-speak** *(src)* — gesture suits 3D navigation, sorting and
  selection; fails for text entry; gloves were a barrier. → mouse/drag lasso for `SEL`; Ctrl+K text
  for commands; gestures only for camera.
- **Iron Man JARVIS holotable** *(kn)* — pull a part out, explode it, spin it. → **exploded view of a
  building** (file → functions/sections floating apart) on double-click.
- **Oblivion light table** *(src)* — monitoring vitals + diagnostics on one table. → the **Land
  overview table** (see Westworld) combines HW vitals and the city.
- **The Expanse** *(kn)* — glass panels everywhere, consistent per-faction styling, physical
  plausibility. → **per-origin styling**: ours (cyan), GitHub/abroad (neutral white), third-party
  vendor code (amber edges).
- **Dead Space (Dino Ignacio, GDC 2013)** *(src)* — fully diegetic UI removes the "wall of safety";
  critique: diegetic is often less efficient. → hybrid: **status on objects** *plus* one minimal
  fixed corner for the essentials (clock, active agents count, alerts).
- **Oblivion/Expanse/Avengers overlay lesson** — a fictional UI is read for 2 seconds; ours is read
  for hours. Fatigue matters: **no constant motion, no flicker, low bloom.**

---

## 5. Real control rooms — clarity patterns for live state

- **ISA-101 high-performance HMI (process plants, SCADA)** *(src)* — grey/neutral baseline; colour,
  motion and blinking **reserved for abnormal conditions**; never colour as the only cue
  (colour-blindness). → our master rule: **a calm city means all is well.** Pair colour with shape
  or icon.
- **Air-traffic control** *(src)* — standardised strips with fixed fields; physical placement
  encodes status (strip in the runway bay = runway occupied); handover via strips builds the next
  controller's picture. → `AGENT` / `GIT` sessions as **strips in bays**; a handover between
  sessions = moving a strip. Fixed field order on every hover card (name · owner · state · time).
- **NASA mission control / Open MCT** *(src)* — composable views: the same telemetry point as
  plot, number, or metadata; stacked/overlay plots; green/yellow/red limit bands. → every live
  value in Kódváros can be **"turned" into number / sparkline / table** from the right-click menu.
  (Open MCT is Apache-2.0 open source: study it, don't paste it.)
- **Metro control centres** *(kn)* — a schematic line diagram (not geographic) showing every train
  as a block on its line; delays in amber. → `GIT` line view (Mini Metro idea, but schematic):
  **one straight line per branch with session "trains" on it.**
- **Network operation centres** *(kn)* — wallboard: big map + top-N problem list + trend graphs.
  → the overlay OS "wall" mode: city + a short **"needs you" list** + 3 sparklines (CPU, net, agents).
- **Power-grid SCADA single-line diagrams** *(kn)* — flows drawn on fixed lines; breakers shown
  open/closed by shape. → USB/Bluetooth devices (`DEV`) as **plugs on a port board** shown
  connected/disconnected by shape, not only colour. Familiar to an electrician.

---

## 6. Feature → best borrowed ideas (quick lookup)

| Feature | Primary borrow | Secondary |
|---|---|---|
| Live processes | ReBoot game-cube dome over busy district; Tron construct extrude/sink | ISA-101 calm baseline; Factorio rate graph |
| Claude agents | Tron light-line figures in owner colour + trail; Cells at Work role silhouettes | ATC strips for job state; Ares wireframe face for questions |
| Git branches / merges / parallel sessions | Mini Metro lines + interchanges; metro control schematic | Legacy bracket scoreboard; Inside Out orbs up the tube on push; braindance layered scrubber |
| Downloads / uploads abroad | Ralph transport + router on-ramp; Anno ships with cargo; I/O tower beacon | DEFCON arcs on the planet; Uplink hop path |
| Devices (USB/BT) | SCADA plug/breaker shapes on a port board | Watch Dogs-style hover card |
| Audio / Spotify stadium | Satisfactory pipes for routing; stadium as a building with live EQ bars as floodlights *(our own)* | Braindance audio layer: sound sources emit visible rings |
| CPU / RAM / disk | Frostpunk generator heat radius; Hacknet RAM bar with blocks | Factorio timescales; Open MCT view switching |
| Ctrl+K search | Hackers in-place highlight + path; Ralph lift-cube travel | Destiny two-scale map key |
| Multi-select / group actions | Transistor plan-then-execute; g-speak lasso | Baba Is You rule tiles for standing rules |
| Progress | Dead Space on-object segmented bands | EVE decaying rings; braindance shaded bands |
| Delete / close / crash | Voxel break-up (gentle for close, red for crash) | Tron 2.0 corruption spread for failing tests |
| Navigation between scales | Ghost in the Shell layer planes; Homeworld semantic zoom | Westworld tabletop; Destiny Director |

---

## 7. Avoid list (what makes fictional UIs unusable)

1. **Unique-everything** — Ralph's team rejected it; the eye has nowhere to rest.
2. **Ambiguous motion** — Hackers' pulses: activity or screensaver? Each animation = one meaning.
3. **Transparency that stacks text** — Hackers' towers. Opaque label faces.
4. **Greeble and random numbers** — Hansen: without purpose it is "circles and random text".
5. **Hidden filters** — Elite's route plotter. Show active lenses as removable chips.
6. **Colour as the only signal** — ISA-101; pair with shape/icon/label.
7. **Constant glow and bloom** — fine for 2 s on screen, tiring over a workday; keep a low-glow mode.
8. **Spectacle in the urgent path** — Jurassic Park's slow 3D in an emergency; keep a keyboard route.
9. **Gamified chores** — Tron: Identity's disc puzzle was the weakest part.
10. **Surveillance tone** (Watch Dogs) — borrow the hover card, not the profiling vibe.

## 8. IP / trademark flags

- **TRON** (Disney): name, logo, light-cycle and identity-disc silhouettes — do not use. Avoid
  "derezz", "Grid", "Recognizer", "I/O Tower", "Encom" as product terms.
- **Ralph Breaks the Internet**, **Inside Out**, **Cells at Work** characters/designs — ideas only.
- **Mini Metro** line style is generic, but don't replicate its exact station glyph set and palette.
- **fsn** (SGI), **fsv**, **fsnav**, **Open MCT** — real software; licences differ; re-implement, don't copy.
- **Cyberpunk 2077 "braindance"**, **ctOS** — trademarked terms; don't use as names.

---

## Sources

- GMUNK / Tron: Legacy — [gmunk.com TRON: Legacy](https://gmunk.com/TRON-Legacy) ·
  [Pushing Pixels interview with GMUNK](https://www.pushing-pixels.org/2011/06/01/visual-effects-of-tron-legacy-and-beyond-conversation-with-gmunk.html) ·
  [HUDS+GUIS: TRON Legacy UI](https://www.hudsandguis.com/2011/04/19/tron-legacy-ui/) ·
  [/Film VFX breakdowns](https://www.slashfilm.com/522718/vfx-breakdowns-the-user-interfaces-and-holograms-of-tron-legacy/)
- Tron: Ares — [ILM: David Seager interview](https://www.ilm.com/tron-ares-david-seager-interview-ilm-vfx/) ·
  [Art of VFX](https://www.artofvfx.com/tron-ares-david-seager-production-vfx-supervisor-vincent-papaix-and-jeff-capogreco-vfx-supervisors-ilm/) ·
  [ILM Vancouver](https://www.ilm.com/redefining-the-grid-ilms-vancouver-team-talks-tron-ares/)
- Tron lore — [I/O Tower (fan wiki)](https://breezewiki.discard.no/tron/wiki/I/O_Tower) ·
  [Identity Disc (fan wiki)](https://tron.fandom.com/wiki/Identity_Disc) ·
  [Disney Parks Blog: World of TRON](https://disneyparksblog.com/wdw/everything-you-need-to-know-about-the-world-of-tron/) ·
  [Tron 2.0 (Wikipedia)](https://en.wikipedia.org/wiki/Tron_2.0) ·
  [Tron: Identity (Wikipedia)](https://en.wikipedia.org/wiki/Tron:_Identity) ·
  [Slant review](https://www.slantmagazine.com/games/tron-identity-review/) ·
  [Filmstories review](https://filmstories.co.uk/reviews/tron-identity-review-bithell-game-digital-detective/)
- TRON trademark — [Decrypt: Disney halts TRON trademark](https://decrypt.co/15378/disney-halts-justin-suns-attempt-to-trademark-tron) ·
  [The Block](https://www.theblock.co/news/regulation/2019-12-20-tron-foundation-partner-sought-u-s-trademarks-but-disney-pushed-back-and-won-51273) ·
  [USPTO TTAB 91267886](https://ttabvue.uspto.gov/ttabvue/ttabvue-91267886-OPP-1.pdf) ·
  [CIPO TRON LEGACY 1457859](https://ised-isde.canada.ca/cipo/trademark-search/1457859)
- Ralph Breaks the Internet — [AWN: visualizing and building the world](https://awn.com/animationworld/visualizing-and-building-world-ralph-breaks-internet) ·
  [80.lv: creating the internet](https://80.lv/articles/creating-the-internet-for-wreck-it-ralph-2) ·
  [Inside the Magic: Netizens](https://insidethemagic.net/2018/10/yesss-ralph-breaks-the-internet-characters/)
- Hackers — [Sci-Fi Interfaces: Hackers](https://scifiinterfaces.com/tag/architecture/) ·
  [Dodge, Atlas of Cyberspace: artistic](https://personalpages.manchester.ac.uk/staff/m.dodge/cybergeography/Atlas/artistic.html)
- fsn — [File System Visualizer (Wikipedia)](https://en.wikipedia.org/wiki/File_System_Visualizer) ·
  [tech-pubs: Jurassic Park](https://tech-pubs.net/wiki/Jurassic_Park)
- ReBoot — [Wikipedia](https://en.wikipedia.org/wiki/ReBoot)
- Inside Out — [Headquarters (Pixar wiki)](https://pixar.fandom.com/wiki/Headquarters) ·
  [Memory Orbs (Disney wiki)](https://disney.fandom.com/wiki/Memory_Orbs) ·
  [NPR review](https://www.npr.org/2015/06/18/414701069/from-the-inside-out-a-lively-look-inside-a-young-mind)
- Cities: Skylines — [TM:PE Traffic Routes info view](https://github.com/krzychu124/Cities-Skylines-Traffic-Manager-President-Edition/wiki/Traffic-Routes-Info-View)
- Mini Metro — [GDC 2017: When Less Is More](https://gdconf.com/news/attend-gdc-2017-and-learn-the-value-of-less-is-more-from-a-mini-metro-dev) ·
  [Mini Motorways Wuselfaktor](https://www.thumbsticks.com/hustle-and-bustle-how-mini-motorways-built-its-wuselfaktor/) ·
  [Human Transit](https://humantransit.org/?p=20509)
- Factorio — [Production statistics (wiki)](https://wiki.factorio.com/Production_statistics) ·
  [LuaFlowStatistics](https://lua-api.factorio.com/1.1.70/LuaFlowStatistics.html)
- Cyberpunk 2077 braindance — [PC Gamer guide](https://pcgamer.com/how-to-use-cyberpunk-2077-braindance-editor)
- Destiny 2 — [GamesRadar: menus and maps](https://www.gamesradar.com/destiny-2-menu) ·
  [Twinfinite: Director on PC](https://twinfinite.net/?p=310544)
- Elite Dangerous — [Frontier forum: Ascendancy route plotter](https://forums.frontier.co.uk/threads/galaxy-route-plotter-broken-after-ascendancy-update.629063)
- EVE Online — [PCGamesN kill map](https://www.pcgamesn.com/eve-online/eve-kill-map) ·
  [Star map statistics](https://forums.eveonline.com/t/star-map-help-statistics/339272) ·
  [SMT docs](https://developers.eveonline.com/docs/community/smt/)
- Watch Dogs — [ctOS Scan (fan wiki)](https://watchdogs.fandom.com/wiki/File:CtOS_Scan_selection.png)
- Hacknet — [Scientific Gamer: Thoughts](https://scientificgamer.com/thoughts-hacknet/)
- Dead Space — [Game Developer: Designing Dead Space's UI (GDC)](https://gamedeveloper.com/design/video-designing-i-dead-space-i-s-immersive-user-interface) ·
  [HUDS+GUIS: Dead Space 2](https://www.hudsandguis.com/2012/08/22/dead-space-2-diegetic-interface-design) ·
  [Giant Bomb essay](https://giantbomb.com/users/3929/articles/markers-ii-where-are-all-the-dead-space-uis)
- Oblivion — [Motionographer](https://motionographer.com/2013/04/19/bradley-g-munkowitz-oblivion-screen-graphics) ·
  [HUDS+GUIS](https://www.hudsandguis.com/2013/05/02/oblivion-interface-design/) ·
  [CG Press](https://cgpress.org/archives/oblivion_hud_and_interface_design_breakdowns.html)
- Jayse Hansen — [Pushing Pixels interview](https://www.pushing-pixels.org/?p=7447) ·
  [Subtraction](https://subtraction.com/2013/09/03/designing-fictional-interfaces/amp)
- Territory Studio — [Pushing Pixels: David Sheldon-Hicks](https://www.pushing-pixels.org/2014/08/07/the-craft-of-screen-graphics-and-movie-user-interfaces-interview-with-david-sheldon-hicks-of-territory-studio.html) ·
  [Pushing Pixels: Peter Eszenyi](https://www.pushing-pixels.org/?p=13856)
- Make It So — [Rosenfeld Media](https://rosenfeldmedia.com/?p=187487)
- Minority Report / g-speak — [Microsoft Research talk](https://www.microsoft.com/en-us/research/video/hands-and-pixels-from-the-minority-report-interface-to-a-full-stack-spatial-computing-platform/) ·
  [TechCrunch 2008](https://techcrunch.com/2008/11/17/oblongs-g-speak-spatial-operating-interface-brings-minority-report-ui-to-life) ·
  [CDM](https://cdm.link/dont-call-it-minority-report-call-g-speak-a-spatial-gestural-operating-environment/)
- ISA-101 HMI — [Control.com: Going Gray](https://control.com/technical-articles/going-gray/) ·
  [GoJS HMI sample](https://gojs.net/latest/samples/hmiOperatorScreen) ·
  [ISA-101 study guide](https://open-exam-prep.com/study-guides/isa-cap/system-design-hmi-alarms-enterprise/hmi-design-isa101)
- ATC — [SKYbrary: Flight Progress Strips](https://skybrary.aero/articles/flight-progress-strips) ·
  [FAA 1993 strips and controller memory](https://hf.tc.faa.gov/publications/1993-influence-of-individual-experience-and-flight-strips-on-air-traffic-controller-memory/)
- Open MCT / telemetry — [NASA Spinoff](https://spinoff.nasa.gov/node/11075) ·
  [PACE telemetry help](https://oceandata.sci.gsfc.nasa.gov/tlm/help/)
