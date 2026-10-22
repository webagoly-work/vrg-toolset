# WP-H9 — Munkanapló (markdown progress document)

**Goal (user):** "Create markdown document that users can upload with saving work progress".

## Depends / decisions
H6 (GitHub write), H8 (target folder). **HUB-Q16** (A = commit to `Hub/logs/` + optional OneDrive).

## Read
`03_UI.md` §6 *Munkanapló* (form + exact template) · `01_ARCHITECTURE.md` §8.

## Build
1. Form modal (📝 button; RCO "Bejegyzés a munkanaplóba" pre-ticks that program). Fields from 03_UI.
   Draft auto-saved to `kpStore` every 5 s and on close.
2. `kpLogToMd(entry)` → exact template text; `kpMdToLog(text)` → entry (front matter + the five
   `##` sections; unknown sections kept in `extra`). Round-trip must be lossless.
3. Outputs: **Letöltés .md** (`YYYY-MM-DD_<login>_<slug>.md`, slug from the first 5 words of
   "Mit csináltam", ASCII-folded) · **Mentés a célmappába** (H8) · **Feltöltés GitHubra**
   (`PUT Hub/logs/<name>`; a name clash → `-2`, `-3` …) · **OneDrive mappa** (opens `od-logs` link).
4. **Importálás…**: one or more `.md` → parsed → listed in the info drawer of each program named in
   `programs` ("Napló" tab), newest first. Imported logs live in `kpStore` until saved to GitHub.
5. "Ki min dolgozik?" strip: per user the newest log (from `Hub/logs/` via the tree listing in H6 +
   local drafts) → "<login>: <programs> — <first line of Következő lépés> (<relative day>)".

## Tests (`spec-90-log.js`)
- `kpLogToMd` of the fixture entry equals `Hub/test/fixtures/log-expected.md` byte for byte.
- `kpMdToLog(kpLogToMd(e))` deep-equals `e`; a file with an extra `## Megjegyzés` keeps it in `extra`.
- file name for date 2026-10-21, login `webagoly-work`, text "Födém toll finomítása a CLA nappaliban"
  → `2026-10-21_webagoly-work_fodem-toll-finomitasa-a-cla.md`.
- clash: existing `…cla.md` → `…cla-2.md`.

## Out of scope
Rendering a timeline per person (that is the v2 *Crew* program).
