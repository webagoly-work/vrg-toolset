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
| F5 Maradékok | `sketcher/f5-maradek` | the forks' leftovers (WP M50): wants in the Planner panel, a built-in Csere tag, the Felmérési jegyzőkönyv, the client's contact, `lineClose`, the sound note |

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
