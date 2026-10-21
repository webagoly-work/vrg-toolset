# WP-H3 — Click, right-click menu, info drawer, search, favourites

**Goal (user):** "every node is clickable and points to https addresses" · "RCO to every node to
provide information with brief and with a longer versions".

## Depends / decisions
H2 approved. HUB-Q05 (where programs open from; A = local via companion, preview from GitHub).

## Read
`03_UI.md` §3–§7 · MindMap's `ACT` registry (one entry declares an action and which surfaces show
it) — **use the same pattern**: `KP_ACT = [{id, label, surfaces:['rco','bar','pal'], when(ctx), run(ctx)}]`.

## Build
1. `Hub/src/js/40-actions.js`: the action registry with every row of the RCO list (03_UI §5). Actions
   that need the companion or a token are present but `enabled:false` with a `why` text until
   H5/H6/H10 provide them (`kpCaps = {companion:false, github:false}` for now).
2. Click → main action per kind (03_UI §4) via `kpLinkFor`; `window.open(href,'_blank','noopener')`.
   Program with a `repo` path and no companion → a small popover: the `file:///` path (from the
   *Helyi repó mappa* setting; auto-detect when `location` is inside a clone: `…/Hub/dist/` → two
   levels up) + "Másolás" + "Megnyitás a GitHubon".
3. RCO menu (right-click; long-press 500 ms on touch), keyboard: `Shift+F10` / `ContextMenu` key on
   the focused node. Arrow keys move focus between cards (nearest in direction, like MindMap's `cos³`
   weighting); `Enter` = click.
4. Info drawer (03_UI §6): *Rövid* / *Részletes* tabs; a tiny markdown renderer (headings, bold,
   italics, code, lists, links — no HTML passthrough; escape everything else).
5. Search (Ctrl+K): over `t`, `d`, `dEn`, `long`, layer node titles; Hungarian accent-insensitive
   (`á→a`, `ő→o` …); Enter = fly the camera to the node and pulse it 3×.
6. Favourites: RCO "Kedvencekhez"; strip under the top bar, max 8, stored in `kpStore`.
7. Tooltip after 400 ms.

## Tests (`spec-40-actions.js`, `spec-41-search.js`, `spec-42-md.js`)
- every RCO label in 03_UI §5 exists in `KP_ACT` with surface `rco` (string-exact; 13 entries —
  a toggle pair like *Kedvencekhez / Kedvencek közül ki* is one entry).
- `kpNorm('Árvíztűrő tükörfúrógép')` = `arvizturo tukorfurogep`.
- search "kalk", view `'now'`: title matches rank first, so results 1–3 are the three calculators
  in seed order (calc-panel, calc-general, calc-led); the results also contain the department
  `KALK` and the agent doc "Kalkulátorok összefoglaló"; the v2 program `insight` is absent in
  `'now'` and present in `'vision'`.
- `kpMd('**a** <b>x</b>')` = `<strong>a</strong> &lt;b&gt;x&lt;/b&gt;`.
- Browser: right-click on Planner shows 13 items, "Terminál itt" greyed with the companion tooltip;
  "Részletes leírás" opens the drawer on the long tab and the text starts "Moduláris forrásból".

## Out of scope
Editing (H7), the token (H4), live commits (H6).
