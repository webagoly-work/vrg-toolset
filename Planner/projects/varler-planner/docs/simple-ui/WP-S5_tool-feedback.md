# WP-S5 — Tool feedback in the dial

**Goal:** with every panel gone, the user still has to see which tool is running, how to use it, and how to get out.
The dial carries that, and a one-line hint pill appears beside it.

**Read:**
- design §5;
- contract §2.3 (the T1 interface);
- `src/08-interaction.js:23` (`setMode`, `HINTS`);
- `src/05c-actions.js:133` (`statusValidate`), `:156` (`MODENAME`).

## Build (in `src/11s-sm-mode.js`)

1. **`smToolNow()`** returns `{id, label, icon, hint} | null`.
   - **When `typeof toolCurrent==='function'`** (T1 has landed): `return toolCurrent()`.
   - **Fallback, until then.** This table is ordered: the first hit wins. Each flag is read behind a `typeof` guard:

     | Live when | id |
     |---|---|
     | `RWL.on` | `wf.routeWalls` |
     | `RB.on` | `wf.rule.<RB.preset>` |
     | `LSW.on` | `wf.switches` |
     | `CLN.on` (plane) | `wf.ceilLine` / `wf.floorLine` |
     | `JB_T.on` (kind) | `wf.boxSzoba` / `wf.boxKot` / `wf.board` |
     | `EP_T.on` | `ep.place.<EP_T.code>` |
     | `HW_T.on` | `hw.<HW_T.type>` |
     | `PT_T.on` | `pt.place` |
     | `CL_T.on` | `cls.place` |
     | `MRK_T.on` | `mark.wall` |
     | `MRK_P.on` | `mark.plane` |
     | `state.mode!=='select'` | `'mode.'+state.mode` |

     `label` and `icon` come from `actionById(id)`. `hint` is `$('modeHint').textContent`. **`select` with nothing live
     → null.**
2. **`smDialState()`** gains:
   - `tool` = `smToolNow()`;
   - `warn` = `statusValidate().error|0`.
3. **Sync:**
   - with `typeof toolOnChange==='function'` → `toolOnChange(smToolSync)`;
   - otherwise a MutationObserver on `#modeHint` (childList, characterData, subtree) → `smToolSync()`, **plus** a 300 ms
     `setInterval` that runs only while `smOn()` (cleared on `smSet(false)`);
   - `smToolSync()` redraws the dial, and when the tool id changed it shows the hint pill.
4. **Hint pill** `#smHint`:
   - `smHintShow(text)` sets the text, adds class `on`, and arms a timer: it hides after **`SM_HINT_MS=6000`**;
   - the clock is injectable: `smNow()` (defaults to `Date.now`), and `smHintTick()` hides when
     `smNow()-SM.hintAt>=SM_HINT_MS` (tests call it);
   - a MutationObserver on `#hud` → `smHintShow(hud.textContent)` when it is non-empty and differs from the last text;
   - hovering the dial → show the last text again;
   - empty text → hidden.
5. **Click the dial core while a tool runs** = stop:
   - `typeof toolStop==='function' ? toolStop()`;
   - otherwise dispatch `keydown Escape` on `document` (the app's own Esc chain), then `setMode('select')`.
   - The menu does not open on that click. A second click (no tool) opens it.

## Tests — `tests/spec-s5-sm-tool.js`

1. Simple mode on, nothing running → `smToolNow()===null`, and the core shows `≡`.
2. `runAction('wf.routeWalls')` →
   - `smToolNow().id==='wf.routeWalls'`;
   - the dial core text is that action's icon;
   - the outer ring has class `tool`.
3. `smHintShow('x')` → `#smHint.on`, text `x`. Fake the clock 5999 ms later and call `smHintTick()` → still on;
   at 6000 ms → off.
4. Writing `$('hud').textContent='Teszt üzenet'` → the pill text is `Teszt üzenet` (flush observers:
   `await new Promise(r=>setTimeout(r,0))`).
5. A click on the core while the routing-wall tool runs → `RWL.on===false`, the menu is not open, the core is `≡`.
6. `setMode('path')` → the id is `mode.path`.
7. `statusValidate` stubbed to `{error:2}` → the dial has `.smWarn` with text `2`.
8. **When T1 exists** (`typeof toolCurrent==='function'`): stub `window.toolCurrent=()=>({id:'x',label:'X',icon:'✳',hint:'h'})`
   → the core shows `✳`. The fallback table is not consulted (spy on `RWL` access via a getter).
9. Leaving simple mode clears the interval: the timer count before and after, via a `setInterval` spy.

## Out of scope

Changing any tool's own hint text.
