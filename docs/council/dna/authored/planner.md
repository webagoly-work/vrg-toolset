## Authored half

*Worked example, 2026-10-31. Sources: `docs/hub/agents/planner.md`, `Planner/projects/varler-planner/CLAUDE.md` and `docs/PRIMER.md` as quoted
there, and the source files named below. Tags as in `docs/council/02_DNA-V2.md`.*

### What it is
- [A] An electrical planning tool for residential and commercial work. The whole product is one offline HTML file. Hungarian UI, English code.
- [E] Source is `src/*.js` + `src/shell.html`, built by `build.js` into `dist/varler_planner.html`.

### The shape that decides everything
- [A] `src/*.js` are **concatenated in filename order into one shared scope**. There are no modules: a name defined anywhere is visible
  everywhere, order is load-bearing, and a duplicate top-level name fails silently at boot.
- [I] So in this codebase a filename prefix is a load order, and the place to add code is decided by what must already be defined.

### Data contracts
- [A] A new top-level data collection goes in both `UKEYS` and `IDPRE`. The schema is in `01-schema.js`.
- [E] `11c-wf-keys.js` shows the late-registration pattern: push onto `UKEYS`, set the `IDPRE` entry, then guard the collection is an array.

### Integration seams
| To add | Seam | Tag |
|---|---|---|
| A user capability | one registration in `05c-actions.js`: `registerAction` / `registerActions` | [E] |
| A top-level collection | `UKEYS` + `IDPRE` | [A] |
| A translated string | `00b-i18n.js` | [E] |
| A document migration or validation | `01-schema.js` | [E] |
| A menu tool or build step | `launcher/vrg-menu.json`, then `node tools/check-start.js` | [A] |

### Invariants
- [A] `node tests/run.js` does not build, so build first. The golden set of 70 renders must stay byte-identical.
- [A] `Esc` never discards work. Never replace an `<svg>` during a drag.
- [A] A failing spec is a specification: read what it protects before changing it.
- [A] Run `tools/check-globals.js` after adding top-level names.

### Traps
- [A] `dist/` is generated; change `src/`.
- [A] `docs/2_0_architecture.md` is unbuilt design, not a description of the code.
- [A] `src/modules.json` is stale; module names must match the pattern in `build.js`.
- [A] `node_modules` (jsdom) is only in the main checkout; a worktree needs `NODE_PATH`.
