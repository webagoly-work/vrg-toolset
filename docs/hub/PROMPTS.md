# Prompts — VRG Kapu build pack

Paste into a **fresh** Claude Code session (your other account) whose working directory is the repo
root `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`. Each prompt is a TASK sandwich: task first, what to
read, the task again at the end. One WP per session keeps the context small; the order is README §3.
Shortest form of all: type **`GO HUB`** — the session reads `GO-HUB.md` and picks the next open WP.

## 0. Record my answers (cheap model)

```
TASK: RESOLVE docs/hub/DECISIONS.md with my answers: <Q01 A, Q02 A, …>.
Write them into docs/hub/README.md §5 (id → option, one line each) and into HUB-Q-001.json
(top-level "answers" object, "rev":"r1"). Unanswered = A. Change nothing else. Do not commit.
END — RESOLVE only.
```

## 1. Pre-share audit (strong model — runs before the invite)

```
TASK: RUN WP-HA (pre-share audit) of the VRG Kapu pack. Read-only except the report file.
READ FIRST: CLAUDE.md · docs/hub/00_CONTRACT.md · docs/hub/wp/WP-HA_pre-share-audit.md.
Never print a secret value — path, commit and pattern only. Write docs/hub/AUDIT-<date>.md,
end with "OK to share" or "Fix first: …", then ask me HUB-Q10 with the real file list.
END — WP-HA only, change nothing else.
```

## 2. Build one work package (cheaper model is fine for H0, H1, H8, H9, H12)

```
TASK: BUILD WP-H<n> of the VRG Kapu pack.
READ FIRST, in order: docs/hub/00_CONTRACT.md · docs/hub/README.md (§4 status, §5 answers) ·
docs/hub/wp/WP-H<n>_*.md · only the 01_ARCHITECTURE / 03_UI sections that WP names.
Start with git status and tell me what is dirty before touching anything. Own only the contract §1
files. Follow the WP exactly; a deviation goes in the report, not silently in the code.
Run the contract §3 loop after every edit batch. At a ⏸: stop, show, wait.
Finish with the contract §5 report and the README §4 status line. Do not commit.
END — BUILD WP-H<n> only.
```

## 3. Verify a work package (stronger model, fresh session)

```
TASK: VERIFY WP-H<n> of the VRG Kapu pack against its file.
READ: docs/hub/00_CONTRACT.md · docs/hub/wp/WP-H<n>_*.md · the files the report lists.
Check: every Build step exists and does what it says · every Test exists with the exact values and
passes · the contract §3 loop is green · no edit outside contract §1 · no secret, token or key in any
file · Hungarian UI strings match 03_UI.md exactly · (H5, H10) the security points one by one.
Report: PASS / FAIL per item with file:line, then the smallest fix for each FAIL. Fix nothing.
END — VERIFY WP-H<n> only.
```

## 4. Several WPs in one strong session (when you want it finished)

```
TASK: build the VRG Kapu pack WP by WP in README §3 order, from the first one not DONE,
stopping at every ⏸ (H2 look, H11 look) and whenever a decision is missing.
READ FIRST: docs/hub/00_CONTRACT.md · docs/hub/README.md · then per WP only its file and the
sections it names. After each WP: the contract §5 report + README §4 line, then continue.
Never commit, never push. Questions to me: lettered A/B/C options, plus a simple SVG picture when
the question is visual.
END — build the Kapu pack in order, stopping at every ⏸.
```

## 5. Parallel lanes (two sessions at once, no shared files)

**Status 2026-10-22:** both lanes are built on `secacc` (✓ = done). Only H13 is left, and it waits
for the user, not for a lane.

Lane 1 (page): H0 ✓ → H1 ✓ → H2 ⏸ ✓ → H3 ✓ → H4 ✓ → H5 ✓ → H6 ✓ → H7 ✓ → H8 ✓ → H9 ✓ → H11 ⏸ ✓ → H13 (partial)
Lane 2 (independent): HA ✓ · H12 agent docs ✓ · H10 companion ✓
Lane 3 (main checkout, `GO STRICT`, HUB-Q24 A): commit research, client-look, media-wall,
planner-cyd and board-console, then merge `secacc`. It touches no hub file, so it can run any time
before H13's `check-hub --strict`.

H13 still needs from the user: setup steps 3–8, the OneDrive share links and the real 00_START path,
and the clean-profile verify with their own token (README §4).

The lane rules below are kept for a rebuild:
Lane 2 touches only `docs/hub/agents/**`, `Hub/companion/**`, `Hub/VRG Kapu.cmd`, `GO-HUB.md`
and the `agent[]` entries of `Hub/data/topology.json` (H12 — coordinate: lane 1
must not be editing that file at the same moment) — never `Hub/src/**`. H10's page-side part (step 4) waits for lane 1.

## 6. Ask me (any session) — the format I want

Numbered questions, the id from DECISIONS.md, options A (recommended) / B / C, one line each, so I can
answer "Q02 A, Q05 B". If a picture explains it faster, draw a simple SVG (no overlapping labels).
