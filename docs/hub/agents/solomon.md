# Solomon — agent init
*For a Claude Code session that will work on the three-signal check. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab

## 1. What it is
A check over the tracked documents for three signals: contradiction, dark zone and frozen. The results show on a
rotating sphere (Gömb), one dot per document. It flags and quotes; the Founder rules. It never edits a source.

## 2. Where
- `tools/solomon.js`: scanner, intern routine, ruling command, `publish` and `pull`.
- `Solomon/src/index.html` → `Solomon/dist/vrg-solomon.html`, with `shared/melyviz.css` and the data baked in.
- `Solomon/data/`: `signals.json` generated; `reviews.jsonl` and `rulings.jsonl` append only.
- Branch `solomon-data` on origin: those three files only, with a history of their own. The phone reads and rules there.
- `docs/council/agents/caleb.md`: the intern's source. Scheduled task `solomon-intern`, Mondays.
- `Mobile/android/feature-sphere` and `Mobile/android/kit-core/src/main/kotlin/hu/vrg/mobile/core/Sphere.kt`: the phone page.
- START key T; server key T on the O screen, port 8799 (`Solomon/serve.js`).

## 3. Read first
1. `docs/solomon/README.md` — the rules, §4 applies to every agent
2. `docs/solomon/DECISIONS.md`
3. `docs/mobile/WP/M14.md` for the phone page

## 4. Build / test / check
```bash
node tools/solomon.js scan
node tools/solomon.js next
node tools/check-start.js
```

## 5. Rules and traps
- Nothing in Solomon writes to a scanned file (README §4).
- Signal ids hash what was found, so changed text drops its old ruling on purpose (README §7).
- The script quotes; a report without an exact `file:line` is refused.
- Only confirmed contradictions pulse red. Candidates stay faint.
- Archived material and client data are outside the scan; keep `SKIP` and `SECTIONS` that way.
- `publish` builds its commit with plumbing and never switches branch. `solomon-data` is never forced and never merged.
- A placement change in the page must go into `Sphere.kt` too; `SphereTest` holds values from the page.

## 6. Current state
- git 2026-11-01 977c8f0 Solomon: three-signal check over the knowledge base, with the Gömb and Caleb
- Scanner, Caleb, page, weekly routine and the `solomon-data` push built 2026-11-01. Mobile M14 built, BETA, phone check open.
- SOL-Q1 to Q4 answered: A, B, B, C. No new scan target for now; the Kódváros overlay is not built.

## 7. Do not touch
- `Solomon/data/rulings.jsonl` by hand: it is the Founder's record.
- Any scanned document in order to clear a signal.

Forrás: docs/solomon/README.md, docs/solomon/DECISIONS.md, tools/solomon.js, 2026-11-01
