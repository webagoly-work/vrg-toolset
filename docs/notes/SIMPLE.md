# VRG Jegyzetek — Felszín és gépház (Surface and engine room)

*The simplified-mode concept for VRG Jegyzetek, on PC and phone. 2026-11-11. It comes **before** the feature modules of
[ANALYSIS.md](ANALYSIS.md): every module there has to fit the rules here, and a module that cannot fit them is not built.
Hungarian version: [SIMPLE.hu.md](SIMPLE.hu.md); fix both together. Interactive prototype (HU/EN):
https://claude.ai/artifact/HXMSS2jg9TgBQxtfX1Q8ES*

---

## 1. The idea in one paragraph

VRG Jegyzetek is **a plain notes app that has an engine room**. The surface (list, note, search, new note) is the product.
With every feature switched off it is a complete, ordinary notes app, and that version is the reference for every screen.
Features do not add screens or toolbars: they either work in the **engine room** (in the background, with no controls) or
show their result in a small, fixed set of **slots** on the surface. One switch, **Egyszerű mód** (Simple mode), hides every
slot at once and puts the app back on the reference surface, without changing or losing any data. On the phone there is a
second look, **Ismerős** (Familiar), which reads like the notes app iPhone users already know; with it, features lean even
further into the engine room, so the phone feels like a black box that does complex things behind a few simple controls.

---

## 2. The rules

| # | Rule | What it means in practice |
|---|---|---|
| **R1** | **The simple surface is the app.** | The screens with no features on are designed first and are the spec. Every later screen is that screen plus slot contents, never a different layout. |
| **R2** | **One switch snaps back.** | *Egyszerű mód* hides every slot instantly. Nothing is deleted, converted or moved. Switching it off brings back exactly the previous surface. |
| **R3** | **Features only fill slots.** | A feature may render into the slots in §3 and nowhere else. No new tab, no permanent toolbar row, no screen that opens by itself, no extra field in plain note creation, no change to how typing works. |
| **R4** | **Big tools are visits.** | A tool that needs a full screen (canvas, calendar, board, PDF markup, plan view, "ask my notes") opens as a full-screen sheet from the `…` menu or a folder and closes back to where the user was. It visits; it never moves in. |
| **R5** | **There is a budget.** | However many features are on, the note screen shows at most 3 chips, 1 status dot and the `…` menu beyond the simple surface. A list row shows at most 2 small chips. Overflow collapses into a `+2` chip that opens a sheet. A test enforces it (§7). |
| **R6** | **Results, not processes.** | The engine shows outcomes ("Kovács lakás?" as a chip), never its workings (no progress bars for sync, no indexing screens, no encryption prompts in daily use). |
| **R7** | **Every automatic action can be seen and undone.** | Each note's `…` menu has **Háttérnapló** (Engine log): what the engine did to this note, when and why, each with *Visszavonás* (Undo). This is the trust valve that makes the black box acceptable. |
| **R8** | **Content stays plain.** | Whatever a feature adds lives in the note's frontmatter or beside the note, never inside the body text unless the user typed it. The body stays readable Markdown in any editor. A feature that rewrites text (AI cleanup) saves a new version and keeps the old one. |
| **R9** | **Protection never pauses.** | In Simple mode the features that protect data (saving, history, backup, sync, encryption, secret detection) keep running. Features that *act on content* (auto-tagging, job guessing, AI) pause. |
| **R10** | **Look and behaviour are separate settings.** | *Megjelenés* (Alap / Ismerős) changes the visuals and where the controls sit; *Viselkedés* (Kézi / Csendes) changes how much the engine does on its own. Both skins have the same screens and the same slots, so changing the look never makes it a different app. |

---

## 3. The surface and its slots

### 3.1 The simple surface (everything off)

| Screen | Phone | PC |
|---|---|---|
| **Folders** | folder list with counts; *Összes jegyzet*, the user's folders, *Nemrég törölt* | collapsible sidebar with the same list |
| **List** | notes newest first, grouped by date (*Ma*, *Előző 7 nap*, *Előző 30 nap*, then months), pinned on top; title, time, first line, a photo thumbnail if any | middle column, same rows |
| **Note** | title (the first line), date, text with checklists and photos; insert bar with *checklist*, *photo*, *more* | right column, same note; a slim toolbar |
| **Search** | one field above the list; searches titles, text and photo text | one field at the top of the window |
| **New** | one button; tap = an empty note with the cursor in it | a button, `Ctrl+N`, the global hotkey |

Simple-mode features that are part of the surface itself: folders, pin, checklist, photos and files, search, share / copy,
*Nemrég törölt* (30 days), the phone's share target, the PC's quick-note hotkey. That is roughly the feature set a long-time
iPhone notes user relies on, so nothing they reach for is missing.

### 3.2 The slots

| Slot | Where | Limit | Example contents |
|---|---|---|---|
| **S1 Row chips** | under a note's title in the list | 2 small chips | job name, due date |
| **S2 Header chips** | under the title inside the note | 3 chips, then `+N` | job, tag, reminder, type, visibility (only when not the default), conflict |
| **S3 Status dot** | one dot, beside the title (phone) or in the title bar (PC) | 1 | not synced yet · conflict · locked; nothing when everything is fine |
| **S4 `…` menu** | the note's menu | 6 rows, then *Több…* | export, report, history, lock, Engine log, visits (§2 R4) |
| **S5 Insert sheet** | Alap: behind **+** on the insert bar (and `/` on the PC); Ismerős: behind the camera button | a grid; never a new bar button | voice memo, scan, table, measurement form, link to a job |
| **S6 New-note hold** | long press on *New* (phone), the arrow beside *New* (PC) | a short list | note types: felmérés, telefon, mérés… Tap is always a plain note |
| **S7 Folders** | the folder list / sidebar | smart folders look like ordinary folders | *Beérkezett* (only when not empty), *Ma*, *Teendők*, a job's folder |
| **S8 Search hints** | under the search field while typing | chips, never required | `munka: Kovács`, `van fotó`, `teendő` |
| **S9 Settings row** | *Beállítások → Funkciók* | one row per feature | on / off, and in Csendes: *háttérben* / *javasol* |
| **S10 Capture points** | outside the app | — | phone widget, Quick Settings tile, share target, web clipper, mail pane, palette, QR on a cabinet |

Nothing else is a place a feature may draw. A new kind of slot is a decision for this document, not for a module.

---

## 4. Two looks, two behaviours

### 4.1 Megjelenés (look)

| | **Alap** (default; Android and Windows) | **Ismerős** (Familiar; phone only, optional) |
|---|---|---|
| Who | everyone who does not choose otherwise | people coming from an iPhone who want the app to read like the notes app they know |
| Visual language | VRG Mélyvíz via the VRG UI Kit: dark-first, hairlines, square controls with a cut corner, ice accent | iOS-style: system font, large bold screen titles, grouped rounded lists on a grey ground, an amber-yellow accent, light by default and following the phone's theme |
| Navigation | search bar at the top with the folder drawer behind its menu icon; a square **+** button bottom right | *‹ Mappák* back label at the top left; screen title large then shrinking on scroll; a bottom toolbar with the note count in the middle and the compose icon on the right |
| Note screen | top bar: back, pin, `…`; insert bar above the keyboard | top bar: *‹ back*, share, `…`, *Kész* (Done) while typing; bottom toolbar: checklist, camera, pen, compose |
| Gestures | long press a row for a menu; swipe to archive | swipe a row left for *pin* and *delete*; long press for a preview with actions |

Ismerős borrows the layout idioms a user has learnt (where the back label, the compose button and the toolbar are), not
anyone's branding: no Apple names, icons or assets, and the app keeps its own name and logo.

On the PC there is only Alap. The PC simple surface is the three columns of §3.1 with the sidebar folded away by default.

### 4.2 Viselkedés (behaviour)

| | **Kézi** (Manual) | **Csendes** (Quiet) |
|---|---|---|
| Default with | Alap | Ismerős |
| Chips | show what the user set; an *add chip* control in the header once any chip feature is on | filled by the engine as suggestions (dashed outline, a `?`); one tap accepts, a swipe dismisses; no add control |
| Insert sheet | every enabled feature as a tile | only the five most used; the rest under *Több* |
| Engine | does what it is told; asks before acting on content | acts on its own where the result is undoable, records each act in the Engine log |
| Settings rows | on / off | on / off, plus *háttérben* (engine only, no chip) or *javasol* (engine suggests a chip) |

### 4.3 What the engine does by itself in Csendes (examples)

| Feature | The user sees | The engine does |
|---|---|---|
| Munka (job) | a chip *Kovács lakás?* on a new note | guesses the job from the folder, the job opened last, the phone being near a job's address, or the Planner file open on the PC |
| Helyszíni fotó | a photo in the note, nothing else | stamps time, job and (if allowed) place; reads the text in it for search; keeps the original under any markup |
| Feladat, emlékeztető | a small date chip after typing *holnap* or *nov. 14* on a checklist line | creates the reminder and notifies on the phone and the PC |
| Szinkron | nothing, or one dot when something is wrong | syncs over the paired LAN relay, then the encrypted fallbacks |
| Titkosítás | nothing (one row in Settings, one recovery key at setup) | encrypts every note at rest and on the wire |
| Ütközés | a chip *2 változat* only for a real conflict | merges everything that merges cleanly |
| Ügyféladat | a quiet chip *belső* when a note with a name and address was set to *ügyfélnek* | keeps it out of every plain-text outlet and the Stack |
| Terepnapló | the job day's notes appear in *Ma* | rolls them up into that day's site diary with hours and photos |
| Diktálás tisztítása | the cleaned text | keeps the dictated original as a version (R8) |

---

## 5. Every module, by where it lives

All 96 modules of [ANALYSIS.md §6](ANALYSIS.md), by their main footprint. A module may also add one row in Settings (S9).

| Footprint | Modules | Count |
|---|---|---|
| **Surface** (part of the simple app; cannot be switched off) | N-UI, N-EDIT, N-CHECK, N-PIN, N-FOLDER, N-FIND, N-ATT, N-TRASH, N-SHAREOUT, N-QUICK, N-PHONE, N-SHARE, N-A11Y, N-I18N | 14 |
| **Engine room** (no surface at all) | N-VAULT, N-STORE, N-INDEX, N-API, N-CORE-TEST, N-JOURNAL, N-SYNC-LAN, N-SYNC-FILE, N-SYNC-GH, N-CRYPT, N-ENROL, N-SAFE-HTML, N-AUDIT, N-RECOVER, N-BACKUP, N-FSCK, N-FALLBACK, N-PERF, N-OCR, N-STACK, N-SEM, N-SPELL, N-DEV, N-CLI, N-LINKS, N-KEYS, N-SELECT, N-AI-TRANS, N-APPLOCK | 29 |
| **Chips** (S1, S2) | N-JOB, N-TAG, N-VIS, N-TYPE, N-REMIND, N-TASK, N-SOURCE, N-SITE, N-SECRET, N-MERGE, N-AI-TAG | 11 |
| **Status dot** (S3) | N-STATUS | 1 |
| **Menu and insert** (S4, S5, S6) | N-SLASH, N-TABLE, N-CODE, N-MATH, N-DIAG, N-VOICE, N-SCAN, N-ANNOT, N-INK, N-LINK, N-XLINK, N-EMBED, N-LOCK, N-MEAS, N-BUY, N-FOCUS, N-HIST, N-EXPORT, N-REPORT, N-ACTIONS, N-COMMIT, N-IMPORT, N-AI-CLEAN, N-AI-SUM | 24 |
| **Folders** (S7) | N-INBOX, N-SMART, N-DAILY, N-DIARY | 4 |
| **Visits** (R4) | N-CANVAS, N-GRAPH, N-CAL, N-BOARD, N-PDF, N-PLANPIN, N-AI-ASK | 7 |
| **Capture points** (S10) | N-WIDGET, N-TAG-QR, N-CLIP, N-MAILIN, N-PALETTE, N-SWITCH | 6 |

Consequences for ANALYSIS.md: **N-FOLDER moves from tier 2 to tier 1** (folders are part of the simple surface), and three
modules are added, all tier 0 or 1 because everything else hangs on them:

| ID | Module | What it is | Tier | Where |
|---|---|---|---|---|
| N-SIMPLE | Surface and slots | the profile (§6), the slot registry, the budget, the *Egyszerű mód* switch, the snap-back test | 0 | D+M |
| N-ENGINELOG | Engine log | *Háttérnapló* per note and per vault: every automatic act with reason and *Visszavonás* | 1 | D+M |
| N-SKIN | Ismerős look | the iOS-style phone skin on the same screens and slots; Csendes as its default behaviour | 1 | M |

---

## 6. How it is built

**The profile** is a per-device setting (the phone can be simple while the PC is full):

```json
{
  "simple": false,
  "look": "alap",
  "behaviour": "kezi",
  "features": { "job": "suggest", "tag": "visible", "site": "background", "ai-clean": "off" }
}
```

Per feature: `off` · `background` (engine only, nothing on the surface) · `suggest` (the engine fills a chip, the user
confirms) · `visible` (the feature's slot controls are shown). `simple: true` masks everything to `off` for the surface and
pauses every content-acting engine job (R9); the `features` map is kept untouched, so switching back restores it exactly.

**The slot registry** is the only way a feature reaches the surface:

```js
slots.register('job', 'header-chip', { priority: 30, render: (note) => chip(note.job) });
slots.register('report', 'menu', { group: 'export', label: 'Jelentés (PDF)', run: openReport });
```

The surface asks the registry for each slot, filtered by the profile and cut to the slot's limit by priority. A feature that
calls anything other than `slots.register` to draw is a review failure. The same registry exists in Kotlin
(`kit-core/notes/Slots.kt`) and in JS (`shared/notes-core/slots.js`), fed by one shared list of slot names and limits.

**The engine** runs jobs (index, sync, OCR, guess job, roll up diary…) that write only through the vault service and log
every content change to the Engine log with `{ note, feature, act, reason, undo }`.

---

## 7. How it is tested (the guarantees)

| Test | Passes when |
|---|---|
| **Snap-back** | with every feature on and `simple: true`, the rendered surface (DOM on the PC, the Compose semantics tree on the phone) is identical to the surface of the same vault data with every feature off (the prototype runs this comparison live) |
| **Round-trip** | toggling Simple mode on and off any number of times leaves the profile, the notes and the frontmatter byte-identical |
| **Budget** | with every feature `visible`, the note screen has at most 3 header chips + 1 dot + the menu beyond the simple surface, and a list row at most 2 chips |
| **Plain body** | after every engine job in the torture corpus, each note body equals what the user typed (or a new version exists and the old one is kept) |
| **Undo** | every Engine log entry produced by the corpus can be undone and the note returns to its prior bytes |
| **Skin parity** | Alap and Ismerős expose the same screens, the same slot set and the same actions (only visuals and positions differ) |

---

## 8. First start and the settings page

- **First start** on the phone asks one question: *Honnan jössz?* (Where are you coming from?) *iPhone* → Ismerős + Csendes;
  *Android* or *mindegy* → Alap + Kézi. Changeable any time.
- Every new install starts in **Simple mode** with nothing switched on. The user turns features on one at a time.
- *Beállítások → Funkciók* lists each feature with one line on what it does and **where it will appear** (*„csip a cím
  alatt”*, *„csak háttérben”*, *„a … menüben”*), so turning one on is never a surprise.
- At the top of that page: **Egyszerű mód** (the switch) and **Mindent vissza alapra** (turn every feature off, after a
  confirmation inside the page).
- *Egyszerű mód* is also a palette line on the PC and a long-press action on the phone's folder screen title, so snapping back
  is never more than two moves away.

---

## 9. Open decisions (A = recommended default)

| # | Question | A (recommended) | B / C |
|---|---|---|---|
| SIMPLE-Q01 | First start | **Simple mode, nothing on** | B the NT1 preset on |
| SIMPLE-Q02 | Scope of Simple mode and the profile | **per device** | B per vault (all devices together) |
| SIMPLE-Q03 | Ismerős on the PC | **phone only** | B also a PC skin |
| SIMPLE-Q04 | Behaviour default | **follows the look** (Ismerős → Csendes, Alap → Kézi) | B always Kézi until changed |
| SIMPLE-Q05 | Theme | **Alap follows the VRG theme (dark-first); Ismerős follows the phone's light / dark setting** | B both follow the phone |
| SIMPLE-Q06 | Chip budget | **3 in the note header, 2 in a row** | B 4 and 2 · C 2 and 1 |
| SIMPLE-Q07 | Ismerős accent | **amber-yellow close to the familiar one** | B the VRG warm accent |
| SIMPLE-Q08 | What may act alone in Csendes | **only acts that are undoable from the Engine log** | B also non-undoable acts with a confirmation |
