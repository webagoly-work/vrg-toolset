# Munkák és előzmények — agent init
*For a Claude Code session that will work on job data. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts · **Indító:** GO TNT, after its merge

## 1. What it is
The real jobs behind the tools: 19 past jobs carded in a register, with the prices, labour items and
totals extracted from them. The method across the jobs is primer → plan → material sheet → quote →
extra work → site log → invoice. The Workflow Kit covers the middle; both ends are manual.

## 2. Where
- `H:\VRG\Full\jobs`: outside Git. Client data, never committed.
- `_elozmenyek/REGISZTER.md`: the register, one folder per job code with a `JOB.md`.
- `_elozmenyek/`: `arkatalogus.csv`, `arak-sorok.csv`, `munkadij-tetelek.csv`, `osszegek.csv`, `manifest.json`.
- `_tnt-tukor/`: read-only copy of the job data, 984 files.
- The master is `C:\Users\webag\OneDrive\TNT`, a live folder other people use.

## 3. Read first
1. `_elozmenyek/REGISZTER.md`
2. The job's `JOB.md`
3. `GO-TNT.md` on branch `docs/go-tnt`: the phases and the rules below in full
4. `H:\VRG\Full\Varler_Workflow_Kit\ADDENDUM_ar-es-ado_2026-10-31.md` for old prices and tax wording

## 4. Build / test / check
No build. `manifest.json` holds a SHA-256 for each file; compare against it after any copy.

## 5. Rules and traps
- TNT's path and share stay; reading is free, writing is not; everything produced goes outside TNT
  (GO-TNT §2).
- No junction or symlink from `H:` into TNT: deleting through a link deletes the file for everyone (GO-TNT §2).
- Job codes only in tracked files; the code key is the register, outside Git (GO-TNT).
- Old job documents are archived material: note them, do not correct them (Founder, 2026-10-31).
- Prices older than 6 months count as stale (GO-TNT T3).
- Never open or run `Varler\Programok\vscode\data`, the key generator or the activator (GO-TNT §2).

## 6. Current state
- 6 running, 11 finished, 2 failed. Codes are proposals until GO TNT T1 (REGISZTER).
- `munkadij-tetelek.csv` is partial: template-shaped budgets only. Photos and video were counted, not
  analysed; 8 scanned PDFs have no text; `.sxe` drawings not opened (REGISZTER).
- TNT sharing is unverified (GO TNT T0). DM0's ledger is archived with a note in its `JOB.md`.

## 7. Do not touch
- Anything under `OneDrive\TNT`, and `_tnt-tukor`: edit neither (its `OLVASS_EL.txt`).

Forrás: jobs/_elozmenyek/REGISZTER.md, GO-TNT.md (branch docs/go-tnt), 2026-10-31
