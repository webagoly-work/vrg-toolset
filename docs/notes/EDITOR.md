# VRG MindMD — our own Markdown editor beside Jegyzetek, and the plugin map

*2026-11-11. Companion to [ANALYSIS.md](ANALYSIS.md) (the 99 modules) and [SIMPLE.md](SIMPLE.md) (the surface rules).
Hungarian version: [EDITOR.hu.md](EDITOR.hu.md); fix both together. Analysis only, nothing built.*

*The plugin survey is from general knowledge of the Obsidian community catalogue as of mid-2026 (the long-standing most
downloaded plugins and the generally useful ones), not a fresh sweep; check a plugin's current state before relying on a detail.
Plugin names belong to their authors. "In a similar vein, without copying" here means: **compatible file formats, our own code**.
Obsidian itself is closed source; most community plugins are MIT, and if any of their code is ever adapted, its copyright notice
travels with it (repo rule, CLAUDE.md "Vendored third-party code").*

Contents: §1 what the editor is · §2 the plugin map · §3 how a plugin would work in our system · §4 the meshed module list ·
§5 the extension architecture · §6 compatibility with Obsidian vaults · §7 decisions · §8 build order.

---

## 1. What the editor is, and how it relates to Jegyzetek

**One engine, two front ends.**

| | **VRG Jegyzetek** | **VRG MindMD** (the editor) |
|---|---|---|
| Purpose | capture and keep notes, on the phone and the PC | write, link and organise Markdown: documentation, job dossiers, knowledge, long texts |
| First principle | simple surface first, features in slots ([SIMPLE.md](SIMPLE.md)) | a workspace: file tree, tabs, split panes, side panels, command palette |
| Opens | the Jegyzetek vault | **any folder of Markdown**: the Jegyzetek vault, a job folder, the repo's `docs/`, an Obsidian vault |
| Platforms | PC + phone | PC (Desktop shell, `vrg-app://`); phone only as a reader later |
| Shares | `shared/notes-core` (parse, links, merge, search, visibility), `shared/notes-editor` (CodeMirror 6), the vault service, the slot registry, every extension | the same |

Why it is worth having beside Jegyzetek, specifically in VRG:

- **The repository is already a Markdown knowledge base**: `GO-*.md`, `DECISIONS`, `docs/` (216 files), `DEVLOG.md`, job
  folders with offers and notes. Today they are edited in VS Code. MindMD opens the repo as a vault with *dev* visibility,
  git-aware (§4.6), with `[[F:…]]`-style links into the Stack.
- **The ancestor exists**: `MindMap/varler_mindmd2.html` ("Varler MindMD — kapcsolt jegyzetvászon", idea `I:r0`) already does
  wikilinks and a linked note canvas on `marked`. MindMD the editor keeps the name and the canvas idea and is rebuilt on the
  shared core (ED-Q02).
- **Extensions are written once.** An extension declares where it can appear; in Jegyzetek it only gets the slots of
  SIMPLE.md §3.2, in MindMD it may also open panels and status-bar items. One codebase, two strictnesses.

---

## 2. The plugin map

Verdict: **✔** we already have it as a module · **◐** partly; our module needs extending · **＋** new module (§4) ·
**◇** a core feature of the editor, not an extension · **✖** not wanted, with the reason.

### 2.1 Data, queries and properties

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Dataview / Datacore | queries over frontmatter and inline fields, rendered as tables, lists, task lists; JS queries | N-SMART, N-TYPE | ＋ **N-QUERY** (a safe query language, no JS) |
| Bases (core since 2025) | database views (table, cards) over properties, saved as `.base` files | N-SMART, N-BOARD | ＋ part of **N-QUERY** (views) |
| Metadata Menu | typed fields per note class, field editors, autocompletion of values | N-TYPE | ◐ N-TYPE gains field types and editors |
| Projects | table / board / calendar / gallery over a folder | N-BOARD, N-CAL | ◐ via N-QUERY views |
| Database Folder | a folder as a table | — | ◐ via N-QUERY |
| Tag Wrangler | rename, merge, nest tags everywhere | N-TAG | ✔ (rename everywhere is in N-TAG) |

### 2.2 Templates and capture

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Templater | templates with variables, dates, prompts, JS | N-TYPE | ＋ **N-TPL** (variables, dates, prompts; no JS) |
| QuickAdd | capture macros: "append to note X under heading Y", choices, chained actions | N-ACTIONS, N-INBOX | ◐ N-ACTIONS gains *capture to* targets |
| Periodic Notes | daily, weekly, monthly, quarterly notes from templates | N-DAILY | ＋ **N-PERIODIC** (weekly / monthly on top of N-DAILY) |
| Natural Language Dates | `@holnap`, "next Friday" → a date link | N-TASK | ＋ **N-NLDATE** (Hungarian date words; shared by N-TASK, N-REMIND, N-TPL) |
| Web Clipper (official) | browser extension → Markdown note with properties | N-CLIP | ✔ |
| Importer (official) | Evernote, Notion, Apple Notes, Keep, OneNote … → Markdown | N-IMPORT | ✔ |

### 2.3 Writing and editing

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Advanced Tables | Tab between cells, auto-align, formulas, sort | N-TABLE | ◐ N-TABLE gains column formulas (sums of measured values) |
| Outliner | move list items with keys, fold, zoom into a branch, better list editing | — | ＋ **N-OUTLINE** |
| Various Complements / Completr | autocomplete words, links, tags, front-matter values from the vault | N-LINK (links only) | ＋ **N-COMPLETE** |
| Linter | format on save: headings, spacing, YAML order, list markers | — | ＋ **N-LINT** (as a command, or on save with a version kept: R8) |
| Smart Typography / Typewriter | smart quotes, dashes, ellipses; focus line | N-FOCUS | ＋ **N-TYPO** (Hungarian „ ” and » « quotes, en dash, thin spaces in `3 × 16 A`) |
| Editing Toolbar | a formatting toolbar | N-SLASH | ◇ MindMD has an optional bar; Jegyzetek keeps the insert sheet (S5) |
| Highlightr | coloured highlights | — | ◐ part of N-EDIT (`==text==` plus one colour attribute) |
| Better Word Count / Novel Word Count | counts per selection, note, folder | N-EDIT | ◇ status bar in MindMD |
| Longform | a manuscript made of many notes, ordered, compiled | N-EXPORT | ＋ **N-LONGFORM** (handbooks, job dossiers, the VRG documentation) |
| Auto Link Title / Paste URL into selection | pasted URL becomes `[title](url)` | — | ＋ **N-PASTE** (smart paste: URL title, table from Excel, image handling; network only with a declared capability) |
| Image Converter / Paste image rename | compress, resize, rename pasted images, convert to WebP/JPEG | N-ATT | ＋ **N-IMG** (important for site photos: size budget, EXIF/GPS strip or keep by visibility) |
| Code block enhancers (Code Styler) | line numbers, titles, copy button | N-CODE | ✔ |

### 2.4 Navigation and structure

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Hover Editor / Page Preview (core) | preview or edit a linked note in a floating window | N-LINK | ＋ **N-HOVER** |
| Folder Notes | a folder has an index note that opens when the folder is clicked | N-FOLDER | ＋ **N-FOLDERNOTE** (a job folder's dossier page) |
| Breadcrumbs | hierarchy and sequence fields (`up:`, `next:`) with navigation | — | ＋ **N-TRAIL** |
| Homepage | open a chosen note or view at start | N-DAILY | ◇ a MindMD setting; Jegyzetek always opens the list |
| Recent Files, Bookmarks (core) | recently opened, starred notes and searches | N-PIN, N-SMART | ✔ |
| Iconize / Icon Folder | icons and colours on folders and notes | N-PIN (colours) | ◐ icons from the VRG UI Kit set only |
| Workspaces (core), Stacked tabs | saved pane layouts | — | ◇ MindMD core |
| Omnisearch | fuzzy full-text search incl. PDFs and OCR | N-FIND, N-OCR | ✔ |
| Waypoint / MOC tools | auto-generated table of contents for a folder | N-FOLDERNOTE | ◐ a folder note can embed an N-QUERY list |

### 2.5 Tasks and time

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Tasks | `- [ ] … 📅 2026-11-14 🔁 every week`, task queries across the vault, done dates | N-TASK | ◐ N-TASK adopts the same emoji format (compatibility, §6); queries via N-QUERY |
| Kanban | a board stored as a Markdown file | N-BOARD | ◐ N-BOARD stores boards as Markdown in the same shape |
| Calendar, Full Calendar, Day Planner | month view of daily notes; events in notes; a day timeline | N-CAL | ◐ N-CAL gains a day timeline (the site day) |
| Reminder | notifications for dated tasks | N-REMIND | ✔ |

### 2.6 Visual thinking

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Canvas (core, JSON Canvas) | cards, notes, links on an infinite board | N-CANVAS | ✔ (MindMD's canvas, JSON Canvas format) |
| Excalidraw | hand-drawn-style sketches stored in Markdown, embeddable | N-INK | ＋ **N-SKETCH** (vector sketch: a quick wiring or cabinet sketch; Excalidraw is MIT and vendorable, ED-Q06) |
| Mind Map / Markmind | a heading tree shown as a mind map | MindMap | ✔ (the MindMap tool; MindMD renders a note as a map) |
| Charts / Obsidian Charts | charts from code blocks or tables | — | ＋ **N-CHART** (from measurement tables, e.g. insulation resistance per circuit) |
| Mermaid (core) | diagrams | N-DIAG | ✔ |
| Graph (core), ExcaliBrain, Juggl | link graphs | N-GRAPH, Stack | ✔ |

### 2.7 Media and PDF

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| PDF++ / Annotator | highlight PDFs, link to a passage, comments back in Markdown | N-PDF | ✔ (datasheets, standards, offers) |
| Media Extended | audio / video with timestamp links | N-VOICE | ◐ N-VOICE gains timestamp links (`[[memo.m4a#t=1:32]]`) |
| Text Extractor | OCR of images and PDFs | N-OCR | ✔ |
| Audio Recorder (core) | record into a note | N-VOICE | ✔ |

### 2.8 Sync, backup, version control

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Obsidian Git | the vault as a git repo, auto-commit / pull / push, history, diff | N-HIST, NOTES-Q04 | ＋ **N-GIT** (local commits; push only to the backup remote or, for a *dev* vault, by the repo's own rules) |
| Remotely Save, Self-hosted LiveSync, Sync (official) | sync to S3/WebDAV/CouchDB, E2E | N-SYNC-* | ✔ (our relay + encrypted bundles) |
| File Recovery (core) | snapshots | N-HIST | ✔ |

### 2.9 Export and publishing

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Pandoc / Enhancing Export | DOCX, PDF, LaTeX, ePub via Pandoc | N-EXPORT | ◐ DOCX through Pandoc as an *optional external program* (GPL binary, never vendored into our code) |
| Better Export PDF | PDF with headers, TOC, page numbers | N-REPORT | ✔ (Varler document style) |
| Digital Garden / Quartz / Publish | publish notes as a website | — | ✖ (no public publishing; SIMPLE/ANALYSIS) |

### 2.10 Automation and integration

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Advanced URI | open, create, append, search through `obsidian://` links | N-LINKS | ✔ (`vrg://notes/…`) |
| Commander | add commands to toolbars and menus | — | ◇ MindMD: user-arranged toolbar; never in Jegyzetek (R3) |
| Shell Commands | run shell commands from notes | — | ✖ (arbitrary execution; a note may instead name a START act, which the shell already runs under its own rules) |
| Execute Code | run code blocks | — | ✖ (same reason) |
| Local REST API, MCP Tools | HTTP / MCP access to the vault for scripts and AI agents | N-CLI, N-STACK | ＋ **N-MCP** (read-only tools for Claude sessions through the vrg-stack MCP, visibility enforced) |

### 2.11 AI

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Smart Connections | local embeddings, related notes, chat over the vault | N-SEM, N-AI-ASK | ＋ **N-RELATED** (a "related notes" panel; Jegyzetek: one chip at most) |
| Copilot, Text Generator | chat, rewrite, generate from prompts | N-AI-* | ✔ (tier 3, behind a switch, never on *private*) |

### 2.12 Look

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Style Settings, themes, CSS snippets | change the look through variables and CSS | VRG UI Kit | ＋ **N-THEME** (Mélyvíz variables, density, font; no free CSS from notes) |
| Banners, Pretty Properties | header images, property styling | — | ✖ (decoration; properties are shown as chips) |
| Minimal Theme Settings | layout tweaks | N-FOCUS | ◇ |

### 2.13 Learning

| Plugin | What it does | Ours | Verdict |
|---|---|---|---|
| Spaced Repetition, Anki sync | flashcards from notes | — | ✖ for now (possible later for training an apprentice on standards; not a notes need) |
| Zotero Integration, Citations | academic references | — | ✖ (datasheets and standards are linked as files and PDFs) |

### 2.14 What our list has that no plugin has

N-JOB, N-PLANPIN, N-SITE, N-MEAS, N-DIARY, N-REPORT (Varler style), N-XLINK and N-STACK (links into the VRG work graph), N-DEV
and N-COMMIT (dev notes into Divergence and commits), N-VIS (four visibility levels enforced by every outlet), N-SECRET (client
data guard), N-SYNC-LAN (phone ↔ PC over the paired relay), Simple mode with a slot budget, the Engine log with undo. The
market's plugins are about *knowledge*; ours are about *jobs*. The mesh keeps both.

---

## 3. How a plugin would work in our system

### 3.1 The difference that matters

An Obsidian community plugin is JavaScript loaded into the app with the **full app API and, on desktop, Node and Electron**: it
can read and write any file, reach the network, patch other code, and change any part of the UI. Updates arrive from the plugin's
own repository. That freedom is why there are thousands of plugins, and why each one is a trust decision.

Ours is the opposite trade:

| | Obsidian community plugin | VRG extension (*kiegészítő*) |
|---|---|---|
| Where it runs | the app process, with Node on desktop | the page (renderer) only; no Node, no `require`, no shell |
| Files | any path | the vault service API, by note id, through the visibility filter |
| Network | anything | only hosts listed in the manifest, through the shell's fetch; none by default |
| UI | anywhere, any DOM | declared extension points only (§3.2); in Jegyzetek only the SIMPLE slots |
| Private notes | readable | never handed over unless the manifest asks for `private` and the user grants it |
| Changes to content | silent | through the vault service, logged to the Engine log, undoable (R7, R8) |
| Distribution | a community catalogue, updates on the author's schedule | first-party in the repo, or vendored by `vendor-manifest.json` with an exact version and sha512; no runtime catalogue |
| Review | at submission | every change is a repo change, tested like the rest |

### 3.2 Extension points (our equivalent of the plugin API)

| Obsidian API concept | Our extension point | MindMD | Jegyzetek slot |
|---|---|---|---|
| `addCommand` | `commands` | palette, keys, toolbar | `…` menu (S4) |
| `registerMarkdownCodeBlockProcessor` | `codeblock` (e.g. ` ```lekérdezés `) | rendered in reading and live view | rendered in the note (inside the body: no slot cost) |
| `registerMarkdownPostProcessor` | `render` (transform rendered HTML, sanitised after) | yes | yes |
| `registerEditorExtension` (CM6) | `editor` (a CodeMirror 6 extension) | yes | only *quiet* ones (no new UI): autocomplete, smart typography |
| `registerEditorSuggest` | `suggest` (`[[`, `#`, `@`, `/`) | yes | yes (it is typing help, not a slot) |
| `registerView` | `panel` (side panel or tab) | yes | ✖, or a *visit* (R4) |
| `addStatusBarItem` | `status` | yes | ✖ (the one status dot belongs to sync) |
| `addRibbonIcon` | — | MindMD toolbar via Commander-style settings | ✖ |
| file-menu / editor-menu events | `menu` | context menus | `…` menu (S4) |
| `addSettingTab` | `settings` | one page per extension | one row in Funkciók (S9) |
| vault events (`create`, `modify`, `rename`) | `on` events | yes | yes |
| — (no equivalent) | `job` (a background engine job with a log entry and undo) | yes | the engine room |
| — | `chip` (a chip provider with priority) | in the properties panel | S1, S2 |
| — | `folder` (a smart folder provider) | file tree section | S7 |
| — | `field` (a property type: date, job, money, circuit, measurement) | properties panel | chips / note type forms |
| — | `import` / `export` (a format) | yes | `…` menu |

---

## 4. The meshed module list (new modules)

These extend ANALYSIS.md §6 (99 modules) to **121**. Host: **J** Jegyzetek, **E** MindMD, **J+E** both. *Jegyzetek footprint*
uses SIMPLE.md §5.

### 4.1 Writing

| ID | Module | What it is | Tier | Host | Jegyzetek footprint | From |
|---|---|---|---|---|---|---|
| N-OUTLINE | Outliner | move list items and branches with keys, fold, zoom into a branch, list-aware Enter / Tab | 2 | J+E | engine (keys only) | Outliner |
| N-COMPLETE | Autocomplete | words, links, tags, people, jobs and property values from the vault, Hungarian-aware | 2 | J+E | none (typing help) | Various Complements |
| N-LINT | Formatter | normalise headings, lists, spacing, YAML order; as a command, or on save keeping a version | 2 | E (+J command) | `…` menu | Linter |
| N-TYPO | Hungarian typography | „ ” and » « quotes, en dash, ellipsis, non-breaking space in `3 × 16 A`, `30 mA` | 2 | J+E | engine | Smart Typography |
| N-PASTE | Smart paste | URL → `[title](url)` (network capability), Excel / CSV → table, HTML → clean Markdown, image → N-IMG | 1 | J+E | none | Auto Link Title, Paste URL |
| N-IMG | Image handling | resize, compress, rename by note and time, keep or strip EXIF / GPS by visibility | 1 | J+E | engine | Image Converter |
| N-LONGFORM | Manuscripts | an ordered set of notes compiled into one document (handbook, job dossier) → N-EXPORT / N-REPORT | 3 | E | — | Longform |

### 4.2 Structure and data

| ID | Module | What it is | Tier | Host | Jegyzetek footprint | From |
|---|---|---|---|---|---|---|
| N-QUERY | Queries and views | a safe query block (§5.3) and saved views: table, list, task list, board, calendar, cards, over properties, tags, links, tasks | 2 | E (+J results) | inside the body; saved views as folders (S7) | Dataview, Bases |
| N-TPL | Templates | variables (`{{dátum}}`, `{{munka}}`, `{{kérdés: Ügyfél?}}`), date maths, cursor position; no code | 1 | J+E | hold + (S6) | Templater |
| N-PERIODIC | Periodic notes | weekly, monthly notes from templates; the week of a job | 3 | J+E | folders (S7) | Periodic Notes |
| N-NLDATE | Hungarian dates | `holnap`, `jövő kedd`, `nov. 14`, `2 hét múlva` → dates, for tasks, reminders, templates, search | 1 | J+E | engine | Natural Language Dates |
| N-FOLDERNOTE | Folder notes | a folder's own index note; a job folder opens on its dossier page | 2 | J+E | folders (S7) | Folder Notes |
| N-TRAIL | Hierarchy and sequence | `fel:` / `következő:` properties, breadcrumbs, prev / next | 3 | E | — | Breadcrumbs |
| N-HOVER | Hover preview | preview and edit a linked note in a floating window | 2 | E | — | Hover Editor |
| N-RELATED | Related notes | local similarity (shared links, tags, words; embeddings later) in a panel | 3 | E (+J one chip) | chip (S2) | Smart Connections |

### 4.3 Visual and media

| ID | Module | What it is | Tier | Host | Jegyzetek footprint | From |
|---|---|---|---|---|---|---|
| N-SKETCH | Vector sketch | quick sketches (cabinet layout, a wiring idea) stored beside the note, embeddable; phone pen, PC mouse | 3 | J+E | insert (S5) | Excalidraw |
| N-CHART | Charts | charts from a table or a query (measurement series, hours per job) | 3 | E (+J render) | inside the body | Charts |

### 4.4 Platform

| ID | Module | What it is | Tier | Host | Jegyzetek footprint | From |
|---|---|---|---|---|---|---|
| N-EXT | Extension host | manifest, capabilities, extension points (§3.2), the visibility filter for extensions, per-extension settings, the test harness | 0 | J+E | — (it is how slots get filled) | the plugin API |
| N-WORKSPACE | MindMD workspace | file tree, tabs, split panes, side panels, saved layouts, open any folder as a vault | 1 | E | — | core |
| N-GIT | Git vault | the vault as a local repo: auto-commit on idle, history and diff in the editor, push only to the allowed remote (§4.6) | 2 | E (+J history) | `…` menu → history | Obsidian Git |
| N-MCP | Agent access | read-only MCP tools (`notes_search`, `notes_get`) through the vrg-stack server, visibility enforced, every read in the audit log | 3 | E | engine | Local REST API, MCP Tools |
| N-THEME | Look settings | Mélyvíz variables, density, fonts, reading width; no free CSS | 2 | J+E | settings (S9) | Style Settings |

### 4.5 Existing modules that grow

N-TYPE (field types and editors, from Metadata Menu) · N-ACTIONS (*capture to* targets, from QuickAdd) · N-TABLE (column
formulas) · N-TASK (Tasks emoji format, recurrence) · N-BOARD (Markdown-stored boards, Kanban format) · N-CAL (day timeline) ·
N-VOICE (timestamp links) · N-EXPORT (DOCX through an optional external Pandoc) · N-EDIT (`==highlight==`, word count).

### 4.6 The git rule for MindMD vaults

| Vault | Commits | Push |
|---|---|---|
| Jegyzetek vault (client data) | local, on idle | only to `Backup\code\jegyzetek.git`; never `origin`; `vrg-git` launcher-collect skips it (NOTES-Q04) |
| The repo opened as a vault (*dev*) | never automatic; MindMD shows the diff, the user commits through the existing git pane | the repo's rules (`launcher-collect`, never `--force`) |
| A job folder | local, on idle, if the user turns N-GIT on for it | backup remote only |

---

## 5. The extension architecture

### 5.1 A manifest

```json
{
  "id": "query",
  "name": { "hu": "Lekérdezések", "en": "Queries" },
  "version": "1.0.0",
  "hosts": ["mindmd", "jegyzetek"],
  "capabilities": ["vault.read"],
  "visibility": ["internal", "dev"],
  "points": {
    "codeblock": ["lekérdezés", "query"],
    "folder": true,
    "settings": true
  },
  "jegyzetek": { "footprint": "folder", "behaviour": { "csendes": "background" } }
}
```

Capabilities: `vault.read`, `vault.write` (through the vault service, logged), `net:<host>` (each host listed), `clipboard`,
`notify`. There is no `fs`, no `shell`, no `eval`. `visibility` lists which notes the extension may see; `private` must be
asked for and granted by the user per extension.

### 5.2 Where extensions live

`shared/notes-ext/<id>/` (manifest, `index.js`, `test/`, fixtures). First-party ones are ordinary repo code. A third-party one is
**vendored** (exact version + sha512 in `vendor-manifest.json`), wrapped in a manifest by us, reviewed and tested like our own.
Nothing is downloaded at run time. Each extension ships fixtures that the shared golden tests run, and the SIMPLE snap-back test
runs with every extension on.

### 5.3 The query language (N-QUERY)

Readable, Hungarian and English keywords, no code, so a query can never do more than read:

````markdown
```lekérdezés
TÁBLA cím, munka, határidő
HONNAN #mérés
HOL munka = "Lakatos u. 12" ÉS NEM kész
RENDEZ határidő
```
````

The same in English keywords: `TABLE … FROM … WHERE … AND NOT done SORT …`. The simple Dataview forms (`TABLE`, `LIST`,
`TASK`, `FROM #tag`, `WHERE`, `SORT`) read the same, so a query in an imported Obsidian vault mostly keeps working; JS queries
(`dataviewjs`) are shown as code, never run.

---

## 6. Compatibility with Obsidian vaults

The formats are open, so MindMD can open an Obsidian vault and Obsidian can open ours, while every line of code is our own:

| Format | Shared |
|---|---|
| Markdown + YAML frontmatter, property names | ✔ |
| `[[wikilinks]]`, `[[note#heading]]`, `[[note#^block]]`, `![[embeds]]`, aliases | ✔ |
| Callouts `> [!note]` | ✔ |
| Tags `#a/b` inline and in `tags:` | ✔ |
| Tasks emoji format `📅 ⏳ 🔁 ✅` | ✔ |
| JSON Canvas `.canvas` | ✔ |
| Kanban boards as Markdown | ✔ (same shape) |
| Excalidraw `.excalidraw.md` | ◐ read later, if N-SKETCH vendors Excalidraw |
| `.obsidian/` settings and plugins | ✖ ignored, never executed |
| Our extras | `id`, `rev`, `base`, `visibility`, `job` frontmatter fields: harmless in Obsidian; attachments under `att/sha256/` resolve as normal paths |

---

## 7. Open decisions (A = recommended default)

| # | Question | A (recommended) | B / C |
|---|---|---|---|
| ED-Q01 | Name | **VRG MindMD** (keeps the existing name and idea `I:r0`) | B VRG Írás · C a new name |
| ED-Q02 | Code base | **rebuilt on `shared/notes-core` + `notes-editor`; the old `varler_mindmd2.html` canvas reused as N-CANVAS's starting point** | B grow `varler_mindmd2.html` as it is |
| ED-Q03 | Third-party extensions | **vendored and wrapped only; no run-time catalogue** | B a curated catalogue later, still pinned |
| ED-Q04 | Query language | **our own safe language with HU + EN keywords, reading simple Dataview queries** | B Dataview syntax only · C no queries, only saved searches |
| ED-Q05 | Opening the repo as a vault | **yes, as *dev*, git-aware, no auto-commit** | B only separate vaults |
| ED-Q06 | Sketches | **N-SKETCH by vendoring Excalidraw (MIT) at tier 3** | B our own small vector sketch · C N-INK only |
| ED-Q07 | Phone | **MindMD is PC only; the phone reads its notes through Jegyzetek** | B a MindMD phone reader |
| ED-Q08 | Pandoc | **optional external program for DOCX, detected, never bundled** | B no DOCX |

---

## 8. Build order (after Jegyzetek NT0–NT1, which build the shared core)

1. **E1 — the workspace:** N-EXT, N-WORKSPACE, N-PASTE, N-IMG, N-NLDATE, N-TPL. Open any folder; tabs, panes, palette;
   extensions load through the host. Registered in `vrg-menu.json` + `vrg-catalog.json` like any tool.
2. **E2 — knowledge:** N-QUERY, N-FOLDERNOTE, N-HOVER, N-COMPLETE, N-OUTLINE, N-LINT, N-TYPO, N-GIT, N-THEME.
3. **E3 — visual and reach:** N-CANVAS (from the old MindMD), N-CHART, N-SKETCH, N-RELATED, N-TRAIL, N-PERIODIC,
   N-LONGFORM, N-MCP.

Jegyzetek gets each extension the moment its Jegyzetek footprint is defined and tested against the slot budget.
