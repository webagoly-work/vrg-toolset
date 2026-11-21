# VRG Sketcher — the takeoff (Munkakör lap) and its export contract

*Fork F2 "Felmérés → árajánlat", 2026-11-20, WP M46 (`../mobile/WP/M46.md`), decisions D-55 … D-62.*

The Founder: *"Some combination of selectable toggles can express the nature of the job but also can add concrete wants
and needs to the order — the point is that these create the natural categorizations that **outline the scope and
contents of the amount of work needed** from the given job."*

The survey (`*.vsketch.json`, kind `vrg-vazlat` v2) already holds what the job is (the Munkakör toggles and quantities),
the answers, the notes and the photos, and the drawing. The **takeoff** turns all of it into work items with quantities:
what has to be done and how much of it, what is still a guess (≈) and which open question can still change a number
(⚑). It has **no prices**: pricing is the Varler Workflow Kit's (`takeoff.js → price.js → offer.js` on the PC).

## 1. Where it runs

| Where | What | Code |
|---|---|---|
| the rules | data only: heights, the cable allowance, which tags mean what, which wants are machines, systems, the decisions | `Sketcher/catalog/takeoff.json` (bundled into the phone with the field kit) |
| the phone | **Munkakör lap**: at the top of the Munkakör front, live as the survey fills; the Rendezés export puts the takeoff inside the package and `<stem>.takeoff.json` + `<stem>.takeoff.md` beside it | `sketch-core/Takeoff.kt`, `feature-sketch/TakeoffUi.kt`, `NormScreen.kt` |
| the Desktop | Munkakör front: the same lap; **⇩ Takeoff** downloads the two files; *Mentés* writes the package with its takeoff | `Sketcher/lib/takeoff.js`, `Sketcher/src/app.js` |
| the CLI | `node tools/sketch-takeoff.js <package.json> [--out dir] [--reserve mm] [--loose mm] [--stdout] [--md]` | `tools/sketch-takeoff.js` |
| the Planner | *Terv betöltése fájlból* keeps the intake and the takeoff with the job (`B.survey`); ⌘K → **Felmérés: munkakör lap** | `Planner/…/src/08cb-sketch-survey.js` |

The JS engine and the Kotlin engine are twins. `Sketcher/tools/make-takeoff-fixture.js` runs the JS engine over six
surveys (the Planner's fixture package with and without an intake, a bigger allowance, a bare survey with demolition,
replacement, two boards, home runs and a variant, the same without the variant, an empty one) and writes
`Sketcher/test/fixtures/takeoff.json`; `TakeoffTest` replays them through Kotlin and must give the same document value
by value and the same summary character by character. A second test checks that the phone's own solve gives exactly the
plan the package carries, so the phone, the Desktop and the CLI agree on every number.

## 2. The input

A **package** (kind `vrg-sketch`, what the phone's Rendezés and the Desktop export): the survey in `sketch` and the
solved plan in `plan.data` (integer millimetres: floors with `sk.id` and `sk.est`, devices with `sk.id` and `h`, paths
with `sk.id` and their nodes). Or a **bare survey** (kind `vrg-vazlat`): no solve, so the sketch is read at
`cable.rawScaleMm` (25 mm per unit) and every room and length is ≈.

## 3. The rules (what each number means)

- **Points** by type and **action**: a *Bontás* tag (preset `remove`, or a tag named *bontás*) → bontás; the *Csere* tag
  (preset `replace`, built in since D-60; an older survey's own tag named *csere* counts too) → csere; otherwise *Tervezett* →
  új, *Meglévő* → meglévő marad (listed, `work: false`). A point without a type is ≈.
- **The Igények reconcile with the drawing**: *Dugalj*, *Kültéri aljzat* → socket; *Kapcsoló* → switch; *Lámpa* →
  light; *LAN-pont*, *TV-pont*, *IP kamera* → data. The new count is `max(drawn, wanted)`; when more is wanted than
  drawn it is ≈ with a note (*Munkakör: 4, vázlat: 1*).
- **Machines** (gépbekötés): Főzőlap, Sütő, Mosógép, Mosogatógép, Szárítógép, Bojler, CEE aljzat (new toggle),
  Törölközőszárító, Szellőző. When their number differs from the drawn *Fix bekötés* points a check line says so
  (*Ellenőrizni*).
- **Circuits**: drawn circuits with members, *általános* and *dedikált* (the circuit's own flag, a *Dedikált* tag on it
  or on a member). The machines and systems marked `dedicated` imply one each (a Klíma per indoor unit). **By default
  nothing is assumed** (D-62, `impliedDedicated: false`): the dedicated count is what is drawn, and a check line says how
  many the machines may need. With the general toggle on (phone: the Munkakör lap's *◉ Dedikált kör a nagy gépeknek*;
  Desktop: the same button; CLI: `--implied-dedicated`) the count is `max(drawn, implied)`, ≈ when the implied number
  is larger.
- **Boards**: the one feeding the most circuits is the *Elosztó*, any other is taken for an *Alelosztó* (≈). With the
  *Elosztó csere* toggle an existing main board that has no tag is a csere; with no board drawn the toggle still gives
  one Elosztó csere (≈). *Kell új elosztó? → Igen* gives a new one (≈) when none is drawn as new.
- **Cable** (m, 0.1):
  - *Kábel a nyomvonalon*: every drawn route, its solved length, plus at each end tied to a point the drop from the
    ceiling to the point's height and `endReserveMm` (300 mm by default; `--reserve`), an untied end `looseEndMm` (0).
    ≈ when a route runs through a room whose size was guessed, or there is no solve. Per route in `parts`.
  - *Kábel az elosztótól (rajzolatlan)*: a circuit fed from a board with no route drawn for it: the right-angled distance
    from the board to its nearest member, plus both drops. Always ≈.
  - *Kábel az e-autó töltőhöz*: with the E-autó toggle, from the answer *Milyen messze van az elosztótól?* (5 / 15 / 30 /
    40 m), ≈; 0 and ⚑ while unanswered.
- **Systems**: each Rendszer toggle is one item; Klíma takes its count from *Hány beltéri egység lesz?* (*4 vagy több* →
  4, ≈).
- **Other wants**: the countable Igények not covered above (LED-szalag, …).
- **Decisions (⚑)**: the questions listed in `decisions` that are in the shadow now (their condition holds) and not
  answered (open or ⏱ later). Each names the items it can change (`affects`, by id prefix); those items carry its id in
  `open`. The list is a starting set from the field kit's own questions; it invents none.

## 4. The output: `vrg-sketch-takeoff` v1

One JSON object. Every key is always present; lists keep their order (rules order, then the survey's).

```jsonc
{
 "kind": "vrg-sketch-takeoff", "v": 1, "made": 1763460000000,          // ms since 1970
 "source": {"name": "Kossuth u. 12", "id": "V1", "level": "ground", "plan": "megoldott" | "nyers", "variant": ""},
 "config": {"endReserveMm": 300, "looseEndMm": 0, "ceilingMm": 2700, "impliedDedicated": false},
 "counts": {"items", "work", "est", "open", "decisions", "tisztazando", "answered", "questionsOpen", "rooms", "areaM2", "photos"},
 "scope": [{"group": "jelleg" | "terulet" | "rendszer" | "igeny", "label", "items": [{"id", "label", "sym", "qty"}]}],
 "items": [{
   "id": "pont.socket.uj",          // <cat>.<what>[.<action>]: pont.<type>.<uj|csere|bontas|marad>, gep.<scope id>,
                                    // aramkor.<altalanos|dedikalt>, eloszto.<action>, aleloszto.<action>,
                                    // kabel.<nyomvonal|bekotes|ev>, rendszer.<scope id>, igeny.<scope id>
   "cat": "pont", "label": "Dugalj — új", "sym": "⊙", "unit": "db" | "m", "qty": 4,
   "est": true,                     // ≈ a guess
   "work": true,                    // false: listed only (an existing point that stays)
   "open": ["kor"],                 // ⚑ the decisions that can change it
   "note": "Munkakör: 4, vázlat: 1",
   "refs": ["P5"],                  // the survey records it counts (points, circuits, routes)
   "parts": [{"ref": "N10", "label": "K1", "m": 4.2}]   // cable items only: per route / circuit
 }],
 "decisions": [{"q": "kor", "label": "Mikor készült a hálózat?", "who": "ugyfel" | "szemle", "state": "open" | "later", "affects": ["pont.socket.uj"]}],
 "checks": ["Gépbekötés a Munkakörben: 4, fix bekötés a vázlaton: 1"],
 "questions": [{"q", "label", "who", "state": "answered" | "later" | "open", "options": ["Csere, felújítás"], "text"}],
 "notes": [{"id", "text", "chips": ["Kívánság"], "room": "Nappali", "open": false}],   // open = Tisztázandó
 "memos": [{"id", "text"}],
 "photos": [{"purpose": "eloszto", "label": "Elosztó", "sym": "▣", "n": 2, "files": ["<stem>_C27_eloszto.jpg"]}],
 "rooms": [{"id", "name", "kinds", "areaM2": 12.8, "est": false}]
}
```

`questions` holds only what is in the shadow now (a skipped question is left out); option ids are given as their
labels. `photos.files` are the names the export gives the purpose photos (the Átadás board names); the photo points'
shots count under *szoba*. The **summary** (`<stem>.takeoff.md`) is the same content in Hungarian: Munkakör, Tételek
(a table with ≈ / ⚑ and the notes), the per-route parts, Döntésre vár, Ellenőrizni, Kérdések, Jegyzetek (⚑ Tisztázandó),
Fotók, Helyiségek.

**Versioning.** New optional keys may be added within v1; a reader ignores what it does not know. Renaming or
re-meaning a key, or changing an item id's form, makes it v2. The rules file has its own `v`.

## 5. Brief for the H: session (Varler Workflow Kit)

*For the Claude Code session on the PC that maps this export onto the quote pipeline. Read
`docs/hub/agents/workflow-kit.md` and the kit's `02_question_funnel/FUNNEL_BRIEF.md` first. This cloud session could not
read the kit: nothing below assumes what `funnel.json` or `takeoff.js` contain.*

1. **Input.** A job arrives as `<stem>.vsketch.json` (the package, with `takeoff` inside) and `<stem>.takeoff.json` +
   `.md` beside it, on the Átadás board (`inbox\board\<date>\`) or in a job folder. If only the package is there:
   `node tools/sketch-takeoff.js <package> --out <job folder>` (repo root) writes the two files.
2. **Scope → funnel.** `scope[].items[].id` are the field kit's toggle ids (`Sketcher/catalog/fieldkit.json` `scope`).
   Map each to the funnel's own job types / branches where one exists; where none does, list it as unmapped — do not
   add funnel questions or defaults for it (FUNNEL_BRIEF: never invent).
3. **Answers → funnel answers.** `questions[]` with `state: answered` carry the option *labels* and free text; the ids are
   in the package's `sketch.answers` (`{qid: {options: [ids], text, state}}`). Where a field-kit question asks the same as
   a funnel rule, record the mapping in a table (field kit qid → funnel id) inside the kit, and pre-fill only those.
   Open and ⏱ later questions stay open in the funnel.
4. **Items → takeoff.js.** `items[]` are quantities by kind: `pont.*` (db, by type and action), `gep.*` (gépbekötés),
   `aramkor.*`, `eloszto.*` / `aleloszto.*`, `kabel.*` (m), `rendszer.*`, `igeny.*`. Map each id prefix to the kit's
   material / labour lines; `work: false` items are context only. Keep `est` (≈) and `open` (⚑) visible in the
   Költségvetési Tervezet as assumptions, never as firm quantities.
5. **Decisions.** Every `decisions[]` entry is a question the client or the site still has to answer that changes a
   quantity; it belongs in the offer's open points (or in the funnel's next round), not in the price.
6. **Notes and photos.** `notes[]` with `open: true` (Tisztázandó) are open points too. The photos are files beside the
   package under `photos[].files`.
7. **Client data.** The package and the takeoff name the client's address and notes: they stay on the PC (job folder),
   never in Git (`CLAUDE.md`, `Sketcher/variants/PROTOCOL.md`).
8. **Back to the repo.** If a mapping needs a new field in the export, ask for it as a v1 optional key (§4) in this doc,
   so the phone and the Desktop learn it through the shared fixture.
