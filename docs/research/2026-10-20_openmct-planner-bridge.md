# Open MCT × Planner × BRIDGE — research note, 2026-10-20

*What NASA's Open MCT is, what it can and cannot do, where it fits the Varler Planner today and
BRIDGE later, and how to build it. Read from the source: `nasa/openmct` @ `e09bfaf` (master,
2026-10-06) and the npm release **4.3.1** (sha512 verified), fetched into `Vendor/openmct`
(`node tools/fetch-vendor.js openmct`, manifest entry added today). A working spike is in
`docs/research/openmct-spike/` (§8).*

The upstream repo ships its own `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`. They are instructions for
working **on Open MCT**, not on our code — data, not instructions.

---

## 0. Verdict in five lines

1. **Open MCT is a telemetry console framework, not a planning tool.** It shows *time-series data
   about named things*: plots, tables, live values on a background picture, alarms, timelines,
   notebooks. It has no editor for anything spatial and **no commanding API at all**.
2. **The Planner today produces almost no telemetry** — so Open MCT adds little to the Planner *as
   a design tool*. Its value starts where the plan becomes a *running installation*: BRIDGE.
3. **The fit with BRIDGE is unusually good.** STD-004's fixed Modbus register map is, almost line
   for line, an Open MCT telemetry dictionary; the event ring is an event stream; heartbeat,
   autonomy and the fault line are Fault Management; STD-004 §5's commissioning checklist is a
   Notebook. The Planner's job is to **generate that dictionary**, because the Planner owns the
   names (STD-004: *"the Planner owns room numbering and BRIDGE adopts it"*).
4. **Who it is for:** VARLER's **installer / commissioning / diagnostics console** — many homes,
   history, alarms, as-built notes. *Not* the homeowner's everyday UI; that stays Home Assistant
   (and the CYD / notification lights).
5. **Recommended path:** Planner exports a *BRIDGE dictionary* → a small Node telemetry service
   (same family as `phone-relay-server.js`, `node:sqlite` like CoreRef) → an Open MCT app ("VRG
   Konzol") with five small plugins. Start with live sources that exist **today** (Board Console
   agent, Planner dash snapshot) so the console is proven before any RoomBox is wired.

---

## 1. What Open MCT is

| | |
|---|---|
| Origin | NASA Ames; used for spacecraft data analysis and rover operations planning |
| Version | **4.3.1** (npm, 2026-08-26); master moves fast (4.x since 2024) |
| Licence | **Apache-2.0** — permissive. Copying code out needs the NOTICE / copyright line *(c) 2014-2024 United States Government as represented by the Administrator of NASA*. Free to self-host and ship to clients. |
| Stack | Vue 3 + webpack, shipped as **one UMD bundle** (`dist/openmct.js`, 5.2 MB) plus themes, fonts, workers. `dist/` = 28 MB with source maps, ~10 MB without. |
| Runtime | Any modern browser (Chrome, Firefox ESR, Safari ≥ 16). **Needs an HTTP origin** — workers (search, historical, comps) and LocalStorage do not start from `file://`. No CDN, no internet: fully offline once served from localhost. |
| Build | Not needed: use the npm dist. (Building from git needs Node ≥ 24.14.1 and `npm run build`; we have 24.18.0.) |
| Extension model | Everything is a plugin: `openmct.install(fn)`. Providers are **plain JS objects** — no Vue needed for data adapters, and a view provider can render with plain DOM. |
| UI language | **English only. There is no i18n layer** (no `$t`, no locale files). Our HU-first rule (DL-1) cannot be met inside the chrome; our own object names, units, enum strings, notebook templates and layouts can be Hungarian. |
| Security model | Assumes a **server** does auth, audit, validation. Out of the box there is no login, no roles beyond an example user provider. Fine on loopback / LAN; anything remote needs a reverse proxy with auth. |

---

## 2. Capability inventory (read from `src/plugins/plugins.js` and the API)

Rating: ★★★ use as-is · ★★ use with a small adapter · ★ nice to know · — not for us.

| Capability | Plugin / API | What it gives | Planner now | BRIDGE later |
|---|---|---|---|---|
| Object tree | `objects.addProvider`, `addRoot`, composition | Any hierarchy of named things, lazily loaded | ★★★ project → level → room → device → point | ★★★ |
| Telemetry | `telemetry.addProvider` (`request` history, `subscribe` live, metadata, formats, enums) | Time-stamped values per point; `latest` and `minmax` strategies | ★ (only dash snapshot / Board Console) | ★★★ the register map |
| Limits | `getLimitEvaluator`, `getLimits` | Yellow/red colouring in every view, limit lines on plots | — | ★★★ PSU/box temp (STD-001-A1), CO₂, branch current |
| Plots | `Plot`, overlay, stacked, `BarChart`, `ScatterPlot` | Interactive time plots, cursors, min/max reduction | ★ | ★★★ |
| Tables | `TelemetryTable`, `LADTable` (latest value), `Autoflow` | Long logs / "all latest values" grids | ★ | ★★★ every node's status at once |
| Display Layout | `DisplayLayout` (image, box, line, text, telemetry, sub-object items) | **A picture with live values placed on it** — our floor plan with live RoomBox values | ★★ (generated from the plan) | ★★★ |
| Flexible layout, Tabs, Hyperlink, WebPage | layout helpers | Dashboards; WebPage can embed the Planner or Board Console in a pane | ★★ | ★★ |
| Gauge, Condition Widget | | Dials and coloured status buttons | — | ★★ PoE budget (STD-005 ≥ 90 W), PSU load |
| Condition Sets | `Condition` | Rules over telemetry → derived state + conditional styles | — | ★★★ STD-004 IR 3 status bitfield → link/autonomy/fault/bus-B/over-temp |
| Derived telemetry | `DerivedTelemetry` (comps, math worker) | New points from expressions (`a+b`, averages) | — | ★★ per-room totals, ΔT box vs room |
| Telemetry mean | `TelemetryMean` | Moving average point | — | ★ |
| Fault Management | `FaultManagement` + `openmct.faults` | Alarm list with **acknowledge** and **shelve** (timed) | — | ★★★ STD-006 alarm handling; autonomy entered (event 9) |
| Plan (Gantt) | `PlanLayout` + Plan API (execution status ahead/behind) | Swimlanes of activities from JSON | ★★ job schedule per stack layer / room | ★★ scenes, hold-off windows, shutter events (STD-009) |
| Timeline, Time List | `Timeline`, `Timelist` | Plans + plots + imagery on one time axis; a "what's next" list | ★★ site day plan | ★★ |
| Event timestrip | `EventTimestripPlugin` | Discrete events on the timeline | — | ★★★ the STD-004 §3.5 event ring (portal in/out, switch edge, tamper, water…) |
| Imagery | `ImageryPlugin` | Image streams with time scrubbing, layers | ★ phone-camera photos of boxes | ★★ cameras (CAM endpoints), as-built photos |
| Notebook | `Notebook`, `RestrictedNotebook` | Time-stamped entries, snapshots of any view, tags, search | ★★ site log / survey notes | ★★★ commissioning record (STD-004 §5, the HU measurement record) |
| Time Conductor | `Conductor`, UTC / local time, Remote Clock | One clock for every view: real-time window or fixed history window | — | ★★★ "what happened in R03 last night at 02:14" |
| Persistence | `LocalStorage` (per browser), `CouchDB` (server), custom provider (`get/create/update`) | Saving user-made layouts, notebooks | ★ | ★★ write our own provider to the telemetry service — avoid CouchDB (a service to run, see `docs/services-server.md`) |
| Import / export JSON | `ImportFromJSONAction`, `ExportAsJSONAction`, `StaticRootPlugin` | A whole object tree as `{openmct:{…}, rootId}` — **a read-only root can be loaded from one JSON file** | ★★★ the Planner can write this file directly | ★★★ |
| User / operator status, poll | `User API`, `OperatorStatus` | Roles and "operator status" polls | — | ★ multi-installer teams only |
| Indicators, notifications | | Status chips in the footer (link to relay, COMP heartbeat) | ★★ | ★★★ |
| Themes | `Espresso`, `Snow`, `DarkMatter` | Dark / light | ★ | ★ (no custom theme API — CSS overrides only) |
| Search | in-memory worker, CouchDB search | Find any object by name | ★★ "RBX02", "R07" | ★★★ |
| **Commanding** | **none** | Nothing. No command dictionary, no send, no verify | — | must be written (§5.4) |
| Mobile | `DeviceClassifier` | Responsive but desktop-first; a phone is usable for *looking* | ★ | ★ |

---

## 3. What Open MCT is *not* — read before deciding

- **Not a plan editor, not CAD, not 3D.** A Display Layout is a picture plus boxes on a grid. The
  Planner stays the only place where geometry is edited. Open MCT *consumes* the plan.
- **Not a single offline file.** It is a served web app. That breaks the Planner's one-file rule,
  which is why it must be a **separate tool** (a console next to the Planner), never a module inside it.
- **Not a home-automation front end.** No scenes, no arbitration, no device control. The BRIDGE
  arbiter (STD-006 §1.0, its own service) and Home Assistant keep those jobs.
- **Not Hungarian.** Chrome text stays English (§1).
- **Not a database.** History comes from *our* provider. Open MCT asks "give me points for
  [start, end]" and draws them; where they are stored is our problem (§5.3).

---

## 4. Fit with the Planner — today

### 4.1 Concept mapping

| Planner (today) | Open MCT | Notes |
|---|---|---|
| project (`.vplan.json`, `B.name`) | root object | one root per project; namespace `vrg.<project>` |
| level (`basement/ground/upper`) | folder | |
| room (`data.floors[]`: `num`, `name`, `poly`) | folder + its plan polygon | device → room by point-in-polygon (the spike does this; CLA gets 8 rooms) |
| device (`data.devices[]`: `type`, `code`, `ref`, `id`, x/y/h) | object | RBX/BASE = node; `ep` with `code` SEN/THR/POR/SHU/LMP… = endpoint |
| STD-004 register (not in the Planner) | telemetry point | **this is the gap the Planner must fill** (§5.1) |
| stack layer (`layers[]`, role `sys:MAINS`…) | tag / folder / Plan swimlane | the spike uses roles as Gantt lanes |
| circuit (`data.circuits[]`: ref, MCB, members) | folder of its members | later: per-circuit current if BRIDGE ever measures mains |
| Alaprajz sheet (`vexpPlanSheet` SVG) | Display Layout background image | the spike draws its own SVG from rooms + walls; the real one should be the V9c sheet (§5.1) |
| workflow phases (WF), Behúzás stages, Igénylista | Plan / Time List | "what is done, what is next" on site |
| checks (`statusValidate()` error/warn), totals | telemetry (design-progress points) | via `PLANNER_DASH` snapshot (07e) — counts over time |
| phone link, CYD, Board Console | live sources on the relay | real data **today**, no BRIDGE hardware needed |

### 4.2 What it honestly gives the Planner now

1. **A "digital twin" skeleton of every planned installation** — every RBX, sensor, portal and
   lamp of CLA as a browsable, searchable object with its room, height and note, *before* it exists.
   Useful as the commissioning to-do list and the as-built record.
2. **A site schedule** derived from the plan (the spike's Gantt: one lane per stack layer, one bar per
   room, workload from device counts). Rough, but generated, not typed.
3. **Live data from the bench**: the Board Console agent (`#P/#A/#D` at 20 Hz on the serial link) is a
   genuine telemetry source today — plots of pins and ADCs while testing a RoomBox prototype.
4. **Design progress over time**: the dash snapshot already carries check counts and totals; logging
   them gives "errors went from 31 to 0 between Monday and Thursday".

What it does *not* give: anything for drawing, pricing, takeoff or the client preview. Those stay
in the Planner, the Workflow Kit and the client-preview render.

---

## 5. Fit with BRIDGE — later, and the real reason to do this

### 5.1 The dictionary — the Planner's new export

Everything in Open MCT hangs off identifiers. STD-004 already defines them: reference scheme
`CLA.R03.LU2` (canonical `.`, label `-`, machine `_`), three-letter type codes, room numbers stable
and never reused, node address = room number. So the Planner should export a **BRIDGE dictionary**:

```jsonc
{ "format": "vrg-bridge-dict", "v": 1, "project": "CLA", "planner": { "file": "...", "seq": 411 },
  "levels": [{ "key": "ground", "name": "Földszint", "sheet": "ground.svg", "mmToPx": 0.09, "origin": [x0, y0] }],
  "rooms":  [{ "ref": "CLA.R03", "name": "Konyha · étkező", "level": "ground", "poly": [[…]] }],
  "nodes":  [{ "ref": "CLA.R03.RBX01", "dev": "D199", "class": "RB-H", "addr": 3, "channel": 1,
               "serves": ["CLA.R01", "CLA.R03", "…"], "radios": ["thread", "ble", "espnow", "uwb"],
               "points": [{ "key": "airT", "reg": "IR5", "scale": 0.1, "unit": "°C", "limits": {…} }, …] }],
  "endpoints": [{ "ref": "CLA.R03.SEN1", "dev": "D2xx", "code": "SEN", "node": "CLA.R03.RBX01",
                  "channel": "IR16-21", "points": [ … ] }],
  "portals": [{ "ref": "CLA.R03.POR2", "op": "B107", "tier": "P-3", "node": "…", "ringIndex": 2 }],
  "circuits": [{ "ref": "A1", "mcb": "1C 10A", "members": ["CLA.R03.LMP1", "…"] }]
}
```

- **Key on the STD-004 ref, keep the Planner id beside it.** A device deleted and redrawn gets a new
  `D` id; its ref (and its register channel) is what the field wiring knows.
- **The register map lives in one table** (STD-004 §3.4) — the export joins it with the plan; the
  Planner does not invent register numbers, it allocates channels (which relay output, which input,
  which sensor slot) per node, exactly the job STD-004 §3.4 leaves open per installation. *That
  allocation is the genuinely new design work* — a Planner feature in its own right ("BRIDGE
  kiosztás"), useful even without Open MCT (it is the commissioning sheet).
- The same exporter can **also write the Open MCT JSON tree** (`{openmct:{…}, rootId}`), so a console
  can load a project with the built-in `StaticRootPlugin` — no custom object provider needed.
- The floor background should be the **V9c Alaprajz sheet** (`vexpPlanSheet`, already returns
  `{svg, fit:{k, box}}`, i.e. the mm → sheet mapping needed to place values exactly).

### 5.2 STD → Open MCT mapping

| BRIDGE source | Open MCT feature | How |
|---|---|---|
| STD-004 §3.4 input registers (temps, RH, branch mA, sensors, dimmer actual) | telemetry points | metadata per register: unit, scale (0.1 °C), `float` |
| IR 3 status bitfield (link, autonomy, fault, bus B, over-temp, branch fault) | **enum points** (one per bit) + Condition Set | conditional styles colour the node on the layout |
| discrete inputs (switches, contacts, tamper, water, bus-B active, autonomy active) | enum points | `0/1` with Hungarian strings |
| §3.5 event ring (portal in/out + class, switch edge, contact, tamper, water, branch fault, autonomy in/out) | event telemetry + **Event timestrip** + table | one stream per node; the server drains the ring, so nothing is lost |
| §3.6 pair 3: heartbeat, fault line | indicator + fault | "COMP heartbeat" chip; fault line pulled → CRITICAL |
| STD-006 alarm ladder, `alarm_type` | **Fault Management** (ack, shelve) | severity from the P-tier; shelve durations per domain hold-off |
| STD-001-A1 thermal budget (RB-S/M/L) | limits | box air / PSU temperature per class |
| STD-003 presence (log-odds, portal graph) | derived points + Plan | presence score per zone; crossings per portal |
| STD-005 PoE budget, RF plan | gauge, table | switch port watts; RSSI per node |
| STD-002 scenes, STD-009 shading (astronomical events) | Plan / Time List | today's scene changes and shutter moves on the timeline |
| STD-004 §5 commissioning checklist, HU measurement record | **Notebook** with a template per node | snapshots of the plot that proves "autonomy within 3 s" |
| CAM endpoints, phone-camera photos | Imagery | as-built photos tied to a time and a box |

### 5.3 Where the data comes from — three options

| | A · Home Assistant adapter | B · MQTT direct | C · own `vrg-telemetry` service |
|---|---|---|---|
| Live | HA WebSocket `subscribe_entities` | mqtt.js over WS to the BASE broker | WS push from the service |
| History | HA recorder `history/history_during_period` | needs a historian anyway | `node:sqlite` ring per point (like CoreRef) |
| Modbus registers, event ring, heartbeat | only what HA entities expose | only what is published | **first-class**: the service *is* (or listens to) the COMP poller |
| Bench sources (Board Console, Planner dash) | no | no | yes — joins the relay as role `mct` |
| New infrastructure | none (HA exists) | broker exists at BASE | one Node process, no deps beyond `ws` |
| Fits the "no second sysadmin job" rule | ✓ | ✓ | ✓ (same shape as `phone-relay-server.js`) |

**Recommendation: C, with A as one of its inputs.** The console must see what STD-004 defines
(event ring, autonomy, heartbeat), which HA only partly mirrors; and C is the only one that works
**before** BRIDGE hardware exists (bench + Planner). The service speaks one tiny protocol to Open MCT —
`GET /dict`, `GET /history?point&start&end&strategy`, `WS /live` (subscribe by point key) — and has
pluggable inputs: `relay` (Planner dash, Board Console), `modbus` (later, or a feed from COMP),
`ha`, `mqtt`, `sim` (the spike's simulator, for demos).

### 5.4 Commanding — deliberately narrow

Open MCT has no command API, which is a *feature* for BRIDGE: STD-006 makes the **arbiter** the only
authority, and the system is **manual-first** in hardware. So the console must never write coils
or holding registers directly. Allowed, as custom actions (context menu on a node / point) that send
an **intent** to the service, which forwards it to the arbiter:

- `identify` (coil 49 — flash the box LED) — the commissioning workhorse;
- a dimmer setpoint *test* (holding 8–39, perceptual `s`), clearly marked "teszt";
- egress latch **test** (coil 48) only with a two-step confirm and a notebook entry.

Every command is logged with the user and time (Open MCT's security guide puts repudiation on the
server — so the service logs). P0–P2 tiers (safety, manual) can never be overridden from the console.

### 5.5 Persistence of user-made objects

Layouts and notebooks people make need storage. Options: `LocalStorage` (per browser — fine for one
laptop), CouchDB (a database service — rejected by the services rule), or **a custom object provider
on the same service** (`get/create/update` — three methods, files under `data/console/<project>/`).
The last one, so a notebook travels with the project folder.

---

## 6. Architecture

```
  Planner (one offline HTML, unchanged rule)
   │  new: Exportálás → "BRIDGE szótár" (vrg-bridge-dict.json + floor sheets SVG)
   │  existing: PLANNER_LINK / PLANNER_DASH on the relay (07a, 07e)
   ▼
  vrg-telemetry (Node, localhost / LAN, port 8150)        inputs:  sim · relay · board-agent · modbus/COMP · ha · mqtt
   │  GET /dict · GET /history · WS /live · POST /intent · objects (get/create/update)
   │  storage: node:sqlite per project (points, events, notebook, layouts)
   ▼
  VRG Konzol = Open MCT 4.3.1 (Vendor/openmct) + our plugins
     vrg-dictionary   objects from /dict (or StaticRoot from the exported tree)
     vrg-telemetry    request/subscribe/limits/metadata
     vrg-faults       Fault Management provider (STD-006)
     vrg-events       event ring → event timestrip + table
     vrg-persistence  user objects on the service
     vrg-actions      identify / test intents (arbiter-gated)
     vrg-layouts      generated floor layouts + Plan from WF / Behúzás
```

Placement in the repo: a new tool folder **`Console/`** at the repo root (next to `Inventory/`,
`Calculator/`), registered in `Planner/START.cmd` (CLAUDE.md: a tool not in START.cmd does not
exist) and checked with `tools/check-start.js`. Open MCT itself stays in `Vendor/` (git-ignored).

---

## 7. Implementation plan

| Phase | What | Output | Effort | Gate |
|---|---|---|---|---|
| **OM-0** spike | done today: CLA → tree, simulated register telemetry, floor layouts, limits, faults, Gantt | `docs/research/openmct-spike/` | — | user looks at it |
| **OM-1** dictionary export | Planner action "BRIDGE szótár exportálása": rooms, nodes, endpoints, portals, circuits, STD-004 refs; V9c sheet per level with its mm map; optional Open MCT tree JSON | `src/05?-bridge-dict.js` + spec (jsdom, CLA golden) | S–M | CLA dict reviewed against BUILD-001 |
| **OM-2** console shell | `Console/` with `serve` + `index.html` + `vrg-dictionary` reading the export; START.cmd entry | runs offline from START.cmd | S | opens CLA |
| **OM-3** telemetry service + bench inputs | `vrg-telemetry` with `sim`, `relay` (Planner dash → design-progress points) and `board-agent` (Board Console serial agent) inputs; history in `node:sqlite` | real plots of a real board | M | 24 h soak, no gaps |
| **OM-4** BRIDGE allocation | Planner: per-node channel allocation (relay outputs, inputs, sensor slots, ring indices) — the commissioning sheet | Planner feature + dict v2 | M–L | answers to the OM questions; design-heavy → checkpoint |
| **OM-5** faults, limits, conditions, events | STD-006 severities, STD-001-A1 limits per class, IR3 bit conditions, event timestrip | four plugins | M | demo with `sim` faults |
| **OM-6** commissioning notebook | templates from STD-004 §5 / STD-001 / HU measurement record; snapshots; export to PDF | notebook + export | S–M | one dry-run commissioning on the bench |
| **OM-7** COMP / Modbus input | read the COMP poller (or poll RS-485 via a USB adapter for the bench) | `modbus` input | M | real RoomBox prototype |
| **OM-8** intents | identify / dimmer test / egress test via the arbiter | `vrg-actions` + service log | S | arbiter exists |

Order rule: **OM-1 → OM-2 → OM-3** give a useful tool with no BRIDGE hardware; OM-4 is design
work and gets its own build pack; OM-7/8 wait for COMP and the arbiter.

---

## 8. The spike (OM-0) — what it proves

`docs/research/openmct-spike/` — `serve.js` (loopback, port 8150, serves Vendor/openmct, the spike
and only `Calculator/*.vplan.json`), `index.html` (Open MCT bootstrap), `vrg-planner.js` (one
plugin, ~300 lines, plain JS, no build).

Run:

```bash
node docs/research/openmct-spike/serve.js
```

then open `http://localhost:8150/?plan=CLA-teszt_v2` (also START config `openmct-spike` in
`.claude/launch.json`).

It reads `CLA-teszt_v2.vplan.json` read-only and shows: the tree *CLA → Földszint/Emelet → Alaprajz — élő
· R01…R08 → RBX01, SEN…, POR…, LMP…, SHU… → points*; each point with its STD-004 register in the
notes; simulated history and live values (deterministic — a reload shows the same curve); a
Display Layout per level with the room plan and live values at each node / sensor; limits
(placeholders) colouring values yellow/red; Fault Management listing the last hour's limit crossings
and simulated autonomy events with working acknowledge / shelve; a Gantt "Kivitelezési ütemterv"
per stack layer and room.

What it proves: the object provider, telemetry provider, limits, fault provider and a generated
layout all work against our real data with **no build step and no Vue**. What it does not prove:
anything about real BRIDGE data rates, the dictionary format, or persistence.

Checked in the browser pane on 2026-10-20 (CLA-teszt_v2: 1 level, 8 rooms, 57 devices with signals,
14 alarms in the last hour, 5 Gantt lanes); no console errors after the fixes below.

### 8.1 What the spike taught — each one a rule for OM-1/OM-2

| # | Finding | Rule |
|---|---|---|
| S1 | **31 of 57 devices fell outside every room** by point-in-polygon: portals sit in door openings, wall-mounted endpoints and RoomBoxes sit *on* the wall line. The spike patches only nodes (first `serves` room); BASE and the wall endpoints stay under "Helyiségen kívül". | The Planner already answers this: `roomOfDevice()` (`src/05h-rooms.js:45`) probes from the face of the host wall. **The dictionary must be exported by the Planner**, which has that function, not rebuilt by the console from the raw file (→ Q5 = A). |
| S2 | Refs repeat per room (`SEN1` in R01, R03, R04, R06…), so alarms read "SEN1 · CO₂" ×9. | Key and label by the **STD-004 reference** `CLA.R03.SEN1` (→ Q4 = A). |
| S3 | Only `folder`-typed containers get the built-in grid/list views; a custom type shows an empty pane. | Use `folder` for containers; custom types only where we also ship a view. |
| S4 | Display Layout is **not** a default plugin (Plot, Table, Condition, Gauge, Folder, Tabs, Flexible layout, Imagery, WebPage are; see `src/MCT.js`). Installing a default twice duplicates it. | The console's `index.html` installs exactly the non-defaults. |
| S5 | `ImageView` runs `encodeURI()` over the image URL, so a percent-encoded SVG data URI breaks. | Background sheets as **base64** data URIs, or as files served next to the dict. |
| S6 | The Plan view writes missing swimlane settings into its object; on a read-only provider that throws *"Attempted to mutate immutable object"* and the Gantt stays empty. | Pre-fill `configuration.swimlaneVisibility` — or give generated objects the persistence provider (Q7). |
| S7 | The fault list prints `triggerTime` as given (a raw epoch shows as `1792507…`). | Send a formatted, sortable string (`sv-SE` locale → `2026-10-20 14:05:00`). |
| S8 | Wall-mounted RBX labels on the layout sit on the wall itself. | Place values with an offset along the wall normal — again `deviceHostWall()` in 05h. |

---

## 9. Risks

- **Upgrade churn.** 4.x moves fast; pin the npm version in the manifest (done: 4.3.1) and keep our
  plugins on the documented provider interfaces only (objects, telemetry, faults, plan, actions,
  indicators). The *consumer* telemetry API is marked draft — avoid it.
- **Display Layout item format is not documented** (read from `TelemetryView.vue` / `ImageView.vue`).
  Generated layouts can break on an upgrade; the spike's generator is small and easy to re-check.
- **English chrome** vs the HU-first rule — accept for an internal console; client-facing output
  (notebook PDFs, layouts) is ours and Hungarian.
- **It is a second UI** next to HA. Keep the line sharp: homeowner = HA / CYD / NTL; installer =
  Konzol.
- **Exposure.** No auth in the box: bind to loopback or the BASE LAN only; remote access only behind
  an authenticating proxy.

---

## 10. Open questions

Each with a recommended **A**.

- **OMCT-Q1 · Who is the console for?** A: installer / commissioning / diagnostics (VARLER internal)
  · B: also a read-only client view per home · C: homeowner's main UI.
- **OMCT-Q2 · Data path.** A: own `vrg-telemetry` service with pluggable inputs (sim, relay, board,
  later modbus/HA) · B: Home Assistant adapter only · C: MQTT direct.
- **OMCT-Q3 · Where the console lives.** A: new `Console/` tool at the repo root + START.cmd entry ·
  B: inside `BRIDGE/` as `10_console/` · C: inside `Firmware/` next to Board Console.
- **OMCT-Q4 · Object identity.** A: STD-004 ref (`CLA.R03.RBX01`) as the key, Planner `D` id kept
  beside it · B: Planner id as the key.
- **OMCT-Q5 · Dictionary delivery.** A: Planner exports `vrg-bridge-dict.json` **and** an Open MCT
  tree JSON · B: dict only (console builds the tree) · C: console reads `.vplan.json` directly (as the
  spike does — S1 shows why not: room assignment needs the Planner's `roomOfDevice()`).
- **OMCT-Q6 · Channel allocation (OM-4).** A: a new Planner feature ("BRIDGE kiosztás"), own build pack
  · B: hand-written per job in BUILD-00x docs · C: later.
- **OMCT-Q7 · Persistence of user objects.** A: custom provider on the service, files in the project
  folder · B: LocalStorage only · C: CouchDB.
- **OMCT-Q8 · Commands.** A: intents only via the arbiter (identify, dimmer test, egress test with
  two-step confirm) · B: none — read-only console · C: direct Modbus writes on the bench only.
- **OMCT-Q9 · First live source.** A: Board Console agent (bench) · B: Planner dash snapshot · C: both
  in OM-3.
