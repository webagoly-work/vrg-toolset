# KESTREL — system overview (version A)

*An anonymous description of a real software family, written for designers and AI design sessions that will never see its
code, its database or its owner. Personal data has been removed: no people, clients, places, accounts or company names
appear. The trade is kept: Kestrel is software for a small **electrical installation business**. "Kestrel" is a codename;
every product name below is a neutral stand-in.*

**How to read this file**

- `‹Vázlat›`: text in single angle quotes is the **on-screen label in the primary UI language (Hungarian)**, kept so you can
  size and set real words. The English before it is the meaning.
- Status words: **live** (built and checked on real hardware), **beta** (built, waiting for the owner's hands-on check),
  **in progress** (being built now), **planned** (described, not built).
- Symbols such as ◫ ✎ ☰ ? ◉ ⌖ ⚑ are the real glyphs of the UI. The owner wants **symbols and colour codes instead of text
  buttons**, so the glyph *is* the button.
- Nothing here is a spec you must copy. It describes what exists, so that a new visual and interaction design can carry
  every feature without losing one.

---

## 1. What Kestrel is

Kestrel is the in-house software of an owner-operated electrical contracting business: one person who surveys sites,
designs and prices installation jobs, does the work with a small crew, and also writes the software, with AI coding
agents as co-workers. Over time the tools grew into one family:

- **on the PC:** a portable desktop workbench that hosts every tool, a text-mode launcher, a floor-plan and installation
  **Planner**, calculators, a material **Stock** database, an **estimate workflow** that turns a job into a priced
  document, a drawing library, an offline map, a weather service for field work, and a set of developer tools (a
  knowledge graph of all work, a 3D city of the code, consistency checks, a live view of AI sessions);
- **on the phone:** a companion app that controls and links to the PC, follows the work from anywhere, carries the
  field **Survey instrument** (sketch, notes, scope, questionnaire, camera, site) and a crew pager that works without
  internet;
- **on small devices:** a USB touch display beside the Planner, a development-board console, a knob pad;
- **in the cloud:** one private git repository that is the source of truth, the update channel for the phone, and the
  carrier for notes, published pages and sealed job packs.

**Who uses it**

| Person | Where | What they do |
|---|---|---|
| The owner | everywhere | everything: survey, plan, price, build, maintain the software |
| A colleague | PC (later) | opens the shared tools and folders through a gate page; guest mode planned |
| Crew members | their phones | crew pager, survey phone in two-phone use |
| Clients | paper / PDF | receive the budget draft, the survey report, the plan sheets; sign on the phone |
| AI agents | the repository | build features, write job-type variants of the Survey, answer from the knowledge graph |

**Where it runs**

- A Windows PC, fully portable: the toolchain and programs live in folders next to the code, nothing relies on installed
  software. It runs offline except for mail, web and the git remote.
- Android phones (the main mobile platform), and iPhones as a web app with an online subset.
- The cloud git service (repository, automated builds, release files, a static pages site).

**The character of the work** (this shapes the design): a site survey is quick and chaotic, done standing, walking,
often one-handed, talking with the client, in bad light or full sun, sometimes with gloves. Office work is dense and
keyboard-driven on a large screen. The same person switches between the two several times a day.

---

## 2. Architecture in general terms

```
                ┌─────────────────────────── CLOUD: one private git repository ───────────────────────────┐
                │ main branch (code, catalogs, variants, device trust list)   release files (phone app)    │
                │ data branches: notes log · rulings · published 3D pages · published code city · sealed   │
                │ job packs · dev notes          automated builds on every push        static pages site     │
                └───────▲──────────────────────────────────▲───────────────────────────────────▲───────────┘
                        │ git push / pull                  │ HTTPS: read changed files,        │ web app
                        │ (commit guard, backups)          │ write notes, self-update          │ (iPhone)
┌───────────────────────┴───────── PC ─────────────┐   ┌───┴──────────── PHONE (Android) ──────────┴──────┐
│ Desk shell (portable desktop app)                │   │ Shell: paged home, top bar, dock, dials           │
│   hosts single-file HTML apps on private origins │   │ feature modules (one per feature)                 │
│ Text launcher (fallback front door)              │   │ Survey instrument (works fully offline)           │
│ local servers on 127.0.0.1, one fixed port each  │   │ shared kit: theme, long-press menu, one relay     │
│ phone relay: ONE port, pairing, proxy, tickets ◄─┼───┼─► link, one git client, secret store, file store  │
│ handover board (two-way file drop)               │LAN│ phone's own relay on a local hotspot (no router)  │
│ backups to a separate drive folder               │/hotspot                                              │
└──────────────▲───────────────────────────────────┘   └────────────▲───────────────────────────▲─────────┘
               │ USB serial / LAN                                   │ Bluetooth LE               │ Bluetooth HID
     small devices (touch display, board console, knob pad)    other crew phones (pager)   the PC (air mouse)
```

### 2.1 Building blocks

- **Single-file apps.** Every user tool is one self-contained HTML file that runs with no install and no network. Bigger
  apps are built from modular sources into one file. Browser storage does not work from a local file, so apps that keep
  data are opened inside the desktop shell (each on its own private origin) or served by a small local server.
- **Local servers.** Small dependency-free servers on the loopback address, each on a fixed port (around twenty: the
  Planner, Stock, the mind map, the map, the weather service, the knowledge graph, the code city's live mode, session
  views, the gate page's helper, the phone relay…). A checker refuses two servers on one port. The launcher starts a
  server if it is down and then opens it.
- **Two registries.** One file says **how** to run everything (tools, build and test steps, servers, programs, prompts,
  backup settings). A second, the **catalog**, says **what** exists: about 90 units, each with a type from a fixed list,
  a level (*user* < *dev* < *all*), a parent, a group, a status (live / beta / dev / planned / retire), the surfaces it
  appears on and how it opens. House rule: *a tool that is not in the registry does not exist*. Check scripts fail a
  commit on a dangling path, a duplicate key or port, or a dev item without a parent.
- **Levels are a filter, not a mode** (progressive disclosure). *User* shows finished things only. *Dev* adds secondary
  items drawn behind their parent (Planner → build, test, relay) and six developer roots. *All* adds everything else as
  one flat, filterable table.
- **Catalog groups** (the user's mental map): Work ‹Munka› → Planning ‹Tervezés›, Pricing ‹Árazás›, Material ‹Anyag›;
  Applications ‹Alkalmazások› → Office ‹Iroda›, Field ‹Terep›; Files ‹Fájlok›; System ‹Rendszer›; Development
  ‹Fejlesztés›.
- **One opening rule.** A tile, dock icon, dial row, palette line and top-strip button all send the same thing: a
  catalog id. The shell resolves it. A page never sends a file path.

### 2.2 The phone app's structure

- One shell hosts the home or one feature at a time; Back, deep links, hardware keys and the system bars go through it,
  and it reopens where the user left off.
- **A feature is a module**: its own screen plus a pure-logic core tested off the device. A feature never talks to
  another feature directly; it uses the shared kit or asks the shell to "open feature X".
- The **catalogue** of features is data (id, title, blurb, glyph, group, stage, needs: Bluetooth, relay, internet,
  repository, camera). The home, its numbering and the tests all read it.
- **Shared kit, once:** theme and palettes, chips, toggles, sliders, the status ring, the long-press menu, QR drawing,
  one relay link with its trust handshake, one git client, the secret store (hardware-backed keystore), the file store,
  notification channels.

### 2.3 The PC ↔ phone link

- **One relay process on one port** is the only way into the PC. Every PC ability is a message type in one envelope.
- **Pairing by QR**: the PC's screen shows a QR with the relay address and a one-time code (2 minutes, single use);
  the phone answers with a public key from its hardware keystore; later connections sign a challenge. Target: trusted
  in under 3 seconds. An untrusted phone may do basic control only.
- **Sensitive abilities are off** unless the relay is started with their flag (screen view, local-server proxy, AI
  sessions, folder reading). Phone input never reaches a command line: the phone sends ids or handles the PC made, and
  the PC checks them against its own allow-lists.
- **No router on site?** The phone can run the relay itself on a local-only hotspot; the PC pairs by typing a 10-letter
  code the phone shows.
- One-click **phone link** on the PC: finds the PC's radios, starts every server the phone may need, shows a QR per
  server (5-minute ticket through the relay's proxy), a pairing QR and a QR to download the phone app built on this PC.

### 2.4 Storage and formats (what the designer should know exists)

| Thing | Shape |
|---|---|
| Survey | one JSON file per survey (format version 2): the sketch plus the whole intake; every key optional; older files open unchanged, newer ones open on older phones |
| Survey package | the survey + the solved plan as Planner records + photo list + wants + takeoff; reopens on a phone |
| Takeoff | work items with quantities (no prices) as JSON + a Hungarian Markdown summary |
| Variant | a JSON overlay on the survey catalog that reshapes the tools for one kind of job; never code |
| Planner project | a plan file and a full bundle file |
| Sealed job pack | a priced job encrypted to one phone's key; only ciphertext travels |
| Desktop sheets | one JSON model shared by PC and phone |
| Field kit catalog | one data file read by phone and PC: fronts, photo purposes, chips, scope toggles, keyword detectors, questions with conditions, shot list, room templates |

Logic that must give the same answer on phone and PC (the survey's "shadow", the takeoff, wants per room) exists twice,
in two languages, pinned equal by shared test fixtures.

---

## 3. Data flow between phone, PC and cloud

| From → to | What travels | How | When |
|---|---|---|---|
| PC → phone | trust | QR pairing on the PC's screen | once per phone |
| phone ↔ PC | files, photos, survey packages | the **handover board** ‹Átadás› (two-way file drop) or the share sheet target "to the PC" ‹PC-re› | on a tap |
| phone ↔ PC | clipboard | relay, both directions | on a tap |
| phone → PC | pointer, keys, gyro | air mouse over Bluetooth HID, or the relay | while held |
| PC → phone | the PC's screen (6–10 frames/s) | relay, only when enabled; the PC shows a notice "the phone sees the screen" with Stop | while watched |
| PC → phone | local servers, START tools, logs, folder listings (read-only) | relay proxy with short tickets | on a tap |
| phone → cloud | quick notes | appended to a notes log branch; offline **outbox** retries | on send |
| cloud → phone | progress, CI state, releases, published pages, variants, apps | changed files only, conditional requests, resumable downloads, offline copies dated | on open / pull |
| PC → cloud → phone | priced job packs | encrypted to the phone's own key, carried on a private branch, opened in memory only | after pinning the phone |
| phone → cloud | device approval of a second phone | the owner's phone writes the trust list; a grant QR only the new phone can open | once per device |
| phone → AI agent → cloud → phone | a request for a job-type variant | request file (no client data) handed to an agent, who commits a variant; phones refresh it | on request |
| PC → cloud | everything else | commit guard pushes to a collect branch only, never the main branch, never forced | on S |
| PC → backup drive | all branches + work folders | backup menu: nothing overwritten without an archived copy | on demand |

There is **no live sync** between devices. Work moves as **packages** through the handover board, the share sheet or
the repository. Every package is self-describing and opens anywhere.

---

## 4. Rules that cut across everything

### 4.1 Offline-first

- The PC side is fully local; only mail, the web pane, sign-in and the git remote reach the network.
- The phone keeps working offline: the whole Survey instrument (text and face recognition models are bundled), the
  pager (Bluetooth), map tiles seen once (a 400 MB cache) and an offline address index, the last copy of every
  published page and app, the notes outbox. Offline copies carry a "· offline" mark and their date.
- Online lookups happen **only on a button** (address search, building outline, satellite view), never in the
  background.
- What fails offline fails visibly and keeps the user's text (e.g. a ruling that cannot be sent).

### 4.2 Privacy: what never leaves, what is stripped

- **Client data never enters the repository**: job folders, quotes, PDFs, addresses stay on the PC. Job codes are
  anonymised before every push by a local-only mapping.
- **Secrets** live in the hardware keystore (phone) or the OS keystore (PC). Nothing secret is ever committed, typed
  for the user or stored by an agent.
- **On export from the Survey:** GPS is removed from every exported photo unless the user keeps it, and a photo marked
  *personal data* never keeps it; blur drawn on a photo is burned in, so a blurred photo leaves only blurred; face
  detection only *proposes* blur boxes; the client's contact (name, phone, e-mail) is stripped from packages and
  takeoffs unless "keep in the exported package" is on; variant requests never carry the survey's name, the address,
  notes, personal photos, videos or signatures.
- **Online services get the minimum:** the address search gets only the address, the building-outline lookup only
  coordinates, the map page never the address; satellite tiles are never cached; navigation gets coordinates and a job
  code, never an address.
- **Sensitive screens** (priced job packs, the personal vault) block screenshots and the recent-apps preview.
- **Views of AI sessions** mask e-mails, phone numbers, street names, home and job folders; a masking toggle exists for
  screenshots. Tools that show client data carry a visible "client data" badge, keep an access log and have a kill
  switch.

### 4.3 Every feature switchable (the modular rule)

The owner's general rule: *everything integrated, but modular.*

- Every optional feature is **built in and arrives switched on**, and has **its own switch** in the settings, plus an
  **all on / all off** switch per group.
- Only what the user switched **off** is stored, so a feature added later arrives on.
- A feature that depends on another switches off with it (e.g. the ghost overlay needs before/after photos).
- **User preference first:** a feature switched off leaves **no trace** in the UI or the exports. Data already captured
  stays and still exports safely (a blur already drawn is still burned in).
- Built so far: *Camera features* ‹Kamera funkciók› (19 switches) and *Survey features* ‹Felmérés funkciók› (client
  data, sound note, the Replace tag in old surveys, line auto-close). **In progress:** one registry for every Survey
  feature with the same switches on the phone and the desktop.
- Plugins of the sketch canvas (tool packs) are switches too, remembered per survey.

### 4.4 Multi-device

- **Several phones per owner.** The owner's phone approves a new phone by scanning its request QR (instant when signed
  in) or by typing the new phone's device code; the approved list also decides who is offered updates when the release
  lock is on. An iPhone joins as a web app with the same approval cryptography.
- **Two phones at once on a survey** is the designed test case: phone A draws and talks (sketch, notes, scope,
  questions), phone B photographs and locates (camera, site, variants). Their surveys meet on the PC and must give the
  same numbers. A generated two-phone checklist (≈130 steps, numbered, Hungarian) drives the test; a shared live
  checklist page collects ticks from both phones and a bug list.
- **Crew phones** talk to each other over Bluetooth LE with the pager (no internet, no PC).
- Feature switches are **per phone**. Notes carry their device, so a phone does not notify itself about its own note.

### 4.5 Hungarian first

- Every UI string is Hungarian; English appears only as a small italic gloss in some kits and documents, and in code.
- Hungarian words are long (compounds, many suffixes) and use the accents á é í ó ö ő ú ü ű: plan for labels 30–40 %
  longer than English, avoid fixed-width text buttons, and never set titles in a typeface that lacks ő and ű.
- Text-mode console output stays ASCII (accents garble in the console code page), so launcher screens show Hungarian
  without accents or keep text in a data file.

### 4.6 Interaction house rules

- **Symbols and colour codes instead of text buttons.** Each umbrella app and each "front" has one symbol and one colour,
  the same on phone and desktop.
- **One button reaches each umbrella app** on the phone and on the desktop.
- **The long-press menu everywhere** ("RCO", the toolset's right-click menu; a long press on touch): one buzz, a dropdown
  anchored to the item, titled with the item's name, destructive lines in coral. Not used where a long press already
  means drag, resize or SOS.
- **Quick capture is never more than one tap away** (✎ note, ◉ photo on every survey front).
- **Decisions are asked as numbered options with the recommended one first** (A = recommended), in tools and in agent
  questions alike.
- **Esc never discards**: it steps out one level; an editing session ends only with Save or Discard.

### 4.7 Visual languages in use today

- **Deep Water** (the tool look): dark slate-void ground (#0a141c), smoked-glass panels, 1 px hairlines, square controls
  with two chamfered corners, no drop shadows, low glow. **Two temperatures, two meanings:** ice (#93d3e6) = the
  instrument and *you* (selection, focus, "you are here"); warm copper (#e8a873) = *the system is working* (running,
  recent activity). Numbers in monospace, titles in a condensed DIN-like face, small labels uppercase and tracked.
  Water ripples only when clicked. Semantic colours: ok #8bcca1, warn #e3be7b, critical #e4877d.
- **8-bit terminal**: the text launcher draws Deep Water as an 8-bit text UI with a pixel logo.
- **Paper** (client documents): warm ink, never black (#2f2c28), hairline rules, an ink-budget rule (no fill darker than
  a pale wash), one accent "wire red" (#b5452f) used only for *new/changed* on plans and *the payable total*; a hairline
  running in from the paper edge that ends on an open terminal dot; a warm serif for titles and the total, a DIN-style
  sans for everything else (codes, dates, numbers always in the sans); hanging section numerals; tables without
  vertical rules.
- **Phone palettes:** eleven (six app palettes, four from the coded UI kit — Night, Paper, Contrast, Deep Water — and a
  dark-slate HUD with a cyan accent). Kit palettes also switch fonts (a grotesque body, a condensed title face, a mono
  for readouts) and corner radius.
- **A coded UI kit** (56 components in 11 families, four themes, three densities, one icon sprite, one action registry),
  including "marks" with *one glyph, one meaning*: stage, line state, lamp, level, step, monogram, count.
- **The status ring ("MINI")**: a small ring on tiles and busy chips with states idle, running (percentage or sweep),
  done, error (a notch), waiting (dashed), paused, off; read aloud by the screen reader; still when animations are off.
- **The brand mark** (a bulb) and a "peak ring" (a band with peaks and strata) drawn by one engine that morphs
  between them; the ring doubles as a notification board.

You are free to propose a new visual language; these are the current ones the owner likes.

---

## 5. The products and their features

### 5.1 The text launcher ‹START› (PC, fallback front door, live)

- A full-screen text UI in a portable terminal; the original front door, kept as the recovery launcher. **Keys are
  stable** (the owner knows them by heart): digits for everyday tools (Planner, calculators, mind map, product picker,
  Stock, parts builder…), letters for project submenus (P Planner, I Stock, L Mobile, R knowledge graph…), dev items
  (AI coding assistant, desktop shell, editor, git, local servers, prompt library, checks, programs), **S commit + push**
  highlighted, **Q quit**.
- A status row counts each repository's changes and unpushed commits. Every "open" asks which browser.
- Messages: running / done / "failed (code n), later steps skipped" / "server did not answer in 10 s" / "not installed"
  (optional programs greyed, not errors).
- **Commit + push guard:** commits the current branch and pushes it only to a collect branch, never the main branch,
  never forced, falling back to a dated branch when the collect branch has diverged. Secret-looking file names, key or
  token content and files over 5 MB stop that repository with a reason. **Exit guard:** leaving with unpushed work
  opens "before leaving": commit + push and exit / leave anyway / back; the window's close button is greyed meanwhile.
- **Backup menu** (same look): 1 sync (every branch and tag to a bare backup repository per project, plus the work
  folders mirrored; *nothing is lost* — a file the backup would overwrite or drop is first moved to a dated archive; an
  emptied source is skipped, never wiped), 2 integrity (repository check + every file re-hashed against a manifest),
  3 last report, 4 restore (a file or folder from the backup or any archived copy; overwrites, never deletes, the
  current copy archived first), 5 installer check (is each portable program's installer kept?). Known limit, stated in
  the UI: uncommitted work is unprotected.
- **Portable USB build** (planned): build, pick a drive, copy + verify, eject.

### 5.2 The desktop shell (PC, beta)

A portable desktop workbench that hosts every tool. Boot: splash → gate (sign-in, currently switched off) → the last
primary view. Window modes: window, work (full screen over the taskbar), overlay.

- **Primary view 1: Dashboard.** One scrollable page of sections built from the catalog, filtered by level. User:
  Today · Applications (by group) · Programs · Archive · Jobs · Status. Dev adds: development lines · knowledge graph ·
  agents · servers · metrics. All adds: the catalog as one filterable table.
- **Primary view 2: Desktop.** A customisable **top strip** (up to 12: clock, search, servers up, git state, last backup,
  the signal ring, level switch, shortcuts to field-console pages), the **workspace** (an empty water ground or the open
  windows), a **bottom dock** (pinned apps + running windows, dev items after a divider, "show desktop"), and two
  **corner dials**: ◣ the main menu by function (Work · Applications · Files · System, + Development), at most five rows,
  breadcrumb, type to search; ◢ the knowledge-graph layers, the same component mirrored.
- **Switching views:** double Tab (≤ 350 ms, ignored while typing), double-click on empty background, or a corner
  button. Esc closes a dial first, then means "show desktop"; inside an app Esc belongs to the app.
- **Sheets** ‹Lapok›: each sheet is a 4×4 grid of windows that never overlap. A new window opens full; double-click its
  header → one cell → full; drag an edge to resize in whole cells; drag the header to move, drop onto a same-size window
  to swap; right-click a free cell for a picker with a search bar. Presets per level; save your own.
- **Built-in panes:** files (over defined roots, jobs queue, delete to the recycle bin), terminal, browser (isolated
  tabs, permission and download gates), mail (read-only, sanitised, images on request), an AI side chat, context packs
  (knowledge-graph clusters sent to an AI), a git panel, feeds, internal search.
- **Frame tools:** command palette (Ctrl+K), a global quick bar that routes typed text by prefix, a selection menu
  (select text anywhere → copy / internal search / web / AI), notifications + job queue, settings, the phone link (§2.3).
- **Programs section:** everyday third-party utilities; a program not installed is a **ghost**: tick and install into the
  portable folder; vendor installers are never run (the ghost opens the official download page).
- **Security:** web content sandboxed with its own partition, every message schema-checked and closed by default, opaque
  file handles, an append-only audit log, no system changes.

### 5.3 The gate page (PC / shared, beta)

- An access page: sign in with a personal repository token kept only in that browser; a **signed allowed-list** decides
  whether the page opens; then it lists the tools with two small buttons each (Open, Folder).
- Full mode through a local helper (open tools, folders, a terminal, the AI assistant, from a fixed action whitelist) or
  "links only" mode from a plain file, with a banner explaining how to get full mode.
- An admin page adds or removes a person, signs, verifies, rebuilds and rolls back if a step fails.
- The original plan (parked, design history): a "business topology" board, origin → departments → programs, with layers
  hanging below each (shared folders, AI documents, git + a roadmap growing downward, personal links, a local target
  folder), lock states per node (open / needs sign-in / not on the list), a guided tour, "what changed?".
- Planned: guest mode ("guest — read only" badge), per-person shared folders.
- Honest rule printed in its docs: *a static page cannot keep a secret*; the real locks are repository access and
  shared-folder permissions.

### 5.4 The phone app: shell and home (Android, mostly beta)

- **Paged home** (default): eight numbered pages swiped sideways; **the top bar and the dock stay on every page**. A page
  with up to three entries shows big cards; longer pages show an icon grid (4 columns upright, 6 lying down).
  **Long-press ⌂** → the same order as one long scrolling page.
- **The pages, in the owner's order:** 1 Field: needed now ‹Terep: azonnal kell› (the Survey hero card with a survey
  count and a photo-point chip; the crew pager) · 2 Work: a few minutes (Planner, three calculators, Stock tools) ·
  3 the estimate workflow · 4 map, weather, vault · 5 archive, AI assistant · 6 link to the PC (QR pairing, network,
  air mouse, screen, handover, PC files, remote launcher, local servers) · 7 other (quick note, notifications,
  progress, code city, consistency sphere, knowledge pages, apps, sheets) · 8 account and settings.
- **Top bar:** ⌂ + sheet tabs · command search (each word a prefix; ranked by word position then recent use) ·
  "⟳ new" update mark · ▦ QR scan · 📖 catalogue guide · orientation (automatic → portrait → landscape; rotation never
  restarts a screen) · ⚙. **Dock:** ◣ menu dial (the desktop's catalog by group, tagging what the phone can open), the
  Survey dial, open windows newest first, ◢ knowledge dial.
- **Sheets on the phone:** the desktop's sheet model, a 2 × 4 grid (drawn 4 × 2 lying down); double-tap a header full ⇄
  one cell; long-press + drag to move or swap; long-press an edge to resize; long-press a free cell for the picker;
  long-press a tab to rename, reorder, save as template, close.
- **Long-press menus** on dock windows (open / close / close others / close all), home icons (open / open on a sheet /
  fold group / description), notifications, PC files, apps, commits, AI sessions, screenshots, launcher tiles, the
  Survey tile and dial (new survey from a variant, refresh variants, request a variant).
- **Catalogue guide** ‹Katalógus›: one swiped page per phone or desktop program with a table of contents and Open, for
  new users.
- **App icon:** the brand mark coloured to the chosen palette; faintly (≈ 6 %) behind the home.

### 5.5 Phone features (besides the Survey)

**Set-up and identity**
- **Settings** ‹Beállítások› (live): appearance (palette, size), start (home mode, orientation, start in last), paired
  PCs (remove = unpair on the PC too), notification channels, about, an in-memory log.
- **QR pairing** ‹QR párosítás› (live): §2.3. States: trusted / untrusted ordinary phone / removed.
- **Repository account** (live): device-code sign-in (a big copyable code, a countdown, cancel), access check
  (read+write / read only), sign out; a read-only **guest mode** by repository name; "No internet." without a crash.
- **Update** ‹Frissítés› (live): checks on open (at most every 6 h), "new version — what changed", download with a size
  and hash check, one confirm tap; a release lock points unlisted phones to Devices.
- **Devices** ‹Eszközök› (beta): approval of a new phone. New phone: "request access" → a request QR with a 6-character
  check code → "waiting for approval…" → self-unlocks within minutes, or "paste grant". Owner's phone: scan → approved;
  a pasted request shows the big code to compare by eye; a grant QR only that phone can open; optionally hand over the
  owner's repository token too (off by default); fallback: approve by typing the device code. Owner-only extras:
  installer QR for another phone, release lock, the device list with remove, "connect an iPhone".
- **iPhone web app** (beta): device approval, progress, update behind the lock, appearance; cache-first; no Bluetooth,
  no relay features (explained in a step-by-step guide marked "on the iPhone" / "on the owner's phone").

**Following the work online**
- **Progress** ‹Haladás› (live): main branch first (latest commits, CI ✓ ✗ ●, which tools changed in 7 days), then cards
  only for branches ahead of main with recent commits (ahead/behind, last commit, pull request), a tools list. Pull to
  refresh; "no CI on this commit" is a normal state.
- **Quick note** ‹Gyorsjegyzet› (live): type, dictate or share text into a note with tool tags, appended to a per-day
  log in the repository (the project's chat log). Offline **outbox** with retry and "send now"; no duplicates.
- **Notifications** ‹Értesítések› (beta): one list grouped by day with filters (all · CI · pull requests · relay · note
  · update); what rings: a CI failure, green after a failure, review requests and mentions, a new release, a note from
  another device, the PC back online after 10+ minutes; the first poll fills silently; permission asked only on this
  screen; five channels.
- **Code city online** (beta): the repository as a 3D city built from the cloud's fresh state, per branch chip; offline
  copies; touch: one finger orbits, tap picks, two fingers pan and pinch; the PC toolbar folds into one 48 px row and a
  sheet.
- **Knowledge pages** (beta): three 3D concept pages of the knowledge graph (a connectome "brain", a hologram, an
  exploded layer stack) with orbit, pinch, twist, tilt, tap, double-tap reset, long-press lock; full screen.
- **Archive** ‹Archívum› (beta): every one-shot interactive page the AI made, each with when / why / what was going on;
  touch-friendly viewer (≥ 44 px), Back steps viewer → entry → list.
- **Consistency sphere** (live): one dot per document, red pairs where two statements clash; tabs sphere / signals /
  sections; rulings from the phone (first holds / second holds / coexist, with a required reason).
- **Apps** ‹Alkalmazások› (beta): the desktop's user-level HTML apps (Planner, calculators, Stock, product picker, parts
  builder, mind map), each on its own origin, offline after the first fetch; tiles for the Planner, calculators and
  Stock open them directly.
- **Weather** (planned on the phone).

**Controlling and linking to the PC** (pairing required)
- **Air mouse** (live): gyro air mouse, keyboard, touchpad and controller for the Planner and the code
  city over Bluetooth HID; macros (e.g. launch a PC tool); PC screenshots; volume keys click only while the deck is on
  screen; a notification with Stop.
- **Network** ‹Hálózat› (beta): every link's honest state (tethering state with a one-tap settings link where an app
  cannot switch it; a local-only Wi-Fi hotspot for phone ↔ PC on a site without a router; mobile data today with a
  once-a-day threshold warning; the air mouse's Bluetooth state; the phone's own relay with its pairing code).
- **Local servers** (live): the PC's running servers with status dots; "on the PC" (open in its own window there) or
  "here" (open on the phone through the relay proxy).
- **Remote launcher** ‹Indítópult› (live): the PC launcher's tools as a grid, **keyed exactly as on the PC**; dots: glow
  running, sand starting, faint stopped; tap = start on the PC; long press = run on PC · open on phone · log · stop ·
  details.
- **Handover board** ‹Átadás› (live): two-way file board; "to the PC" with target chips (board / Planner / Stock), files,
  photo to the Planner; progress bar; clipboard ⇡ ⇣; "on the board" list with download / remove; share-sheet target
  "to the PC". 50 MB limit, hash-checked, an interrupted upload never appears, removal moves to a "removed" folder. The
  main route for survey packages and photos.
- **Screen** ‹Képernyő› (beta): the PC's screen live with the cursor; pinch zoom, monitor chips, "active window",
  quality gentle / sharp; a steering strip (hold the pad, gyro moves the cursor; left / right). Consent: off unless
  enabled, one viewer, a notice on the PC with Stop, frames never written to disk, stops on leaving or after 30 minutes.
  States: connecting / live / "the screen is not visible now" / stopped + continue.
- **PC files** ‹PC ablakok› (beta): three work roots read-only; breadcrumbs; preview text or image; "to the handover
  board". Secrets and dot-files never listed.
- **AI sessions** (beta): opens the official AI assistant app (the phone app never signs in to it); with a paired PC,
  lists the PC's remote AI sessions (running, folder, time), stop one, start a new one in a folder.

**Office and data**
- **Estimate workflow on the phone** (beta): the PC's priced jobs, sealed to this phone; job list, steps (questions →
  material → pricing → offer → document), variant totals (labour, material, effort) and texts; screenshots blocked;
  delete from phone.
- **Map** ‹Térkép› (beta): the PC's map page on the phone; a header chip says where data comes from (PC data through
  the relay / internet with a tile cache / offline); own position (never leaves the page), survey sites as violet dots,
  jobs (PC only, never stored); navigation hands coordinates to the navigation app only on a tap.
- **Vault** (beta): a personal encrypted vault web app in a locked-down web view with its own separate approval.

### 5.6 The crew pager (phone, beta)

Crew phones page each other over **Bluetooth LE**, no internet, no PC, no pairing dialog. Moment of use: two or more
electricians in different rooms or floors.

- **Glove-friendly keys** (54–160 dp, hold-safe): **CALL**, held: the partner's phone rings while it is held · **SEEN**:
  acknowledges the newest page, the sender sees ✓✓ · **K1–K3**: short or long press for six of fourteen coded messages
  ("come here" … "low battery"), each with its own vibration rhythm · **LINK**: tap = link test with signal and
  distance, long = roll call with batteries. Delivery colours: green delivered, amber sending, red no answer in 8 s.
- **Phone extras:** proximity (rounded distance, zones, closer / farther arrow, 1 m calibration), a finder (big
  distance readout, a sonar tick that speeds up), chat (all or one, acknowledged, up to 3 hops, store and forward for an
  hour), push-to-talk (half duplex, "busy" when someone talks; volume-down talks, volume-up = seen), SOS on a long
  press, automatic low-battery message, answer from the lock screen, crew invite link.
- **Guard modes:** guard (lay the phone still to arm; moved → alarm to the crew) and man-down (impact or no motion for
  1–5 min → local pre-alarm, then crew alarm; SEEN cancels). **Repeater mode:** a phone left in the stairwell relays
  everything.
- **Safety wording:** "switch off / switch on" messages say on screen that they are **not a lockout** and to wait for
  SEEN; in the full list they need a long press.

### 5.7 The Survey instrument ‹Felmérés› (phone + desktop page, beta; the centre of current work)

The instrument for **site inspection, measuring, job survey and data gathering** ‹helyszíni szemle, méretvétel,
munkafelmérés, adatbegyűjtés›: "basically a note-taker and a sketching tool with the camera involved". One button reaches it:
the hero card on phone home page 1, the Survey dial in the phone dock, a dock dial and a launcher key on the desktop.
Long press on any of them: open · "new survey: ‹variant›" for each variant · the original · refresh variants · request
a variant.

#### Built for chaos

A survey is quick and chaotic. The electrician sketches the flat while walking it, marks installation points and
routes, takes sizes, listens to the client explaining needs and context, photographs the building, the meter, the board
and the rooms, and has to remember the questions this kind of job needs answered. Information arrives in random order
and random lengths: a size before the room exists, a kitchen note while drawing the bathroom, half a sentence, a photo,
back. So:

1. **Every capture stands alone** (note, chip-only fact, answer, photo, size, point: each has its own id, time, payload).
2. **Links are optional and may come late.** A note picks up "the room in focus" (the last room touched); a photo can
   be tied to a point; either can be re-linked later.
3. **Completeness is derived, never stored.** "What is missing" is recomputed every time; nothing has to be closed to
   move on.
4. **Nothing half-done is lost.** The note being typed, the line being drawn, the photo waiting for its direction
   survive switching fronts, the screen locking and the app being killed.
5. **No front blocks another.** ✎ and ◉ are on every front, open over it and return to exactly where the user was. The
   question badge is always in sight.
6. **The system grows with the job.** The questionnaire and the shot list are a **digital shadow** computed from what
   has been captured: the next relevant question appears the moment it becomes relevant, and only then.

#### The frame

- **Top bar:** survey name, the **variant toggle** in the corner, building level (basement / ground / upper), undo ↶ /
  redo ↷ (×100), ⚙, "review ›" ‹Rendezés›.
- **Front bar:** seven fronts, each a symbol in its colour with a count badge. **Floating buttons** ✎ (note) and ◉
  (photo) bottom right on every front. Autosave half a second after each edit.

| Front | Symbol | Colour | Holds | Badge counts |
|---|---|---|---|---|
| Sketch ‹Vázlat› | ◫ | teal #27c2b0 | rooms, sizes, points, circuits, the board, routes, memos, tags, photo points | — |
| Notes ‹Jegyzet› | ✎ | amber #e0b020 | the conversation log, chips, background suggestions | pending suggestions |
| Scope ‹Munkakör› | ☰ | green #3dae5a | what the job is, the client's wants, the live takeoff | — |
| Questions ‹Kérdések› | ? | orange #e8641c | the shadow questionnaire | open; filled when one is new |
| Camera ‹Kamera› | ◉ | blue #2a8cdb | purpose photos, the shot list, markup, video, signature, sound notes | missing shots |
| Site ‹Helyszín› | ⌖ | violet #8a5cd6 | address, GPS, map outline, the sketch placed on the building, client contact | — |
| Open ‹Nyitott› | ⚑ | red #d64545 | every loose end | all open items |

Front colours mark *functions*; points, circuits and tags keep their own colours.

#### Sketch front ◫

- **Tool packs (plugins, switchable per survey):** notes (always on: move, memo, tag) · floor plan (room, template,
  line, measure) · electrical (point, circuit, board, route) · photo point (off by default).
- **Tool rail:** one tap per tool; tapping the active tool again swaps back to the previous one; each tool's options sit
  in one row above the rail and a one-line hint on the canvas. The first five tools are in thumb reach.

| Tool | Glyph | Behaviour |
|---|---|---|
| Move | ✥ | drag a point, memo, tag, room or corner |
| Memo | ✎ | tap a record → memo pinned beside it with a thin leader; tap paper → memo there |
| Tag | # | a tag tray; drag a tag onto a record or the paper, or tap to make it the brush; "+ new tag" |
| Room | ▭ | drag a rectangle; corners snap to neighbours' wall lines |
| Template | ⌗ | pick a shape (L, U, T, slanted corner, niche) and drag it to size |
| Line | ⌇ | tap corner to corner with an axis lock; tap the first corner to close a room; *Done* leaves an open line |
| Measure | ↔ | tap a wall → its length; tap inside a room → width × depth |
| Point | • | tap near a wall and the point sits on it |
| Circuit | ◌ | tap points into the active circuit or frame them; circuit colour chips; "+ new circuit" |
| Board | ▣ | placed on a wall; *Connect* feeds every unconnected circuit from the nearest board (dashed link) |
| Route | 〰 | drag along the cable path; simplified to corners; ends snap to a point or board and follow it |
| Photo point | ◉ | tap a room near its middle; snaps to the centre |

- **Hold-and-swipe wheels:** hold 0.42 s anywhere → an 8-sector wheel under the finger; slide toward a sector and
  release. North = first, clockwise; the south sector flips to the next ring ("›" / "‹"); releasing in the centre leaves
  the wheel open for tapping; Back closes it. Wheels exist for a **point** (socket, switch, light, junction box, ›, memo,
  existing ⇄ planned, delete; ring 2: data / low-voltage, fixed connection, sensor, board, ‹, tag, into circuit, point),
  a **room** (name, size, memo, tag, kinds ›, its points into a circuit, delete), a **wall** (its length, point here,
  memo, tag, board here, room), **empty paper** (memo, tag, point here), a **photo point** (its four directions at the
  wheel's four sides, ✓ taken / + take), a **memo** (edit, tag, delete).
- **Room kinds:** sixteen, each with a glyph, in rings (living room, kitchen, bedroom, bathroom, WC, hall, corridor,
  dining, study, storage, plant room / garage, children's room, wardrobe, laundry, terrace / balcony, other); several
  per room; the room's automatic name joins them ("Kitchen + Dining").
- **Points:** types with glyphs — untyped •, socket ⊙, switch ⊘, light ✱, junction box ◇, data / low-voltage ◈, fixed
  connection ⊗, sensor ◎, board ▣ — each with a standard mounting height for export. **Two states: existing** ‹Meglévő›
  (sand, with a ring) and **planned** ‹Tervezett› (glow colour); both must read in sunlight. Actions such as *replace* or
  *remove* are tags, not a third state.
- **Circuits:** name, colour, dedicated flag, isolation, members, feeding board.
- **Tags:** presets with a meaning downstream (bathroom, kitchen, wet, IP-rated, dedicated, remove, **replace** in orange)
  and user tags in a rotating palette; a loose tag on paper becomes a note.
- **The solver:** the rough sketch becomes millimetres live. Room corners cluster into shared wall lines; each measure is
  an equation; the rest is guessed from the sketch's proportions. Every wall is labelled **measured** ‹mért›,
  **derived** ‹számolt› or **≈ guessed** ‹becsült› — guessed sizes in coral with dashed walls. Contradicting measures
  are reported.
- **Photo points:** tap a photo point → camera; back on the sketch its four wedges glow and say "swipe the way the photo
  faces"; the swipe saves the side (N / E / S / W of the sketch, not the compass); the prompt names the next missing
  side; filled wedges open a viewer (retake, change side, delete).
- **Gestures:** one finger taps, drags (after a small slop) or holds; two fingers pan and pinch at any time — a drag
  already started is cancelled, never half-applied.
- **Review ›:** the plan in mm with each wall's state, contradictions in coral, photo points with view cones; "send to
  the Planner" (share sheet or handover board) and "save to the phone".

#### Notes front ✎

- **The quick note** (✎ on every front): text or dictation, and **chips instead of typing**, in two rows. *Client:*
  ★ wish · ⚠ problem · ! important · ⏱ deadline · Ft budget · ? ask back · ⚑ to be clarified ‹Tisztázandó› (marks the
  entry open). *Situation:* ⌂ occupied · ☺ owner present · ☻ tenant · ⚿ key arranged separately · 🐾 pet · P parking
  hard · 7 weekends only · ≋ dust-free. A chip alone is a valid fact; some chips answer a question (tenant → access).
  The room in focus is attached automatically (✕ detaches).
- **Background detectors:** every note, memo and photo caption is folded (lower case, accents removed) and run through
  ~27 keyword detectors (appliances, systems such as an EV charger or solar, rooms, old aluminium wiring, a residual
  current device, tripping, a burning smell, money amounts, one or three phases, "urgent / tomorrow", condominium,
  tenant). **Detectors only suggest:** a **ghost card** to accept with one tap or swipe away; a swiped one never returns
  ("no RCD" must not silently read as "RCD"; "burnt-out bulb" is not a fault).
- **Log:** newest first: time, 🎤 if dictated, chips as coloured pills, room, ⚑ toggle; tap to edit.
- **Sound note** (a switch): a phone without speech recognition records up to 3 minutes; listed under the camera as 🎙;
  never transcribed.

#### Scope front ☰

- **Toggles in four groups** (about 42): *nature of the work* (new installation, renovation / replacement, extension,
  fault finding, inspection, meter point / capacity, board replacement, survey or quote only) · *area* (whole flat or
  house, kitchen, bathroom, rooms, garden / outdoor, garage / workshop, common areas) · *systems* (EV charger, solar,
  smart home, low voltage, alarm / camera, door intercom, air conditioning, heat pump, underfloor heating, lighting) ·
  *wants* with − n + quantities (sockets, switches, lights, LED strip, hob, oven, washing machine, dishwasher, dryer,
  water heater, towel warmer, ventilator, TV point, LAN point, outdoor socket, industrial socket, IP camera).
- **Scope card:** rooms and m² (guessed ones counted), planned and existing points by type, circuits, boards, photos,
  notes, answered / open questions.
- **Wants per room:** "where to" ‹Hová› picks *general* or a room (starts on the room in focus); "by room"
  ‹Szobánként› shows what each room holds; long-press a want to move it; the job total stays authoritative.
- **The live takeoff card** at the top: one chip per work item (symbol + quantity); coral **≈** while guessed; **⚑**
  while an open question can still change it; faded when nothing is to be done; tap → name, reason, decisions; a ⚑ row
  jumps to the question. A switch "dedicated circuit for big appliances" (off by default). **No prices.**

#### Questions front ?

- About 48 questions; each has a **condition** and is shown only while it holds (on scope, an answer, a room kind, a
  point type, a tag, a keyword hit, a chip, a photo purpose, the site, the variant; combined with all / any / not).
- **Order:** open first (priority, then arrival), then *later*, then answered ones folded. **Card:** ● new (10 min) ·
  ☺ ask the client / ◎ look yourself · option chips (single or multi, 2–5 short options, the likely one first) · a free
  text box · ⏱ later · ⊘ not relevant · ↺ reset. Filter: all / client / inspection. Answering can switch on scope,
  which brings new questions. The deadline question has a date field.
- **Topics:** always (the request, property type, access, deadline, budget, occupied during work, photo permission,
  old documentation, decision maker), existing installation (age, conductor material, protection present, fuse type,
  problems, last inspection), meter point (phases, main fuse rating, meter location, incoming supply, new large
  consumers), board (free space, labelling, earthing system, need a new board), bathroom, kitchen (appliances, hob type,
  tiling), EV charging (power, parking place, distance from the board, consent in a condominium), solar (consumption,
  roof, orientation, battery), smart home (system, what to control), low voltage, air conditioning.

#### Camera front ◉

- **Thirteen photo purposes**, each a symbol + colour: building outside ⌂, surroundings ⛬, access ⇥, meter point ⌁,
  board ▣, existing fitting ○, planned location ✚, fault / hazard ⚠, type plate / label ▤, route / wall 〰, room ◎,
  document ▧, other •.
- **◉ gestures:** tap = shoot for the current purpose (its symbol is on the button); **hold** = the purpose menu,
  leading with **missing** (the next four shot-list items), then video, signature, the three recent purposes, then the
  full grid. After a shot a "+ (symbol) again" pill stays 9 s.
- **Each capture records** purpose, room in focus, the shot-list item it fulfils, time, GPS from the photo, a typed or
  dictated caption.
- **The shot list** ‹Képlista› (~27 items) grows with the job (building front, access, meter cabinet closed and open,
  meter label, main fuse, board closed and open, circuit list, protection device label, earthing / bonding, free space
  in the board, fault traces, bathroom and kitchen photo points, EV charger place and cable path, roof sides and
  shading for solar, typical existing socket per room, old documentation…): ✓ when done, have / need counts; tap to
  shoot for that item.
- **Series** ‹Sorozat›: the camera returns after each shot until cancelled.
- **Gallery** grouped by purpose; badges ▶ video, ✍ signature, 👤 personal, ◐ before, ◑ after, ▤ text read.
- **Viewer:** re-choose purpose and room, caption, delete; **markup** (arrow, circle, line, freehand, text; five colours;
  undo) kept as vectors over the untouched original and burned into a copy only on export.
- **Type-plate reading ▤** (on the phone, offline): label photos are read automatically, others on a tap; recognised
  values (serial number, maker, supply rating, fuse and breaker ratings, residual-current rating) become chips that fill
  an answer or a note **only when tapped**.
- **Privacy tools:** blur ▦ rectangle and ▒ brush (vectors, burned in as a mosaic on export); a 👤 personal-data flag per
  photo, and a list of flagged photos with nothing blurred yet; face detection proposes dashed blur boxes, applied only
  on "✓ blur"; GPS stripped on export unless kept.
- **Before / after ◐ ◑:** an after-photo with the same purpose, item and room; pair, unpair, mark one as waiting;
  compare with a slider or side by side.
- **Client signature ✍:** one of three statements (handover receipt / consent to photos / both), the name, a finger
  pad; saved as an image with name and time. A record of consent, not a qualified e-signature.
- **Walk video 🎥:** at most 90 s / 150 MB, warning over 80 MB.
- **In-app camera** (the phone's camera app is the fallback and a switch): purpose badge and a strip of round coloured
  purpose keys on the viewfinder (missing items first, a red dot), a room chip (tap cycles rooms), have / need count,
  zoom factor, ϟ torch, ▦ grid; a series stays open until "✓ n" with the last thumbnail and ↶ to drop it; a finished
  shot-list item moves on to the next missing one; the **ghost** of the before-photo at 40 % (slider to 80 %) for an
  after-photo; tap to focus, pinch zoom, a **level** line (green within 1°, a bubble when the phone lies flat), a
  thirds grid.
- **Camera feature switches:** 19, each with "all on / off".

#### Site front ⌖

- Address; "⌖ I am here" (the phone's own GPS; nothing is sent); coordinates and their source.
- **Online only on a button:** 🔎 address search (sends the address only), ▱ building outline (sends coordinates only).
- **The building against the sketch:** both measured as oriented rectangles → *matches* (±8 %) / *smaller* (a flat in a
  bigger building) / *LARGER* (a size is wrong).
- **"Outline and sketch on the map"** opens the system's own map full screen on this survey: ▱ draw or correct the
  building outline (tap corners, drag, add at a midpoint, delete a corner, undo); 🛰 satellite only after a tap, never
  cached, attribution shown; ◫ the solved sketch auto-fitted onto the building, then dragged and turned (1° / 15°,
  refit); a **placement report** (turn angle, centre offset, walls sticking out > 0.25 m in red; verdicts *sticks out* /
  *rotated* / *offset* / *OK*); "take this place" sets the job's position; ✓ Done returns.
- **Client contact** 👤: name, phone, e-mail; personal; kept on the phone; a pill "removed on export" unless the keep
  switch is on.

#### Open front ⚑

A derived list grouped by front; one tap jumps to the right view, camera or editor: the unfinished draft note, notes
marked *to be clarified*, pending suggestions, unanswered priority questions, missing priority shots, photo points
missing sides, rooms with a guessed size, untyped points, circuits not connected to a board, photos with no purpose
and no caption, no address.

#### Variants (job-type versions of the instrument)

- A **variant** reshapes the Survey for one kind of job: plugins, rail order, the first ring of the point and room
  wheels, labelled point brushes (type + tags), room templates, tags, preset scope, extra chips, toggles, keyword
  detectors, questions and shot-list items, one hint per tool, and drawing behaviour (angle step 0/15/30/45/90°, a snap
  grid, a room of a given size on a tap, size dialog first, points free or on walls, what *Done* does with an open
  line). It reorders and adds; **it never hides what the original shows.** It is data only, so it cannot break the app.
- Examples: bathroom renovation (zone tags, size first, 10 cm grid), EV charger install (route and board first, garage
  template, wall penetrations), small industrial site (high-bay lights, emergency lighting, industrial sockets, a 1 m
  grid, a 30 × 20 m hall on a tap).
- **On the phone:** ⚙ → variants; the **corner toggle** (the variant's symbol in its colour, or a grey ◐) switches
  between the original and the variant at any moment; its long press lists variants, original, refresh, request.
- **Requesting one:** ⚙ → "request a new variant": 1–3 sentences (typed or dictated), keyword toggles, up to 5 photos
  (personal ones never offered, GPS stripped). The phone packs a request (premise, toggles, counts — never names,
  addresses or notes), hands it to the PC and copies a starter prompt. An **AI agent** reads it, plans, asks at most five
  crucial questions with a recommended option first, writes and validates the variant, reports "original → variant",
  and commits it; phones refresh it from the repository (and get it bundled with the next release).

#### Downstream: where the survey goes

- **Into the Planner:** "load plan from file" opens the package as a new project. Rooms become outlines, guessed walls
  are drawn orange dashed with "≈ length" until "sizes checked" clears them in one undo step; points become devices at
  standard heights with existing / planned and replace / remove kept; photo points become hidden notes with view cones;
  photos attach by file name; the whole intake (scope, answers, notes with *to be clarified* flagged, photos by purpose,
  takeoff, wants by room, client) stays with the job.
- **The takeoff** (the hand-over to pricing): work items with quantities and no prices — points by type × action (new /
  replace / remove / stays), wants vs drawing reconciled (the larger wins, ≈ with a note "scope: 4, sketch: 1"),
  appliance connections, general and dedicated circuits, boards, **cable metres** (each drawn route's solved length +
  drops + a reserve per end; undrawn home runs estimated, ≈), systems, open **decisions** (⚑, each naming what it
  affects), checks, photos by purpose, rooms with area and wants. Produced on the phone (review), on the desktop page and
  by a command-line tool. The estimate workflow on the PC reads it: pre-fill only matched answers, keep ≈ and ⚑ visible
  as assumptions, treat decisions and *to be clarified* notes as open points of the offer.
- **The survey report** ‹Felmérési jegyzőkönyv›: a printable A4 document in the Paper style, built from the open file and
  never stored: header (place, date, variant, client if kept, counts); work; scope and takeoff (≈ / ⚑, decisions);
  questions and answers; notes (*to be clarified* in red, memos); rooms; the sketch; photos by purpose (before / after,
  video and sound notes listed); site (outline with the placed sketch and its report); signature. From the desktop page
  today; **from the phone in progress** (print / PDF or a self-contained page shared through the handover board, photos
  downscaled, the export privacy rules applied, a *for the client* mode that also drops *to be clarified* notes and
  internal checks, a warning above 15 MB, its own switch).
- **The desktop Survey page:** review and complete a survey and save it back in the same format: an overview (scope,
  counts, first loose ends), the seven fronts with badges, variants; answer questions, add notes, edit scope and wants
  per room, view and download the takeoff, view the sketch as a drawing (legend: existing / planned / ≈ guessed / photo
  point), attach photos, video and sound by drag and drop (matched by file name), view text readings, pairs and
  signatures, edit the placement in the embedded map, edit client fields, print the report.

#### In progress on the Survey

- **One feature-switch registry** for every Survey feature, the same switches on the phone ⚙ and the desktop page.
- **End-to-end tests** phone → package → desktop → Planner, and a cross-check of every seam.
- **The survey report from the phone** (above).

### 5.8 The Planner (PC, live; also on the phone as a web app)

Electrical installation planning for homes and commercial work: plans, rooms, devices, circuits, cable routes, wiring
and quantities, in one offline HTML file.

- **Inputs:** floor-plan scans and photos as backgrounds, project and bundle files, survey packages, phone gyro or a game
  controller.
- **Outputs:** drawings and sheets (image, vector, print to PDF), CSV and totals, QR codes, an export for Stock, and
  cable, chase and circuit quantities for the estimate.
- **Concepts:** floors and **work stages 1–6**, layers, tools per stage; a wall-elevation editor and floor / ceiling
  plane editors as one surface with projections; rooms with automatic numbering; devices, paths, cables, openings,
  notes, measures; a wiring pipeline (ghost routes, conduit / trunking, staged pulling, cable sizing, circuit codes);
  board and sub-board steps; a requirement list; a home-cinema module; views flat / 2.5D / exploded; a client
  walk-through preview (in development).
- **Controls:** a command palette (⌘K), a stage rail, an inspector and a status bar generated from one action registry;
  disabled actions show dimmed together with what they need; Esc steps out one level; a **simple mode** with its own
  corner dial (off by default).
- **Connections:** the phone relay (gyro, camera link), the USB touch display, Stock, the drawing library, the estimate
  engine, the survey import.
- **Open thread:** a chip-layout-style autorouter for wiring (rip-up and reroute, negotiated congestion, wall faces as
  layers) with a **topology view** (feeds, chains and junction boxes in room lanes, with playback) and a pass viewer.

### 5.9 Pricing, material and documents (PC)

- **Estimate workflow** (live; documents kept outside the repository): a question funnel, pricing rules and a market
  preset proven on real jobs. Stages: questions → material collection → pricing → offer → document. The client document
  is always a **budget draft** ‹Költségvetési Tervezet› (never called an "offer"): rounded amounts, a material-deposit
  clause, a quick summary, numbered sections, a total with a ±10 % band. A quantity engine works in two passes
  (quantities from the drawing, then pricing). A market-measure agent compares a finished budget with published price
  lists. Jobs are sealed to the owner's phone (§5.5).
- **Calculators** (live, phone-friendly single files): a material-price calculator for a flat renovation / board at the
  company's own prices, a general electrician's calculator, an LED-strip labour calculator (per metre, per joint, per
  power supply, per dimmer channel). They read labour price lists and a complexity-factor library.
- **Stock** ‹Készlet› (live): a vendor-neutral material database (~220 items: brand, part number, category, weight,
  barcode, datasheet; ids never reused). Screens: catalogue table (column chooser, unknowns sink, detail drawer, `/`
  search), order lists with quantities and totals, export profiles with preview, projects (import a Planner drawing and
  see what it needs on a floor diagram that colours itself from the order list), price check (load, diff, apply, log),
  QR of a list or item, data completeness. **Vendor rule:** vendor-specific data (article numbers, prices, stock) shows
  only when that vendor is selected.
- **Product-family picker** (live): a configurator for one switch-and-socket product family (mechanisms, frames, covers).
- **Parts builder** (live): hardware stock with a change log that asks for a reason on a decrease and an invoice number
  on an increase; a device builder (first click sets the base, further clicks attach nodes by bus, coloured by
  compatibility, a floating tree with a mini diagram, "done ✓" to a gallery).
- **Drawing library studio** (beta): an offline knowledge base and editor for professional electrical design packages:
  legal and standards sources, ~37 document types with a need matrix by project class and stage, sheet formats (frames,
  title block, revision table, line types, lettering, scales, layers, legend), naming conventions, ~155 symbols on a
  2.5 mm grid. Screens: *package* (class, stage, conditions → a numbered drawing register, missing mandatory sheets
  counted, an A4 drawing list), *sheet* (a true-millimetre sheet with frame, title block, revision table, a legend of
  only the symbols used, a scale bar), *symbol editor*, and a catalog page. Planned: single-line board diagrams from the
  Planner's circuits.
- **A standards document set** for smart-home systems (architecture, a rail-mounted hub and cabinet, radio, power and
  UPS, a low-voltage installation standard, a sensor catalogue).
- **Document generation** overall: budget drafts, drawing packages, the survey report, weather work-day briefs, service
  reports, export profiles, device sheets — all moving to the Paper style; one sheet = one page.

### 5.10 Map and weather (PC + phone)

- **Map** ‹Térkép› (live): an offline, keyless country map (a one-time ~1.7 GB download recorded with source, date,
  licence and size) with address search (offline first, accents optional, an online fallback row), 3D buildings,
  terrain and hillshade. Keys: `/` search · 3 buildings · T terrain · J jobs · W weather · N north · Esc. **Jobs layer:**
  pins by status (in progress / finished / failed) with an approximate-location ring and a card; density, timeline,
  previous / next job; internal only, with the client-data controls. **Weather layer:** animated fields on a 48 h
  timeline (temperature, cloud, gust bands, precipitation, radar, warnings, job risk, lightning, wind particles,
  stations). Embeddable in other tools.
- **Weather** ‹Időjárás› (beta): multi-source weather for field work. It keeps the provenance of every forecast, fuses
  sources into a consensus with uncertainty, scores each source against measurements, and turns the result into **work
  windows** and **alerts** per job site and activity (lightning, gusts for work at height, frost for PVC cable, rain,
  heat, official warnings, good days for commissioning solar). A Hungarian work-day brief at 05:40 and tomorrow's brief
  in the evening; a licence mode that shows an "evaluation" banner; a demo on invented data. Job sites leave only as
  forecast coordinates.

### 5.11 Field console and service kit

- **Field console** (beta, an installable web app): an electrician's pocket dashboard, offline, local storage. ~49 page
  definitions, 32 built (the others show a working empty state saying what they wait for): job sheet, measurement log
  with a limit table, panel schedule, site checklist, time tracking, calculators, cheat sheets, job materials, photo
  inbox; a service-command collection, macros, playbooks, help; widgets (clock, timer, notes, to-do, scientific
  calculator, unit converter, sun times, agenda, spirit level, compass, sound meter). UX: a wrap-around carousel; enable,
  disable and reorder pages; presets; **glove mode** (64 px controls, hold to confirm); a **sunlight theme**; 48 px
  minimum controls, contrast ≥ 4.5:1, reduced motion. No location, contact or camera permissions; photo metadata
  stripped.
- **Service kit** (dev): a portable Windows service kit for PC jobs (tools from official sources with hashes; a status
  dashboard; a safe-space ladder from a portable shell to a disposable sandbox; a job flow with before / after
  snapshots and a client report; step-by-step playbooks that ask before changes). Planned companions: the phone as the
  technician's console, a small touch display for when the PC's screen fails.

### 5.12 Knowledge, observability and developer tools (PC, dev level)

- **Knowledge graph** (live): one searchable graph of all the work in layers — featured, ideas, decisions, dev lines,
  agent control, runs (what AI sessions did), commits, code, documents, machine summaries — linked by shared keys.
  Agents ask it before reading files. Pages: search; **replay** (a session step by step: steps / files coloured read,
  written, error, committed / the lit nodes); **connectome** (the graph drawn as a brain, live firing); **holo** (four
  3D forms); **layers** (an exploded isometric stack); **ideas river** (idea lineage over time with a scrubber); commit
  pixels; a **decision inbox** (every open question ranked by what it blocks; the A/B/C buttons write nothing, they copy
  a ready prompt); a **line map** (dev lines as metro tracks, sessions as stations, a quiet stretch over 5 days in red);
  a run log; a **control room** (the agent council as a flow); a thread board.
- **Code city** (beta): the repository as a 3D city (district = folder, footprint = lines, height = commits, lit windows
  = recent activity, a crane = churn, a ruin = untouched for two years), colour lenses (language, age, churn, owner, agent
  share), a time replay, a live mode, a desktop overlay.
- **Consistency sphere** (beta): three signals over the documentation — **contradiction** (the only red: two pulsing
  dots and an arc), **dark zone** (gaps: unanswered questions, missing references; a sand ring), **frozen** (dormant or
  fallen behind; a dotted ring). A ladder: a script quotes, an intern agent judges one section, only the owner rules.
- **Signal ring board** (beta): the brand ring as a notification board; each open signal is a peak; click → *enter*
  (copies a hand-off prompt for another session), *dev note* (takes it off the ring), *ignore* (with a reason).
- **Session canvas** (beta): a live drawing of an AI coding session written left to right by a "pen": lanes for prompts,
  replies, tool calls by kind, background jobs, sub-agents with ETAs, a band of tokens and context fill; idle stretches
  fold into zigzags; live / replay / demo; masking toggle.
- **Agent trace** (beta): session states *working* / *waiting for you* (permission, question, plan) / *in background* /
  *done, your turn*; an 8-bit chime after 5 s and a phone notice after 30 s if the state still holds; an optional gate
  to approve tools from the page.
- **Archive** (beta): one container for every one-shot interactive page the AI made (tool, explainer, mockup, board,
  game, manual, study, dashboard, design), each with title, link, kind, date, summary, purpose and context; own work
  first, newest first.
- **Mind map** (live): a linked note canvas with layers, frames and a board view; opens the work maps (ideas timeline,
  git-history topology, features map).
- **Vendor page** (live): pinned third-party components with integrity checks.

### 5.13 Agents and automation

- The owner works with **AI coding agents** organised as roles: a lead coordinator (routes requests, guards the budget,
  keeps the record), department heads (design engineering, finance and contracts, operations engineering), contractors
  (builder of one prepared work package, independent verifier who tries to break finished work, researcher, blueprint
  keeper, market-price measurer) and workers (locator, check runner, round closer, data extractor, intern).
- Work runs in **parallel forks**: each on its own branch, never the main branch; the coordinator merges. Each fork ends
  every message with a **progress line** (steps as nodes, done coloured, the current one ringed, n/m) and collects
  questions at the end as numbered options, recommended first, Hungarian first, each with a one-line plain summary.
- **Runbooks:** a session started with a short codephrase reads one briefing file and follows it.
- **Decision records:** every work line keeps a decisions file of numbered questions with options and the one taken; the
  decision inbox aggregates them.
- **A prompt library** (pick one → shown and copied), an embedded terminal for the AI assistant, context packs.
- **Guard rails:** never push the main branch, never force, never commit client data or secrets, never type a password;
  tests are the gate; a check script fails a commit when a registry is out of date.

### 5.14 Small devices (dev)

- **Touch display beside the Planner:** pages for start (macro sets), status (project, level, stage, tool, layer,
  selection, errors), totals, clock (idle), tools of the current stage as buttons, stages, control (undo, redo, Esc,
  level up / down, 2D / 3D, save), twelve macros; LED and banner events; automatic page switching on stage change and
  idle.
- **Board console:** a control page for a universal development board: connector panel and pinout views, each pin ringed
  used / free / conflict / reserved, generated pin header, a firmware library and an offline flasher.
- **Knob pad:** three rotary encoders as a USB keyboard / mouse / media device with a configuration page.

---

## 6. Status at a glance

| Status | Items |
|---|---|
| Live | Planner, calculators, Stock, product picker, parts builder, mind map, map, knowledge graph, text launcher, backup, commit guard, UI kit; on the phone: settings, pairing, account, update, progress, quick note, local servers, remote launcher, handover, sphere |
| Beta | desktop shell, drawing library studio, **Survey instrument**, archive, field console, weather, gate page, code city, sphere board, signal board, session canvas, agent trace; on the phone: home, sheets, devices, iPhone web app, notifications, screen, PC files, AI sessions, apps, estimate workflow, map, vault, crew pager |
| In progress | the Survey's switch registry, end-to-end tests, the report from the phone |
| Planned | portable USB build, weather on the phone, a push service, a home-screen widget, the Planner's live site mode, barcode intake into Stock, a note that becomes an AI task |

---

## 7. What a designer must carry over (checklist)

- **State vocabulary:** existing vs planned · measured / derived / ≈ guessed · ⚑ open decision or loose end · ● new ·
  have / need counts · offline + date · live / beta / planned stage badges · the status ring's seven states · delivery
  green / amber / red · the PC's "being watched" notice.
- **Control layers:** tap (primary) → hold-and-swipe wheel (8 sectors, rings) → long-press context menu → tool options
  row → settings with per-feature switches and "all on / off". Quick capture (✎ ◉) on every front; "+ again" after a
  shot; ghost suggestions (tap accept, swipe dismiss); tap the active tool again to swap back; directional swipe from a
  photo point; two-finger pan / pinch always available; hold-to-call keys and volume keys on the pager.
- **Moments:** standing on site, one hand, gloves, sun, a talking client, interruptions; at the desk, keyboard-first on a
  big screen; on the couch steering the PC; in a stairwell paging the crew.
- **Never lose data**, never block a front, never require order.
- **Privacy is visible:** badges for personal data, "removed on export" pills, the GPS-keep switch, the PC's watch notice.

## 8. Glossary

| Term | Meaning |
|---|---|
| Front | one of the Survey's seven top-level work areas, a symbol + colour |
| Capture | any self-standing record: note, chip fact, answer, photo, size, point |
| Room in focus | the last room touched on the sketch; new notes and photos attach to it |
| Digital shadow | the questions and shot-list items computed from what has been captured so far |
| Loose end | anything the derived "open" list shows |
| Chip | a one-tap fact or tag that replaces typing |
| Ghost card | a background suggestion waiting to be accepted or swiped away |
| Variant | a data overlay that reshapes the Survey for one kind of job |
| Takeoff | work items with quantities derived from a survey, without prices |
| Package | a self-describing file that moves a survey between devices |
| Handover board | the two-way file board between phone and PC |
| Relay | the one process through which the phone reaches the PC |
| Catalog | the registry of what exists, with type, level, group, status |
| Level | user / dev / all: a filter of what is shown |
| Sheet | a grid of non-overlapping windows on the desktop or the phone |
| Long-press menu | the toolset's right-click menu, on touch a long press |
| Budget draft | the client-facing priced document |
