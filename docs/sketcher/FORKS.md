# VRG Sketcher — the fork worklines (2026-11-20)

The Founder, 2026-11-20: build every remaining idea of the VRG Sketcher brief (`../mobile/WP/M26.md` … `M31.md`,
`README.md`) as complete as possible without them, in parallel fork sessions; then test with two phones at once.
One **coordinating session** (the one that wrote this file) spawns the forks, merges them into `main` one by one and
tells the Founder when a fork can be archived.

| Fork | Branch | What |
|---|---|---|
| F1 Helyszín ↔ Térkép | `sketcher/f1-helyszin` | the Sketcher's Helyszín on the phone's own VRG Térkép (M43); the building outline drawn or corrected on the map / satellite; the sketch placed on the map: position and orientation, not only size |
| F2 Felmérés → árajánlat | `sketcher/f2-arajanlat` | the survey's scope, quantities, answers and lengths into the Planner, and a takeoff / intake export the Varler Workflow Kit can read |
| F3 Kamera 2 | `sketcher/f3-kamera` | the camera's second round from `../research/2026-11-18_field-survey-camera-notes.md`: type-plate OCR, privacy on export, before / after, client signature, walk video |
| F4 Apró hiányok | `sketcher/f4-finom` | client wants per room, variants on the long-press (RCO) menu, variants that tune drawing-tool behaviour, the kit's „égett” detector |
| F5 Maradékok | `sketcher/f5-maradek` | what F1–F4 left out: wants per room in the Planner, the survey report, client fields, draw extras, the audio note (WP M50, D-80…D-89) |
| F6 Kapcsolók | `sketcher/f6-kapcsolok` | the Founder's rule D-90 for every Sketcher feature: one registry, a switch for each and for all, phone ⚙ + Desktop (WP M51, D-91…D-99) |
| F7 Saját kamera | `sketcher/f7-kamera` | an in-app camera (CameraX): ghost overlay for after-photos, purpose bar and next shots on the viewfinder, series, torch, level; the camera app stays the fallback (WP M52, D-100…D-109) |
| F8 Összefésülés | `sketcher/f8-osszefesules` | the seams between the forks merged in parallel: end-to-end tests phone → package → Desktop → Planner, a cross-fork audit and its fixes, the docs and decision index made whole (WP M53, D-110…D-119) |
| F9 Jegyzőkönyv a telefonon | `sketcher/f9-jegyzokonyv` | the survey report printed and shared from the phone (D-81 B, the plan in WP M50): `report.js` as an asset in a WebView, PlanSvg / SiteSvg, PrintManager PDF + Átadás HTML, the export privacy rules, *Az ügyfélnek* mode, a D-90 switch (WP M54, D-120…D-129) |
| F10 Rendszerleírás | `brief/f10-rendszerleiras` | the whole VRG devline described for outside design sessions, in two anonymous versions (A: no personal data; B: the trade hidden too), with an AI brief each, one-file packs and an anonymity check (`docs/brief/`) |

## Rules every fork follows

1. **Work on your own branch only** (the table). Never push `main`; the coordinating session merges. Merge
   `origin/main` into your branch whenever it moved (other forks land there), and once more right before you finish.
2. **Stay additive in the shared files.** Three forks touch `sketch-core` (`Model.kt`, `SketchJson.kt`, `FieldKit.kt`),
   `feature-sketch` and the Desktop page at the same time: add fields with defaults, new files over edits to big
   ones, no renames, no reformatting of lines you do not change. The survey file stays **v2**: new keys are optional
   and an old file opens unchanged (test it).
3. **Tests are the gate.** `cd Mobile/android && VRG_JVM_ONLY=1 ./gradlew :sketch-core:test` (and the other pure
   modules you touch), `node Sketcher/test/run.js`, `node Sketcher/tools/variant-check.js`, `node Sketcher/tools/build.js`
   (commit the rebuilt dist), the Planner specs you touch. Android UI code compiles only in GitHub Actions (no SDK in the
   cloud): push, then read the run (`mcp__github__actions_list` / `get_job_logs`) and fix until **VRG Mobile (Android)**
   is green on your branch. A Compose syntax error costs a CI round: read your Kotlin twice.
4. **Docs in the same change:** the WP file (`docs/mobile/WP/M<nn>.md`, take the next free number at the time you
   write it and say which in your report), `docs/mobile/DECISIONS.md` for every choice you made for the Founder
   (next free D-number), the roadmap row in `docs/mobile/README.md`, `docs/sketcher/README.md`, a **Telefonon
   ellenőrizni** list (Hungarian, numbered, the steps the Founder will do with two phones). START / catalog entries if
   a tool page changes (`node tools/check-start.js`, `node tools/check-catalog.js`).
5. **Do not stop to ask.** Take the recommended option, write it down as a decision, carry on. Collect the questions
   for the Founder at the end of a message: numbered, options with the recommended one first, **Hungarian first and
   English below**, each with a one-line **TLDR (ELI5)**.
6. **The progress line at the very end of every message:** your steps as nodes on one line, done coloured, the
   current one ringed, the rest grey, with n/m:
   `node tools/progress-svg.js --title "F1 Helyszín" --steps "a|b|c|…" --done 3 --current --out <scratchpad>/progress.svg`,
   then send that file (SendUserFile, display render) as the last thing in the message. Keep the same step list for the
   whole fork.
7. **When finished** (branch green, merged with the latest `main`, docs written): send the coordinating session a
   message (`mcp__claude-code-remote__send_message`, session id in your brief) with the branch, the head SHA, the WP
   and D numbers, what was built, what was left out and why, and the questions. Then stop; the coordinator merges and
   tells the Founder the fork can be archived.
8. Client data never enters Git (`../../CLAUDE.md`, `../../Sketcher/variants/PROTOCOL.md`). No model names in commits.

9. **Modular, switchable, integrated (the Founder's general rule, D-90, 2026-11-21):** build upcoming features in and
   ship them on, but make every feature a module with its own switch in the settings (each one, and all at once), with
   the stored setting being what the user turned **off**, so new features arrive on. User preference first: a feature
   the user switched off leaves no trace in the UI or the exports. Camera features already work this way
   (`sketch-core` `CameraFeatures`, ⚙ → Kamera funkciók); follow that pattern.

## Status (coordinator)

- F1 → WP M48 (D-62…D-66), F2 → M47 (D-67…D-71), F3 → M46 (D-55…D-61), F4 → M49 (D-72…D-76): all on `main` (ec6b90b), the sessions archivable.
- Up to four forks run at once (the Founder, 2026-11-21); finished sessions are archived by the Founder later.
- F5 Maradékok (`sketcher/f5-maradek`, WP M50, D-80…D-89) builds what the forks left out. F2's answers took D-77…D-79 (the Csere tag, the 300 mm reserve, implied dedicated circuits behind a toggle); F3's second round (the Founder's answers, face detection, every camera feature switchable) took D-90.
- **The two-phone test:** `node Sketcher/tools/test-plan.js` writes `TEST-2PHONES.md` + `test-2phones.json` from every WP's
  „Telefonon ellenőrizni” list (A: rajz és beszélgetés, B: kamera és helyszín, X: közös). Re-run it after a WP's list
  changes (`--check` exits 1 when stale). The shared checklist page (live ticks from both phones, the Hibák list) is
  https://claude.ai/artifact/9VoTwfpDVMwpuYgNMfvEre (Archive: Kéttelefonos teszt).

- **2026-11-21 02:10 — all ten forks merged** (main fdb8b2d + the archive refresh): F1 M48, F2 M47, F3 M46 (+ D-90), F4 M49,
  F5 M50, F6 M51, F7 M52, F8 M53, F9 M54, F10 `docs/brief/`. Every session is archivable. Next: the release, then the
  two-phone test (`TEST-2PHONES.md`: A 83, B 77, közös 7; the shared checklist page in the Archive).
- **2026-11-22 — every question answered, every fork session archived.** The Founder's answers: F2 (D-77…79), F3 (D-56/57/59, D-90), F5 (D-80…82), F6 (D-92/94/98), F7 (D-101: no video in the in-app camera), F8 (D-113, D-115, D-116), F9 (D-124), F10 (`docs/brief/README.md`: B stays). Release 0.9.660 (`mobile-v660`) carries all ten forks; next is the two-phone test.
