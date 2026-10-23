# WP-MCP-0 — `window.planner` and the agent methods in the tab

Status: todo · Depends: — · Size: M (~350 lines in `src/`, ~250 in specs) · Specs: 120, 121 ·
Decisions: Q-03, Q-04, Q-05, Q-06 (wire part only), Q-11

## Goal

One command surface for agents, inside the page: the same action ids the user runs from Ctrl+K, plus a
few read methods, behind `window.planner` (the SolidCraft browser-API shape, `Vendor/solidcraft/docs/browser-api.md`).
Everything later (headless server, bridge) only *transports* calls to this API; it is the single
implementation. Nothing here needs a server — an agent with `javascript_tool` access to a tab can
already use it after this WP.

## What exists (read before touching)

- `src/05c-actions.js`: `ACTIONS`, `registerActions`, `actionById`, `actionCtx()` (mode, level, editor,
  `sel`, `selType`, `selCount`, `is3d`, `style`), `actionEnabled`, `runAction(id)` — **returns a bool and
  swallows the exception into the HUD** (line 38–41), `paletteMatches(q)`, `actionNeed(a)`.
- Census of the registry, 2026-10-19 (jsdom boot of each build, heuristic over `String(a.run)`):

  | build | actions | enabled on an empty plan | `when` | `need` | `keys` | opens a modal | starts a pointer tool | clicks a DOM button | `confirm()` | download-like |
  |---|---|---|---|---|---|---|---|---|---|---|
  | main | 255 | 160 | 160 | 87 | 21 | 39 | 68 | 6 | 2 | 5 |
  | planner-stack | 259 | 164 | 164 | 87 | 21 | 38 | 70 | 6 | 2 | 5 |

  So roughly **half** of the actions run straight through, **a sixth open a dialog**, **a quarter start
  an interactive tool** that waits for pointer input, and a third of all actions need a selection
  first (`need`). The API has to say which of these happened — a bare `true` would lie in half the cases.
- `src/09-menus.js:103` `openModal(title, bodyHtml, onOk, okLabel)` — every dialog is one `#modal`
  with inputs addressed by `id` (`#dzq`, `#bsSel`, `#csF`…) and `#mOk` / `#mCancel`. That uniformity is
  what makes a generic `dialog.read` / `dialog.submit` (Q-03 B) possible without touching the ~40 actions.
- `src/11-controls.js:268` `download(name, text)` and `06-wall-editor.js:306` `svgToPng(...)` — the two
  places every file output goes through (an anchor `click()` on an object URL).
- `src/05cb-toolctl.js` `toolCurrent()` / `toolStop()` — the one-live-tool controller (UI tidy T1).
- `src/01-schema.js` `validateSummary()`; `src/05m-stack.js` `stkCheck(S, roleKey)`;
  `src/05db-layout.js` `phCheck(p)` over `PH_LIST`; `src/10-lamps.js` `hovFacts(d)` (the hover card's
  rows — type, circuit, layer, **room** via `roomOfDevice`, height) — reuse these, never re-derive.
- `src/11-controls.js:151` `UKEYS`, `src/01-schema.js:19` `IDPRE` — the collections and their id prefixes.
  Walls are not in `UKEYS`: they live in `WALLS[level]` with ids `W…`, and a wall hit is
  `{t:'wall', ref:<rect>}` (never hold the ref across an undo — `reselectAfterSnap`).
- `src/12-boot.js:361` the `window.__*` test hooks (`__state`, `__data`, `__setSel`, `__undoLen`, …).

## Build

1. **`src/07f-agent.js`**, one IIFE, `const PLANNER_API=(function(){…})(); window.planner=PLANNER_API;`.
   A method table `M = {name: fn(params) → result}`; `request(method, params)` looks the method up,
   wraps it in the capture of step 3, and resolves `{ok, …}` per CONTRACT §5 (it **resolves** with
   `ok:false`; it rejects only on a programming error such as non-JSON params). Sugar: `commands`,
   `execute`, `inspect`, plus `methods()` → `control.methods`. Params: `null` → `{}`; reject params whose
   `JSON.stringify` exceeds 16 MiB (SolidCraft's bound — a pasted plan is ~0.7 MB).

2. **`actionExec(id, ctx, opts)`** in `05c-actions.js`, next to `runAction`:
   ```js
   // the agent path: the same checks as runAction, but it says WHY when it does not run
   function actionExec(id,ctx){const a=actionById(id);if(!a)return {ok:false,code:'unknown-action'};
     ctx=ctx||actionCtx();if(!actionEnabled(a,ctx))return {ok:false,code:'disabled',need:actionNeed(a)};
     try{a.run(ctx);}catch(e){return {ok:false,code:'threw',error:String(e&&e.message||e)};}
     return {ok:true};}
   ```
   and make `runAction` a one-liner over it that keeps writing the HUD message and returning a bool (the
   palette, the keyboard map, `dash.action` and the specs depend on the bool).

3. **The capture** (`agtCapture` inside the IIFE). For the duration of one `request`:
   - `window.confirm` → records `{kind:'confirm', text}`, returns `params.confirm===true` (Q-05 A). If
     a confirm was answered "no" and the action changed nothing → `{ok:false, code:'needs-confirm', message}`;
   - `window.alert` → records `{kind:'alert', text}`; `window.prompt` → records, returns `params.prompt ?? null`;
   - `download(name, text)` and `svgToPng(svg, w, h, name)` → recorded as `files:[{name, mime, size}]`,
     content kept in a per-call buffer that MCP-3's `doc.export` reads; nothing reaches the anchor;
   - **restore everything in `finally`**, including on a thrown error. The globals are top-level
     `function` declarations, so reassigning `window.download` does not rebind the module-scope
     name — wrap at the call sites instead: give `download` and `svgToPng` a one-line guard
     `if(window.__agtSink)return window.__agtSink(…)` at their top. Measure that the guard is the only
     change to both functions.

4. **`actions.list {filter?, group?, enabledOnly?, limit?}`** → rows
   `{id, label, group, alias, hint, need, keys, icon, enabled, kind}` evaluated against `actionCtx()`
   now. `filter` uses `paletteMatches` (so "lampa" finds "Lámpa adatlap" exactly like Ctrl+K). `kind` is
   the static guess from the census heuristic — `'dialog' | 'tool' | 'confirm' | 'plain'` — labelled a
   *hint*: the authoritative answer is the `status` that `actions.run` returns.

5. **`actions.run {id, confirm?, prompt?, keepTool?}`** → `actionExec`, then classify:
   - a modal is open afterwards (`modalBg.style.display==='flex'`) → **it stays open** (Q-03 B, answered
     2026-10-22). Return `{ok:true, status:'dialog', dialog}` where `dialog` is what `dialog.read` returns
     (step 5b). Not an error: nothing failed, the action is waiting for its form. In a live tab the user
     sees the same dialog the agent sees;
   - `toolCurrent()` is non-null and was null before (Q-04 A) → `toolStop()` unless `keepTool:true`
     (only meaningful when bridged), return `{ok:false, code:'tool-started', tool:{id,label}, hint:HINTS[mode]}` —
     the agent learns the capability needs pointer input, which is a later round;
   - otherwise `{ok:true, status:'done', changed, undo:undo.length, sel, hud, messages, files}` where
     `changed` compares `shellModelKey()` before and after (05c line 132 — the status bar's own model
     fingerprint), `hud` is `$('hud').textContent` if it changed during the call.
   - After every run: `draw()` once (several actions rely on the caller to redraw).

5b. **The open dialog: `dialog.read` / `dialog.submit` / `dialog.cancel`** (Q-03 B).
   - **Token.** `openModal` and `closeModal` (`09-menus.js:96–104`) bump a module counter `agtModalGen`
     (one line each, through a tiny hook the IIFE installs: `window.__agtModalGen`). The dialog's token is
     `<action id>#<gen>`. Every `dialog.*` call carries the token; a different current generation (the
     user closed it, another dialog replaced it) → `{ok:false, code:'dialog-gone'}`. That is what makes a
     dialog shared with a watching user safe: whoever acts second gets a clear answer, not a wrong form.
   - **`dialog.read {token?}`** → `{token, action, title, okLabel, fields:[{id, label, type, value, options?, min?, max?, step?, checked?}], text}`
     — `label` is the nearest `<label>` or the row's leading text, `text` the dialog's non-field prose
     (several dialogs explain themselves, e.g. the chase widths line). No dialog open → `{ok:true, open:false}`.
   - **`dialog.submit {token, fields}`** → set each `#id` (inputs by `.value`, checkboxes by `.checked`,
     selects by value or by option text), fire `input` + `change` (some dialogs live-update on `oninput`,
     e.g. `#bsFine`), then `$('mOk').onclick()`. Unknown field id → `bad-params` listing the real ids,
     nothing pressed. If the modal is **still open** afterwards (its `onOk` returned `false` — a refused
     value), return `{ok:false, code:'bad-params', hud, dialog:<dialog.read>}` and **leave it open** so the
     agent can correct and submit again. Success → the same reply as a `done` run (`changed`, `undo`, `hud`, `files`).
   - **`dialog.cancel {token}`** → `closeModal()`; `{ok:true}`.
   - **While a dialog is open** every other mutating method (`actions.run`, `plan.select`,
     `plan.setDevice`, `edit.*`, `doc.load`) answers `{ok:false, code:'dialog-open', dialog:<dialog.read>}`
     — an agent that forgot its dialog is told, instead of acting under a modal. Read-only methods work.
   - **Who owns it.** Headless: the dialog lives in the jsdom window until submitted or cancelled.
     Bridged: an agent-opened dialog shows one extra line under its title, `🤖 Az ügynök tölti ki — Mégse
     visszaveszi.` (part of the Q-11 cue); the user may still type in it or cancel it, and the token rule
     above sorts out the race.

6. **`plan.select {ids:[…]|null}`** → resolves ids to hits: devices / openings / floors / objects /
   roofs / notes / measures / cables / paths by `data[k].find(x=>x.id===id)` → `{t:k, i}`; walls by
   scanning `WALLS[level]` for `id` → `{t:'wall', ref}`. One id → `selected`; several → `selected` +
   `addMulti` for the rest; `null` → clear. Returns `{sel:[ids], missing:[ids]}`. Required because 87
   actions are disabled until something is selected.

7. **`plan.inspect {sections?, limit?=50}`** → a bounded JSON summary. Sections (default all):
   `doc` (name, `VERSION`, `data.v`, `SCHEMA_VERSION`, mode, `toolCurrent()`, active level, style, undo/redo depth),
   `levels` (`ORD` with `LH`, wall count, room count), `counts` (every `UKEYS` length + walls per level),
   `rooms` (per level: id, name via `roomLabel`, area if the room sheet has it), `layers` (id, name,
   visible, role), `stacks` (id, name, roles present), `circuits` (id, label, mcb, member count),
   `validate` (`validateSummary()` error / warn + first `limit` issues), `selection`.
   Every list is capped at `limit` with a `truncated:n` count — an agent's context is the budget.

8. **`plan.query {type?, room?, layer?, level?, circuit?, ids?, limit?=200}`** → device rows
   `{id, ref, type, level, x, y, h, layer, facts}` where `facts` is `hovFacts(d)` as `{k:v}` (Hungarian
   keys: Típus, Áramkör, Réteg, Helyiség, Magasság). `room` matches the room label or id through
   `roomOfDevice`; `type` matches `d.type` or the endpoint code.

9. **`plan.checks {role?}`** → `{validate:{error,warn,issues}, phases:[{k,n,bad,warn}] (phCheck over PH_LIST),
   stacks:[{id,name,checks:stkCheck(S, role)}]}`.

10. **`ping`** → `'pong'`; **`control.methods`** → `[{method, params, description}]` from the method table
    (each entry carries a one-line English description and a params sketch — the same text MCP-1 reuses
    for its tool descriptions).

11. **Link handlers (wire part of Q-06 A).** `PLANNER_LINK.on('rpc', p => …)`: accept only when the
    envelope's `from==='agent'`; run `request(p.method, p.params)`; reply with
    `PLANNER_LINK.send('rpc.result', {rid:p.rid, …reply})`. That is all MCP-0 does on the wire — the
    addressing, the peers map and the relay gate are MCP-2. A `rpc` from any other role gets
    `{ok:false, code:'forbidden'}`.

12. **The agent cue (Q-11 A).** When a mutating method runs from the link (not from a local
    `window.planner` call), set the HUD to `🤖 Ügynök: <action label>` and keep a status-bar chip
    `🤖 ügynök` for 5 s after the last call (05c `statusBar` — one more `chip(...)`; it is chrome, not
    scene, so goldens stay identical).

13. Hooks: `window.planner` is the hook; add `window.actionExec=actionExec` next to the 05c test hooks.

## Tests

`tests/spec-120-planner-api.js` (jsdom, CLA-teszt_v2 loaded the PRIMER §4 way from `../../../../Calculator/`):
1. `commands()` length === `ACTIONS.length`; `commands({filter:'lampa'})[0].id==='lamp.sheet'` (it is
   `paletteMatches('lampa')`'s first hit today, disabled with no lamp selected); a disabled row carries
   its `need`.
2. `execute('view.style.blueprint')` → `ok`, `state.style==='blueprint'`, `changed:false` (a view change is
   not a model change).
3. `plan.select` a socket's id → `actionCtx().selType==='devices'`; `execute('dev.height')` →
   `ok`, `status:'dialog'`, `dialog.fields[0].id==='dzq'`, **the modal is open**; `execute('view.reset')`
   now → `code:'dialog-open'`; `dialog.submit {token, fields:{dzq:1250}}` → the device's `h===1250`, `undo`
   grew by exactly 1, modal closed. Again with `dzq:'abc'` where the dialog refuses it (or a test dialog
   whose `onOk` returns `false`) → `bad-params` and the modal **still open**; `dialog.cancel` closes it.
   3b. Token race: open `dev.height`, call `closeModal()` directly (the user's Mégse), then
   `dialog.submit` with the old token → `dialog-gone`, nothing changed; open `dev.height`, then open
   `chase.settings` over it → the first token is `dialog-gone`.
   3c. `dialog.submit` with an unknown field id → `bad-params` listing `dzq`, OK not pressed.
4. `execute('mode.wall')` → `code:'tool-started'`, `tool.id==='mode.wall'` (measured 2026-10-19: after
   `runAction('mode.wall')` `toolCurrent()` reports `{id:'mode.wall', label:'Fal rajzolása'}`, so a plain
   mode counts as a tool too); `state.mode==='select'` and `toolCurrent()===null` afterwards.
   `execute('wf.routeWalls')` (a sub-tool) → the same.
5. `execute('proj.new')` → `code:'needs-confirm'`, the plan still has its devices; with `{confirm:true}` → empty.
6. `execute('proj.export')` → `files[0].name` ends `.vplan.json`, **no anchor was clicked**
   (count `HTMLAnchorElement.prototype.click` calls), `window.download` behaves normally after the call.
7. `execute('nope')` → `code:'unknown-action'`; a throwing action (register a test action that throws) →
   `code:'threw'` with the message, and the HUD behaviour of `runAction` is unchanged.
8. `inspect()` counts equal `__data` lengths; `limit:3` truncates rooms with `truncated`.
9. `plan.query({room:'Nappali'})` → every row's `facts.Helyiség` contains "Nappali".
10. `plan.checks()` → `validate.error` equals `validateSummary().error`.
11. Golden identical; `check-globals` clean.

`tests/spec-121-agent-link.js` (fake WebSocket like `tests/control-bridge-smoke.js`): an envelope
`{from:'agent', type:'rpc', payload:{rid:7, method:'ping'}}` → a sent `rpc.result` with `rid:7`,
`result:'pong'`; the same from `from:'phone'` → `forbidden`; a phone `cmd` (`tool.select`) still
acks exactly as before; `spec-101-dash-link.js` still green.

## Verifier focus

The capture must be airtight: run spec 6 and then a normal UI download in the same window — the second
must reach the anchor. `runAction`'s callers (palette Enter, keyboard map, `dash.action`) unchanged.
`actions.run` must never leave a sub-tool live when it returns (unless `keepTool`). A dialog it opens
stays open by design (Q-03 B) — check that every mutating method really refuses with `dialog-open`
while it is, and that `dialog-gone` fires on every way a modal can close (Mégse, OK, backdrop click,
`hardResetWorkspace`, a second `openModal`).

## Live check (owed)

`planner-serve` (port 8131), load CLA-teszt_v2, then in the browser console:
`await planner.commands({filter:'lámpa'})`, `await planner.execute('dev.height')` with a socket
selected (the dialog opens in the tab with the `🤖 Az ügynök tölti ki` line; the reply lists its fields),
then `await planner.request('dialog.submit', {token, fields:{dzq:1100}})` — the dialog closes and the
socket moves in Wall View. Once more, but press Mégse by hand before submitting → `dialog-gone`.
