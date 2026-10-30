# GO CITY — VRG Kódváros (the codebase as a city, the live workspace)

*You were started with the codephrase **GO CITY**. This file is the whole briefing; it does not depend on any memory
note, so it works from either account. It replaces GO CITY (old) and GO LIVE (2026-10-30, originals in
`docs/go-archive/`; GO-LIVE.md has the full handoff state).*

## 1. Where and how

- Main checkout `H:\VRG\Full\Planner_VRG_U100`, branch **`main`**. Touch only `CodeCity/`, `docs/city/` and the
  entries in `launcher/vrg-menu.json` a task names. `git add` by path, never push, never stash, never switch branch.
- The other account may work in the same folder: never commit someone else's pending files.

## 2. The secondary account (when the user says so)

The SecAcc worktree is retired (GO MAIN, 2026-10-24): the secondary account now works in the **main
checkout**, with its own login.

1. Open **Command Prompt** (not PowerShell).
2. `set CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`
3. `cd /d H:\VRG\Full\Planner_VRG_U100`
4. `claude`, then type `GO CITY`.

## 3. State

- **Done:** WPs C1–C10; the live-workspace series KV-01 … KV-27 (`docs/city/PROMPTS-WORKSPACE.md`, done list in
  `docs/city/README.md` §8); the Mélyvíz skin (`docs/city/melyviz.md`).
- Build and test: `node CodeCity/build.js`, `node CodeCity/tools/selftest.js`. Live mode: START → K → S (:8797). The
  .NET SDK and Electron are in `H:\VRG\Full\tools` (older notes say `Planner/apps`).

## 4. Open

1. **Parked:** fine-tuning the base from the user's dev notes (README §7): ask for the notes first, never guess them.
   A candidate for a Claude Design batch: look and feel in one pass, not more WPs.
2. Deferred checks: the Zen hand-off ×3, the user's Lively and overlay looks, the real USB-stick train (wp/p08-land.md).
3. The Cloudflare outer ring: CITY-D29–D33 + CITY-D21 option D (report §8, prompts CF-01…CF-07), merged 2026-10-30, not started.
4. Self-contained `vrg-probe.exe` needs the runtime pack from nuget.org: not asked yet. P3b (VS Code extension) has no prompt yet.
5. `GO OPENWRT` is its own thread; after it, re-ask CITY-D24.

- **Gotchas learned:**
  - Write patch scripts with the Write tool; shell heredocs here lose backslashes (`\n`, `\s`).
  - `String.replace(a, b)` with a `$'` in `b` corrupts the file — always `replace(a, () => b)`.
  - An open SSE stream stops headless Chrome's virtual clock: test hooks that need the stream register before it
    opens and close it themselves (see `#livetest`, `#termtest`, `#filetest` in `99-boot.js`); rAF barely ticks headless
    (`KV_INSTANT` makes flights instant for `#keytest`).
  - Launching `claude.exe` freezes the launching process ~3 s on this machine — keep such spawns in a helper process.
  - A companion started from inside a Claude session must not pass its CLAUDE_* session markers on (handled in termOpen).
  - Never test git writes, worktrees or real saves in this shared checkout: the specs use throwaway fixture repos.

## 5. Ask

Decisions as numbered items with the CITY-Dn id and lettered options, A recommended.
