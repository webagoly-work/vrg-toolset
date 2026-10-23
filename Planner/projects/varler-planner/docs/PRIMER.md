# Primer — read this before your first edit to the Planner

*An on-ramp for a Claude Code session that has never touched this codebase. `ARCHITECTURE.md` is
the map and `DECISIONS.md` is the why; this is the **experience** — the loop that works here, what
the safety nets actually cover, and the specific things that have cost real time. Written
2026-10-09 after the view-scale / icon-set round; add to it when something bites you too.*

---

## 0. First: which checkout are you in?

This can waste an hour before you notice.

```bash
git rev-parse --show-toplevel && git branch --show-current
```

There are **three** copies of this repo on the machine and they are not interchangeable:

| path | what it is |
|---|---|
| `H:\Dev-VRG\VRG-DE\Planner_VRG_U100` | the real repo, branch `main` |
| `H:\Dev-VRG\VRG-DE\wt-planner-stack` | a **git worktree**, branch `planner-stack` — where the live work has been |
| `H:\Planner_VRG_U100` | a dead backup. Never work here. |

The branch matters more than it looks. As of 2026-10-09 the `main` build contains **zero**
occurrences of `stkCreate` — the whole BRIDGE Stack (22 work packages) lives only on
`planner-stack`. Before you reason about "what the Planner does", check which build you are
looking at:

```bash
grep -c "stkCreate" dist/varler_planner.html
```

`Planner/START.cmd` opens the **main** checkout's build. Its `W)` action builds and opens the
worktree one. Same program, a year apart.

---

## 1. The loop that works

```bash
node build.js && for f in src/*.js; do node --check "$f"; done
```

Build first, then parse-check **every module separately**. The build concatenates without parsing,
so a broken template literal becomes a silently dead page; `node --check` on the built HTML is
useless (it is HTML). Per-module checking names the file and the line.

Then the suite. **`node_modules` exists only in the main checkout**, so tests need:

```bash
NODE_PATH=/h/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules node tests/run.js
```

The *build* needs nothing — `build.js` uses only `fs` and `path`. Only the tests need jsdom.

One more cheap net, worth running after adding a module:

```bash
node tools/check-globals.js
```

Every module shares one scope, so a duplicate top-level name fails **silently at boot**. A
duplicate `SC` once killed the whole app.

---

## 2. What the golden renders actually cover — and what they do not

70 hashed renders are the best tool in the repo for proving a refactor was pure. But read
`tests/golden.js` before you trust them, because the net has holes exactly where you may be
working. Per fixture it captures:

| capture | calls | so it covers |
|---|---|---|
| `scene@0/45/90`, `plan2d` | `drawNormalGeom()` | walls, floors, slabs, roofs, objects, openings-as-faces, iso grid |
| `blueprint`, `blueprintIso` | `drawBlueprintPlan/Iso()` | the official view **including `bpFloorLabel`** |
| `elevation`, `elevation+far` | `wallElevationSVG()` | the wall editor — **device boxes are in here** |
| `plane:floor/drop/ceiling` | `planeViewSVG()` | the plane editor |
| `chaseSummary` | the numbers | quantities |

**It never calls `draw()`.** So the plan **device symbols** (`devSym` / `icoSym` / `hwSymbol` /
`epSymbol`), paths, cables, notes, measures and the entire overlay are **outside the net**. I
rewrote every device symbol in the plan and the goldens stayed 70/70 byte-identical. That is not
proof of anything — go and look in a browser.

The mirror of that: the **editor** device boxes (`wvDevBox`, `hwWvBox`, `epWvBox`) *are* covered,
which is why a sweep over size literals has to exclude the Wall View / Plane View code. Those
surfaces have their own mm→px scale and know nothing about the plan's.

### Use the net deliberately

The most valuable technique from the last round: **make the new behaviour the identity at the
default setting.** The view scale added `vsP()` / `vsDash()` / `vsBadge()` around ~160 hardcoded
sizes; at step 1 each returns its input unchanged. So "goldens 70/70 byte-identical" became a
machine-checked proof that a 160-site sweep was pure — and it caught two real mistakes. If you are
about to change many call sites, find the setting where your change is a no-op first.

When a golden genuinely should move:

```bash
node tests/run.js --golden-update
```

---

## 3. A size in the drawing has three kinds. Say which.

Since the view scale, `SC` (base units per model mm) is a **variable**, not a constant. `vsSet(f)`
grows the model in base space and divides the zoom by the same factor, so the picture never
jumps — what moves is the band the zoom range covers.

Which means every size you write has to declare itself:

- **model mm** — geometry, `nvMM()` room text. Scales with the model. Correct by construction.
- **paper mm** — `bpU` / `nvSW` / `bpSW` / `bpFS`. Already multiplies by `SC`. Correct by construction.
- **base units as a literal** — `stroke-width="1.6"`, `r="4"`. Would shrink on screen. Wrap it:
  `vsP(1.6)`, `vsDash('7 4')`, and `devK()` / `pathK()` for the symbol scales.
- **already screen-constant** — anything of the form `C/state.zoom`. Leave it alone.

A screen-sized **badge** — a label, a node dot, the cursor read-out, the move gizmo — goes through
`vsBadge(x, y, svg)` instead, which scales the whole group about its own anchor so the little ±3
offsets travel with the font size. **Never put model-true geometry through `vsBadge`** — it would
scale the building.

---

## 4. Verify in a real browser, with a real plan

jsdom has no layout and no text metrics, so anything about size, overlap or legibility has to be
seen. There is a dev server for exactly this:

```bash
node tools/serve.js
```

It serves the **repo root** on `http://localhost:8131/` — deliberately, so a real plan can be
fetched into the page:

```js
const r = await fetch('/Calculator/CLA-teszt_v2.vplan.json').then(r => r.json());
hardResetWorkspace(); applyProjectData(r.project || r); draw();
```

Then measure rather than squint. `getBBox()` on a label returns its box **in model millimetres**
(the label sits under a matrix that maps model mm → base units), so it compares directly against
the room polygon:

```js
document.querySelectorAll('#lyScene g[transform^="matrix"] > text')
  .forEach(t => console.log(t.textContent.trim(), Math.round(t.getBBox().width)));
```

**This is the lesson, not the snippet.** The complaint was "the text is way too big". I assumed
the big rooms. Measured: Nappali was at 0.26 of its room width — fine — while the WC was at
**1.83×** and the lépcső at **1.90×**, spilling their names across the neighbours. The fix was the
opposite of my first instinct. Ten minutes of measuring beat an hour of guessing.

Browser-pane notes for the desktop app: launch configs come from **`H:\.claude\launch.json`** (the
session's original working directory), not the repo's `.claude/launch.json`. Config
`planner-serve` is the one above; `planner-stack-dist` (8138) serves only `dist/`.

---

## 5. Traps that have actually cost time

**A failing spec is a specification.** Replacing the device symbols broke four suites. Every one
pointed at real information loss I had not noticed: the RBX short label, the STD-004 endpoint
code, the dashed outline that means "this szerelvénydoboz is still empty", the tint fill the layer
colour feature promised. None of them were the test being stale. Read what the assertion is
protecting before you touch it.

**Regex sweeps over template literals need a parse-check after every pass.** Sweeping
`stroke-width="1.6"` → `stroke-width="${vsP(1.6)}"` is fine inside a backtick string and *breaks*
inside a single-quoted one:

```js
const dash = back ? 'stroke-dasharray="${vsDash('2.5 2')}"' : '';   // syntax error
```

Four of these hid in the codebase. They surface one at a time, so loop:
`build → node --check every module → fix → repeat`.

**`node -e` plus bash quoting will eat your patch script.** `\u0027` escapes get mangled between
the shell and Node's TypeScript-aware parser; three attempts failed in confusing ways. Write the
patch to a `.js` file (scratchpad) and run it, or use the Edit tool. **There is no Python on this
machine.**

**Module filenames must match `/^\d\d[a-z]?-.*\.js$/`** and load in filename order. Only one
letter is allowed after the digits — in the `05` range only `05a` and `05z` were still free. Top
level `const`/`let` are in a TDZ until their point in the concatenation, so a table referenced at
another module's top level must be defined earlier. Inside functions, order never matters.

**Only `function` declarations reach `window`.** jsdom specs call through `window`, so a `const`
table needs an explicit hook. There is a hook line at the bottom of `12-boot.js` and per-module
ones at the bottom of the `05*` modules — add yours there, not somewhere new.

**`STK_DEVSYM` order decides who wins.** `push` = fallback, `unshift` = takes precedence. First
non-null answer wins, so a new symbol provider that returns `null` for what it does not know
composes cleanly with the ones already there.

**Touching `START.cmd`?** CRLF only (with LF, `for (...)` blocks silently stop matching), console
output ASCII only (accents garble under the codepage), and inside a parenthesised block escape
brackets as `^)` or the block closes early. The numbered tool slots are full at ten because the
menu reads a single keypress — a new entry needs a letter in `ACTIONKEYS` plus a dispatch line.
Verify by copying the file, stubbing the `choice` call, running it, and deleting the copy.
`node tools/check-start.js` must exit 0.

---

## 6. Where a change goes

By subject, not by size. A new door type → `04-render.js`. An editor action → `06-` / `07-`. A
standard or catalogue number → `00-core.js` for now. Something that runs on this PC outside the
browser → `tools/`. Something that runs on another device → `mobile/`.

Every user-facing capability is declared once in `05c-actions.js`. Three consumers read that list
(⌘K palette, keyboard map, status bar). **A capability that is not registered there is a feature
nobody can find** — including a toggle you also put in the sidebar.

`dist/` is generated. Never hand-edit it.

---

## 7. Reading order for a new session

1. `CLAUDE.md` (project root) — the rules.
2. This file.
3. `docs/ARCHITECTURE.md` — the module table and the invariant list. Non-negotiable before a
   non-trivial edit.
4. `docs/DECISIONS.md` — read before "fixing" something that looks wrong on purpose.
5. `docs/stack/README.md` — status and findings for the BRIDGE Stack, if you are on that branch.
6. `docs/1.1_backlog.md` — queued work. `docs/2_0_architecture.md` is **unbuilt design**; do not
   assume any of it exists in code.

And one habit worth copying: this codebase's comments explain *why*, often with the measurement or
the bug that forced the choice. Match that. A comment that says what the next line does is noise
here; one that says "a filter is the first thing an SVG exporter throws away" saves the next
session an afternoon.
