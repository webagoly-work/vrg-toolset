# P4 · Live Claude

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Version check; transcript tail + `claude agents --json` → figures, beams, City Hall dispatch board; then hooks after the user approves the settings block; fences; conflict radar; outskirts and restricted zones.
- **Done-check:** A second session shows a second figure; its reads beam to roofs live; a session waiting for permission shows amber on the board; closing the city does not slow Claude.
- **Files:** CodeCity/sessions.js, CodeCity/hook.js (new), CodeCity/src/16-session.js, .claude/settings.local.json (only after a yes)
- **Decisions:** D11, D12, D13, D16, D27
- **Prompts:** KV-09, KV-10, …
- **Status:** DONE 2026-10-26 — KV-09 3b9704d (agents + tail), KV-10 ✔ 263c298 (hooks on, user said yes 2026-10-26; outskirts, restricted zones), KV-11 ✔ c9d7474 (fences, conflict radar)

## Notes (KV-09, 2026-10-26)

- Claude Code: the portable copy in `Planner/apps/node` was broken (a failed self-update left only `bin/claude.exe.old.*`);
  reinstalled 2.1.310, the same as the user-wide one in `%APPDATA%\npm` (CITY-D13 A).
- `claude agents --json` works and needs no TTY: `id, cwd, kind, startedAt, sessionId, name, state` (+ `pid, status` for live ones);
  one call takes ~3.4 s, so the companion polls every 6 s, only while a page listens.
- The sessions listed are the ones of the account the companion runs under (its `CLAUDE_CONFIG_DIR`); the second
  account's sessions need `transcripts` + `agentsCmd` in `CodeCity/companion.config.json`, or the hooks (KV-10).

## Hooks (KV-10, 2026-10-26)

Enabled by the user's yes in this checkout's `.claude/settings.local.json` (gitignored since KV-10; per machine,
never committed). The block, written by Node so the paths are exact:

```json
{ "hooks": {
  "PreToolUse":  [{ "matcher": "Read|Write|Edit|MultiEdit|NotebookEdit|Glob|Grep|mcp__.*desktop-commander__.*",
                    "hooks": [{ "type": "command", "command": "<repo>\\Planner\\apps\\node\\node.exe",
                                "args": ["<repo>\\CodeCity\\hook.js", "pre"], "timeout": 5, "onFailure": "continue" }] }],
  "PostToolUse": [ the same with "post" ]
} }
```

- **Exec form (`command` + `args`), not a shell string.** The first try used a shell-form command; on this machine
  `CLAUDE_CODE_GIT_BASH_PATH` (user env) points to `H:\_external\Gitt\PortableGit\bin\bash.exe`, which does not
  exist, so Claude Code could not start the hook and BLOCKED the Read (shell-form PreToolUse hooks without Git
  Bash block on failure). Disabled within a minute, then rewritten in exec form, which needs no shell.
- **`"onFailure": "continue"`**: whatever happens to the hook, the tool call goes ahead (CITY-D16 A: show only).
- Cost: ~40–70 ms per file/search tool call, city open or closed. Check passed: `claude -p` reading a file works
  with the city closed; with it open the read beams live (pre, then post).
- To turn it off: delete `.claude/settings.local.json`. CITY-D12 A: move to `~/.claude/settings.json` (all of H:)
  only after P4's check — ask the user first.
- Worth fixing outside the city: the stale `CLAUDE_CODE_GIT_BASH_PATH` (portable Git exists at
  `H:\_desktop\Git\bin\bash.exe` and `Planner\apps\git\bin\bash.exe`). Not changed — the user's call.
