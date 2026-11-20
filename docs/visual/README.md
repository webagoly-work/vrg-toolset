# VRG Látótér: the visual layer, sorted and placed

*2026-11-20. A plan for every tool in the repo whose main job is to **show** something: what each one is, which
ones earn their place, where they live in the VRG Asztal and VRG Mobile, and one design that joins the
best of them into the Founder's own overview board. The interactive design is `latoter.html` (https://claude.ai/artifact/12mKZNpQSRhSvVG5XZ5mhm,
in the Archive). Decisions are in §8 (**VIS-Q1…Q9**, all answered 2026-11-20). Builds on the **VRG Overhaul Plan**
(Archive `vrg-overhaul-plan`, 2026-11-14) and does not change its P0–P6: this is the plan for its
"Workshop and visualisation" rows.*

## 1. Verdict

There are **about 45 visual tools**. The good ones are very good (Kódváros, the Stack 3D pages, the Solomon
Gömb, Munkavászon, Térkép), but they grew one idea at a time:

- **Six programs read the same Claude transcripts or hooks** and draw them six ways: Ügynöknyom, Munkavászon,
  Stack Futásnapló and Visszajátszás, the Konnektóm "firing", Kódváros agents and session replay.
- **Four brains** draw the knowledge stack (Konnektóm, Holo with four forms, Konnektóm-labor, Solomon Gömb),
  **three layout algorithms** grow "the repo as a city" (Kódváros K2-01, Gépország Növekedés, kit `citymap`),
  and there are **four ring implementations** (logo ring, SUI `ring.js`, kit `notify`, the Console status ring).
- **The kit's visual components are almost unused:** of the 15, only `emblem` (Kapu) and `scrubber`
  (Ötletfolyam) are in a live app. `graph`, `layerstack`, `citymap`, `timeline`, `eventrail`, `heatgrid` live
  in the gallery only.
- **Nothing sits above them.** The Desktop shows each as a tile in a Dev section. No board shows the whole
  workshop at once, which is the thing the Founder asked for.

The fix is the Overhaul's own rule applied to visuals: **one source per subject, one registry of views, one
host that switches between them.** Very little has to be rewritten; most of the work is sorting, merging and
wiring. The one new piece is the board (§5), built from parts that already exist: the kit `emblem` /
Feature Dioramas language, the Kódváros growth layout and the Munkavászon event model.

## 2. Two axes for every visual

Every visual answers **what** (its subject) and **how alive** (its relation to the thing it shows).
Industry terms, so that the names stay stable (they go into `docs/desktop/GLOSSARY.md`, VIS-Q2):

| Liveness | Industry meaning | In VRG |
|---|---|---|
| **Pillanatkép** (*snapshot / structural model*) | Built from data at one moment; does not change while you look. | Kódváros city, Stack Konnektóm / Rétegek / Vonaltérkép, Solomon Gömb, BuildTree, Feature Dioramas |
| **Generatív vászon** (*generative canvas*) | Draws itself from a stream of events; time is an axis and the picture is the history. Can be replayed. | Munkavászon, Ötletfolyam, Kódváros growth replay, Commit-pixel, the Divergence ring |
| **Digitális árnyék** (*digital shadow*) | A live, one-way mirror of a running process or system: data flows from the thing to the picture, never back. | Ügynöknyom, Munkavászon live, Gépország, Kódváros live agents, Időjárás, Divergence signals, server lamps |
| **Digitális iker** (*digital twin*) | A model kept in sync with a physical system **and able to act on it** (settings, commands), with its own state history. | Not in VRG yet. Closest: Planner CYD (Planner state on a device), Board Console. The real one is the client house: Planner model + Topology View + live BRIDGE sensors (§6, product side) |
| **Szimuláció** (*simulation*) | Computes what *would* happen under rules; it mirrors nothing real. | FLIP, Örvénylabor GPE, chase spike, Site Pager bench, the CYD simulators |
| **Magyarázó** (*explainer / study*) | A static, hand-made page that argues one point. | The Archive one-offs: Kódváros 2.0 plan, Gépország sheet, BRIDGE topology, client-look directions, UI Kit gallery |

A **stale simulation** is a simulation, or a shadow whose source has gone, that no longer feeds any decision:
the Archive spikes, `fake_cyd.js` without a firmware change in sight, Konnektóm-labor's frozen Stack copy.
They are not deleted; they move to the Archive's **Labor** shelf and leave every menu.

Subjects (what the visual is about), seven of them:

| Subject | Contains |
|---|---|
| **Kód** (*code and repo*) | files, commits, branches, builds |
| **Munkamenet** (*sessions and agents*) | Claude sessions, subagents, tools, background jobs, the Council |
| **Tudás** (*knowledge and decisions*) | Stack layers, DevLog lines, ideas, decisions, documents, rulings |
| **Munka** (*jobs and clients*) | jobs, quotes, sites on the map |
| **Épület** (*building and wiring*) | the Planner model, views, the client preview, BRIDGE, Topology |
| **Gép** (*devices and this PC*) | CYD, ServiceKit, Board Console, the PC (Gépország) |
| **Környezet** (*environment*) | weather, the map's ground |

## 3. Every visual, classified, with a verdict

Fate words are the Overhaul's: **keep** (polish in place) · **rework** (change structure) · **merge** (fold into
another part) · **retire** (remove once its job has moved) · **Labor** (to the Archive's Labor shelf).
"Lens" means: registered in the catalog as a view of its subject, reachable from the Látótér (§4).

### Kód
| Tool | Liveness | Fate | Target |
|---|---|---|---|
| Kódváros (Város / Globális / Egyszerű) | snapshot + replay + live agents | **keep** | The Kód **structure** lens (3D, Részlet level). Header, palette, keys from the kit (Overhaul P4). Free Ctrl+Alt+K. |
| Kódváros 2.0 growth layout (K2-01…04, K2-09) | snapshot | **keep, promote** | Becomes the **one** growth layout: it places the Látótér board's islands (§5). Update the stale v2 README header. |
| Gépország Növekedés plan | snapshot | **merge** | Into the K2-01 layout; keep Gépország for the PC. |
| kit `citymap` (iso, organic buildup) | snapshot | **rework** | The 2D / iso renderer of the K2-01 layout: draws the board's ground and Kódváros Egyszerű. Fix the lot draw order first. |
| Commit-pixel (Stack R) | generative | **rework** | The Kód **time** lens; switch to kit `heatgrid` (one grid, not two). |
| Dashboard weekly commit bars | snapshot | **merge** | The Mérőszámok section shows the `heatgrid` lens. |
| Mobile Haladás | list | **keep** | Not a visual; links to the Kód time lens. |

### Munkamenet
| Tool | Liveness | Fate | Target |
|---|---|---|---|
| Munkavászon | generative + shadow | **keep, promote** | The Munkamenet **time** lens, and the source of the event spine (§4.3). Port moved to :8810 (the Weather demo has :8809). |
| Ügynöknyom (Console trace) | shadow, can gate | **keep** | The Munkamenet **live** lens (ring form) and the only place that answers permission gates. Reads the same spine. |
| Stack Visszajátszás (`replay.html`) | replay | **retire** | Munkavászon replays a session with real time, images and fan-outs; `#sel=` links move to it. |
| Stack Futásnapló (`runs.html`) | snapshot | **keep** | The day view of runs; clicking a run opens it in Munkavászon. |
| Stack Vezérlőterem (`control.html`) | snapshot | **keep** | The Council's flow; a Munkamenet lens at Dev. |
| Kódváros agents / session replay | shadow | **rework** | Reads the event spine instead of its own transcript parser. |
| Konnektóm "firing" | replay | **Labor** (VIS-Q5) | The idea moves to the Stack Viewer: lit paths instead of a firing brain. |

### Tudás
| Tool | Liveness | Fate | Target |
|---|---|---|---|
| Konnektóm | snapshot | **Labor** (VIS-Q5) | Off the menus and the phone's M17 chips; kept on the Labor shelf. |
| Holo (Polip / Gömb / Föld / Mag) | snapshot | **Labor** (VIS-Q5) | All four forms. |
| Rétegek (`layers.html`, isometric) → Stack Viewer | snapshot + lit paths | **promote: the main visual** (VIS-Q5, Q6) | Replaced by the Stack Viewer (STK-Q25 = A), drawn with kit `layerstack` (VIS-Q6 = A). The Founder named it the main feature: the view that lights up the paths a workflow touches. How it merges with the Munkavászon's activity is reassessed in `stack-lens/` (fork, 2026-11-20). |
| Konnektóm-labor | snapshot (frozen) | **Labor** | It is a gift file with a frozen Stack copy and a missing rebuild path. Out of the catalog's User level; Archive only. |
| Solomon Gömb (+ phone Gömb) | snapshot | **keep** | The Tudás **documents** lens; a different subject (documents and rulings), so not a duplicate. |
| Vonaltérkép (metro) | snapshot | **keep** | The Tudás **lines** lens. |
| Thread Board (outside git) | snapshot | **merge** | Into Vonaltérkép as its board mode; nothing outside git in a menu. |
| Ötletfolyam (lineage) | generative | **keep** | The Tudás **time** lens. |
| MindMap idea timeline | snapshot | **retire as a visual** | MindMap stays an editor; the idea timeline is the Ötletfolyam's job. |
| Döntésnapló | list | **keep** | Not a visual; its counts feed the board's decision flags. |
| Divergence board | generative + shadow | **keep** | The Tudás **signals** lens; its ring is the board's notification beacon. |

### Munka · Épület · Gép · Környezet
| Tool | Liveness | Fate | Target |
|---|---|---|---|
| VRG Térkép (+ jobs layer) | snapshot + shadow | **keep** | User app; the Munka **map** lens. |
| Planner Views V0–V9, client preview | model (design time) | **keep** | Product side, inside the Planner. Not on the dev board. |
| Topology View (planned) | twin (future) | **keep the plan** | With live BRIDGE sensors it is VRG's first real digital twin (§6). |
| BRIDGE-DN diagrams, cabinet SVGs, ESPBLOK builders | explainer | **keep** | Documents under the `bridge` set; no menu entry. |
| BRIDGE / BuildTree / OmniComm copies and `_source-variants`, `MindMap/varler_mindmd2.html` | — | **retire** | Duplicates (VIS-Q8 confirms the list). |
| BuildTree "diagram viewer placeholder" | — | **retire** | Remove the empty placeholder until ESPBLOK viz exists. |
| Planner CYD dashboard | shadow → twin | **keep** | Device; its pages mirror the Planner. |
| CYD simulators, kit `cyd` | simulation | **Labor** (sims) / keep (kit) | |
| Gépország (+ Land, Erőmű, Stadion, Tárház, Birtok) | shadow | **keep**; **merge** Tárház into Birtok | The Gép **live** lens. One drive-as-estate view, not two. |
| Időjárás | shadow | **keep** | User app; the Környezet lens. |
| Open MCT spike | — | **retire** | The Munkavászon and the Desktop cover a telemetry console. |

### Kit, identity, Archive
| Tool | Fate | Target |
|---|---|---|
| kit `emblem`, Feature Dioramas | **promote** | The board's building blocks (§5). Restore the missing `shared/vrg-ui-kit/dioramas/build.js` from the Archive page so the dioramas can be regenerated from `features.json`. |
| kit `graph`, `timeline`, `eventrail`, `trace`, `minimap`, `micro` | **keep** | Use them or drop them in kit v1.2: a component no live app uses after P4 leaves the kit. |
| Four ring implementations | **merge** | One kit ring (Overhaul P4); the logo ring stays a brand asset. |
| Archive physics sims (FLIP, Örvénylabor, chase), Site Pager bench, CYD ideas | **Labor** | The Archive's Labor shelf; the two spikes identical to `docs/research` keep one copy. |

**Count after the sort** (counted from the tables above): **15 lenses** in the catalog (Kód 2, Munkamenet 4,
Tudás 6, Munka 1, Gép 1, Környezet 1), about **8** items to the Labor shelf, **6** merges and **5** retirements;
the Planner views, BRIDGE documents and devices stay inside their own programs.

## 4. The structure: one registry of lenses, one spine, one host

### 4.1 Lenses in the catalog (no new list)
A visual is a catalog item of type `view` with two new fields, checked by `check-catalog` (VIS-Q3):

```json
{ "id": "munkavaszon", "type": "view", "lens": { "subject": "munkamenet", "liveness": ["generative", "shadow"],
  "aspect": "time", "zoom": "detail", "touch": true } }
```

`aspect` is one of **structure · time · live · map · documents · lines · signals**. Every surface that offers
visuals (Desktop, Mobile, the board's lens ring, Ctrl+K) asks the catalog for "the lenses of subject X". A new
visual becomes reachable everywhere by adding one catalog entry. No visual has a menu entry of its own any more.

### 4.2 Three levels of zoom (the inner logic)
The same three levels everywhere, on the Desktop and the phone:

| Level | Name | What you see | In / out |
|---|---|---|---|
| 1 | **Sziget** (*island*) | The board: every subject as a district, every feature as a diorama, live activity on top. | Enter / pinch out / ↑ |
| 2 | **Telek** (*plot*) | One subject or feature: its lenses side by side as live miniatures. | Enter / pinch in / ↓; Esc / pinch out / ↑ |
| 3 | **Részlet** (*detail*) | One lens, full: Kódváros, Munkavászon, Konnektóm … The app itself, in its window. | Esc / pinch out / ↑ |

**Directions mean one thing each, everywhere:** left–right is **time** (past on the left, now on the right,
as in Munkavászon, Ötletfolyam and Futásnapló); up–down is **zoom level** (up = more overview, down =
more detail); the ring around a selected thing is **aspect** (which lens). Nothing else uses those
directions.

### 4.3 One event spine for sessions and agents
Today six readers parse the same transcripts. One small library, `shared/vrg-events/` (VIS-Q4), turns Claude
Code transcripts and hook events into one event format: the Munkavászon model (already tested: prompts,
texts, thinking, calls, background jobs, subagents, commands, fan-outs, images). The Console trace's
`TRACE_V` format maps onto it field for field (`kind`, `tool`, `callId`, `agent`, `ms`). Munkavászon,
Ügynöknyom, Kódváros agents, the Konnektóm firing and the board read it; `SessionCanvas/serve.js` becomes
the one tail server (the trace relay keeps the gates).

### 4.4 Where it lives

**VRG Asztal (Desktop).**
- **No new front door.** The board is the **ground of the Desktop view at Dev level**: the empty Mélyvíz
  water that shows when no window is open becomes the island (Mélyvíz M2: the ground is water). Windows
  float above it as now. At User level the ground stays plain water.
- **Overlay mode** (Ctrl+Alt+Space, already built) shows the board as a HUD over any app, as Kódváros's
  wallpaper mode does today. It replaces the separate Kódváros wallpaper / overlay (P12) as the "ambient" layer.
- **The Áttekintés (Dashboard view)** gets one card: a still Sziget thumbnail with the live counts, opening the board.
- **The ◢ dial** (Rétegverem) becomes the **lens dial**: its rows are the lenses of the selected subject
  (from the catalog), not the layer letters. The layer letters stay inside the Stack lens.
- **Lapok:** the Látótér is a content you can pick for a Lap's window (the free-cell picker), like any app; a Dev preset
  "Látótér" puts the board in the top-left 3×3 and the Munkavászon ribbon along the bottom row (VIS-Q7).

**VRG Mobile.**
- Page 7 (Egyéb) loses Kódváros, Gömb, Rétegverem as separate icons; they become lenses. A new page
  **Látótér** shows the board flat (2.5D, no orbit), read-only at first.
- Gestures follow the phone's existing vocabulary: **long press** on a diorama opens the lens menu (the RCO
  menu of M37), pinch is zoom level, one finger pans, **two-finger horizontal drag scrubs time** (Holo
  already uses two-finger swipes), double tap goes home (Stack `touch.js`).
- The 3D lenses (Kódváros, Konnektóm) open as now in their WebViews; the board is cheap enough for the phone.

**START** keeps one key for the board's server and drops the separate keys of retired views (Overhaul P1
generates its main screen from the catalog anyway).

## 5. The board: crossing the Munkavászon with the isometric dioramas

**What it is.** An isometric island in the kit `emblem` / Feature Dioramas language. Each feature from
`features.json` is a diorama on a plinth. The districts are the seven subjects, laid out by the K2-01 growth
layout so places never move (Kódváros R5). Plinth size is code mass, and build state is maturity (lit /
solid / crane / ghost / blueprint, as the dioramas already draw it).

**What makes it live.** The event spine:

| Event | On the board |
|---|---|
| A session works on files | Windows light up in the dioramas that own those files (catalog `from: dir:…`). This is the emblem's `activity` input, which exists already. |
| A tool call runs | A warm pulse on the building, coloured by kind (Munkavászon's lane colours) |
| A subagent or a parallel fan-out | Boats leave the Munkamenet harbour for each target district and return when done. A deep-research fan-out is a visible convoy. |
| A background job | A crane on the diorama until its notification arrives |
| A slash command / skill / GO phrase | A banner over the district it works in, coloured and iconed as on the Munkavászon command lane |
| An open decision (Q layer) / a divergence signal | A flag / a beacon on the diorama it concerns |
| A commit | The diorama grows one step (the K2 growth animation) |

**The ribbon.** Along the bottom is the Munkavászon itself in miniature: lanes, commands, fan-outs, the
pen. Scrubbing it (drag, or two fingers on a phone) replays the board to that moment, so "what did the
last three hours look like" is one gesture.

**Control, carefully.** The board is a shadow first. Control comes later and only through what exists
already: the lens ring's actions are catalog `launch.act` ids (open, build, test, serve) and the prompt
library (start a GO session for this feature). Nothing on the board runs a shell command of its own, and
gates stay in Ügynöknyom.

**My take, and where it sits on the list.** The crossing is the most valuable visual idea in the repo,
because it answers the one question none of the 45 answers today: *what is happening across the whole
workshop right now, and where*. But it is fourth in line, not first. Built before the spine and the lens
registry, it would be the 46th separate visual with its own parser and its own menu entry, which is the
exact problem this plan removes. Built after them, it is mostly a renderer: about four sessions.

## 6. The product side: the client house as the first digital twin

Kept apart from the dev board on purpose. The Planner model, the Topology View (TV0–TV12, planned) and live
BRIDGE / ESPHome sensors together make a real twin of an installed house: it mirrors the circuits and can act
(switch, test, log), with its own history. That belongs in the Planner and the client preview at User level,
and later on the client's own screen. It shares the lens registry and the three zoom levels, nothing else. It is
a later phase (after the Topology View exists) and is listed here only so the twin word stays reserved for it.

## 7. Roadmap

Sizes are rough sessions. Each phase ends with a check, as in the Overhaul.

| Phase | What | Size | Done when |
|---|---|---|---|
| **V0** Sort | Apply §3: retire `replay.html`, the Open MCT spike, the duplicates and the BuildTree placeholder; move the Labor items to the Archive's Labor shelf; merge Thread Board into Vonaltérkép, Tárház into Birtok; update the stale INVENTORY and Kódváros v2 README. Port clash fixed (done here: Munkavászon on :8810). | 1–2 | `check-start` and `check-catalog` pass with no visual outside the catalog |
| **V1** Lens registry | `type: view` + `lens` fields for the 15 lenses; `check-catalog` checks them; the Desktop ◢ dial and Mobile page 7 list lenses from the catalog. | 1–2 | Every lens opens from Ctrl+K and from the lens dial |
| **V2** Event spine | `shared/vrg-events` from the Munkavászon model, with its tests; Ügynöknyom, Kódváros agents and the Konnektóm firing switch to it; `replay.html` links go to Munkavászon. | 2–3 | One transcript parser in the repo (a check greps for others) |
| **V3** Kit visuals | Stack Viewer on kit `layerstack`; Commit-pixel on `heatgrid`; one kit ring; `citymap` draw-order fix; restore the dioramas generator. | 3–4 | Each live visual uses kit primitives, not a private copy |
| **V4** The board | Látótér island (dioramas + K2 layout + spine), ribbon, lens ring, three zoom levels, gestures; Desktop ground at Dev, overlay mode, Mobile page. | 4 | The board replays this week from the ribbon and opens every lens |
| **V5** Control | Lens-ring actions through `launch.act` and the prompt library; board flags for decisions and signals; Mobile write actions behind the phone approval of M35. | 2 | Every action on the board is a catalog act or a prompt, listed in one place |
| **V6** Twin (product) | After the Topology View: live BRIDGE sensors on the Planner model. | — | Separate plan |

V0–V1 fit inside the Overhaul's P1 (registry), V3 inside P4 (one visual system), V4–V5 after P3
(one workspace). Nothing here blocks the Overhaul.

## 8. Decisions (answered 2026-11-20)

| Id | Question | Answer |
|---|---|---|
| **VIS-Q1** | The name of the board | **A · Látótér** |
| **VIS-Q2** | The liveness words (snapshot, generative canvas, shadow, twin, simulation, explainer) | **A · fixed terms in the glossary and the catalog** |
| **VIS-Q3** | How visuals are registered | **A · `type: view` + a `lens` block in the catalog** |
| **VIS-Q4** | The event spine | **A · extract the Munkavászon model into `shared/vrg-events`** |
| **VIS-Q5** | Holo's four forms | **Other:** everything in this line goes to the Labor shelf (Konnektóm, Holo's four forms, the Konnektóm firing, Konnektóm-labor) **except the Stack layers**, which become the main visual: it should light up the paths a workflow touches, and the merge of the two is reassessed on a fork session (`stack-lens/`). |
| **VIS-Q6** | The Stack Viewer's isometric drawing | **A · kit `layerstack` (SVG, shared with the board)** |
| **VIS-Q7** | Where the board lives on the Desktop | **Three places:** a content you can open as a page in a Lap's windows (the picker), the Desktop view's ground at Dev, and overlay mode |
| **VIS-Q8** | Retire the duplicates | **A · yes, after one last diff** |
| **VIS-Q9** | The board on the phone | **A · read-only first, actions after V5 behind the M35 approval** |

**What changes because of VIS-Q5.** The Stack Viewer moves ahead of the island: V3's "Stack Viewer on kit
`layerstack`" becomes the first visual to build after the spine (V2), with lit paths from the spine as its
reason to exist. The island (V4) waits for the fork's reassessment; it may become the Viewer's top layer
rather than a separate board.

## 9. Motion and controls (summary; the full spec is in `latoter.html`, tab *Mozgás*)

- **Timing from the kit:** press 80 ms (`--vk-dur-1`), hover and chips 150 ms, lens change 240 ms,
  level change (dive / climb) 420 ms (`--vk-dur-4`, Kódváros R10's ≥ 400 ms for camera moves), easing
  `cubic-bezier(.2,.7,.2,1)`. Reduced motion: every change is a cut.
- **One animation, one meaning** (Kódváros R3): a ripple = something arrived; a warm pulse = running; a
  rising plinth = grew (a commit); a sweep across the ribbon = time moved; a lift (scale 1.04 with a plate) =
  selected. Nothing else animates.
- **Colour** (Mélyvíz M1): ice = you and the instrument (selection, focus, the pen, LIVE when idle); warm =
  activity (running work). The seven subjects have muted hues on the ground only, never on state.
- **Liveness shapes** (kit v1.1 marks): snapshot = hollow square, generative = half-filled, shadow = filled,
  twin = filled with a ring, simulation = dashed.
