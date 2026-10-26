# GO LIVE — build Kódváros into the live workspace (secondary account)

*You were started with the codephrase **GO LIVE**. This file is the whole briefing; it does not depend
on any memory note, so it works from the secondary account (SecAcc) as well as the primary one.*

## 0. Start the secondary account (once per work session)

The SecAcc worktree is retired (GO MAIN, 2026-10-24): the secondary account now works in the **main
checkout**, with its own login.

1. Open **Command Prompt** (not PowerShell).
2. `set CLAUDE_CONFIG_DIR=H:\cwebuser\home\claude-account-b`
3. `cd /d H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`
4. `claude`, then type `GO LIVE`.

## 1. Where and how

- Main checkout `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, branch **`main`**. Confirm with
  `git rev-parse --show-toplevel` and `git branch --show-current`.
- The primary account may work in the same folder at the same time. So: touch only Kódváros files
  (`CodeCity/`, `docs/city/`, and START.cmd / VRG-DE.cmd entries the prompt names), `git add` only your
  own files by path (never `git add -A` / `.`), commit after each prompt, **never push**, never switch
  branch, never stash, never commit someone else's pending files.
- Follow `CLAUDE.md` (START.cmd rules, CRLF for `.cmd`, Vendor pinning, no secrets).

## 2. Where this comes from (session 2026-10-25/26, primary account)

- Kódváros opens on this repo by default (`40b7143`); START.cmd **K** rescans it on open.
- Idea lists in `docs/city/README.md` §7.1 (14 own ideas) and §7.2 (14 borrowed from the user's
  ChatGPT metaphor conversation) — ranked, not WPs.
- Deep research (`ab29000`): the user wants Kódváros to become a **live workspace** (open/edit files,
  live processes, launch programs, RCO menu, Claude app + Claude Code terminal, Ctrl+click group
  actions, shortcut prompts, agent choice, Ctrl+K), a **GitWorld geography** (planet → the user's Land
  → repo city, H: storage, PC compute node, router hub; "abroad" via ships / planes / trains), and later
  an **overlay OS** on the desktop — with a Tron-like "enter the code" look (no Tron trademarks).
  The user does not code and gets lost in panels, branches, sessions and file locations: everything
  must answer "where am I, what is happening, what can I do".
  - Report: `docs/research/reports/Kódváros live workspace and GitWorld.md` (§1 methods, §2 repos,
    §3 our assets, §4 media, §5 extrapolation and design rules, §6 roadmap P0–P13 + decisions).
  - Notes behind it: `docs/research/research_notes/Kódváros live workspace and GitWorld/`.
  - **Prompt series: `docs/city/PROMPTS-WORKSPACE.md` (KV-01 … KV-27).**

## 3. Do

1. Find the next prompt: the first KV-nn in `docs/city/PROMPTS-WORKSPACE.md` that is not marked done
   in `docs/city/README.md` §8 (§8 is created by KV-02; before it exists, start with **KV-01**).
2. Run that one prompt exactly as written: read only the report sections and files it names.
3. Stop at its check. Mark it done in README §8 (`KV-nn ✔ date commit`), commit, report in a few lines.
4. Continue with the next prompt only if the user says so ("tovább" / "next" / "all").

## 3b. State at the handoff (2026-10-26, primary account → secondary account)

- **Done: P0–P9 + P2's embedded terminal** (KV-01 … KV-20) + **KV-21, KV-22, KV-23** (2026-10-26, primary account; P10 and P11 done), all on `main`, not pushed. README §8 has the table and
  the done list; `docs/city/wp/` has a stub per phase with its status and notes. Selftest: 71 checks, all green
  (`node CodeCity/tools/selftest.js`).
- **vrg-etw is installed** (C:\Program Files\VRG\Kodvaros-ETW, task "VRG Kodvaros ETW", checked 2026-10-27). After a rebuild
  the user re-runs install-etw.ps1 elevated. **Next prompt: KV-24** (P12 wallpaper layer).
- **Toolchain:** The SDK is in `Planner/apps/dotnet`; rebuild the probe with
  `node CodeCity/tools/build-probe.js` (offline) and vrg-etw with `node CodeCity/tools/build-etw.js` (TraceEvent 3.2.8 from
  nuget.org, locked by CodeCity/etw/packages.lock.json). Self-contained needs the runtime pack from nuget.org — still not
  asked (README §5). KV-25 (the Electron overlay) needs the user's 22H2 first — D19 A: write the steps.
  Only CITY-D26 is still open (before P13). P3b (VS Code extension, CITY-D9 D) is planned but has no KV prompt yet.
- **Live mode:** START.cmd → K → S) Élő mód starts `CodeCity/companion.js` on http://localhost:8797. It also runs the
  helpers `agents-poll.js`, `probe-tier0.ps1`, `disk-walk.js` only while a page listens.
- **Hooks are on** in this checkout (`.claude/settings.local.json`, gitignored; KV-10, exec form + `onFailure: continue`,
  because this machine's `CLAUDE_CODE_GIT_BASH_PATH` points to a missing folder). Delete the file to turn them off.
- **Waiting on the user:** the real USB-stick train check (wp/p08-land.md); the `GO OPENWRT` thread (its own codephrase).
- **Gotchas learned:**
  - Write patch scripts with the Write tool; shell heredocs here lose backslashes (`\n`, `\s`).
  - `String.replace(a, b)` with a `$'` in `b` corrupts the file — always `replace(a, () => b)`.
  - An open SSE stream stops headless Chrome's virtual clock: test hooks that need the stream register before it
    opens and close it themselves (see `#livetest`, `#termtest`, `#filetest` in `99-boot.js`); rAF barely ticks headless
    (`KV_INSTANT` makes flights instant for `#keytest`).
  - Launching `claude.exe` freezes the launching process ~3 s on this machine — keep such spawns in a helper process.
  - A companion started from inside a Claude session must not pass its CLAUDE_* session markers on (handled in termOpen).
  - Never test git writes, worktrees or real saves in this shared checkout: the specs use throwaway fixture repos.

## 4. Ask

Decisions as numbered items with the CITY-Dn id and lettered options, A recommended (report §6.3).
README §7 says: ask the user for their Kódváros dev notes first; never guess them.
