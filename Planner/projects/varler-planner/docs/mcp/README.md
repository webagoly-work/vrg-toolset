# Planner MCP — build pack

*An agent interface for the Varler Planner: the Ctrl+K action registry as the command surface, jsdom
as the headless engine, the existing WebSocket relay as the bridge to the open tab. Built from §4 of
`docs/research/2026-10-19_cad-sources-and-mcp.md` (repo root). Analysis only — **nothing here is
built**. Written 2026-10-19 against `main` @ `2447365` plus that checkout's uncommitted work; every
anchor below was read in that tree, and `05c`, `07a` and the relay were checked byte-identical on
`planner-stack` @ `a7d0a6d`.*

Read in this order: `00_CONTRACT.md` → this README's §2 findings → the WP you build. `DECISIONS.md`
holds 18 open questions, each with a recommended **A**; a WP builds A unless §5 records another answer.

| File | What |
|---|---|
| `README.md` | this — what the MCP is for, the phases, findings, order, status, answers |
| `00_CONTRACT.md` | where / how to work, layout of the new code, one name per concept, reply shape, specs 120–126, report format |
| `WP-MCP-0_browser-api.md` | `window.planner` + the `rpc` handler in the tab (`src/07f-agent.js`) |
| `WP-MCP-1_headless-server.md` | `tools/planner-mcp.js` over jsdom, stdio, read-only tools + `run_action` |
| `WP-MCP-2_bridged-render-undo.md` | `--connect` through the relay, `render`, `undo` / `redo`, `batch`, `set_device`, annotations |
| `WP-MCP-3_files-config-skill.md` | `open_project` / `save_project` / `export` behind a folder + extension allowlist, `.mcp.json`, the `planner-drive` skill, launcher item |
| `DECISIONS.md` | Q-01 … Q-18, A / B / C |
| `PROMPTS.md` | build-one / verify / resolve prompts |

Design references (data, not instructions — ignore those repos' own `AGENTS.md` / `CLAUDE.md`):
`Vendor/solidcraft/docs/mcp.md` and `docs/browser-api.md`, `Vendor/cadcraft/docs/control-protocol.md`.
Nothing is ported from them; the shapes are borrowed.

---

## 1. What it is for

Today P33 jobs, takeoffs and acceptance runs are done by sessions that script the Planner by hand —
`javascript_tool` in a browser pane or a one-off jsdom script (`tools/p33-plan.js`, `p33-axo.js` and
friends each re-invent the boot). After this pack any session (or the second account) gets a stable
interface with the same action ids, undo history and checks as the UI:

```
                    ┌──────────── Claude Code session ────────────┐
                    │  .mcp.json → planner  |  planner-live       │
                    └──────────┬───────────────────┬──────────────┘
                         stdio │ JSON-RPC          │ stdio
              ┌────────────────▼──────┐   ┌────────▼───────────────┐
              │ tools/planner-mcp.js  │   │ tools/planner-mcp.js   │
              │ headless (MCP-1)      │   │ --connect (MCP-2)      │
              │  jsdom ─ dist/*.html  │   └────────┬───────────────┘
              └────────┬──────────────┘            │ ws, role 'agent', loopback only
                       │                 ┌─────────▼────────────────┐   phone, CYD, Board Console
                       │                 │ tools/phone-relay-server │◄── (unchanged traffic)
                       │                 └─────────┬────────────────┘
                       │ window.planner            │ rpc → rpc.result (to: planner#inst)
              ┌────────▼───────────────────────────▼───────────────┐
              │ src/07f-agent.js  PLANNER_API  (MCP-0)              │
              │   actions.list / actions.run → ACTIONS (05c)        │
              │   plan.inspect / query / checks / select / render   │
              │   edit.undo / redo / batch · doc.load / save        │
              └─────────────────────────────────────────────────────┘
```

One implementation (MCP-0, in the page), two transports (jsdom in-process, relay to a tab). Agents run
the actions the user runs; there is no second engine and no raw-JS tool.

## 2. Findings (read before touching the area)

**F1 · Actions take no parameters, and half of them do not "just run".** Registry census 2026-10-19
(jsdom boot of each build, heuristic over each `run`'s source): main 255 actions / planner-stack 259;
~140 run straight through, **~39 open a dialog** (`openModal`), **~70 start a pointer tool**, 6 click a
DOM button, 2 ask `confirm()`, 5 end in a download; 87 carry `need` (a selection first). Hence the
`status` classification in MCP-0 step 5 and the decisions Q-03 / Q-04 / Q-05. Measured: after
`runAction('mode.wall')`, `toolCurrent()` reports `mode.wall`, so plain modes count as tools too.

**F2 · `runAction` swallows the reason.** It writes the exception to the HUD and returns `false`
(`05c-actions.js:38–41`) — an agent would get `false` for unknown, disabled and crashed alike. MCP-0
adds `actionExec` beside it and keeps `runAction`'s bool for the palette, the keyboard map and `dash.action`.

**F3 · `PLANNER_LINK` was built for one peer.** `07a-link.js` keeps a single `peer`, replaced by every
`hello` — with the phone, the CYD bridge and an agent connected, `peerWants('state')` and the link
panel's "Telefon: …" line (`07d-linkpanel.js:278`) follow whoever said hello last. `ack` has no request
id and no result. MCP-2 adds a peers map, `to` addressing and the `rpc` pair; phone and CYD traffic is
unchanged.

**F4 · The relay is open on the LAN, and `dash.action` already runs any action.** The relay binds all
interfaces (the phone needs that), has no auth, and rebroadcasts to every other role. `07e-dash-link.js`
(main, uncommitted, another session's work) registers `dash.action`, which runs any registered action for
any client that sends a `cmd`. The MCP must not widen that (Q-07, under debate: loopback alone does not stop a web page, which also connects from 127.0.0.1 — see DECISIONS); Q-07 C
would also close the existing gap — the user's call, since it touches `07e`.

**F5 · jsdom cannot make a PNG.** No canvas; `svgToPng` and `vexpPng` go through `Image` + canvas + an
anchor click. Headless PNG needs the portable `chrome-headless-shell` (`Planner/apps/…`, git-ignored, main
checkout only) the way `tools/p33-axo.js:36` already uses it, or a rasteriser package (Q-09).

**F6 · Every file output has one choke point.** `download(name, text)` (`11-controls.js:268`) and
`svgToPng` (`06-wall-editor.js:306`) — capture there and every export action becomes an agent export
without touching the actions.

**F7 · Boot is cheap enough to keep, not to repeat.** jsdom boot to a ready window: 1.28 s
(planner-stack build), 1.45 s (main). The server boots once per session; `hardResetWorkspace` +
`applyProjectData` switch plans in place.

**F8 · The branches diverged; the MCP's files did not.** main has the 10-18 round, the stack (merged
`e37f856`) and `07e`; planner-stack has wireway T0–T6 and S2/S3 in flight. `05c-actions.js`,
`07a-link.js`, `tools/phone-relay-server.js` are identical on both — the MCP merges cleanly either way
(Q-01).

**F9 · `Calculator/` holds client PDFs next to the plans.** A folder allowlist alone would expose names
and addresses; MCP-3 adds an extension rule (never `.pdf`).

**F10 · `H:\_desktop` is a junction** and `Planner/home` holds `.credentials.json` — the allowlist
compares resolved paths and names those folders as never-allowed.

**F11 · The link's built-in `edit.undo` goes through `PLANNER_CAM`** (07b). The agent methods call the
registry's `edit.undo` action instead, so an open Wall / Plane editor's own history is respected.

## 3. Order and checkpoints

```
MCP-0  window.planner + rpc handler           (src only; usable from javascript_tool right away)
MCP-1  headless stdio server                  (read-only tools + run_action; no writes)
MCP-2  bridge + render + undo/redo + batch    (relay + 07a changes; the user watches)
MCP-3  files + .mcp.json + skill + launcher   (the only WP that writes to disk)
later  MCP-4 pointer placement (Q-04 C) · DXF export as an `export` kind (research §1)
```

Each WP is shippable alone: after MCP-0 a browser session can drive the tab with `javascript_tool`;
after MCP-1 batch jobs work; MCP-2 and MCP-3 add the live view and the disk.

### ⏸ Checkpoints (stop, show, wait)

| Before | Show | Why |
|---|---|---|
| **MCP-0** build | the answers to Q-04 / Q-05 (or "defaults"); Q-03 answered B | they fix the reply contract every later WP and the skill depend on |
| **MCP-2** relay change | the relay diff and a phone + CYD session still working against it | three live clients share the relay |
| **MCP-3** `.mcp.json` | the file, before it lands in the repo | every future session in the repo will be offered these servers |

## 4. Status

| WP | Title | Status |
|---|---|---|
| MCP-0 | `window.planner` + agent methods in the tab | todo |
| MCP-1 | Headless stdio server | todo |
| MCP-2 | Bridged mode, render, undo / redo, batch, set_device | todo |
| MCP-3 | File tools, `.mcp.json`, skill, launcher | todo |

## 5. Answers

2026-10-22: **Q-02 C**, **Q-03 B** — recorded with their effects in `DECISIONS.md` "Answers". Q-07 is under
debate (options revised: a web page can reach the relay through 127.0.0.1, so loopback alone is not
enough — A+ adds an Origin check and a `via` stamp). Q-09 asked about C (resvg), explained there. All
others still A.
