# VRG Sketcher — the field instrument

*The user's brief of 2026-11-18: VRG Sketcher is "the instrument built for the on-site use of our software, a bundle of
tools and features giving every tool for **helyszíni szemle, méretvétel, munkafelmérés, adatbegyűjtés** — while basically
being a notetaker and a sketcher with the camera involved." One button reaches it on the phone (VRG Mobile, catalogue
id `sketch`) and on the Desktop (VRG Asztal unit `sketcher`, START key `S`).*

This folder is the design. The phone work packages are M24–M31 in `docs/mobile/WP/`; the Desktop page and the shared
catalog live in `Sketcher/` at the repo root; the agent protocol for variants is `Sketcher/variants/PROTOCOL.md`
(codephrase **GO VARIANT**).

## 1. What a survey is like, and what that demands

A *felmérés* is quick and often chaotic. The electrician does several things in parallel and is interrupted all the time:

- sketches the outline of the flat while walking it, marks installation points, routes, new installations;
- takes sizes;
- listens to the client explaining needs, requirements and context, and has to keep up with that;
- photographs the building, the meter, the board, the rooms;
- has to remember the questions that this kind of job needs answered.

**Information arrives in random order and in random lengths.** A size before the room exists; a note about the kitchen
while drawing the bathroom; half a sentence, then a photo, then back. So the architecture follows six rules:

1. **Every capture is a self-standing record.** A note, a quick-chip fact, an answer, a photo, a size, a point: each has
   its own id, time and payload, and is valid alone. No record needs another to exist first.
2. **Links are optional and may come late.** A note may know its room (the one last touched on the sketch, filled in
   automatically), a photo its point; either can be linked or re-linked later, never required.
3. **Completeness is derived, never stored.** "What is missing" (*Nyitott szálak*: the question not asked yet, the photo
   on the shot list, the guessed wall, the point with no type, the circuit with no board, the photo without a direction,
   the note marked *Tisztázandó*) is computed from what is there, every time. Nothing has to be "closed" to move on.
4. **Nothing half-done is lost.** The note being typed, the lineout being drawn, the photo waiting for its direction
   survive switching fronts, the screen locking and the app being killed (they are in the file).
5. **No front blocks another.** The two capture buttons (✎ note, ◉ photo) are on every front, open over it and return
   to exactly where the user was. The question badge is always in sight.
6. **The system grows with the job.** Toggles for what the job is (*munkakör*) and the client's wants are records like
   any other; the questionnaire and the shot list are a *digital shadow* computed from everything captured so far, so
   the next relevant question appears the moment it becomes relevant, and only then.

## 2. The fronts (one symbol, one colour each)

Symbols and colours, not text buttons. The same codes on the phone and the Desktop (`Sketcher/catalog/fieldkit.json`
`fronts`):

| Front | Sym | Colour | What it holds |
|---|---|---|---|
| Vázlat | ◫ | teal `#27c2b0` | M24: rooms, sizes, points, circuits, Elosztó, nyomvonal, memos, tags; M25 photo points |
| Jegyzet | ✎ | amber `#e0b020` | M27: the conversation log: text or dictation, quick chips instead of typing, background suggestions |
| Munkakör | ☰ | green `#3dae5a` | M28: what the job is and what the client wants (toggles, quantities), the scope card |
| Kérdések | ? | orange `#e8641c` | M28: the shadow questionnaire: options + free text, appears as the job takes shape |
| Kamera | ◉ | blue `#2a8cdb` | M29: purpose-tagged photos, the shot list, markup, series, gallery; M46: type-plate reading, blur and privacy on export, before / after, signature, walk video; M52: the in-app camera (purpose strip, series, ghost, torch, level, grid) |
| Helyszín | ⌖ | violet `#8a5cd6` | M30: address, GPS, VRG Térkép, the building footprint against the sketch; M48: the outline drawn on the map, the sketch placed on the building |
| Nyitott | ⚑ | red `#d64545` | M26: every loose end, one tap to jump to it |

Points, circuits and tags keep their own colours (M24); the front colours mark *functions*.

## 3. The data: one survey file

A survey is one `.vsketch.json` (kind `vrg-vazlat`, **v2**): the M24 sketch plus the intake. Everything is optional;
a v1 file opens with empty intake.

| Collection | Record | Meaning |
|---|---|---|
| `entries` | `{id E…, at, text, chips[], room?, target?, open, voice}` | a note or a chip-only fact; `open` = Tisztázandó |
| `scope` | `{id → qty}` | munkakör toggles; qty for countable wants |
| `roomScope` | `{room id → {id → qty}}` | M49: the part of a countable want that belongs to a room; `scope` stays the job total, the rest is *Általános* |
| `answers` | `{qid → {options[], text, at, state}}` | state `answered` / `later` / `skip` |
| `captures` | `{id C…, file, purpose, at, room?, target?, shot?, note, lat?, lon?, marks[]}` + M46 `{kind?, phase?, pair?, privacy?, keepGps?, ocrAt?, ocr[]?, durationMs?, bytes?, signer?}` | a purpose photo (or M46: a walk video, a signature); `shot` = the shot-list item it fulfils; marks = vector markup over the photo (M46: also blur `elmos` / `elmos_ecset`); `pair` = an after-photo's before; `ocr` = what the type-plate reader found |
| `site` | `{address, lat?, lon?, source, footprint?, outline?, place?}` | the place; footprint = the building's outline measured from the map; outline = its corners `[lat, lon]` (OSM, drawn, or traced over satellite); place = where the solved sketch sits on it `{lat, lon, rot, auto}` (M48) |
| `dismissed` | `[ids]` | suggestions and shadow items the user swiped away (they do not come back) |
| `seen` | `{id → time}` | when a shadow question first appeared (new ones are marked) |
| `variant`, `variantOn` | id, bool | the active variant and the corner toggle |
| `draft` | text | the note being typed |
| `client` | `{name, phone, email, keep?}` | M50: the client's contact; personal: stripped from what leaves the phone unless `keep` (D-82) |

## 4. The shared catalog (`Sketcher/catalog/fieldkit.json`)

One JSON, read by the phone (bundled as an asset: the folder is an asset dir of `feature-sketch`) and the Desktop page
(inlined at build). It is data only: no code ships with a question.

- `fronts`, `purposes` (photo purposes with symbol and colour), `chips` (quick note buttons), `scope` (toggles, groups
  *jelleg / terület / rendszer / igény*), `keywords` (the background processes behind the notes), `questions`,
  `shotlist`, `templates` (room shapes for the stamp tool).
- **Conditions** (`when`): `true`; `{"scope": id|[ids]}`; `{"answer": qid}` / `{"answer": qid, "is": opt|[opts]}`;
  `{"room": kind|[kinds]}`; `{"point": type|[types]}`; `{"tag": id|[ids]}`; `{"kw": id|[ids]}`; `{"chip": id|[ids]}`;
  `{"photo": purpose|[purposes]}`; `{"site": true}`; `{"variant": id}`; `{"all": [..]}`, `{"any": [..]}`, `{"not": c}`.
  A list means *any of*.
- **Effects** (`sets`, on an answer option, a chip, a keyword's suggestion): `{"scope": [ids]}`, `{"answer": {"q", "opt"
  | "text"}}`, `{"tag": id}`. A chip or option the user tapped applies at once; a keyword only **suggests** (a ghost
  chip to accept or swipe away).
- Keywords match on folded text (lower case, accents removed); `$0` in a suggested answer text is the matched words.

The Kotlin engine (`sketch-core` `FieldKit.kt`) and the JS engine (`Sketcher/lib/fieldkit.js`) implement the same
language; `Sketcher/test/fixtures/shadow.json` is written by the JS engine and replayed by the JVM test, so the two
cannot drift (the Kommand-fixture pattern of M19).

## 5. Variants

A variant reshapes the Sketcher for one kind of job: which tools and in what order, the point brushes and their labels,
the room kinds first on the wheel, room-shape templates, extra tags, preset scope, extra chips, questions and shot-list
items, hints. It is a JSON overlay on the catalog (`Sketcher/variants/<id>.json`), never code, so any agent can write
one and the app cannot be broken by it (`node Sketcher/tools/variant-check.js` validates).

The user starts a variant from the phone (⚙ → *Új variáns*: one to three sentences, keyword chips, optionally photos);
the phone packs a request and hands it to an agent (Átadás to the PC, or the Claude app) with the codephrase
**GO VARIANT**. The agent follows `Sketcher/variants/PROTOCOL.md`: reads the request, plans a first version, asks the
crucial questions back, writes and validates the variant, commits it to `main`. The phone picks it up from GitHub
(and from its bundled assets after the next release). In a sketch, ⚙ lists the variants; the chosen one shows as a
toggle in the top corner, switching between the original and the variant at any moment. Its long press (RCO) lists the variants,
the original, ⟳ refresh and ＋ request; the same list (each variant starting a new survey) is on the long press of the
Sketcher's home tile and its Asztal dock dial (M49, D-73).

A variant can also **tune the drawing tools** (M49, D-74): an optional `draw` block with `snapAngle` (the Vonal tool's
step: 0 / 15 / 30 / 45 / 90°), `snapGrid` (m: corners land on the grid unless a neighbour's corner line is near),
`defaultRoom {w, d}` (m: a tap on paper with Szoba lays a room of that size), `measureFirst` (a new room opens its size
dialog), `pointSnap` (`wall` / `free`) and, since M50, `lineClose` (`auto` / `ask`: what the Vonal tool's Kész does with 3+ corners, D-83). Metres follow the sketch's current scale. `sketch-core` `DrawTune.kt` is the
logic; a bad value falls back to the original on the phone and fails `variant-check`.

## 6. Where things run

| Piece | Phone (VRG Mobile) | Desktop (VRG Asztal / START) |
|---|---|---|
| capture: sketch, notes, scope, questions, camera, site | all (`feature-sketch` + `sketch-core`) | review and complete: answer questions, read notes, attach photos (`Sketcher/dist/vrg-sketcher.html`) |
| the catalog and variants | assets + `main` via GitHub | inlined + the repo |
| VRG Térkép | the phone's own map (M43) on the survey: outline drawn / corrected, 🛰 satellite, the sketch placed (M48); the PC's through the relay as before | embedded `localhost:8802/?embed=1`, the survey handed to it by postMessage (M48) |
| the Planner | the package (M24) | Planner → Terv betöltése fájlból |
| the takeoff (Munkakör lap, M47) | live on the Munkakör front; `.takeoff.json` + `.md` with the Rendezés export | the Munkakör front, ⇩ Takeoff; `node tools/sketch-takeoff.js`; in the Planner ⌘K → Felmérés: munkakör lap |

Decisions taken while building: D-27 … D-34 in `docs/mobile/DECISIONS.md`; Kamera 2 (M46): D-55 … D-61 and D-90 (every feature built in, on by default, switchable); survey to quote (M47): D-67 … D-71, D-77 … D-79; the site placement (M48): D-62 … D-66; the small gaps (M49): D-72 … D-76; the leftovers (M50): D-80 … D-84; the in-app camera (M52): D-100 … D-109; tested together (M53): D-110 … D-116; the jegyzőkönyv on the phone (M54): D-120 … D-128.

## 7. Kamera 2 (M46)

The camera's second round (`docs/mobile/WP/M46.md`): label and type-plate photos are read on the phone (`sketch-vision`
`TextReader`, ML Kit bundled; parsed by `sketch-core` `TypePlate.kt`) and their numbers offered as chips that fill an
answer or a note only when tapped; blur (▦ / ▒) kept as vectors and burned in on export, a *Személyes adat* flag, GPS
stripped from every exported copy unless kept; before / after pairs compared with a slider; the client's signature as a
*dokumentum* capture; the walk video as a capture of kind video; the ◉ hold menu leads with the next missing shots,
and „＋ még” repeats the last purpose. Faces are found on the phone too (`FaceFinder`) and proposed as blur rectangles.
Every one of these is a switch in ⚙ → *Kamera funkciók* (`CameraFeatures`, one setting per phone, D-90). The rules are pure Kotlin in `Camera2.kt`, tested on the JVM.

## 8. From survey to quote (M47)

The scope toggles, the answers and the drawing together say how much work the job is. The **takeoff**
(`Sketcher/lib/takeoff.js` and its Kotlin twin `sketch-core/Takeoff.kt`, rules in `Sketcher/catalog/takeoff.json`) turns
them into work items with quantities: points by type and action, machines, circuits, boards, cable metres, systems; ≈
where it is a guess, ⚑ where an open question can still change it. It carries no prices. The export
(`vrg-sketch-takeoff` v1 + a Hungarian summary) is the hand-over to the Varler Workflow Kit on the PC; the contract and
the brief for that session are in `TAKEOFF.md`. The Planner keeps the intake and the takeoff with the job.

## 9. The small gaps (M49)

Fork F4 (`docs/mobile/WP/M49.md`): the client's **wants per room** (Munkakör → Igények → *Hová* and *Szobánként*; a
long press re-links one; `sketch-core` `Wants.kt` = `fieldkit.js` `wants`, pinned by the shared fixture; the Planner
package carries `sk.wants` per room and `plan.wants`); the **variants on the long press** of the Sketcher's tile, dock
dial and corner toggle (`SketchLaunch.kt`); variants that **tune the drawing tools** (§5, `DrawTune.kt`); the kit's
*égett* detector skips *kiégett*; the deadline question has a date field.

## 10. The leftovers (M50)

Fork F5 (`docs/mobile/WP/M50.md`): the Planner's survey panel shows the **wants by room**; **Csere** is a built-in tag
(preset `replace`, the takeoff's *csere*); the Desktop page's **Jegyzőkönyv** button prints the *Felmérési jegyzőkönyv*
(`Sketcher/lib/report.js`, Varler Papír, built from the open file, never stored); Helyszín holds the **client's contact**
(`ClientInfo.kt`, personal, D-82); a variant's `draw.lineClose` (`auto` / `ask`) says what the Vonal tool's Kész does;
a phone without a speech recogniser records a **sound note** (capture kind `audio`, `.m4a`, `AudioNotes.kt`).

## 11. Feature switches (M51)

Fork F6 (`docs/mobile/WP/M51.md`, D-91 … D-99), the Founder's rule D-90 for the whole Sketcher: **every feature has a
switch, each group and everything has a Mind switch, everything is on by default** (except D-79's implied dedicated
circuits), and the setting lists only what differs, so a new feature arrives on. The list is
`Sketcher/catalog/features.json` (73 features in 9 groups: the 7 fronts, Variánsok, Rendezés / export); `sketch-core`
`Features.kt` and `Sketcher/lib/features.js` switch it the same way (fixture `test/fixtures/features.json`).

- Per phone (⚙ → ⚙ Funkciók ›, or the Kamera front's ⚙ Funkciók tile) and per browser (the Desktop's ⚙ Funkciók front),
  never per survey; survey plugins stay per survey.
- Off = no trace in the UI (rail, wheels, chips, fronts, cards, badges, Nyitott, the map's site panel, the files beside
  the package); the survey's data stays, the package file is the same, privacy on export is unchanged.
- A feature that needs another is greyed while that one is off; a front with nothing on leaves the front bar; a variant
  never brings back what the user switched off.
- The camera's switches (F3, F7's Saját kamera included) and F5's four are part of the list; their settings stay where they were saved.

## 12. Saját kamera (M52)

Fork F7 (`docs/mobile/WP/M52.md`): ◉ opens the Sketcher's **own camera** (CameraX, `feature-sketch` `LiveCamera.kt`)
instead of the phone's camera app; the photo takes the same path into the survey, so the file format, the Desktop page
and the exports do not change. On the viewfinder: the purpose badge and its strip (the shot list's next missing items
first), the room, the count, a series until ✓ with the last thumbnail and ↶, the before-photo as a ghost for an
after-photo, torch, tap-to-focus, pinch zoom, the level line and the grid. The pure half is `sketch-core`
`CameraLive.kt`. Every part is a switch in ⚙ → Kamera funkciók; *Saját kamera* off (or CameraX failing on a phone)
brings the camera app back.

## 13. Tested together, end to end (M53)

Fork F8 (`docs/mobile/WP/M53.md`) checks the forks' seams with real surveys rather than one feature at a time. The
phone's code writes the scenarios (`sketch-core` `E2eTest.kt` → `Sketcher/test/fixtures/e2e/`): a flat renovation with
everything F1–F5 added, a new house with the implied dedicated circuits on, a conversation with nothing drawn, and two
old files (M24 v1, M29-era v2). `Sketcher/test/e2e.test.js` opens the same files with the JS engines, the Desktop page
and the Planner and must see the phone's numbers. The tests, in one place:

| What | Command | Fixture written by |
|---|---|---|
| the field kit twin | `node Sketcher/test/run.js` + `:sketch-core:test` | `Sketcher/tools/make-fixture.js` (`shadow.json`) |
| the site maths twin | the same | `Sketcher/tools/make-site-fixture.js` (`site.json`) |
| the takeoff twin | the same | `Sketcher/tools/make-takeoff-fixture.js` (`takeoff.json`, the Planner's `sketch-intake.json`) |
| the Planner package | `:sketch-core:test`, Planner spec-111 / spec-112 | `WheelJsonExportTest` (`sketch-field.json`, `VRG_SKETCH_FIXTURE=update`) |
| end to end | `node Sketcher/test/run.js` + `:sketch-core:test` | `E2eTest` (`fixtures/e2e/`, `VRG_SKETCH_FIXTURE=update`) |
| the two-phone plan | `node Sketcher/tools/test-plan.js --check` | every WP's *Telefonon ellenőrizni* list |

## 14. The jegyzőkönyv on the phone (M54)

Fork F9 (`docs/mobile/WP/M54.md`): Rendezés → **📄 Jegyzőkönyv** makes the same *Felmérési jegyzőkönyv* as the Desktop
page on the phone: `Sketcher/lib/report.js` + `fieldkit.js` + `report-phone.js` bundled as assets and run in a hidden
WebView; the drawing and the site from `PlanSvg.kt` / `SiteSvg.kt` (= `app.js` `svgPlan` / `sitePlaceSvg`, fixture
`test/fixtures/report.json` by `tools/make-report-fixture.js`); out as **Nyomtatás / PDF** (the system print dialog) or
**Átadás** (`<név>.jegyzokonyv.html`, photos inside). The export rules apply (client only when kept, no GPS, blur burned
in, personal photos only blurred); *Az ügyfélnek* also drops the Tisztázandó notes and the Ellenőrizni lines. Switch:
⚙ → Funkciók → *📄 Jegyzőkönyv a telefonon* (registry `export.report_phone`, requires `export.report`).

Decisions taken while building: D-27 … D-34 in `docs/mobile/DECISIONS.md`.

## 15. Open dev line: Kamera+ (room box, measuring, house 3D)

Opened 2026-11-20: `CAMERA-LINE.md` (stages K1–K7, open questions Q1–Q4), research in
`docs/research/2026-11-20_room-capture-and-measurement.md`. **K1 Szobadoboz is built (WP M57, BETA):** on the Desktop
page, Vázlat → ⬚ Szobadoboz (3D) raises the plan's rooms to their ceiling height and projects the Fotópont photos onto
the walls (offline WebGL, no AI; `lib/roombox.js` + `lib/roombox-gl.js`). It has a dollhouse view, a view standing at
the photo point, and per-photo fine-tuning saved in the survey's `box` key. **K1b is built (WP M59, BETA):** the same
box on the phone (Rendezés → ⬚ Szobadoboz, a WebView with `lib/roombox-phone.js` as the touch UI). The phone keeps the
`box` key, and the in-app camera opens Fotópont at the widest zoom and stores each shot's lens. **K3 is built (WP M60, BETA):**
📏 Mérés on any photo (phone and Desktop, one screen: `lib/plane.js` + `lib/plane-ui.js`). Four corners of a known
rectangle on the wall give true distances and heights above a floor line; the results go into the survey's `planes` key.
