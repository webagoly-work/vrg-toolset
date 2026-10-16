# Simplified UI (SUI) — CONTRACT

*Short on purpose. `docs/PRIMER.md` §0–§5 still applies (worktree, NODE_PATH, the build → check → test loop).*

## 0. Where you work — and who else is there

Worktree `H:/Dev-VRG/VRG-DE/wt-planner-stack/Planner/projects/varler-planner`, branch `planner-stack`.

**A second session works in the same worktree at the same time** on the UI tidy, T1–T4
(`docs/ui-tidy/UI-AUDIT.md` §5). It rewrites the tool switching, the stage rail, the sidebars and the Tools panel.

- `git status` before you start and before you report.
- Never commit, never stash, never `git add -A`. The user commits.

```bash
export NODE_PATH=H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules
node build.js && node tools/check-globals.js && node tests/run.js
```

If the other session's half-done work breaks the build or a test that is not yours, do **not** fix it. Run your own
spec directly (`node tests/spec-s2-sm-menu.js` against your build) and say so in the report.

## 1. File ownership (the rule that keeps two sessions apart)

| SUI owns (create and edit freely) | SUI may touch, one hook line at most, named in the WP | SUI never edits |
|---|---|---|
| `src/11s-sm-mode.js` (S0, S1, S5) | `src/08b-gamepad.js`: **S7 only**, up to 3 guarded lines (Y opens the corner menu, A / B act on it), each starting `if(typeof smOn==='function'&&smOn())` | `src/05d-shell.js`, `src/12-boot.js`, `src/08-interaction.js` |
| `src/11t-sm-menu.js` (S2, S4, S6 CSS) | | `src/shell.html` (inject CSS and DOM from JS instead) |
| `src/11u-sm-tree.js` (S3, S7) | | anything `08c`–`08o` (the WF tools); call their public functions only |
| `tests/spec-s0-*.js` … `tests/spec-s7-*.js` | | |
| `docs/simple-ui/**` | | |

The module numbers 11s, 11t and 11u sort after `11c-wf-keys.js` and before `12-boot.js`. So `ACTIONS`, `STK_*`, `UKEYS`
and every tool exist when your files load, and `12-boot` (restoreSession, initWorkspace) runs after them.

## 2. Interfaces with the main session (both sides keep these names)

1. **Chrome-hide rule.** Simple mode is `body.ui-simple`. Your CSS hides:
   - `header`, `.side`, `.resizer`, `#toolbarRow`;
   - every child of `.stage-wrap` except `svg#stage` and `#smRoot`;
   - fixed floating panels, by id and `[data-chrome]`.

   The main session promises:
   - **every new piece of chrome it adds either lives inside `header`, `.side` or `.stage-wrap`, or carries
     `data-chrome`;**
   - `.stage-wrap` and `svg#stage` keep their names.
2. **Sheets.** A panel that may show in simple mode as a sheet carries `data-sheet` (S7). Simple mode shows a
   `[data-sheet].sm-open` element and hides the rest.
3. **Tool controller (T1, built by the main session).** These globals will exist once T1 lands:
   - `toolCurrent()` → `{id, label, icon, hint} | null`;
   - `toolStop()`;
   - `toolStart(id)`;
   - `toolOnChange(fn)`.

   Until then, S5 uses the fallback written in its WP. **Feature-test with `typeof toolCurrent==='function'`.**
4. **Actions are the only door.** A menu leaf runs `runAction(id)`. If a feature has no action, S3 registers one
   (in `11u`) that calls the public function. Never call a tool's internals from the menu.

## 3. Rules

1. **Reuse before you write:**
   - search scoring is `paletteScore` / `fold` (05c);
   - the action list is `actionsFor` / `actionEnabled` / `runAction`;
   - camera fitting after a resize is `setTransform()` + `draw()`.

   A parallel copy of any of them is a defect.
2. **Nothing in the drawing changes.** The scene SVG must be byte-identical in simple and normal mode, so goldens stay
   **70/70**. (A spec asserts it, like the shell on/off test.)
3. **The mode is a viewer preference, not project data.** Store it in `localStorage['villanyterv_ui']` =
   `'simple' | 'normal'`. URL `?ui=simple` wins for that page load. No `data.*` field, no `UKEYS` entry, no schema change.
4. **`Esc` never discards.** In the menu it steps back one level; at the root it closes the menu. With the menu closed,
   Esc goes to the app as before.
5. **Hungarian UI, English code.** Strings in the WPs are final unless marked ⚑. Labels in the menu are UPPERCASE by CSS
   (`text-transform`), never typed in capitals.
6. **New global names start with `sm`** (`smOn`, `smOpen`, `smTree` …). `node tools/check-globals.js --prefix sm` before
   you report.

## 4. Data additions

None. Not in `data`, and **not in `state` either**: `state` is saved with the project (spec-18 asserts `state.shell` travels in
`sessionObj()`), and the mode is a viewer preference. Keep it in a module object `SM` (`SM.on`, `SM.open`, `SM.stack` …)
and in `localStorage['villanyterv_ui']`.

## 5. Report (end of every WP)

```
WP-S<n> — <title>: DONE | PARTIAL | BLOCKED
Files: <list>   Spec: tests/spec-s<n>-*.js  <passed>/<total>
Suite: node tests/run.js → <suites>, <checks>, golden <x>/70  (or: "suite red because of <file> — not mine")
check-globals: OK | <names>
Browser: <what you clicked in planner-stack-dist :8138>, screenshot attached if the WP draws
Deviations from the WP: <none | list>
Open: <none | list>
```

Then update README §4 (one status line).
