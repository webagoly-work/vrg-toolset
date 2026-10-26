# P2 · Actions, Ctrl+K, multi-select, terminal

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** RCO menu from the Kapu action registry (folder, VS Code, terminal, Claude Code `claude-cli://`, Claude app `claude://code/new`, copy path, history); Ctrl+K palette; Ctrl+click and box selection with group actions; prompt dock; agent hall. Per CITY-D15 C: the embedded terminal (xterm + node-pty) comes early, with the `claude-cli://` link as fallback.
- **Done-check:** Right-click a building → VS Code opens on it; Ctrl+K "07a" flies there; three selected → "Ask Claude about these" opens a pre-filled prompt; items greyed with a Hungarian reason in `file://` mode; the embedded terminal runs `claude`, or the link opens when it cannot.
- **Files:** CodeCity/src/*, CodeCity/from-kapu/src/js/40-actions.js, 41-search.js, 47-nav.js, 92-companion.js, CodeCity/build.js, vendor-manifest.json
- **Decisions:** D9, D15
- **Prompts:** KV-05, KV-06, KV-07
- **Status:** in progress — KV-05 ✔ 0d38244 (RCO menu), KV-06 ✔ f50bbc3 (Ctrl+K, multi-select); KV-07 and the embedded terminal (D15 C) next
