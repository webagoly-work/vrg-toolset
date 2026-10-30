# WP-MCP-1 — `tools/planner-mcp.js`, headless over jsdom

Status: todo · Depends: MCP-0 · Size: M (~450 lines in `tools/`, ~200 in the spec) · Spec: 122 ·
Decisions: Q-02 (answered C), Q-03 (answered B)

## Goal

A Model Context Protocol server any Claude Code session can start: it boots the built Planner in jsdom
— exactly the way every spec and `tools/cla-plan.js` already do — loads a plan, and exposes the
read-only tools plus `run_action` over stdio. No window, no relay, no file writes. This replaces the
ad-hoc jsdom scripts and `javascript_tool` sessions that drive the Planner today for CLA checks and
takeoffs.

## What exists

- The boot recipe (`tools/cla-plan.js` lines 20–27, `tests/spec-95-tool-controller.js` lines 4–12):
  `new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/'})`, stub
  `alert` / `confirm` / `prompt`, wait, `hardResetWorkspace(); applyProjectData(doc.project || doc)`.
  `url:'http://localhost/'` matters — it gives jsdom a real origin, so `localStorage` works.
- Measured boot to a ready window, 2026-10-19: **1.28 s** (`planner-stack` build), **1.45 s** (main).
  The server boots once and keeps the window for the whole session.
- MCP-0's `window.planner` — the server calls nothing else in the page.
- SolidCraft's server as the reference for behaviour (`Vendor/solidcraft/docs/mcp.md`): protocol
  revisions, stdout discipline, `-32602` vs `isError`, annotations, resources.

## Build

1. **`tools/mcp/jsonrpc.js`** — newline-delimited JSON-RPC 2.0 over stdin/stdout: requests and
   notifications. Batch arrays are **not** part of MCP 2025-06-18 — answer one with `-32600`. Parse errors →
   `-32700`, unknown method → `-32601`. Write with one `process.stdout.write(JSON.stringify(m)+'\n')`
   per message. Handle `notifications/cancelled` by ignoring it (calls are short).

   **Q-02 C (answered 2026-10-22): our own code now, the official SDK later — keep the seam.** Only
   `jsonrpc.js` and the `initialize` / `tools/list` / `tools/call` / `resources/*` dispatch in
   `planner-mcp.js` know the protocol. `tools.js` exports plain data (`{name, description, inputSchema,
   annotations, call(engine, args) → reply}`) and never touches a JSON-RPC message, so moving to
   `@modelcontextprotocol/sdk` means replacing those two places and registering the same table with
   `server.registerTool(...)`. Write the triggers at the top of `jsonrpc.js` as a comment, so the next
   session knows when the switch is due:
   ```js
   // Hand-rolled on purpose (docs/mcp/DECISIONS.md Q-02 C). Switch to @modelcontextprotocol/sdk — exact
   // version + integrity in package-lock — when any of these becomes true: a client needs the Streamable
   // HTTP transport (the CYD or the phone talking MCP directly); we want sampling, elicitation or
   // progress notifications; a protocol revision after 2025-06-18 changes something we use; or this file
   // passes ~300 lines. Until then: tools.js stays transport-free, so the switch touches two files.
   ```
   Spec 122 is written against the wire (spawned child, raw JSON lines), not against our functions, so
   it stays the acceptance test across the switch.

2. **`tools/planner-mcp.js`** — the entry:
   - args: `--planner PATH` (default `../dist/varler_planner.html` next to this file; env `PLANNER` as the
     specs use), `--in PLAN.vplan.json` (optional, loaded after boot), `--connect URL` (reserved for MCP-2:
     refuse with a clear stderr line until it exists);
   - resolve jsdom: `require('jsdom')`, falling back to the main checkout's
     `Planner/projects/varler-planner/node_modules/jsdom` by absolute path when `NODE_PATH` is not set —
     so a worktree session that forgot `NODE_PATH` still starts, and stderr says which one it used;
   - jsdom gets a `VirtualConsole` forwarded to **stderr**; uncaught page errors go to stderr too;
   - wait for `window.planner` (poll every 50 ms, give up after 15 s with a stderr line and exit 1),
     not a fixed `setTimeout(…, 300)`;
   - stderr banner (ASCII): build path, `VERSION`, action count, loaded plan, protocol revision.

3. **`initialize`** — answer `protocolVersion` = the client's if it is one of `2025-06-18`, `2025-03-26`,
   `2024-11-05`, else `2025-06-18`; `capabilities: {tools:{}, resources:{}}`; `serverInfo:{name:'varler-planner', version:<VERSION>}`;
   `instructions`: four sentences — what the Planner is (Hungarian electrical planner, UI labels are
   Hungarian), "call `list_actions` with a Hungarian or English word to find a capability", "select by id
   before running an action that needs a selection", "an action that opens a dialog leaves it open and returns its fields — answer with `dialog_submit` or
   `dialog_cancel` before anything else". Then `notifications/initialized` is accepted silently.

4. **Tools (`tools/mcp/tools.js`)** — a table `{name, description, inputSchema, annotations, call(engine, args)}`;
   `tools/list` is generated from it; `tools/call` validates `args` against `inputSchema` with a small
   hand validator (types, required, enums — not a JSON-Schema engine) → `-32602` on mismatch.

   | Tool | Args | Maps to | Annotations |
   |---|---|---|---|
   | `list_actions` | `filter?`, `group?`, `enabledOnly?`, `limit?` (default 60) | `actions.list` | readOnly, idempotent |
   | `inspect_plan` | `sections?: string[]`, `limit?` | `plan.inspect` | readOnly, idempotent |
   | `query_devices` | `type?`, `room?`, `layer?`, `level?`, `circuit?`, `ids?`, `limit?` | `plan.query` | readOnly, idempotent |
   | `run_checks` | `role?` | `plan.checks` | readOnly, idempotent |
   | `select` | `ids: string[] \| null` | `plan.select` | not readOnly, not destructive, idempotent |
   | `run_action` | `id`, `confirm?: bool`, `prompt?: string` | `actions.run` | not readOnly, **destructive** (an action can clear the plan), not idempotent, openWorld false |
   | `dialog_read` | `token?` | `dialog.read` | readOnly, idempotent |
   | `dialog_submit` | `token`, `fields: object` | `dialog.submit` | not readOnly, **destructive** (it presses OK on whatever the action does), not idempotent |
   | `dialog_cancel` | `token` | `dialog.cancel` | not readOnly, not destructive, idempotent |

   A `run_action` that opened a dialog is a success (`status:'dialog'`, not `isError`) — the description
   says so and names `dialog_submit`, otherwise models tend to retry the action.

   Every result: one `text` content block holding the reply JSON (pretty-printed only when under 4 KB,
   compact otherwise). `ok:false` → `isError:true`. Descriptions are English, ≤ 3 sentences, and say what
   comes back (copy the one-liners from MCP-0's `control.methods` table).

5. **Resources** — `planner://plan` (`plan.inspect` with defaults, `application/json`) and
   `planner://actions` (the full `actions.list`). `resources/list` and `resources/read`; no subscriptions.

6. **Lifecycle** — stdin `end` → `window.close()` and exit 0. A page error inside a call → the call's
   `isError` result carries it; the server keeps running. `SIGINT` → exit 0.

7. **No writes.** This WP has no `path` argument anywhere and the capture of MCP-0 keeps `files` in
   memory. Saving / opening files is MCP-3, behind the allowlist.

## Tests — `tests/spec-122-mcp-headless.js`

Spawns `node tools/planner-mcp.js --in <repo>/Calculator/CLA-teszt_v2.vplan.json` with `NODE_PATH`
in `env`, talks to it line by line, kills it in `finally`.
1. `initialize` (2025-06-18) → same revision back, `serverInfo.name==='varler-planner'`; an unknown
   revision (`1999-01-01`) → `2025-06-18`.
2. `tools/list` → the six tools, each with `annotations`; `run_action` has `destructiveHint:true`,
   `inspect_plan` has `readOnlyHint:true`.
3. `inspect_plan` → `counts.devices` equals the device count of the same file loaded directly in a second
   jsdom (the spec boots one for comparison).
4. `list_actions {filter:'lámpa'}` → contains `lamp.sheet`.
5. `query_devices {room:'Nappali'}` → non-empty; every row has `facts`.
6. `select` a device id, `run_action {id:'dev.height'}` → not `isError`, `status:'dialog'`, a `token`,
   field `dzq`; `run_action {id:'view.reset'}` now → `isError`, `dialog-open`; `dialog_submit {token,
   fields:{dzq:1300}}` → `ok`; `inspect_plan`'s `doc.undo` grew by 1; `query_devices {ids:[that id]}` →
   `h:1300`; `dialog_read` → `open:false`. A second `run_action {id:'dev.height'}` + `dialog_cancel` →
   undo depth unchanged.
7. `run_action {id:'nope'}` → `isError:true`, text contains `unknown-action`; a call with
   `{id: 5}` → JSON-RPC error `-32602`.
8. Every line the child wrote to stdout parses as JSON (collect them all; stderr is free text).
9. Close stdin → the child exits 0 within 2 s.

## Verifier focus

stdout purity under load (run 200 `inspect_plan` calls, then check 8). The server must not depend on the
cwd: start it from `H:\` and from the repo root. `NODE_PATH` fallback message on stderr.

## Live check (owed)

Add it to a Claude Code session by hand (no `.mcp.json` yet — that is MCP-3):
```bash
claude mcp add planner-test -- node H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/tools/planner-mcp.js --in H:/VRG/Full/Planner_VRG_U100/Calculator/CLA-teszt_v2.vplan.json
```
and ask that session for the CLA device count per room and the validation errors. Remove it afterwards
(`claude mcp remove planner-test`).
