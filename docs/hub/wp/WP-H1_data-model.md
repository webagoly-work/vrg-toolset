# WP-H1 — Topology data model, validator, seed import

**Goal:** `Hub/data/topology.json` exists (from the seed), is validated by one pure function used by
the page, the tests and `check-hub.js`, and is baked into the build.

## Read
`01_ARCHITECTURE.md` §4 · `docs/hub/hub-seed.json` (the whole file) · `02_BUSINESS-TOPOLOGY.md` §1.

## Build
1. Copy `docs/hub/hub-seed.json` → `Hub/data/topology.json` unchanged except `"updatedBy"`. Drop the
   top-level `note`.
2. `Hub/src/js/10-model.js` (works in browser and Node: `if (typeof module!=='undefined') module.exports=…`):
   - `kpValidate(topo)` → `{ok, errors[], warnings[]}`. Errors: wrong `schema`; duplicate department
     or program id; program `dept` unknown; `status` not in `live|dev|idea|v2`; a folder `ref` that is
     not an `onedrive.folders[].id`; `claim.until` not `YYYY-MM-DD`. Warnings: empty `url` on a
     folder; program without `d`; `d` longer than 140 chars.
   - `kpResolveRefs(topo)` → folder entries with `ref` replaced by the referenced folder (keep `ref`).
   - `kpVisible(topo, view)` → programs for `view` `'now'` (status ≠ v2) or `'vision'` (all), each
     department keeping seed order; departments with zero visible programs still appear (empty
     header with one ○ slot).
   - `kpLinkFor(node, ctx)` → `{href, kind}` per `03_UI.md` §4 (repo file → blob URL, repo dir →
     tree URL, `url` as is, `local` → `{kind:'local', path}`); `ctx` = `{repo, localRoot}`.
3. Build: embed `topology.json`. `check-hub.js`: run `kpValidate` on it (errors → exit 1, warnings
   printed) and check that every `repo` / `git.paths` entry exists on disk (except `Hub/dist/…`
   before the first build).

## Tests (`Hub/test/spec-10-model.js`, exact values from the seed)
- `kpValidate(seed).ok === true`, `errors.length === 0`.
- departments = 13; programs = 55; by status: live 21, dev 11, idea 4, v2 19.
- `kpVisible(seed,'now')` total programs = 36; `'vision'` = 55; department `IRO` in `'now'` has 0
  programs and is still present.
- duplicate id injected → error contains `"planner"`; bad `ref` `od-xx` → error.
- `kpLinkFor({repo:'MindMap/vrg_mindmap.html'}, ctx)` → `https://github.com/webagoly-work/vrg-toolset/blob/main/MindMap/vrg_mindmap.html`;
  `{repo:'Calculator'}` (a directory — decide by "has an extension") → `…/tree/main/Calculator`.
- after resolve, program `onedrive` has 3 folders, the first with `path === '00_START'`.

## Out of scope
Drawing (H2). Network (H6).
