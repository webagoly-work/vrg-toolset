# VRG Jegyzetek: the central Notes app

One Notes app that users mainly work in, and that every other feature writes into instead of keeping its own
notes. Phone first (VRG Mobile, WP M69, `docs/mobile/WP/M69.md`); the Desktop page comes later and reads the
same files. Decisions: D-177 (phone first), D-178 (the private `vrg-notes` branch), D-179 (a linked mirror) in
`docs/mobile/DECISIONS.md`.

```
Notes/
  catalog/noteskit.json   modules, versions (profiles), note templates, origins: data only, one source
  tools/check.js          validates it (exit 1 on a problem): node Notes/tools/check.js
```

## 1. The note (`vrg-note` v1)

`id, title, body (Markdown, tasks as "- [ ] …"), tags[], book?, pinned, archived, trashed, purged, mono, created,
updated, device, origin?`. **`origin` is not a tag**: `{app, ref, label, facts[], open, seen, gone}` says which app
and which record a note came from, so "came from the Sketcher" can never be mistyped or mixed up with the user's
own tags. A note written in the app has no origin (`kezi`). Rules and tests: `Mobile/android/kit-core/.../NoteHub.kt`,
`NoteHubTest`.

## 2. Versions and modules

The app is one build with every module; a **version** (profile) is a list of modules, switched in ⚙ → Változat,
instantly and without touching a note. Core modules (editor, search, tags, pin/archive/trash, origin filter) are in
every version; a `planned` module is listed as "hamarosan" and never on. On top of a version the user can switch
single modules; "Vissza a változat moduljaira" clears that.

| Version | For | Modules beyond the core |
|---|---|---|
| **Egyszerű** | just notes | none |
| **Terepi** (default) | on site, one hand | Gyorsjegyzet, Diktálás, Teendőlista, Beérkező, Jegyzetsablonok, Megosztás |
| **Iroda** | at the desk | Füzetek, Formázás, Teendőlista, Jegyzetsablonok, Megosztás, Beérkező |
| **Fejlesztő** | dev work | Gyorsjegyzet, Napi jegyzet, Kód, Formázás, Teendőlista, Projektnapló, Megosztás, Diktálás |
| **Teljes** | everything | every module that is built |

A new version is one entry in `profiles`; a new module needs code in `feature-notes` (its id gates what shows).

## 3. Plugging a feature in (an origin)

1. Add the origin to `origins` in `noteskit.json`: `id`, `label`, `sym`, `color`, `about`; `client: true` when its
   notes can carry client data; `mirror: true` + `feature` + `link` when the feature keeps its own records.
2. In the feature (VRG Mobile), call kit's hub, never a store of your own:
   - `Notes.init(app)` in the feature's `init` (idempotent).
   - One-way notes: `Notes.add("<origin>", text, title, tags, label)`.
   - A linked mirror of your own records: `Notes.mirror("<origin>", "<scope>/", items)` after each save, where
     `items` are `MirrorItem(ref = "<scope>/<record>", text, label, facts, open)`; on opening a scope,
     `Notes.pull("<origin>", ref, currentText)` gives the text to take over (edited in the app), or null.
   - "Open in the source": `Notes.onOpen("<origin>") { ref -> … }` in `init`; the app then opens your feature.
3. `node Notes/tools/check.js`, and `cd Mobile/android && VRG_JVM_ONLY=1 ./gradlew :kit-core:test`.

The mirror's rules (`NoteMirror`): the source changed → the note follows; the note changed → the source takes it
when it next opens; both changed → the note keeps both texts (nothing is lost) and the source takes that; a note in
the trash is never revived by its source; a deleted record marks its note `gone` and the note stays.

**First origin: the VRG Sketcher's Jegyzet front** (phone): every entry is also note `sketcher-<survey>-<entry>`,
labelled "<survey> · <room>", with the quick chips as facts. Planned origins: the Divergence dev note, the Planner.

## 4. Sync

Each device keeps its notes (`files/notes/hub.json` on the phone) and syncs with the private repo's `vrg-notes`
branch: one file per note, `notes/<id>.json`, sha-guarded writes. When both sides changed a note, the newer change
keeps it and the other is saved as a separate note tagged `ütközés`. Emptying the trash leaves a tombstone, so no
device brings the note back. Commit messages name the note id only.

**Client notes are sealed** (D-180, the Workflow Kit's way, D-52): a note of a `client` origin, a copy made from one, a
note from a template with `"seal": true` and any note locked with 🔒 is on the branch only as ciphertext
(`vrg-note-sealed`: AES-256-GCM, the key wrapped per device with P-256 ECDH). It opens on this device and on the
devices whose 6-character code was typed in ⚙ → Lezárás (pinned on the device, never in Git); each device publishes
its public key as `keys/<ID>.json`. A new origin that can carry client data sets `"client": true` and is sealed
from then on. Rules and tests: `kit-core/.../NoteSeal.kt`, `NoteSealTest`.
