# VRG Sketcher variant protocol — the agent brief

*Codephrase **GO VARIANT** (`GO-VARIANT.md` at the repo root points here). You are the agent that turns a job's
premise into a **Variant Sketcher**: the same Sketcher, with its tools reshaped so they feel as if they were made for
this kind of work. You write one JSON file. You never change code.*

## 0. What a variant is (read once)

A variant is an overlay on the field kit (`Sketcher/catalog/fieldkit.json`), loaded by the phone (VRG Mobile, Vázlat)
and the Desktop page (`Sketcher/dist/vrg-sketcher.html`). In a survey the user picks it under ⚙ → Variánsok; a toggle
in the top corner then switches between the original and the variant at any moment, so a variant must make sense as
an *addition*: everything the original can do stays reachable.

What it can reshape (all optional; schema by example: `furdo-felujitas.json`, `ev-tolto.json`):

| Key | Reshapes | Rules |
|---|---|---|
| `id`, `name`, `sym`, `color`, `premise`, `topics` | how it is listed | id `a-z0-9-`, file `<id>.json`; `premise` 1–3 sentences; `topics` plain words |
| `plugins` `{on, off}` | tool packs | `alaprajz`, `villany`, `fotopont` (Jegyzet is always on) |
| `rail` | the tool rail's order (the first five are the ones in thumb reach) | tools: `select memo tag room line measure point circuit board route photo template` |
| `pointRing` | the point wheel's first ring, in order | types: `pont socket switch light junction data fixed sensor board` |
| `pointPresets` | the point brush row: labelled presets of a type with tags | `{label, glyph, type, tags[]}`; tags from the kit or this variant |
| `roomRing` | the room-type wheel's first ring | up to 7 of the Planner's room kinds (`nappali konyha halo furdo wc eloszoba kozlekedo etkezo dolgozo kamra gepeszet gyerek gardrob mosokonyha kulter egyeb`) |
| `templates` | the Sablon tool's room shapes | `{id, label, sym, poly}`: poly in the unit square, the user drags it to size |
| `tags` | the tag tray | `{id, name, color}`; use the presets' meanings only through the kit's tags |
| `scopePreset` | munkakör toggles switched on when the variant is first chosen | `{scope id: qty}` from the kit |
| `chips`, `scope`, `keywords`, `questions`, `shotlist`, `purposes` | extra quick chips, toggles, detectors, questions, shot-list items, photo purposes | the kit's shapes; a same `id` replaces the kit's entry |
| `hints` | one line per tool shown while it is active | `{tool id: text}` |
| `draw` | how the drawing tools behave (M49) | `{snapAngle: 0/15/30/45/90 (deg, the Vonal step), snapGrid: m (0-10), defaultRoom: {w, d} m (a tap lays it), measureFirst: bool, pointSnap: wall/free}`; all optional; use it when the job's shape is regular (halls: 90°, a coarse grid, a big tap room) |

The condition language for `when` and the effects for `sets` are in `docs/sketcher/README.md` §4. Questions follow
the house decision style: **2–5 short options, the likely one first, free text always possible**; `prio` 1 = ask
early; `who`: `ugyfel` (ask the client) or `szemle` (look yourself).

**Never put client data in a variant.** A variant is a *kind* of job and is committed to Git. A request may carry a
name, an address or a photo of someone's home: use what it teaches about the work, write none of it down.

## 1. The request

The user starts it on the phone: ⚙ → Variánsok → *Új variáns kérése*. The phone writes
`variant-request-<time>.json` (kind `vrg-sketcher-variant-request`):
`{premise, topics[], scope{}, from: {variant?, rooms, kinds[], points{type: n}, routes, entries, captures}, photos[]}`
and shares it (Átadás → PC: it lands in `inbox\board\<date>\` next to any photos the user added; or straight into a
Claude chat). The user then types `GO VARIANT` with the file, or pastes its premise. Without a request file, the user's
words are the premise.

## 2. The run, step by step

1. **Read** the request, `docs/sketcher/README.md`, `Sketcher/catalog/fieldkit.json` and every file in
   `Sketcher/variants/` (do not duplicate one; extend or replace it instead, and say so).
2. **If the premise is thin** (under a sentence, or no kind of work named), ask for one to three sentences, and offer
   the kit's munkakör toggles that fit as options to tick. Nothing else yet.
3. **Plan the first version without asking** (in your head or a scratch file, not the repo): for each reshapeable part,
   what this job needs first and what it never needs. Typical moves: the rail starts with the tools this job lives in;
   point presets name the job's own devices; the room ring starts with the rooms it happens in; a template for the
   shape the job usually has (a bathroom with a bath niche, a garage with a driveway); a `draw` block when the
   places are regular (a hall: 90° lines, a 1 m grid, a tap lays a 30 × 20 m room; a bathroom: a 10 cm grid); questions only this job needs,
   with `when` tied to its scope so they stay silent elsewhere; a shot list of what must be photographed for it.
4. **Ask the crucial questions back**, as numbered decisions with options and your recommendation first, at most
   five: what the focus is (drawing, client talk, photos, routing), what shape the places usually have, what must
   never be forgotten on site, which sizes matter, what goes wrong on such jobs. **Ask for photos** when shapes or
   devices are specific (1–5, through Átadás): read them and use them for templates, presets and the shot list.
5. **Write** `Sketcher/variants/<id>.json`. Keep it lean: a variant that changes everything is a different app.
6. **Check**: `node Sketcher/tools/variant-check.js` (exit 0), `node Sketcher/test/run.js`, then on a PC with the
   Android project `Mobile\mobile.cmd test` (or `cd Mobile/android && VRG_JVM_ONLY=1 ./gradlew :sketch-core:test`:
   FieldKitTest parses every variant). Rebuild the Desktop page: `node Sketcher/tools/build.js`.
7. **Report** to the user, short: a table *original → variant* per reshaped part, in Hungarian, as the user will see it
   ("A sáv: Szoba, Sablon, Méret… ", "Pont ecset: Tükörvilágítás, Aljzat IP44…"); what you left alone and why; anything
   you could not decide.
8. **Commit** on `main`: `Sketcher variant: <name>` with the files (variant + rebuilt dist). Pushing `main` is the user's
   call, as always. After the push the phone loads the variant from GitHub (⚙ → Variánsok → ⟳), and the next release
   bundles it.

## 3. Quality bar

- Every question passes the decision style; every `when` refers only to ids that exist; every regex is folded
  (lower case, no accents: the engine folds the notes before matching).
- The first five rail tools and the first ring of each wheel are where the job's hands go most.
- The variant must not hide anything the original shows: it reorders and adds. (`plugins.off` is for a pack the job
  truly never uses, e.g. Villany for a pure measuring survey.)
- Hungarian labels, short (a chip or wheel label is 1–2 words).
