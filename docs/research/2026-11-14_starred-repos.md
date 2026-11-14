# Starred repos of 2026-11-13: what to engineer back into VRG, research note, 2026-11-14

Part of the line "Studies of outside tools" (`L:research`): understand it, then build our own.

**Source:** the 31 repos starred on `webagoly-work` on 2026-11-13 (plus graphify, 10-27). Read over
HTTP on 2026-11-14: READMEs and GitHub API metadata only. Nothing cloned, installed or run, and **no
source code read**, so every "mechanism" below is as its README describes it. Several install flows
tell the agent to fetch and run a remote file (`npx skills --yes`, "follow this URL"): we never do
that; we take the idea and write it ourselves.

Star counts look high for the repos' ages on rtk, orca, paperclip, OmniRoute, graphify and
learn-claude-code. Popularity is not evidence here. Telemetry is on by default in headroom and
paperclip.

---

## 0. The short answer

Most of the batch is Claude Code tooling, and VRG already has the big pieces (Stack graph + MCP +
codec, Council, Control Room, replay, Kódváros, claude-hud). What's worth taking is **a handful of
small mechanisms**, not any of the apps:

| # | Idea (from) | Lands in | Size | Why |
|---|---|---|---|---|
| 1 | **Agent state + "done / needs you" ping** (peon-ping, herdr) | Console `trace-hook.js` consumer → Mobile Értesítések (M10) + Control Room | 2–4 h | The trace hook already receives Stop / Notification / PermissionRequest; only a consumer is missing. Stops babysitting the terminal. |
| 2 | **Bash output filters** (rtk) | new PreToolUse hook + `tools/outfilter.js` | ~1 day | Straight at `I:o9` "the usage window is the limit". Fail-open, raw output teed to a file. |
| 3 | **Council round protocol + evidence tags** (council-of-high-intelligence) | `docs/council`, one skill file | 2–3 h | Fixed rounds, anti-premature-agreement checks, FACT / INFERENCE / ASSUMPTION / UNKNOWN on every claim. |
| 4 | **Diagram linter + validate-then-deliver** (archify, drawio-skill) | Planner Topology View, BuildTree, `Inventory/src/core/diagram.js` | 1–2 days | Deterministic checks (overlap, clipped label, stacked edges) with repair hints; output replaced only when it passes. |
| 5 | **Compress-with-retrieve** (headroom) | Stack MCP / codec | ~1 day | Big results return head + tail + stats and an id; `stack_retrieve(id, range)` gets the rest. Nothing is lost by trimming. |
| 6 | **Source vault + cite-check** (hyperresearch) | `docs/research/research_notes`, akecheta, Stack G layer | ~1 day | Every fetched source saved as markdown with frontmatter; a pass verifies each quoted line exists in a saved source. |
| 7 | **DESIGN.md + WCAG contrast check** (awesome-claude-design, replica-skill) | Mélyvíz, Hajnalfény, `Console/design/tokens.json`, `shared/vrg-ui-kit/test/lint.js` | 1–3 h | One agent-readable spec per design system; contrast of every fg/bg token pair checked in the existing lint. |

Recommended order: **1 → 2 → 3**, all hours-sized and each one pays back at once. 4–7 when their
host line is next opened.

**#1 built 2026-11-14:** `Console/www/js/trace/state.js` + `Console/tools/agent-notify.js`, wired into
`trace-hook.js`; see Console/README.md "Session state and pings". It lives in the trace view rather than
Stack/control.html (the Vezérlőterem shows the Council's structure, not live sessions).

**#3 built 2026-11-14:** `docs/council/04_DEBATE-PROTOCOL.md` (five rounds, the four tags, the prompts) + `tools/council-debate.js`
(`new` / `check`), Bernard's job 5, COUNCIL-Q9 open on what a debate costs to start. No real debate run yet.

---

## 1. Worth taking (details)

### 1. Agent state and notifications — peon-ping, herdr
- **peon-ping:** a hook on SessionStart / Stop / Notification / PermissionRequest / PostToolUseFailure
  maps the event to a sound category, picks a clip without repeats, plays it async (PowerShell
  MediaPlayer on Windows; WAV-only SoundPlayer on Win11 24H2+). Optional ntfy/Pushover push. MIT.
- **herdr:** a Rust multiplexer; the reusable part is its per-pane **working / blocked / idle** state.
- **VRG version:** `Console/tools/hooks.example.json` already routes all eight events to
  `trace-hook.js`. Add a consumer: tool events → *working*, Notification / PermissionRequest →
  *blocked*, Stop → *idle*. Show it in the Control Room and on the Mobile Claude screen (M22); post
  *blocked* and *done* to the Mobile Értesítések inbox (M10, stable event ids already give dedupe).
  Optional Mélyvíz chiptune WAVs on the PC. Skip the pack registry (third-party audio).

### 2. Bash output filters — rtk-ai/rtk
- A PreToolUse hook rewrites known commands (`git status` → `rtk git status`); per-command filters
  keep failing tests only, group lint results, trim trees and grep hits. On any filter error the raw
  output passes through, exit code unchanged. Apache-2.0, but parts are **BUSL-1.1**: no code, idea only.
- **VRG version:** `tools/outfilter.js` with 8–10 filters (git status/diff/log, `node --test`,
  selftests, ls/tree, grep), fail-open, raw output teed to the scratchpad, a bypass flag. Measure
  before/after from the U layer's recorded token counts rather than trusting rtk's "60–90 %" (its own
  README says cost falls less; it counts bytes/4).

### 3. Council protocol — 0xNyk/council-of-high-intelligence
- Persona contract files plus a fixed round budget: restate → independent analysis →
  cross-examination → final stance → synthesis. Checks for premature agreement, repeated claims,
  missing dissent, unsupported confidence. Verdicts tag evidence and carry dissent and kill criteria.
  MIT. No outcome data that it improves decisions.
- **VRG version:** one protocol file for Bernard to run a seat debate; the evidence tags fit Solomon's
  signals and the DECISIONS files (a decision records which of its premises were ASSUMPTION).

### 4. Diagram checks — tt-a1i/archify, Agents365-ai/drawio-skill
- **archify:** agent writes a typed JSON IR → zero-dep Node validator (schema, layout, routes,
  labels) returns machine-readable repair data → `deliver` writes one self-contained HTML/SVG and
  replaces the target only on pass. Apache-2.0.
- **drawio-skill:** `validate.py` lints overlaps, clipped labels and stacked edges with a score;
  `sync` updates changed nodes by id and keeps manual layout. MIT.
- **VRG version:** a pure-function linter for Topology View / BuildTree / Inventory diagrams, run in
  tests and before export; and the keep-manual-layout rule for regenerated diagrams.

### 5. Compress-with-retrieve — headroomlabs-ai/headroom
- Routes JSON / code / prose to different compressors, caches originals, and the model calls
  `headroom_retrieve` for the full text. Skip its proxy and ML model; telemetry beacon is on by
  default (`HEADROOM_BEACON=off`).
- **VRG version:** the Stack already budgets answers (`--budget`, "… N more hits"). Add an id per
  truncated answer and a `stack_retrieve` tool, plus per-type trimming (JSON array → schema + first and
  last rows; logs → deduplicated lines).

### 6. Research vault — jordan-gibbs/hyperresearch
- Fetched sources saved as markdown with YAML frontmatter, indexed in SQLite (rebuildable from the
  markdown), reused across runs; critic and cite-check passes; patcher agents limited to Read/Edit. MIT.
- **VRG version:** akecheta saves each source it reads under `docs/research/research_notes/` with url,
  date and hash; the Stack G layer indexes them; a cite-check script greps every quoted string in a
  note against its saved source. Notes like this one would then carry checkable sources.

### 7. Design-system hygiene — awesome-claude-design, ui-ux-pro-max, replica-skill
- `DESIGN.md` = palette, type, spacing and rules as one plain-markdown spec an agent can follow.
  ui-ux-pro-max's "reasoning engine" is BM25 over CSV files. replica-skill ships a WCAG contrast helper.
- **VRG version:** a `DESIGN.md` for Mélyvíz and Hajnalfény generated from the token files, and a
  contrast check over every fg/bg pair (computed values, per CLAUDE.md's colour rule) in
  `shared/vrg-ui-kit/test/lint.js`.

## 2. Small, take when convenient
- **MCP hardening checklist** (tonhowtf/omniget, GPL-3.0 — idea only): loopback only, bearer token,
  pairing code, approval for risky actions. Check the Mobile relay and Console servers against it.
- **Brand logos on demand** (homarr-labs/dashboard-icons, Apache-2.0): fetch the few vendor logos the
  Inventory needs by URL pattern and inline them. Never vendor the 1.1 GB repo; trademarks are for
  identification only.
- **Element → source map** (onlook): stamp `data-src="module:line"` in the Planner/Inventory build so
  a click in a preview can name its module. ~1 day.
- **Single-file 16:9 deck** (frontend-slides): a handover / quote presentation page. Template repo's
  licence is unstated, so write our own.
- **Edge provenance** (graphify): tag Stack edges EXTRACTED vs INFERRED where the layer does not
  already say it; a one-page "god nodes" report next to `stack.js health`.
- **Worktree per agent** (orca), **atomic task checkout + approval gate** (mission-control,
  paperclip), **hard budget stop** from recorded spend (paperclip): Control Room ideas, hours each.
- **Prompt-change diff** (Piebald-AI/claude-code-system-prompts): reference only; the prompt text is
  Anthropic's and its licence is unclear, so do not vendor it.

## 3. Skip
- **ruvnet/RuView** — needs ESP32-S3 nodes exporting CSI (+ an optional $140 hub); commodity routers
  give no CSI, a laptop gives only RSSI, and the original ESP32 in our CYDs is unsupported. Its own
  README reports live pose PCK@20 = 3.0 % against a 35 % target and a runtime stub returning confidence
  0; "through 30 cm concrete" and vitals accuracy are unsourced. Same verdict family as
  see-through-walls (2026-10-22). If presence sensing comes back, it goes through
  `BRIDGE/04_related-hardware/presence-sensing-building-blocks-v1.md`, not this repo.
- **cheaper-inference/OmniRoute** — stores many third-party keys, TLS fingerprint impersonation,
  affiliate links. Riskiest of the batch.
- **winfunc/opcode** (AGPL-3.0), **Devin-AXIS/iPolloWork** (source-available, not open source),
  **stablyai/orca**, **paperclipai/paperclip**, **builderz-labs/mission-control** as apps — we have
  replay and the Control Room.
- **DeusData/codebase-memory-mcp** — the Stack covers it; at most a regex-level JS import graph.
- **onlook, open-codesign, ego-lite, agent-sprite-forge, replica-skill** as products — wrong stack or
  wrong purpose for an electrician's toolset.
- **Reading only:** shareAI-lab/learn-claude-code (s06 compaction chapter), hesreallyhim/awesome-claude-code,
  luongnv89/claude-howto, levz0r/awesome-vibecoded-apps. jarrodwatts/claude-hud is already installed.

## 4. Not confirmed
- No source code was read; "stdlib only", "no network" and "no telemetry" claims are untested.
- Whether any star counts are inflated.
- Telemetry for herdr, mission-control, opcode, iPolloWork, peon-ping, hyperresearch (READMEs silent).
- The dashboard-icons LICENSE text and the frontend-slides template licence.
