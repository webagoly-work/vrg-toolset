# VRG Jegyzetek (VRG Notes) — market analysis and modular feature list

*Preparation for a built-in notes app in VRG Asztal (VRG Desktop) and VRG Mobile. 2026-11-10. Analysis only: nothing is built,
nothing is registered in `launcher/vrg-menu.json` or `vrg-catalog.json` yet. The market survey is from general knowledge of the
products as of mid-2026, not a fresh web sweep; product details change often, so re-check a named feature before copying it.*

*Hungarian version: [ANALYSIS.hu.md](ANALYSIS.hu.md); fix both together. The interactive module picker (bilingual):
https://claude.ai/artifact/V68RVT9rfxZPQgZj1ChdBb*

*Read [SIMPLE.md](SIMPLE.md) first: the simple surface, the slots and the engine room that every module below must fit.
It moves N-FOLDER to tier 1 and adds N-SIMPLE, N-ENGINELOG and N-SKIN (§6.13), so the list now has 99 modules.
[EDITOR.md](EDITOR.md) maps the Obsidian plugins onto this list and adds 22 more for the MindMD editor (121 in all).*

Contents: §1 what VRG already has · §2 the market · §3 what a note can be beyond a text box · §4 what fits VRG · §5 the backend
(storage, sync, security, fallback) · §6 the modular feature list · §7 open decisions · §8 a build order.

---

## 1. What VRG already has (the starting point)

There is no notes *app* yet, but there are two **write-only note paths** and most of the plumbing a notes app needs.

| Piece | Where | What it does today | Use for Notes |
|---|---|---|---|
| **Gyorsjegyzet** (Mobile M6, LIVE) | `Mobile/android/feature-notes`, `kit-core/Notes.kt` | text + 🎤 hu-HU dictation + tag chips → one line appended to `log/YYYY-MM-DD.md` on the `mobile-log` branch via GitHub; offline outbox (WorkManager), id marker so a retry lands once, share target, `vrg://notes/new?text=…` | the phone's capture surface; the outbox and the append-with-retry logic are reusable as they are |
| **Fejlesztői jegyzet** (Desktop WP-25) | `Dashboard/shell/lib/notes.js`, `Dashboard/page/panes/note.js` | "save as dev note" from any pane (source kinds `url`, `file`, `node`, `term`, `chat`) → Divergence outbox → `vrg-devnotes` branch on the next Push | the Desktop's capture dialog and the *source* idea (a note knows where it came from) |
| **Phone ↔ PC relay** (M2, M7) | `kit/relay`, `relay-core`, `Mobile/tests/relay-*.js` | QR pairing, P-256 device keys, signed messages, trust gate; the phone can be the relay too | LAN sync with no cloud, already authenticated |
| **Átadás** (M12) | `feature-drop`, `Drop.kt` | file board: photos and files phone → PC, size + checksum checked, clipboard | attachments (site photos) |
| **Secrets** | Desktop `shell/lib/secrets.js` (safeStorage = DPAPI, tmp + rename), Mobile `SecretStore` (Keystore AES), `PhoneKey` (Keystore P-256) | encrypted key storage on both sides, never plain-text fallback | the vault key, sync keys |
| **`vrg-app://` scheme** (DESKU-Q08) | `shell/lib/appscheme.js` | in-shell HTML apps on a real origin, confined to their folder + `shared/` | the Notes UI as an in-shell app |
| **Palette, search, Stack** | `shell/lib/palette.js`, `search.js`, `innersearch.js`, `Stack/` | command palette, file + inner search, the multilayer graph of the work | find notes; notes as a Stack layer; links to Stack nodes |
| **MindMap / Varler MindMD** | `MindMap/` (idea `I:r0` "Kapcsolt jegyzetvászon", a linked note canvas) | the ancestor of a note canvas | the canvas / graph view of notes |
| **BACKUP** | `launcher/backup.ps1` | git bare backups per repo + work folders mirrored, nothing overwritten without an archived copy, re-hash manifest | the vault's backup comes almost free |
| **VRG UI Kit / Mélyvíz** | `shared/vrg-ui-kit`, `kit/theme` (generated Kotlin tokens) | one look on PC and phone | the Notes look |
| **Értesítések** (M10) | `feature-inbox`, `VrgNotify` | phone notifications with channels | reminders |

**The gap:** nothing can *read back, edit, organise or search* notes; the two paths write into two different git branches in two
formats; nothing ties a note to a job, a Planner element or an inventory item; and client details would land on GitHub in plain text
if a phone note named a client (the `mobile-log` branch is on `origin`). §5 fixes the last point first.

---

## 2. The market

Grouped by what the product is *for*. "Take" is what is worth borrowing for VRG.

### 2.1 Built into an OS or a device

| Product | Platforms · storage | Stand-out features | Take |
|---|---|---|---|
| **Apple Notes** | Apple only · iCloud | folders + tags + smart folders, checklists, tables, scan documents with OCR, PencilKit ink, locked notes (password / Face ID), shared notes and folders, quick note from any screen corner, audio recording with transcription, Math Notes, links between notes | quick note from anywhere; locked notes; smart folders; scan → searchable |
| **Google Keep** | Android, web · Google | card grid, colours + labels, pin, checklists, reminders, drawing, voice note with transcript, grab text from image (OCR), collaborators, widgets, Docs export | card grid for short notes; widget; OCR on photo notes |
| **Microsoft OneNote** | Win, Mac, mobile, web · OneDrive | notebook → section → page tree, free-position canvas, ink + ink-to-text, audio recording synced to what was typed, OCR in images and printouts, tags (To Do, Important…) and a tag summary, page versions, section passwords | audio synced to the typed timeline; tag summary page; notebook/section/page hierarchy |
| **Samsung Notes** | Galaxy · Samsung Cloud / OneDrive | S Pen ink, PDF import and annotation, voice recording linked to handwriting, Galaxy AI summarise / format / translate, lock with biometrics | PDF annotation (quotes, datasheets, floor plans) |
| **Windows Notepad / Sticky Notes** | Windows | Notepad: tabs, session restore of unsaved text, light Markdown formatting; Sticky Notes: desktop stickies, OneNote sync | unsaved-text session restore (never lose a draft); stickies |
| **Xiaomi Notes, other OEM notes** | the OEM's phones | voice-to-text, checklists, hidden folder | — (the user's phone is a Redmi; nothing to take) |

### 2.2 All-in-one workspaces (blocks + databases)

| Product | Platforms · storage | Stand-out features | Take |
|---|---|---|---|
| **Notion** | all · cloud, proprietary | blocks with `/` commands, databases with table / board / calendar / timeline / gallery views, relations and rollups, templates, synced blocks, comments, permissions, publish to web, Notion AI (Q&A over the workspace), offline mode added late | `/` command menu; database views over typed notes; templates |
| **Evernote** (Bending Spoons) | all · cloud | web clipper, OCR search in images and PDFs, notebooks + stacks + tags, tasks inside notes, email-in, templates, document scanning; free tier now heavily limited | web clipper; search inside images and PDFs; email-in |
| **Coda** | web · cloud | doc = app: formulas, buttons, packs (integrations), automations | buttons that run things from a note |
| **Microsoft Loop** | M365 · cloud | live components that stay in sync wherever pasted (Teams, Outlook) | one block, shown in several places (transclusion) |
| **Anytype** | all · local-first, E2E (any-sync), self-host option | objects with types and relations, sets and collections, graph, P2P sync on the LAN | typed objects; local-first with LAN sync |
| **AFFiNE** | all · local-first, open source | docs and an edgeless whiteboard on the same content, databases | doc ⇄ canvas on the same content |
| **AppFlowy** | all · local-first, open source | Notion-like blocks + databases, self-host, local AI | — (same idea as Notion, open) |
| **Craft** | Apple, web, Windows | very polished block docs, cards, daily notes, publish | polish of the reading view |
| **Capacities** | all · cloud | object types (Person, Book, Meeting…) instead of folders, daily notes | typed notes: *job note, client, device, meeting* |
| **Tana** | web, desktop · cloud | outline nodes + "supertags" that turn a node into a typed record with fields, live search queries, AI on fields, meeting capture | supertags: a `#mérés` tag that adds fields |

### 2.3 Markdown and local-first knowledge tools

| Product | Platforms · storage | Stand-out features | Take |
|---|---|---|---|
| **Obsidian** | all · plain Markdown folder ("vault") | wikilinks, backlinks, unlinked mentions, graph, Canvas (open JSON Canvas format), Bases (database views over frontmatter properties), daily notes, templates, 2000+ community plugins, Sync (E2E) and Publish as paid add-ons, works on files the user owns | **plain files as the truth**; properties in frontmatter; Bases-style views; JSON Canvas |
| **Logseq** | all · Markdown files (DB version with SQLite in progress) | outliner, block references and embeds, journals, queries, PDF highlights, whiteboards | daily journal as default landing; block refs |
| **Roam Research** | web · cloud | the originator of bidirectional block links and daily notes | — |
| **Joplin** | all · local SQLite + Markdown export, open source | notebooks, tags, E2EE, sync to Nextcloud / WebDAV / OneDrive / Dropbox / S3 / Joplin Server, web clipper, plugins, note history, attachments | **sync to a plain folder target with E2EE**; revision history; open source reference |
| **Standard Notes** (Proton) | all · cloud, E2E | encryption-first, note types (Markdown, rich, code, spreadsheet, tasks), long-lived, audited | E2E done simply; "Super" editor |
| **Notesnook** | all · cloud, E2E, open source | zero-knowledge sync, vault for locked notes, app lock, monographs (published notes with expiry), reminders | per-note vault; app lock |
| **SiYuan** | all · local-first, open source | block-level references, SQL queries over blocks, E2E sync, PDF annotation | — |
| **Trilium Notes** | desktop, web server · SQLite, open source | deep hierarchy, a note can live in several places (clones), note types (code, canvas, relation map, mermaid), scripting, protected (encrypted) notes, self-hosted sync server | one note in several places; scripting; protected notes |
| **Zettlr** | desktop · Markdown | academic writing, citations (Zotero), Zettelkasten ids | — |
| **Typora · MarkText** | desktop · Markdown | seamless live-preview Markdown (the markup disappears as you leave the line) | **live preview editing** |
| **Bear** | Apple · CloudKit | nested tags in the text (`#job/2026/kovacs`), beautiful themes, OCR search, encryption of notes | **nested tags written inline** |
| **iA Writer · Ulysses** | Apple, Windows (iA) | focus mode, syntax highlight of prose, content blocks | focus / typewriter mode |
| **Drafts** | Apple | opens on a blank draft ("text first, decide later"), actions that send text anywhere (email, file, API) | **capture first, file later**; actions |
| **Simplenote** | all · Automattic cloud | plain, fast, free, version slider | the version slider UI |
| **UpNote · Zoho Notebook · Nimbus Note · Amplenote · NotePlan** | various | UpNote: fast, cheap; Zoho: cards; Nimbus: workspaces + web clips; Amplenote: tasks scored and scheduled from notes; NotePlan: Markdown notes + calendar + tasks in one file set | Amplenote/NotePlan: tasks inside notes, scheduled on a calendar |
| **QOwnNotes · Nextcloud Notes · Zim · CherryTree** | desktop / self-host | plain files, Nextcloud sync, wiki-like hierarchy | — |
| **Memos · Blinko** | self-hosted web | tweet-like timeline of short notes, tags, API, Telegram capture | **timeline of jots** (the Gyorsjegyzet day file is one already) |
| **SilverBullet** | self-hosted web | Markdown in the browser with live queries and Lua scripting | queries in a note |
| **Foam · Dendron · VS Code + Markdown** | VS Code | wikilinks and graph inside the code editor, hierarchy by file names | notes next to the code (dev notes) |
| **Org-mode (Emacs), Vimwiki** | text editors | plain text with agenda, TODO states, tables, literate code | TODO keywords, agenda from text |

### 2.4 Ink, handwriting and PDF

| Product | Stand-out features | Take |
|---|---|---|
| **GoodNotes · Notability** | handwriting with search, PDF annotation, audio synced to ink (Notability), templates, shapes snapping | ink over a PDF floor plan; audio + ink replay |
| **Nebo (MyScript)** | handwriting converted to text, diagrams, maths as you write | ink → text |
| **Saber · Xournal++** (open source) | Saber: cross-platform handwriting (Flutter), E2E; Xournal++: PDF annotation on desktop | open references for an ink layer |
| **reMarkable · Supernote · Boox** | e-ink tablets, handwriting OCR, export | — (hardware) |

### 2.5 AI-native and meeting notes

| Product | Stand-out features | Take |
|---|---|---|
| **Mem · Reflect** | AI-organised notes, related notes surfaced, chat with your notes; Reflect: E2E + backlinks + transcription | "related notes" panel |
| **Granola · Otter · Fireflies · tl;dv** | meeting audio → transcript → summary + action items, merged with the user's own jotted lines | jot during a call, get a cleaned note + tasks after |
| **NotebookLM** | grounded Q&A, summaries and audio overviews over the user's sources | Q&A over a job's documents with citations |
| **Notion AI, Copilot in OneNote, Apple Intelligence, Galaxy AI** | rewrite, summarise, extract tasks, translate | the same small verbs on a selection |

### 2.6 Field, construction and trades (closest to VRG's real work)

| Product | Stand-out features | Take |
|---|---|---|
| **CompanyCam** | photo-first job notes for contractors: every photo stamped with time, GPS, project; annotate (arrows, text), checklists, before/after, reports and pages from photos | **the site photo is the note**; reports built from notes |
| **SafetyCulture (iAuditor)** | inspection templates with required fields, signatures, photos, scoring, PDF report | inspection / measurement templates with required fields |
| **Fieldwire · Procore · Autodesk Construction Cloud (PlanGrid)** | pins on a drawing (a task or a note *at a place on the plan*), punch lists, sheet versions | **a note pinned to a spot on the Planner plan** |
| **Raken · daily-log apps** | daily site report: weather, crew, work done, photos, delays | the site diary (napló) template |
| **Jobber · ServiceTitan** | job notes and attachments shared with the crew, client-visible vs internal notes | client-visible vs internal flag |
| **Fulcrum** | custom forms, geodata, offline | offline forms |

---

## 3. What a note can be beyond a text box — the feature space

Every feature seen in §2, sorted into families. §6 turns these into modules; this is the vocabulary.

**A. Capture** — global hotkey and tray, quick-note window that opens empty and focused, phone widget and lock-screen tile,
share target (text, links, images, files), dictation, voice memo with transcript, photo / document scan with OCR and deskew,
clipboard capture, web clipper (page, selection, simplified article, screenshot), email-in, capture from another app's context
(the source), templates, "capture first, file later" inbox, NFC / QR tag on a device or cabinet that opens its note.

**B. Writing and editing** — plain text · Markdown with live preview · rich blocks; headings, lists, checklists, tables,
code with highlighting, maths (KaTeX), diagrams (Mermaid), callouts, quotes, dividers, embeds; `/` command menu; drag blocks;
paste-image-in; find and replace; word / character count; spell-check (hu + en); focus / typewriter mode; reading view;
autocomplete of links, tags and people; ink / handwriting layer; outline mode (fold, zoom into a branch).

**C. Organising** — folders / notebooks, tags (nested, inline), pins, colours, favourites, archive, trash, properties
(typed fields), note types (templates with fields), smart folders / saved searches, sort and group, one note in several places,
inbox for unfiled notes.

**D. Linking (knowledge)** — wikilinks `[[ ]]`, backlinks, unlinked mentions, aliases, block references and embeds
(transclusion), links to *outside things* (a file, a URL, a commit, a job), graph view, canvas / whiteboard, daily notes,
maps of content.

**E. Finding** — full-text search with Hungarian folding (á→a, ő→o …), fuzzy, operators (`tag:`, `job:`, `has:photo`,
`before:`), search inside images (OCR) and PDFs, semantic search, recent and frequently opened, quick switcher, command palette,
search result previews with the hit highlighted.

**F. Tasks and time** — checkboxes as tasks, due dates, reminders (time; place on the phone), recurring, an agenda view
across notes, calendar view, kanban over note statuses, the daily note as the day's landing page.

**G. Structured data** — properties, database views (table, board, calendar, gallery, map), forms with required fields,
computed fields, roll-ups (e.g. sum of measured values), CSV / JSON export of a view.

**H. Media and attachments** — images (with annotation), PDFs (view, highlight, annotate), audio (recording, playback synced to
text), video, any file; content-addressed storage so the same photo is stored once; thumbnails; size limits; EXIF / GPS handling.

**I. Sharing and collaboration** — share a note as a link, a file, a PDF in the Varler document style, or a page; publish with
expiry; comments; real-time co-editing; permissions; internal vs client-visible.

**J. Devices and sync** — offline-first, sync across PC and phone, conflict handling, selective sync (attachments on demand),
sync status visible.

**K. Security and privacy** — app lock, locked notes (passphrase / biometrics), encryption at rest, end-to-end encryption for
anything leaving the device, secret detection, PII awareness, redaction on export, audit of who / what read a note.

**L. Safety nets** — autosave, crash recovery of the unsaved draft, version history with diff and restore, trash with
retention, conflict copies, backups, integrity checks, readable without the app.

**M. Interop** — import (Markdown folders, Obsidian vaults, Evernote ENEX, Google Keep Takeout, OneNote via export, Apple Notes
export, Joplin JEX / RAW, plain text), export (Markdown + attachments, HTML, PDF, JSON), stable open formats (Markdown,
YAML frontmatter, JSON Canvas).

**N. Automation and extension** — URL scheme / deep links, actions (send a note to mail, to the Planner, to a job folder,
to a commit message), API for other tools, plugins, scheduled jobs (e.g. weekly digest), webhooks.

**O. AI** — summarise, rewrite, translate, title and tag suggestions, extract tasks, clean up a dictated note, Q&A over notes
with citations, related notes, transcript of audio.

**P. Experience** — themes (Mélyvíz), dark / light, density, keyboard-first, accessibility (screen reader, font size,
contrast), widgets, speed (open in under 200 ms, type with no lag at 10 000 notes), Hungarian UI.

---

## 4. What fits VRG specifically

The general market builds *a second brain*. VRG's notes have three real jobs, and the design should serve them before anything
generic:

1. **Field notes for electrical jobs** — on site, on the phone, often offline, often with gloves and a photo: what was measured,
   what was found, what the client asked for, what must be bought. They belong to a **job** (`H:\VRG\Full\jobs\…`) and often to a
   **place on the plan**. They carry **client personal data**.
2. **Office notes** — calls with clients and suppliers, quote reasoning, price findings; they feed the Költségvetési Tervezet,
   the Árajánlat and the job register.
3. **Dev notes** — what the existing Desktop dev-note dialog and Divergence already do: ideas, findings, TODOs about the code,
   linked to Stack nodes, commits, branches.

From that, the VRG-only features (the ones no market app has, because they need the rest of the VRG toolset):

| Idea | How it works | Reuses |
|---|---|---|
| **Note ↔ job** | every note may name a job id; the job folder shows its notes; a new job gets a notes section; the job's offer can quote a note | job register, `jobs\` folders |
| **Pin on the Planner plan** | a note anchored to a Planner element (room, circuit, device, cable run) or an x/y on a sheet — Fieldwire-style pins shown as a layer in the Planner; tapping a pin opens the note | Planner element ids, Views |
| **Note ↔ Inventory / BuildTree** | `[[inv:…]]` links to an inventory item; "buy" checklist lines become shopping-list rows | Inventory |
| **Site photo with context** | Átadás already moves photos; Notes stamps them with time, job, optional GPS, annotation layer (arrows, text, measurements), before/after pairs | Átadás, FileStore |
| **Measurement templates** | typed note types with required fields (e.g. a survey, a handover, an insulation / loop-impedance measurement row set) → a table that can export to CSV and into a Varler-style PDF report | Varler document style (`shared/varler-doc`) |
| **Site diary (Terepnapló)** | the daily note of a job day: who was there, hours, work done, photos, blockers — Raken-style; can sum hours per job | daily-note module |
| **Links to the work graph** | `[[F:…]]`, `[[L:…]]`, `[[R:5ee8b1e]]`, `[[C:Planner/src]]` link to Stack nodes; notes become a Stack layer (`N`) so `stack_search` finds them and a node's card lists its notes | Stack, vrg-stack MCP |
| **Phone → PC instantly, no cloud** | a note written on the phone appears on the Desktop over the paired, signed relay in under a second when on the same network; the cloud path is only a fallback | relay M2/M7, trust gate |
| **Desktop capture from anywhere** | the existing "save as dev note" dialog grows into the universal capture: from a terminal selection, a chat answer, a mail, a web page, a file, a Stack node — the note keeps the source | `note.js` source kinds |
| **Voice on site, in Hungarian** | dictation (already hu-HU) plus recorded audio kept with the note, transcribed later on the PC if the phone did not | Gyorsjegyzet 🎤 |
| **QR / NFC on a cabinet** | a sticker in an electrical cabinet opens that installation's note on the phone (`vrg://notes/open?id=…`) | Links routing, QR (M2 scanner) |
| **Palette, dial, dock** | `notes` is a catalog id: palette line "Új jegyzet", a dock icon, a Sarokvezérlő row under Munka; Esc / double Tab rules respected | catalog, palette |
| **Commit message from notes** | the day's dev notes offered as a draft commit body; notes tagged with a branch | vrg-git, Divergence |
| **Client-visible export** | a note marked *ügyfélnek* (client-visible) can be exported as a clean Varler PDF; internal notes never appear in it | varler-doc |
| **Agents can read (and only read)** | Claude sessions ask the Stack, not the vault; a note marked private never enters the Stack index or an agent's context | Stack builder rules |

What VRG does **not** need early: real-time multi-user co-editing, public web publishing, a plugin marketplace, a whiteboard
engine of its own (MindMap is there), handwriting recognition.

---

## 5. The backend — stable code, security, fallback

### 5.1 Where the notes live

**Recommendation: plain files are the truth, every index is rebuildable.** This is the lesson of Obsidian, Joplin's export,
Bear and every app that died and took its users' notes with it (Skiff Notes shut down in 2024; Evernote changed its terms).

```
H:\VRG\Full\jegyzetek\              <- the vault: OUTSIDE the main repo (client data must never reach origin)
  .vault.json                        format version, vault id, created, key check (when encrypted)
  notes\
    01JC8Z…Q.md                      one note = one file, named by its id (ULID), never by its title
  att\
    sha256\ab\ab12…f9.jpg            attachments, content-addressed: same photo stored once; name = hash
  journal\
    2026-11-10.jsonl                 append-only operation log (create / edit / move / delete), for sync and recovery
  trash\                             deleted notes kept 30 days (moved, not removed)
  .index\                            SQLite FTS5 (Desktop) — disposable, rebuilt from notes\ on mismatch
  .history\                          compressed previous versions, or the vault is its own local git repo (Q04)
```

A note file:

```markdown
---
id: 01JC8Z5M7Q3T8K2V9WXYZABCDE
title: Kovács lakás — elosztó felmérés
type: felmeres            # note type (module N-TYPE); default "note"
tags: [job/2026/kovacs, eloszto]
job: 2026-031             # optional links to the VRG world
plan: { file: kovacs.vrgplan, el: "circuit:K3" }
visibility: internal      # internal | client | private (private = never indexed by the Stack, never synced off-device unencrypted)
created: 2026-11-10T09:14:03+01:00
updated: 2026-11-10T09:31:40+01:00
rev: 7                    # per-note revision counter
base: 9f2c…               # hash of the text this revision was written over (for 3-way merge)
device: pc-witoo          # who wrote this revision
---
Elosztó: 3×16 A … 
- [ ] FI-relé csere (30 mA)  📅 2026-11-14
![[att:ab12…f9.jpg]]
```

Why this shape:

- **Markdown + YAML frontmatter** is readable in Notepad, VS Code, Obsidian, on GitHub, in 20 years. Nothing is lost if the app
  breaks: that *is* the fallback.
- **ULID / UUIDv7 ids as file names**: renaming a note changes no path, links never break, two devices cannot pick the same name.
- **Content-addressed attachments**: integrity is checkable (re-hash = file name), duplicates disappear, sync can skip what the
  other side has.
- **The index is a cache.** On a version mismatch, a missing file or a failed integrity check, it is dropped and rebuilt. No user
  data exists only in the index.

**On the phone:** the same model in a Room / SQLite database (fast lists, FTS4/5 for search) **plus** the same Markdown files
exported into the app's private storage on every change, so a phone backup or a USB copy is still readable notes. The phone holds
a replica; the PC vault is the home copy.

### 5.2 Writing safely (no lost keystroke, no half-written file)

| Rule | How |
|---|---|
| Atomic save | write `x.md.tmp` → flush + fsync → rename over `x.md` (the pattern `secrets.js` already uses; add fsync). Windows: `fs.renameSync` replaces atomically on NTFS for same-volume files |
| Autosave | debounce 400–800 ms after the last keystroke, plus on blur, pane close, window close, suspend |
| Draft journal | every keystroke burst is appended to a per-note draft log first; on start, a draft newer than its note is offered back ("Visszaállítsam?") — Notepad's session-restore idea |
| One writer | the Electron main process owns the vault (the page sends words, never paths — the existing CONTRACT); a lock file with the PID guards against a second Desktop instance or a CLI writing at once |
| External edits | a file watcher notices a note edited outside (VS Code, Obsidian, a script); clean → reload; dirty in the editor → conflict banner, never a silent overwrite |
| Size limits | note text capped (e.g. 2 MB), attachment cap (e.g. 200 MB), clear Hungarian message when hit |
| Schema version | `.vault.json` `format: 1`; a migration step per version, run on a copy first, original kept in `trash\migrations\<stamp>` |
| Never delete | delete = move to `trash\`; trash emptied only after 30 days *and* after a successful BACKUP run covered the note |

### 5.3 Sync

Three channels, in order of preference. All of them carry the same thing: **operations from the journal** (or whole-note
revisions), never "the folder".

| Channel | When | Security |
|---|---|---|
| **1. LAN relay** (phone ↔ PC) | same network or the phone's hotspot; instant | already paired with P-256 keys and signed messages; add payload encryption (ECDH between the two device keys → AES-GCM) so a note is unreadable on the wire even inside the LAN |
| **2. OneDrive / Shared folder** | PC ↔ another PC, or a laptop | encrypted bundle files only (`sync\<device>\<seq>.vnote`), never plain notes in OneDrive |
| **3. GitHub private branch** | phone far away, PC off; the path Gyorsjegyzet uses today | **E2E-encrypted payloads only**; plain text only for notes with `visibility` explicitly *dev* (the existing `mobile-log` / `vrg-devnotes` behaviour, kept as a "dev outlet") |

**Conflicts.** Each note carries `rev` + `base` (hash of the text it was edited from):

1. Same base on both sides → fast-forward.
2. Different edits from one base → **three-way merge per line** (diff3); text that merged cleanly is saved, the note gets a quiet
   "összefésülve" (merged) mark in its history.
3. Overlapping edits → the incoming version is saved as a **conflict copy** linked from the note, with a side-by-side view; the
   user picks. Nothing is ever dropped.
4. Frontmatter fields merge field by field (tags = union, deletes recorded as tombstones).

A **CRDT** (Yjs or Automerge, both MIT) would give character-level merges and live co-editing, but it moves the truth into a
binary document format. Recommendation: diff3 + conflict copies first (simple, files stay the truth); CRDT only if two people
must edit one note at the same time (Q06).

### 5.4 Security

Threats that are real for VRG, in order: (1) **client personal data leaking** to GitHub / OneDrive / a screenshot; (2) a **lost
or stolen phone**; (3) **malicious content** in a pasted or clipped note running script in the Desktop shell; (4) secrets
(passwords, tokens) typed into a note and then synced or indexed; (5) an agent session pulling private notes into a prompt.

| Measure | Detail |
|---|---|
| Visibility levels | `private` · `internal` (default) · `client` (may appear in client exports) · `dev` (may go to the dev branches in plain text). A note with a job id defaults to `internal` |
| Encryption at rest (opt-in vault, required for sync channels 2–3) | per-note AES-256-GCM with a random note key, wrapped by the vault key; vault key derived from a passphrase with **scrypt** (Node built-in) or Argon2id (vendored WASM), and stored wrapped by DPAPI (`safeStorage`) on the PC and the Keystore on the phone, so day-to-day use needs no passphrase |
| Locked notes | an extra per-note passphrase / biometric (Android BiometricPrompt, Windows Hello later); content never in the index, title replaced by "Zárolt jegyzet" |
| App lock on the phone | biometric / PIN after N minutes in the background; `FLAG_SECURE` on locked notes (no screenshots, hidden in the recent-apps view) |
| Device enrolment | a new device gets the vault key only through the paired relay (ECDH, confirmed by a code on both screens), never by mail or a file |
| Rendering | Markdown → HTML through a sanitiser (DOMPurify) with an allow-list; strict CSP on the Notes page (no inline script, no remote script); remote images blocked by default (tracking pixels in clipped pages), "show images" per note; links open outside the shell; `vrg-app://` confinement as for other in-shell apps |
| Secret detector | the same patterns `vrg-git.ps1` uses (tokens, private keys, `password=`) warn when a note contains one and block it from any plain-text channel |
| PII guard | a light detector (names next to addresses, phone numbers, e-mail, Hungarian tax / ID formats) suggests `internal` / `private`; client exports run a redaction preview |
| Stack and agents | the Stack builder indexes only `internal` / `dev` notes' titles and tags by default, never `private` ones, never note bodies of `client` jobs unless opted in |
| Audit | an append-only log of exports, shares, decrypts of locked notes, device enrolments (the shell already has `audit.js`) |
| Supply chain | every editor / parser library vendored by `vendor-manifest.json` with an exact npm version + sha512, as the repo rule requires |

### 5.5 Fallback and recovery (what happens when things break)

| Failure | What still works |
|---|---|
| The Notes app / Desktop will not start | the vault is a folder of Markdown files: START tartalék gets an item "Jegyzetek mappa megnyitása" (opens the folder) and a plain-text search script (`node tools/notes-find.js <words>`) |
| Index corrupt / old version | dropped and rebuilt on start; a progress toast; search waits, editing does not |
| Power cut mid-save | tmp + rename means the old or the new file, never half; the draft journal restores the last keystrokes |
| Sync partner offline | the outbox queues (the Gyorsjegyzet outbox already does this, with the linear backoff and the on-resume flush learnt on 2026-10-31) |
| Sync gone wrong | conflict copies, never overwrites; every sync batch is in the journal, so a bad batch can be undone |
| Encryption key lost | a recovery key printed once at vault creation (a 24-word or QR code) — without it encrypted notes are gone, said plainly at setup |
| Disk / drive loss | BACKUP mirrors the vault folder (add `jegyzetek` to the backup `work` list); if the vault is a local git repo, `git push --all` to `Backup\code\jegyzetek.git` as for any repo, with `fsck` in the integrity step |
| Phone lost | the PC holds the full copy; unpair the phone (trust gate) and rotate the vault key |
| Bad migration | the migration ran on a copy; the original is in `trash\migrations` |

### 5.6 Code shape (so it stays stable)

- **Pure core, thin shells.** A pure JS core (`shared/notes-core/`: parse / serialise frontmatter, links, tags, merge, search
  tokenise with Hungarian folding, the visibility rules) tested with `node --test`; a pure Kotlin core (`kit-core/notes/`) with the
  same rules and **the same golden test files** (a shared `test/fixtures/*.md` set both sides must parse identically). The UI on each
  side only calls the core.
- **Main owns I/O** on the Desktop (`shell/lib/notes.js` grows into the vault service; the page sends `{ id, text }`, never a
  path) — matches the existing CONTRACT §3 / §4.1.
- **One editor, two hosts (Q05).** The editor (CodeMirror 6, MIT) lives in `shared/notes-editor/` and runs in the Desktop page and
  in a confined Android WebView for full editing; the phone keeps a native Compose field for fast capture (the current
  Gyorsjegyzet screen).
- **Throwaway vaults in tests** under `%TEMP%\VRG\notes-*`, never the real vault (the same rule as the git and backup tests).
- **Torture tests**: kill the process during a save; two writers; a 10 000-note vault for speed; a note with every Markdown
  construct; clipped HTML with script / event handlers (must render inert); a 3-way merge corpus.
- **Registry duty**: a `notes` entry in `launcher/vrg-menu.json` + `vrg-catalog.json` (then `node tools/check-start.js`,
  `node tools/check-catalog.js`, `node tools/build-hub.js`), the Mobile `Catalogue` line, a Stack layer — in the same change that
  adds the app.

---

## 6. The modular feature list

Each module can be built, tested and switched on alone. **Tier**: `0` = core (needed before anything else) · `1` = first useful
version · `2` = strong second wave · `3` = later / only if wanted. **Where**: D = Desktop, M = Mobile, D+M both. **Builds on**:
existing VRG pieces it reuses.

### 6.1 Core (tier 0)

| ID | Module | What it is | Where | Builds on |
|---|---|---|---|---|
| N-VAULT | Vault and note model | the folder layout, the note file (ULID name, YAML frontmatter, Markdown body), `.vault.json` with the format version, the lock file | D+M | — |
| N-STORE | Safe writer | atomic save (tmp + fsync + rename), autosave debounce, draft journal and restore, size limits, external-edit watcher | D+M | `secrets.js` save pattern |
| N-ATT | Attachment store | content-addressed `att/sha256/…`, thumbnails, dedupe, re-hash check, size cap | D+M | Átadás checksum |
| N-INDEX | Index | SQLite FTS5 (D) / Room FTS (M), rebuildable, Hungarian accent folding, incremental update from the watcher | D+M | — |
| N-TRASH | Trash and delete rules | move to `trash\`, 30-day retention gated on a covering backup, restore | D+M | BACKUP |
| N-API | Vault service | main-process IPC on the Desktop (`notes.list/get/save/move/delete/search`), a Kotlin repository on the phone; the only code that touches files | D+M | CONTRACT §3, `shell/lib/notes.js` |
| N-CORE-TEST | Shared golden fixtures | one fixture set both cores must parse and serialise identically; torture tests | D+M | `node --test`, kit-core tests |

### 6.2 Capture

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-QUICK | Quick note | global hotkey + tray item + palette line "Új jegyzet" → a small focused window, Esc saves and closes | 1 | D | `quick.js`, `tray.js`, palette |
| N-INBOX | Capture inbox | unfiled notes land in *Beérkezett*; file later by job / tag with one key | 1 | D+M | — |
| N-SOURCE | Capture with source | "save as note" from any pane keeps the source (`url`, `file`, `node`, `term`, `chat`, `mail`) as a property and a back-link | 1 | D | `note.js` dialog |
| N-PHONE | Phone capture | today's Gyorsjegyzet screen writing into the vault model (via sync) instead of only the day log; tag chips; offline outbox kept | 1 | M | M6 |
| N-SHARE | Share target | text, links, images, files from any Android app → a new note (exists for text; add images and files) | 1 | M | M6, FileStore |
| N-WIDGET | Widget and tile | home-screen widget (new note, new voice note, new photo note) and a Quick Settings tile | 2 | M | — |
| N-VOICE | Voice memo | record audio into the note (Opus/M4A), dictation hu-HU as now, playback; transcript later on the PC | 2 | D+M | M6 🎤 |
| N-SCAN | Photo and document scan | camera → deskew → note with the image; OCR text stored beside it for search | 2 | M | CameraX + ML Kit (M2) |
| N-CLIP | Web clipper | from the Desktop's browser pane: page as Markdown (readability), selection, screenshot, URL with title | 2 | D | `web.js`, `textify.js` |
| N-MAILIN | Mail to note | "save as note" in the mail pane (body + attachments, sender as source) | 2 | D | `mail.js`, `mailview.html` |
| N-TAG-QR | QR / NFC tags | print a QR (or write an NFC tag) for a note; scanning opens it (`vrg://notes/open?id=`) | 3 | M | Links, M2 scanner |

### 6.3 Writing and editing

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-EDIT | Editor core | CodeMirror 6 with Markdown, live preview (markup fades off the current line), undo history, find / replace, word count | 1 | D (+M WebView) | vendored CM6 |
| N-CHECK | Checklists | `- [ ]` toggled by click / tap, progress on the note card | 1 | D+M | — |
| N-SLASH | `/` command menu | heading, checklist, table, code, callout, date, photo, link to job… | 1 | D+M | — |
| N-TABLE | Tables | Markdown tables edited as a grid; paste from Excel / CSV | 2 | D | — |
| N-CODE | Code blocks | highlighting (CM6 languages); copy button; good for dev notes and config snippets | 1 | D | — |
| N-MATH | Maths and units | KaTeX; plus a tiny inline calculator (`= 3*16 A`) — handy for load sums | 3 | D | vendored KaTeX |
| N-DIAG | Diagrams | Mermaid blocks rendered in the reading view | 3 | D | vendored Mermaid |
| N-SPELL | Spell-check hu + en | Electron's built-in spell-checker with the hu-HU dictionary; Android's system checker | 2 | D+M | Electron |
| N-FOCUS | Focus and reading modes | typewriter / focus mode, a clean reading view, font size | 2 | D+M | VRG UI Kit |
| N-INK | Ink layer | draw on a note or on a photo / plan image with a finger or pen; stored as SVG beside the note | 3 | M (+D view) | — |
| N-ANNOT | Photo annotation | arrows, boxes, text, a measurement line on a site photo; original kept, annotation as a layer | 2 | M (+D) | — |
| N-PDF | PDF annotate | open a PDF attachment, highlight, comment, pin a note to a page | 3 | D | `Vendor/pdfjs` (legacy build) |

### 6.4 Organising and linking

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-TAG | Tags | inline nested tags (`#job/2026/kovacs`) + frontmatter tags, tag tree in the sidebar, rename a tag everywhere | 1 | D+M | — |
| N-PIN | Pins, colours, favourites, archive | the small organising verbs | 1 | D+M | — |
| N-FOLDER | Folders | virtual folders stored as a property, not as directories (files stay flat); part of the simple surface (SIMPLE.md) | 1 | D+M | — |
| N-LINK | Wikilinks and backlinks | `[[cím]]` with autocomplete, backlink panel, unlinked mentions, aliases, rename-safe (links by id under the hood) | 1 | D (+M view) | — |
| N-XLINK | Links to the VRG world | `[[job:2026-031]]`, `[[inv:…]]`, `[[plan:kovacs#K3]]`, `[[F:…]]` / `[[R:sha]]` (Stack ids), `[[file:…]]`; each opens through the catalog / `desktop.open` | 1 | D | catalog, Stack ids |
| N-EMBED | Embeds / transclusion | `![[note#heading]]` shows part of another note inline (Loop / Obsidian idea) | 3 | D | — |
| N-GRAPH | Graph view | the link graph; or hand the notes to the Stack's existing viewers instead of a new one | 3 | D | Stack, MindMap |
| N-CANVAS | Canvas | notes as cards on a board, saved as JSON Canvas (open format); MindMap as the host | 3 | D | MindMap / MindMD |
| N-DAILY | Daily note | one note per day as the landing page; today's jots (the Gyorsjegyzet timeline) collected in it | 1 | D+M | M6 day files |
| N-TYPE | Note types (templates with fields) | a type = a template + typed properties + required fields (Tana supertags / Capacities objects): *jegyzet, felmérés, mérés, átadás, telefon, ötlet, dev* | 2 | D+M | — |
| N-SMART | Saved searches / smart folders | a search kept in the sidebar (`job:2026-031 has:photo`) | 2 | D+M | N-INDEX |

### 6.5 Finding

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-FIND | Search | full-text with accent folding, highlighted snippets, operators (`tag:`, `job:`, `type:`, `has:photo`, `before:`, `is:task`) | 1 | D+M | N-INDEX |
| N-SWITCH | Quick switcher | type-to-open any note by title (Ctrl+O style), recent first | 1 | D | palette |
| N-PALETTE | Palette and global search | notes appear in the Desktop's palette and the shell's search results | 1 | D | `palette.js`, `search.js` |
| N-OCR | Search in images and PDFs | OCR text of scans / photos and PDF text into the index | 2 | D+M | ML Kit (M), pdfjs (D) |
| N-STACK | Notes as a Stack layer | the Stack builder reads note titles / tags / links (by visibility) → layer `N`; a node's card shows its notes; `stack_search` finds them | 2 | D | Stack |
| N-SEM | Semantic search | local embeddings for "notes like this one" — only if full-text proves not enough | 3 | D | — |

### 6.6 Tasks, time and reminders

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-TASK | Tasks in notes | a checkbox line with a date (`📅 2026-11-14`) or a priority is a task; one agenda across all notes | 2 | D+M | N-CHECK |
| N-REMIND | Reminders | a time on a note or task → a phone notification (M10 channel) and a Desktop toast | 2 | D+M | M10 `VrgNotify`, `toasts.js` |
| N-CAL | Calendar view | notes and tasks by day; site-diary days per job | 3 | D | — |
| N-BOARD | Status board | kanban over a property (e.g. *nyitott → rendelve → kész*) | 3 | D | N-TYPE |
| N-BUY | Shopping lines | `- [ ] 2× FI-relé 30 mA #vesz` lines collected into a buy list; later handed to Inventory | 3 | D+M | Inventory |

### 6.7 VRG work integration

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-JOB | Job binding | `job:` property, the job's notes listed in its folder view and in the job register; new note from a job | 1 | D+M | job register, `jobs\` |
| N-PLANPIN | Pins on the plan | a note anchored to a Planner element or sheet position; a pin layer in the Planner; open from either side | 2 | D (+M view) | Planner, Views |
| N-SITE | Site photo notes | photo + time + job + optional GPS + annotation; before/after pairs; a job's photo gallery | 2 | M (+D) | Átadás, N-ANNOT |
| N-MEAS | Measurement forms | note types whose fields form a table (circuit, value, limit, pass/fail); CSV export | 2 | D+M | N-TYPE |
| N-DIARY | Site diary (Terepnapló) | the daily note of a job day: people, hours, work, photos, blockers; hour totals per job | 2 | D+M | N-DAILY, N-JOB |
| N-REPORT | Report export | a note, a set of notes or a job's notes → a Varler-style PDF (client-visible parts only, redaction preview) | 2 | D | `shared/varler-doc` |
| N-DEV | Dev outlet | notes with visibility `dev` still flow to `vrg-devnotes` / `mobile-log` in plain text as today; the Divergence board reads them | 1 | D+M | Divergence, M6 |
| N-COMMIT | Notes → commit text | today's dev notes for a branch offered as a commit body draft in the git pane | 3 | D | `git.js` |

### 6.8 Sync and devices

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-JOURNAL | Operation journal | append-only `journal\*.jsonl` of every change: the input of sync and of undo-a-sync | 1 | D+M | — |
| N-SYNC-LAN | LAN sync | phone ↔ PC over the paired relay, encrypted payloads, resumable, attachments on demand | 1 | D+M | relay M2/M7, trust gate |
| N-MERGE | Merge and conflicts | rev + base hash, diff3 per line, field-wise frontmatter merge, conflict copies with a side-by-side picker | 1 | D+M | — |
| N-SYNC-FILE | Folder sync | encrypted bundles through OneDrive / Shared for a second PC | 3 | D | `roots.json` Shared |
| N-SYNC-GH | GitHub fallback | encrypted bundles on a private branch when the PC is unreachable (replaces plain `mobile-log` for non-dev notes) | 2 | M (+D reader) | GitHub client, outbox |
| N-STATUS | Sync status | per-note dot (helyi / szinkronizált / ütközés), last sync time in the top strip | 1 | D+M | top strip |
| N-SELECT | Selective sync | which notebooks / jobs go to the phone; attachments thumbnail-only until opened | 3 | M | — |

### 6.9 Security and privacy

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-VIS | Visibility levels | private / internal / client / dev, enforced by every outlet (sync, export, Stack, agents) | 0 | D+M | — |
| N-CRYPT | Vault encryption | per-note AES-256-GCM keys wrapped by the vault key; vault key from scrypt / Argon2id, kept wrapped by DPAPI / Keystore; recovery key | 1 (required before N-SYNC-GH / FILE) | D+M | `secrets.js`, `SecretStore` |
| N-LOCK | Locked notes | extra passphrase / biometric per note; out of the index | 2 | D+M | BiometricPrompt |
| N-APPLOCK | App lock | phone: biometric / PIN after idle, `FLAG_SECURE` for locked notes | 2 | M | — |
| N-ENROL | Device enrolment | the vault key to a new device only over the paired relay with a confirmation code | 1 | D+M | relay trust |
| N-SAFE-HTML | Safe rendering | DOMPurify allow-list, strict CSP, remote images off by default, links open outside | 0 | D (+M WebView) | vendored DOMPurify |
| N-SECRET | Secret and PII detector | warns on tokens / keys / passwords and on client personal data; blocks plain-text outlets | 1 | D+M | `vrg-git.ps1` patterns |
| N-AUDIT | Audit log | exports, shares, decrypts, enrolments | 2 | D | `audit.js` |

### 6.10 History and resilience

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-HIST | Version history | coalesced snapshots (e.g. at most one per 5 min of editing + on every sync merge), diff view, restore; or the vault as a local git repo (Q04) | 1 | D (+M recent only) | `git.js` |
| N-RECOVER | Crash recovery | draft journal restore on start, "unsaved text from last session" banner | 0 | D+M | N-STORE |
| N-BACKUP | Backup wiring | the vault in BACKUP's work list (or its own bare repo), integrity re-hash of `att\` | 1 | D | `backup.ps1` |
| N-FSCK | Integrity check | start-up and on-demand: every note parses, every attachment hash matches, every link resolves; report, never auto-delete | 1 | D | — |
| N-FALLBACK | Fallback access | START tartalék item "Jegyzetek mappa", `tools/notes-find.js` plain search | 1 | D | START |

### 6.11 Interop, sharing, automation

| ID | Module | What it is | Tier | Where | Builds on |
|---|---|---|---|---|---|
| N-EXPORT | Export | Markdown + attachments (zip), HTML, PDF (Varler style), JSON; a whole job or a search result | 1 | D | `varler-doc` |
| N-IMPORT | Import | Markdown folders / Obsidian vaults, Google Keep (Takeout JSON), Evernote ENEX, Joplin, plain text; the old `mobile-log` and `vrg-devnotes` histories | 2 | D | — |
| N-SHAREOUT | Share out | send a note to mail, to the phone (Átadás), to the clipboard as Markdown or plain text | 2 | D+M | mail pane, Átadás |
| N-LINKS | Deep links | `vrg://notes/new`, `/open?id=`, `/search?q=` on both sides | 1 | D+M | `Links.kt`, `acts.js` |
| N-ACTIONS | Actions | Drafts-style named actions on a note: "to job folder as .md", "to commit message", "to the Planner as a pin", "to a CSV" | 3 | D | acts |
| N-CLI | CLI / script API | `node tools/notes.js add|find|export` for scripts and agents (respecting visibility) | 2 | D | — |

### 6.12 AI (optional, all behind a switch, never on `private` notes)

| ID | Module | What it is | Tier | Where |
|---|---|---|---|---|
| N-AI-CLEAN | Clean up a dictated note | punctuation, paragraphs, Hungarian spelling, keep the original as a version | 3 | D |
| N-AI-SUM | Summarise / extract tasks | a job's notes → a summary and an open-task list | 3 | D |
| N-AI-ASK | Ask my notes | Q&A over notes with citations to note ids, scoped to a job | 3 | D |
| N-AI-TAG | Suggest tags / type / job | from the text and the source | 3 | D |
| N-AI-TRANS | Transcribe audio | voice memos → text on the PC (a local model preferred; anything sent out only with consent) | 3 | D |

### 6.13 Experience

| ID | Module | What it is | Tier | Where |
|---|---|---|---|---|
| N-UI | Notes app UI | three panes on the Desktop (sidebar · list · note), card grid or list on the phone, Mélyvíz look via the VRG UI Kit | 1 | D+M |
| N-KEYS | Keyboard-first | every action has a key; keys listed in `keymap.json`; double Tab / Esc rules of the shell respected | 1 | D |
| N-A11Y | Accessibility | font scaling, contrast, screen-reader labels, large touch targets (gloves) | 1 | D+M |
| N-PERF | Speed budget | open < 200 ms, search < 100 ms, typing never blocked by save or index, at 10 000 notes | 0 | D+M |
| N-I18N | Hungarian first | UI strings in one table (hu, en later); dates and numbers in hu-HU | 1 | D+M |
| N-SIMPLE | Surface and slots | the per-device profile, the slot registry, the budget, the *Egyszerű mód* switch, the snap-back test ([SIMPLE.md](SIMPLE.md)) | 0 | D+M |
| N-ENGINELOG | Engine log | *Háttérnapló* per note and per vault: every automatic act with its reason and *Visszavonás* | 1 | D+M |
| N-SKIN | Ismerős look | the iOS-style phone skin on the same screens and slots; Csendes as its default behaviour | 1 | M |

---

## 7. Open decisions (A = recommended default)

| # | Question | A (recommended) | B / C |
|---|---|---|---|
| NOTES-Q01 | Where does the vault live? | **`H:\VRG\Full\jegyzetek\`**, outside the repo, backed up by BACKUP | B inside the repo, git-ignored · C in `Shared` (OneDrive) |
| NOTES-Q02 | Source of truth | **Markdown files + rebuildable index** | B SQLite as truth, Markdown export · C CRDT documents |
| NOTES-Q03 | Product name | **VRG Jegyzetek** (catalog id `notes`) | B keep "Gyorsjegyzet" for the phone capture, "Jegyzetek" for the app |
| NOTES-Q04 | Version history | **the vault as its own local git repo** (no origin, only `Backup\code\jegyzetek.git`) — vrg-git's launcher-collect push must skip it | B own snapshot files in `.history\` |
| NOTES-Q05 | Phone editor | **native Compose for capture, the shared CodeMirror editor in a WebView for full editing** | B everything native Compose · C everything WebView |
| NOTES-Q06 | Merge strategy | **rev + base + diff3 + conflict copies** | B CRDT (Yjs / Automerge) from the start |
| NOTES-Q07 | Encryption | **on for the whole vault from day one** (DPAPI / Keystore-wrapped key, so no passphrase prompts); required for any off-LAN sync | B off by default, opt-in per vault |
| NOTES-Q08 | The existing `mobile-log` and `vrg-devnotes` branches | **kept as the `dev` outlet only**; new non-dev phone notes go through the vault sync; old history imported once | B retire both |
| NOTES-Q09 | Note types in the first version | **jegyzet, felmérés, telefon, dev** (four) | B only plain notes first |
| NOTES-Q10 | AI features | **off and not built until tier 3**; when built, local first, never on `private` | B build N-AI-CLEAN early for dictation |

---

## 8. A build order

1. **NT0 — core, no UI:** N-VAULT, N-STORE, N-ATT, N-INDEX, N-TRASH, N-API, N-VIS, N-SAFE-HTML, N-RECOVER, N-PERF budget,
   N-CORE-TEST, N-SIMPLE. Pure cores in JS and Kotlin with the shared fixtures. Nothing visible; all tested.
2. **NT1 — the Desktop app:** N-UI, N-EDIT, N-CHECK, N-SLASH, N-CODE, N-TAG, N-PIN, N-LINK, N-FIND, N-SWITCH, N-PALETTE, N-QUICK,
   N-SOURCE (the dev-note dialog becomes the universal capture), N-FOLDER, N-ENGINELOG, N-DAILY, N-HIST, N-BACKUP, N-FSCK, N-FALLBACK, N-EXPORT, N-LINKS,
   N-KEYS. Registered in `vrg-menu.json` + `vrg-catalog.json`. *Usable on the PC.*
3. **NT2 — the phone joins:** N-CRYPT, N-ENROL, N-JOURNAL, N-SYNC-LAN, N-MERGE, N-STATUS, N-PHONE, N-SHARE, N-INBOX, N-DEV, N-SKIN
   (Gyorsjegyzet now writes vault notes; dev notes still flow as today). *PC and phone in step, no cloud.*
4. **NT3 — the work:** N-JOB, N-XLINK, N-TYPE (four types), N-SITE, N-ANNOT, N-VOICE, N-MEAS, N-DIARY, N-REPORT, N-TASK,
   N-REMIND, N-SMART, N-STACK. *The notes app becomes the field notebook of the jobs.*
5. **NT4 — reach:** N-SYNC-GH (encrypted), N-SCAN + N-OCR, N-CLIP, N-MAILIN, N-PLANPIN, N-LOCK, N-APPLOCK, N-AUDIT, N-IMPORT,
   N-SHAREOUT, N-WIDGET, N-SPELL, N-FOCUS, N-TABLE, N-CLI.
6. **Later, only if wanted:** N-CANVAS (via MindMap), N-GRAPH, N-EMBED, N-INK, N-PDF, N-MATH, N-DIAG, N-CAL, N-BOARD, N-BUY,
   N-ACTIONS, N-COMMIT, N-SYNC-FILE, N-SELECT, N-TAG-QR, N-SEM, the AI modules.

Libraries this would vendor (all to be pinned by exact version + sha512 in `vendor-manifest.json`; licences to re-check at that
time): CodeMirror 6 (MIT), markdown-it (MIT) or micromark (MIT), DOMPurify (Apache-2.0 / MPL-2.0), a YAML parser (`yaml`, ISC),
MiniSearch (MIT) only if SQLite FTS is not used in a context, KaTeX (MIT), Mermaid (MIT); Android: Room (Apache-2.0), ML Kit text
recognition (Google terms), CameraX (Apache-2.0). Optional later: Yjs / Automerge (MIT), an Argon2 WASM build.
