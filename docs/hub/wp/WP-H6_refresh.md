# WP-H6 — Frissítés: live topology, roadmap commits, branches, open questions, "Mi változott?"

**Goal (user):** "Update the pages content to show current state" · "a vertical roadmap … to show how
each top layer based thing has developed".

## Depends
H4 (token). H5 for verifying the fetched `access.json`.

## Read
`01_ARCHITECTURE.md` §5 · `kpGhFetch` (H4).

## Build
1. `Hub/src/js/55-refresh.js` `kpRefresh({force})`, steps in order, each with its own status line in
   a small progress popover ("Topológia… ✓", "Ütemterv 12/36…"):
   1. topology.json (raw) → `kpValidate` → replace the in-memory topology only if `ok`.
   2. access.json → verify.
   3. per visible program with `git.paths[0]` (skip `""` = repo root → use `/commits?per_page=8`):
      `/commits?path=…&sha=main&per_page=8`, ETag-cached in `kpStore` (`vrgKapu.etag.<path>`).
      Merge into the roadmap: seed entries + commits (date = committer date, text = first line,
      author login, link) sorted newest first; a commit whose first line equals a seed text is
      shown once.
   4. `/branches?per_page=100` → for each branch ≠ main whose latest commit touches a program path
      (`/compare/main...<branch>` files list, max 10 branches) → a "⎇ <branch> — fejlesztés alatt"
      node under that program's L4.
   5. `/git/trees/main?recursive=1` → paths matching `DECISIONS*.md` or `*-Q-*.json` → per program
      (longest `git.paths` prefix wins) a count chip "? n". (Counting unanswered questions is v2;
      v1 shows the number of decision files.)
   6. self-version: `/contents/Hub/dist/vrg-kapu.html` sha vs embedded `KP_BUILD_SHA` → banner
      "Új Kapu verzió elérhető" + how to update (git pull / companion).
2. Auto-refresh on open when token present and the last refresh is older than 10 min.
3. Offline: everything renders from the last cache; stale banner (03_UI §7).
4. **Mi változott?** (☰ menu): since `vrgKapu.lastSeen` — new commits per program, topology edits
   (`updated` / `updatedBy`), new logs (H9). Opening it updates `lastSeen`.
5. Rate display in Belépések: "GitHub keret: 4 912 / 5 000".

## Tests (`spec-55-refresh.js`, stubbed fetch with recorded fixtures in `Hub/test/fixtures/`)
- invalid remote topology (duplicate id) → kept the old one, status line "Topológia: hibás, a régit mutatom".
- roadmap merge: seed `[{2026-10-18,"A"}]` + commits `[{2026-10-20,"B"},{2026-10-18,"A"}]` → 2 rows, B first.
- 304 responses do not change the roadmap and are counted as cache hits (3 of 3 in the fixture).
- decision-file count, fixture tree with exactly these blobs: `Planner/projects/varler-planner/docs/DECISIONS.md`,
  `…/docs/round-2026-10-18/DECISIONS.md`, `…/docs/simple-ui/SUI-Q-001.json`,
  `…/docs/stack/PLANNER-STACK-Q-001.json`, `BRIDGE/10_media-wall/DECISIONS.md`, `MindMap/vrg_mindmap.html`
  → `planner` 4, `media-wall` 1 (longest prefix wins over `bridge`), `bridge` 0, `mindmap` 0.
- Browser with a real token (user's own, in their browser — never in a file): Planner L4 shows ≥ 6
  rows with dates; refresh twice in a row → second one says "minden friss" and uses ≤ 40 requests.

## Out of scope
Writing to GitHub (H7). Uncommitted local changes (companion, H10).
