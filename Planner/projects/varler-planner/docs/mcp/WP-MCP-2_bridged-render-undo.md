# WP-MCP-2 — bridged mode through the relay, `render`, `undo` / `redo`, `batch`, `set_device`

Status: todo · Depends: MCP-1 · Size: L (~250 lines `tools/`, ~120 `src/`, ~70 relay, ~300 specs) ·
Specs: 123, 124 · Decisions: Q-06, Q-07, Q-08, Q-09, Q-10, Q-12, Q-13

## Goal

The same server, started with `--connect ws://127.0.0.1:47291`, drives **the tab the user is looking
at** instead of a hidden jsdom window — the user watches the agent work and keeps one undo history with
it (CADCraft `--connect`, SolidCraft `--control`). Plus the tools that only make sense once an agent
changes things: a picture of the result, undo / redo, an all-or-nothing batch, and a direct device edit.

## What exists — and four things that are wrong for a third client (README F3, F4)

- `tools/phone-relay-server.js`: listens on **all interfaces** (the phone needs the LAN), no auth, CORS
  `*` on `/whoami`; learns each socket's role from its first `hello`; rebroadcasts every message to every
  socket of a **different** role.
- `src/07a-link.js`: one `peer` variable, overwritten by every `hello`. With the phone, the CYD bridge
  (`role:'cyd'`) and now an agent on the relay, `peerWants('state')` and the link panel's "Telefon:
  <app>" line (`07d-linkpanel.js:278`) follow whoever said hello last.
- `ack` carries `{id, ok, reason}` — no request id and no result, so a client cannot match a reply to a
  call or read a value back.
- `07e-dash-link.js` (main, uncommitted) registers `dash.action`, which runs **any** registered action
  for any LAN client that sends a `cmd`. That gap exists today; this WP does not widen it, and Q-07 C
  would close it too.

## Build

### A. Wire and relay (Q-06 A, Q-07 C, Q-08 A)

1. **Addressed messages.** An envelope may carry `to: '<role>'` or `to: '<role>#<instance>'`. The relay
   delivers an addressed message **only** to matching sockets; unaddressed messages keep today's
   broadcast-to-other-roles rule unchanged (phone and CYD do not change).
2. **Instances.** The Planner's `hello` gains `instance` (a random 6-char id per page load, kept in
   `sessionStorage` so a reload keeps it) and the page's `VERSION` and project name. The relay records
   `ws.__inst`. The relay answers a new `{type:'peers'}` request with `[{role, instance, app, ip, since}]`
   — only to a loopback socket.
3. **The gate (Q-07 C, answered 2026-10-22).** Two ways reach the relay: a device on the LAN, and a web
   page in the user's browser — which connects from **127.0.0.1**, because WebSockets are not bound by
   CORS. So the gate has three parts in `tools/phone-relay-server.js` and one in each consumer:
   - **3a · Origin check, at the upgrade.** `new WebSocketServer({server, verifyClient})`: accept a
     connection whose `Origin` header is **absent** (Node clients: the MCP server, the CYD bridge), `null`
     (the Planner opened from `file://`), `http://localhost:8131` / `http://127.0.0.1:8131` (planner-serve),
     or the relay's **own** origin `http://<any of this PC's addresses>:<bound port>` (the phone page it
     serves). Anything else → HTTP 403 and one ASCII log line naming the origin. Extra origins only through
     `RELAY_ORIGINS=a,b` (env), never a wildcard. `/whoami` keeps its `Access-Control-Allow-Origin: *` —
     it hands out addresses only, and `file://` needs it.
   - **3b · Loopback for agents.** A socket whose `hello` says `role:'agent'` is accepted only from
     `127.0.0.1` / `::1` / `::ffff:127.0.0.1` (helper `isLoopback(ip)`); from anywhere else one error
     envelope, then close. `rpc` from a socket whose role is not `agent` is dropped and logged.
   - **3c · The `via` stamp.** Every JSON envelope the relay forwards gets `via:'local'` (sender is
     loopback) or `via:'lan'` — **overwriting** any `via` the sender wrote, so a client cannot claim to be
     local. Non-JSON payloads (legacy one-way phones) pass through unstamped and count as `lan`.
   - **3d · The tab enforces it** (`07f-agent.js`): `rpc` runs only when `via==='local'` **and**
     `from==='agent'`, else `rpc.result {ok:false, code:'forbidden'}`. An envelope with no `via` at all
     (an old relay) is refused too: the stamp is the proof the gate ran.
   - **3e · Close today's gap in `07e-dash-link.js`** (committed in `bf50e01`, so no longer another
     session's open work — still run `tests/spec-101-dash-link.js`): `dash.action`, `dash.phase` and
     `dash.stop` run only when the envelope's `via==='local'`; otherwise they `return false` (the ack says
     not ok) and leave the HUD alone. The CYD bridge always connects from this PC
     (`Firmware/planner-cyd/app/bridge/bridge.js` probes `ws://127.0.0.1:47291…`), so the CYD keeps working.
     The phone's four `cmd`s (`tool.select`, `edit.undo`, `edit.redo`, `view.reset`) stay allowed from
     the LAN, unchanged. For this, `PLANNER_LINK`'s `runCommand` (07a) passes the whole envelope as a
     second argument, `fn(payload, envelope)` — today handlers get only the payload.
   Log lines stay ASCII.
4. **`07a-link.js` peers map.** `peers[role] = {role, app, caps, instance}`; `peer` stays as an alias of
   `peers.phone || first non-agent peer` so `07d`'s panel keeps showing the phone, and `peerWants(cap)`
   checks the phone's caps as before. Expose `peers()` in the API. An agent `hello` must not change
   what the link panel shows (test).
5. **`send(type, payload, to)`** — optional third argument sets `to` on the envelope. `rpc.result` is
   always sent `to:'agent'`, so the phone and the CYD never see agent traffic.

### B. Server side (`tools/mcp/engine-bridged.js`)

6. The engine interface is the one `engine-headless.js` already has — `request(method, params) → Promise<reply>` —
   so `tools.js` does not know which mode it runs in.
7. Connect with `ws` as `{from:'agent', type:'hello', payload:{role:'agent', app:'planner-mcp/<ver>', caps:['rpc']}}`.
   Pick the tab (Q-08 A): ask the relay for `peers`, take the planner instance with the most recent
   `inputAt` from its `dash` snapshots (07e already sends `inputAt` every ≤ 2.5 s), fall back to the most
   recent `hello`. Say which tab in every tool result's metadata (`tab: {instance, project}`).
8. `rpc` envelope: `{type:'rpc', to:'planner#<inst>', payload:{rid, method, params}}`; wait for
   `rpc.result` with that `rid`. Timeout **30 s** → `{ok:false, code:'timeout', state}` where `state` is
   `'not-run'` if the relay never confirmed delivery, else `'may-have-run'` with the advice "inspect the
   plan before sending a change again" (CADCraft's wording, `Vendor/cadcraft/docs/control-protocol.md`).
9. **No tab yet.** The server starts even when no relay or no Planner tab is there (an MCP client may
   launch it first). `instructions` then say so, and every tool answers
   `{ok:false, code:'no-planner', error:'No Planner tab is connected to ws://127.0.0.1:47291. Start the relay (node tools/phone-relay-server.js) and connect the Planner (Telefon panel -> Kapcsolodas).'}`.
   The first call after a tab appears connects. A tab closing mid-call → `may-have-run`.
10. Reconnect to the relay with the 07a rhythm (2 s), never a tight loop.

### C. New methods in `07f-agent.js` and their tools

11. **`edit.undo` / `edit.redo`** → run the registry's `edit.undo` / `edit.redo` actions (so an open
    editor's own history wins) and return `{undo, redo}` depths. Tools `undo`, `redo`: not readOnly, not
    destructive, not idempotent.
12. **`edit.batch {steps:[{method, params}], rollback=true}`** (Q-12 A) → take a full checkpoint
    (`__snap()` of every `UKEYS` collection + walls + `stacks` + `layers` + `undo.length`), run the steps in
    order, stop at the first `ok:false`; with `rollback`, `applySnap` the checkpoint and truncate `undo` /
    `redo` back to their lengths, so the plan **and** the history are as before. Reply
    `{ok, completed, results, failed:{index, method, error}}`. Allowed step methods: `actions.run`,
    `plan.select`, `plan.setDevice`, `dialog.submit`, `dialog.cancel` — a dialog action inside a batch is two
    steps, the run and its submit (Q-03 B), and the submit's `token` may be written `"$prev"` to mean the
    dialog the previous step opened. A batch that ends with a dialog still open fails (and rolls back). One HUD line for the whole batch. Tool `batch`: destructive.
13. **`plan.setDevice {id, fields}`** (Q-13 A) → whitelist per device kind: `x`, `y` (mm), `h`, `level`,
    `layer`, `name`/`label`, `note`, `type` (only within the same family), `grp` (switch group),
    `circuit` — validate each against the schema's types and the level / layer / circuit existing.
    `pushUndo(['devices'])` once, apply, `draw()`. Unknown field → `bad-params` listing the allowed ones.
    Tool `set_device`: not readOnly, not destructive (undoable), not idempotent.
14. **`plan.render {view, level?, wall?, room?, plane?, format='svg', width?, symbols=true}`** (Q-09 A, Q-10 A):
    - `view:'plan'` — the live scene the user sees in Normal style, i.e. `draw()`'s `#lyScene` content
      with device symbols (`symbols:false` → `drawNormalGeom()` only, the golden path), framed around
      the level's walls the way `tools/cla-plan.js` frames its sheet (copy the framing into
      `tools/mcp/render.js` for the headless side — read it, do not import a CLI script);
    - `view:'blueprint'` → `drawBlueprintPlan()`; `view:'iso'` → the scene at the 45° preset
      (`camPresetApply`), restoring the user's camera afterwards **in bridged mode** (the user must not
      lose their view to an agent's picture);
    - `view:'elevation', wall:'W12'` → `wallElevationSVG(...)`; `view:'plane', room:'F3', plane:'floor'|'ceiling'|'drop'` → `planeViewSVG(...)`;
    - the overlay (selection, hover, gizmo) is never included.
    - `format:'png'` (Q-09 C, answered 2026-10-22): **resvg, in the server, for both modes.** The tab (or
      the jsdom window) only ever produces the SVG; `tools/mcp/render.js` rasterises it with
      `@resvg/resvg-wasm` — the WebAssembly build, chosen over the native `@resvg/resvg-js` because it has
      no per-platform binary to go stale on a portable drive. One renderer means a headless and a live
      picture of the same plan are the same pixels, and it works in every checkout (the portable Chrome
      lives only in the main checkout's git-ignored `Planner/apps`). Details:
      - the pack's one exception to "no new npm dependency" (CONTRACT §3): exact version in
        `package.json` (no `^`), `npm install` once in the main checkout, the integrity digest lands in
        `package-lock.json`; record the version and the date in the WP report;
      - fonts: hand resvg the Windows font folder (`%WINDIR%\Fonts`) and the family the Planner's SVG asks
        for; a missing family falls back silently, so spec-124 test 3 checks a label with `ő` / `ű`;
      - `width` (default 1600 px, max 4096) sets the PNG width; the height follows the SVG's aspect;
      - the wasm module is initialised once per server process, lazily, on the first PNG;
      - nothing changes in the tab: `svgToPng` stays as it is for the user's own PNG export.
    - MCP result: an `image` content block (`image/png`, base64) for PNG; for SVG a `text` block with the
      SVG when ≤ 200 KB, else a summary and the scratch path (headless) — never a 2 MB string in context.
    - Tool `render`: readOnly (it restores the camera), idempotent.

### D. Annotations (the whole table after this WP)

| Tool | readOnly | destructive | idempotent |
|---|---|---|---|
| `list_actions`, `inspect_plan`, `query_devices`, `run_checks`, `render` | ✔ | — | ✔ |
| `select` | — | — | ✔ |
| `set_device`, `undo`, `redo` | — | — | — |
| `run_action`, `batch` | — | ✔ | — |

`openWorldHint:false` on all of them (the Planner reaches nothing outside itself; file tools in MCP-3
change that for three tools).

## Tests

`tests/spec-123-mcp-bridged.js` — everything in one Node process plus one child:
1. Start the relay on a free port (spawn `tools/phone-relay-server.js <port>`), boot a jsdom tab whose
   `WebSocket` is jsdom's real one (or `ws` injected as `window.WebSocket`), `PLANNER_LINK.connect(...)`.
2. Spawn the server with `--connect ws://127.0.0.1:<port>` → `inspect_plan` counts equal the tab's
   `__data`; the reply names the tab's `instance`.
3. A fake phone socket on the same relay sees **no** `rpc` / `rpc.result` traffic; it still receives the
   Planner's `state` broadcasts; the link panel's peer is still the phone after the agent's hello.
4. Kill the tab → the next call returns `no-planner` (or `may-have-run` if mid-call); reconnect a new tab →
   calls work again without restarting the server.
5. Start the server with no relay at all → `tools/list` works, `inspect_plan` → `no-planner` with the
   start-the-relay sentence.
6. Relay gate (Q-07 C):
   - a WebSocket opened with `Origin: https://example.com` → refused at the upgrade (403); with no Origin,
     `null`, `http://localhost:8131` and the relay's own `http://127.0.0.1:<port>` → accepted;
   - `isLoopback()` unit cases: `::ffff:192.168.1.5` ✗, `192.168.0.2` ✗, `127.0.0.1` ✓, `::1` ✓, `::ffff:127.0.0.1` ✓;
   - the stamp function with a fake LAN address and a client-written `via:'local'` → `lan` wins;
   - the tab refuses `rpc` carrying `via:'lan'`, and `rpc` with no `via` (`forbidden`);
   - 07e: `dash.action` with `via:'lan'` → ack `ok:false`, the action did not run; with `via:'local'` → it
     runs; a phone `cmd` `edit.undo` with `via:'lan'` → still runs.
7. `render {format:'png'}` through the live tab and through a headless server on the same plan →
   identical PNG bytes.

`tests/spec-124-mcp-render-undo.js` — headless server:
1. `render {view:'plan', level:'ground'}` → SVG text contains the scene's wall rect count for that level
   and at least one device symbol group; `symbols:false` contains none.
2. `render {view:'elevation', wall:<a CLA wall id>}` → SVG; unknown wall → `not-found`.
3. `render {format:'png'}` → an image block whose base64 starts `iVBOR`; decoded width === the requested
   `width`. **Fonts:** render a small SVG with the label `Fürdőszoba – ű ő` through the same `render.js`
   function and check there are dark pixels inside the text's box (with resvg a missing font gives an
   empty box) — read them from resvg's own raw pixel output, no image library. The same PNG twice →
   identical bytes (determinism; spec-123 test 7 relies on it).
4. `set_device {id, fields:{h:900}}` then `undo` → `h` back; `redo` → 900 again; `set_device {fields:{foo:1}}` → `bad-params` naming the allowed fields.
5. `batch` with three steps where step 2 is an unknown action → `failed.index===1`, the device changed in
   step 1 is back to its old value, `undo` depth equals the depth before the batch.
6. `tools/list` annotations match table D exactly.
7. Golden identical.

## Verifier focus

The camera restore in bridged `render` (take a `state` copy of `yaw`, `pitch`, `zoom`, `pan*`, `flat`,
`style` before and compare after). No `rpc` reaching the phone or the CYD. The relay's existing logs and
`/whoami` unchanged (diff its output on a phone connect before and after).

## Live check (owed)

Start the relay from the launcher, open the Planner (`planner-serve`), connect it, start the server with
`--connect`, and from a Claude Code session: select a socket, `set_device h=1100`, `render` the plan →
the user sees the HUD line `🤖 Ügynök: …` and the socket move, Ctrl+Z in the tab undoes the agent's
change. Screenshot for the user.
