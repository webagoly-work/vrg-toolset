# WP-H11 — Help, glossary, installers, Open MCT slot, export, link check  ⏸ look

**Goal (user):** "beginner user friendly layout to reach every part of every work project" ·
"Option to reach my private collection of standalone programs installer (download button pointing
to OneDrive folder for now)" · "Other, generally useful functions".

## Depends / decisions
H3 (H6, H10 for the link check). **HUB-Q12** (A = Open MCT as a separate slot).

## Build
1. **Első lépések** tour — the 6 steps of 03_UI §6, first run automatically (once per browser),
   re-open from ☰. Each step highlights one real element; "Tovább" / "Kihagyás".
2. **Szótár** — `Hub/data/glossary.json` (25 entries, HU + EN line, plain words) and a searchable
   panel; glossary words in descriptions get a dotted underline + tooltip (first occurrence only).
   Entries: repó, commit, branch (ág), main, worktree, push, pull, clone, PR, merge, dist, build,
   token, GitHub Desktop, OneDrive megosztás, „Adott személyek”, Claude Code, CLAUDE.md, primer,
   GO fájl (codephrase), DECISIONS, munkanapló, foglalás, Kapu segéd, localhost.
3. **Telepítők** (☰ and the ALT `installers` node): opens the `od-inst` link; empty → "A telepítő
   mappa linkje még nincs megadva" + Szerkesztés.
4. **Konzol (Open MCT)** slot — already in the seed (`omct`, idea). Add to its long text: what Open
   MCT is in two sentences and why it is separate (01_ARCHITECTURE §9).
5. **Linkellenőrzés** (☰): repo paths via the H6 tree listing, local paths via companion
   `check-paths`, URLs not checked (cross-origin) — only "üres" flagged. Dead → red dot + list.
6. **Export**: board as PNG (serialize the SVG with inlined computed theme colours → canvas →
   download) and print stylesheet (`@media print`: white, black text, all departments expanded);
   topology JSON download.
7. **Téma** menu (four VRG themes) and **Névjegy** (build sha, date, links to `docs/hub`).
8. **Nyitott kérdések** panel: the H6 decision-file list grouped by program, each opening on GitHub.

## Tests (`spec-97-extras.js`)
- glossary has 25 unique ids, every entry has `t`, `d`, `dEn`, `d` ≤ 120 chars.
- underline: in the Planner `long` text the first "build" is marked once only.
- PNG export in the browser produces a non-empty `image/png` blob > 50 KB at fit-all.

## ⏸ Checkpoint
Run the tour start to end with screenshots of steps 1, 4, 6 and the Szótár panel. **Show the user**
— the beginner-friendliness is theirs to judge.

## Out of scope
New content for departments (that is the user's, via the editor).
