# VRG Füzet kits: the format, and how an agent writes one

*VRG Füzet (WP M46, `docs/mobile/WP/M46.md`) is the malleable notebook of VRG Mobile. A **kit** is one application of
it as plain data: one JSON file here, `Mobile/notebook/kits/<id>.json`. The APK bundles every file in that folder, and the
phone can also load a kit from a file (⚙ Kitek → Kit betöltése fájlból). No code ships with a kit.*

## How a request arrives

On the phone, ⚙ Kitek → **✦ Kit kérése** saves a *Kérés* entry in the Alap kit and opens the share sheet with this
template:

```
VRG Füzet: új kit kérése (Mobile/notebook/kits/PROTOCOL.md)
Mire való:
Mit szeretnék felírni (típusok és mezők):
Hogyan akarom látni (napló, lista, pipálható, összesítő mi szerint):
Mire figyelmeztessen (határidő, határérték, ha rég volt):
```

The owner sends it to a Claude session (or pastes it into one). A *Kérés* can also ask for a change to an existing
kit: a new field, a new view or a rule.

## What the agent does

1. Read this file and two bundled kits (`alap.json` and the one closest to the request).
2. Write `Mobile/notebook/kits/<id>.json`. The `id` is the file name: lowercase, digits, hyphens, at most 40 characters.
   UI text is Hungarian. To change an existing kit, edit its file and keep every type and field id (old entries keep
   their data under those ids).
3. Check it: `cd Mobile/android && VRG_JVM_ONLY=1 ./gradlew :notebook-core:test`. `KitTest` parses every kit in the
   folder and fails on any error or warning, with the reason.
4. Commit and push. The next APK (Actions, then Frissítés) carries the kit. If the owner needs it sooner, the file
   itself can be sent to the phone (Átadás) and loaded with ⚙ Kitek → Kit betöltése fájlból.
5. Never put client names, addresses or other personal data in a kit. A kit describes *kinds* of entries; the entries
   stay on the phone.

## The format (kind `vrg-fuzet-kit`, v 1)

```json
{
  "kind": "vrg-fuzet-kit", "v": 1,
  "id": "kutya", "name": "Kutya", "sym": "🐕", "color": "#d9a15b",
  "about": "One sentence: what it is for.",
  "types":    [ { "id": "seta", "label": "Séta", "sym": "🦮", "checkable": false, "fields": [ … ] } ],
  "chips":    [ { "id": "figyelni", "label": "Figyelni kell", "sym": "⚑", "open": true, "tag": "egészség", "type": "seta" } ],
  "views":    [ { "id": "setak", "label": "Séták", "sym": "🦮", "kind": "tally", "types": ["seta"], "by": "week", "sum": "perc" } ],
  "rules":    [ { "id": "napi-seta", "kind": "stale", "type": "seta", "days": 1, "label": "Ma még nem volt séta" } ],
  "keywords": [ { "id": "egeszseg", "re": "\\bhány|\\bsánt", "suggest": { "tag": "egészség" } } ]
}
```

**Fields** (`types[].fields[]`): `{ id, label, kind, unit?, options?, required?, due?, min?, max? }`

| kind | value | notes |
|---|---|---|
| `text` | text | |
| `number` | number | `unit` is shown after it; `min` / `max` raise a *Határérték* open item when it is outside them |
| `choice` | one of `options` | `options` required |
| `multi` | several of `options` | `options` required |
| `check` | yes / no | |
| `date` | `ÉÉÉÉ-HH-NN` | `due: true`: once the day comes, a *Esedékes* open item while the entry is not done |
| `rating` | 1–5 | stars |

`required: true` raises a *Hiányzik* open item while it is empty (and the entry is not done). `checkable: true` on a
type gives its entries a ☐ / ☑.

**Views** (`kind`):
- `timeline`: entries grouped by day, newest first.
- `list`: one list, newest first.
- `checklist`: open entries first (earliest due date first), then the done ones. It needs a checkable type.
- `tally`: groups with a count, and with `sum` (a number field) also a total. `by` is `day`, `week`, `month`,
  `type`, `tag` or `field:<id>`. Text values are grouped regardless of case and accents.

`types` and `tags` narrow a view. A kit with no views gets a Napló.

**Rules**: only `stale` so far: no entry of `type` for `days` days. The built-in rules (*Hiányzik*, *Tisztázandó*,
*Esedékes*, *Határérték*) need no entry here; they come from the fields.

**Chips** do any of three things with one tap: add a `tag`, mark the entry `open` (Tisztázandó), or set its `type`.

**Keywords**: a regular expression over the lower-cased text of the entries of the last 14 days. It suggests a `tag`,
or, for a plain note of the Alap kit, a `type` of this kit (the note moves into the kit when the suggestion is
applied).

## Rules of thumb

- One kit per area of life or work, not per person or job. Jobs, people and places are entries or tags.
- Fewer fields are better. Every field the owner skips is a *Hiányzik* item, so `required` only for what the entry
  means nothing without.
- Limits (`min` / `max`) only where a real standard or the owner says so. Name the source in `about`.
- Ids are for ever: renaming a type or field id orphans the data already recorded under it.
