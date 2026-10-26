# P4 · Live Claude

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Version check; transcript tail + `claude agents --json` → figures, beams, City Hall dispatch board; then hooks after the user approves the settings block; fences; conflict radar; outskirts and restricted zones.
- **Done-check:** A second session shows a second figure; its reads beam to roofs live; a session waiting for permission shows amber on the board; closing the city does not slow Claude.
- **Files:** CodeCity/sessions.js, CodeCity/hook.js (new), CodeCity/src/16-session.js, .claude/settings.local.json (only after a yes)
- **Decisions:** D11, D12, D13, D16, D27
- **Prompts:** KV-09, KV-10, …
- **Status:** in progress — KV-09 ✔ 3b9704d (agents poll + transcript tail → figures, beams, Városháza board); KV-10 (hooks) waits for the user's yes on the settings block

## Notes (KV-09, 2026-10-26)

- Claude Code: the portable copy in `Planner/apps/node` was broken (a failed self-update left only `bin/claude.exe.old.*`);
  reinstalled 2.1.310, the same as the user-wide one in `%APPDATA%\npm` (CITY-D13 A).
- `claude agents --json` works and needs no TTY: `id, cwd, kind, startedAt, sessionId, name, state` (+ `pid, status` for live ones);
  one call takes ~3.4 s, so the companion polls every 6 s, only while a page listens.
- The sessions listed are the ones of the account the companion runs under (its `CLAUDE_CONFIG_DIR`); the second
  account's sessions need `transcripts` + `agentsCmd` in `CodeCity/companion.config.json`, or the hooks (KV-10).
