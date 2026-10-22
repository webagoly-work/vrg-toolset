# WP-H12 — Layer 3: AI init docs per program + the colleague's agent on-ramp

**Goal (user):** "layer 3 has the init docs for AI (harness and alike), as well as links to Claude
Code sessions" · "optionally users have option to connect their AI agent/login with their Claude Code
to access and utilize the agentic documents/content layer".

## Depends
H1 (seed paths). Independent of the page code — can run in parallel with H2–H11.

## Read
`CLAUDE.md` (root) · `Planner/projects/varler-planner/docs/PRIMER.md` · `BRIDGE/BRIDGE-PRIMER-001_Session-Handover.md`
· `GO-R1018.md` (the shape of a GO brief) · `tools/prompts/05-munkamenet-inditas.txt` ·
the README of each program folder in `hub-seed.json`. **Do not** read the BRIDGE `01_`–`04_`
corpus or anything under `Planner/apps|home|data`.

## Build
1. `docs/hub/agents/<program-id>.md` for every **live/dev program that has a repo path** (count them
   from the seed; expect ~25). Fixed template, ≤ 60 lines each:
   ```
   # <title> — agent init
   *For a Claude Code session that will work on <title>. Read this, then the files in §3.*
   ## 1. What it is (2–3 sentences, plain words)
   ## 2. Where (paths, build output, how it is opened — START.cmd key if any)
   ## 3. Read first (max 4 files, in order)
   ## 4. Build / test / check (exact commands, or "no build — single file")
   ## 5. Rules and traps (only ones written in the repo's docs — cite the file)
   ## 6. Current state (last 3 roadmap rows + open decision files)
   ## 7. Do not touch
   ```
   Facts only from the files read — where a section has no source, write "— (nincs leírva)" instead
   of guessing. Each file ends with "Forrás: <files>, <date>".
2. Add each new file to that program's `agent[]` in `Hub/data/topology.json` as the **first** entry
   (`t: "Ügynök indító"`, `d: "Ezt olvassa el először egy AI munkamenet."`).
3. `docs/hub/agents/README.md`: how a user connects their own Claude Code: open Claude Code in their
   clone (or claude.ai/code with the repo) → say "olvasd el a docs/hub/agents/<id>.md-t és …" →
   the RCO "Claude Code itt → indító prompt másolása" does exactly this.
4. `GO-HUB.md` already exists (analysis session) — check it still matches, update §status only.
5. Root `CLAUDE.md` already has the **`GO HUB`** codephrase line (added by the analysis session) —
   check it still matches `GO-HUB.md`; do not edit anything else in that file.
6. A short `docs/hub/agents/SESSIONS.md`: "Claude Code session links work only for the account that
   made them; share a GO file instead" + the table of existing GO files (GO-R1010, GO-FRAME, GO-V2,
   GO-R1018, GO-ADAT, GO-HUB) with one line each, read from the files.

## Tests
- `node tools/check-hub.js` → every `agent[].repo` exists; every `docs/hub/agents/*.md` (except
  README/SESSIONS) has the 7 headings in order (add this check to `check-hub.js`).
- Spot check by the verifier: 3 random agent files — every command in §4 runs; every claim in §5 is
  found in the cited file.

## Out of scope
Rewriting existing primers. Translating existing docs.
