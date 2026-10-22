# Business Topology — VRG as a developing business

*Prework for VRG Kapu, written 2026-10-21 from the project notes and the repo as it is today.*
*v1 = what exists now, mapped onto classic business departments. v2 = the extended vision: the
user's idea list (2026-10-21) turned into programs, plus my own suggestions. The machine-readable
version is `hub-seed.json`; this file is the human one.*

Legend: ● live (in daily use) · ◐ in development · ○ idea / empty slot · ◇ v2 vision

---

## 1. The departments (branches from the origin)

Classic departments, adapted to an electrical planning + smart-home business. Twelve branches plus
the **Általános** (General) branch for things every department uses.

| ID | Department (HU) | English | What it covers |
|---|---|---|---|
| ALT | **Általános** | General | The repo, the shared OneDrive, launchers, installers, the kit, glossary, work logs |
| VEZ | **Vezetés és stratégia** | Management & strategy | Direction, roadmaps, thinking tools, coordination of everything |
| ERT | **Értékesítés és ügyfél** | Sales & customers | What the client sees: previews, brochures, client intake |
| TERV | **Tervezés és mérnökség** | Design & engineering | Electrical plans, product choice, board layouts |
| KALK | **Kalkuláció és pénzügy** | Estimating & finance | Material and labour prices, quotes, cost plans, payments |
| BESZ | **Beszerzés és raktár** | Procurement & stock | Item database, supplier lists, ordering, stock, price watch |
| KIV | **Kivitelezés és szerviz** | Field work & service | Scheduling, site work, handover, measurements, after-sales |
| TFEJ | **Termékfejlesztés (BRIDGE)** | Product R&D | The BRIDGE smart-home system, hardware, firmware, consoles |
| JOG | **Jog és megfelelőség** | Legal & compliance | Standards (MSZ HD), outgoing documents, GDPR, licences |
| ARC | **Arculat és vizuális tartalom** | Brand & visuals | Design system, visual library, viewers, client-facing look |
| TUD | **Tudásbázis** | Knowledge | Offline references, catalogues, research notes, skill library |
| IT | **IT és infrastruktúra** | IT & infrastructure | Code tooling, vendored libraries, backups, security, the hub itself |
| IRO | **Iroda és csapat** | Office & people | Notes, reminders, mail, contacts, staff portal, progress tracking |

## 2. v1 — what exists today, and where it sits

### Általános (ALT)
- ● **GitHub repo `vrg-toolset`** — all code and text docs, private. *Where everything code-like lives.*
- ○ **Megosztott OneDrive** — large files: plans, renders, job folders, installers. *Link to be added.*
- ● **Indítópult (START.cmd · VRG-DE.cmd)** — the command-window menus that open every tool.
- ● **Prompt könyvtár** (`tools/prompts/`) — eight ready starting prompts for Claude Code sessions.
- ● **cwebuser kit** — portable Claude Code workspace for any Windows PC (Mode A from stick, Mode B install).
- ○ **Telepítők** — the installer collection (`_installers`: Git, KiCad, VLC, arduino-cli…), to move to OneDrive.

### Vezetés és stratégia (VEZ)
- ◐ **VRG Kapu** (this hub) — the central map and front door. *Origin of the board.*
- ● **VRG MindMap** — mind-map / knowledge map with layers, frames, markdown items, helix view.
- ● **Kutatási jegyzetek** (`docs/research/`) — CAD sources + MCP, REA, Open MCT studies.

### Értékesítés és ügyfél (ERT)
- ◐ **Client Preview** (`Planner/projects/client-preview`) — WebGL 3D preview of a plan for the client, Westworld-like look.
- ◐ **BRIDGE brosúra / Title Card** (`docs/client-look/`) — the client-facing visual direction.
- ○ (empty slot for the v2 *Lobby* and *Scout*, see §3)

### Tervezés és mérnökség (TERV)
- ● **Varler Planner** — the main design tool: floor plans, devices, circuits, wiring engine, BRIDGE stack, views, Födém, Igénylista, Házimozi.
- ● **Valena választó** (`Toolbox/valena-life-szerelvenytervezo.html`) — Legrand Valena Life product family picker.
- ○ **Elosztó DIN-sín tervező** — drag-and-drop distribution board builder fed by the Inventory (idea).

### Kalkuláció és pénzügy (KALK)
- ● **Panel anyagár kalkulátor** — panel material cost calculator (varlerÁron).
- ● **Általános villanyszerelői kalkulátor** — general electrician's price calculator.
- ● **LED árkalkulátor** — LED strip lighting cost calculator.
- ● **Varler Workflow Kit** (outside git) — the quote workflow: question funnel → Költségvetési Tervezet / Árajánlat PDFs.
- ● **Árlisták + komplexitás faktorok** (`Calculator/*.md`) — the price lists and factor library the calculators read.

### Beszerzés és raktár (BESZ)
- ● **VRG Inventory** — the core item database (221 items, vendor-neutral, Daniella first).
- ● **VRG BuildTree** (`Modder/`) — Modulshop part list + the toolset colour palette owner.
- ○ (empty slots for v2 *Picker* and *Radar*)

### Kivitelezés és szerviz (KIV)
- ● **Ügyféljob mappák** (outside git: `P33_ajanlat`, `NV4_ajanlat`, `P33_koltsegvetesi_tervezet`) — delivered job packages. *Client data — see HUB-Q10.*
- ○ (empty slots for v2 *Shift*, *Proof*, *Care*)

### Termékfejlesztés — BRIDGE (TFEJ)
- ◐ **BRIDGE okosotthon rendszer** (`BRIDGE/`) — architecture, standards STD-001…009, P33 build, catalogue.
- ◐ **BRIDGE Media Wall** (`BRIDGE/10_media-wall`) — the 3-tier media wall concept.
- ◐ **Okosotthon katalógus** (`BRIDGE/09_catalogue`) — smart-home device database + page.
- ◐ **Planner CYD** (`Firmware/planner-cyd`) — desk dashboard / remote / macropad for the Planner.
- ◐ **VRG Knob Pad** (`Firmware/knobpad`) — 3-encoder USB HID controller, web config.
- ◐ **Board Console** (`Firmware/board-console`) — control page for the universal ESP32-S3 dev board.
- ○ **Konzol (Open MCT)** — telemetry console for BRIDGE installs; spike only (`docs/research/openmct-spike`).
- ◐ **ESP lab + BRIDGEcomp** (outside git) — hardware experiments and the original BRIDGE sources.

### Jog és megfelelőség (JOG)
- ● **Költségvetési Tervezet szabályok** — wording rules for outgoing cost plans (never "ajánlat", deposit clause, clean prices).
- ● **Licenc és forrás nyilvántartás** (`vendor-manifest.json`) — every third-party source pinned, licence travels with code.
- ○ (empty slots for v2 *Clause* and *Shield*'s GDPR part)

### Arculat és vizuális tartalom (ARC)
- ● **VRG Visual Base** (outside git) — 252 collected visuals, board SVGs, topology starter.
- ◐ **VRG Title Card** design system — the client look (v3).
- ○ (empty slots for v2 *Studio* and *Lens*)

### Tudásbázis (TUD)
- ◐ **CoreRef** — offline ESPHome / Home Assistant reference database (pinned releases).
- ● **VRG Vendor** (`vrg-vendor.html`) — catalogue of the vendored third-party components.
- ○ (empty slots for v2 *Atlas* and *Forge*)

### IT és infrastruktúra (IT)
- ● **Toolbox** (`toolbox.html`) — small in-development tools and code snippets.
- ● **Vendor fetch + check tools** (`tools/`) — fetch-vendor, check-start.
- ● **Mentések** — the backup mirror remote + `_git-backups`.
- ○ (empty slot for v2 *Shield*)

### Iroda és csapat (IRO)
- ○ (empty slots for v2 *Desk* and *Crew*)

## 3. v2 — the extended vision

Each of the user's ideas, turned into a program with a product name in the toolset's style
(Planner, Calculator, Modder…). The character in the user's list is only the source; the name is a
function. `◇` = new slot on the board in *Bővített jövőkép* view. **★ = my addition.**

### VEZ — Vezetés és stratégia
**◇ Dispatch — agent coordinator** *(from: central dashboard, agentic coordination, overall coordinator)*
- routes a task to the right sub-system and its brief ("this is a Planner job → GO file X")
- one task board across programs: who/which session works on what, claims, blockers
- guides a beginner user step by step ("what do I click next")
- keeps the hub's topology and the agent docs current after each session (end-of-session hook)
- daily summary: what changed, what is waiting for a decision

### ERT — Értékesítés és ügyfél
**◇ Lobby — client register, GDPR-safe** *(from: Reception)*
- client cards: contact, address, jobs, documents — personal data in one place only
- consent and purpose record per client; retention dates; export/delete on request
- the other programs refer to a client by a code (e.g. `P33`), never by name
- intake form for a new enquiry → creates the job folder + Esetlap for the Workflow Kit

**◇ Scout — site survey ★**
- phone-friendly capture on site: photos, measurements, voice notes, room list
- produces the Workflow Kit's L0 / L1 inputs and a Planner starting file
- check-list per job type (renovation, new build, board swap)

### TERV — Tervezés és mérnökség
**● Planner** stays the architect's tool *(from: "the architect that uses the Planner")*; v2 adds the
DIN-rail board builder slot and takes drawings from *Forge*.

### KALK — Kalkuláció és pénzügy
**● Calculator + Workflow Kit** already are the accountant's tools *(from: Számvitel)*.

**◇ Insight — data and calibration** *(from: Elemző)*
- archive of every quote, cost plan and final invoice, searchable
- takes in new data (supplier prices, actual hours) and compares estimate vs. reality
- proposes new factor values for the calculators (komplexitás faktorok), with the evidence
- dashboards: margin per job type, hours per m², material share

**◇ Till — invoicing and cash flow ★**
- deposits (anyagelőleg), part invoices, payment status per job
- reminders for overdue payments
- export to the invoicing service the business uses (Számlázz.hu / Billingo API, to decide)

### BESZ — Beszerzés és raktár
**◇ Picker — order assembly** *(from: Raktáros)*
- turns the Planner's Igénylista + cable list into a picking list per job
- splits by supplier, makes order drafts, tracks what arrived / is missing
- reserves stock from the Inventory for a job; returns leftovers

**◇ Radar — price and stock watch** *(from: Watchdog)*
- watch list of items; manual or automatic checks of supplier price and availability
- target price "hunt": alert when below X or back in stock
- price history feeding Insight and the Inventory
- also watches the business itself: currency, metal price index for cable

### KIV — Kivitelezés és szerviz
**◇ Shift — job scheduling ★**
- calendar of jobs, phases (alapszerelés, szerelvényezés, átadás) from the Planner workflow
- who is where, material delivery dates from Picker
- weather/lead-time warnings

**◇ Proof — handover and measurements ★**
- measurement protocols (érintésvédelem, szigetelési ellenállás, RCD tests — MSZ HD 60364-6)
- as-built drawings from the Planner, photos, warranty pack for the client
- the BRIDGE install record (devices, firmware versions, passwords handed over separately)

**◇ Care — service and after-sales ★**
- service tickets, warranty, recurring checks (periodic inspection reminders)
- BRIDGE install health from the Open MCT console
- turns repeat visits into new quotes

### TFEJ — Termékfejlesztés
**◇ Lab — self-improvement and research** *(from: Fejlesztő)*
- reads the logs, decisions and Insight data and proposes what to build or research next
- keeps the research list (docs/research) ranked and dated
- runs the "lessons learned" loop: hardships → new rules for the agent docs

### JOG — Jog és megfelelőség
**◇ Clause — outgoing documents and standards** *(from: Jogász)*
- templates for every outgoing document: Tervezet, Árajánlat, szerződés, átadási nyilatkozat
- content blocks with fixed legal wording (protected text), versioned
- MSZ HD reference notes: which clause applies to which situation (no copyrighted text — summaries + clause numbers)
- checks a document before it leaves (missing clause, wrong wording like "ajánlat")

**◇ Shield — security and access** *(from: Guard)*
- the signed allowed list, who has access to which platform
- secret scan before every push; backup check; key/token expiry reminders
- GDPR register (with Lobby): where personal data lives
- audit log of access changes

### ARC — Arculat és vizuális tartalom
**◇ Studio — visual content management** *(from: Designer)*
- one place for every visual asset: brand marks, diagrams, renders, client sheets
- the design system (Title Card, VRG palette) with ready components
- produces client-facing sheets in the house look

**◇ Lens — universal viewer** *(from: Visualizer)*
- opens every output type we make: SVG, PNG, PDF, `.vplan.json`, Mermaid, markdown, 3D (glTF), DXF
- one consistent viewer UI, side-by-side compare, annotations
- the "uniform program base" other tools embed to show their output

### TUD — Tudásbázis
**◇ Atlas — offline catalogue** *(from: Compendium)*
- every product, standard note, reference and internal doc in one offline searchable catalogue
- import / export documents; links back to Inventory, CoreRef, BRIDGE catalogue
- works with no internet on site

**◇ Forge — skill library for agents** *(from: skill bases)*
- reusable generators so agents do not redraw from scratch (fewer tokens, same look every time):
  - 3D spatial layout helper (rooms, devices, clearances)
  - CAD-compatible export (DXF) of plans
  - 2D topology / wiring diagram module
  - exact unrolled terminal-point drawings (kötéspont kiterített rajz)
- each skill = a small tested script + a Claude Code skill file that calls it
- versioned, with golden outputs to compare against

### IRO — Iroda és csapat
**◇ Desk — office assistant** *(from: Titkár)*
- **notepad app** (quick notes, linked to jobs and clients by code)
- reminders and to-dos with dates
- mail drafts (never sent without the user)
- contact list (business contacts; client personal data stays in Lobby)

**◇ Crew — staff portal and progress tracking** *(from: Dolgozói)*
- every company-side program in one staff menu, by role
- the progress logger: Munkanapló entries → a visual timeline per person / program
- who learned what (onboarding checklist for a new colleague)

## 4. How v1 and v2 connect

```
Lobby/Scout ─► Workflow Kit / Calculator ─► Clause (documents) ─► Till (money)
      │                │                                   ▲
      ▼                ▼                                   │
   Planner ─────► Picker ─► Radar ─► Inventory          Insight ◄── every finished job
      │                                                    │
      ▼                                                    ▼
    Shift ─► Proof ─► Care ─► (Open MCT console)          Lab ─► new rules / research
                                            Dispatch watches all of it; Shield guards it;
                                            Forge + Lens + Atlas serve every program.
```

## 5. Suggested order (when v2 starts — not part of the hub build)

1. **Desk** notepad (small, daily value, the user asked for it with "!") · 2. **Lobby** (GDPR — needed
before client data spreads to a second person) · 3. **Picker** (closes the Planner → order gap) ·
4. **Forge** (cuts token cost for everything after) · 5. **Proof** · then the rest.
