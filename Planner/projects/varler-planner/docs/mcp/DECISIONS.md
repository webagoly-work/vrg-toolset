# Planner MCP — decisions (A = recommended default)

Answer in one line, e.g. `Q01 A, Q03 B, …`. Unanswered = A. Each WP header names the questions it
depends on; a WP builds the default until an answer arrives here.

## Where and how

**Q-01 — which branch carries the build?**
- **A** `main` (this pack lives here). The research note, the 10-18 round and `07e-dash-link.js` — the CYD feed, the other new `PLANNER_LINK` consumer — exist only on main; `05c`, `07a` and the relay are identical on both branches, so `planner-stack` can take it later by a clean merge.
- B the `planner-stack` worktree, where the wireway work runs; the pack moves there, `07e` arrives when main is merged in.
- C a new branch `planner-mcp` off main, merged when MCP-3 is done (isolates it from the two live streams; one more branch to keep in step).

**Q-02 — MCP library.** — *answered **C** (2026-10-22)*
- **A** hand-rolled JSON-RPC 2.0 over stdio (~150 lines), no new npm dependency — the Planner's habit (`build.js` uses only `fs` and `path`; jsdom and ws are the only packages).
- B the official `@modelcontextprotocol/sdk`, exact version + integrity pinned; less code of ours, a dependency tree (zod etc.) in `node_modules`.
- C A now, switch to B if the protocol grows (streaming HTTP, sampling) — written down as a trigger, not a plan.

## How an agent runs actions

**Q-03 — actions that open a dialog (~40 of ~257).** — *answered **B** (2026-10-22)*
- **A** describe-and-cancel: the call returns the dialog's title and fields (id, label, type, value, options) and closes it; the agent calls again with `fields:{dzq:1250}` and the API fills the form and presses OK in the same call. Stateless, nothing stays open.
- B leave the dialog open and add `dialog.submit` / `dialog.cancel` follow-up calls (two-step, but the agent sees exactly what the user would).
- C refuse dialog actions; agents use only dialog-free actions and `set_device`.

**Q-04 — actions that start an interactive tool (~70: drawing modes, RBX / endpoint placement, marker pen…).**
- **A** stop the tool at once and answer `tool-started` with its name and hint: placing things by pointer is a later round (MCP-4).
- B leave the tool running; in a live tab the user finishes the click, headless it is stopped.
- C add a `plan.click {x, y, level}` method now (model mm → screen → the real pointer handlers), so agents can place devices through the same tools as the user. Most capable; jsdom has no layout, so its feasibility must be proven first.

**Q-05 — an action that asks `confirm()` (Új projekt, deletions).**
- **A** "no" unless the call passes `confirm:true`; a refused confirm answers `needs-confirm` with the question text, so the agent can ask the user.
- B always "yes" (what the specs' stubs do today).
- C always "no" — confirm-guarded actions are unreachable for agents.

## Bridged mode (MCP-2)

**Q-06 — wire format between the server and the tab.**
- **A** a new pair `rpc` / `rpc.result` with a request id, addressed `to` one tab; phone and CYD messages unchanged and never see agent traffic.
- B extend today's `cmd` / `ack` with `rid` and `result` (one format, but phone, CYD and agent share the channel and the existing `ack` consumers see the new fields).

**Q-07 — who may drive the tab as an agent?** — *under debate (2026-10-22); revised options*

The relay listens on the LAN for the phone; today `dash.action` already lets any client of the relay run any action. Two ways in, and the first draft of this question only covered one:

1. **A device on the LAN / WiFi** (a guest's phone, any gadget on the network). Its socket comes from a LAN address.
2. **A web page open in the user's browser.** It can open `ws://127.0.0.1:47291` from any site: WebSockets are not bound by CORS and the relay checks no `Origin`. Its socket comes from **127.0.0.1**, so a loopback rule lets it through. Newer Chrome versions are starting to put a permission prompt in front of local-network access, but the pack should not rely on that.

Facts that shape the answer: the CYD bridge connects from this PC (`ws://127.0.0.1:…`, `Firmware/planner-cyd/app/bridge/bridge.js`); the phone legitimately sends `cmd` from the LAN (`tool.select`, `edit.undo`, `edit.redo`, `view.reset`); our Node clients (MCP server, CYD bridge) send no `Origin` header; browser pages always do.

- A loopback only: the relay accepts an `agent` hello only from 127.0.0.1 / ::1 and drops `rpc` from anyone else. Stops (1), **not (2)**.
- **A+** (new recommendation) A **plus an Origin check**: the relay refuses a WebSocket whose `Origin` is a web site, accepting only no Origin (Node clients), `null` (the Planner from `file://`), `http://localhost:8131` / `127.0.0.1:8131` (planner-serve) and its own phone page (`http://<this PC>:<port>`). Also the relay **stamps** every envelope it forwards with `via:'local'|'lan'` (overwriting any client value), and the tab runs `rpc` only when `via==='local'` and `from==='agent'`. Stops (1) and (2); ~25 lines in the relay, no secrets, nothing to set up.
- B A+ plus a token: the relay writes a random token to a file in `%TEMP%`, the MCP server reads it and sends it in its hello (SolidCraft's token file). Adds protection only against a program already running on this PC — which could read the token file anyway, or drive the browser directly. More moving parts for little gain here.
- C A+, and use the same `via` stamp to close today's gap: `dash.action` / `dash.phase` / `dash.stop` run only when `via==='local'` (the CYD bridge is always local); the phone's four `cmd`s stay allowed from the LAN. Three lines in `07e-dash-link.js`, which is still another session's uncommitted work — so it needs that session's (or your) go-ahead.

**Q-08 — two Planner tabs are connected.**
- **A** drive the tab with the most recent user input (`inputAt` from the CYD feed), and name it in every reply.
- B refuse and list the tabs; the agent must pass `tab`.
- C the first one that connected.

**Q-09 — pictures (`render`).**
- **A** SVG always; PNG headless through the portable `chrome-headless-shell` (as `tools/cla-axo.js` already does), bridged through the tab's own canvas.
- B SVG only.
- C a rasteriser package: **resvg**, an SVG-to-PNG renderer written in Rust, used from Node as `@resvg/resvg-js` (a prebuilt native module per platform) or `@resvg/resvg-wasm` (WebAssembly, no native binary). The server turns any SVG string into a PNG in tens of milliseconds, with no browser. One renderer for **both** modes (bridged: the tab hands over the SVG, the server rasterises), so a headless and a live picture of the same plan match pixel for pixel; it works in any checkout (the portable Chrome exists only in the main checkout's git-ignored `Planner/apps`). Costs: one npm dependency pinned with its integrity (a few MB); text uses the system fonts, so accented Hungarian labels depend on Windows fonts being found (`loadSystemFonts`) — the spec must check an `ő` / `ű` label renders; resvg reads SVG presentation attributes and a subset of CSS, which suits the Planner's exporter-safe drawing rules (no filters, no `mask`, no `paint-order`).

**Q-10 — what `render view:'plan'` shows.**
- **A** what the user sees: the scene with device symbols (from `draw()`), no selection / hover overlay; `symbols:false` gives the bare geometry.
- B the golden path only (`drawNormalGeom()`: walls, floors, openings — no device symbols).
- C the blueprint by default.

**Q-11 — show the agent at work in the tab.**
- **A** HUD line `🤖 Ügynök: <action>` on each agent call and a `🤖 ügynök` chip in the status bar for 5 s after the last one.
- B silent — the changes speak for themselves.

**Q-12 — a `batch` tool (several steps, all or nothing).**
- **A** yes, with rollback to a full checkpoint (plan and undo history exactly as before when a step fails).
- B no — single calls only; the agent undoes by hand.

**Q-13 — `set_device` fields.**
- **A** a whitelist (position mm, height, level, layer, name, note, switch group, circuit, type within its family), validated.
- B any field, written as given (fast, and can store nonsense the UI never would).

## Files and setup (MCP-3)

**Q-14 — which folders the file tools may touch.**
- **A** `Calculator/`, the folder of the plan given with `--in`, a private scratch folder, and every `--allow-path`; reads only `.json`, writes `.json` / `.svg` / `.png` / `.csv`; **never `.pdf`** (the client quotes in `Calculator/`); never `H:\`, the repo root, `Planner/home|apps|data`, `.ssh`, `.git`, `.credentials.json`.
- B only scratch and explicit `--allow-path` folders (stricter; every session must name `Calculator/`).
- C no limit (`--allow-any-path` behaviour).

**Q-15 — saving over an existing file.**
- **A** refused unless `overwrite:true`; with it, one `.bak.json` of the old file is kept.
- B overwrite freely.

**Q-16 — `.mcp.json` in the repo.**
- **A** two servers: `planner` (headless) and `planner-live` (`--connect` to the relay).
- B one server that is live when a tab is connected and headless otherwise (one name, but the agent cannot tell in advance which world it changes).
- C none in the repo; document `claude mcp add` only.

**Q-17 — the agent skill.**
- **A** in the repo, `.claude/skills/planner-drive/SKILL.md` — versioned, every session in the repo gets it.
- B a source copy under `tools/skills/` that the user copies to `~/.claude/skills/` (available in every project, can go stale).
- C no skill; a docs page only.

**Q-18 — launcher.**
- **A** one item "MCP onteszt" in `VRG-DE.cmd`'s Planner submenu; the relay keeps its existing entries; `START.cmd`'s tool registry unchanged (the MCP is not a page).
- B also a letter in `START.cmd`.
- C nothing in the launchers.

## Answers

| Id | Answer | Where it changed the pack |
|---|---|---|
| Q-02 | **C** — own JSON-RPC code now, the official SDK when a trigger is hit | CONTRACT §3 · WP-MCP-1 step 1 (the seam: `tools.js` protocol-free; the triggers as a comment in `jsonrpc.js`; spec 122 tests the wire so it survives the switch) |
| Q-03 | **B** — the dialog stays open; `dialog.read` / `dialog.submit` / `dialog.cancel` | CONTRACT §4 (name table), §5 (codes `dialog-open`, `dialog-gone`), §6 · WP-MCP-0 step 5, new step 5b (token per modal generation, `dialog-open` refusal, the `🤖 Az ügynök tölti ki` line), tests 3–3c, live check · WP-MCP-1 tools `dialog_read` / `dialog_submit` / `dialog_cancel`, instructions, test 6 · WP-MCP-2 `batch` steps · WP-MCP-3 skill text |
| Q-07 | under debate — options revised (A+ added, recommended) | this file |
| Q-09 | open — option C explained | this file |

The rest still default to A.
